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
      var note = ensureNote();
      note.textContent =
        'Открываю чат с ботом — нажми там START, и файл прилетит в чат.';
      // Get out of the way: the handoff is done, the chat is opening.
      // Delayed so the link wins the race on slow clients; guarded —
      // older clients simply keep the page open.
      window.setTimeout(function () {
        try {
          if (tg.close) tg.close();
        } catch (e) {
          /* staying open is a valid fallback */
        }
      }, 350);
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
