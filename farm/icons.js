/* Слънчева Ферма — векторни икони, рисувани на canvas и кеширани като data URL. */
(function (global) {
  'use strict';

  var cache = {};

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function ell(ctx, cx, cy, rx, ry, fill, stroke) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function leaf(ctx, cx, cy, w, h, color, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.quadraticCurveTo(w / 2, 0, 0, h / 2);
    ctx.quadraticCurveTo(-w / 2, 0, 0, -h / 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // Всяка икона рисува в кутия 100x100; мащабът се прилага отвън.
  var painters = {
    coin: function (c) {
      ell(c, 50, 52, 36, 36, '#c98a1c');
      ell(c, 50, 48, 36, 36, '#f6c343');
      ell(c, 50, 48, 27, 27, '#ffd968');
      c.fillStyle = '#c98a1c';
      c.font = 'bold 34px system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('ф', 50, 50);
      ell(c, 39, 37, 7, 4, 'rgba(255,255,255,.75)');
    },
    gem: function (c) {
      c.beginPath();
      c.moveTo(50, 14); c.lineTo(84, 42); c.lineTo(50, 88); c.lineTo(16, 42);
      c.closePath();
      var g = c.createLinearGradient(16, 14, 84, 88);
      g.addColorStop(0, '#7de3ff'); g.addColorStop(.5, '#38b6f0'); g.addColorStop(1, '#1b6fc4');
      c.fillStyle = g; c.fill();
      c.beginPath();
      c.moveTo(50, 14); c.lineTo(50, 88); c.lineTo(16, 42); c.closePath();
      c.fillStyle = 'rgba(255,255,255,.22)'; c.fill();
      c.beginPath(); c.moveTo(16, 42); c.lineTo(84, 42);
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3; c.stroke();
    },
    wheat: function (c) {
      c.strokeStyle = '#7fae3d'; c.lineWidth = 6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(50, 92); c.lineTo(50, 40); c.stroke();
      c.fillStyle = '#e8b53c';
      for (var i = 0; i < 4; i++) {
        var y = 30 + i * 13;
        leaf(c, 39, y, 16, 24, '#e8b53c', -0.5);
        leaf(c, 61, y, 16, 24, '#d9a32e', 0.5);
      }
      leaf(c, 50, 20, 17, 28, '#f0c554', 0);
      leaf(c, 30, 72, 26, 14, '#7fae3d', -0.5);
    },
    corn: function (c) {
      leaf(c, 30, 55, 26, 62, '#5aa63c', 0.35);
      leaf(c, 70, 55, 26, 62, '#4b9033', -0.35);
      c.beginPath();
      c.moveTo(50, 12);
      c.quadraticCurveTo(76, 34, 72, 62);
      c.quadraticCurveTo(68, 90, 50, 92);
      c.quadraticCurveTo(32, 90, 28, 62);
      c.quadraticCurveTo(24, 34, 50, 12);
      c.fillStyle = '#f5c93a'; c.fill();
      c.fillStyle = 'rgba(190,140,20,.5)';
      for (var r = 0; r < 5; r++) for (var k = 0; k < 3; k++) {
        ell(c, 40 + k * 10, 30 + r * 13, 3.2, 3.2, 'rgba(196,146,24,.55)');
      }
    },
    carrot: function (c) {
      leaf(c, 42, 22, 18, 32, '#4a9a37', -0.4);
      leaf(c, 58, 22, 18, 32, '#3f8a30', 0.4);
      leaf(c, 50, 17, 16, 30, '#5bb043', 0);
      c.beginPath();
      c.moveTo(36, 38); c.lineTo(64, 38); c.lineTo(52, 92);
      c.quadraticCurveTo(50, 97, 48, 92); c.closePath();
      c.fillStyle = '#eb8226'; c.fill();
      c.strokeStyle = 'rgba(150,70,10,.45)'; c.lineWidth = 3; c.lineCap = 'round';
      for (var i = 0; i < 3; i++) {
        var y = 50 + i * 14;
        c.beginPath(); c.moveTo(40 - i * 1.5 + 2, y); c.lineTo(58 - i * 3, y + 3); c.stroke();
      }
    },
    tomato: function (c) {
      ell(c, 50, 58, 34, 31, '#df3c2c');
      ell(c, 39, 47, 10, 7, 'rgba(255,255,255,.35)');
      c.fillStyle = '#3f8f3a';
      for (var i = 0; i < 5; i++) leaf(c, 50, 27, 13, 22, '#3f8f3a', i * 1.256);
      c.strokeStyle = '#6b4a22'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(50, 26); c.lineTo(50, 16); c.stroke();
    },
    sunflower: function (c) {
      for (var i = 0; i < 12; i++) {
        var a = i * Math.PI / 6;
        leaf(c, 50 + Math.cos(a) * 26, 50 + Math.sin(a) * 26, 16, 32, i % 2 ? '#f0ad12' : '#f7c02e', a + Math.PI / 2);
      }
      ell(c, 50, 50, 20, 20, '#6b4526');
      ell(c, 50, 50, 14, 14, '#8a5a30');
    },
    strawberry: function (c) {
      c.beginPath();
      c.moveTo(50, 92);
      c.quadraticCurveTo(18, 68, 24, 44);
      c.quadraticCurveTo(30, 24, 50, 30);
      c.quadraticCurveTo(70, 24, 76, 44);
      c.quadraticCurveTo(82, 68, 50, 92);
      c.fillStyle = '#e0344a'; c.fill();
      c.fillStyle = 'rgba(255,232,150,.9)';
      for (var r = 0; r < 4; r++) for (var k = 0; k <= r; k++) {
        ell(c, 50 - r * 6 + k * 12, 44 + r * 11, 2.4, 3.2, 'rgba(255,235,160,.95)');
      }
      for (var i = 0; i < 5; i++) leaf(c, 50, 27, 14, 22, '#3d8f36', -0.9 + i * 0.45);
    },
    pumpkin: function (c) {
      ell(c, 50, 60, 36, 30, '#e8801f');
      ell(c, 34, 60, 15, 29, '#f29433');
      ell(c, 66, 60, 15, 29, '#f29433');
      ell(c, 50, 60, 16, 30, '#f6a543');
      c.strokeStyle = '#4a7a2a'; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(50, 32); c.lineTo(50, 22); c.stroke();
      leaf(c, 66, 24, 22, 14, '#4f9a35', 0.3);
    },
    egg: function (c) {
      c.beginPath();
      c.moveTo(50, 14);
      c.bezierCurveTo(78, 38, 82, 92, 50, 92);
      c.bezierCurveTo(18, 92, 22, 38, 50, 14);
      c.fillStyle = '#fdf6e6'; c.fill();
      ell(c, 39, 44, 8, 12, 'rgba(255,255,255,.9)');
      c.strokeStyle = 'rgba(180,160,120,.45)'; c.lineWidth = 2; c.stroke();
    },
    milk: function (c) {
      rr(c, 30, 34, 40, 58, 7); c.fillStyle = '#f4f8ff'; c.fill();
      c.beginPath(); c.moveTo(30, 34); c.lineTo(50, 12); c.lineTo(70, 34); c.closePath();
      c.fillStyle = '#e4ecfa'; c.fill();
      rr(c, 36, 56, 28, 26, 4); c.fillStyle = '#4d8fd6'; c.fill();
      ell(c, 50, 69, 9, 6, '#f4f8ff');
    },
    wool: function (c) {
      ell(c, 50, 56, 34, 29, '#f3f1ea');
      ell(c, 32, 44, 15, 14, '#fbfaf5'); ell(c, 50, 38, 17, 15, '#fbfaf5'); ell(c, 68, 46, 15, 14, '#fbfaf5');
      ell(c, 36, 66, 14, 12, '#e8e5db'); ell(c, 62, 66, 14, 12, '#e8e5db');
    },
    honey: function (c) {
      rr(c, 28, 34, 44, 56, 8); c.fillStyle = '#f0a92a'; c.fill();
      rr(c, 28, 34, 44, 16, 8); c.fillStyle = '#c8761a'; c.fill();
      rr(c, 34, 56, 32, 22, 4); c.fillStyle = 'rgba(255,255,255,.82)'; c.fill();
      c.fillStyle = '#c8761a';
      for (var i = 0; i < 3; i++) {
        var x = 41 + i * 10;
        c.beginPath();
        for (var k = 0; k < 6; k++) {
          var a = k * Math.PI / 3 + Math.PI / 6;
          var px = x + Math.cos(a) * 4.5, py = 67 + Math.sin(a) * 4.5;
          k ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath(); c.fill();
      }
    },
    feed: function (c) {
      c.beginPath();
      c.moveTo(30, 36); c.lineTo(70, 36);
      c.quadraticCurveTo(80, 66, 72, 90); c.lineTo(28, 90);
      c.quadraticCurveTo(20, 66, 30, 36);
      c.fillStyle = '#a9763f'; c.fill();
      c.beginPath(); c.moveTo(30, 36); c.quadraticCurveTo(50, 24, 70, 36);
      c.quadraticCurveTo(50, 46, 30, 36); c.fillStyle = '#8c5f30'; c.fill();
      ell(c, 42, 66, 4, 4, '#e8c05a'); ell(c, 54, 72, 4, 4, '#e8c05a'); ell(c, 50, 58, 4, 4, '#e8c05a');
    },
    flour: function (c) {
      c.beginPath();
      c.moveTo(30, 36); c.lineTo(70, 36);
      c.quadraticCurveTo(80, 66, 72, 90); c.lineTo(28, 90);
      c.quadraticCurveTo(20, 66, 30, 36);
      c.fillStyle = '#efe6d3'; c.fill();
      c.beginPath(); c.moveTo(30, 36); c.quadraticCurveTo(50, 24, 70, 36);
      c.quadraticCurveTo(50, 46, 30, 36); c.fillStyle = '#ddd0b6'; c.fill();
      leaf(c, 50, 66, 14, 26, '#c9a44f', 0);
    },
    bread: function (c) {
      c.beginPath();
      c.moveTo(20, 68);
      c.quadraticCurveTo(18, 34, 50, 32);
      c.quadraticCurveTo(82, 34, 80, 68);
      c.quadraticCurveTo(80, 84, 50, 84);
      c.quadraticCurveTo(20, 84, 20, 68);
      c.fillStyle = '#c98a45'; c.fill();
      c.strokeStyle = '#a96e2f'; c.lineWidth = 4; c.lineCap = 'round';
      for (var i = 0; i < 3; i++) {
        c.beginPath(); c.moveTo(35 + i * 12, 42 + i * 2); c.lineTo(44 + i * 12, 54 + i * 2); c.stroke();
      }
    },
    butter: function (c) {
      c.beginPath();
      c.moveTo(22, 48); c.lineTo(62, 30); c.lineTo(82, 42); c.lineTo(82, 68);
      c.lineTo(42, 86); c.lineTo(22, 74); c.closePath();
      c.fillStyle = '#f5d874'; c.fill();
      c.beginPath(); c.moveTo(22, 48); c.lineTo(62, 30); c.lineTo(82, 42); c.lineTo(42, 60); c.closePath();
      c.fillStyle = '#fbe89c'; c.fill();
      c.beginPath(); c.moveTo(42, 60); c.lineTo(82, 42); c.lineTo(82, 68); c.lineTo(42, 86); c.closePath();
      c.fillStyle = '#e6c458'; c.fill();
    },
    cheese: function (c) {
      c.beginPath();
      c.moveTo(18, 74); c.lineTo(78, 34); c.lineTo(84, 50); c.lineTo(24, 88); c.closePath();
      c.fillStyle = '#f2c34a'; c.fill();
      c.beginPath(); c.moveTo(18, 74); c.lineTo(78, 34); c.lineTo(84, 50);
      c.lineTo(24, 88); c.closePath();
      c.strokeStyle = '#d8a42c'; c.lineWidth = 3; c.stroke();
      ell(c, 42, 70, 6, 5, '#dba72f'); ell(c, 60, 58, 5, 4, '#dba72f'); ell(c, 70, 48, 4, 3.5, '#dba72f');
    },
    cake: function (c) {
      rr(c, 22, 52, 56, 30, 6); c.fillStyle = '#c98a45'; c.fill();
      rr(c, 22, 44, 56, 16, 8); c.fillStyle = '#fbe9d0'; c.fill();
      rr(c, 22, 62, 56, 8, 4); c.fillStyle = '#e2b06e'; c.fill();
      ell(c, 50, 34, 8, 8, '#e0344a');
      c.strokeStyle = '#3d8f36'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(50, 28); c.quadraticCurveTo(58, 22, 62, 26); c.stroke();
    },
    jam: function (c) {
      rr(c, 28, 34, 44, 56, 8); c.fillStyle = '#e0344a'; c.fill();
      rr(c, 28, 34, 44, 14, 7); c.fillStyle = '#8e2030'; c.fill();
      rr(c, 24, 28, 52, 10, 5); c.fillStyle = '#f2d6a8'; c.fill();
      rr(c, 36, 56, 30, 20, 4); c.fillStyle = 'rgba(255,255,255,.85)'; c.fill();
      ell(c, 51, 66, 8, 9, '#e0344a');
    },
    yarn: function (c) {
      ell(c, 50, 56, 33, 33, '#d9628a');
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 4;
      for (var i = -2; i <= 2; i++) {
        c.beginPath();
        c.ellipse(50, 56, 33, 14, i * 0.5, 0, Math.PI * 2);
        c.stroke();
      }
      c.strokeStyle = '#d9628a'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(78, 40); c.quadraticCurveTo(92, 30, 84, 18); c.stroke();
    },
    barn: function (c) {
      c.beginPath();
      c.moveTo(50, 16); c.lineTo(88, 40); c.lineTo(88, 88); c.lineTo(12, 88); c.lineTo(12, 40); c.closePath();
      c.fillStyle = '#c8452f'; c.fill();
      c.beginPath();
      c.moveTo(50, 16); c.lineTo(88, 40); c.lineTo(12, 40); c.closePath();
      c.fillStyle = '#a63525'; c.fill();
      rr(c, 36, 52, 28, 36, 3); c.fillStyle = '#f3e7d2'; c.fill();
      c.strokeStyle = '#c8452f'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(36, 52); c.lineTo(64, 88); c.moveTo(64, 52); c.lineTo(36, 88); c.stroke();
      c.beginPath(); c.moveTo(50, 52); c.lineTo(50, 88); c.stroke();
    },
    shop: function (c) {
      c.strokeStyle = '#5b4a35'; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(16, 24); c.lineTo(30, 24); c.lineTo(40, 66); c.lineTo(78, 66);
      c.lineTo(86, 36); c.lineTo(34, 36);
      c.stroke();
      ell(c, 46, 82, 7, 7, '#5b4a35');
      ell(c, 74, 82, 7, 7, '#5b4a35');
    },
    board: function (c) {
      rr(c, 20, 20, 60, 70, 8); c.fillStyle = '#f3e7d2'; c.fill();
      c.strokeStyle = '#b08a58'; c.lineWidth = 4; c.stroke();
      rr(c, 38, 12, 24, 14, 5); c.fillStyle = '#b08a58'; c.fill();
      c.strokeStyle = '#8a6f4a'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(33, 44); c.lineTo(67, 44);
      c.moveTo(33, 58); c.lineTo(67, 58);
      c.moveTo(33, 72); c.lineTo(54, 72);
      c.stroke();
    },
    quest: function (c) {
      c.beginPath();
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 5;
        var r = i % 2 ? 18 : 38;
        var x = 50 + Math.cos(a) * r, y = 52 + Math.sin(a) * r;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.closePath();
      c.fillStyle = '#f6c343'; c.fill();
      c.strokeStyle = '#d79f19'; c.lineWidth = 3; c.stroke();
    },
    menu: function (c) {
      c.strokeStyle = '#5b4a35'; c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(22, 32); c.lineTo(78, 32);
      c.moveTo(22, 52); c.lineTo(78, 52);
      c.moveTo(22, 72); c.lineTo(78, 72);
      c.stroke();
    },
    clock: function (c) {
      ell(c, 50, 52, 34, 34, '#f3e7d2', null);
      c.strokeStyle = '#7a6240'; c.lineWidth = 6;
      ell(c, 50, 52, 34, 34, null, '#7a6240');
      c.lineCap = 'round'; c.lineWidth = 6;
      c.beginPath(); c.moveTo(50, 52); c.lineTo(50, 30); c.moveTo(50, 52); c.lineTo(66, 60); c.stroke();
    },
    chicken: function (c) {
      ell(c, 52, 62, 28, 24, '#fdf6e6');
      ell(c, 34, 44, 16, 15, '#fdf6e6');
      c.fillStyle = '#e0453a';
      ell(c, 32, 32, 4, 5, '#e0453a'); ell(c, 38, 30, 4, 5, '#e0453a'); ell(c, 26, 34, 4, 5, '#e0453a');
      c.beginPath(); c.moveTo(22, 45); c.lineTo(12, 48); c.lineTo(22, 52); c.closePath();
      c.fillStyle = '#f0a92a'; c.fill();
      ell(c, 30, 43, 2.6, 2.6, '#3a2a1a');
      ell(c, 58, 62, 13, 12, '#efe3cc');
      c.strokeStyle = '#f0a92a'; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(46, 84); c.lineTo(46, 92); c.moveTo(60, 84); c.lineTo(60, 92); c.stroke();
    },
    cow: function (c) {
      ell(c, 54, 58, 32, 24, '#fdf6e6');
      ell(c, 44, 52, 12, 9, '#3a3330'); ell(c, 68, 64, 10, 8, '#3a3330');
      ell(c, 26, 50, 16, 15, '#fdf6e6');
      ell(c, 22, 56, 10, 7, '#f0a9a2');
      ell(c, 21, 45, 2.6, 2.6, '#3a2a1a'); ell(c, 31, 44, 2.6, 2.6, '#3a2a1a');
      c.fillStyle = '#d8ccb4';
      ell(c, 16, 38, 5, 4, '#d8ccb4'); ell(c, 36, 37, 5, 4, '#d8ccb4');
      c.strokeStyle = '#e8e0cc'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(44, 80); c.lineTo(44, 90); c.moveTo(66, 80); c.lineTo(66, 90); c.stroke();
    },
    sheep: function (c) {
      ell(c, 54, 58, 30, 24, '#f3f1ea');
      ell(c, 38, 46, 13, 12, '#f8f7f2'); ell(c, 56, 40, 15, 13, '#f8f7f2'); ell(c, 72, 48, 13, 12, '#f8f7f2');
      ell(c, 28, 56, 14, 13, '#4a4038');
      ell(c, 24, 52, 2.6, 2.6, '#fdf6e6'); ell(c, 33, 51, 2.6, 2.6, '#fdf6e6');
      c.strokeStyle = '#4a4038'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(46, 80); c.lineTo(46, 90); c.moveTo(66, 80); c.lineTo(66, 90); c.stroke();
    },
    bee: function (c) {
      ell(c, 52, 58, 26, 20, '#f5c93a');
      c.fillStyle = '#3a3330';
      c.save(); c.beginPath(); c.ellipse(52, 58, 26, 20, 0, 0, Math.PI * 2); c.clip();
      c.fillRect(40, 34, 8, 50); c.fillRect(56, 34, 8, 50); c.fillRect(70, 34, 8, 50);
      c.restore();
      ell(c, 24, 52, 12, 11, '#3a3330');
      ell(c, 44, 36, 16, 10, 'rgba(220,240,255,.8)');
      ell(c, 64, 36, 16, 10, 'rgba(220,240,255,.8)');
      c.strokeStyle = '#3a3330'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(20, 42); c.lineTo(14, 32); c.moveTo(28, 41); c.lineTo(26, 30); c.stroke();
    },
    plus: function (c) {
      c.strokeStyle = '#3f8f3a'; c.lineWidth = 12; c.lineCap = 'round';
      c.beginPath(); c.moveTo(50, 24); c.lineTo(50, 76); c.moveTo(24, 50); c.lineTo(76, 50); c.stroke();
    },
    lock: function (c) {
      c.strokeStyle = '#8a7457'; c.lineWidth = 9;
      c.beginPath(); c.arc(50, 44, 17, Math.PI, 0); c.stroke();
      rr(c, 26, 44, 48, 40, 7); c.fillStyle = '#b08a58'; c.fill();
      ell(c, 50, 62, 6, 6, '#6b5334');
      c.fillStyle = '#6b5334'; c.fillRect(47, 62, 6, 12);
    }
  };

  function make(id, size) {
    var key = id + '@' + size;
    if (cache[key]) return cache[key];
    var painter = painters[id];
    var cv = document.createElement('canvas');
    var dpr = Math.min(3, global.devicePixelRatio || 1);
    cv.width = cv.height = Math.round(size * dpr);
    var c = cv.getContext('2d');
    c.scale(cv.width / 100, cv.height / 100);
    if (painter) {
      painter(c);
    } else {
      ell(c, 50, 50, 34, 34, '#c9bda6');
    }
    var url = cv.toDataURL('image/png');
    cache[key] = url;
    return url;
  }

  function el(id, size, cls) {
    var i = document.createElement('i');
    i.className = 'ico' + (cls ? ' ' + cls : '');
    i.style.backgroundImage = 'url(' + make(id, size || 48) + ')';
    return i;
  }

  function paint(root) {
    var list = (root || document).querySelectorAll('.ico[data-icon]');
    for (var i = 0; i < list.length; i++) {
      var node = list[i];
      if (node.dataset.painted) continue;
      node.style.backgroundImage = 'url(' + make(node.dataset.icon, 48) + ')';
      node.dataset.painted = '1';
    }
  }

  global.GIcon = { url: make, el: el, paint: paint, has: function (id) { return !!painters[id]; } };
})(window);
