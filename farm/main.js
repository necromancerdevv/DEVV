/* Слънчева Ферма — старт, управление с пръст/мишка, главен цикъл. */
(function (global) {
  'use strict';

  var D = global.GD, G = global.G, Scene = global.GScene, UI = global.GUI;
  var canvas;

  // --- Звук --------------------------------------------------------------
  var actx = null;
  var SOUNDS = {
    pop:   { f: 660, to: 990, d: 0.12, type: 'sine', v: 0.16 },
    plant: { f: 320, to: 420, d: 0.10, type: 'triangle', v: 0.12 },
    level: { f: 520, to: 1040, d: 0.35, type: 'sine', v: 0.2 },
    quest: { f: 440, to: 880, d: 0.25, type: 'square', v: 0.09 },
    tap:   { f: 240, to: 220, d: 0.06, type: 'sine', v: 0.07 }
  };

  function play(name) {
    if (!G.state || !G.state.sound) return;
    var s = SOUNDS[name];
    if (!s) return;
    try {
      if (!actx) actx = new (global.AudioContext || global.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = s.type;
      o.frequency.setValueAtTime(s.f, actx.currentTime);
      o.frequency.exponentialRampToValueAtTime(s.to, actx.currentTime + s.d);
      g.gain.setValueAtTime(s.v, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + s.d);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + s.d + 0.02);
    } catch (e) { /* без звук */ }
  }
  global.GSfx = { play: play };

  // --- Управление --------------------------------------------------------
  var pointers = {};
  var dragStart = null, dragged = false, pinchDist = 0;

  function bindInput() {
    canvas.addEventListener('pointerdown', function (ev) {
      canvas.setPointerCapture(ev.pointerId);
      pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      if (Object.keys(pointers).length === 1) {
        dragStart = { x: ev.clientX, y: ev.clientY, t: Date.now() };
        dragged = false;
      } else {
        pinchDist = twoFingerDist();
      }
    });

    canvas.addEventListener('pointermove', function (ev) {
      var p = pointers[ev.pointerId];
      if (!p) return;
      var dx = ev.clientX - p.x, dy = ev.clientY - p.y;
      p.x = ev.clientX; p.y = ev.clientY;
      var ids = Object.keys(pointers);
      if (ids.length >= 2) {
        var d = twoFingerDist();
        if (pinchDist && d) {
          var mid = twoFingerMid();
          Scene.zoomAt(d / pinchDist, mid.x, mid.y);
        }
        pinchDist = d;
        dragged = true;
        return;
      }
      if (dragStart) {
        if (Math.abs(ev.clientX - dragStart.x) > 8 || Math.abs(ev.clientY - dragStart.y) > 8) dragged = true;
        if (dragged) Scene.panBy(dx, dy);
      }
    });

    function release(ev) {
      var had = pointers[ev.pointerId];
      delete pointers[ev.pointerId];
      if (!had) return;
      if (Object.keys(pointers).length) { pinchDist = twoFingerDist(); return; }
      if (!dragged && dragStart && Date.now() - dragStart.t < 700) {
        var rect = canvas.getBoundingClientRect();
        var sx = ev.clientX - rect.left, sy = ev.clientY - rect.top;
        var obj = Scene.pick(sx, sy);
        if (obj) {
          play('tap');
          UI.tapObject(obj, ev.clientX, ev.clientY);
        }
      }
      dragStart = null;
      dragged = false;
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    canvas.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var rect = canvas.getBoundingClientRect();
      Scene.zoomAt(ev.deltaY > 0 ? 0.9 : 1.1, ev.clientX - rect.left, ev.clientY - rect.top);
    }, { passive: false });

    global.addEventListener('resize', function () { Scene.resize(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) G.save(true);
      else { G.refillOrders(false); UI.syncHUD(); }
    });
    global.addEventListener('pagehide', function () { G.save(true); });
  }

  function twoFingerDist() {
    var ids = Object.keys(pointers);
    if (ids.length < 2) return 0;
    var a = pointers[ids[0]], b = pointers[ids[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function twoFingerMid() {
    var ids = Object.keys(pointers);
    var a = pointers[ids[0]], b = pointers[ids[1]];
    var rect = canvas.getBoundingClientRect();
    return { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
  }

  // --- Какво се е случило, докато ни е нямало ---------------------------
  function welcomeBack(awaySec) {
    if (awaySec < 120) return;
    var ripe = 0, animals = 0, crafts = 0;
    for (var i = 0; i < G.state.plots.length; i++) if (G.plotState(i) === 'ripe') ripe++;
    for (var pen in D.PENS) animals += G.penReadyCount(pen);
    for (var b = 0; b < D.BUILDINGS.length; b++) crafts += G.buildingReady(D.BUILDINGS[b].id);
    var parts = [];
    if (ripe) parts.push(ripe + ' узрели ниви');
    if (animals) parts.push(animals + ' готови продукта');
    if (crafts) parts.push(crafts + ' готови стоки в цеховете');
    if (!parts.length) return;
    UI.toast('Докато те нямаше: ' + parts.join(', '), 'good');
  }

  // --- Чужди значки долу -------------------------------------------------
  // Хостингът може да сложи собствен надпис долу вдясно („Powered by Netlify").
  // Намираме всеки чужд фиксиран елемент, опрян в долния край, и вдигаме
  // лентата с толкова, колкото заема — иначе покрива бутоните.
  function avoidOverlays() {
    var gap = 0;
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n.id === 'app' || n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || n.tagName === 'LINK') continue;
      var cs = global.getComputedStyle(n);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
      var r = n.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.bottom > global.innerHeight - 130 && r.top < global.innerHeight) {
        gap = Math.max(gap, Math.min(96, global.innerHeight - r.top));
      }
    }
    document.documentElement.style.setProperty('--badge-gap', gap ? (gap + 6) + 'px' : '0px');
  }

  function watchOverlays() {
    avoidOverlays();
    // значката често се вмъква след първото рисуване
    setTimeout(avoidOverlays, 900);
    setTimeout(avoidOverlays, 3000);
    global.addEventListener('resize', avoidOverlays);
    if (global.MutationObserver) {
      new MutationObserver(avoidOverlays).observe(document.body, { childList: true });
    }
  }

  // --- Цикъл -------------------------------------------------------------
  var lastTick = 0;

  function loop(ts) {
    Scene.frame();
    if (ts - lastTick > 1000) {
      lastTick = ts;
      if (G.refillOrders(false)) G.touch();
      if (G.rescue()) UI.toast('Съседката донесе семена: +60 монети', 'good');
      UI.syncHUD();
      UI.reopen();
      G.save();
    }
    requestAnimationFrame(loop);
  }

  // --- Старт -------------------------------------------------------------
  function boot() {
    canvas = document.getElementById('scene');
    var hadSave = G.load();
    var away = G.sec() - (G.state.lastSeen || G.sec());
    G.syncQuestProgress();
    G.refillOrders(false);

    Scene.init(canvas);
    UI.init();
    bindInput();

    if (!hadSave) {
      UI.hint('Докосни кафява нива, за да засееш пшеница. Прибирай, щом над нивата изскочи балонче.');
    } else {
      welcomeBack(away);
    }

    G.save(true);
    watchOverlays();
    requestAnimationFrame(loop);

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* офлайн режимът е незадължителен */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
