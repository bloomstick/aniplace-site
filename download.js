// GitHub release wiring for the family hub.
//
// Every download CTA is a normal link in the HTML, so the page works before
// (and without) this script. The script upgrades those links to the current
// release assets, fills in version/date/size/SHA, and flips the Mangaplace
// card from "soon" to real buttons when the first public release appears.
//
// Downloads come from S3 first: the admin panel publishes one `latest.js`
// manifest per app (stable object names, no older builds kept), and the site
// loads it with a script tag before asking GitHub. A script tag is not
// subject to CORS, so this works on storages that cannot return ACAO. When the manifest is absent, stale or
// unreachable, the GitHub release API is the fallback. GitHub allows 60
// unauthenticated API calls per hour per IP, so parsed releases are cached in
// sessionStorage for 30 minutes. If both sources fail, Aniplace falls back to
// the last known-good direct links below; Mangaplace stays honestly "soon"
// until a release exists. Bump FALLBACK when release filenames rotate.

(function () {
  'use strict';

  // v3: entries written by the GitHub-only resolver must not hide the S3
  // manifest for the rest of the session after a site deploy.
  var CACHE_KEY = 'place.releases.v3';
  var CACHE_TTL = 30 * 60 * 1000;

  // S3 download base written by Admin -> Downloads. It must match
  // `releases_public_base_url` in repo/tools/cover_thumbs/config/upload.json.
  var S3_BASE = 'https://3a4bb16ee9b5156df4f9712cffe6d7a4.bckt.ru/downloads/';

  var APPS = {
    aniplace: {
      name: 'Aniplace',
      slug: 'aniplace',
      repo: 'bloomstick/aniplace-releases',
      api: 'https://api.github.com/repos/bloomstick/aniplace-releases',
      releases: 'https://github.com/bloomstick/aniplace-releases/releases',
      fallback: {
        version: '1.25.0',
        published: '2026-11-11T20:52:38Z',
        releaseUrl: 'https://github.com/bloomstick/aniplace-releases/releases/tag/v1.25.0',
        android: {
          name: 'aniplace-1.25.0-android.apk',
          url: 'https://github.com/bloomstick/aniplace-releases/releases/download/v1.25.0/aniplace-1.25.0-android.apk',
          size: 45176384
        },
        windows: {
          name: 'aniplace-1.25.0-windows-setup.exe',
          url: 'https://github.com/bloomstick/aniplace-releases/releases/download/v1.25.0/aniplace-1.25.0-windows-setup.exe',
          size: 31974902,
          kind: 'exe'
        },
        sha: {
          name: 'SHA256SUMS.txt',
          url: 'https://github.com/bloomstick/aniplace-releases/releases/download/v1.25.0/SHA256SUMS.txt'
        }
      }
    },
    mangaplace: {
      name: 'Mangaplace',
      slug: 'mangaplace',
      repo: 'moeplace/mangaplace-releases',
      api: 'https://api.github.com/repos/moeplace/mangaplace-releases',
      releases: 'https://github.com/moeplace/mangaplace-releases/releases',
      fallback: null
    }
  };

  var current = {
    aniplace: APPS.aniplace.fallback,
    mangaplace: null
  };
  var cache = readCache();
  var listeners = [];
  var platform = detectPlatform();

  document.documentElement.setAttribute('data-platform', platform);

  // Paint the known-good state immediately, then upgrade when GitHub answers.
  applyApp('aniplace', current.aniplace);
  applyApp('mangaplace', null);
  resolveApp('aniplace');
  resolveApp('mangaplace');

  // ---- public API ----------------------------------------------------

  window.PlaceDownloads = {
    apps: APPS,
    get: function (app) { return current[app] || null; },
    platform: function () { return platform; },
    resolveOS: resolveOS,
    onChange: function (fn) {
      if (typeof fn !== 'function') return;
      listeners.push(fn);
      fn(current);
    }
  };

  function startDownload(url) {
    if (!url) return;
    // A hidden iframe starts the attachment without navigating the page,
    // so the install guide can open at step 3 while the file downloads.
    var frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.title = 'Скачивание файла';
    frame.setAttribute('aria-hidden', 'true');
    frame.src = url;
    document.body.appendChild(frame);
    window.setTimeout(function () {
      if (frame.parentNode) frame.parentNode.removeChild(frame);
    }, 120000);
  }

  // ---- platform ------------------------------------------------------

  function detectPlatform() {
    var ua = navigator.userAgent || '';
    var name = '';
    if (navigator.userAgentData && navigator.userAgentData.platform) {
      name = navigator.userAgentData.platform;
    } else if (navigator.platform) {
      name = navigator.platform;
    }
    name = String(name).toLowerCase();
    var touchMac = /mac/i.test(name) && navigator.maxTouchPoints > 1;
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua) || touchMac) return 'ios';
    if (/windows|win32|win64/i.test(name) || /windows/i.test(ua)) return 'windows';
    if (/mac/i.test(name) || /mac os x/i.test(ua)) return 'macos';
    if (/linux|x11/i.test(name) || /linux/i.test(ua)) return 'linux';
    return 'other';
  }

  function resolveOS(requested) {
    if (requested && requested !== 'auto') return requested;
    if (platform === 'windows') return 'windows';
    return 'android';
  }

  // ---- release resolution -------------------------------------------

  function resolveApp(app) {
    if (!window.fetch) return;
    var cached = cache && cache[app];
    if (cached && cached.at && Date.now() - cached.at < CACHE_TTL) {
      current[app] = cached.release;
      applyApp(app, cached.release);
      emit();
      return;
    }
    // S3 first, GitHub only when no latest manifest is published there.
    resolveFromS3(app)
      .then(function (release) {
        if (release) {
          adopt(app, release);
          return;
        }
        resolveFromGithub(app);
      })
      .catch(function () {
        resolveFromGithub(app);
      });
  }

  function adopt(app, release) {
    current[app] = release;
    cache[app] = { at: Date.now(), release: release };
    writeCache(cache);
    applyApp(app, release);
    emit();
  }

  function resolveFromS3(app) {
    var slug = APPS[app].slug;
    if (!slug || !S3_BASE) return Promise.resolve(null);
    return loadS3Manifest(slug).then(function (manifest) {
      return parseS3Release(app, manifest);
    });
  }

  // The publisher assigns the manifest to window.__aniLatest[slug]. Loading it
  // as a script avoids the cross-origin fetch that the storage blocks.
  function loadS3Manifest(slug) {
    return new Promise(function (resolve) {
      var script = document.createElement('script');
      var done = false;
      var timer = window.setTimeout(function () { finish(null); }, 8000);
      function finish(manifest) {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        script.onload = script.onerror = null;
        if (script.parentNode) script.parentNode.removeChild(script);
        resolve(manifest || null);
      }
      script.onload = function () {
        var box = window.__aniLatest;
        var manifest = box && box[slug];
        if (box) delete box[slug];
        finish(manifest);
      };
      script.onerror = function () { finish(null); };
      script.src = S3_BASE + slug + '/latest.js';
      (document.head || document.documentElement).appendChild(script);
    });
  }

  function parseS3Release(app, manifest) {
    if (!manifest || !manifest.version) return null;
    var base = S3_BASE + APPS[app].slug + '/';
    function asset(entry, kind) {
      if (!entry || !entry.name) return null;
      var name = String(entry.name);
      var out = {
        name: name,
        url: entry.url ? String(entry.url) : base + name.replace(/^\/+/, ''),
        size: entry.size || 0
      };
      if (kind) out.kind = kind;
      return out;
    }
    var android = asset(manifest.android);
    var windows = asset(
      manifest.windows,
      manifest.windows && /\.exe$/i.test(String(manifest.windows.name))
        ? 'exe' : 'zip'
    );
    if (!android && !windows) return null;
    return {
      version: String(manifest.version),
      published: manifest.published || '',
      releaseUrl: manifest.githubReleaseUrl ||
        (APPS[app].releases + '/latest'),
      android: android,
      windows: windows,
      sha: asset(manifest.sha256) || {
        name: 'SHA256SUMS.txt',
        url: base + 'SHA256SUMS.txt'
      },
      source: 's3'
    };
  }

  function resolveFromGithub(app) {
    var controller = null;
    var timer = null;
    if (window.AbortController) {
      controller = new AbortController();
      timer = setTimeout(function () { controller.abort(); }, 8000);
    }

    return fetch(APPS[app].api + '/releases?per_page=5', {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      })
      .then(function (list) {
        adopt(app, pickRelease(list));
      })
      .catch(function () {
        // Keep the last-known-good Aniplace links; Mangaplace stays "soon".
        // Cache the fallback too: a shared IP can hit GitHub's 60/hour limit
        // and hammering the API on every page load only makes it worse.
        current[app] = APPS[app].fallback;
        cache[app] = { at: Date.now(), release: APPS[app].fallback };
        writeCache(cache);
        applyApp(app, APPS[app].fallback);
        emit();
      })
      .then(function () {
        if (timer) clearTimeout(timer);
      });
  }

  function pickRelease(list) {
    if (!list || !list.length) return null;
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      if (!entry || entry.draft || entry.prerelease) continue;
      var out = parseRelease(entry);
      if (out) return out;
    }
    return null;
  }

  function parseRelease(entry) {
    var out = {
      version: String(entry.tag_name || '').replace(/^v/i, ''),
      published: entry.published_at || entry.created_at || '',
      releaseUrl: entry.html_url || '',
      android: null,
      windows: null,
      sha: null
    };
    var assets = entry.assets || [];
    for (var i = 0; i < assets.length; i++) {
      var asset = assets[i] || {};
      var name = String(asset.name || '');
      if (!out.android && /\.apk$/i.test(name)) out.android = toAsset(asset);
      if (!out.windows && /-windows.*\.(?:zip|exe)$/i.test(name)) {
        out.windows = toAsset(asset);
        out.windows.kind = /\.exe$/i.test(name) ? 'exe' : 'zip';
      }
      if (!out.sha && /sha256/i.test(name)) out.sha = toAsset(asset);
    }
    return out.android || out.windows ? out : null;
  }

  function toAsset(asset) {
    return {
      name: asset.name || '',
      url: asset.browser_download_url || '',
      size: asset.size || 0
    };
  }

  // ---- cache ---------------------------------------------------------

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return {};
      var box = JSON.parse(raw);
      return box && typeof box === 'object' ? box : {};
    } catch (e) {
      return {};
    }
  }

  function writeCache(box) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(box));
    } catch (e) {
      /* private mode / quota: resolving again next load is fine */
    }
  }

  // ---- DOM -----------------------------------------------------------

  function applyApp(app, release) {
    var ready = !!(release && (release.android || release.windows));
    var state = ready ? 'ready' : 'soon';

    each('[data-release-card="' + app + '"]', function (card) {
      card.setAttribute('data-release-state', state);
      toggleWhen(card, state);
    });

    each('[data-release-app="' + app + '"]', function (el) {
      var field = el.getAttribute('data-release-field');
      if (!field) return;
      var value = fieldValue(app, release, field);
      if (value === null || value === undefined) return;
      if (el.tagName === 'A') {
        el.setAttribute('href', value);
      } else {
        el.textContent = value;
      }
    });

    each('[data-dl-app="' + app + '"][data-dl-os]', function (el) {
      var requested = el.getAttribute('data-dl-os');
      var os = resolveOS(requested);
      var asset = release && release[os];
      var iconId = 'i-download';
      if (requested === 'android' || (requested === 'auto' && platform === 'android')) {
        iconId = 'i-android';
      } else if (requested === 'windows' || (requested === 'auto' && platform === 'windows')) {
        iconId = 'i-windows';
      }
      var icon = el.querySelector('[data-dl-icon]');
      if (icon) {
        var use = icon.querySelector('use');
        if (use) use.setAttribute('href', '#' + iconId);
      }

      // A phone CTA on iOS/macOS/Linux must not hand out an APK: those
      // visitors get the honest install guide with both platforms.
      if (requested === 'auto' && platform !== 'android' && platform !== 'windows') {
        el.setAttribute('href', 'install.html?app=' + app);
        el.removeAttribute('data-dl-ready');
        return;
      }

      if (asset && asset.url) {
        el.setAttribute('href', asset.url);
        el.setAttribute('rel', 'noopener');
        el.setAttribute('data-dl-ready', '1');
      } else if (app === 'mangaplace') {
        el.setAttribute('href', APPS[app].releases);
        el.setAttribute('rel', 'noopener');
        el.removeAttribute('data-dl-ready');
      } else {
        el.setAttribute('href', 'install.html?app=' + app + '&os=' + os);
        el.removeAttribute('data-dl-ready');
      }
    });
  }

  function toggleWhen(card, state) {
    eachIn(card, '[data-when="soon"]', function (el) {
      el.hidden = state === 'ready';
    });
    eachIn(card, '[data-when="ready"]', function (el) {
      el.hidden = state !== 'ready';
    });
  }

  function fieldValue(app, release, field) {
    var appConf = APPS[app] || {};
    var releases = appConf.releases || '';
    if (field === 'version') return release && release.version ? release.version : '—';
    if (field === 'date') return release && release.published ? formatDate(release.published) : '—';
    if (field === 'apkSize') return release && release.android ? formatSize(release.android.size) : '—';
    if (field === 'winSize') return release && release.windows ? formatSize(release.windows.size) : '—';
    if (field === 'releaseUrl') return (release && release.releaseUrl) || releases + '/latest';
    if (field === 'shaUrl') {
      if (release && release.sha && release.sha.url) return release.sha.url;
      return (release && release.releaseUrl) || releases + '/latest';
    }
    if (field === 'watchUrl') return releases;
    return null;
  }

  function formatDate(iso) {
    try {
      return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date(iso));
    } catch (e) {
      return '';
    }
  }

  function formatSize(bytes) {
    if (!bytes) return '—';
    return (bytes / 1000000).toFixed(1).replace('.', ',') + ' МБ';
  }

  // A CTA that has a real file starts that file and then opens the install
  // guide at the finished step, where the "download started" note and the
  // retry live. Modifier clicks keep the browser's own new-tab behavior.
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var target = event.target;
    var cta = target && target.closest
      ? target.closest('[data-dl-app][data-dl-os][data-dl-ready="1"]')
      : null;
    if (!cta) return;
    var app = cta.getAttribute('data-dl-app');
    var requested = cta.getAttribute('data-dl-os');
    var os = resolveOS(requested);
    var href = cta.getAttribute('href');
    if (!href) return;
    event.preventDefault();
    var next = 'install.html?app=' + encodeURIComponent(app) +
      '&os=' + encodeURIComponent(os) + '&step=3&started=1';

    // Open the file in its own tab. Navigating this page straight to the
    // guide would cancel an attachment that is still handshaking in a
    // hidden frame; the new tab survives the guide navigation.
    var win = window.open(href, '_blank');
    if (win) {
      try { win.opener = null; } catch (e) { /* cross-origin */ }
      window.location.href = next;
      return;
    }

    // Popup blocked: start the attachment in a hidden frame and give it a
    // short head start before replacing the page.
    startDownload(href);
    window.setTimeout(function () { window.location.href = next; }, 250);
  });

  function emit() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](current); } catch (e) { /* one bad listener must not break the page */ }
    }
    try {
      document.dispatchEvent(new CustomEvent('place:releases', { detail: current }));
    } catch (e) {
      /* old WebView: direct listeners still work */
    }
  }

  function each(selector, fn) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) fn(nodes[i]);
  }

  function eachIn(root, selector, fn) {
    var nodes = root.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) fn(nodes[i]);
  }
})();
