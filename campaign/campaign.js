// Aniplace campaign landing behaviour.
//
// Conversion contract: every download CTA is a real link in the HTML (the
// last known-good direct APK), so it works before this script runs. The
// script upgrades those links to the current GitHub release assets, keeps
// the RuStore link as the secondary path, and fills version/size labels.
//
// Motion is opt-in: parallax and card tilt only on fine pointers, and every
// animation is skipped for prefers-reduced-motion.

(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  var RELEASES = 'https://github.com/bloomstick/aniplace-releases/releases';
  var RELEASES_LATEST = RELEASES + '/latest';
  var API = 'https://api.github.com/repos/bloomstick/aniplace-releases';
  var CACHE_KEY = 'ani.campaign.release.v1';
  var CACHE_TTL = 30 * 60 * 1000;

  // Bump when a release rotates the Aniplace filenames. This is the state
  // painted before GitHub answers and the state used when the API is
  // unreachable or rate-limited (60 requests/hour per IP).
  var FALLBACK = {
    version: '1.22.4',
    published: '2026-11-06T19:52:38Z',
    releaseUrl: RELEASES + '/tag/v1.22.4',
    android: {
      name: 'aniplace-1.22.4-android.apk',
      url: RELEASES + '/download/v1.22.4/aniplace-1.22.4-android.apk',
      size: 45064232
    },
    windows: {
      name: 'aniplace-1.22.4-windows-setup.exe',
      url: RELEASES + '/download/v1.22.4/aniplace-1.22.4-windows-setup.exe',
      size: 31919747,
      kind: 'exe'
    },
    sha: {
      name: 'SHA256SUMS.txt',
      url: RELEASES + '/download/v1.22.4/SHA256SUMS.txt'
    }
  };

  var platform = detectPlatform();
  root.setAttribute('data-platform', platform);

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

  // ---- release resolution ------------------------------------------------

  function formatSize(bytes) {
    if (!bytes) return '';
    return (bytes / 1000000).toFixed(1).replace('.', ',') + ' МБ';
  }

  function parseRelease(entry) {
    if (!entry || entry.draft || entry.prerelease) return null;
    var out = {
      version: String(entry.tag_name || '').replace(/^v/i, ''),
      published: entry.published_at || entry.created_at || '',
      releaseUrl: entry.html_url || RELEASES_LATEST,
      android: null,
      windows: null,
      sha: null
    };
    var assets = entry.assets || [];
    for (var i = 0; i < assets.length; i++) {
      var asset = assets[i] || {};
      var assetName = String(asset.name || '');
      if (!out.android && /\.apk$/i.test(assetName)) out.android = assetOf(asset);
      if (!out.windows && /-windows.*\.(?:zip|exe)$/i.test(assetName)) {
        out.windows = assetOf(asset);
        out.windows.kind = /\.exe$/i.test(assetName) ? 'exe' : 'zip';
      }
      if (!out.sha && /sha256/i.test(assetName)) out.sha = assetOf(asset);
    }
    // The campaign's primary CTA is Android. A release without an APK must
    // never replace the last known-good direct download with its release page.
    return out.android ? out : null;
  }

  function assetOf(asset) {
    return {
      name: asset.name || '',
      url: asset.browser_download_url || '',
      size: asset.size || 0
    };
  }

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var box = JSON.parse(raw);
      if (!box || !box.at || !box.release) return null;
      if (!box.release.android || !box.release.android.url) return null;
      if (Date.now() - box.at > CACHE_TTL) return null;
      return box.release;
    } catch (e) {
      return null;
    }
  }

  function writeCache(release) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), release: release }));
    } catch (e) {
      /* private mode: resolving again next visit is fine */
    }
  }

  function each(selector, fn) {
    var nodes = doc.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) fn(nodes[i]);
  }

  function applyRelease(release) {
    if (!release || !release.android || !release.android.url) return;
    var android = release.android;
    var href = android.url;

    each('[data-dl-primary]', function (link) {
      link.setAttribute('href', href);
      link.setAttribute('rel', 'noopener');
    });

    each('[data-dl-label]', function (el) {
      var full = el.closest && el.closest('.btn__stack');
      el.textContent = full ? 'Скачать для Android' : 'Скачать';
    });

    each('[data-dl-meta]', function (el) {
      var version = release.version ? ' · v' + release.version : '';
      el.textContent = 'APK' + (android && android.size ? ' · ' + formatSize(android.size) : '') + version;
    });

    each('[data-version]', function (el) {
      el.textContent = release.version || '—';
    });

    each('[data-dl-size]', function (el) {
      el.textContent = android && android.size ? formatSize(android.size) : '—';
    });

    each('[data-dl-windows]', function (el) {
      el.setAttribute('href', release.windows && release.windows.url ? release.windows.url : release.releaseUrl || RELEASES_LATEST);
    });

    each('[data-sha-link]', function (el) {
      el.setAttribute('href', release.sha && release.sha.url ? release.sha.url : release.releaseUrl || RELEASES_LATEST);
    });

    each('[data-release-link]', function (el) {
      el.setAttribute('href', release.releaseUrl || RELEASES_LATEST);
    });

    if (platform === 'ios') {
      each('[data-ios-note]', function (el) { el.hidden = false; });
    }
  }

  function resolveRelease() {
    var cached = readCache();
    if (cached) {
      applyRelease(cached);
      return;
    }

    if (!window.fetch) {
      applyRelease(FALLBACK);
      return;
    }

    var controller = null;
    var timer = null;
    if (window.AbortController) {
      controller = new AbortController();
      timer = window.setTimeout(function () { controller.abort(); }, 8000);
    }

    fetch(API + '/releases?per_page=5', {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      })
      .then(function (list) {
        var picked = null;
        for (var i = 0; i < (list || []).length; i++) {
          picked = parseRelease(list[i]);
          if (picked) break;
        }
        if (!picked) throw new Error('no release assets');
        writeCache(picked);
        applyRelease(picked);
      })
      .catch(function () {
        writeCache(FALLBACK);
        applyRelease(FALLBACK);
      })
      .then(function () {
        if (timer) window.clearTimeout(timer);
      });
  }

  // ---- scroll reveals ----------------------------------------------------

  function initReveals() {
    var items = doc.querySelectorAll('[data-reveal]');
    if (!items.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('is-in');
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        entries[i].target.classList.add('is-in');
        observer.unobserve(entries[i].target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    for (var j = 0; j < items.length; j++) observer.observe(items[j]);
  }

  // ---- counters ----------------------------------------------------------

  function initCounters() {
    var nums = doc.querySelectorAll('[data-count]');
    if (!nums.length) return;
    var formatter = window.Intl
      ? new Intl.NumberFormat('ru-RU')
      : { format: function (value) { return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); } };

    function finish(el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      el.textContent = formatter.format(target);
    }

    function run(el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      if (reduceMotion || target === 0) {
        finish(el);
        return;
      }
      var started = 0;
      var duration = 1400;
      function step(now) {
        if (!started) started = now;
        var progress = Math.min(1, (now - started) / duration);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = formatter.format(Math.round(target * eased));
        if (progress < 1) window.requestAnimationFrame(step);
        else finish(el);
      }
      window.requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < nums.length; i++) finish(nums[i]);
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        run(entries[i].target);
        observer.unobserve(entries[i].target);
      }
    }, { threshold: 0.5 });
    for (var j = 0; j < nums.length; j++) observer.observe(nums[j]);
  }

  // ---- hero parallax + spotlight ----------------------------------------

  function initParallax() {
    var hero = doc.querySelector('[data-hero]');
    var art = doc.querySelector('[data-parallax]');
    if (!hero || !art || reduceMotion || !finePointer) return;

    var frame = 0;
    var lastX = 0;
    var lastY = 0;

    function update() {
      frame = 0;
      var heroRect = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', Math.round(lastX - heroRect.left) + 'px');
      hero.style.setProperty('--my', Math.round(lastY - heroRect.top) + 'px');

      var artRect = art.getBoundingClientRect();
      if (!artRect.width || !artRect.height) return;
      var px = ((lastX - artRect.left) / artRect.width) * 2 - 1;
      var py = ((lastY - artRect.top) / artRect.height) * 2 - 1;
      px = Math.max(-1, Math.min(1, px));
      py = Math.max(-1, Math.min(1, py));
      art.style.setProperty('--px', px.toFixed(3));
      art.style.setProperty('--py', py.toFixed(3));
    }

    hero.addEventListener('pointermove', function (event) {
      lastX = event.clientX;
      lastY = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(update);
    }, { passive: true });

    hero.addEventListener('pointerleave', function () {
      art.style.setProperty('--px', '0');
      art.style.setProperty('--py', '0');
    });
  }

  // ---- card tilt + pointer glow -----------------------------------------

  function initTilt() {
    if (reduceMotion || !finePointer) return;
    var cards = doc.querySelectorAll('[data-tilt]');
    for (var i = 0; i < cards.length; i++) {
      (function (card) {
        card.addEventListener('pointermove', function (event) {
          var rect = card.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          var x = (event.clientX - rect.left) / rect.width;
          var y = (event.clientY - rect.top) / rect.height;
          card.style.setProperty('--tx', ((0.5 - y) * 4).toFixed(2) + 'deg');
          card.style.setProperty('--ty', ((x - 0.5) * 5).toFixed(2) + 'deg');
          card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
          card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        }, { passive: true });
        card.addEventListener('pointerleave', function () {
          card.style.setProperty('--tx', '0deg');
          card.style.setProperty('--ty', '0deg');
          card.style.setProperty('--mx', '50%');
          card.style.setProperty('--my', '0%');
        });
      })(cards[i]);
    }
  }

  // ---- screenshot rail ---------------------------------------------------

  function initRail() {
    var rail = doc.querySelector('[data-rail]');
    if (!rail) return;
    var cards = rail.querySelectorAll('.shot');
    var prev = doc.querySelector('[data-rail-prev]');
    var next = doc.querySelector('[data-rail-next]');
    var counter = doc.querySelector('[data-rail-current]');
    var progress = doc.querySelector('[data-rail-progress-thumb]');
    var frame = 0;
    var down = false;
    var dragged = false;
    var startX = 0;
    var startScroll = 0;

    function step() {
      if (!cards.length) return rail.clientWidth * 0.8;
      var styles = window.getComputedStyle(rail);
      var gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
      return cards[0].getBoundingClientRect().width + gap;
    }

    function update() {
      frame = 0;
      var max = Math.max(0, rail.scrollWidth - rail.clientWidth);
      var index = step() > 0 ? Math.round(rail.scrollLeft / step()) : 0;
      index = Math.max(0, Math.min(cards.length - 1, index));
      if (counter) counter.textContent = ('0' + (index + 1)).slice(-2);
      if (prev) prev.disabled = rail.scrollLeft <= 2;
      if (next) next.disabled = rail.scrollLeft >= max - 2;
      if (progress) {
        var visible = rail.scrollWidth ? rail.clientWidth / rail.scrollWidth : 1;
        var width = Math.max(14, Math.min(100, visible * 100));
        var track = 100 - width;
        var left = max > 0 ? (rail.scrollLeft / max) * track : 0;
        progress.style.width = width.toFixed(2) + '%';
        progress.style.left = left.toFixed(2) + '%';
      }
    }

    function onScroll() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    function move(direction) {
      rail.scrollBy({
        left: step() * direction,
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    }

    if (prev) prev.addEventListener('click', function () { move(-1); });
    if (next) next.addEventListener('click', function () { move(1); });
    rail.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    rail.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      down = true;
      dragged = false;
      startX = event.clientX;
      startScroll = rail.scrollLeft;
    });
    window.addEventListener('pointermove', function (event) {
      if (!down) return;
      var delta = event.clientX - startX;
      if (!dragged && Math.abs(delta) > 5) {
        dragged = true;
        rail.classList.add('is-dragging');
      }
      if (dragged) {
        rail.scrollLeft = startScroll - delta;
        event.preventDefault();
      }
    }, { passive: false });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      rail.classList.remove('is-dragging');
      window.setTimeout(function () { dragged = false; }, 0);
    });
    rail.addEventListener('click', function (event) {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
    rail.addEventListener('dragstart', function (event) {
      event.preventDefault();
    });

    update();
  }

  // ---- screenshot lightbox ----------------------------------------------

  function initLightbox() {
    var dialog = doc.getElementById('lightbox');
    if (!dialog || !dialog.showModal) return;
    var image = doc.getElementById('lightbox-img');
    var caption = doc.getElementById('lightbox-caption');
    var close = doc.querySelector('[data-lightbox-close]');

    each('[data-zoom]', function (link) {
      link.addEventListener('click', function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        image.setAttribute('src', link.getAttribute('href'));
        var text = link.getAttribute('data-caption') || '';
        image.setAttribute('alt', text);
        if (caption) caption.textContent = text;
        dialog.showModal();
        doc.body.style.overflow = 'hidden';
      });
    });

    function shut() {
      dialog.close();
      doc.body.style.overflow = '';
      // Keep the last real screenshot in the closed dialog: an empty src
      // would leave a broken image in the DOM between openings.
    }

    if (close) close.addEventListener('click', shut);
    dialog.addEventListener('close', function () {
      doc.body.style.overflow = '';
    });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) shut();
    });
  }

  // ---- header, sticky bar ------------------------------------------------

  function initScrollChrome() {
    var topbar = doc.querySelector('[data-topbar]');
    var bar = doc.querySelector('[data-mobile-bar]');
    var frame = 0;

    function update() {
      frame = 0;
      var y = window.scrollY || window.pageYOffset || 0;
      if (topbar) topbar.classList.toggle('is-scrolled', y > 8);
      if (bar) {
        var threshold = Math.min(window.innerHeight * 0.62, 660);
        bar.classList.toggle('is-visible', y > threshold);
      }
    }

    function onScroll() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  // ---- boot --------------------------------------------------------------

  applyRelease(FALLBACK);
  resolveRelease();
  initReveals();
  initCounters();
  initParallax();
  initTilt();
  initRail();
  initLightbox();
  initScrollChrome();
})();
