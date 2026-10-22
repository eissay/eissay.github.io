/* Crisp Kitchen 3D — العارض ومخرج المراحل
 * يحوّل وصفة مشهد (scenes.json) إلى مطبخ كرتوني حي: قلاية تنزلق، أكل يقفز،
 * بخار يتصاعد، ترمومتر يفحص، ولقطة تقديم على صحن — مع تحكم كامل بالكاميرا.
 *
 * الواجهة:
 *   CC3D.open(container, sceneData, hooks) → controller | null (إن فشل WebGL)
 *   controller: next() prev() goTo(i) shake() dispose() · current index
 *   hooks: onStage(i, info) onReady() onError(msg) — كل الأزرار DOM من الخارج
 */
(function (global) {
  'use strict';
  var THREE = global.THREE, MODELS = global.CC3D_MODELS;
  if (!THREE || !MODELS) throw new Error('CC3D: dependencies missing');

  var RM = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches
    || global.__CC3D_FAST === 1; /* خطاف اختبارات headless: حركات لحظية حتمية */

  /* ── محرك تحريك مصغّر ── */
  var tweens = [];
  function tween(dur, update, done, ease) {
    if (RM) dur = 0;
    var tw = { t: 0, dur: dur, update: update, done: done, ease: ease || easeOutCubic, dead: false };
    tweens.push(tw);
    return tw;
  }
  function killTween(tw) { if (tw) tw.dead = true; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOutBack(t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function stepTweens(dt) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i];
      if (tw.dead) { tweens.splice(i, 1); continue; }
      tw.t += dt;
      var p = tw.dur <= 0 ? 1 : Math.min(tw.t / tw.dur, 1);
      tw.update(tw.ease(p), p);
      if (p >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
    }
  }

  /* ── كاميرا: إطارات مفتاحية لكل مرحلة ── */
  var CAM = {
    welcome: { pos: [5.2, 3.6, 6.4], tgt: [0.3, 0.9, 0.2] },
    prep:    { pos: [-4.6, 2.7, 4.3], tgt: [-2.6, 0.4, 0.9] },
    load:    { pos: [0.6, 3.1, 4.7], tgt: [0.4, 0.72, 1.0] },
    preheat: { pos: [2.9, 2.1, 4.6], tgt: [0.6, 1.2, 0.6] },
    cook:    { pos: [4.3, 3.1, 5.1], tgt: [0.3, 0.9, 0.5] },
    check:   { pos: [2.6, 3.5, 5.4], tgt: [0.5, 0.55, 1.4] },
    plate:   { pos: [-2.2, 2.5, 4.6], tgt: [-2.6, 0.5, 1.8] },
    serve:   { pos: [-3.4, 2.1, 3.7], tgt: [-2.6, 0.4, 1.8] }
  };

  function moveCam(camera, controls, key, dur) {
    var k = CAM[key];
    if (!k) return;
    if (moveCam.tw) killTween(moveCam.tw);
    var p0 = camera.position.clone(), t0 = controls.target.clone();
    var p1 = new THREE.Vector3().fromArray(k.pos), t1 = new THREE.Vector3().fromArray(k.tgt);
    moveCam.tw = tween(dur || (RM ? 0 : 1.2), function (e) {
      camera.position.lerpVectors(p0, p1, e);
      controls.target.lerpVectors(t0, t1, e);
    });
  }

  /* ── جسيمات: بخار + قلي ── */
  function softCircle(hex) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    var ctx = cv.getContext('2d');
    var g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    g.addColorStop(0, 'rgba(' + hex + ',0.75)');
    g.addColorStop(1, 'rgba(' + hex + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }

  function Particles(scene) {
    var steamTex = softCircle('245,240,230');
    var sizzleTex = softCircle('255,214,120');
    this.pool = [];
    this.scene = scene;
    this.spawnSteam = function (x, y, z) {
      if (RM || this.pool.length > 46) return;
      var mat = new THREE.SpriteMaterial({ map: steamTex, transparent: true, opacity: 0, depthWrite: false });
      var s = new THREE.Sprite(mat);
      s.position.set(x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.6);
      s.scale.setScalar(0.3);
      scene.add(s);
      var seed = Math.random() * 10;
      tween(2.2 + Math.random(), function (e, p) {
        s.position.y = y + p * 1.9;
        s.position.x += Math.sin(seed + p * 6) * 0.0016;
        s.scale.setScalar(0.3 + p * 0.85);
        mat.opacity = p < 0.25 ? p * 2.6 : 0.65 * (1 - (p - 0.25) / 0.75);
      }, function () { scene.remove(s); mat.dispose(); });
    };
    this.spawnSizzle = function (x, y, z) {
      if (RM || this.pool.length > 46) return;
      var mat = new THREE.SpriteMaterial({ map: sizzleTex, transparent: true, opacity: 0.9, depthWrite: false });
      var s = new THREE.Sprite(mat);
      s.position.set(x + (Math.random() - 0.5) * 1.2, y + 0.1, z + (Math.random() - 0.5) * 1.0);
      s.scale.setScalar(0.09);
      scene.add(s);
      var vx = (Math.random() - 0.5) * 0.5, vz = (Math.random() - 0.5) * 0.4, vy = 0.9 + Math.random() * 0.7;
      tween(0.5, function (e, p) {
        s.position.x += vx * 0.016; s.position.z += vz * 0.016;
        s.position.y += vy * 0.016 * (1 - p);
        mat.opacity = 0.9 * (1 - p);
      }, function () { scene.remove(s); mat.dispose(); });
    };
  }

  /* ── توزيع القطع في السلة ── */
  function grid(count, w, d) {
    var cols = Math.max(1, Math.ceil(Math.sqrt(count * (w / d))));
    var rows = Math.ceil(count / cols);
    var out = [];
    for (var i = 0; i < count; i++) {
      var r = (i / cols) | 0, c = i % cols;
      out.push({
        x: (cols === 1 ? 0 : (c / (cols - 1) - 0.5)) * (w - 0.45) + (((i * 37) % 7) - 3) * 0.02,
        z: (rows === 1 ? 0 : (r / (rows - 1) - 0.5)) * (d - 0.4) + (((i * 53) % 7) - 3) * 0.02
      });
    }
    return out;
  }

  /* ═══════════════ الفتح: بناء المشهد كاملاً ═══════════════ */
  function open(container, data, hooks) {
    hooks = hooks || {};
    try {
      var probe = document.createElement('canvas');
      if (!probe.getContext('webgl2') && !probe.getContext('webgl')) throw new Error('no-webgl');
    } catch (e) {
      if (hooks.onError) hooks.onError('WebGL غير متاح');
      return null;
    }

    var renderer, scene, camera, controls, particles, fryer, foodPieces = [], boardPieces = [];
    var stageIndex = 0, heat = 0, doneT = 0, rafId = 0, alive = true, last = 0;
    var clockAccum = 0, steamAccum = 0, sizzleAccum = 0, plateSpot = null;
    var thermometer = null, garnish = null, spatula = null;
    var camTween = null, basketTween = null, heatTween = null, lastClockSec = -1;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    MODELS.init(renderer.capabilities.isWebGL2);
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.75));
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 420);
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label',
      'Interactive 3D cooking simulation: ' + (data.label || 'food') + ' cooking in an air fryer. Drag to rotate 360 degrees, pinch or scroll to zoom, two fingers to pan.');
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfdf3dd);
    camera = new THREE.PerspectiveCamera(38, (container.clientWidth || 640) / (container.clientHeight || 420), 0.1, 60);
    camera.position.fromArray(CAM.welcome.pos);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.fromArray(CAM.welcome.tgt);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.6;
    controls.maxDistance = 13;
    controls.maxPolarAngle = Math.PI / 2 - 0.07;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.autoRotate = !RM;
    controls.autoRotateSpeed = 1.1;
    controls.update();

    /* إضاءة كرتونية: قبة دافئة + اتجاهان */
    scene.add(new THREE.HemisphereLight(0xfff4de, 0xd9b98a, 1.0));
    var sun = new THREE.DirectionalLight(0xffffff, 0.75);
    sun.position.set(4, 7, 5);
    scene.add(sun);
    var rim = new THREE.DirectionalLight(0xffe3b8, 0.35);
    rim.position.set(-5, 4, -4);
    scene.add(rim);

    scene.add(MODELS.environment());
    fryer = MODELS.airfryer();
    fryer.root.position.set(0.4, 0.02, 0.3);
    scene.add(fryer.root);
    particles = new Particles(scene);

    /* لوح التقطيع والقطع الخام */
    var board = MODELS.props.board();
    board.position.set(-2.7, 0.02, 0.7);
    board.rotation.y = 0.35;
    scene.add(board);

    var plate = MODELS.props.plate();
    plate.position.set(-2.8, 0.02, 2.5);
    scene.add(plate);

    var spray = MODELS.props.oilSpray();
    spray.position.set(2.9, 0.02, 2.1);
    scene.add(spray);
    var shaker = MODELS.props.shaker();
    shaker.position.set(3.4, 0.02, 1.4);
    scene.add(shaker);
    var timerProp = MODELS.props.timer();
    timerProp.position.set(2.4, 0.02, 2.8);
    timerProp.visible = false;
    scene.add(timerProp);

    thermometer = MODELS.props.thermometer();
    thermometer.position.set(1.5, 0.02, 2.3);
    thermometer.visible = false;
    scene.add(thermometer);

    spatula = MODELS.props.spatula();
    spatula.position.set(-1.9, 0.02, 2.0);
    spatula.rotation.y = -0.8;
    spatula.visible = false;
    scene.add(spatula);

    /* قطع الطعام — تبدأ على لوح التقطيع */
    var def = MODELS.foods[data.food] || MODELS.foods.morsels;
    var spots = grid(data.count, fryer.cavity.w, fryer.cavity.d);
    var boardSpots = grid(data.count, 1.05, 0.6);
    var pieceScale = data.count >= 10 ? 0.78 : 0.95;
    for (var i = 0; i < data.count; i++) {
      var piece = def.build(i);
      piece.scale.setScalar(pieceScale);
      /* على اللوح أولاً */
      var bp = boardSpots[i];
      piece.position.set(-2.7 + bp.x, 0.09, 0.7 + bp.z);
      piece.rotation.y = (i * 1.37) % (Math.PI * 2);
      scene.add(piece);
      foodPieces.push(piece);
    }

    /* ═══════════════ المراحل ═══════════════ */
    var fmtTime = function (sec) {
      var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    };

    var STAGES = [
      { id: 'welcome', title: 'Welcome to your 3D kitchen',
        tip: 'Drag to orbit 360° · pinch or scroll to zoom · two fingers to pan',
        chip: data.label,
        enter: function () {
          controls.autoRotate = !RM;
          moveCam(camera, controls, 'welcome');
          fryer.setDisplay('--');
          fryer.setHeat(0);
          openBasket(0);
          ensureOnBoard();
        } },
      { id: 'prep', title: 'Ingredients ready',
        tip: data.tip,
        chip: data.count + '× ' + (data.label || 'pieces'),
        enter: function () {
          controls.autoRotate = false;
          moveCam(camera, controls, 'prep');
          openBasket(0);
          fryer.setHeat(0);
          ensureOnBoard();
        } },
      { id: 'load', title: 'Into the basket',
        tip: 'A single layer cooks evenly — no piling.',
        chip: (data.tempF ? data.tempF + '°F / ' + data.tempC + '°C' : ''),
        enter: function () {
          controls.autoRotate = false;
          moveCam(camera, controls, 'load');
          fryer.setDisplay(data.tempF ? data.tempF + '°F' : 'LOAD');
          /* فتح السلة ثم إسقاط القطع واحدة واحدة */
          openBasket(1, function () {
            /* إعادة التعليلق من أي حالة سابقة (رجوع من لقطات لاحقة) */
            foodPieces.forEach(function (piece) { scene.attach(piece); });
            var target = new THREE.Vector3();
            foodPieces.forEach(function (piece, k) {
              target.set(spots[k].x, fryer.rackY, spots[k].z);
              fryer.basket.localToWorld(target);
              var p0 = piece.position.clone();
              tween(RM ? 0 : 0.5, function (e) {
                piece.position.lerpVectors(p0, target, e);
                piece.position.y = p0.y + (target.y - p0.y) * e + Math.sin(e * Math.PI) * 0.6;
              }, function () {
                fryer.basket.attach(piece);
              }, easeOutBack);
            });
          });
        } },
      { id: 'preheat', title: 'Preheating',
        tip: 'Preheating takes 2–3 minutes — it matters for crispiness.',
        chip: data.tempF ? data.tempF + '°F / ' + data.tempC + '°C' : '',
        enter: function () {
          moveCam(camera, controls, 'preheat');
          openBasket(0);
          ensureInBasket();
          if (heatTween) killTween(heatTween);
          heatTween = tween(RM ? 0 : 1.2, function (e) { fryer.setHeat(e); });
          if (data.tempF) fryer.setDisplay(data.tempF + '°F', 'PREHEAT');
        } },
      { id: 'cook', title: 'Cooking',
        tip: data.tip,
        chip: data.timeLo && data.timeHi ? data.timeLo + '–' + data.timeHi + ' min · ' + data.tempF + '°F' : '',
        shake: true,
        enter: function () {
          moveCam(camera, controls, 'cook');
          controls.autoRotate = false;
          ensureInBasket();
          openBasket(0.45); /* مفتوحة نصفياً: الأكل والبخار مرئيان أثناء الطبخ */
          timerProp.visible = true;
          lastClockSec = -1;
          var t0 = doneT;
          tween(RM ? 0 : 12, function (e, p) {
            doneT = t0 + (0.8 - t0) * e;
            applyDone(doneT);
            if (!RM) {
              var remain = Math.max(0, data.timeLo * 60 * (1 - p));
              var sec = Math.round(remain);
              if (sec !== lastClockSec) {
                lastClockSec = sec;
                fryer.setDisplay(data.tempF ? data.tempF + '°F' : 'COOK', fmtTime(remain));
              }
              steamAccum += 0.016;
              if (steamAccum > 0.28) {
                steamAccum = 0;
                particles.spawnSteam(0.4, 1.15, 0.3);
              }
              sizzleAccum += 0.016;
              if (sizzleAccum > 0.5) {
                sizzleAccum = 0;
                particles.spawnSizzle(0.4, 0.95, 0.3);
              }
            }
          });
        },
        exit: function () { timerProp.visible = false; } },
      { id: 'check', title: 'Check the internal temp',
        tip: data.internalF ? 'The number that ends the cook is the thermometer, not the clock.' : 'Look for golden color and a tender center.',
        chip: data.internalF ? data.internalF + '°F / ' + data.internalC + '°C internal' : '',
        enter: function () {
          moveCam(camera, controls, 'check');
          fryer.setDisplay('DONE', fmtTime(0));
          if (heatTween) killTween(heatTween);
          fryer.setHeat(0);
          ensureInBasket();
          openBasket(1, function () {
            applyDone(0.92);
            doneT = 0.92;
            if (data.internalF) {
              thermometer.visible = true;
              thermometer.position.set(1.55, 0.02, 2.6);
              thermometer.rotation.y = -0.45;
              thermometer.userData.setTemp(data.internalF + '°F');
              var ts = thermometer.scale.x;
              thermometer.scale.setScalar(ts * 1.15 * 0.2);
              tween(RM ? 0 : 0.45, function (e) { thermometer.scale.setScalar(ts * 1.15 * (0.2 + 0.8 * e)); }, null, easeOutBack);
            }
          });
          applyDone(0.92);
          doneT = 0.92;
        },
        exit: function () { thermometer.visible = false; } },
      { id: 'plate', title: 'Plating',
        tip: 'Rest it, plate it — the best part.',
        chip: '',
        enter: function () {
          moveCam(camera, controls, 'plate');
          fryer.setBasket(1); /* السلة تبقى مفتوحة */
          applyDone(0.92); doneT = 0.92; /* حتى مع القفز المباشر لهذه المرحلة */
          spatula.visible = true;
          spatula.scale.setScalar(0.2);
          tween(RM ? 0 : 0.4, function (e) { spatula.scale.setScalar(0.2 + 0.8 * e); }, null, easeOutBack);
          foodPieces.forEach(function (piece, k) {
            tween(RM ? 0 : 0.4 + k * 0.14, function () { /* انتظار الدور */ }, function () {
              scene.attach(piece);
              var p0 = piece.position.clone();
              var target = new THREE.Vector3(-2.8 + (((k * 41) % 9) - 4) * 0.13, 0.24, 2.5 + (((k * 29) % 7) - 3) * 0.11);
              tween(RM ? 0 : 0.75, function (e) {
                piece.position.lerpVectors(p0, target, e);
                piece.position.y = p0.y + (target.y - p0.y) * e + Math.sin(e * Math.PI) * 0.9;
              }, null, easeInOut);
            });
          });
          tween(RM ? 0 : 0.4 + foodPieces.length * 0.14 + 0.5, function () {}, function () {
            if (!garnish) {
              garnish = MODELS.props.garnish();
              garnish.position.set(-2.4, 0.02, 2.15);
              scene.add(garnish);
            }
            garnish.visible = true;
            var gs = garnish.scale.x;
            garnish.scale.setScalar(gs * 0.2);
            tween(RM ? 0 : 0.4, function (e) { garnish.scale.setScalar(gs * (0.2 + 0.8 * e)); }, null, easeOutBack);
          });
        },
        exit: function () { spatula.visible = false; } },
      { id: 'serve', title: 'Serve & enjoy',
        tip: data.defaults ? 'Typical settings shown — your recipe card above has the specifics.' : 'From this recipe — exact times in the chart above.',
        chip: 'Enjoy!',
        enter: function () {
          moveCam(camera, controls, 'serve');
          controls.autoRotate = !RM;
          controls.autoRotateSpeed = 0.9;
        } }
    ];

    /* نضج موحّد على كل القطع */
    function applyDone(t) {
      foodPieces.forEach(function (p) { MODELS.applyDoneness(p, t); });
    }

    /* إصلاح الحالة عند القفز بين المراحل بالأزرار (أي اتجاه) */
    function ensureOnBoard() {
      foodPieces.forEach(function (piece, k) {
        if (piece.parent !== scene) scene.attach(piece);
        var bp = boardSpots[k];
        piece.position.set(-2.7 + bp.x, 0.09, 0.7 + bp.z);
        piece.rotation.set(0, (k * 1.37) % (Math.PI * 2), 0);
      });
      if (garnish) garnish.visible = false;
      doneT = 0;
      applyDone(0);
    }
    function ensureInBasket() {
      foodPieces.forEach(function (piece, k) {
        if (piece.parent !== fryer.basket) {
          var target = new THREE.Vector3(spots[k].x, fryer.rackY, spots[k].z);
          fryer.basket.localToWorld(target);
          piece.position.copy(target);
          piece.rotation.set(0, (k * 1.37) % (Math.PI * 2), 0);
          fryer.basket.attach(piece);
        }
      });
      if (garnish) garnish.visible = false;
    }

    /* فتح/غلق السلة بحركة واحدة غير متعارضة */
    function openBasket(t, done) {
      if (basketTween) killTween(basketTween);
      var from = basketPos();
      basketTween = tween(RM ? 0 : 0.7, function (e) {
        fryer.setBasket(from + (t - from) * e);
      }, done);
    }
    function basketPos() {
      return (fryer.basket.position.z - 0.35) / 1.55;
    }

    /* ── قلب السلة (زر تفاعلي أثناء الطبخ) ── */
    function shake() {
      if (stageIndex !== 4) return;
      var b = fryer.basket;
      tween(RM ? 0 : 0.7, function (e, p) {
        b.rotation.z = Math.sin(p * Math.PI * 6) * 0.06 * (1 - p);
      }, function () { b.rotation.z = 0; });
      foodPieces.forEach(function (piece) {
        var p0y = piece.position.y;
        tween(RM ? 0 : 0.55, function (e, p) {
          piece.rotation.z = Math.sin(p * Math.PI) * Math.PI;
          piece.position.y = p0y + Math.sin(p * Math.PI) * 0.12;
        }, function () { piece.rotation.z = 0; piece.position.y = p0y; });
      });
      for (var s = 0; s < 6; s++) particles.spawnSizzle(0.4, 1.0, 0.3);
    }

    /* ── التنقل ── */
    function enterStage(i) {
      if (!alive) return;
      var prev = STAGES[stageIndex];
      if (prev && prev.exit) prev.exit();
      stageIndex = Math.max(0, Math.min(i, STAGES.length - 1));
      STAGES[stageIndex].enter();
      if (hooks.onStage) hooks.onStage(stageIndex, STAGES[stageIndex], STAGES.length);
    }
    enterStage(0);

    /* ── حلقة الرسم ── */
    function loop(ts) {
      if (!alive) return;
      rafId = requestAnimationFrame(loop);
      var dt = Math.min((ts - last) / 1000 || 0.016, 0.05);
      last = ts;
      stepTweens(dt);
      controls.update();
      renderer.render(scene, camera);
    }
    rafId = requestAnimationFrame(loop);

    function onResize() {
      if (!alive) return;
      var w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    global.addEventListener('resize', onResize);

    /* ── التنظيف الكامل ── */
    function dispose() {
      alive = false;
      cancelAnimationFrame(rafId);
      global.removeEventListener('resize', onResize);
      controls.dispose();
      scene.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      tweens.length = 0;
    }

    return {
      next: function () { enterStage(stageIndex + 1); },
      prev: function () { enterStage(stageIndex - 1); },
      goTo: function (i) { enterStage(i); },
      shake: shake,
      get current() { return stageIndex; },
      get count() { return STAGES.length; },
      _pieces: function () { return foodPieces; },
      dispose: dispose
    };
  }

  global.CC3D = { open: open };
})(window);
