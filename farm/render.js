/* Слънчева Ферма — изометрична сцена: терен, ниви, кошари, цехове и анимации. */
(function (global) {
  'use strict';

  var D = global.GD;
  var TW = 96, TH = 48;            // размер на изометрична плочка
  var canvas, ctx, dpr = 1;
  var cam = { x: 0, y: 0, z: 0.8 };
  var viewW = 0, viewH = 0;
  var tileMap = {};                 // "x,y" -> обект
  var imgs = {};
  var startedAt = performance.now();

  function img(id) {
    if (!imgs[id]) {
      var im = new Image();
      im.src = global.GIcon.url(id, 96);
      imgs[id] = im;
    }
    return imgs[id];
  }

  function init(cv) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    buildTileMap();
    buildWilderness();
    resize();
    // Стартов изглед: центриран върху нивите, малко по-нагоре заради лентите.
    cam.z = clamp(viewW / 560, 0.6, 1.1);
    cam.x = 40; cam.y = 250;
    ['wheat', 'corn', 'carrot', 'tomato', 'sunflower', 'strawberry', 'pumpkin',
      'egg', 'milk', 'wool', 'honey', 'feed', 'flour', 'bread', 'butter', 'cheese',
      'cake', 'jam', 'yarn', 'lock', 'plus', 'coin'].forEach(img);
  }

  // Дървета и храсти извън стопанството, за да не е гола ливадата наоколо.
  var WILD = [];
  function buildWilderness() {
    WILD = [];
    var pad = 9;
    for (var y = -pad; y < D.WORLD.h + pad; y++) {
      for (var x = -pad; x < D.WORLD.w + pad; x++) {
        var inside = x >= -1 && y >= -1 && x <= D.WORLD.w && y <= D.WORLD.h;
        if (inside) continue;
        var r = hash(x * 3 + 11, y * 5 + 7);
        if (r > 0.86) WILD.push({ kind: 'tree', x: x, y: y });
        else if (r > 0.74) WILD.push({ kind: 'bush', x: x, y: y });
      }
    }
  }

  function buildTileMap() {
    tileMap = {};
    D.PLOT_SPOTS.forEach(function (p, i) {
      tileMap[p.x + ',' + p.y] = { type: 'plot', index: i, x: p.x, y: p.y, w: 1, h: 1 };
    });
    D.STRUCTURES.forEach(function (s) {
      var obj = { type: s.kind, id: s.id, x: s.x, y: s.y, w: 2, h: 2 };
      for (var dx = 0; dx < 2; dx++) for (var dy = 0; dy < 2; dy++) {
        tileMap[(s.x + dx) + ',' + (s.y + dy)] = obj;
      }
    });
  }

  function resize() {
    dpr = Math.min(2.5, global.devicePixelRatio || 1);
    viewW = canvas.clientWidth;
    viewH = canvas.clientHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function worldToScreenRaw(wx, wy) {
    return { x: (wx - wy) * TW / 2, y: (wx + wy) * TH / 2 };
  }
  function worldToScreen(wx, wy) {
    var p = worldToScreenRaw(wx, wy);
    return { x: (p.x - cam.x) * cam.z + viewW / 2, y: (p.y - cam.y) * cam.z + viewH / 2 };
  }
  function screenToWorld(sx, sy) {
    var x = (sx - viewW / 2) / cam.z + cam.x;
    var y = (sy - viewH / 2) / cam.z + cam.y;
    return { x: (y / TH + x / TW), y: (y / TH - x / TW) };
  }

  function pick(sx, sy) {
    var w = screenToWorld(sx, sy);
    var tx = Math.floor(w.x), ty = Math.floor(w.y);
    // Сградите са високи: проверяваме и една-две плочки назад.
    for (var back = 0; back <= 2; back++) {
      var hit = tileMap[(tx - back) + ',' + (ty - back)];
      if (hit && (back === 0 || hit.type !== 'plot')) return hit;
    }
    return null;
  }

  function panBy(dx, dy) {
    cam.x -= dx / cam.z;
    cam.y -= dy / cam.z;
    clampCam();
  }
  function zoomAt(factor, sx, sy) {
    var before = screenToWorld(sx, sy);
    cam.z = clamp(cam.z * factor, 0.4, 1.9);
    var after = screenToWorld(sx, sy);
    var pb = worldToScreenRaw(before.x, before.y), pa = worldToScreenRaw(after.x, after.y);
    cam.x += pb.x - pa.x;
    cam.y += pb.y - pa.y;
    clampCam();
  }
  function clampCam() {
    var a = worldToScreenRaw(0, D.WORLD.h);
    var b = worldToScreenRaw(D.WORLD.w, 0);
    var top = worldToScreenRaw(0, 0).y - 120;
    var bottom = worldToScreenRaw(D.WORLD.w, D.WORLD.h).y + 120;
    cam.x = clamp(cam.x, a.x, b.x);
    cam.y = clamp(cam.y, top, bottom);
  }
  function focusOn(wx, wy) {
    var p = worldToScreenRaw(wx, wy);
    cam.x = p.x; cam.y = p.y;
    clampCam();
  }

  // --- Примитиви ---------------------------------------------------------
  function diamond(cx, cy, w, h) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy);
    ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy);
    ctx.closePath();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = clamp(((n >> 16) & 255) + amt, 0, 255);
    var g = clamp(((n >> 8) & 255) + amt, 0, 255);
    var b = clamp((n & 255) + amt, 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function shadow(cx, cy, w, h) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#2c3a1c';
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // --- Терен -------------------------------------------------------------
  var GRASS = ['#8ec951', '#85c24b', '#95d058'];

  // Разбърква номера на плочката, за да няма райета в тревата.
  // Math.imul пази 32-битова аритметика — с обикновено умножение долните
  // битове изчезват в плаваща запетая и хешът връща почти винаги нула.
  function hash(x, y) {
    var n = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function visibleTiles() {
    var c = [screenToWorld(0, 0), screenToWorld(viewW, 0), screenToWorld(0, viewH), screenToWorld(viewW, viewH)];
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < 4; i++) {
      minX = Math.min(minX, c[i].x); maxX = Math.max(maxX, c[i].x);
      minY = Math.min(minY, c[i].y); maxY = Math.max(maxY, c[i].y);
    }
    return {
      x0: Math.floor(minX) - 1, x1: Math.ceil(maxX) + 1,
      y0: Math.floor(minY) - 1, y1: Math.ceil(maxY) + 1
    };
  }

  function drawGround() {
    // Тревата покрива целия екран, не само стопанството.
    var v = visibleTiles();
    for (var y = v.y0; y <= v.y1; y++) {
      for (var x = v.x0; x <= v.x1; x++) {
        var p = worldToScreen(x + 0.5, y + 0.5);
        if (p.x < -TW * cam.z || p.x > viewW + TW * cam.z) continue;
        if (p.y < -TH * cam.z * 2 || p.y > viewH + TH * cam.z * 2) continue;
        var edge = (x < 0 || y < 0 || x >= D.WORLD.w || y >= D.WORLD.h);
        var r = hash(x, y);
        var tone = GRASS[Math.floor(r * 3)];
        ctx.fillStyle = edge ? shade(tone, -16) : tone;
        diamond(p.x, p.y, TW * cam.z + 1, TH * cam.z + 1);
        ctx.fill();
        if (r > 0.86) {
          ctx.strokeStyle = 'rgba(60,110,40,.25)';
          ctx.lineWidth = 2 * cam.z;
          ctx.beginPath();
          ctx.moveTo(p.x - 8 * cam.z, p.y + 3 * cam.z);
          ctx.lineTo(p.x - 4 * cam.z, p.y - 3 * cam.z);
          ctx.moveTo(p.x + 6 * cam.z, p.y + 5 * cam.z);
          ctx.lineTo(p.x + 9 * cam.z, p.y - 1 * cam.z);
          ctx.stroke();
        }
      }
    }
  }

  // --- Ниви --------------------------------------------------------------
  function drawPlot(obj, t) {
    var G = global.G;
    var p = worldToScreen(obj.x + 0.5, obj.y + 0.5);
    var z = cam.z;
    var st = G.plotState(obj.index);

    if (st === 'locked') {
      // Необработен парцел: буренясал, с катинар.
      ctx.fillStyle = '#6f9a48';
      diamond(p.x, p.y, TW * z * 0.94, TH * z * 0.94);
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,64,36,.75)';
      ctx.lineWidth = 2.5 * z;
      ctx.setLineDash([9 * z, 7 * z]);
      diamond(p.x, p.y, TW * z * 0.94, TH * z * 0.94);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#5d8a3c';
      for (var wd = 0; wd < 4; wd++) {
        var wr = hash(obj.x * 4 + wd, obj.y * 7);
        ctx.beginPath();
        ctx.ellipse(p.x + (wr - 0.5) * TW * z * 0.55, p.y + (hash(wd, obj.x) - 0.5) * TH * z * 0.5,
          5 * z, 3.4 * z, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Катинар само на следващия парцел за разчистване — иначе екранът се задръства.
      if (obj.index === G.nextLockedPlot()) {
        ctx.fillStyle = 'rgba(255,247,230,.95)';
        ctx.beginPath();
        ctx.arc(p.x, p.y - 10 * z, 13 * z, 0, Math.PI * 2);
        ctx.fill();
        var lk = img('lock');
        if (lk.complete) ctx.drawImage(lk, p.x - 10 * z, p.y - 20 * z, 20 * z, 20 * z);
      }
      return;
    }

    // Почва с очертан кант, за да се различават съседните ниви
    ctx.fillStyle = '#6b4526';
    diamond(p.x, p.y, TW * z * 0.96, TH * z * 0.96);
    ctx.fill();
    ctx.fillStyle = '#8b5f38';
    diamond(p.x, p.y - 2 * z, TW * z * 0.86, TH * z * 0.86);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,58,30,.55)';
    ctx.lineWidth = 2 * z;
    for (var f = -1; f <= 1; f++) {
      ctx.beginPath();
      ctx.moveTo(p.x - TW * z * 0.4 + f * 9 * z, p.y - 2 * z + f * 5 * z);
      ctx.lineTo(p.x + f * 9 * z, p.y - 2 * z + TH * z * 0.4 + f * 5 * z);
      ctx.stroke();
    }

    if (st === 'empty') return;

    var crop = D.cropById(S().plots[obj.index].crop);
    var prog = G.plotProgress(obj.index);
    var stage = prog >= 1 ? 1 : prog;
    var spots = [[-0.22, -0.05], [0.22, -0.05], [0, 0.12], [-0.22, 0.2], [0.22, 0.2]];
    for (var i = 0; i < spots.length; i++) {
      var ox = spots[i][0] * TW * z, oy = spots[i][1] * TH * z;
      drawPlant(p.x + ox, p.y + oy + 4 * z, crop, stage, z, t + i * 480);
    }

    if (st === 'ripe') {
      bubble(p.x, p.y - 40 * z - Math.sin(t / 420) * 4 * z, crop.item, z);
    } else {
      var w = 34 * z;
      ctx.fillStyle = 'rgba(20,30,10,.45)';
      roundRect(p.x - w / 2, p.y - 26 * z, w, 6 * z, 3 * z);
      ctx.fill();
      ctx.fillStyle = '#ffd54a';
      roundRect(p.x - w / 2, p.y - 26 * z, Math.max(2 * z, w * prog), 6 * z, 3 * z);
      ctx.fill();
    }
  }

  function drawPlant(x, y, crop, stage, z, t) {
    var st = crop.plant;
    var h = (10 + 22 * stage) * z;
    var sway = Math.sin(t / 900) * 1.6 * z * stage;
    ctx.save();
    ctx.translate(x, y);

    if (stage < 0.28) {
      // Кълн
      ctx.strokeStyle = '#6fb03c';
      ctx.lineWidth = 2.4 * z;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(sway, -h * 0.5);
      ctx.stroke();
      ctx.fillStyle = '#7cc24a';
      ctx.beginPath();
      ctx.ellipse(sway - 3 * z, -h * 0.5, 4 * z, 2.6 * z, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(sway + 3 * z, -h * 0.55, 4 * z, 2.6 * z, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.strokeStyle = st.stem;
    ctx.lineWidth = 2.6 * z;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 0.5, -h * 0.6, sway, -h);
    ctx.stroke();

    var ripe = stage > 0.92;
    if (st.style === 'grain') {
      ctx.fillStyle = ripe ? st.head : '#a9c85a';
      for (var i = 0; i < 3; i++) {
        var yy = -h + i * 4 * z;
        ctx.beginPath();
        ctx.ellipse(sway - 3 * z, yy + 4 * z, 2.6 * z, 4 * z, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(sway + 3 * z, yy + 4 * z, 2.6 * z, 4 * z, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (st.style === 'tall') {
      ctx.fillStyle = '#4f9e3a';
      ctx.beginPath();
      ctx.ellipse(sway - 6 * z, -h * 0.62, 7 * z, 3 * z, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(sway + 6 * z, -h * 0.48, 7 * z, 3 * z, 0.5, 0, Math.PI * 2); ctx.fill();
      if (stage > 0.55) {
        ctx.fillStyle = ripe ? st.head : '#b7d05a';
        ctx.beginPath();
        ctx.ellipse(sway + 3 * z, -h * 0.75, 3.4 * z, 7 * z, 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (st.style === 'sun') {
      ctx.fillStyle = '#4f9e3a';
      ctx.beginPath();
      ctx.ellipse(sway - 6 * z, -h * 0.5, 6 * z, 3.4 * z, -0.5, 0, Math.PI * 2); ctx.fill();
      if (stage > 0.5) {
        var r = (ripe ? 6 : 4) * z;
        ctx.fillStyle = st.head;
        for (var k = 0; k < 8; k++) {
          var a = k * Math.PI / 4;
          ctx.beginPath();
          ctx.ellipse(sway + Math.cos(a) * r, -h + Math.sin(a) * r * 0.8, 3 * z, 2 * z, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#6b4526';
        ctx.beginPath();
        ctx.ellipse(sway, -h, r * 0.62, r * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (st.style === 'leafy') {
      ctx.fillStyle = '#4a9a37';
      for (var l = -1; l <= 1; l++) {
        ctx.beginPath();
        ctx.ellipse(sway + l * 5 * z, -h + 2 * z, 3 * z, 7 * z, l * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      if (ripe) {
        ctx.fillStyle = st.head;
        ctx.beginPath();
        ctx.moveTo(sway - 3.5 * z, 0);
        ctx.lineTo(sway + 3.5 * z, 0);
        ctx.lineTo(sway, 7 * z);
        ctx.closePath();
        ctx.fill();
      }
    } else if (st.style === 'bush') {
      ctx.fillStyle = '#3f8f3a';
      ctx.beginPath();
      ctx.ellipse(sway, -h * 0.75, 9 * z, 7 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      if (stage > 0.6) {
        ctx.fillStyle = ripe ? st.head : '#9fc25a';
        ctx.beginPath(); ctx.arc(sway - 4 * z, -h * 0.7, 3.2 * z, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sway + 4 * z, -h * 0.62, 3.2 * z, 0, Math.PI * 2); ctx.fill();
      }
    } else { // vine
      ctx.fillStyle = '#3f8a38';
      ctx.beginPath();
      ctx.ellipse(sway - 5 * z, -h * 0.4, 8 * z, 4.5 * z, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(sway + 6 * z, -h * 0.25, 7 * z, 4 * z, 0.25, 0, Math.PI * 2); ctx.fill();
      if (stage > 0.5) {
        ctx.fillStyle = ripe ? st.head : '#a8c05a';
        ctx.beginPath();
        ctx.ellipse(sway + 2 * z, -2 * z, 7 * z * stage, 5.5 * z * stage, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function bubble(x, y, itemId, z) {
    var r = 17 * z;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd54a';
    ctx.lineWidth = 3 * z;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 5 * z, y + r - 2 * z);
    ctx.lineTo(x, y + r + 6 * z);
    ctx.lineTo(x + 5 * z, y + r - 2 * z);
    ctx.closePath();
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    var im = img(itemId);
    if (im.complete && im.naturalWidth) ctx.drawImage(im, x - r * 0.72, y - r * 0.72, r * 1.44, r * 1.44);
    ctx.restore();
  }

  // --- Сгради ------------------------------------------------------------
  function structBase(obj) {
    return worldToScreen(obj.x + 1, obj.y + 1);
  }

  function drawShed(cx, cy, z, opt) {
    var w = TW * z * 1.55, h = TH * z * 1.55;
    var wallH = (opt.wallH || 34) * z;
    shadow(cx, cy + 4 * z, w * 0.5, h * 0.32);

    // Основа
    ctx.fillStyle = opt.base || '#b8a07c';
    diamond(cx, cy, w, h);
    ctx.fill();

    var top = cy - wallH;
    // Ляв и десен зид
    ctx.fillStyle = shade(opt.wall, -28);
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy); ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx, cy + h / 2 - wallH); ctx.lineTo(cx - w / 2, cy - wallH);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = opt.wall;
    ctx.beginPath();
    ctx.moveTo(cx + w / 2, cy); ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx, cy + h / 2 - wallH); ctx.lineTo(cx + w / 2, cy - wallH);
    ctx.closePath(); ctx.fill();

    // Четирискатен покрив: четири ската, събрани във връх над центъра.
    var rise = (opt.rise || 26) * z;
    var rw = w * 1.16, rh = h * 1.16;
    var N = [cx, top - rh / 2], S = [cx, top + rh / 2];
    var W = [cx - rw / 2, top], E = [cx + rw / 2, top];
    var A = [cx, top - rise];

    function slope(a, b, fill) {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(A[0], A[1]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
    slope(N, W, shade(opt.roof, -34));
    slope(N, E, shade(opt.roof, -10));
    slope(W, S, shade(opt.roof, -20));
    slope(E, S, shade(opt.roof, 18));
    ctx.strokeStyle = shade(opt.roof, -42);
    ctx.lineWidth = 1.6 * z;
    ctx.beginPath();
    ctx.moveTo(W[0], W[1]); ctx.lineTo(S[0], S[1]); ctx.lineTo(E[0], E[1]);
    ctx.stroke();

    // Врата
    ctx.fillStyle = opt.door || '#6d4a28';
    ctx.beginPath();
    ctx.moveTo(cx - 3 * z, cy + h / 2 - 2 * z);
    ctx.lineTo(cx + 14 * z, cy + h / 2 - 10 * z);
    ctx.lineTo(cx + 14 * z, cy + h / 2 - 10 * z - wallH * 0.62);
    ctx.lineTo(cx - 3 * z, cy + h / 2 - 2 * z - wallH * 0.62);
    ctx.closePath(); ctx.fill();

    // Прозорче
    ctx.fillStyle = 'rgba(255,240,180,.9)';
    ctx.beginPath();
    ctx.moveTo(cx - 14 * z, cy - 8 * z);
    ctx.lineTo(cx - 26 * z, cy - 14 * z);
    ctx.lineTo(cx - 26 * z, cy - 14 * z - wallH * 0.38);
    ctx.lineTo(cx - 14 * z, cy - 8 * z - wallH * 0.38);
    ctx.closePath(); ctx.fill();
  }

  function smoke(cx, cy, z, t, seed) {
    for (var i = 0; i < 3; i++) {
      var k = ((t / 1400) + i / 3 + seed) % 1;
      ctx.globalAlpha = (1 - k) * 0.4;
      ctx.fillStyle = '#f2f2ee';
      ctx.beginPath();
      ctx.arc(cx + Math.sin(k * 6 + seed) * 6 * z, cy - k * 40 * z, (4 + k * 8) * z, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  var BUILD_STYLE = {
    feedmill: { wall: '#c9a86a', roof: '#8a6a3a', icon: 'feed' },
    mill:     { wall: '#e0d6c0', roof: '#9a4b3c', icon: 'flour' },
    bakery:   { wall: '#f0d9b5', roof: '#c8452f', icon: 'bread' },
    dairy:    { wall: '#eaf1f7', roof: '#4d8fd6', icon: 'cheese' },
    jamshop:  { wall: '#f6dfe4', roof: '#c2415a', icon: 'jam' },
    loom:     { wall: '#e8dcc8', roof: '#7a5ca8', icon: 'yarn' }
  };

  function drawBuilding(obj, t) {
    var G = global.G, S0 = S();
    var st = S0.buildings[obj.id];
    var def = D.buildingById(obj.id);
    var p = structBase(obj);
    var z = cam.z;
    var style = BUILD_STYLE[obj.id] || { wall: '#ddd', roof: '#999', icon: 'barn' };

    if (!st.owned) {
      drawGhost(p.x, p.y, z, def.name, S0.level >= def.lvl ? def.cost + ' монети' : 'Ниво ' + def.lvl);
      return;
    }

    drawShed(p.x, p.y, z, { wall: style.wall, roof: style.roof });

    if (obj.id === 'mill') {
      // Витло отстрани на покрива
      var mx = p.x + 34 * z, my = p.y - 48 * z;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(t / 2600);
      ctx.fillStyle = '#f3e7d2';
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = 2 * z;
      for (var b = 0; b < 4; b++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(2 * z, -3 * z, 24 * z, 7 * z, 2 * z) : ctx.rect(2 * z, -3 * z, 24 * z, 7 * z);
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    if (obj.id === 'bakery' || obj.id === 'jamshop') {
      ctx.fillStyle = '#a2503f';
      ctx.fillRect(p.x - 22 * z, p.y - 76 * z, 10 * z, 20 * z);
      if (st.queue.length) smoke(p.x - 17 * z, p.y - 76 * z, z, t, obj.id.length);
    }

    // Знак какво произвежда цехът
    var icon = img(style.icon);
    var sy = p.y - 92 * z;

    var ready = G.buildingReady(obj.id);
    if (ready) {
      bubble(p.x, p.y - 96 * z - Math.sin(t / 420) * 4 * z, D.recipeById(st.queue[0].r).out, z);
    } else if (st.queue.length) {
      var q = st.queue[0];
      var r = D.recipeById(q.r);
      var left = Math.max(0, q.done - G.sec());
      var prog = 1 - left / r.time;
      progressBar(p.x, p.y - 88 * z, 44 * z, prog, z);
    } else if (icon.complete) {
      // Малка табела кое какво произвежда
      ctx.fillStyle = 'rgba(255,247,230,.92)';
      ctx.beginPath();
      ctx.arc(p.x, sy + 10 * z, 14 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(138,106,58,.8)';
      ctx.lineWidth = 2 * z;
      ctx.stroke();
      ctx.drawImage(icon, p.x - 10 * z, sy, 20 * z, 20 * z);
    }
  }

  function progressBar(cx, cy, w, prog, z) {
    ctx.fillStyle = 'rgba(20,30,10,.5)';
    roundRect(cx - w / 2, cy, w, 8 * z, 4 * z);
    ctx.fill();
    ctx.fillStyle = '#7ad06a';
    roundRect(cx - w / 2, cy, Math.max(3 * z, w * clamp(prog, 0, 1)), 8 * z, 4 * z);
    ctx.fill();
  }

  function drawGhost(cx, cy, z, name, note) {
    var w = TW * z * 1.55, h = TH * z * 1.55;
    ctx.fillStyle = '#7ba44e';
    diamond(cx, cy, w, h);
    ctx.fill();
    ctx.setLineDash([10 * z, 8 * z]);
    ctx.strokeStyle = 'rgba(90,64,36,.8)';
    ctx.lineWidth = 3 * z;
    diamond(cx, cy, w, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Дървена табела с кол
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(cx - 2 * z, cy - 30 * z, 4 * z, 30 * z);
    ctx.fillStyle = 'rgba(255,247,230,.96)';
    ctx.beginPath();
    ctx.arc(cx, cy - 40 * z, 15 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 2.5 * z;
    ctx.stroke();
    var pl = img('plus');
    if (pl.complete) ctx.drawImage(pl, cx - 10 * z, cy - 50 * z, 20 * z, 20 * z);
    label(cx, cy + 2 * z, name, note, z);
  }

  function label(cx, cy, title, note, z) {
    ctx.save();
    ctx.font = 'bold ' + Math.round(12 * z) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(30,40,20,.55)';
    var tw = Math.max(ctx.measureText(title).width, note ? ctx.measureText(note).width : 0) + 16 * z;
    roundRect(cx - tw / 2, cy, tw, (note ? 30 : 18) * z, 6 * z);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(title, cx, cy + 13 * z);
    if (note) {
      ctx.font = Math.round(10 * z) + 'px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillText(note, cx, cy + 26 * z);
    }
    ctx.restore();
  }

  // --- Кошари и животни --------------------------------------------------
  function drawPen(obj, t) {
    var G = global.G, S0 = S();
    var def = D.PENS[obj.id];
    var st = S0.pens[obj.id];
    var p = structBase(obj);
    var z = cam.z;

    if (!st.owned) {
      drawGhost(p.x, p.y, z, def.name, S0.level >= def.lvl ? def.cost + ' монети' : 'Ниво ' + def.lvl);
      return;
    }

    // Тревиста площадка
    var w = TW * z * 1.9, h = TH * z * 1.9;
    ctx.fillStyle = '#a6cf63';
    diamond(p.x, p.y, w, h);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,50,.9)';
    ctx.lineWidth = 3 * z;
    diamond(p.x, p.y, w, h);
    ctx.stroke();

    // Огради (колчета)
    ctx.fillStyle = '#c9a87a';
    for (var s = 0; s < 4; s++) {
      for (var i = 1; i < 4; i++) {
        var fx, fy;
        var f = i / 4;
        if (s === 0) { fx = p.x - w / 2 + f * w / 2; fy = p.y - f * h / 2; }
        else if (s === 1) { fx = p.x + f * w / 2; fy = p.y - h / 2 + f * h / 2; }
        else if (s === 2) { fx = p.x + w / 2 - f * w / 2; fy = p.y + f * h / 2; }
        else { fx = p.x - f * w / 2; fy = p.y + h / 2 - f * h / 2; }
        ctx.fillRect(fx - 1.5 * z, fy - 12 * z, 3 * z, 12 * z);
      }
    }

    // Навес
    drawShelter(p.x - 24 * z, p.y - 12 * z, z, def.animal);

    // Животни
    var an = D.animalById(def.animal);
    for (var a = 0; a < st.animals.length; a++) {
      var beast = st.animals[a];
      var ph = t / 2200 + a * 1.7;
      var ax = p.x + Math.sin(ph) * 26 * z + (a - st.animals.length / 2) * 10 * z;
      var ay = p.y + Math.cos(ph * 0.8) * 9 * z + 8 * z;
      var facing = Math.cos(ph) >= 0 ? 1 : -1;
      drawAnimal(def.animal, ax, ay, z, facing, beast.fed, t + a * 500);
    }

    var ready = G.penReadyCount(obj.id);
    if (ready) {
      bubble(p.x, p.y - 74 * z - Math.sin(t / 420) * 4 * z, an.item, z);
    } else if (st.animals.length && G.penNeedsFeed(obj.id) > 0) {
      bubble(p.x, p.y - 74 * z, 'feed', z);
    } else if (!st.animals.length) {
      var pl = img('plus');
      if (pl.complete) ctx.drawImage(pl, p.x - 13 * z, p.y - 66 * z, 26 * z, 26 * z);
    } else {
      var nxt = G.penNextReady(obj.id);
      if (nxt) progressBar(p.x, p.y - 66 * z, 44 * z, 1 - nxt / an.time, z);
    }
  }

  function drawShelter(cx, cy, z, kind) {
    var w = 44 * z, h = 22 * z, wallH = 18 * z;
    ctx.fillStyle = '#b5834c';
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy); ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx, cy + h / 2 - wallH); ctx.lineTo(cx - w / 2, cy - wallH);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c99a5e';
    ctx.beginPath();
    ctx.moveTo(cx + w / 2, cy); ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx, cy + h / 2 - wallH); ctx.lineTo(cx + w / 2, cy - wallH);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = kind === 'bee' ? '#e8a33a' : '#9a4b3c';
    diamond(cx, cy - wallH - 5 * z, w * 1.15, h * 1.15);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,40,20,.8)';
    ctx.beginPath();
    ctx.ellipse(cx + 6 * z, cy - 2 * z, 6 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAnimal(kind, x, y, z, face, fed, t) {
    var s = z;
    shadow(x, y + 5 * s, 13 * s, 5 * s);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face, 1);
    var bob = Math.sin(t / 500) * 1.2 * s;

    if (kind === 'chicken') {
      ctx.fillStyle = '#fdf6e6';
      ctx.beginPath(); ctx.ellipse(0, -8 * s + bob, 11 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-9 * s, -18 * s + bob, 6 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0453a';
      ctx.beginPath(); ctx.ellipse(-10 * s, -24 * s + bob, 3 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0a92a';
      ctx.beginPath();
      ctx.moveTo(-14 * s, -18 * s + bob); ctx.lineTo(-20 * s, -16 * s + bob); ctx.lineTo(-14 * s, -15 * s + bob);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath(); ctx.arc(-11 * s, -19 * s + bob, 1.3 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f0a92a'; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-2 * s, 0); ctx.lineTo(-2 * s, 4 * s); ctx.moveTo(4 * s, 0); ctx.lineTo(4 * s, 4 * s); ctx.stroke();
    } else if (kind === 'cow') {
      ctx.fillStyle = '#fdf6e6';
      ctx.beginPath(); ctx.ellipse(0, -12 * s + bob, 16 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a3330';
      ctx.beginPath(); ctx.ellipse(4 * s, -15 * s + bob, 6 * s, 4 * s, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-6 * s, -8 * s + bob, 4 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fdf6e6';
      ctx.beginPath(); ctx.ellipse(-15 * s, -20 * s + bob, 8 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0a9a2';
      ctx.beginPath(); ctx.ellipse(-19 * s, -17 * s + bob, 4.5 * s, 3.4 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath(); ctx.arc(-18 * s, -23 * s + bob, 1.4 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e8e0cc'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-6 * s, -2 * s); ctx.lineTo(-6 * s, 4 * s); ctx.moveTo(8 * s, -2 * s); ctx.lineTo(8 * s, 4 * s); ctx.stroke();
    } else if (kind === 'sheep') {
      ctx.fillStyle = '#f5f3ec';
      ctx.beginPath(); ctx.ellipse(0, -12 * s + bob, 15 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-6 * s, -20 * s + bob, 7 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(7 * s, -19 * s + bob, 7 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a4038';
      ctx.beginPath(); ctx.ellipse(-15 * s, -16 * s + bob, 6 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fdf6e6';
      ctx.beginPath(); ctx.arc(-17 * s, -17 * s + bob, 1.4 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4a4038'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-5 * s, -2 * s); ctx.lineTo(-5 * s, 4 * s); ctx.moveTo(7 * s, -2 * s); ctx.lineTo(7 * s, 4 * s); ctx.stroke();
    } else { // пчели
      for (var i = 0; i < 3; i++) {
        var a = t / 400 + i * 2.1;
        var bx = Math.cos(a) * 14 * s, by = -14 * s + Math.sin(a * 1.3) * 8 * s;
        ctx.fillStyle = '#f5c93a';
        ctx.beginPath(); ctx.ellipse(bx, by, 4.5 * s, 3.4 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a3330';
        ctx.fillRect(bx - 1 * s, by - 3.4 * s, 1.6 * s, 6.8 * s);
        ctx.fillStyle = 'rgba(230,245,255,.8)';
        ctx.beginPath(); ctx.ellipse(bx, by - 4 * s, 3.4 * s, 1.8 * s, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (fed) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#7ad06a';
      ctx.beginPath(); ctx.arc(12 * s, -30 * s, 2.6 * s, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // --- Хамбар и къща -----------------------------------------------------
  function drawBarn(obj, t) {
    var p = structBase(obj), z = cam.z;
    drawShed(p.x, p.y, z, { wall: '#c8452f', roof: '#8e2f21', wallH: 40, rise: 30, door: '#f3e7d2' });
    // Кръстосаните греди на вратата — по тях хамбарът се познава отдалеч.
    var h = TH * z * 1.55, wallH = 40 * z;
    var x1 = p.x - 3 * z, y1 = p.y + h / 2 - 2 * z;
    var x2 = p.x + 14 * z, y2 = p.y + h / 2 - 10 * z;
    var dh = wallH * 0.62;
    ctx.strokeStyle = '#c8452f';
    ctx.lineWidth = 3 * z;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2 - dh);
    ctx.moveTo(x2, y2); ctx.lineTo(x1, y1 - dh);
    ctx.stroke();
  }

  function drawHouse(obj, t) {
    var p = structBase(obj), z = cam.z;
    drawShed(p.x, p.y, z, { wall: '#f2e3c6', roof: '#6f8f4a', wallH: 32, rise: 28 });
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(p.x + 24 * z, p.y - 78 * z, 10 * z, 20 * z);
    smoke(p.x + 29 * z, p.y - 78 * z, z, t, 0.4);
  }

  // --- Декор -------------------------------------------------------------
  function drawDecor(d, t) {
    var p = worldToScreen(d.x + 0.5, d.y + 0.5), z = cam.z;
    var sway = Math.sin(t / 1800 + d.x + d.y) * 2 * z;
    if (d.kind === 'tree') {
      shadow(p.x, p.y + 2 * z, 16 * z, 7 * z);
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(p.x - 4 * z, p.y - 34 * z, 8 * z, 34 * z);
      ctx.fillStyle = '#4f9e3a';
      ctx.beginPath(); ctx.ellipse(p.x + sway, p.y - 48 * z, 24 * z, 21 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5cb344';
      ctx.beginPath(); ctx.ellipse(p.x - 8 * z + sway, p.y - 56 * z, 15 * z, 13 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6cc44f';
      ctx.beginPath(); ctx.ellipse(p.x + 9 * z + sway, p.y - 52 * z, 12 * z, 11 * z, 0, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'bush') {
      shadow(p.x, p.y + 2 * z, 12 * z, 5 * z);
      ctx.fillStyle = '#4f9e3a';
      ctx.beginPath(); ctx.ellipse(p.x - 6 * z, p.y - 8 * z, 11 * z, 9 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(p.x + 7 * z, p.y - 7 * z, 10 * z, 8 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#61b84a';
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 15 * z, 12 * z, 10 * z, 0, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'pond') {
      var w = TW * z * 1.7, h = TH * z * 1.7;
      ctx.fillStyle = '#6fa8d6';
      diamond(p.x, p.y, w, h); ctx.fill();
      ctx.fillStyle = '#8dc3e8';
      diamond(p.x, p.y - 3 * z, w * 0.78, h * 0.78); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 2 * z;
      for (var i = 0; i < 2; i++) {
        var k = ((t / 2200) + i / 2) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 2 * z, 10 * z + k * 26 * z, 5 * z + k * 13 * z, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function S() { return global.G.state; }

  // --- Главен кадър ------------------------------------------------------
  function frame() {
    var t = performance.now() - startedAt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);

    var sky = ctx.createLinearGradient(0, 0, 0, viewH);
    sky.addColorStop(0, '#bfe6f5');
    sky.addColorStop(1, '#e8f3d8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewW, viewH);

    drawGround();

    // Всичко се подрежда по дълбочина (x+y).
    var items = [];
    D.PLOT_SPOTS.forEach(function (p, i) {
      items.push({ depth: p.x + p.y, draw: function () { drawPlot(tileMap[p.x + ',' + p.y], t); } });
    });
    D.STRUCTURES.forEach(function (s) {
      var obj = tileMap[s.x + ',' + s.y];
      items.push({
        depth: s.x + s.y + 1.5,
        draw: function () {
          if (s.kind === 'pen') drawPen(obj, t);
          else if (s.kind === 'building') drawBuilding(obj, t);
          else if (s.kind === 'barn') drawBarn(obj, t);
          else drawHouse(obj, t);
        }
      });
    });
    D.DECOR.forEach(function (d) {
      items.push({ depth: d.x + d.y + 0.5, draw: function () { drawDecor(d, t); } });
    });
    var vis = visibleTiles();
    WILD.forEach(function (d) {
      if (d.x < vis.x0 || d.x > vis.x1 || d.y < vis.y0 || d.y > vis.y1) return;
      items.push({ depth: d.x + d.y + 0.5, draw: function () { drawDecor(d, t); } });
    });
    items.sort(function (a, b) { return a.depth - b.depth; });
    for (var i = 0; i < items.length; i++) items[i].draw();
  }

  global.GScene = {
    init: init, resize: resize, frame: frame, pick: pick,
    panBy: panBy, zoomAt: zoomAt, focusOn: focusOn,
    worldToScreen: worldToScreen,
    cam: cam
  };
})(window);
