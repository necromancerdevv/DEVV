/* Слънчева Ферма — изометрична сцена.
 *
 * Правила на рисуването, за да изглежда всичко като едно цяло:
 *   • Слънцето е горе вляво. Покривите са най-светли, югоизточните стени —
 *     светли, югозападните — с една степен по-тъмни, а вътрешните ъгли носят
 *     лека сянка.
 *   • Всеки предмет стъпва върху меко елипсовидно петно сянка.
 *   • Тежките рисунки (сгради, дървета, тревни плочки) се рисуват веднъж в
 *     спрайт и после само се копират — така детайлът е безплатен при движение.
 */
(function (global) {
  'use strict';

  var D = global.GD;
  var TW = 96, TH = 48;              // размер на изометрична плочка
  var canvas, ctx, dpr = 1;
  var cam = { x: 0, y: 0, z: 0.8 };
  var viewW = 0, viewH = 0;
  var tileMap = {};
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

  function S() { return global.G.state; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // --- Цвят и светлина ---------------------------------------------------
  function tint(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = clamp(((n >> 16) & 255) + amt, 0, 255);
    var g = clamp(((n >> 8) & 255) + amt, 0, 255);
    var b = clamp((n & 255) + amt, 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // Страните на всяко тяло: покрив, югоизточна стена, югозападна стена.
  var LIT = 16, SIDE_R = -6, SIDE_L = -30, DARK = -46;

  // Детерминиран шум: Math.imul пази 32-битовата аритметика.
  function hash(x, y) {
    var n = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  // --- Проекция ----------------------------------------------------------
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

  function visibleTiles() {
    var c = [screenToWorld(0, 0), screenToWorld(viewW, 0), screenToWorld(0, viewH), screenToWorld(viewW, viewH)];
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < 4; i++) {
      minX = Math.min(minX, c[i].x); maxX = Math.max(maxX, c[i].x);
      minY = Math.min(minY, c[i].y); maxY = Math.max(maxY, c[i].y);
    }
    return { x0: Math.floor(minX) - 1, x1: Math.ceil(maxX) + 1, y0: Math.floor(minY) - 1, y1: Math.ceil(maxY) + 1 };
  }

  // --- Кеш за спрайтове --------------------------------------------------
  // Всеки спрайт се рисува в собствено платно с начало (0,0) в долния център
  // на предмета, за да се залепя лесно за плочката.
  var cache = {};
  var cacheKeys = [];

  function sprite(key, z, box, painter) {
    var zk = Math.round(z * 20) / 20;
    var full = key + '|' + zk;
    var hit = cache[full];
    if (hit) return hit;

    var w = Math.ceil(box.w * zk), h = Math.ceil(box.h * zk);
    var ax = Math.round(box.ax * zk), ay = Math.round(box.ay * zk);
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * dpr));
    cv.height = Math.max(1, Math.ceil(h * dpr));
    var c2 = cv.getContext('2d');
    c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    c2.translate(ax, ay);

    var prev = ctx;
    ctx = c2;
    try { painter(zk); } finally { ctx = prev; }

    hit = { cv: cv, w: w, h: h, ax: ax, ay: ay };
    cache[full] = hit;
    cacheKeys.push(full);
    if (cacheKeys.length > 260) {
      for (var i = 0; i < 60; i++) delete cache[cacheKeys[i]];
      cacheKeys = cacheKeys.slice(60);
    }
    return hit;
  }

  function stamp(s, x, y) {
    ctx.drawImage(s.cv, Math.round(x - s.ax), Math.round(y - s.ay), s.w, s.h);
  }

  function dropCache() { cache = {}; cacheKeys = []; }

  // --- Основни фигури ----------------------------------------------------
  function diamond(cx, cy, w, h) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy);
    ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy);
    ctx.closePath();
  }

  function poly(pts, fill, stroke, lw) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      if (i) ctx.lineTo(pts[i][0], pts[i][1]);
      else ctx.moveTo(pts[i][0], pts[i][1]);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
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

  function ell(cx, cy, rx, ry, fill, rot) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rot || 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  }

  function shadow(cx, cy, rx, ry, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 0.2 : alpha;
    ell(cx, cy, rx, ry, '#2f3f1c');
    ctx.restore();
  }

  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

  // --- Терен -------------------------------------------------------------
  var GRASS = ['#8ec951', '#86c24a', '#97d35b'];

  // Една тревна плочка: основен тон, по-светло петно и стръкчета.
  function grassSprite(variant, z) {
    var w = TW + 2, h = TH + 2;
    return sprite('grass' + variant, z, { w: w, h: h, ax: w / 2, ay: h / 2 }, function (s) {
      var tone = GRASS[variant % 3];
      diamond(0, 0, TW * s + 1, TH * s + 1);
      ctx.fillStyle = tone;
      ctx.fill();
      if (variant >= 3) {
        ctx.globalAlpha = 0.5;
        ell(-6 * s, 2 * s, 15 * s, 7 * s, tint(tone, 10));
        ctx.globalAlpha = 1;
      }
      if (variant >= 6) {
        ctx.strokeStyle = 'rgba(64,116,42,.34)';
        ctx.lineWidth = 1.6 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-9 * s, 4 * s); ctx.lineTo(-6 * s, -2 * s);
        ctx.moveTo(-5 * s, 5 * s); ctx.lineTo(-3 * s, -1 * s);
        ctx.moveTo(7 * s, 6 * s); ctx.lineTo(10 * s, 0);
        ctx.stroke();
      }
    });
  }

  function drawGround() {
    var v = visibleTiles();
    var z = cam.z;
    for (var y = v.y0; y <= v.y1; y++) {
      for (var x = v.x0; x <= v.x1; x++) {
        var p = worldToScreen(x + 0.5, y + 0.5);
        if (p.x < -TW * z || p.x > viewW + TW * z) continue;
        if (p.y < -TH * z * 2 || p.y > viewH + TH * z * 2) continue;
        var r = hash(x, y);
        var variant = Math.floor(r * 3) + (r > 0.62 ? 3 : 0) + (r > 0.88 ? 3 : 0);
        stamp(grassSprite(variant, z), p.x, p.y);
      }
    }
  }

  // --- Декор -------------------------------------------------------------
  // Три вида дървета, храсти, цветя и камъни — всички кеширани по вид.
  function treeSprite(kind, z) {
    return sprite('tree' + kind, z, { w: 110, h: 130, ax: 55, ay: 112 }, function (s) {
      shadow(0, 0, 20 * s, 8 * s, 0.22);
      // ствол с леко разширение долу
      poly([[-4.5 * s, 0], [4.5 * s, 0], [3 * s, -34 * s], [-3 * s, -34 * s]], '#7a5230');
      poly([[0, 0], [4.5 * s, 0], [3 * s, -34 * s], [0, -34 * s]], '#8c6238');
      if (kind === 1) {
        // широка корона на топки
        ell(0, -52 * s, 25 * s, 22 * s, '#3f8f34');
        ell(-9 * s, -60 * s, 17 * s, 15 * s, '#54a83f');
        ell(10 * s, -56 * s, 14 * s, 13 * s, '#4d9e3a');
        ell(-4 * s, -68 * s, 12 * s, 10 * s, '#69bf4d');
        ctx.globalAlpha = 0.35;
        ell(8 * s, -44 * s, 14 * s, 9 * s, '#2c6b26');
        ctx.globalAlpha = 1;
      } else if (kind === 2) {
        // иглолистно
        for (var i = 0; i < 3; i++) {
          var yy = -30 * s - i * 17 * s;
          var rw = (26 - i * 6) * s;
          poly([[-rw, yy], [rw, yy], [0, yy - 26 * s]], i % 2 ? '#3c8a33' : '#47993a');
          ctx.globalAlpha = 0.3;
          poly([[0, yy], [rw, yy], [0, yy - 26 * s]], '#2a6a24');
          ctx.globalAlpha = 1;
        }
      } else {
        // овощно, с плодчета
        ell(0, -50 * s, 23 * s, 20 * s, '#469b38');
        ell(-8 * s, -58 * s, 15 * s, 13 * s, '#5cb344');
        ell(9 * s, -54 * s, 13 * s, 11 * s, '#51a83e');
        var spots = [[-10, -52], [4, -58], [12, -48], [-3, -44], [7, -63]];
        for (var k = 0; k < spots.length; k++) ell(spots[k][0] * s, spots[k][1] * s, 3.1 * s, 3.1 * s, '#e2482f');
      }
    });
  }

  function bushSprite(kind, z) {
    return sprite('bush' + kind, z, { w: 70, h: 56, ax: 35, ay: 44 }, function (s) {
      shadow(0, 0, 15 * s, 6 * s, 0.18);
      ell(-7 * s, -7 * s, 11 * s, 9 * s, '#3f8f34');
      ell(7 * s, -6 * s, 10 * s, 8 * s, '#47993a');
      ell(0, -13 * s, 12 * s, 10 * s, '#57ad42');
      ctx.globalAlpha = 0.4;
      ell(-3 * s, -17 * s, 7 * s, 4.5 * s, '#75c95a');
      ctx.globalAlpha = 1;
      if (kind === 1) {
        var c = ['#e8536b', '#f2b705', '#ffffff'][kind % 3];
        ell(-6 * s, -14 * s, 2.4 * s, 2.4 * s, c);
        ell(5 * s, -11 * s, 2.4 * s, 2.4 * s, c);
      }
    });
  }

  function flowerSprite(kind, z) {
    var colors = ['#f4d03f', '#e8536b', '#ffffff', '#b98ce0'];
    return sprite('flower' + kind, z, { w: 46, h: 34, ax: 23, ay: 26 }, function (s) {
      var col = colors[kind % 4];
      for (var i = 0; i < 4; i++) {
        var fx = (-9 + i * 6) * s, fy = (-2 - (i % 2) * 5) * s;
        ctx.strokeStyle = '#4f9e3a';
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        ctx.moveTo(fx, 0); ctx.lineTo(fx, fy - 3 * s);
        ctx.stroke();
        for (var p = 0; p < 4; p++) {
          var a = p * Math.PI / 2;
          ell(fx + Math.cos(a) * 2.2 * s, fy - 4 * s + Math.sin(a) * 2.2 * s, 1.8 * s, 1.8 * s, col);
        }
        ell(fx, fy - 4 * s, 1.3 * s, 1.3 * s, '#f39c12');
      }
    });
  }

  function rockSprite(z) {
    return sprite('rock', z, { w: 56, h: 44, ax: 28, ay: 32 }, function (s) {
      shadow(0, 0, 12 * s, 5 * s, 0.2);
      poly([[-11 * s, 0], [-7 * s, -11 * s], [3 * s, -13 * s], [11 * s, -4 * s], [7 * s, 0]], '#9aa0a6');
      poly([[-7 * s, -11 * s], [3 * s, -13 * s], [1 * s, -7 * s], [-5 * s, -6 * s]], '#b9bfc4');
      poly([[3 * s, -13 * s], [11 * s, -4 * s], [7 * s, 0], [1 * s, -7 * s]], '#82888e');
    });
  }

  function drawDecor(d, t) {
    var p = worldToScreen(d.x + 0.5, d.y + 0.5), z = cam.z;
    if (d.kind === 'tree') stamp(treeSprite(d.v || 1, z), p.x, p.y);
    else if (d.kind === 'bush') stamp(bushSprite(d.v || 0, z), p.x, p.y);
    else if (d.kind === 'flower') stamp(flowerSprite(d.v || 0, z), p.x, p.y);
    else if (d.kind === 'rock') stamp(rockSprite(z), p.x, p.y);
    else if (d.kind === 'pond') drawPond(p.x, p.y, z, t);
  }

  // Езерце с тръстика и кръгове по водата
  function drawPond(cx, cy, z, t) {
    var w = TW * z * 1.9, h = TH * z * 1.9;
    ctx.save();
    diamond(cx, cy, w, h);
    ctx.clip();
    ctx.fillStyle = '#6a9c4a';
    diamond(cx, cy, w, h);
    ctx.fill();
    ell(cx, cy, w * 0.42, h * 0.42, '#3f7fb0');
    ell(cx, cy - 2 * z, w * 0.37, h * 0.36, '#5fa5d4');
    ell(cx - 5 * z, cy - 4 * z, w * 0.22, h * 0.18, '#80c0e6');
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 1.8 * z;
    for (var i = 0; i < 2; i++) {
      var k = ((t / 2400) + i / 2) % 1;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.beginPath();
      ctx.ellipse(cx + 6 * z, cy, 6 * z + k * 20 * z, 3 * z + k * 10 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // тръстика по ръба
    ctx.strokeStyle = '#4f8f3a';
    ctx.lineWidth = 2 * z;
    ctx.lineCap = 'round';
    var reeds = [[-0.32, 0.12], [-0.26, 0.2], [0.3, -0.1], [0.34, 0.02]];
    for (var r = 0; r < reeds.length; r++) {
      var rx = cx + reeds[r][0] * w, ry = cy + reeds[r][1] * h;
      ctx.beginPath();
      ctx.moveTo(rx, ry); ctx.lineTo(rx + 2 * z, ry - 13 * z);
      ctx.stroke();
      ell(rx + 2 * z, ry - 15 * z, 1.8 * z, 3.4 * z, '#8a6a3a');
    }
  }

  // --- Ограда по границата на стопанството -------------------------------
  function fenceSprite(dir, z) {
    // dir 'l' върви на югозапад, 'r' на югоизток
    return sprite('fence' + dir, z, { w: TW + 8, h: 60, ax: (TW + 8) / 2, ay: 42 }, function (s) {
      var dx = (dir === 'r' ? 1 : -1) * TW / 2 * s;
      var dy = TH / 2 * s;
      var x0 = -dx / 2, y0 = -dy / 2, x1 = dx / 2, y1 = dy / 2;
      ctx.strokeStyle = '#b08a58';
      ctx.lineWidth = 3 * s;
      ctx.lineCap = 'round';
      for (var r = 0; r < 2; r++) {
        var lift = 9 * s + r * 9 * s;
        ctx.beginPath();
        ctx.moveTo(x0, y0 - lift); ctx.lineTo(x1, y1 - lift);
        ctx.stroke();
      }
      // колчета
      for (var i = 0; i <= 1; i++) {
        var px = x0 + (x1 - x0) * i, py = y0 + (y1 - y0) * i;
        poly([[px - 2.4 * s, py], [px + 2.4 * s, py], [px + 2.4 * s, py - 24 * s], [px, py - 27 * s], [px - 2.4 * s, py - 24 * s]], '#c9a87a');
        poly([[px, py], [px + 2.4 * s, py], [px + 2.4 * s, py - 24 * s], [px, py - 25.5 * s]], '#a8834f');
      }
    });
  }

  // --- Ниви --------------------------------------------------------------
  // Празна леха: изкопана пръст в дървена рамка с колчета по ъглите.
  function bedSprite(z) {
    return sprite('bed', z, { w: TW + 24, h: TH + 46, ax: (TW + 24) / 2, ay: (TH + 46) / 2 + 8 }, function (s) {
      var w = TW * 0.95 * s, h = TH * 0.95 * s;
      // рамка от дъски
      diamond(0, 0, w + 7 * s, h + 3.5 * s);
      ctx.fillStyle = '#8a6134';
      ctx.fill();
      diamond(0, -2 * s, w + 7 * s, h + 3.5 * s);
      ctx.fillStyle = '#a87b45';
      ctx.fill();
      // пръст
      diamond(0, -2.5 * s, w - 4 * s, h - 2 * s);
      ctx.fillStyle = '#5f3f22';
      ctx.fill();
      diamond(0, -4 * s, w - 6 * s, h - 3.5 * s);
      ctx.fillStyle = '#7d5430';
      ctx.fill();
      // бразди по посоката на плочката
      ctx.strokeStyle = 'rgba(70,44,22,.5)';
      ctx.lineWidth = 2.2 * s;
      for (var f = -1; f <= 1; f++) {
        var off = f * 11 * s;
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 8 * s + off, -4 * s + off * 0.5 + 4 * s);
        ctx.lineTo(off + 4 * s, -4 * s + h / 2 - 3 * s + off * 0.5);
        ctx.stroke();
      }
      // влажни петна и камъчета
      ctx.globalAlpha = 0.35;
      ell(-10 * s, -1 * s, 9 * s, 4 * s, '#4a3018');
      ell(12 * s, -8 * s, 7 * s, 3.4 * s, '#4a3018');
      ctx.globalAlpha = 1;
      ell(6 * s, -2 * s, 1.6 * s, 1.2 * s, '#9b8a74');
      ell(-13 * s, -7 * s, 1.4 * s, 1 * s, '#9b8a74');
      // ъглови колчета
      var corners = [[-w / 2 - 2 * s, -2 * s], [w / 2 + 2 * s, -2 * s], [0, h / 2], [0, -h / 2 - 2 * s]];
      for (var c = 0; c < corners.length; c++) {
        var px = corners[c][0], py = corners[c][1];
        poly([[px - 2.6 * s, py], [px + 2.6 * s, py], [px + 2.6 * s, py - 9 * s], [px, py - 11 * s], [px - 2.6 * s, py - 9 * s]], '#c9a87a');
        poly([[px, py], [px + 2.6 * s, py], [px + 2.6 * s, py - 9 * s], [px, py - 10 * s]], '#a8834f');
      }
    });
  }

  // Необработен парцел: буренясал, ограден с въже
  function wildPlotSprite(z) {
    return sprite('wildplot', z, { w: TW + 16, h: TH + 30, ax: (TW + 16) / 2, ay: (TH + 30) / 2 + 4 }, function (s) {
      var w = TW * 0.95 * s, h = TH * 0.95 * s;
      diamond(0, 0, w, h);
      ctx.fillStyle = '#75a24b';
      ctx.fill();
      ctx.globalAlpha = 0.5;
      diamond(0, -1 * s, w * 0.7, h * 0.7);
      ctx.fillStyle = '#6a9743';
      ctx.fill();
      ctx.globalAlpha = 1;
      // туфи буренак
      for (var i = 0; i < 5; i++) {
        var r1 = hash(i, 3), r2 = hash(i * 7, 11);
        var bx = (r1 - 0.5) * w * 0.6, by = (r2 - 0.5) * h * 0.55;
        ell(bx, by, 7 * s, 3.4 * s, '#5f9440');
        ctx.strokeStyle = '#4f8a36';
        ctx.lineWidth = 2 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - 2 * s, by); ctx.lineTo(bx - 4 * s, by - 9 * s);
        ctx.moveTo(bx + 1 * s, by); ctx.lineTo(bx + 1 * s, by - 11 * s);
        ctx.moveTo(bx + 3 * s, by); ctx.lineTo(bx + 6 * s, by - 8 * s);
        ctx.stroke();
      }
      // старо пънче
      ell(-w * 0.22, h * 0.12, 6 * s, 3 * s, '#7a5230');
      poly([[-w * 0.22 - 6 * s, h * 0.12], [-w * 0.22 + 6 * s, h * 0.12],
        [-w * 0.22 + 5 * s, h * 0.12 - 7 * s], [-w * 0.22 - 5 * s, h * 0.12 - 7 * s]], '#8c6238');
      ell(-w * 0.22, h * 0.12 - 7 * s, 5 * s, 2.4 * s, '#a8763f');
      ell(-w * 0.22, h * 0.12 - 7 * s, 2.4 * s, 1.2 * s, '#8c6238');
      // въже по границата
      ctx.strokeStyle = 'rgba(146,110,66,.85)';
      ctx.lineWidth = 2 * s;
      ctx.setLineDash([6 * s, 5 * s]);
      diamond(0, -1 * s, w, h);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  function drawPlot(obj, t) {
    var G = global.G;
    var p = worldToScreen(obj.x + 0.5, obj.y + 0.5);
    var z = cam.z;
    var st = G.plotState(obj.index);

    if (st === 'locked') {
      stamp(wildPlotSprite(z), p.x, p.y);
      if (obj.index === G.nextLockedPlot()) {
        signBadge(p.x, p.y - 16 * z, z, 'lock');
      }
      return;
    }

    stamp(bedSprite(z), p.x, p.y);
    if (st === 'empty') return;

    var crop = D.cropById(S().plots[obj.index].crop);
    var prog = G.plotProgress(obj.index);
    var stage = prog >= 1 ? 1 : prog;
    // редицата расте по посоката на плочката, за да личи изометрията
    var spots = [[-0.21, -0.1], [0.21, -0.1], [-0.21, 0.12], [0.21, 0.12], [0, 0.01]];
    for (var i = 0; i < spots.length; i++) {
      drawPlant(p.x + spots[i][0] * TW * z, p.y + spots[i][1] * TH * z + 3 * z, crop, stage, z, t + i * 470);
    }

    if (st === 'ripe') {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ell(p.x, p.y - 2 * z, 26 * z, 13 * z, '#ffe9a0');
      ctx.restore();
      bubble(p.x, p.y - 42 * z - Math.sin(t / 420) * 4 * z, crop.item, z);
    } else {
      progressBar(p.x, p.y - 13 * z, 30 * z, prog, z);
    }
  }

  // --- Растения ----------------------------------------------------------
  function drawPlant(x, y, crop, stage, z, t) {
    var st = crop.plant;
    var h = (11 + 27 * stage) * z;
    var sway = Math.sin(t / 900) * 1.7 * z * stage;
    var ripe = stage > 0.93;

    shadow(x, y + 1 * z, 5.5 * z * (0.5 + stage), 2.2 * z * (0.5 + stage), 0.16);
    ctx.save();
    ctx.translate(x, y);

    if (stage < 0.3) {
      // кълн: две листенца
      ctx.strokeStyle = '#5f9e36';
      ctx.lineWidth = 2.2 * z;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(sway, -h * 0.55);
      ctx.stroke();
      ell(sway - 3.4 * z, -h * 0.55, 4.2 * z, 2.6 * z, '#7cc24a', -0.5);
      ell(sway + 3.4 * z, -h * 0.62, 4.2 * z, 2.6 * z, '#8fd257', 0.5);
      ctx.restore();
      return;
    }

    // стъбло
    ctx.strokeStyle = tint(st.stem, -14);
    ctx.lineWidth = 2.8 * z;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 0.5, -h * 0.6, sway, -h);
    ctx.stroke();
    ctx.strokeStyle = st.stem;
    ctx.lineWidth = 1.6 * z;
    ctx.beginPath();
    ctx.moveTo(-0.6 * z, 0);
    ctx.quadraticCurveTo(sway * 0.5 - 0.6 * z, -h * 0.6, sway - 0.6 * z, -h);
    ctx.stroke();

    if (st.style === 'grain') {
      // житен клас: зърна в две редици
      var headColor = ripe ? st.head : '#b3cc63';
      for (var i = 0; i < 4; i++) {
        var yy = -h + 2 * z + i * 4.6 * z;
        ell(sway - 3 * z, yy, 2.4 * z, 3.8 * z, tint(headColor, -18), -0.55);
        ell(sway + 3 * z, yy, 2.4 * z, 3.8 * z, headColor, 0.55);
      }
      ell(sway, -h - 1.5 * z, 2 * z, 3.4 * z, headColor);
      if (ripe) {
        ctx.strokeStyle = tint(headColor, 24);
        ctx.lineWidth = 1.1 * z;
        for (var a = -1; a <= 1; a += 2) {
          ctx.beginPath();
          ctx.moveTo(sway + a * 2 * z, -h - 2 * z);
          ctx.lineTo(sway + a * 5 * z, -h - 9 * z);
          ctx.stroke();
        }
      }
    } else if (st.style === 'tall') {
      // царевица: широки листа и кочан
      ell(sway - 7 * z, -h * 0.62, 8 * z, 3.2 * z, tint('#4f9e3a', -12), -0.45);
      ell(sway + 7 * z, -h * 0.46, 8 * z, 3.2 * z, '#5cb344', 0.45);
      ell(sway - 6 * z, -h * 0.3, 7 * z, 2.8 * z, '#4f9e3a', -0.3);
      if (stage > 0.55) {
        var cob = ripe ? st.head : '#bcd45f';
        ell(sway + 3.5 * z, -h * 0.76, 3.6 * z, 7.5 * z, cob, 0.22);
        ell(sway + 2.6 * z, -h * 0.76, 1.6 * z, 6.5 * z, tint(cob, 22), 0.22);
        if (ripe) {
          ctx.strokeStyle = '#c98a45';
          ctx.lineWidth = 1.2 * z;
          ctx.beginPath();
          ctx.moveTo(sway + 4 * z, -h * 0.94); ctx.lineTo(sway + 6 * z, -h * 1.08);
          ctx.stroke();
        }
      }
    } else if (st.style === 'sun') {
      // слънчоглед: венче от листенца и тъмна питка
      ell(sway - 7 * z, -h * 0.5, 7 * z, 3.4 * z, '#4f9e3a', -0.5);
      ell(sway + 7 * z, -h * 0.36, 7 * z, 3.4 * z, '#5cb344', 0.5);
      if (stage > 0.5) {
        var r = (ripe ? 7 : 4.6) * z;
        for (var k = 0; k < 10; k++) {
          var ang = k * Math.PI / 5;
          ell(sway + Math.cos(ang) * r, -h + Math.sin(ang) * r * 0.85,
            3.2 * z, 1.9 * z, k % 2 ? st.head : tint(st.head, -22), ang);
        }
        ell(sway, -h, r * 0.6, r * 0.5, '#6b4526');
        ell(sway - r * 0.16, -h - r * 0.1, r * 0.34, r * 0.26, '#8a5a30');
      }
    } else if (st.style === 'leafy') {
      // морков: перест кичур, а узрелият показва оранжево рамо
      for (var l = -1; l <= 1; l++) {
        ell(sway + l * 4.6 * z, -h + 2 * z, 2.6 * z, 7.5 * z, l ? '#3f8f34' : '#4fa63d', l * 0.42);
      }
      ell(sway, -h - 3 * z, 2.2 * z, 4.5 * z, '#5cb344');
      if (ripe) {
        poly([[sway - 4 * z, 1 * z], [sway + 4 * z, 1 * z], [sway + 2.4 * z, -4 * z], [sway - 2.4 * z, -4 * z]], st.head);
        ell(sway, -4 * z, 4 * z, 1.8 * z, tint(st.head, 26));
      }
    } else if (st.style === 'bush') {
      // храстче с плодове
      ell(sway, -h * 0.72, 10 * z, 7.5 * z, tint(st.stem, -10));
      ell(sway - 3 * z, -h * 0.86, 7 * z, 5 * z, tint(st.stem, 14));
      if (stage > 0.6) {
        var berry = ripe ? st.head : '#9fc25a';
        ell(sway - 4.5 * z, -h * 0.66, 3.4 * z, 3.4 * z, berry);
        ell(sway + 4.5 * z, -h * 0.58, 3.4 * z, 3.4 * z, berry);
        ell(sway + 0.5 * z, -h * 0.4, 3.1 * z, 3.1 * z, berry);
        if (ripe) {
          ell(sway - 5.4 * z, -h * 0.7, 1.1 * z, 1.1 * z, 'rgba(255,255,255,.7)');
          ell(sway + 3.6 * z, -h * 0.62, 1.1 * z, 1.1 * z, 'rgba(255,255,255,.7)');
        }
      }
    } else {
      // тиква: пълзящи листа и голям плод на земята
      ell(sway - 7 * z, -h * 0.4, 9 * z, 4.6 * z, tint(st.stem, -8), -0.2);
      ell(sway + 7 * z, -h * 0.26, 8 * z, 4.2 * z, tint(st.stem, 10), 0.25);
      if (stage > 0.5) {
        var pr = 7.5 * z * stage;
        var fruit = ripe ? st.head : '#a8c05a';
        ell(sway + 2 * z, -pr * 0.75, pr, pr * 0.8, tint(fruit, -16));
        ell(sway - 1 * z, -pr * 0.8, pr * 0.5, pr * 0.78, fruit);
        ell(sway + 5 * z, -pr * 0.8, pr * 0.42, pr * 0.72, tint(fruit, 12));
        ctx.strokeStyle = '#4a7a2a';
        ctx.lineWidth = 1.8 * z;
        ctx.beginPath();
        ctx.moveTo(sway + 2 * z, -pr * 1.5); ctx.lineTo(sway + 3 * z, -pr * 1.9);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // --- Балончета, ленти, табелки ----------------------------------------
  function bubble(x, y, itemId, z) {
    var r = 15 * z;
    ctx.save();
    shadow(x, y + r + 4 * z, r * 0.7, r * 0.28, 0.18);
    ctx.beginPath();
    ctx.moveTo(x - 5.5 * z, y + r - 3 * z);
    ctx.lineTo(x, y + r + 6 * z);
    ctx.lineTo(x + 5.5 * z, y + r - 3 * z);
    ctx.closePath();
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    var g = ctx.createLinearGradient(x, y - r, x, y + r);
    g.addColorStop(0, '#fffdf6');
    g.addColorStop(1, '#f6e7c8');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#ffd54a';
    ctx.lineWidth = 3 * z;
    ctx.stroke();
    var im = img(itemId);
    if (im.complete && im.naturalWidth) ctx.drawImage(im, x - r * 0.72, y - r * 0.72, r * 1.44, r * 1.44);
    ctx.restore();
  }

  function progressBar(cx, cy, w, prog, z) {
    var hgt = 7 * z;
    ctx.save();
    roundRect(cx - w / 2 - 1.5 * z, cy - 1.5 * z, w + 3 * z, hgt + 3 * z, (hgt + 3 * z) / 2);
    ctx.fillStyle = 'rgba(38,28,14,.55)';
    ctx.fill();
    roundRect(cx - w / 2, cy, Math.max(3 * z, w * clamp(prog, 0, 1)), hgt, hgt / 2);
    var g = ctx.createLinearGradient(0, cy, 0, cy + hgt);
    g.addColorStop(0, '#a8e57f');
    g.addColorStop(1, '#5cb344');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  // Кръгла табелка с икона (катинар, плюс)
  function signBadge(cx, cy, z, iconId) {
    ctx.save();
    shadow(cx, cy + 15 * z, 11 * z, 4 * z, 0.2);
    ctx.beginPath();
    ctx.arc(cx, cy, 14 * z, 0, Math.PI * 2);
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    ctx.strokeStyle = '#b08a58';
    ctx.lineWidth = 2.4 * z;
    ctx.stroke();
    var im = img(iconId);
    if (im.complete && im.naturalWidth) ctx.drawImage(im, cx - 10 * z, cy - 10 * z, 20 * z, 20 * z);
    ctx.restore();
  }

  // Дървена табела на два кола — за непостроените места
  function woodSign(cx, cy, z, title, note) {
    ctx.save();
    ctx.font = 'bold ' + Math.round(11 * z) + 'px system-ui, sans-serif';
    var tw = Math.max(ctx.measureText(title).width, note ? ctx.measureText(note).width : 0) + 18 * z;
    var th = (note ? 30 : 20) * z;
    var top = cy - th;
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(cx - tw / 2 + 5 * z, top + th - 2 * z, 3.4 * z, 12 * z);
    ctx.fillRect(cx + tw / 2 - 8 * z, top + th - 2 * z, 3.4 * z, 12 * z);
    roundRect(cx - tw / 2, top, tw, th, 4 * z);
    ctx.fillStyle = '#c9a87a';
    ctx.fill();
    roundRect(cx - tw / 2 + 2 * z, top + 2 * z, tw - 4 * z, th - 4 * z, 3 * z);
    ctx.fillStyle = '#e0c091';
    ctx.fill();
    ctx.fillStyle = '#5b4020';
    ctx.textAlign = 'center';
    ctx.fillText(title, cx, top + 13 * z);
    if (note) {
      ctx.font = Math.round(9.5 * z) + 'px system-ui, sans-serif';
      ctx.fillStyle = '#7a5c33';
      ctx.fillText(note, cx, top + 25 * z);
    }
    ctx.restore();
  }

  // --- Строителен инструментариум ---------------------------------------
  // g описва стъпката на сградата: център, ширина и дълбочина в пиксели.
  function geom(scale, z) {
    return { cx: 0, cy: 0, w: TW * scale * z, h: TH * scale * z, z: z };
  }

  // Точка по стена: side 'l' е югозападната (W→S), 'r' — югоизточната (S→E).
  // u върви по стената от 0 до 1, v е височина в пиксели.
  function wpt(g, side, u, v) {
    if (side === 'l') return [g.cx - g.w / 2 + u * g.w / 2, g.cy + u * g.h / 2 - v];
    return [g.cx + u * g.w / 2, g.cy + g.h / 2 - u * g.h / 2 - v];
  }

  function wquad(g, side, u0, u1, v0, v1) {
    return [wpt(g, side, u0, v0), wpt(g, side, u1, v0), wpt(g, side, u1, v1), wpt(g, side, u0, v1)];
  }

  // Цокъл + двете видими стени
  function walls(g, wallH, color, plinth) {
    var z = g.z;
    shadow(g.cx, g.cy + g.h * 0.16, g.w * 0.52, g.h * 0.4, 0.22);
    if (plinth !== false) {
      diamond(g.cx, g.cy + 3 * z, g.w + 6 * z, g.h + 3 * z);
      ctx.fillStyle = '#9b8f7c';
      ctx.fill();
      diamond(g.cx, g.cy + 1 * z, g.w + 6 * z, g.h + 3 * z);
      ctx.fillStyle = '#b8ad99';
      ctx.fill();
    }
    poly(wquad(g, 'r', 0, 1, 0, wallH), tint(color, SIDE_R));
    poly(wquad(g, 'l', 0, 1, 0, wallH), tint(color, SIDE_L));
    // сянка под стряхата
    ctx.globalAlpha = 0.16;
    poly(wquad(g, 'r', 0, 1, wallH - 6 * z, wallH), '#2c2010');
    poly(wquad(g, 'l', 0, 1, wallH - 6 * z, wallH), '#2c2010');
    ctx.globalAlpha = 1;
  }

  // Дъсчена облицовка по стена
  function planks(g, side, wallH, color, count) {
    ctx.strokeStyle = tint(color, -34);
    ctx.lineWidth = 1.2 * g.z;
    for (var i = 1; i < count; i++) {
      var u = i / count;
      var a = wpt(g, side, u, 0), b = wpt(g, side, u, wallH);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  }

  // Прозорец с рамка, стъкло и кръстачка
  function windowOn(g, side, uc, uw, v0, v1, shutters) {
    var z = g.z;
    poly(wquad(g, side, uc - uw / 2, uc + uw / 2, v0, v1), '#f2e3c6');
    var pts = wquad(g, side, uc - uw / 2 + 0.02, uc + uw / 2 - 0.02, v0 + 2.5 * z, v1 - 2.5 * z);
    poly(pts, side === 'r' ? '#a9d4ea' : '#8bbcd8');
    ctx.globalAlpha = 0.55;
    poly([pts[0], pts[1], lerp(pts[1], pts[2], 0.55), lerp(pts[0], pts[3], 0.55)], '#e8f6ff');
    ctx.globalAlpha = 1;
    var m0 = lerp(pts[0], pts[1], 0.5), m1 = lerp(pts[3], pts[2], 0.5);
    ctx.strokeStyle = '#f2e3c6';
    ctx.lineWidth = 1.6 * z;
    ctx.beginPath();
    ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]);
    ctx.stroke();
    if (shutters) {
      poly(wquad(g, side, uc - uw / 2 - uw * 0.42, uc - uw / 2, v0, v1), '#5e8f4a');
      poly(wquad(g, side, uc + uw / 2, uc + uw / 2 + uw * 0.42, v0, v1), '#4f7f3e');
    }
  }

  // Врата с рамка, крило и дръжка
  function doorOn(g, side, uc, uw, hgt, color) {
    var z = g.z;
    poly(wquad(g, side, uc - uw / 2, uc + uw / 2, 0, hgt), '#f2e3c6');
    poly(wquad(g, side, uc - uw / 2 + 0.02, uc + uw / 2 - 0.02, 0, hgt - 2.5 * z), color);
    var knob = wpt(g, side, uc + uw / 2 - 0.05, hgt * 0.5);
    ell(knob[0], knob[1], 1.8 * z, 1.8 * z, '#f6c343');
    ctx.globalAlpha = 0.25;
    poly(wquad(g, side, uc - uw / 2, uc, 0, hgt - 2.5 * z), '#000000');
    ctx.globalAlpha = 1;
  }

  // Четирискатен покрив с редове керемиди
  function hipRoof(g, wallH, rise, color, over) {
    var z = g.z;
    var top = g.cy - wallH;
    var rw = g.w * (over || 1.18), rh = g.h * (over || 1.18);
    var N = [g.cx, top - rh / 2], Sp = [g.cx, top + rh / 2];
    var W = [g.cx - rw / 2, top], E = [g.cx + rw / 2, top];
    var A = [g.cx, top - rise];

    function slope(p, q, shade) {
      poly([p, q, A], tint(color, shade));
      ctx.strokeStyle = tint(color, shade - 16);
      ctx.lineWidth = 1.1 * z;
      for (var k = 1; k <= 3; k++) {
        var a = lerp(p, A, k / 4), b = lerp(q, A, k / 4);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
    }
    slope(N, W, DARK);
    slope(N, E, -20);
    slope(W, Sp, -2);
    slope(E, Sp, LIT);
    // ръб на стряхата
    ctx.strokeStyle = tint(color, -40);
    ctx.lineWidth = 2 * z;
    ctx.beginPath();
    ctx.moveTo(W[0], W[1]); ctx.lineTo(Sp[0], Sp[1]); ctx.lineTo(E[0], E[1]);
    ctx.stroke();
    return { top: top, apex: A, W: W, E: E, S: Sp, N: N };
  }

  // Плевнешки покрив: било по оста северозапад–югоизток и чело към зрителя
  function gambrelRoof(g, wallH, rise, color, wallColor) {
    var z = g.z;
    var top = g.cy - wallH;
    var w = g.w * 1.08, h = g.h * 1.08;
    var W = [g.cx - w / 2, top], N = [g.cx, top - h / 2];
    var E = [g.cx + w / 2, top], Sp = [g.cx, top + h / 2];
    var R1 = [g.cx - w / 4, top - h / 4 - rise];
    var R2 = [g.cx + w / 4, top + h / 4 - rise];
    var kW = lerp(W, R1, 0.5); kW[1] -= rise * 0.18;
    var kS = lerp(Sp, R2, 0.5); kS[1] -= rise * 0.18;
    var kN = lerp(N, R1, 0.5); kN[1] -= rise * 0.18;
    var kE = lerp(E, R2, 0.5); kE[1] -= rise * 0.18;

    // заден скат
    poly([N, E, kE, R2, R1, kN], tint(color, DARK));
    // преден скат на две части
    poly([W, Sp, kS, kW], tint(color, -4));
    poly([kW, kS, R2, R1], tint(color, LIT));
    ctx.strokeStyle = tint(color, -30);
    ctx.lineWidth = 1.1 * z;
    for (var k = 1; k <= 2; k++) {
      var a = lerp(W, kW, k / 3), b = lerp(Sp, kS, k / 3);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // чело (гамбрел профил) — тук идват вратата и сеновалът
    poly([Sp, kS, R2, kE, E], tint(wallColor, 6), tint(wallColor, -34), 1.4 * z);
    // kN е зрителният връх на покрива — билото R1 стърчи като тънък клин
    return { S: Sp, E: E, kS: kS, kE: kE, kN: kN, R1: R1, R2: R2, top: top };
  }

  // Конусен покрив за кръглата мелница
  function coneRoof(cx, cy, r, hgt, color, z) {
    // Осем клина около целия кръг; най-светъл е обърнатият на юг.
    for (var i = 0; i < 8; i++) {
      var a0 = i * Math.PI / 4, a1 = a0 + Math.PI / 4;
      var mid = (a0 + a1) / 2;
      var lightness = DARK + (Math.sin(mid) + 1) / 2 * (LIT - DARK);
      poly([[cx, cy - hgt],
        [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r * 0.5],
        [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r * 0.5]],
        tint(color, lightness));
    }
    // стреха
    ctx.strokeStyle = tint(color, -38);
    ctx.lineWidth = 2 * z;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.5, 0, 0, Math.PI);
    ctx.stroke();
  }

  function chimney(cx, cy, z, color) {
    var w = 9 * z, hgt = 22 * z;
    poly([[cx - w / 2, cy], [cx, cy + w * 0.3], [cx, cy + w * 0.3 - hgt], [cx - w / 2, cy - hgt]], tint(color, SIDE_L));
    poly([[cx + w / 2, cy], [cx, cy + w * 0.3], [cx, cy + w * 0.3 - hgt], [cx + w / 2, cy - hgt]], tint(color, SIDE_R));
    diamond(cx, cy - hgt, w * 1.5, w * 0.7);
    ctx.fillStyle = tint(color, LIT);
    ctx.fill();
  }

  function awning(g, side, u0, u1, v, color, z) {
    // раирана тента над витрина
    var a = wpt(g, side, u0, v), b = wpt(g, side, u1, v);
    var out = side === 'r' ? [10 * z, 6 * z] : [-10 * z, 6 * z];
    var a2 = [a[0] + out[0], a[1] + out[1] + 6 * z], b2 = [b[0] + out[0], b[1] + out[1] + 6 * z];
    poly([a, b, b2, a2], color);
    ctx.save();
    poly([a, b, b2, a2]);
    ctx.clip();
    ctx.fillStyle = '#fffaf0';
    for (var i = 0; i < 6; i++) {
      var t0 = i / 6, t1 = t0 + 1 / 12;
      poly([lerp(a, b, t0), lerp(a, b, t1), lerp(a2, b2, t1), lerp(a2, b2, t0)], '#fffaf0');
    }
    ctx.restore();
    ctx.strokeStyle = tint(color, -26);
    ctx.lineWidth = 1.4 * z;
    ctx.beginPath();
    ctx.moveTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]);
    ctx.stroke();
  }

  function flowerBox(g, side, uc, v, z) {
    var pts = wquad(g, side, uc - 0.12, uc + 0.12, v, v + 6 * z);
    poly(pts, '#8a5f33');
    var mid = lerp(lerp(pts[3], pts[2], 0.5), lerp(pts[0], pts[1], 0.5), 0.5);
    for (var i = -1; i <= 1; i++) {
      ell(mid[0] + i * 5 * z, mid[1] - 4 * z, 3.4 * z, 2.6 * z, '#4f9e3a');
      ell(mid[0] + i * 5 * z, mid[1] - 6 * z, 2 * z, 2 * z, ['#e8536b', '#f4d03f', '#ffffff'][i + 1]);
    }
  }

  // --- Сградите ----------------------------------------------------------
  var BOX = { w: 240, h: 230, ax: 120, ay: 168 };

  var BUILDERS = {
    // Фуражен цех: дъсчена плевня със сламен покрив и бали сено
    feedmill: function (z) {
      var g = geom(1.5, z), wallH = 34 * z;
      walls(g, wallH, '#c9a86a');
      planks(g, 'r', wallH, '#c9a86a', 7);
      planks(g, 'l', wallH, '#c9a86a', 7);
      doorOn(g, 'r', 0.5, 0.42, wallH * 0.72, '#7a5230');
      ctx.strokeStyle = '#5f3f22';
      ctx.lineWidth = 1.6 * z;
      var d0 = wpt(g, 'r', 0.5, 0), d1 = wpt(g, 'r', 0.5, wallH * 0.72);
      ctx.beginPath(); ctx.moveTo(d0[0], d0[1]); ctx.lineTo(d1[0], d1[1]); ctx.stroke();
      windowOn(g, 'l', 0.55, 0.26, wallH * 0.42, wallH * 0.78);
      var roof = hipRoof(g, wallH, 30 * z, '#d9b45c', 1.22);
      // назъбен ръб на сламата
      ctx.fillStyle = tint('#d9b45c', -22);
      for (var e = 0; e < 14; e++) {
        var t0 = e / 14, t1 = t0 + 1 / 28;
        var edgeA = t0 < 0.5 ? lerp(roof.W, roof.S, t0 * 2) : lerp(roof.S, roof.E, (t0 - 0.5) * 2);
        var edgeB = t1 < 0.5 ? lerp(roof.W, roof.S, t1 * 2) : lerp(roof.S, roof.E, (t1 - 0.5) * 2);
        poly([edgeA, edgeB, [(edgeA[0] + edgeB[0]) / 2, (edgeA[1] + edgeB[1]) / 2 + 5 * z]], tint('#d9b45c', -24));
      }
      // бали сено отпред
      var b = wpt(g, 'r', 1.02, 0);
      ell(b[0] + 6 * z, b[1] + 4 * z, 10 * z, 5 * z, '#e0b957');
      poly([[b[0] - 2 * z, b[1] + 4 * z], [b[0] + 14 * z, b[1] + 4 * z], [b[0] + 14 * z, b[1] - 7 * z], [b[0] - 2 * z, b[1] - 7 * z]], '#e8c463');
      ell(b[0] + 6 * z, b[1] - 7 * z, 8 * z, 3.6 * z, '#f0d27c');
      ctx.strokeStyle = '#b8913f';
      ctx.lineWidth = 1.4 * z;
      ctx.beginPath();
      ctx.moveTo(b[0] + 2 * z, b[1] + 4 * z); ctx.lineTo(b[0] + 2 * z, b[1] - 6 * z);
      ctx.moveTo(b[0] + 10 * z, b[1] + 4 * z); ctx.lineTo(b[0] + 10 * z, b[1] - 6 * z);
      ctx.stroke();
    },

    // Мелница: кръгла каменна кула с конусен покрив
    mill: function (z) {
      var g = geom(1.35, z);
      var r = g.w * 0.36, base = g.cy + 4 * z, hgt = 52 * z;
      shadow(g.cx, g.cy + 6 * z, r * 1.25, r * 0.7, 0.22);
      diamond(g.cx, g.cy + 4 * z, g.w + 4 * z, g.h + 2 * z);
      ctx.fillStyle = '#b8ad99';
      ctx.fill();
      // тяло на кулата, леко стеснено нагоре
      var rt = r * 0.82;
      poly([[g.cx - r, base], [g.cx + r, base], [g.cx + rt, base - hgt], [g.cx - rt, base - hgt]], '#e3d3b4');
      ctx.globalAlpha = 0.5;
      poly([[g.cx - r, base], [g.cx - r * 0.3, base], [g.cx - rt * 0.3, base - hgt], [g.cx - rt, base - hgt]], '#a89c88');
      ctx.globalAlpha = 1;
      ell(g.cx, base, r, r * 0.42, '#cbbb9a');
      // редове камъни
      ctx.strokeStyle = 'rgba(120,108,88,.5)';
      ctx.lineWidth = 1.1 * z;
      for (var i = 1; i <= 4; i++) {
        var yy = base - hgt * i / 5;
        var rr = r + (rt - r) * (i / 5);
        ctx.beginPath();
        ctx.ellipse(g.cx, yy, rr, rr * 0.3, 0, 0.1, Math.PI - 0.1);
        ctx.stroke();
      }
      ell(g.cx, base - hgt, rt, rt * 0.42, '#efe0c2');
      // вратичка и прозорче
      poly([[g.cx - 7 * z, base], [g.cx + 7 * z, base], [g.cx + 7 * z, base - 20 * z], [g.cx, base - 25 * z], [g.cx - 7 * z, base - 20 * z]], '#7a5230');
      ell(g.cx + 4 * z, base - 11 * z, 1.6 * z, 1.6 * z, '#f6c343');
      ell(g.cx - r * 0.45, base - hgt * 0.66, 4.5 * z, 5 * z, '#f2e3c6');
      ell(g.cx - r * 0.45, base - hgt * 0.66, 3.2 * z, 3.6 * z, '#8bbcd8');
      // дървена галерия под покрива
      ell(g.cx, base - hgt + 2 * z, rt * 1.16, rt * 0.5, '#8a6a3a');
      ell(g.cx, base - hgt, rt * 1.16, rt * 0.5, '#a8834f');
      coneRoof(g.cx, base - hgt - 2 * z, rt * 1.3, 32 * z, '#9a4b3c', z);
    },

    // Фурна: тухлена фасада с тента, витрина и комин
    bakery: function (z) {
      var g = geom(1.5, z), wallH = 34 * z;
      walls(g, wallH, '#d98f6a');
      // тухлени редове
      ctx.strokeStyle = 'rgba(140,70,44,.6)';
      ctx.lineWidth = 1.3 * z;
      for (var i = 1; i < 7; i++) {
        var v = wallH * i / 7;
        ['r', 'l'].forEach(function (side) {
          var a = wpt(g, side, 0, v), b = wpt(g, side, 1, v);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          // напречни фуги, разместени през ред
          for (var k = 0; k < 5; k++) {
            var u = (k + (i % 2 ? 0.25 : 0.75)) / 5;
            var p0 = wpt(g, side, u, v), p1 = wpt(g, side, u, v - wallH / 7);
            ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
          }
        });
      }
      // витрина с хлябове
      poly(wquad(g, 'r', 0.08, 0.66, wallH * 0.2, wallH * 0.78), '#f6ecd8');
      var shelf = wquad(g, 'r', 0.12, 0.62, wallH * 0.24, wallH * 0.74);
      poly(shelf, '#d8ecf6');
      ctx.globalAlpha = 0.5;
      poly([shelf[0], shelf[1], lerp(shelf[1], shelf[2], 0.4), lerp(shelf[0], shelf[3], 0.4)], '#ffffff');
      ctx.globalAlpha = 1;
      for (var k = 0; k < 3; k++) {
        var pos = lerp(lerp(shelf[0], shelf[1], 0.16 + k * 0.32), lerp(shelf[3], shelf[2], 0.16 + k * 0.32), 0.62);
        ell(pos[0], pos[1], 5 * z, 3.2 * z, '#b5763a');
        ell(pos[0], pos[1] - 1.4 * z, 4 * z, 2.2 * z, '#dda45f');
      }
      awning(g, 'r', 0.04, 0.7, wallH * 0.82, '#c8452f', z);
      doorOn(g, 'l', 0.62, 0.3, wallH * 0.7, '#8a5f33');
      hipRoof(g, wallH, 28 * z, '#b5483a', 1.2);
      chimney(g.cx - g.w * 0.2, g.cy - wallH - 20 * z, z, '#a2503f');
    },

    // Мандра: бяла сграда със син покрив и гюмове отпред
    dairy: function (z) {
      var g = geom(1.5, z), wallH = 33 * z;
      walls(g, wallH, '#f0f4f8');
      windowOn(g, 'r', 0.3, 0.24, wallH * 0.34, wallH * 0.74, true);
      windowOn(g, 'r', 0.72, 0.24, wallH * 0.34, wallH * 0.74, true);
      doorOn(g, 'l', 0.5, 0.34, wallH * 0.74, '#4d8fd6');
      hipRoof(g, wallH, 27 * z, '#4d8fd6', 1.2);
      // гюмове
      var base = wpt(g, 'r', 1.05, 0);
      for (var i = 0; i < 2; i++) {
        var cx = base[0] + 4 * z + i * 11 * z, cy = base[1] + 6 * z - i * 3 * z;
        ell(cx, cy, 5 * z, 2.4 * z, '#9aa7b0');
        poly([[cx - 5 * z, cy], [cx + 5 * z, cy], [cx + 4 * z, cy - 13 * z], [cx - 4 * z, cy - 13 * z]], '#c3ced6');
        poly([[cx, cy], [cx + 5 * z, cy], [cx + 4 * z, cy - 13 * z], [cx, cy - 13 * z]], '#aab6c0');
        ell(cx, cy - 13 * z, 4 * z, 1.9 * z, '#dfe6ea');
      }
    },

    // Сладкарница: розова фасада с бяло-червена тента и буркани
    jamshop: function (z) {
      var g = geom(1.5, z), wallH = 33 * z;
      walls(g, wallH, '#f2cdd6');
      poly(wquad(g, 'r', 0.16, 0.66, wallH * 0.26, wallH * 0.7), '#fffaf0');
      var shelf = wquad(g, 'r', 0.19, 0.63, wallH * 0.29, wallH * 0.67);
      poly(shelf, '#f6e2c4');
      for (var k = 0; k < 3; k++) {
        var pos = lerp(lerp(shelf[0], shelf[1], 0.2 + k * 0.28), lerp(shelf[3], shelf[2], 0.2 + k * 0.28), 0.5);
        poly([[pos[0] - 3 * z, pos[1] + 4 * z], [pos[0] + 3 * z, pos[1] + 4 * z],
          [pos[0] + 3 * z, pos[1] - 4 * z], [pos[0] - 3 * z, pos[1] - 4 * z]], ['#e0344a', '#f0a92a', '#b0407a'][k]);
        poly([[pos[0] - 3.4 * z, pos[1] - 4 * z], [pos[0] + 3.4 * z, pos[1] - 4 * z],
          [pos[0] + 3.4 * z, pos[1] - 6 * z], [pos[0] - 3.4 * z, pos[1] - 6 * z]], '#f2e3c6');
      }
      awning(g, 'r', 0.13, 0.69, wallH * 0.74, '#c2415a', z);
      doorOn(g, 'l', 0.55, 0.3, wallH * 0.72, '#b0407a');
      hipRoof(g, wallH, 28 * z, '#c2415a', 1.2);
      chimney(g.cx - g.w * 0.18, g.cy - wallH - 18 * z, z, '#a63558');
    },

    // Тъкачница: фахверк и простор с прежди
    loom: function (z) {
      var g = geom(1.5, z), wallH = 34 * z;
      walls(g, wallH, '#efe6d4');
      // тъмни греди
      ctx.strokeStyle = '#6b4a2a';
      ctx.lineWidth = 2.6 * z;
      ['l', 'r'].forEach(function (side) {
        var a = wpt(g, side, 0, wallH * 0.55), b = wpt(g, side, 1, wallH * 0.55);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        for (var i = 0; i <= 3; i++) {
          var u = i / 3;
          var c = wpt(g, side, u, 0), d = wpt(g, side, u, wallH);
          ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
        }
        var x1 = wpt(g, side, 0.02, wallH * 0.56), x2 = wpt(g, side, 0.31, wallH);
        ctx.beginPath(); ctx.moveTo(x1[0], x1[1]); ctx.lineTo(x2[0], x2[1]); ctx.stroke();
      });
      windowOn(g, 'r', 0.5, 0.26, wallH * 0.62, wallH * 0.94);
      doorOn(g, 'r', 0.85, 0.26, wallH * 0.52, '#7a5230');
      hipRoof(g, wallH, 29 * z, '#7a5ca8', 1.2);
      // простор с боядисани прежди
      var a1 = wpt(g, 'l', 0.1, wallH * 0.8), a2 = [g.cx - g.w * 0.62, g.cy + g.h * 0.12];
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = 1.4 * z;
      ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.stroke();
      var cols = ['#d9628a', '#f2b705', '#4d8fd6'];
      for (var i = 0; i < 3; i++) {
        var pt = lerp(a1, a2, 0.25 + i * 0.24);
        poly([[pt[0] - 3 * z, pt[1]], [pt[0] + 3 * z, pt[1]], [pt[0] + 2.4 * z, pt[1] + 10 * z], [pt[0] - 2.4 * z, pt[1] + 10 * z]], cols[i]);
      }
    }
  };

  // Хамбар: класическа червена плевня с гамбрел покрив
  function barnPainter(z) {
    var g = geom(1.6, z), wallH = 32 * z;
    walls(g, wallH, '#c8452f');
    planks(g, 'l', wallH, '#c8452f', 8);
    var r = gambrelRoof(g, wallH, 30 * z, '#8e2f21', '#c8452f');
    // голяма врата с бели греди на челото
    doorOn(g, 'r', 0.5, 0.5, wallH * 0.86, '#e8ddc8');
    var p0 = wpt(g, 'r', 0.27, 2 * z), p1 = wpt(g, 'r', 0.73, wallH * 0.84);
    var p2 = wpt(g, 'r', 0.73, 2 * z), p3 = wpt(g, 'r', 0.27, wallH * 0.84);
    ctx.strokeStyle = '#c8452f';
    ctx.lineWidth = 3 * z;
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]);
    ctx.moveTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]);
    ctx.stroke();
    // сеновал в средата на челото, изчислен от самите му върхове
    var mid = lerp(r.S, r.E, 0.5);
    var c = lerp(mid, r.R2, 0.52);
    var half = 9 * z, high = 7 * z;
    poly([[c[0] - half, c[1] - high], [c[0] + half, c[1] - high + (r.E[1] - r.S[1]) * 0.12],
      [c[0] + half, c[1] + high + (r.E[1] - r.S[1]) * 0.12], [c[0] - half, c[1] + high]], '#e8ddc8');
    poly([[c[0] - half + 2 * z, c[1] - high + 2 * z], [c[0] + half - 2 * z, c[1] - high + 2 * z + (r.E[1] - r.S[1]) * 0.12],
      [c[0] + half - 2 * z, c[1] + high - 2 * z + (r.E[1] - r.S[1]) * 0.12], [c[0] - half + 2 * z, c[1] + high - 2 * z]], '#5f3f22');
    // макара над сеновала
    var hook = lerp(mid, r.R2, 0.86);
    ctx.strokeStyle = '#6b5334';
    ctx.lineWidth = 1.8 * z;
    ctx.beginPath();
    ctx.moveTo(hook[0], hook[1]); ctx.lineTo(hook[0] + 7 * z, hook[1] + 2 * z);
    ctx.stroke();
    ell(hook[0] + 8 * z, hook[1] + 3 * z, 2.4 * z, 2.4 * z, '#8a6a3a');
    // ветропоказател на върха на билото
    ctx.strokeStyle = '#5b4a35';
    ctx.lineWidth = 1.8 * z;
    ctx.beginPath();
    var v = r.kN;
    ctx.moveTo(v[0], v[1] + 2 * z); ctx.lineTo(v[0], v[1] - 14 * z);
    ctx.stroke();
    poly([[v[0] - 6 * z, v[1] - 15 * z], [v[0] + 3 * z, v[1] - 18 * z],
      [v[0] + 3 * z, v[1] - 16 * z], [v[0] + 8 * z, v[1] - 16 * z],
      [v[0] + 8 * z, v[1] - 14 * z], [v[0] + 3 * z, v[1] - 14 * z],
      [v[0] + 3 * z, v[1] - 12 * z]], '#5b4a35');
  }

  // Къща: уютна къщурка с веранда, цветя и комин
  function housePainter(z) {
    var g = geom(1.5, z), wallH = 32 * z;
    walls(g, wallH, '#f2dfa8');
    windowOn(g, 'l', 0.35, 0.26, wallH * 0.38, wallH * 0.76, true);
    windowOn(g, 'r', 0.76, 0.24, wallH * 0.38, wallH * 0.76, true);
    doorOn(g, 'r', 0.32, 0.3, wallH * 0.74, '#a0522d');
    flowerBox(g, 'l', 0.35, wallH * 0.3, z);
    hipRoof(g, wallH, 30 * z, '#c0563d', 1.24);
    chimney(g.cx + g.w * 0.22, g.cy - wallH - 22 * z, z, '#9a6b4a');
    // навес на верандата пред вратата
    var a = wpt(g, 'r', 0.16, wallH * 0.82), b = wpt(g, 'r', 0.5, wallH * 0.82);
    var a2 = [a[0] + 12 * z, a[1] + 9 * z], b2 = [b[0] + 12 * z, b[1] + 9 * z];
    poly([a, b, b2, a2], '#a3432f');
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 2.2 * z;
    ctx.beginPath();
    ctx.moveTo(a2[0], a2[1]); ctx.lineTo(a2[0], a2[1] + 20 * z);
    ctx.moveTo(b2[0], b2[1]); ctx.lineTo(b2[0], b2[1] + 20 * z);
    ctx.stroke();
    // пътечка от плочки
    var step = wpt(g, 'r', 0.33, 0);
    for (var i = 0; i < 3; i++) {
      ell(step[0] + 8 * z + i * 9 * z, step[1] + 6 * z + i * 5 * z, 6 * z, 3 * z, '#c2b8a3');
    }
  }

  function buildingSprite(id, z) {
    return sprite('bld_' + id, z, BOX, BUILDERS[id]);
  }

  function structBase(obj) { return worldToScreen(obj.x + 1, obj.y + 1); }

  // Празно място: чакълена площадка с пунктир
  function padSprite(z) {
    return sprite('pad', z, { w: TW * 1.9, h: TH * 2.4, ax: TW * 0.95, ay: TH * 1.2 }, function (s) {
      var w = TW * 1.6 * s, h = TH * 1.6 * s;
      diamond(0, 0, w, h);
      ctx.fillStyle = '#93b95e';
      ctx.fill();
      ctx.globalAlpha = 0.45;
      diamond(0, 0, w * 0.72, h * 0.72);
      ctx.fillStyle = '#c2b8a3';
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.setLineDash([9 * s, 7 * s]);
      ctx.strokeStyle = 'rgba(90,64,36,.85)';
      ctx.lineWidth = 3 * s;
      diamond(0, 0, w, h);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  function drawGhost(cx, cy, z, name, note) {
    stamp(padSprite(z), cx, cy);
    signBadge(cx, cy - 30 * z, z, 'plus');
    woodSign(cx, cy + 26 * z, z, name, note);
  }

  var BUILD_ICON = {
    feedmill: 'feed', mill: 'flour', bakery: 'bread',
    dairy: 'cheese', jamshop: 'jam', loom: 'yarn'
  };

  function drawBuilding(obj, t) {
    var G = global.G, S0 = S();
    var st = S0.buildings[obj.id];
    var def = D.buildingById(obj.id);
    var p = structBase(obj);
    var z = cam.z;

    if (!st.owned) {
      drawGhost(p.x, p.y, z, def.name, S0.level >= def.lvl ? def.cost + ' монети' : 'Ниво ' + def.lvl);
      return;
    }

    stamp(buildingSprite(obj.id, z), p.x, p.y);

    // движещите се части се рисуват на живо
    if (obj.id === 'mill') {
      var mx = p.x + 3 * z, my = p.y - 64 * z;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(t / 2600);
      for (var b = 0; b < 4; b++) {
        ctx.rotate(Math.PI / 2);
        poly([[3 * z, -4.4 * z], [34 * z, -3 * z], [34 * z, 4 * z], [3 * z, 4.6 * z]], '#f6ecd8', '#8a6a3a', 1.6 * z);
        ctx.strokeStyle = 'rgba(138,106,58,.55)';
        ctx.lineWidth = 1.1 * z;
        for (var s2 = 1; s2 < 5; s2++) {
          ctx.beginPath();
          ctx.moveTo(3 * z + s2 * 6.4 * z, -4 * z); ctx.lineTo(3 * z + s2 * 6.4 * z, 4.4 * z);
          ctx.stroke();
        }
      }
      ctx.restore();
      ell(mx, my, 4.4 * z, 4.4 * z, '#6b4726');
      ell(mx - 1 * z, my - 1 * z, 1.8 * z, 1.8 * z, '#a8834f');
    }
    if (obj.id === 'bakery' || obj.id === 'jamshop') {
      if (st.queue.length) smoke(p.x - 30 * z, p.y - 88 * z, z, t, obj.id.length);
    }

    var ready = G.buildingReady(obj.id);
    if (ready) {
      bubble(p.x, p.y - 104 * z - Math.sin(t / 420) * 4 * z, D.recipeById(st.queue[0].r).out, z);
    } else if (st.queue.length) {
      var q = st.queue[0];
      var r = D.recipeById(q.r);
      progressBar(p.x, p.y - 96 * z, 44 * z, 1 - Math.max(0, q.done - G.sec()) / r.time, z);
    } else {
      signBadge(p.x, p.y - 100 * z, z, BUILD_ICON[obj.id] || 'barn');
    }
  }

  function smoke(cx, cy, z, t, seed) {
    ctx.save();
    for (var i = 0; i < 4; i++) {
      var k = ((t / 1600) + i / 4 + seed) % 1;
      ctx.globalAlpha = (1 - k) * 0.42;
      ell(cx + Math.sin(k * 5 + seed) * 7 * z, cy - k * 46 * z, (4 + k * 9) * z, (3.4 + k * 8) * z, '#f2f2ee');
    }
    ctx.restore();
  }

  function drawBarn(obj, t) {
    var p = structBase(obj), z = cam.z;
    stamp(sprite('barn', z, BOX, barnPainter), p.x, p.y);
  }

  function drawHouse(obj, t) {
    var p = structBase(obj), z = cam.z;
    stamp(sprite('house', z, BOX, housePainter), p.x, p.y);
    smoke(p.x + 32 * z, p.y - 96 * z, z, t, 0.4);
  }

  // --- Кошари и животни --------------------------------------------------
  function penSprite(penId, z) {
    var def = D.PENS[penId];
    return sprite('pen_' + penId, z, { w: 260, h: 200, ax: 130, ay: 120 }, function (s) {
      var w = TW * 1.95 * s, h = TH * 1.95 * s;
      // тревна площадка с утъпкана пътека
      diamond(0, 0, w, h);
      ctx.fillStyle = '#a6cf63';
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ell(2 * s, 4 * s, w * 0.3, h * 0.28, '#c2ae7e');
      ctx.globalAlpha = 1;
      diamond(0, 0, w, h);
      ctx.strokeStyle = 'rgba(120,90,50,.35)';
      ctx.lineWidth = 2 * s;
      ctx.stroke();

      // ограда: колчета с две напречни дъски по четирите ръба
      var corners = [[-w / 2, 0], [0, -h / 2], [w / 2, 0], [0, h / 2]];
      for (var e = 0; e < 4; e++) {
        var a = corners[e], b = corners[(e + 1) % 4];
        var behind = e === 0 || e === 1;
        ctx.strokeStyle = behind ? '#a8834f' : '#c9a87a';
        ctx.lineWidth = 2.6 * s;
        ctx.lineCap = 'round';
        for (var rail = 0; rail < 2; rail++) {
          var lift = 8 * s + rail * 8 * s;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1] - lift); ctx.lineTo(b[0], b[1] - lift);
          ctx.stroke();
        }
        for (var i = 0; i < 3; i++) {
          var px = a[0] + (b[0] - a[0]) * (i / 3), py = a[1] + (b[1] - a[1]) * (i / 3);
          poly([[px - 2.2 * s, py], [px + 2.2 * s, py], [px + 2.2 * s, py - 20 * s], [px, py - 22.5 * s], [px - 2.2 * s, py - 20 * s]],
            behind ? '#b08a58' : '#d9b98a');
        }
      }

      if (def.animal === 'bee') {
        // пчелин: три кошера и цветя
        for (var k = 0; k < 3; k++) {
          var bx = (-22 + k * 22) * s, by = (-10 + (k % 2) * 12) * s;
          shadow(bx, by + 2 * s, 11 * s, 4 * s, 0.2);
          for (var lay = 0; lay < 3; lay++) {
            var ly = by - lay * 7 * s;
            poly([[bx - 10 * s, ly], [bx + 10 * s, ly], [bx + 10 * s, ly - 7 * s], [bx - 10 * s, ly - 7 * s]],
              lay % 2 ? '#e8a33a' : '#f0b95a');
          }
          diamond(bx, by - 22 * s, 26 * s, 12 * s);
          ctx.fillStyle = '#c8452f';
          ctx.fill();
          ell(bx, by - 4 * s, 2.6 * s, 1.6 * s, '#6b4726');
        }
      } else {
        // навес: два стълба, покрив и сено/корито
        var sx = -26 * s, sy = -14 * s;
        var sw = 46 * s, sh = 22 * s, wallH = 20 * s;
        poly([[sx - sw / 2, sy], [sx, sy + sh / 2], [sx, sy + sh / 2 - wallH], [sx - sw / 2, sy - wallH]], '#a8763f');
        poly([[sx + sw / 2, sy], [sx, sy + sh / 2], [sx, sy + sh / 2 - wallH], [sx + sw / 2, sy - wallH]], '#c99a5e');
        poly([[sx - sw / 2 - 3 * s, sy - wallH], [sx, sy + sh / 2 - wallH], [sx, sy - sh / 2 - wallH - 10 * s], [sx - sw / 2 - 3 * s, sy - wallH - 10 * s]], '#8e3f30');
        poly([[sx + sw / 2 + 3 * s, sy - wallH], [sx, sy + sh / 2 - wallH], [sx, sy - sh / 2 - wallH - 10 * s], [sx + sw / 2 + 3 * s, sy - wallH - 10 * s]], '#b5483a');
        ell(sx + 5 * s, sy - 2 * s, 7 * s, 6 * s, 'rgba(60,40,20,.75)');
        if (def.animal === 'chicken') {
          // рампа към курника
          poly([[sx + 6 * s, sy + 2 * s], [sx + 20 * s, sy + 10 * s], [sx + 22 * s, sy + 8 * s], [sx + 8 * s, sy]], '#b08a58');
        } else {
          // корито с вода
          var tx = 26 * s, ty = 8 * s;
          poly([[tx - 13 * s, ty], [tx + 13 * s, ty], [tx + 10 * s, ty - 8 * s], [tx - 10 * s, ty - 8 * s]], '#8a5f33');
          ell(tx, ty - 8 * s, 10 * s, 3.4 * s, '#5fa5d4');
          // бала сено
          ell(-6 * s, 16 * s, 9 * s, 4 * s, '#e0b957');
          poly([[-14 * s, 16 * s], [2 * s, 16 * s], [2 * s, 8 * s], [-14 * s, 8 * s]], '#e8c463');
          ell(-6 * s, 8 * s, 8 * s, 3.4 * s, '#f0d27c');
        }
      }
    });
  }

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

    stamp(penSprite(obj.id, z), p.x, p.y);

    var an = D.animalById(def.animal);
    for (var a = 0; a < st.animals.length; a++) {
      var beast = st.animals[a];
      var ph = t / 2400 + a * 1.9;
      var ax = p.x + Math.sin(ph) * 30 * z + (a - st.animals.length / 2) * 12 * z;
      var ay = p.y + Math.cos(ph * 0.8) * 10 * z + 12 * z;
      drawAnimal(def.animal, ax, ay, z, Math.cos(ph) >= 0 ? 1 : -1, beast.fed, t + a * 500);
    }

    var ready = G.penReadyCount(obj.id);
    if (ready) {
      bubble(p.x, p.y - 72 * z - Math.sin(t / 420) * 4 * z, an.item, z);
    } else if (st.animals.length && G.penNeedsFeed(obj.id) > 0) {
      bubble(p.x, p.y - 72 * z, 'feed', z);
    } else if (!st.animals.length) {
      signBadge(p.x, p.y - 64 * z, z, 'plus');
    } else {
      var nxt = G.penNextReady(obj.id);
      if (nxt) progressBar(p.x, p.y - 64 * z, 42 * z, 1 - nxt / an.time, z);
    }
  }

  // Животните са малки, затова се рисуват с плътни петна и ясен силует.
  function drawAnimal(kind, x, y, z, face, fed, t) {
    var s = z;
    shadow(x, y + 4 * s, 13 * s, 4.6 * s, 0.2);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face, 1);
    var bob = Math.sin(t / 520) * 1.3 * s;

    if (kind === 'chicken') {
      ell(3 * s, -8 * s + bob, 11 * s, 9 * s, '#e6dcc6');
      ell(0, -9 * s + bob, 10 * s, 8 * s, '#fdf6e6');
      ell(11 * s, -11 * s + bob, 5 * s, 6 * s, '#efe3cc', 0.5);
      ell(-9 * s, -17 * s + bob, 6.2 * s, 6 * s, '#fdf6e6');
      ell(-11 * s, -23 * s + bob, 3 * s, 3.4 * s, '#e0453a');
      ell(-8 * s, -24 * s + bob, 2.4 * s, 2.6 * s, '#e0453a');
      poly([[-14 * s, -17 * s + bob], [-20 * s, -15.5 * s + bob], [-14 * s, -14 * s + bob]], '#f0a92a');
      ell(-12 * s, -13 * s + bob, 2.6 * s, 1.6 * s, '#e0453a');
      ell(-11 * s, -18 * s + bob, 1.4 * s, 1.4 * s, '#3a2a1a');
      ctx.strokeStyle = '#f0a92a';
      ctx.lineWidth = 2 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-3 * s, -1 * s); ctx.lineTo(-3 * s, 3 * s);
      ctx.moveTo(4 * s, -1 * s); ctx.lineTo(4 * s, 3 * s);
      ctx.stroke();
    } else if (kind === 'cow') {
      ell(0, -12 * s + bob, 16 * s, 11 * s, '#fdf6e6');
      ell(5 * s, -15 * s + bob, 6 * s, 4.2 * s, '#4a4038', 0.3);
      ell(-5 * s, -8 * s + bob, 4.4 * s, 3.2 * s, '#4a4038');
      ell(16 * s, -16 * s + bob, 2.6 * s, 5 * s, '#4a4038', 0.4);
      ell(-15 * s, -20 * s + bob, 8 * s, 7 * s, '#fdf6e6');
      ell(-19 * s, -17 * s + bob, 4.6 * s, 3.6 * s, '#f0a9a2');
      ell(-20 * s, -17.6 * s + bob, 1 * s, 1 * s, '#c98a8a');
      ell(-17.6 * s, -17 * s + bob, 1 * s, 1 * s, '#c98a8a');
      ell(-18 * s, -23 * s + bob, 1.5 * s, 1.5 * s, '#3a2a1a');
      ell(-11 * s, -24 * s + bob, 1.5 * s, 1.5 * s, '#3a2a1a');
      ell(-21 * s, -26 * s + bob, 3.4 * s, 2.2 * s, '#d8ccb4', -0.5);
      ell(-9 * s, -26 * s + bob, 3.4 * s, 2.2 * s, '#d8ccb4', 0.5);
      ctx.strokeStyle = '#e8e0cc';
      ctx.lineWidth = 4 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-7 * s, -3 * s); ctx.lineTo(-7 * s, 3 * s);
      ctx.moveTo(8 * s, -3 * s); ctx.lineTo(8 * s, 3 * s);
      ctx.stroke();
    } else if (kind === 'sheep') {
      ell(0, -12 * s + bob, 15 * s, 11 * s, '#e8e5db');
      ell(-5 * s, -19 * s + bob, 7.4 * s, 6.4 * s, '#f7f5ee');
      ell(6 * s, -18 * s + bob, 7.4 * s, 6.4 * s, '#f7f5ee');
      ell(13 * s, -12 * s + bob, 6 * s, 6 * s, '#f0eee5');
      ell(-11 * s, -11 * s + bob, 6.4 * s, 6 * s, '#f7f5ee');
      ell(-15 * s, -16 * s + bob, 6 * s, 6.4 * s, '#4a4038');
      ell(-19 * s, -14 * s + bob, 2.6 * s, 2.2 * s, '#3a322c');
      ell(-17 * s, -18 * s + bob, 1.4 * s, 1.4 * s, '#fdf6e6');
      ell(-12.5 * s, -18.5 * s + bob, 1.4 * s, 1.4 * s, '#fdf6e6');
      ell(-19 * s, -20 * s + bob, 3 * s, 2 * s, '#3f372f', -0.6);
      ctx.strokeStyle = '#4a4038';
      ctx.lineWidth = 3.4 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-6 * s, -2 * s); ctx.lineTo(-6 * s, 3 * s);
      ctx.moveTo(7 * s, -2 * s); ctx.lineTo(7 * s, 3 * s);
      ctx.stroke();
    } else {
      for (var i = 0; i < 3; i++) {
        var a = t / 420 + i * 2.1;
        var bx = Math.cos(a) * 15 * s, by = -16 * s + Math.sin(a * 1.3) * 9 * s;
        ell(bx, by, 5 * s, 3.8 * s, '#f5c93a');
        ctx.fillStyle = '#3a3330';
        ctx.fillRect(bx - 1.2 * s, by - 3.8 * s, 1.8 * s, 7.6 * s);
        ctx.fillRect(bx + 2.4 * s, by - 3 * s, 1.6 * s, 6 * s);
        ell(bx - 4.4 * s, by, 1.8 * s, 1.8 * s, '#3a3330');
        ctx.globalAlpha = 0.75;
        ell(bx + 0.5 * s, by - 4.4 * s, 4 * s, 2 * s, '#e6f4ff', -0.3);
        ctx.globalAlpha = 1;
      }
    }

    if (fed) {
      ctx.globalAlpha = 0.55;
      ell(13 * s, -30 * s, 2.6 * s, 2.6 * s, '#7ad06a');
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // --- Свят: плочки, гора, ограда ----------------------------------------
  var WILD = [], FENCE = [];

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

  function buildWilderness() {
    WILD = [];
    var pad = 10;
    for (var y = -pad; y < D.WORLD.h + pad; y++) {
      for (var x = -pad; x < D.WORLD.w + pad; x++) {
        if (x >= -1 && y >= -1 && x <= D.WORLD.w && y <= D.WORLD.h) continue;
        var r = hash(x * 3 + 11, y * 5 + 7);
        if (r > 0.88) WILD.push({ kind: 'tree', x: x, y: y, v: 1 + Math.floor(hash(x, y) * 3) });
        else if (r > 0.8) WILD.push({ kind: 'bush', x: x, y: y, v: Math.floor(hash(y, x) * 2) });
        else if (r > 0.74) WILD.push({ kind: 'flower', x: x, y: y, v: Math.floor(hash(x + 5, y) * 4) });
        else if (r > 0.72) WILD.push({ kind: 'rock', x: x, y: y });
      }
    }
    // ограда по границата на стопанството
    FENCE = [];
    for (var fx = 0; fx < D.WORLD.w; fx++) {
      FENCE.push({ x: fx + 0.5, y: 0, dir: 'r' });
      FENCE.push({ x: fx + 0.5, y: D.WORLD.h, dir: 'r' });
    }
    for (var fy = 0; fy < D.WORLD.h; fy++) {
      FENCE.push({ x: 0, y: fy + 0.5, dir: 'l' });
      FENCE.push({ x: D.WORLD.w, y: fy + 0.5, dir: 'l' });
    }
  }

  // --- Камера ------------------------------------------------------------
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
    cam.x = clamp(cam.x, a.x, b.x);
    cam.y = clamp(cam.y, worldToScreenRaw(0, 0).y - 140, worldToScreenRaw(D.WORLD.w, D.WORLD.h).y + 140);
  }
  function focusOn(wx, wy) {
    var p = worldToScreenRaw(wx, wy);
    cam.x = p.x; cam.y = p.y;
    clampCam();
  }

  function pick(sx, sy) {
    var w = screenToWorld(sx, sy);
    var tx = Math.floor(w.x), ty = Math.floor(w.y);
    for (var back = 0; back <= 2; back++) {
      var hit = tileMap[(tx - back) + ',' + (ty - back)];
      if (hit && (back === 0 || hit.type !== 'plot')) return hit;
    }
    return null;
  }

  // --- Ден и нощ ---------------------------------------------------------
  // Небето следва истинския час на играча. Ключовите моменти се преливат
  // един в друг; наслагването е един полупрозрачен слой върху цялата сцена,
  // за да не се налага прерисуване на кешираните спрайтове.
  var SKY = [
    { h: 0,    top: '#131d36', bot: '#20304f', wash: [18, 30, 58], a: 0.62 },
    { h: 5,    top: '#1e3350', bot: '#3c5170', wash: [26, 44, 74], a: 0.56 },
    { h: 6.5,  top: '#f3b07a', bot: '#ffd9a8', wash: [242, 140, 86], a: 0.34 },
    { h: 8.5,  top: '#cfeaf7', bot: '#e6f2d9', wash: [255, 255, 255], a: 0 },
    { h: 16.5, top: '#cfeaf7', bot: '#e6f2d9', wash: [255, 255, 255], a: 0 },
    { h: 18.5, top: '#ffc98a', bot: '#ffe3b4', wash: [238, 132, 52], a: 0.4 },
    { h: 20,   top: '#8f6f9e', bot: '#d09a94', wash: [140, 70, 120], a: 0.48 },
    { h: 21.5, top: '#16233f', bot: '#2b3d61', wash: [18, 30, 58], a: 0.6 },
    { h: 24,   top: '#131d36', bot: '#20304f', wash: [18, 30, 58], a: 0.62 }
  ];

  function hourNow() {
    var d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  function mixHex(a, b, t) {
    var na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
    var r = Math.round(((na >> 16) & 255) + (((nb >> 16) & 255) - ((na >> 16) & 255)) * t);
    var g = Math.round(((na >> 8) & 255) + (((nb >> 8) & 255) - ((na >> 8) & 255)) * t);
    var bl = Math.round((na & 255) + ((nb & 255) - (na & 255)) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function skyNow() {
    var h = hourNow();
    var i = 0;
    while (i < SKY.length - 2 && SKY[i + 1].h <= h) i++;
    var a = SKY[i], b = SKY[i + 1];
    var t = (h - a.h) / (b.h - a.h);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var wash = [
      a.wash[0] + (b.wash[0] - a.wash[0]) * t,
      a.wash[1] + (b.wash[1] - a.wash[1]) * t,
      a.wash[2] + (b.wash[2] - a.wash[2]) * t
    ];
    // колко е „нощ" — по това се палят прозорците и светулките
    var night = h < 5.5 ? 1 : h < 7 ? (7 - h) / 1.5 : h < 18.5 ? 0 : h < 20.5 ? (h - 18.5) / 2 : 1;
    return {
      top: mixHex(a.top, b.top, t),
      bot: mixHex(a.bot, b.bot, t),
      wash: 'rgb(' + Math.round(wash[0]) + ',' + Math.round(wash[1]) + ',' + Math.round(wash[2]) + ')',
      alpha: a.a + (b.a - a.a) * t,
      night: night
    };
  }

  // Светнати прозорци: по няколко топли петна на сграда, спрямо основата ѝ.
  var LIGHTS = {
    feedmill: [[-32, 3]],
    mill: [[-21, -33]],
    bakery: [[25, 6], [-27, 5]],
    dairy: [[22, 7], [52, -8]],
    jamshop: [[29, 5]],
    loom: [[36, -8]],
    barn: [[38, 5]],
    house: [[-47, -5], [55, -9]]
  };

  function drawLight(x, y, z, strength) {
    var r = 17 * z;
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,206,120,' + (0.5 * strength) + ')');
    g.addColorStop(0.45, 'rgba(255,186,84,' + (0.18 * strength) + ')');
    g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ell(x, y, 2.6 * z, 2.1 * z, 'rgba(255,232,170,' + (0.55 * strength) + ')');
  }

  function drawNightLights(night, t) {
    var S0 = S(), z = cam.z;
    D.STRUCTURES.forEach(function (st) {
      var owned = st.kind === 'building' ? S0.buildings[st.id].owned
        : st.kind === 'pen' ? S0.pens[st.id].owned : true;
      if (!owned) return;
      var spots = LIGHTS[st.id];
      if (!spots) return;
      var p = worldToScreen(st.x + 1, st.y + 1);
      for (var i = 0; i < spots.length; i++) {
        var flicker = 0.9 + Math.sin(t / 900 + i * 2 + st.x) * 0.1;
        drawLight(p.x + spots[i][0] * z, p.y + spots[i][1] * z, z, night * flicker);
      }
    });
  }

  // Светулки над ливадата
  function drawFireflies(night, t) {
    var z = cam.z;
    for (var i = 0; i < 16; i++) {
      var bx = hash(i * 13 + 1, 7) * (D.WORLD.w + 6) - 3;
      var by = hash(i * 7 + 3, 11) * (D.WORLD.h + 6) - 3;
      var drift = Math.sin(t / 2600 + i) * 0.5;
      var p = worldToScreen(bx + drift, by + Math.cos(t / 3100 + i * 2) * 0.4);
      var lift = 16 + Math.sin(t / 700 + i * 3) * 8;
      var pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 600 + i * 1.7));
      ctx.save();
      ctx.globalAlpha = night * pulse;
      ell(p.x, p.y - lift * z, 3.4 * z, 3.4 * z, 'rgba(200,255,140,.35)');
      ell(p.x, p.y - lift * z, 1.4 * z, 1.4 * z, '#eaffb0');
      ctx.restore();
    }
  }

  // --- Летящи предмети и прашинки ---------------------------------------
  var flyers = [], puffs = [];

  // Праща иконата на прибраното към лентата горе — малка, но ясна награда.
  function fly(iconId, x, y, targetId) {
    var el = document.getElementById(targetId);
    var tx = viewW / 2, ty = 40;
    if (el) {
      var r = el.getBoundingClientRect();
      tx = r.left + r.width / 2;
      ty = r.top + r.height / 2;
    }
    flyers.push({
      icon: iconId, x0: x, y0: y, x1: tx, y1: ty,
      cx: (x + tx) / 2 + (x - tx) * 0.12, cy: Math.min(y, ty) - 70 - Math.random() * 40,
      born: performance.now(), life: 620 + Math.random() * 120
    });
    if (flyers.length > 24) flyers.shift();
  }

  function puff(x, y, color) {
    for (var i = 0; i < 7; i++) {
      var a = Math.PI * (0.15 + Math.random() * 0.7) * -1;
      puffs.push({
        x: x, y: y,
        vx: Math.cos(a) * (0.5 + Math.random()) * (Math.random() < 0.5 ? -1 : 1),
        vy: Math.sin(a) * (0.6 + Math.random() * 0.8),
        r: (2 + Math.random() * 2.5),
        color: color || '#e8d9b0',
        born: performance.now(), life: 420 + Math.random() * 260
      });
    }
    if (puffs.length > 80) puffs.splice(0, puffs.length - 80);
  }

  function drawEffects(t) {
    var now = performance.now(), z = cam.z;
    for (var i = puffs.length - 1; i >= 0; i--) {
      var q = puffs[i];
      var k = (now - q.born) / q.life;
      if (k >= 1) { puffs.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.85;
      var px = q.x + q.vx * k * 52 * z, py = q.y + q.vy * k * 44 * z + k * k * 30 * z;
      var pr = q.r * Math.max(0.9, z) * (1 - k * 0.35);
      ell(px, py, pr + 1, pr + 1, 'rgba(60,42,20,.35)');
      ell(px, py, pr, pr, q.color);
      ctx.restore();
    }
    for (var f = flyers.length - 1; f >= 0; f--) {
      var fl = flyers[f];
      var k2 = (now - fl.born) / fl.life;
      if (k2 >= 1) { flyers.splice(f, 1); continue; }
      var u = k2 * k2 * (3 - 2 * k2);           // плавно ускорение
      var mx = (1 - u) * (1 - u) * fl.x0 + 2 * (1 - u) * u * fl.cx + u * u * fl.x1;
      var my = (1 - u) * (1 - u) * fl.y0 + 2 * (1 - u) * u * fl.cy + u * u * fl.y1;
      var size = (40 - 14 * u) * Math.max(0.85, Math.min(1.25, z));
      // Иконата пътува в светло кръгче — иначе се губи в тревата.
      var im = img(fl.icon);
      ctx.save();
      ctx.globalAlpha = k2 > 0.82 ? (1 - k2) / 0.18 : 1;
      var r = size * 0.62;
      var grad = ctx.createLinearGradient(mx, my - r, mx, my + r);
      grad.addColorStop(0, '#fffdf6');
      grad.addColorStop(1, '#f6e7c8');
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#ffd54a';
      ctx.lineWidth = Math.max(1.5, size * 0.09);
      ctx.stroke();
      if (im.complete && im.naturalWidth) ctx.drawImage(im, mx - size / 2, my - size / 2, size, size);
      ctx.restore();
    }
  }

  // --- Кадър -------------------------------------------------------------
  function frame() {
    var t = performance.now() - startedAt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var day = skyNow();
    var sky = ctx.createLinearGradient(0, 0, 0, viewH);
    sky.addColorStop(0, day.top);
    sky.addColorStop(1, day.bot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewW, viewH);

    drawGround();

    var items = [];
    D.PLOT_SPOTS.forEach(function (p) {
      items.push({ d: p.x + p.y, f: function () { drawPlot(tileMap[p.x + ',' + p.y], t); } });
    });
    D.STRUCTURES.forEach(function (s) {
      var obj = tileMap[s.x + ',' + s.y];
      items.push({
        d: s.x + s.y + 1.5, f: function () {
          if (s.kind === 'pen') drawPen(obj, t);
          else if (s.kind === 'building') drawBuilding(obj, t);
          else if (s.kind === 'barn') drawBarn(obj, t);
          else drawHouse(obj, t);
        }
      });
    });
    D.DECOR.forEach(function (d) {
      items.push({ d: d.x + d.y + 0.5, f: function () { drawDecor(d, t); } });
    });
    var vis = visibleTiles();
    WILD.forEach(function (d) {
      if (d.x < vis.x0 || d.x > vis.x1 || d.y < vis.y0 || d.y > vis.y1) return;
      items.push({ d: d.x + d.y + 0.5, f: function () { drawDecor(d, t); } });
    });
    FENCE.forEach(function (f) {
      if (f.x < vis.x0 - 1 || f.x > vis.x1 + 1 || f.y < vis.y0 - 1 || f.y > vis.y1 + 1) return;
      items.push({
        d: f.x + f.y + 0.05, f: function () {
          var p = worldToScreen(f.x, f.y);
          stamp(fenceSprite(f.dir, cam.z), p.x, p.y);
        }
      });
    });
    items.sort(function (a, b) { return a.d - b.d; });
    for (var i = 0; i < items.length; i++) items[i].f();

    // Светлината на деня ляга върху готовата сцена.
    if (day.alpha > 0.004) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = day.alpha;
      ctx.fillStyle = day.wash;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.restore();
    }
    if (day.night > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawNightLights(day.night, t);
      drawFireflies(day.night, t);
      ctx.restore();
    }

    drawEffects(t);
  }

  // --- Начало ------------------------------------------------------------
  function resize() {
    var nd = Math.min(2.5, global.devicePixelRatio || 1);
    if (nd !== dpr) { dpr = nd; dropCache(); }
    viewW = canvas.clientWidth;
    viewH = canvas.clientHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
  }

  function init(cv) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    buildTileMap();
    buildWilderness();
    resize();
    cam.z = clamp(viewW / 560, 0.6, 1.1);
    cam.x = 40; cam.y = 250;
    ['wheat', 'corn', 'carrot', 'tomato', 'sunflower', 'strawberry', 'pumpkin',
      'egg', 'milk', 'wool', 'honey', 'feed', 'flour', 'bread', 'butter', 'cheese',
      'cake', 'jam', 'yarn', 'lock', 'plus', 'coin', 'barn'].forEach(img);
  }

  global.GScene = {
    init: init, resize: resize, frame: frame, pick: pick,
    panBy: panBy, zoomAt: zoomAt, focusOn: focusOn,
    worldToScreen: worldToScreen,
    fly: fly, puff: puff,
    hour: hourNow,
    cam: cam
  };
})(window);
