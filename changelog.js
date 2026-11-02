// Changelog page: reads the two public GitHub release feeds, caches the
// parsed list for 30 minutes, and renders release notes as safe Markdown.
//
// The page is useful before this script runs: it carries both GitHub release
// links and a no-JS note. If the API is down or rate-limited, each app keeps
// an honest link to its releases instead of an empty list.
//
// Release bodies are untrusted. renderMarkdown() escapes the whole body
// before adding any markup, then parses only the small supported subset:
// headings, paragraphs, lists, bold, italic, inline code, http(s) links and
// line breaks. Raw HTML is never parsed. Keep that order if you touch it.

(function () {
  'use strict';

  var CACHE_KEY = 'place.changelog.v1';
  var CACHE_TTL = 30 * 60 * 1000;
  var PER_PAGE = 10;
  var REQUEST_TIMEOUT = 8000;

  var APPS = [
    {
      id: 'aniplace',
      name: 'Aniplace',
      api: 'https://api.github.com/repos/bloomstick/aniplace-releases/releases?per_page=10',
      releases: 'https://github.com/bloomstick/aniplace-releases/releases',
      empty: 'Публичных релизов не нашлось. Свежие сборки и заметки — на GitHub.',
      error: 'GitHub не ответил, поэтому свежие записи не загрузились. Все релизы и заметки остались на GitHub.'
    },
    {
      id: 'mangaplace',
      name: 'Mangaplace',
      api: 'https://api.github.com/repos/moeplace/mangaplace-releases/releases?per_page=10',
      releases: 'https://github.com/moeplace/mangaplace-releases/releases',
      empty: 'Публичных релизов пока нет — первая сборка готовится. Как только она появится, история подтянется сюда сама.',
      error: 'GitHub не ответил, поэтому свежие записи не загрузились. Следи за релизами прямо на GitHub.'
    }
  ];

  var root = document.querySelector('[data-changelog-history]');
  if (!root) return;

  var cache = readCache();
  var pending = 0;

  APPS.forEach(function (app) {
    var list = document.querySelector('[data-changelog-list="' + app.id + '"]');
    if (!list) return;

    var hit = cache[app.id];
    if (hit && typeof hit.at === 'number' && Date.now() - hit.at < CACHE_TTL &&
        Array.isArray(hit.releases)) {
      renderApp(app, list, hit.releases);
      return;
    }

    if (!window.fetch) {
      renderError(app, list);
      return;
    }

    pending += 1;
    load(app, list);
  });

  if (pending === 0) settle();

  // ---- release loading ----------------------------------------------

  function load(app, list) {
    var controller = null;
    var timer = null;
    if (window.AbortController) {
      controller = new AbortController();
      timer = window.setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT);
    }

    fetch(app.api, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (payload) {
        var releases = parseReleases(app, payload);
        cache[app.id] = { at: Date.now(), releases: releases };
        writeCache(cache);
        renderApp(app, list, releases);
      })
      .catch(function () {
        renderError(app, list);
      })
      .then(function () {
        if (timer) window.clearTimeout(timer);
        pending -= 1;
        if (pending === 0) settle();
      });
  }

  function parseReleases(app, payload) {
    if (!Array.isArray(payload)) return [];

    var list = payload
      .filter(function (entry) {
        return entry && !entry.draft && !entry.prerelease && entry.tag_name;
      })
      .map(function (entry) {
        var published = entry.published_at || entry.created_at || '';
        return {
          version: versionLabel(entry.tag_name),
          publishedAt: isDate(published) ? published : '',
          dateLabel: formatDate(published),
          body: typeof entry.body === 'string' ? entry.body : '',
          url: releaseUrl(entry.html_url, app.releases)
        };
      });

    list.sort(function (a, b) {
      return dateValue(b.publishedAt) - dateValue(a.publishedAt);
    });

    return list.slice(0, PER_PAGE);
  }

  function versionLabel(tag) {
    var value = String(tag || '').trim();
    if (!value) return 'без тега';
    return /^v/i.test(value) ? value : 'v' + value;
  }

  function isDate(value) {
    return !!value && !isNaN(Date.parse(value));
  }

  function dateValue(value) {
    var parsed = Date.parse(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  function formatDate(value) {
    if (!isDate(value)) return '';
    try {
      return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date(value)).replace(/\s*г\.$/, '');
    } catch (e) {
      return '';
    }
  }

  // Only a real github.com release URL is allowed here. A malformed or
  // spoofed html_url falls back to the app's releases page.
  function releaseUrl(value, fallback) {
    try {
      var url = new URL(String(value || ''));
      if (url.protocol === 'https:' &&
          (url.hostname === 'github.com' || url.hostname === 'www.github.com')) {
        return url.href;
      }
    } catch (e) { /* not a URL */ }
    return fallback;
  }

  // ---- rendering -----------------------------------------------------

  function renderApp(app, list, releases) {
    list.textContent = '';
    if (!releases.length) {
      list.appendChild(emptyState(app, false));
    } else {
      for (var i = 0; i < releases.length; i++) {
        list.appendChild(releaseNode(releases[i], i === 0));
      }
    }
    root.hidden = false;
  }

  function renderError(app, list) {
    list.textContent = '';
    list.appendChild(emptyState(app, true));
    root.hidden = false;
  }

  function settle() {
    root.hidden = false;
    root.setAttribute('aria-busy', 'false');
  }

  function releaseNode(release, isLatest) {
    var wrap = el('details', 'version-entry');
    if (isLatest) wrap.open = true;

    var head = el('summary', 'version-head');

    var mark = el('span', 'version-mark');
    mark.setAttribute('aria-hidden', 'true');
    head.appendChild(mark);

    var id = el('span', 'version-id');
    id.appendChild(el('h4', 'version-tag', release.version));
    if (release.dateLabel) {
      var time = el('time', 'version-date', release.dateLabel);
      if (release.publishedAt) time.setAttribute('datetime', release.publishedAt);
      id.appendChild(time);
    }
    head.appendChild(id);

    if (isLatest) head.appendChild(el('span', 'stamp version-latest', 'свежая'));

    var toggle = el('span', 'version-toggle');
    toggle.setAttribute('aria-hidden', 'true');
    head.appendChild(toggle);

    wrap.appendChild(head);

    var body = el('div', 'version-body');
    if (release.body && release.body.trim()) {
      var markdown = el('div', 'release-md');
      // renderMarkdown escapes first; its output only contains tags created
      // by that function, never a tag from the release body.
      markdown.innerHTML = renderMarkdown(release.body);
      body.appendChild(markdown);
    } else {
      body.appendChild(el('p', 'release-md release-md--empty',
        'Заметок к этой сборке нет — файлы и список изменений ждут на GitHub.'));
    }

    body.appendChild(releaseLink(release.url));
    wrap.appendChild(body);
    return wrap;
  }

  function emptyState(app, failed) {
    var box = el('div', 'version-empty');
    box.appendChild(el('span', 'stamp version-empty-stamp', failed ? 'нет связи' : 'пока пусто'));
    box.appendChild(el('p', 'version-empty-copy', failed ? app.error : app.empty));

    var link = el('a', 'btn btn--ghost version-empty-link');
    link.href = app.releases;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.appendChild(document.createTextNode(failed ? 'Открыть релизы на GitHub' : 'Следить за релизами'));
    link.appendChild(icon('i-arrow-up'));
    box.appendChild(link);
    return box;
  }

  function releaseLink(url) {
    var link = el('a', 'version-link');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.appendChild(document.createTextNode('Открыть релиз на GitHub'));
    link.appendChild(icon('i-arrow-up'));
    return link;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(id) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }

  // ---- safe Markdown -------------------------------------------------

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function decodeEntities(value) {
    return String(value)
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  function safeUrl(value) {
    try {
      var url = new URL(decodeEntities(value));
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch (e) { /* not a URL */ }
    return '';
  }

  function linkTag(rawUrl, labelHtml) {
    var url = safeUrl(rawUrl);
    if (!url) return labelHtml;
    return '<a href="' + escapeHtml(url) +
      '" target="_blank" rel="noopener noreferrer">' + labelHtml + '</a>';
  }

  function inline(text, allowLinks) {
    var out = '';
    var i = 0;

    while (i < text.length) {
      var ch = text.charAt(i);

      if (ch === '`') {
        var codeEnd = text.indexOf('`', i + 1);
        if (codeEnd > i + 1) {
          out += '<code>' + text.slice(i + 1, codeEnd) + '</code>';
          i = codeEnd + 1;
          continue;
        }
      }

      var pair = text.substr(i, 2);
      if (pair === '**' || pair === '__') {
        var boldEnd = text.indexOf(pair, i + 2);
        if (boldEnd > i + 2) {
          out += '<strong>' + inline(text.slice(i + 2, boldEnd), allowLinks) + '</strong>';
          i = boldEnd + 2;
          continue;
        }
      }

      if (ch === '*' || ch === '_') {
        var emEnd = text.indexOf(ch, i + 1);
        if (emEnd > i + 1) {
          out += '<em>' + inline(text.slice(i + 1, emEnd), allowLinks) + '</em>';
          i = emEnd + 1;
          continue;
        }
      }

      if (allowLinks && ch === '[') {
        var mdLink = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/.exec(text.slice(i));
        if (mdLink) {
          out += linkTag(mdLink[2], inline(mdLink[1], false));
          i += mdLink[0].length;
          continue;
        }
      }

      if (allowLinks && (text.substr(i, 7) === 'http://' || text.substr(i, 8) === 'https://') &&
          (i === 0 || /[\s([{>]/.test(text.charAt(i - 1)))) {
        var bare = /^https?:\/\/[^\s)]+/.exec(text.slice(i));
        if (bare) {
          var bareUrl = bare[0].replace(/[.,;:!?]+$/, '');
          out += linkTag(bareUrl, bareUrl);
          i += bareUrl.length;
          continue;
        }
      }

      out += ch;
      i += 1;
    }

    return out;
  }

  function renderListItem(item) {
    var task = /^\[([ xX])\]\s+/.exec(item);
    if (task) {
      item = (task[1].toLowerCase() === 'x' ? '☑ ' : '☐ ') + item.slice(task[0].length);
    }
    return inline(item, true);
  }

  function renderMarkdown(markdown) {
    // Escape the entire untrusted body before any markup is added.
    var source = escapeHtml(String(markdown || '')).replace(/\r\n?/g, '\n');
    var lines = source.split('\n');
    var out = [];
    var i = 0;

    function isBlank(line) { return !/\S/.test(line); }
    function heading(line) { return /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line); }
    function unordered(line) { return /^\s*[-*+]\s+(.+)$/.exec(line); }
    function ordered(line) { return /^\s*\d+[.)]\s+(.+)$/.exec(line); }
    function fence(line) { return /^\s*```/.test(line); }
    function rule(line) { return /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line); }
    function blockStart(line) {
      return isBlank(line) || heading(line) || unordered(line) ||
        ordered(line) || fence(line) || rule(line);
    }

    while (i < lines.length) {
      var line = lines[i];

      if (isBlank(line)) { i += 1; continue; }

      if (fence(line)) {
        i += 1;
        var code = [];
        while (i < lines.length && !fence(lines[i])) {
          code.push(lines[i]);
          i += 1;
        }
        if (i < lines.length) i += 1;
        out.push('<pre><code>' + code.join('\n') + '</code></pre>');
        continue;
      }

      var h = heading(line);
      if (h) {
        out.push('<h5>' + inline(h[2], true) + '</h5>');
        i += 1;
        continue;
      }

      if (rule(line)) {
        out.push('<hr>');
        i += 1;
        continue;
      }

      var item = unordered(line);
      if (item) {
        var items = [];
        while (i < lines.length && (item = unordered(lines[i]))) {
          var text = item[1];
          i += 1;
          while (i < lines.length && !blockStart(lines[i])) {
            text += ' ' + lines[i].trim();
            i += 1;
          }
          items.push('<li>' + renderListItem(text) + '</li>');
        }
        out.push('<ul>' + items.join('') + '</ul>');
        continue;
      }

      var numbered = ordered(line);
      if (numbered) {
        var numberedItems = [];
        while (i < lines.length && (numbered = ordered(lines[i]))) {
          var numberedText = numbered[1];
          i += 1;
          while (i < lines.length && !blockStart(lines[i])) {
            numberedText += ' ' + lines[i].trim();
            i += 1;
          }
          numberedItems.push('<li>' + renderListItem(numberedText) + '</li>');
        }
        out.push('<ol>' + numberedItems.join('') + '</ol>');
        continue;
      }

      var paragraph = [];
      while (i < lines.length && !blockStart(lines[i])) {
        paragraph.push(inline(lines[i].trim(), true));
        i += 1;
      }
      out.push('<p>' + paragraph.join('<br>') + '</p>');
    }

    return out.join('');
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
})();
