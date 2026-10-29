// Aniplace hero: interactive three.js highlight — floating hearts + sparkles.
// Pointer moves the camera (parallax), clicks burst new hearts.
// Scroll-reveal + counters always run, even offline / reduced-motion / WebGL failure.
(function () {
  'use strict';

  initReveal();
  initCounters();
  initShots();

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.getElementById('sparkles');
  if (!canvas || !window.THREE) return;
  try {
    initHearts(canvas);
  } catch (e) {
    /* WebGL/CDN failure: static page still fully usable */
  }

  function initHearts(canvas) {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 26;

    var group = new THREE.Group();
    scene.add(group);

    // Graphite grounds + the brand's signal red (aniplace_brand.dart).
    var palette = [0xe11d48, 0xbe123c, 0x5f6368, 0x9aa0a6, 0xdadce0];
    var hearts = [];
    var heartGeo = heartGeometry(1.6);

    function addHeart(burst) {
      var mat = new THREE.MeshStandardMaterial({
        color: palette[(Math.random() * palette.length) | 0],
        roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.92
      });
      var m = new THREE.Mesh(heartGeo, mat);
      var r = burst ? 4 : 9;
      m.position.set((Math.random() - 0.5) * r * 2, (Math.random() - 0.5) * r * 1.4, (Math.random() - 0.5) * 6);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      m.userData = {
        spin: (Math.random() - 0.5) * 0.02,
        floatAmp: 0.4 + Math.random() * 0.8,
        floatSpeed: 0.4 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        life: burst ? 90 : Infinity
      };
      if (burst) {
        m.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 0.5 + 0.15, (Math.random() - 0.5) * 0.3);
        m.scale.setScalar(0.4);
      } else {
        m.scale.setScalar(0.7 + Math.random() * 0.9);
      }
      group.add(m);
      hearts.push(m);
    }

    for (var i = 0; i < 22; i++) addHeart(false);

    var pGeo = new THREE.BufferGeometry();
    var pCount = 160;
    var pos = new Float32Array(pCount * 3);
    for (var j = 0; j < pCount; j++) {
      pos[j * 3] = (Math.random() - 0.5) * 30;
      pos[j * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[j * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xb3b8bd, size: 0.22, transparent: true, opacity: 0.85 }));
    group.add(points);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    var dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(6, 10, 8);
    scene.add(dir);
    var accentLight = new THREE.PointLight(0xe11d48, 12, 40);
    accentLight.position.set(-6, -2, 6);
    scene.add(accentLight);

    var mx = 0, my = 0, tx = 0, ty = 0;
    window.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    canvas.parentElement.addEventListener('click', function () {
      for (var k = 0; k < 6; k++) addHeart(true);
    });

    function resize() {
      var w = canvas.clientWidth || canvas.parentElement.clientWidth;
      var h = canvas.clientHeight || 520;
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    var t = 0;
    (function tick() {
      requestAnimationFrame(tick);
      t += 0.016;
      mx += (tx - mx) * 0.05;
      my += (ty - my) * 0.05;
      group.rotation.y = mx * 0.45;
      group.rotation.x = my * 0.25;
      camera.position.x = mx * 2;
      camera.position.y = -my * 1.4;
      camera.lookAt(0, 0, 0);
      for (var n = hearts.length - 1; n >= 0; n--) {
        var m = hearts[n], u = m.userData;
        m.rotation.y += u.spin;
        m.rotation.x += u.spin * 0.7;
        m.position.y += Math.sin(t * u.floatSpeed + u.phase) * 0.008 * u.floatAmp;
        if (u.vel) {
          m.position.add(u.vel);
          u.vel.multiplyScalar(0.96);
          m.scale.multiplyScalar(1.02);
          if (--u.life <= 0) {
            group.remove(m);
            hearts.splice(n, 1);
          }
        }
      }
      points.rotation.y = t * 0.03;
      renderer.render(scene, camera);
    })();
  }

  function heartGeometry(size) {
    var s = new THREE.Shape();
    s.moveTo(5, 5);
    s.bezierCurveTo(5, 5, 4, 0, 0, 0);
    s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
    s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
    s.bezierCurveTo(13, 15.4, 16, 11, 16, 7);
    s.bezierCurveTo(16, 7, 16, 0, 10, 0);
    s.bezierCurveTo(7, 0, 5, 5, 5, 5);
    var g = new THREE.ExtrudeGeometry(s, { depth: 2.5, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.8, bevelSegments: 2, steps: 1 });
    g.center();
    g.scale(size / 22, size / 22, size / 22);
    return g;
  }

  function initReveal() {
    var els = document.querySelectorAll('.reveal, .feature');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.15 });
    els.forEach(function (el) { io.observe(el); });
  }

  function initCounters() {
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var dec = el.getAttribute('data-dec') ? 1 : 0;
      function run() {
        var start = null;
        function step(ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / 1400, 1);
          var v = target * (1 - Math.pow(1 - p, 3));
          el.textContent = dec ? v.toFixed(1) : Math.round(v).toLocaleString('ru-RU');
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }
      if (!('IntersectionObserver' in window)) { run(); return; }
      var cio = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          cio.disconnect();
          run();
        });
      });
      cio.observe(el);
    });
  }

  // Screenshots slider: the strip is a plain scroll-snap container (touch
  // swipe, trackpad, keyboard already work), upgraded with arrows and page
  // dots. Runs even under reduced motion — the scroll just stops animating.
  function initShots() {
    var track = document.getElementById('shots-track');
    var slider = track && track.closest('.shots-slider');
    if (!slider) return;
    var cards = track.querySelectorAll('.shot');
    var prev = slider.querySelector('.shots-prev');
    var next = slider.querySelector('.shots-next');
    var dots = slider.querySelector('.shots-dots');
    if (!cards.length || !prev || !next || !dots) return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var behavior = reduced ? 'auto' : 'smooth';
    var nativeSmooth = 'scrollBehavior' in document.documentElement.style;
    var pages = 0;
    var frame = 0;

    function gap() {
      var g = parseFloat(window.getComputedStyle(track).columnGap);
      return isNaN(g) ? 16 : g;
    }
    function step() {
      return cards[0].getBoundingClientRect().width + gap();
    }
    function maxScroll() {
      return Math.max(0, track.scrollWidth - track.clientWidth);
    }
    function pageTotal() {
      var max = maxScroll();
      if (max <= 2) return 1;
      // One page per card step plus the clamped final page.
      return Math.ceil(max / step() - 0.02) + 1;
    }
    function pageLeft(page) {
      return Math.min(maxScroll(), Math.max(0, page) * step());
    }
    function activePage() {
      var max = maxScroll();
      if (max <= 2) return 0;
      if (track.scrollLeft >= max - 2) return pages - 1;
      return Math.min(pages - 1, Math.round(track.scrollLeft / step()));
    }
    function go(page) {
      var left = pageLeft(page);
      if (nativeSmooth) track.scrollTo({ left: left, behavior: behavior });
      else track.scrollLeft = left;
    }

    function buildDots() {
      var total = pageTotal();
      if (total === pages && dots.children.length) return;
      pages = total;
      dots.textContent = '';
      for (var i = 0; i < pages; i++) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'shots-dot';
        dot.setAttribute('aria-controls', 'shots-track');
        dot.setAttribute('aria-label', 'Часть ' + (i + 1) + ' из ' + pages);
        dot.addEventListener('click', (function (page) {
          return function () { go(page); };
        })(i));
        dots.appendChild(dot);
      }
    }

    function sync() {
      var active = activePage();
      for (var i = 0; i < dots.children.length; i++) {
        if (i === active) dots.children[i].setAttribute('aria-current', 'true');
        else dots.children[i].removeAttribute('aria-current');
      }
      // Compare pages, not raw pixels: the track's 4px snap padding parks
      // scrollLeft at 4 on the first page, so a pixel guard left the
      // previous arrow looking live at the very start.
      prev.disabled = active <= 0;
      next.disabled = track.scrollLeft >= maxScroll() - 2;
    }

    function refresh() {
      var scrollable = maxScroll() > 2;
      prev.hidden = !scrollable;
      next.hidden = !scrollable;
      dots.hidden = !scrollable;
      if (!scrollable) { pages = 0; return; }
      buildDots();
      sync();
    }

    prev.addEventListener('click', function () { go(activePage() - 1); });
    next.addEventListener('click', function () { go(activePage() + 1); });

    track.addEventListener('scroll', function () {
      if (frame) return;
      frame = requestAnimationFrame(function () { frame = 0; sync(); });
    }, { passive: true });

    track.addEventListener('keydown', function (e) {
      var page = activePage();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        go(page + (e.key === 'ArrowRight' ? 1 : -1));
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        go(e.key === 'Home' ? 0 : pages - 1);
      }
    });

    window.addEventListener('resize', refresh);
    refresh();
  }
})();
