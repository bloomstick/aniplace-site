// Aniplace go landing as a Telegram Mini App.
//
// Outside Telegram this file is a no-op: it returns before loading the
// SDK, so browser visitors pay zero extra requests. Inside Telegram
// (query carries tgWebAppData/tgWebAppPlatform, or the Telegram UA) it
// loads `telegram-web-app.js`, expands the view, and reroutes every
// `[data-dl-primary]` tap to the bot: the APK arrives as a chat document
// via `openTelegramLink`, because a Mini App WebView cannot reliably
// download + install an APK in place.
//
// Operator knobs: BOT_USERNAME must match the BotFather username and
// BOT_USERNAME in the bot backend's bot.env.

(function () {
  'use strict';

  // Public bot username (no @). Mirrors BOT_USERNAME in
  // tools/telegram-bot/bot.env — change both together.
  var BOT_USERNAME = 'aniplacebot';

  // Direct-send endpoint: POST {initData} -> the bot replies {ok:true}
  // after dropping the APK into this user's chat. Needs a public HTTPS
  // URL (VPS or a tunnel to the bot's --pair-port); empty disables it
  // and every tap takes the deep-link fallback below.
  // window.__ANI_DL_ENDPOINT__ overrides this (used by the smoke test).
  var DL_ENDPOINT = '';

  var SDK_URL = 'https://telegram.org/js/telegram-web-app.js';

  function isTelegram() {
    try {
      var q = window.location.search || '';
      if (/tgWebApp(Data|Platform|Version|BotInline)/i.test(q)) return true;
    } catch (e) {
      /* location is always available; paranoia for odd WebViews */
    }
    try {
      if (window.Telegram && window.Telegram.WebApp &&
          window.Telegram.WebApp.initData !== undefined) return true;
    } catch (e) {
      /* cross-origin access never happens here, but never throw */
    }
    var ua = '';
    try {
      ua = navigator.userAgent || '';
    } catch (e) {
      ua = '';
    }
    return /Telegram/i.test(ua);
  }

  if (!isTelegram()) return;

  function loadSdk(done) {
    if (window.Telegram && window.Telegram.WebApp) {
      done();
      return;
    }
    var script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = done;
    // Without the SDK the page keeps working as the plain landing:
    // direct APK links stay live, so a blocked CDN never bricks installs.
    script.onerror = function () {
      script.parentNode && script.parentNode.removeChild(script);
    };
    document.head.appendChild(script);
  }

  function version() {
    var el = document.querySelector('[data-version]');
    var v = el ? (el.textContent || '').trim() : '';
    v = v.replace(/^v/i, '');
    return v || 'latest';
  }

  function closeApp(tg) {
    // Get out of the way in the same tick: openTelegramLink only queues
    // the navigation, so closing right away cannot preempt it — while a
    // delayed close can land mid-animation and cancel the handoff.
    // Guarded: clients without close() simply keep the page open.
    try {
      if (tg.close) tg.close();
    } catch (e) {
      /* staying open is a valid fallback */
    }
  }

  // Direct send: the bot drops the APK into this user's chat, no START
  // needed for users who pressed it before. done(true) on {ok:true};
  // anything else (disabled endpoint, bad network, need_start for
  // first-timers, no cached build) falls through to the deep link.
  function tryDirectSend(tg, done) {
    var endpoint = '';
    try {
      endpoint = window.__ANI_DL_ENDPOINT__ || DL_ENDPOINT || '';
    } catch (e) {
      endpoint = DL_ENDPOINT || '';
    }
    var initData = '';
    try {
      initData = tg.initData || '';
    } catch (e) {
      initData = '';
    }
    if (!endpoint || !initData) {
      done(false);
      return;
    }
    function fallback() {
      done(false);
    }
    try {
      var fetchFn = window.fetch;
      if (!fetchFn) {
        done(false);
        return;
      }
      var body = null;
      try {
        body = JSON.stringify({ initData: initData });
      } catch (e) {
        done(false);
        return;
      }
      var settled = false;
      function settle(ok) {
        if (settled) return;
        settled = true;
        done(ok);
      }
      // No AbortController on old WebViews: the race below caps the wait.
      var timer = window.setTimeout(function () {
        settle(false);
      }, 25000);
      fetchFn(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
      }).then(function (res) {
        if (!res || !res.ok) throw new Error('http');
        return res.json();
      }).then(function (json) {
        window.clearTimeout(timer);
        settle(Boolean(json && json.ok));
      }).catch(function () {
        window.clearTimeout(timer);
        settle(false);
      });
    } catch (e) {
      fallback();
    }
  }

  function ensureNote() {
    var note = document.querySelector('[data-tg-note]');
    if (note) return note;
    note = document.createElement('p');
    note.setAttribute('data-tg-note', '1');
    note.className = 'hero__note';
    var anchor = document.querySelector('.hero__actions');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(note, anchor.nextSibling);
    }
    return note;
  }

  function init() {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;
    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor('#0b0810');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#0b0810');
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    } catch (e) {
      /* cosmetics must never break the page */
    }
    document.documentElement.setAttribute('data-tg', '1');
    // Claim primary CTAs before go.js's download-then-guide handler: it
    // yields when this flag is set (checked at click time).
    try {
      window.__aniTgMode = true;
    } catch (e) {
      /* a frozen window object must never break the page */
    }

    // Desktop-only or confusing-in-chat blocks go away: every install
    // flows through the bot's chat document from here on.
    var qr = document.querySelector('[data-qr]');
    if (qr) qr.style.display = 'none';
    var win = document.querySelector('[data-windows-optional]');
    if (win) win.style.display = 'none';

    document.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      var link = event.target && event.target.closest
        ? event.target.closest('[data-dl-primary]')
        : null;
      if (!link) return;
      event.preventDefault();
      try {
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      } catch (e) {
        /* haptics are best-effort */
      }
      var deep = 'https://t.me/' + BOT_USERNAME + '?start=apk_' + version();
      // Preferred path: the bot drops the file into this user's chat —
      // works for returning users too, where the deep link below would
      // deliver no bot-side event at all (Telegram sends start payloads
      // only on the very first START).
      tryDirectSend(tg, function (sent) {
        var note = ensureNote();
        if (sent) {
          note.textContent = 'Файл уже в чате с ботом — открой его.';
          closeApp(tg);
          return;
        }
        var opened = false;
        try {
          tg.openTelegramLink(deep);
          opened = true;
        } catch (e) {
          opened = false;
        }
        if (!opened) {
          window.location.href = deep;
        }
        note.textContent =
          'Открываю чат с ботом — отправь туда /start, и файл прилетит в чат.';
        closeApp(tg);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      loadSdk(init);
    });
  } else {
    loadSdk(init);
  }
})();
