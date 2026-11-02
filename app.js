// Home-page behavior: header/menu, seamless marquee, screenshot rail,
// lightbox and scroll reveals. No dependencies; every interactive piece
// has a static fallback in the HTML.

(function () {
  'use strict';

  var doc = document;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- header --------------------------------------------------------

  var head = doc.querySelector('[data-head]');
  function onScroll() {
    if (!head) return;
    head.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---- mobile nav ----------------------------------------------------

  var menu = doc.querySelector('.menu-btn');
  var nav = doc.getElementById('site-nav');

  function closeNav() {
    doc.body.classList.remove('nav-open');
    if (menu) {
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', 'Открыть меню');
    }
  }

  if (menu && nav) {
    menu.addEventListener('click', function () {
      var open = doc.body.classList.toggle('nav-open');
      menu.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    });
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) closeNav();
    });
    doc.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && doc.body.classList.contains('nav-open')) closeNav();
    });
  }

  // ---- marquee seam --------------------------------------------------

  var marqueeTrack = doc.querySelector('.marquee-track');
  if (marqueeTrack) {
    var marqueeBase = marqueeTrack.innerHTML;
    var ensureMarquee = function () {
      var guard = 0;
      // The -50% loop needs one repeated half at least as wide as the
      // viewport; otherwise the tail exposes a gap and then snaps back.
      while (marqueeTrack.scrollWidth < window.innerWidth * 2 && guard < 8) {
        marqueeTrack.innerHTML += marqueeBase;
        guard += 1;
      }
      var half = marqueeTrack.scrollWidth / 2;
      marqueeTrack.style.animationDuration = Math.max(30, Math.round(half / 45)) + 's';
      marqueeTrack.classList.add('is-ready');
    };
    // Measure after the display font swaps: a fallback-width half can be
    // narrower than the viewport and expose the seam.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(ensureMarquee);
    } else {
      ensureMarquee();
    }
    var marqueeFrame = 0;
    window.addEventListener('resize', function () {
      if (marqueeFrame) return;
      marqueeFrame = window.requestAnimationFrame(function () {
        marqueeFrame = 0;
        ensureMarquee();
      });
    });
  }

  // ---- screenshot rail ----------------------------------------------

  var track = doc.getElementById('shots-track');
  var shots = track ? track.querySelectorAll('.shot') : [];
  var counter = doc.querySelector('[data-shots-current]');
  var prev = doc.querySelector('[data-shots-prev]');
  var next = doc.querySelector('[data-shots-next]');
  var activeShot = 0;
  var raf = 0;
  var programmaticUntil = 0;

  function shotLeft(index) {
    if (!track || !shots[index]) return 0;
    var trackRect = track.getBoundingClientRect();
    var shotRect = shots[index].getBoundingClientRect();
    return track.scrollLeft + (shotRect.left - trackRect.left);
  }

  function maxScroll() {
    return track ? Math.max(0, track.scrollWidth - track.clientWidth) : 0;
  }

  function currentShot() {
    if (!track || !shots.length) return 0;
    // At the end the last frame cannot reach the left edge: the browser
    // clamps scrollLeft before its offset. Treat max scroll as the last
    // frame so the counter can reach 06 instead of sticking on 05.
    var max = maxScroll();
    if (max > 2 && track.scrollLeft >= max - 2) return shots.length - 1;
    var trackLeft = track.getBoundingClientRect().left;
    var best = 0;
    var bestDistance = Infinity;
    for (var i = 0; i < shots.length; i++) {
      var distance = Math.abs(shots[i].getBoundingClientRect().left - trackLeft);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }

  function renderShotUi(index) {
    activeShot = index;
    if (counter) counter.textContent = String(index + 1).padStart(2, '0');
    for (var i = 0; i < shots.length; i++) {
      var on = i === index;
      shots[i].classList.toggle('is-active', on);
      var link = shots[i].querySelector('.shot-btn');
      if (link) {
        if (on) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      }
    }
    var allVisible = maxScroll() <= 2;
    if (prev) prev.disabled = allVisible || index <= 0;
    if (next) next.disabled = allVisible || index >= shots.length - 1;
  }

  function updateShots() {
    // Ignore the scroll events produced by an arrow click: on a wide rail
    // the target frame clamps at max scroll, and the scroll position would
    // otherwise snap the counter to a different frame.
    if (Date.now() < programmaticUntil) return;
    renderShotUi(currentShot());
  }

  function goToShot(index) {
    if (!track || index < 0 || index >= shots.length) return;
    var left = Math.min(shotLeft(index), maxScroll());
    if (track.scrollTo) {
      track.scrollTo({ left: left, behavior: reduceMotion ? 'auto' : 'smooth' });
    } else {
      track.scrollLeft = left;
    }
    // A click at the clamped end causes no scroll event at all; update the
    // counter and disabled state for the target frame right away.
    renderShotUi(index);
    programmaticUntil = Date.now() + 500;
  }

  if (track && shots.length) {
    if (prev) prev.addEventListener('click', function () { goToShot(activeShot - 1); });
    if (next) next.addEventListener('click', function () { goToShot(activeShot + 1); });

    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = window.requestAnimationFrame(function () {
        raf = 0;
        updateShots();
      });
    }, { passive: true });

    // A manual swipe or wheel must take over immediately, even if it lands
    // inside the arrow-click settling window.
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (type) {
      track.addEventListener(type, function () { programmaticUntil = 0; }, { passive: true });
    });

    track.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToShot(activeShot - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToShot(activeShot + 1);
      }
    });

    window.addEventListener('resize', updateShots);
    updateShots();
  }

  // ---- lightbox ------------------------------------------------------

  var lightbox = doc.getElementById('lightbox');
  var lightboxImg = doc.getElementById('lightbox-img');
  var lightboxCaption = doc.getElementById('lightbox-caption');
  var lightboxClose = doc.querySelector('[data-lightbox-close]');
  var lightboxButtons = doc.querySelectorAll('[data-lightbox]');
  var lastTrigger = null;
  var lightboxIndex = 0;

  function openLightbox(index) {
    var button = lightboxButtons[index];
    if (!button || !lightbox) return;
    lightboxIndex = index;
    lastTrigger = button;
    if (lightboxImg) {
      lightboxImg.src = button.getAttribute('data-lightbox');
      var inner = button.querySelector('img');
      lightboxImg.alt = inner ? inner.alt : '';
    }
    if (lightboxCaption) lightboxCaption.textContent = button.getAttribute('data-caption') || '';
    if (lightbox.showModal) {
      lightbox.showModal();
    } else {
      lightbox.setAttribute('open', '');
      lightbox.classList.add('is-open');
    }
  }

  function closeLightbox() {
    if (!lightbox) return;
    if (lightbox.close) {
      lightbox.close();
    } else {
      lightbox.removeAttribute('open');
      lightbox.classList.remove('is-open');
    }
    if (lastTrigger) lastTrigger.focus();
  }

  for (var lb = 0; lb < lightboxButtons.length; lb++) {
    (function (index) {
      lightboxButtons[index].addEventListener('click', function (event) {
        // The trigger is a real link, so a no-JS visitor opens the image
        // directly. With JS, the lightbox replaces that navigation.
        event.preventDefault();
        openLightbox(index);
      });
    })(lb);
  }
  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) closeLightbox();
    });
    lightbox.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        openLightbox((lightboxIndex - 1 + lightboxButtons.length) % lightboxButtons.length);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        openLightbox((lightboxIndex + 1) % lightboxButtons.length);
      }
    });
  }

  // ---- reveal on scroll ---------------------------------------------

  var reveals = doc.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || reduceMotion) {
    for (var r = 0; r < reveals.length; r++) reveals[r].classList.add('is-visible');
  } else {
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('is-visible');
          observer.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    for (var q = 0; q < reveals.length; q++) observer.observe(reveals[q]);
  }
})();
