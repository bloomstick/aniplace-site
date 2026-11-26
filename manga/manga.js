// ani.place/manga/<slug> — public manga title page.
//
// One data request: the generated titles.json for the whole (small,
// curated) manga map. Every entry carries the fields this page renders,
// so there is no second fetch and no runtime catalog API.
//
// The CTA is the same one loud action as the app's play button:
//   * Android  -> an `intent://` URL that opens Mangaplace when installed
//                 and otherwise falls back to the install guide with
//                 `auto=1` (that page starts the APK and shows the
//                 instructions);
//   * desktop  -> the same install guide with `auto=1`;
//   * iOS      -> no build exists, so the action is hidden and an honest
//                 note is shown instead.
// App Links on Android handle the normal case before this page even loads.

(function () {
  'use strict';

  var INSTALL_PATH =
    '/install.html?app=mangaplace&os=android&step=3&started=1&auto=1';
  var OG_FALLBACK = 'https://ani.place/assets/og-cover.png';

  var STATUS_LABELS = {
    ongoing: 'Онгоинг',
    released: 'Вышло',
    announcement: 'Анонс',
    announced: 'Анонс',
    upcoming: 'Анонс'
  };
  var STATUS_CLASSES = {
    ongoing: 'is-ongoing',
    released: 'is-released',
    announcement: 'is-announcement',
    announced: 'is-announcement',
    upcoming: 'is-announcement'
  };

  var doc = document;
  var loading = doc.getElementById('catalog-loading');
  var article = doc.getElementById('catalog-title');
  var errorBox = doc.getElementById('catalog-error');
  var errorNote = errorBox ? errorBox.querySelector('.hand') : null;
  var errorText = errorBox ? errorBox.querySelector('p:not(.hand)') : null;
  var crumbTitle = doc.getElementById('crumb-title');
  var installSection = doc.getElementById('title-install');
  var detailsSection = doc.getElementById('title-details');

  var routedPath = readRoutedPath();
  var parsed = parseMangaPath(routedPath || location.pathname);
  var platform = getPlatform();

  if (routedPath) {
    // The GitHub Pages 404 bridge serves /404.html for the pretty path and
    // forwards the original here as ?path=. Restore the visible URL before
    // the async work, while keeping the saved path for parsing.
    try {
      history.replaceState(null, '', routedPath);
    } catch (e) { /* file:// preview */ }
  }

  if (!parsed) {
    showError(
      'здесь пока пусто',
      'Проверь ссылку или открой каталог в приложении.'
    );
    return;
  }

  loadTitle(parsed.slug);

  // ---- path / platform ------------------------------------------------

  function readRoutedPath() {
    var search = String(location.search || '').replace(/^\?/, '');
    if (!search) return '';
    var parts = search.split('&');
    for (var i = 0; i < parts.length; i++) {
      var pair = parts[i].split('=');
      if (pair.length < 2 || pair[0] !== 'path') continue;
      try {
        return decodeURIComponent(pair.slice(1).join('=').replace(/\+/g, ' '));
      } catch (e) {
        return '';
      }
    }
    return '';
  }

  function safeDecode(segment) {
    // The ?path= value arrives single-encoded (the shim encodes the
    // already-encoded pretty path once more), so one extra decode lands
    // on the raw provider slug. A slug carrying a literal `%` would not
    // survive it — then the segment is already raw, keep it as is.
    try {
      return decodeURIComponent(segment);
    } catch (e) {
      return segment;
    }
  }

  function parseMangaPath(raw) {
    var clean = String(raw || '').split('#')[0].split('?')[0];
    var parts = clean.split('/').filter(Boolean);
    if (parts.length < 2 || parts[0] !== 'manga') return null;
    var slug = safeDecode(parts[1]).trim();
    if (!slug) return null;
    return { slug: slug };
  }

  function getPlatform() {
    if (window.PlaceDownloads && window.PlaceDownloads.platform) {
      return window.PlaceDownloads.platform();
    }
    return doc.documentElement.getAttribute('data-platform') || 'other';
  }

  // ---- data -----------------------------------------------------------

  function loadTitle(slug) {
    if (!window.fetch) {
      showError('связь пропала', 'Браузер не может загрузить карточку. Открой каталог в приложении.');
      return;
    }

    fetch('data/titles.json', { headers: { Accept: 'application/json' } })
      .then(function (response) {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data) {
          showNotFound();
          return;
        }
        var rows = data && data.rows;
        var row = rows ? rows[slug] : null;
        if (!row) {
          showNotFound();
          return;
        }
        try {
          render(row);
        } catch (e) {
          showError('ошибка карточки', 'Не удалось показать карточку. Обнови страницу.');
        }
      })
      .catch(function () {
        showError(
          'связь пропала',
          'Не удалось загрузить карточку. Проверь соединение и обнови страницу.'
        );
      });
  }

  // ---- render ---------------------------------------------------------

  function render(row) {
    if (loading) loading.hidden = true;

    var name = String(row.name || '');
    var slug = String(row.slug || '');
    var canonical = '/manga/' + encodeURIComponent(slug);
    var coverUrl = String(row.cover || OG_FALLBACK);
    var statusLabel = labelFor(STATUS_LABELS, row.status, row.status);
    var typeLabel = String(row.type || '');

    doc.title = name + ' — в приложении Mangaplace';
    var pageSummary = summary(row, name);
    setMeta('name', 'description', pageSummary);
    setMeta('property', 'og:title', name + ' — в приложении Mangaplace');
    setMeta('property', 'og:description', pageSummary);
    setMeta('property', 'og:image', coverUrl);
    setMeta('property', 'og:image:alt', 'Обложка: ' + name);
    setMeta('name', 'twitter:title', name + ' — в приложении Mangaplace');
    setMeta('name', 'twitter:description', pageSummary);
    setMeta('name', 'twitter:image', coverUrl);
    // App Links hooks for clients that read meta instead of dispatching
    // verified HTTPS links (messenger in-app browsers): same deep link the
    // Android intent filter and `parseDreamLink` already understand.
    setMeta('property', 'al:android:url', 'mangaplace://title/' + encodeURIComponent(slug));
    setMeta('property', 'al:web:url', location.origin + canonical);

    var canonicalEl = doc.getElementById('canonical');
    if (canonicalEl) canonicalEl.setAttribute('href', location.origin + canonical);
    setMeta('property', 'og:url', location.origin + canonical);
    try {
      if (location.pathname !== canonical) {
        history.replaceState(null, '', canonical + location.search + location.hash);
      }
    } catch (e) { /* file:// preview */ }

    if (crumbTitle) crumbTitle.textContent = name;
    setText('title-kicker', kicker(typeLabel, statusLabel, row));
    setText('title-name', name);
    setText('title-alt', altNames(row, name));
    setText('title-description', row.description || 'Описание пока нет — зато тайтл уже в каталоге Mangaplace.');

    var descEl = doc.getElementById('title-description');
    if (descEl && !row.description) descEl.classList.add('is-empty');

    renderCover(coverUrl, name);
    renderFacts(row, statusLabel, statusClass(row.status), typeLabel);
    renderTags(row);
    renderAction(row, slug, platform);
    attemptAppOpen(slug, platform);
    renderDetails(row, typeLabel, statusLabel);
    renderLinks();

    if (installSection && platform === 'windows') installSection.hidden = false;
    if (article) article.hidden = false;
  }

  function renderCover(url, name) {
    var img = doc.getElementById('title-cover');
    if (!img) return;
    img.alt = 'Обложка: ' + name;
    img.addEventListener('error', function () {
      // Covers are source-CDN passthrough: when one 404s (slow roll,
      // pruned object), keep the URL (devtools reads it) and paint the
      // neutral "no cover" state underneath instead of a broken image.
      img.classList.add('is-missing');
    });
    if (url) img.src = url;
  }

  function renderFacts(row, statusLabel, statusCls, typeLabel) {
    var host = doc.getElementById('title-facts');
    if (!host) return;
    host.textContent = '';
    if (statusLabel) addFact(host, 'Статус', statusLabel, statusCls);
    if (typeLabel) addFact(host, 'Тип', typeLabel);
    if (row.year) addFact(host, 'Год', row.year);
  }

  function addFact(host, label, value, valueClass, title) {
    var item = doc.createElement('li');
    item.className = 'title-fact';
    var key = doc.createElement('span');
    key.textContent = label;
    var val = doc.createElement('b');
    val.textContent = value;
    if (valueClass) val.className = valueClass;
    if (title) item.title = title;
    item.appendChild(key);
    item.appendChild(val);
    host.appendChild(item);
  }

  function renderTags(row) {
    var host = doc.getElementById('title-tags');
    if (!host) return;
    host.textContent = '';
    var seen = {};
    var count = 0;
    function add(value, extraClass) {
      var text = String(value || '').trim();
      if (!text || count >= 20) return;
      var key = text.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      var chip = doc.createElement('span');
      chip.className = 'title-tag' + (extraClass ? ' ' + extraClass : '');
      chip.textContent = text;
      host.appendChild(chip);
      count += 1;
    }
    (row.genres || []).forEach(function (g) { add(g, ''); });
    (row.tags || []).forEach(function (t) { add(t, 'title-tag--tag'); });
  }

  function renderAction(row, slug, platformName) {
    var link = doc.getElementById('title-open');
    if (!link) return;
    var fallback = location.origin + INSTALL_PATH;
    link.setAttribute('href', fallback);

    var eyebrow = doc.getElementById('title-open-eyebrow');
    var label = doc.getElementById('title-open-label');
    var note = doc.getElementById('title-action-note');

    if (platformName === 'android') {
      if (eyebrow) eyebrow.textContent = 'Откроется в приложении';
      if (label) label.textContent = 'Открыть в Mangaplace';
      if (note) {
        note.textContent = 'Если приложение уже установлено, откроется оно. Если нет — начнётся загрузка APK и откроется инструкция.';
      }
      // `intent://` is the one supported app-or-web navigation on Chromium
      // Android. A non-Chromium browser gets the install guide directly:
      // App Links already had the chance to open the installed app.
      if (isChromiumAndroid()) {
        link.setAttribute(
          'href',
          'intent://title/' + encodeURIComponent(slug) +
            '#Intent;scheme=mangaplace;package=place.ani.manga;S.browser_fallback_url=' +
            encodeURIComponent(fallback) + ';end'
        );
      }
      return;
    }

    if (platformName === 'ios') {
      // CSS hides the action; keep the fallback href valid for assistive
      // tech that still reaches the link.
      if (eyebrow) eyebrow.textContent = 'Android · APK';
      if (label) label.textContent = 'Установить Mangaplace';
      return;
    }

    if (eyebrow) eyebrow.textContent = 'Android · APK';
    if (label) label.textContent = 'Установить Mangaplace';
    if (note) {
      note.textContent = platformName === 'windows'
        ? 'Начнётся загрузка APK для Android и откроется инструкция. Для телефона ниже есть QR-код.'
        : 'Начнётся загрузка APK для Android и откроется инструкция по установке.';
    }
  }

  function isChromiumAndroid() {
    var ua = navigator.userAgent || '';
    return /Chrome|CriOS|Chromium|EdgA|SamsungBrowser|Opera|YaBrowser/i.test(ua);
  }

  function attemptAppOpen(slug, platformName) {
    // Verified App Links open the installed app before this page even loads
    // (system browser). Messenger in-app browsers don't dispatch them, so on
    // Android the shell fires one silent custom-scheme attempt itself: with
    // Mangaplace installed the app opens the title and this page is never
    // seen; without it the navigation fails inside the hidden frame and the
    // page with its install action stays. No fallback URL here on purpose —
    // the visible CTA owns the install path.
    if (platformName !== 'android') return;
    if (doc.getElementById('title-auto-open')) return;
    try {
      var frame = doc.createElement('iframe');
      frame.id = 'title-auto-open';
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('tabindex', '-1');
      frame.setAttribute('title', '');
      frame.style.cssText =
        'position:absolute;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
      frame.src = 'mangaplace://title/' + encodeURIComponent(slug);
      doc.body.appendChild(frame);
    } catch (e) { /* stay on the page */ }
  }

  function renderDetails(row, typeLabel, statusLabel) {
    var list = doc.getElementById('title-dl');
    if (!list) return;
    list.textContent = '';
    var count = 0;

    function add(term, value) {
      var text = String(value || '').trim();
      if (!text) return;
      var dt = doc.createElement('dt');
      dt.textContent = term;
      var dd = doc.createElement('dd');
      dd.textContent = text;
      list.appendChild(dt);
      list.appendChild(dd);
      count += 1;
    }

    add('Тип', typeLabel);
    add('Статус', statusLabel);
    add('Год', row.year);

    if (detailsSection) detailsSection.hidden = count === 0;
  }

  function renderLinks() {
    // Manga rows carry no external directory ids: say so honestly instead
    // of an empty block.
    var host = doc.getElementById('title-links');
    if (!host) return;
    host.textContent = '';
    var note = doc.createElement('p');
    note.className = 'title-side__empty';
    note.textContent = 'Внешних ссылок нет — всё остальное в приложении.';
    host.appendChild(note);
  }

  function showNotFound() {
    showError(
      'здесь пока пусто',
      'Такого тайтла нет в каталоге — возможно, он скрыт или ссылка устарела.'
    );
  }

  function showError(note, message) {
    if (loading) loading.hidden = true;
    if (article) article.hidden = true;
    if (installSection) installSection.hidden = true;
    if (detailsSection) detailsSection.hidden = true;
    if (errorNote) errorNote.textContent = note;
    if (errorText) errorText.textContent = message;
    if (errorBox) errorBox.hidden = false;
  }

  // ---- small formatters ----------------------------------------------

  function labelFor(map, value, fallback) {
    var key = String(value || '').toLowerCase();
    return map[key] || fallback || '';
  }

  function statusClass(value) {
    return STATUS_CLASSES[String(value || '').toLowerCase()] || '';
  }

  function altNames(row, display) {
    var out = [];
    var seen = { [display.toLowerCase()]: true };
    [row.engName, row.rusName].forEach(function (value) {
      var text = String(value || '').trim();
      if (!text) return;
      var key = text.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(text);
    });
    return out.join(' / ');
  }

  function kicker(typeLabel, statusLabel, row) {
    return ['Манга', typeLabel, row.year, statusLabel].filter(Boolean).join(' · ');
  }

  function summary(row, name) {
    // Mirrors `og_description()` in `tools/site/build_manga_catalog.py`:
    // the shim files bake this text for crawlers, the shell refreshes it
    // for humans.
    if (row.description) {
      var text = String(row.description).replace(/\s+/g, ' ').trim();
      if (text.length > 160) text = text.slice(0, 157).trim() + '…';
      return text + ' — читать в приложении Mangaplace.';
    }
    return 'Читать мангу «' + name + '» в приложении Mangaplace: ' +
      'описание, жанры и рейтинг.';
  }

  function setText(id, value) {
    var el = doc.getElementById(id);
    if (el) el.textContent = value || '';
  }

  function setMeta(attribute, name, value) {
    var el = doc.querySelector('meta[' + attribute + '="' + name + '"]');
    if (el) el.setAttribute('content', value || '');
  }
})();
