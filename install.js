// Install wizard: app + device -> exact GitHub release + steps.
//
// The page ships with a static short guide (visible without JS). This script
// upgrades it into a three-stage flow, keeps the choice in the URL (so a QR
// or a shared link opens the right guide), and listens to download.js as it
// resolves the latest GitHub release.

(function () {
  'use strict';

  var doc = document;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wizard = doc.querySelector('[data-wizard]');
  if (!wizard) return;

  var steps = doc.querySelectorAll('[data-wizard-step]');
  var panels = doc.querySelectorAll('[data-wizard-panel]');
  var appButtons = doc.querySelectorAll('[data-app-choice]');
  var osButtons = doc.querySelectorAll('[data-os-choice]');
  var nextButtons = doc.querySelectorAll('[data-wizard-next]');
  var backButtons = doc.querySelectorAll('[data-wizard-back]');
  var resultTitle = doc.querySelector('[data-result-title]');
  var resultKicker = doc.querySelector('[data-result-kicker]');
  var resultMeta = doc.querySelector('[data-result-meta]');
  var resultFile = doc.querySelector('[data-result-file]');
  var resultSize = doc.querySelector('[data-result-size]');
  var resultDownload = doc.querySelector('[data-result-download]');
  var resultRelease = doc.querySelector('[data-result-release]');
  var resultRustore = doc.querySelector('[data-result-rustore]');
  var resultAll = doc.querySelector('[data-result-all-releases]');
  var resultSha = doc.querySelector('[data-result-sha]');
  var resultCommand = doc.querySelector('[data-result-command]');
  var resultStarted = doc.querySelector('[data-result-started]');
  var resultRetry = doc.querySelector('[data-result-retry]');
  var retryIcon = doc.querySelector('[data-result-retry-icon] use');
  var downloadBox = doc.querySelector('[data-result-download-box]');
  var soonPanel = doc.querySelector('[data-result-soon]');
  var guide = doc.querySelector('[data-result-guide]');
  var verify = doc.querySelector('[data-result-verify]');
  var stuck = doc.querySelector('[data-result-stuck]');
  var osGuides = doc.querySelectorAll('[data-os-steps]');

  var platform = window.PlaceDownloads
    ? window.PlaceDownloads.platform()
    : (/android/i.test(navigator.userAgent || '') ? 'android' : 'other');
  var androidOnly = platform === 'android';

  var state = {
    app: 'aniplace',
    os: detectOS(),
    step: 1,
    maxStep: 1
  };

  var params = parseParams();
  if (params.app === 'aniplace' || params.app === 'mangaplace') state.app = params.app;
  if (params.os === 'android' || params.os === 'windows') state.os = params.os;
  if (params.step === '1' || params.step === '2' || params.step === '3') {
    // A synced URL carries the current stage, so refreshing on step 1 must
    // not jump to the finished guide.
    state.step = parseInt(params.step, 10);
    state.maxStep = Math.max(state.maxStep, state.step);
  } else if (params.app && params.os) {
    // A shared app/device link deep-links straight to the result (step 3).
    state.step = 3;
    state.maxStep = 3;
  }

  // A phone has no device choice: it can only install the Android build.
  if (androidOnly) {
    state.os = 'android';
    if (state.step === 2) {
      state.step = 3;
      state.maxStep = 3;
    }
  }

  var startedRequested = params.started === '1';
  var lastReady = false;

  var deviceStep = doc.querySelector('[data-wizard-step="2"]');
  var guideStep = doc.querySelector('[data-wizard-step="3"]');
  if (androidOnly) {
    if (deviceStep) deviceStep.hidden = true;
    var guideNumber = guideStep ? guideStep.querySelector('span') : null;
    if (guideNumber) guideNumber.textContent = '02';
  }

  // ---- render --------------------------------------------------------

  function render() {
    var i;
    for (i = 0; i < steps.length; i++) {
      var step = steps[i];
      var n = parseInt(step.getAttribute('data-wizard-step'), 10);
      step.classList.toggle('is-active', n === state.step);
      step.classList.toggle('is-done', n < state.step);
      if (n === state.step) {
        step.setAttribute('aria-current', 'step');
      } else {
        step.removeAttribute('aria-current');
      }
    }
    for (i = 0; i < panels.length; i++) {
      var panel = panels[i];
      var value = parseInt(panel.getAttribute('data-wizard-panel'), 10);
      var active = value === state.step;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    }
    for (i = 0; i < appButtons.length; i++) {
      var appOn = appButtons[i].getAttribute('data-app-choice') === state.app;
      appButtons[i].classList.toggle('is-selected', appOn);
      appButtons[i].setAttribute('aria-pressed', appOn ? 'true' : 'false');
    }
    for (i = 0; i < osButtons.length; i++) {
      var osOn = osButtons[i].getAttribute('data-os-choice') === state.os;
      osButtons[i].classList.toggle('is-selected', osOn);
      osButtons[i].setAttribute('aria-pressed', osOn ? 'true' : 'false');
    }
    renderResult();
    syncUrl();
  }

  function renderResult() {
    var appName = state.app === 'mangaplace' ? 'Mangaplace' : 'Aniplace';
    var osName = state.os === 'windows' ? 'Windows' : 'Android';
    var release = window.PlaceDownloads ? window.PlaceDownloads.get(state.app) : null;
    var asset = release ? release[state.os] : null;
    var ready = !!(asset && asset.url);
    var isManga = state.app === 'mangaplace';
    lastReady = ready;

    if (resultKicker) {
      resultKicker.textContent = (androidOnly ? 'Шаг 02 · ' : 'Шаг 03 · ') + appName + ' на ' + osName;
    }
    if (resultTitle) {
      resultTitle.textContent = ready
        ? 'Установка ' + appName + ' на ' + osName
        : (isManga ? 'Mangaplace ещё готовится' : 'Установка ' + appName + ' на ' + osName);
    }

    if (downloadBox) downloadBox.hidden = !ready;
    if (guide) guide.hidden = !ready;
    if (verify) verify.hidden = !ready;
    if (stuck) stuck.hidden = !ready;
    if (soonPanel) soonPanel.hidden = ready || !isManga;
    if (resultRustore) {
      resultRustore.hidden = !(ready && state.app === 'aniplace' && state.os === 'android');
    }

    for (var g = 0; g < osGuides.length; g++) {
      osGuides[g].hidden = osGuides[g].getAttribute('data-os-steps') !== state.os;
    }

    if (resultMeta) {
      if (ready) {
        resultMeta.textContent = platformLine(osName, release);
      } else if (isManga) {
        resultMeta.textContent = 'Публичной сборки пока нет — ниже ссылка, где следить за релизом.';
      } else {
        resultMeta.textContent = 'Не удалось получить данные релиза. Открой страницу GitHub — файлы там.';
      }
    }

    if (resultFile) resultFile.textContent = ready ? asset.name : 'Релиз пока не опубликован';
    if (resultSize) {
      resultSize.textContent = ready
        ? formatSize(asset.size) + (asset.kind === 'exe' ? ' · установщик' : asset.kind === 'zip' ? ' · архив' : ' · APK')
        : '';
    }

    if (resultDownload) {
      if (ready) {
        var fileIcon = state.os === 'windows' ? 'i-windows' : 'i-android';
        resultDownload.setAttribute('href', asset.url);
        resultDownload.setAttribute('target', '_blank');
        resultDownload.setAttribute('rel', 'noopener');
        resultDownload.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#' + fileIcon + '"/></svg> ' + downloadLabel(asset, state.os);
      } else {
        resultDownload.setAttribute('href', isManga
          ? 'https://github.com/moeplace/mangaplace-releases/releases'
          : 'https://github.com/bloomstick/aniplace-releases/releases/latest');
        resultDownload.setAttribute('target', '_blank');
        resultDownload.setAttribute('rel', 'noopener');
        resultDownload.innerHTML = '<svg class="icon icon--fill" aria-hidden="true"><use href="#i-github"/></svg> ' +
          (isManga ? 'Следить за релизами' : 'Открыть релизы');
      }
    }

    if (resultRetry) {
      if (ready) {
        resultRetry.setAttribute('href', asset.url);
        resultRetry.hidden = false;
      } else {
        resultRetry.removeAttribute('href');
        resultRetry.hidden = true;
      }
    }
    if (retryIcon) {
      retryIcon.setAttribute('href', state.os === 'windows' ? '#i-windows' : '#i-android');
    }

    if (resultRelease) {
      var releaseUrl = release && release.releaseUrl
        ? release.releaseUrl
        : (isManga
          ? 'https://github.com/moeplace/mangaplace-releases/releases'
          : 'https://github.com/bloomstick/aniplace-releases/releases/latest');
      resultRelease.setAttribute('href', releaseUrl);
    }

    if (resultAll) {
      resultAll.setAttribute('href', isManga
        ? 'https://github.com/moeplace/mangaplace-releases/releases'
        : 'https://github.com/bloomstick/aniplace-releases/releases');
    }

    if (resultSha) {
      resultSha.setAttribute('href', ready && release && release.sha
        ? release.sha.url
        : (release && release.releaseUrl) || (isManga
          ? 'https://github.com/moeplace/mangaplace-releases/releases'
          : 'https://github.com/bloomstick/aniplace-releases/releases/latest'));
    }

    if (resultCommand) {
      var fileName = ready ? asset.name : (isManga ? 'mangaplace-*.apk' : 'aniplace-*.apk');
      resultCommand.textContent = state.os === 'windows'
        ? 'certutil -hashfile "' + fileName + '" SHA256'
        : 'sha256sum "' + fileName + '"';
    }

    // Windows copy names the app's exe; keep it accurate if Mangaplace ships.
    var exe = doc.querySelectorAll('[data-app-exe]');
    for (var e = 0; e < exe.length; e++) {
      exe[e].textContent = appName + '.exe';
    }
    renderStarted();
  }

  var startedWasVisible = false;

  function renderStarted() {
    if (!resultStarted) return;
    var show = lastReady && startedRequested;
    var appeared = show && !startedWasVisible;
    startedWasVisible = show;
    resultStarted.hidden = !show;

    // The note lives above the wizard. When it appears — after the releases
    // resolve or after a fresh download — bring it into view so the
    // confirmation is not parked off-screen above the current position.
    if (appeared && window.requestAnimationFrame) {
      window.requestAnimationFrame(function () { scrollToWizard(false); });
    }
  }

  function platformLine(osName, release) {
    var version = release && release.version ? 'версия ' + release.version : '';
    var date = release && release.published ? formatDate(release.published) : '';
    var platform = osName === 'Windows' ? 'Windows 10/11' : 'Android 7.0+';
    var bits = [platform];
    if (version) bits.push(version);
    if (date) bits.push(date);
    return bits.join(' · ');
  }

  function downloadLabel(asset, os) {
    if (os === 'windows') {
      return asset.kind === 'exe' ? 'Скачать установщик' : 'Скачать ZIP';
    }
    return 'Скачать APK';
  }

  // ---- navigation ----------------------------------------------------

  function scrollToWizard(smooth) {
    if (!wizard) return;
    // While the started note is visible on the result step it is the first
    // thing to keep in view; the wizard card follows right below it.
    var anchor = state.step === 3 && resultStarted && !resultStarted.hidden
      ? resultStarted
      : wizard;
    var top = anchor.getBoundingClientRect().top + window.scrollY - 92;
    if (window.scrollTo) {
      window.scrollTo({ top: top, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
    } else {
      window.scrollTo(0, top);
    }
  }

  function goToStep(step) {
    if (step < 1 || step > 3) return;
    if (step > state.maxStep) return;
    state.step = step;
    render();
    scrollToWizard(true);
  }

  for (var n = 0; n < nextButtons.length; n++) {
    nextButtons[n].addEventListener('click', function () {
      if (androidOnly && state.step === 1) {
        state.maxStep = 3;
        goToStep(3);
        return;
      }
      state.maxStep = Math.max(state.maxStep, state.step + 1);
      goToStep(state.step + 1);
    });
  }
  for (var b = 0; b < backButtons.length; b++) {
    backButtons[b].addEventListener('click', function () {
      goToStep(androidOnly && state.step === 3 ? 1 : state.step - 1);
    });
  }
  for (var s = 0; s < steps.length; s++) {
    (function (button) {
      button.addEventListener('click', function () {
        var target = parseInt(button.getAttribute('data-wizard-step'), 10);
        if (target <= state.maxStep) goToStep(target);
      });
    })(steps[s]);
  }

  for (var a = 0; a < appButtons.length; a++) {
    (function (button) {
      button.addEventListener('click', function () {
        state.app = button.getAttribute('data-app-choice');
        startedRequested = false;
        render();
      });
    })(appButtons[a]);
  }
  for (var o = 0; o < osButtons.length; o++) {
    (function (button) {
      button.addEventListener('click', function () {
        state.os = button.getAttribute('data-os-choice');
        startedRequested = false;
        render();
      });
    })(osButtons[o]);
  }

  // ---- URL -----------------------------------------------------------

  function syncUrl() {
    var query = '?app=' + state.app + '&os=' + state.os + '&step=' + state.step;
    try {
      history.replaceState(null, '', location.pathname + query);
    } catch (e) {
      /* file:// preview: no history API, the wizard still works */
    }
  }

  function parseParams() {
    var out = {};
    var search = String(location.search || '').replace(/^\?/, '');
    if (!search) return out;
    var parts = search.split('&');
    for (var i = 0; i < parts.length; i++) {
      var pair = parts[i].split('=');
      if (pair.length < 2) continue;
      try {
        out[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1].replace(/\+/g, ' '));
      } catch (e) {
        /* malformed query: ignore */
      }
    }
    return out;
  }

  function detectOS() {
    return platform === 'windows' ? 'windows' : 'android';
  }

  // ---- formatting + copy ---------------------------------------------

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

  var copyButtons = doc.querySelectorAll('[data-copy-target]');
  for (var c = 0; c < copyButtons.length; c++) {
    (function (button) {
      button.addEventListener('click', function () {
        var selector = button.getAttribute('data-copy-target');
        var target = selector ? doc.querySelector(selector) : null;
        if (!target) return;
        var text = target.textContent || '';
        copyText(text, function (ok) {
          if (!ok) return;
          var label = button.querySelector('span');
          if (label) label.textContent = 'Скопировано';
          button.classList.add('is-copied');
          setTimeout(function () {
            if (label) label.textContent = 'Копировать';
            button.classList.remove('is-copied');
          }, 2000);
        });
      });
    })(copyButtons[c]);
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallbackCopy(text, done); });
      return;
    }
    fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    var area = doc.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    doc.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
    doc.body.removeChild(area);
    done(ok);
  }

  // The result and retry are normal links with target="_blank": the browser
  // opens the attachment in a new tab and keeps this page on step 3. We only
  // reveal the started note; never prevent the default navigation.
  if (resultDownload) {
    resultDownload.addEventListener('click', function () {
      if (!lastReady) return;
      startedRequested = true;
      renderStarted();
    });
  }
  if (resultRetry) {
    resultRetry.addEventListener('click', function () {
      if (!lastReady) return;
      renderStarted();
    });
  }

  // ---- release updates ----------------------------------------------

  if (window.PlaceDownloads) {
    window.PlaceDownloads.onChange(function () {
      renderResult();
    });
  } else {
    doc.addEventListener('place:releases', renderResult);
  }

  render();
  // A download CTA or a shared app/device link should land on the result,
  // not on the top hero with the guide below the fold.
  if (startedRequested || (state.step === 3 && (params.step === '3' || (params.app && params.os)))) {
    window.requestAnimationFrame(function () { scrollToWizard(false); });
  }
})();
