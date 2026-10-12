// Aniplace hero: interactive three.js highlight — floating hearts + sparkles.
// Pointer moves the camera (parallax), clicks burst new hearts.
// Scroll-reveal + counters always run, even offline / reduced-motion / WebGL failure.
(function () {
  'use strict';

  initReveal();
  initCounters();

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

    var palette = [0xff3d5e, 0xff7597, 0xffb3c1, 0xffd166, 0xe11d48];
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
    var points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xff8fa3, size: 0.22, transparent: true, opacity: 0.85 }));
    group.add(points);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    var dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(6, 10, 8);
    scene.add(dir);
    var pink = new THREE.PointLight(0xff3d5e, 12, 40);
    pink.position.set(-6, -2, 6);
    scene.add(pink);

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
})();
