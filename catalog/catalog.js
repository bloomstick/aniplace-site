// ani.place/catalog/<slug>-<id> — public title page.
//
// One data request: the generated shard for the id's 256-id bucket. The
// shard carries every field this page renders, so there is no second fetch,
// no meta-chunk scan and no runtime catalog API.
//
// The CTA is the same one loud action as the app's play button:
//   * Android  -> an `intent://` URL that opens Aniplace when installed and
//                 otherwise falls back to the install guide with `auto=1`
//                 (that page starts the APK and shows the instructions);
//   * desktop  -> the same install guide with `auto=1`;
//   * iOS      -> no build exists, so the action is hidden and an honest
//                 note is shown instead.
// App Links on Android handle the normal case before this page even loads.

(function () {
  'use strict';

  var SHARD_WIDTH = 256;
  var SHARD_PAD = 3;
  var INSTALL_PATH =
    '/install.html?app=aniplace&os=android&step=3&started=1&auto=1';

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
  var TYPE_LABELS = {
    tv: 'ТВ-сериал',
    movie: 'Фильм',
    ova: 'OVA',
    ona: 'ONA',
    special: 'Спешл',
    tv_special: 'ТВ-спешл',
    music: 'Клип',
    cm: 'Реклама',
    pv: 'PV'
  };
  var SEASON_LABELS = { 1: 'Зима', 2: 'Весна', 3: 'Лето', 4: 'Осень' };

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
  var parsed = parseCatalogPath(routedPath || location.pathname);
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

  loadTitle(parsed.id);

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

  function parseCatalogPath(raw) {
    var clean = String(raw || '').split('#')[0].split('?')[0];
    var parts = clean.split('/').filter(Boolean);
    if (parts.length < 2 || parts[0] !== 'catalog') return null;
    var segment = parts[1];
    var match = /^(.+)-(\d+)$/.exec(segment);
    if (!match) return null;
    var id = parseInt(match[2], 10);
    if (!(id > 0)) return null;
    return { id: id, slug: match[1] };
  }

  function getPlatform() {
    if (window.PlaceDownloads && window.PlaceDownloads.platform) {
      return window.PlaceDownloads.platform();
    }
    return doc.documentElement.getAttribute('data-platform') || 'other';
  }

  // ---- data -----------------------------------------------------------

  function loadTitle(id) {
    var bucket = Math.floor(id / SHARD_WIDTH);
    var name = 'titles-' + pad(bucket, SHARD_PAD) + '.json';

    if (!window.fetch) {
      showError('связь пропала', 'Браузер не может загрузить карточку. Открой каталог в приложении.');
      return;
    }

    fetch('data/' + name, { headers: { Accept: 'application/json' } })
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
        var row = rows ? rows[String(id)] : null;
        if (!row) {
          showNotFound();
          return;
        }
        try {
          render(data, row);
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

  function pad(value, width) {
    var text = String(value);
    while (text.length < width) text = '0' + text;
    return text;
  }

  // ---- render ---------------------------------------------------------

  function render(data, row) {
    if (loading) loading.hidden = true;

    var name = String(row.name || '');
    var id = parseInt(row.id, 10);
    var slug = String(row.slug || 'anime');
    var canonical = '/catalog/' + slug + '-' + id;
    var coverBase = String(data.coverBase || '');
    var coverUrl = coverBase ? coverBase + id + '.webp' : '';
    var typeLabel = labelFor(TYPE_LABELS, row.type, row.type);
    var statusLabel = labelFor(STATUS_LABELS, row.status, row.status);
    var seasonLabel = seasonText(row);
    var episodes = episodeText(row);
    var alt = altNames(row, name);

    doc.title = name + ' — в приложении Аниплейс';
    var pageSummary = summary(row, name);
    setMeta('name', 'description', pageSummary);
    setMeta('property', 'og:title', name + ' — в приложении Аниплейс');
    setMeta('property', 'og:description', pageSummary);
    setMeta('property', 'og:image', coverUrl || 'https://ani.place/assets/og-cover.png');
    setMeta('property', 'og:image:alt', 'Обложка: ' + name);
    setMeta('name', 'twitter:title', name + ' — в приложении Аниплейс');
    setMeta('name', 'twitter:description', pageSummary);
    setMeta('name', 'twitter:image', coverUrl || 'https://ani.place/assets/og-cover.png');
    // App Links hooks for clients that read meta instead of dispatching
    // verified HTTPS links (messenger in-app browsers): same deep link the
    // Android intent filter and `parseDreamLink` already understand.
    setMeta('property', 'al:android:url', 'aniplace://title/dream:' + id);
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
    setText('title-alt', alt);
    setText('title-description', row.description || 'Описание пока нет — зато тайтл уже в каталоге Aniplace.');

    var descEl = doc.getElementById('title-description');
    if (descEl && !row.description) descEl.classList.add('is-empty');

    renderCover(coverUrl, fullCoverUrl(data, row, id), name);
    renderFacts(row, statusLabel, statusClass(row.status), typeLabel, seasonLabel, episodes);
    renderTags(row);
    renderAction(row, id, platform);
    attemptAppOpen(id, platform);
    renderDetails(row, typeLabel, statusLabel, seasonLabel, episodes);
    renderLinks(row);

    if (installSection && platform === 'windows') installSection.hidden = false;
    if (article) article.hidden = false;
  }

  function renderCover(url, fullUrl, name) {
    var img = doc.getElementById('title-cover');
    if (!img) return;
    img.alt = 'Обложка: ' + name;
    img.addEventListener('error', function () {
      // The shard row exists, so the card thumbnail should too — but when
      // it 404s (slow inventory roll, pruned object), try the hero
      // rendition before painting the neutral "no cover" state.
      if (fullUrl && img.getAttribute('data-cover-try') !== 'full') {
        img.setAttribute('data-cover-try', 'full');
        img.src = fullUrl;
        return;
      }
      // Keep the URL (the smoke test and devtools read it); CSS hides the
      // broken image and paints the neutral "no cover" state underneath.
      img.classList.add('is-missing');
    });
    if (url) img.src = url;
  }

  function fullCoverUrl(data, row, id) {
    var coverBase = String(data && data.coverBase || '');
    if (!coverBase) return '';
    return coverBase + 'full/' + id + '.webp';
  }

  function renderFacts(row, statusLabel, statusCls, typeLabel, seasonLabel, episodes) {
    var host = doc.getElementById('title-facts');
    if (!host) return;
    host.textContent = '';
    if (row.rating) {
      var voteText = row.votes ? formatNumber(row.votes) + ' голосов' : '';
      addFact(host, 'Рейтинг', formatRating(row.rating), '', voteText);
    }
    if (statusLabel) addFact(host, 'Статус', statusLabel, statusCls);
    if (typeLabel) addFact(host, 'Тип', typeLabel);
    if (row.year || seasonLabel) addFact(host, 'Сезон', [row.year, seasonLabel].filter(Boolean).join(' · '));
    if (episodes) addFact(host, 'Серии', episodes);
    if (row.age) addFact(host, 'Возраст', row.age);
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

  function renderAction(row, id, platformName) {
    var link = doc.getElementById('title-open');
    if (!link) return;
    var fallback = location.origin + INSTALL_PATH;
    link.setAttribute('href', fallback);

    var eyebrow = doc.getElementById('title-open-eyebrow');
    var label = doc.getElementById('title-open-label');
    var note = doc.getElementById('title-action-note');

    if (platformName === 'android') {
      if (eyebrow) eyebrow.textContent = 'Откроется в приложении';
      if (label) label.textContent = 'Открыть в Aniplace';
      if (note) {
        note.textContent = 'Если приложение уже установлено, откроется оно. Если нет — начнётся загрузка APK и откроется инструкция.';
      }
      // `intent://` is the one supported app-or-web navigation on Chromium
      // Android. A non-Chromium browser gets the install guide directly:
      // App Links already had the chance to open the installed app.
      if (isChromiumAndroid()) {
        link.setAttribute(
          'href',
          'intent://title/' + encodeURIComponent('dream:' + id) +
            '#Intent;scheme=aniplace;package=place.ani;S.browser_fallback_url=' +
            encodeURIComponent(fallback) + ';end'
        );
      }
      return;
    }

    if (platformName === 'ios') {
      // CSS hides the action; keep the fallback href valid for assistive
      // tech that still reaches the link.
      if (eyebrow) eyebrow.textContent = 'Android · APK';
      if (label) label.textContent = 'Установить Aniplace';
      return;
    }

    if (eyebrow) eyebrow.textContent = 'Android · APK';
    if (label) label.textContent = 'Установить Aniplace';
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

  function attemptAppOpen(id, platformName) {
    // Verified App Links open the installed app before this page even loads
    // (system browser). Messenger in-app browsers don't dispatch them, so on
    // Android the shell fires one silent custom-scheme attempt itself: with
    // Aniplace installed the app opens the title and this page is never
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
      frame.src = 'aniplace://title/' + encodeURIComponent('dream:' + id);
      doc.body.appendChild(frame);
    } catch (e) { /* stay on the page */ }
  }

  function renderDetails(row, typeLabel, statusLabel, seasonLabel, episodes) {
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
    add('Сезон', seasonLabel);
    add('Серии', episodes);
    add('Студия', row.studio);
    add('Режиссёр', row.director);
    add('Первоисточник', row.source);
    add('Премьера', formatDate(row.released));
    add('Возраст', row.age);
    add('Лицензия', row.license);

    if (detailsSection) detailsSection.hidden = count === 0;
  }

  function renderLinks(row) {
    var host = doc.getElementById('title-links');
    if (!host) return;
    host.textContent = '';
    var count = 0;

    function add(href, text) {
      var link = doc.createElement('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = text;
      host.appendChild(link);
      count += 1;
    }

    if (row.shikimori) {
      add('https://shikimori.one/animes/' + encodeURIComponent(row.shikimori), 'Shikimori');
    }
    if (row.mal) {
      add('https://myanimelist.net/anime/' + encodeURIComponent(row.mal), 'MyAnimeList');
    }
    if (!count) {
      var note = doc.createElement('p');
      note.className = 'title-side__empty';
      note.textContent = 'Внешних ссылок нет — всё остальное в приложении.';
      host.appendChild(note);
    }
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

  function seasonText(row) {
    var season = SEASON_LABELS[row.season];
    if (!season) return '';
    return season;
  }

  function episodeText(row) {
    var total = parseInt(row.episodes, 10) || 0;
    var aired = parseInt(row.aired, 10) || 0;
    if (!total && !aired) return '';
    if (total && aired && aired !== total) return aired + ' / ' + total;
    return String(total || aired);
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
    return ['Аниме', typeLabel, row.year, statusLabel].filter(Boolean).join(' · ');
  }

  function summary(row, name) {
    // Mirrors `og_description()` in `tools/site/build_catalog.py`: the shim
    // files bake this text for crawlers, the shell refreshes it for humans.
    if (row.description) {
      var text = String(row.description).replace(/\s+/g, ' ').trim();
      if (text.length > 160) text = text.slice(0, 157).trim() + '…';
      return text + ' — смотреть в приложении Аниплейс.';
    }
    return 'Смотреть аниме «' + name + '» в приложении Аниплейс: ' +
      'описание, жанры и рейтинг.';
  }

  function formatRating(value) {
    var number = Number(value);
    if (!isFinite(number) || number <= 0) return '';
    return number.toFixed(1).replace('.', ',');
  }

  function formatNumber(value) {
    var number = Number(value);
    if (!isFinite(number)) return '';
    try {
      return new Intl.NumberFormat('ru-RU').format(number);
    } catch (e) {
      return String(number);
    }
  }

  function formatDate(value) {
    var text = String(value || '').trim();
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (!match) return text;
    return match[3] + '.' + match[2] + '.' + match[1];
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
