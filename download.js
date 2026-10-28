// Platform-aware download wiring for the Aniplace landing.
//
// The page ships with working static links (install.html / #windows), so
// nothing here is required for the site to work — this script only
// upgrades the CTAs to direct release files and explains which build
// belongs to the visitor's platform:
//
//   * Android  -> the primary CTA becomes the current APK (direct file).
//   * Windows  -> Android stays the main offer (it is the primary app),
//                 framed for the phone and paired with the QR, while the
//                 Windows build is offered as the portable .zip that
//                 contains Aniplace.exe — never implied as installable
//                 on a PC.
//   * iOS      -> no iOS build exists; say so instead of offering a file.
//   * macOS/Linux -> the same honest note, Android stays the offer.
//
// Filenames carry the version (`aniplace-1.18.5-android.apk`), so the
// current asset is resolved from the releases hub at load time and cached
// for the session. GitHub allows 60 unauthenticated calls per hour per IP,
// so an unreachable or rate-limited API falls back to the last-known-good
// direct links below — bump both when a release rotates the filenames.
// (The alternative — a version-less asset alias published by the release
// pipeline — would make a plain permanent URL possible; not done here.)

(function () {
  'use strict';

  var HUB_API = 'https://api.github.com/repos/bloomstick/aniplace-releases';
  var HUB_DL = 'https://github.com/bloomstick/aniplace-releases/releases/download';
  var FALLBACK = {
    version: '1.18.5',
    apk: {
      url: HUB_DL + '/v1.18.5/aniplace-1.18.5-android.apk',
      size: 40717283
    },
    zip: {
      url: HUB_DL + '/v1.18.5/aniplace-1.18.5-windows.zip',
      size: 40062352
    }
  };
  var CACHE_KEY = 'aniplace.release.v1';
  var CACHE_TTL = 30 * 60 * 1000;

  var platform = detectPlatform();
  document.documentElement.setAttribute('data-platform', platform);

  applyLabels(platform);
  resolveRelease(function (release) {
    if (!release) return;
    applyLinks(release);
    applyMeta(release, platform);
  });

  // ---- platform -----------------------------------------------------

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

  // ---- release resolution ------------------------------------------

  function resolveRelease(done) {
    var cached = readCache();
    if (cached) {
      done(cached);
      return;
    }
    if (!window.fetch) {
      done(FALLBACK);
      return;
    }
    fetch(HUB_API + '/releases?per_page=1', {
      headers: { Accept: 'application/vnd.github+json' }
    })
      .then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      })
      .then(function (list) {
        var release = pickRelease(list);
        if (!release) throw new Error('no release');
        writeCache(release);
        done(release);
      })
      .catch(function () {
        // Rate-limited, offline, or an unexpected payload: the static
        // links and the last-known-good files still work.
        done(FALLBACK);
      });
  }

  function pickRelease(list) {
    if (!list || !list.length) return null;
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      if (!entry || entry.draft || entry.prerelease) continue;
      var out = { version: String(entry.tag_name || '').replace(/^v/, ''), apk: null, zip: null };
      var assets = entry.assets || [];
      for (var j = 0; j < assets.length; j++) {
        var asset = assets[j] || {};
        var url = asset.browser_download_url;
        var size = asset.size;
        if (!out.apk && /-android\.apk$/i.test(asset.name || '')) out.apk = { url: url, size: size };
        if (!out.zip && /-windows\.zip$/i.test(asset.name || '')) out.zip = { url: url, size: size };
      }
      if (out.apk || out.zip) return out;
    }
    return null;
  }

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var box = JSON.parse(raw);
      if (!box || !box.at || Date.now() - box.at > CACHE_TTL) return null;
      return box.release && (box.release.apk || box.release.zip) ? box.release : null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(release) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), release: release }));
    } catch (e) {
      /* private mode / quota: resolving again next load is fine */
    }
  }

  // ---- DOM ----------------------------------------------------------

  function each(selector, fn) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) fn(nodes[i]);
  }

  function applyLinks(release) {
    var apk = release.apk || FALLBACK.apk;
    var zip = release.zip || FALLBACK.zip;
    if (apk && apk.url) {
      each('[data-dl="primary"], [data-dl="bar"], [data-dl="footer-android"]', function (el) {
        el.setAttribute('href', apk.url);
        el.setAttribute('rel', 'noopener');
      });
    }
    if (zip && zip.url) {
      each('[data-dl="windows"], [data-dl="footer-windows"]', function (el) {
        el.setAttribute('href', zip.url);
        el.setAttribute('rel', 'noopener');
      });
    }
  }

  function applyLabels(platform) {
    var android = platform === 'android';
    var main = android ? '⬇ Скачать Aniplace (APK)' : '⬇ Скачать для Android (APK)';
    // The sticky bar is narrow: keep its label short enough to stay on one
    // line (the platform nuance lives in the download card's note).
    var bar = android ? '⬇ Скачать APK' : '⬇ Скачать';
    each('[data-dl="primary"]', function (el) { el.textContent = main; });
    each('[data-dl="bar"]', function (el) { el.textContent = bar; });
    // RuStore only makes sense on Android; desktop/other visitors keep the
    // APK + Windows offers (the store link still lives in the hero/footer).
    each('[data-dl="rustore"], [data-dl="bar-rustore"]', function (el) {
      el.hidden = !android;
    });
  }

  function applyMeta(release, platform) {
    var text = metaText(release, platform);
    if (!text) return;
    each('[data-dl="meta"]', function (el) {
      el.textContent = text;
      el.hidden = false;
    });
  }

  function metaText(release, platform) {
    var apkSize = sizeText(release.apk && release.apk.size);
    var zipSize = sizeText(release.zip && release.zip.size);
    var facts = apkSize ? 'APK ' + apkSize : 'APK';
    switch (platform) {
      case 'android':
        return 'Android 7.0+ · ' + versionText(release) + facts +
          ' · ставится напрямую, без Google Play. В RuStore — то же приложение с автообновлением.';
      case 'windows':
        return 'Ты на Windows. Основная версия — Android: поставь её на телефон (наведи камеру на QR рядом), ' +
          facts + '. Для этого компьютера — portable-сборка для Windows 10/11: ' +
          (zipSize ? '.zip ' + zipSize : '.zip') + ', распаковать и запустить Aniplace.exe.';
      case 'ios':
        return 'Версии для iPhone и iPad нет: Aniplace работает на Android и Windows. ' +
          'Поставь Android-версию на телефон — ' + facts + ' (наведи камеру на QR рядом).';
      case 'macos':
      case 'linux':
        return 'Сборки для этой системы нет: Aniplace работает на Android (основная версия) и Windows. ' +
          'Android-версию можно поставить на телефон — ' + facts + '.';
      default:
        return '';
    }
  }

  function versionText(release) {
    return release && release.version ? 'версия ' + release.version + ' · ' : '';
  }

  function sizeText(bytes) {
    if (!bytes) return '';
    return (bytes / 1048576).toFixed(1).replace('.', ',') + ' МБ';
  }
})();
