/* Слънчева Ферма — състояние на играта, икономика, запис и офлайн прогрес. */
(function (global) {
  'use strict';

  var D = global.GD;
  var SAVE_KEY = 'sunfarm.save.v1';
  var ORDER_SLOTS = 6;
  var ORDER_REFILL = 240; // секунди до нова поръчка на освободено място

  var listeners = {};
  function on(evt, fn) { (listeners[evt] || (listeners[evt] = [])).push(fn); }
  function emit(evt, data) {
    var l = listeners[evt];
    if (!l) return;
    for (var i = 0; i < l.length; i++) l[i](data);
  }

  var S = null;
  var dirty = false;

  function now() { return Date.now(); }
  function sec() { return Math.floor(Date.now() / 1000); }

  // --- Начално състояние -------------------------------------------------
  function freshState() {
    var s = {
      v: 1,
      coins: 250,
      gems: 5,
      xp: 0,
      level: 1,
      barnLvl: 0,
      plots: [],
      inv: {},
      pens: {},
      buildings: {},
      orders: [],
      questIdx: 0,
      questProg: 0,
      stats: { planted: 0, harvested: {}, crafted: {}, collected: {}, animals: {}, ordersDone: 0, coinsEarned: 0 },
      created: sec(),
      lastSeen: sec(),
      lastDaily: 0,
      sound: true
    };
    for (var i = 0; i < D.PLOTS_TOTAL; i++) {
      s.plots.push({ open: i < D.PLOTS_AT_START, crop: null, at: 0 });
    }
    for (var key in D.PENS) {
      s.pens[key] = { owned: D.PENS[key].cost === 0 && D.PENS[key].lvl <= 1, slots: D.PENS[key].cap, animals: [] };
    }
    for (var b = 0; b < D.BUILDINGS.length; b++) {
      var bd = D.BUILDINGS[b];
      s.buildings[bd.id] = { owned: bd.cost === 0, queue: [], slots: 2 };
    }
    for (var o = 0; o < ORDER_SLOTS; o++) s.orders.push(null);
    return s;
  }

  // --- Запис -------------------------------------------------------------
  function save(force) {
    if (!S) return;
    if (!force && !dirty) return;
    S.lastSeen = sec();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(S));
      dirty = false;
    } catch (e) { /* пълно хранилище — играта продължава без запис */ }
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
    if (!raw) { S = freshState(); refillOrders(true); return false; }
    try {
      var data = JSON.parse(raw);
      S = migrate(data);
      refillOrders(false);
      return true;
    } catch (e) {
      if (global.console) console.warn('Записът не можа да се зареди:', e);
      S = freshState();
      refillOrders(true);
      return false;
    }
  }

  function migrate(data) {
    var base = freshState();
    if (!data || typeof data !== 'object') return base;
    // Сливане по поле, за да не чупи старите записи при добавено съдържание.
    var s = base;
    s.coins = num(data.coins, base.coins);
    s.gems = num(data.gems, base.gems);
    s.xp = num(data.xp, 0);
    s.level = Math.max(1, num(data.level, 1));
    s.barnLvl = Math.max(0, num(data.barnLvl, 0));
    s.questIdx = Math.max(0, num(data.questIdx, 0));
    s.questProg = Math.max(0, num(data.questProg, 0));
    s.lastSeen = num(data.lastSeen, sec());
    s.lastDaily = num(data.lastDaily, 0);
    s.created = num(data.created, sec());
    s.sound = data.sound !== false;

    if (Array.isArray(data.plots)) {
      for (var i = 0; i < s.plots.length && i < data.plots.length; i++) {
        var p = data.plots[i] || {};
        s.plots[i].open = !!p.open;
        s.plots[i].crop = D.cropById(p.crop) ? p.crop : null;
        s.plots[i].at = num(p.at, 0);
      }
    }
    if (data.inv && typeof data.inv === 'object') {
      for (var k in data.inv) if (D.ITEMS[k]) s.inv[k] = Math.max(0, Math.floor(num(data.inv[k], 0)));
    }
    if (data.pens) {
      for (var pen in s.pens) {
        var src = data.pens[pen];
        if (!src) continue;
        s.pens[pen].owned = !!src.owned;
        s.pens[pen].slots = Math.max(1, num(src.slots, s.pens[pen].slots));
        if (Array.isArray(src.animals)) {
          s.pens[pen].animals = src.animals.slice(0, s.pens[pen].slots).map(function (a) {
            return { done: num(a && a.done, 0), fed: !!(a && a.fed), name: (a && a.name) || null };
          });
        }
      }
    }
    if (data.buildings) {
      for (var bid in s.buildings) {
        var bsrc = data.buildings[bid];
        if (!bsrc) continue;
        s.buildings[bid].owned = !!bsrc.owned;
        s.buildings[bid].slots = Math.max(1, num(bsrc.slots, 2));
        if (Array.isArray(bsrc.queue)) {
          s.buildings[bid].queue = bsrc.queue.filter(function (q) { return q && D.recipeById(q.r); })
            .slice(0, 6)
            .map(function (q) { return { r: q.r, done: num(q.done, 0) }; });
        }
      }
    }
    if (Array.isArray(data.orders)) {
      for (var o = 0; o < s.orders.length; o++) {
        var od = data.orders[o];
        if (od && od.items) {
          s.orders[o] = { items: od.items, coins: num(od.coins, 10), xp: num(od.xp, 1), gems: num(od.gems, 0), refillAt: 0 };
        } else if (od && od.refillAt) {
          s.orders[o] = { refillAt: num(od.refillAt, 0) };
        }
      }
    }
    if (data.stats && typeof data.stats === 'object') {
      s.stats.planted = num(data.stats.planted, 0);
      s.stats.ordersDone = num(data.stats.ordersDone, 0);
      s.stats.coinsEarned = num(data.stats.coinsEarned, 0);
      ['harvested', 'crafted', 'collected', 'animals'].forEach(function (key) {
        if (data.stats[key] && typeof data.stats[key] === 'object') {
          for (var kk in data.stats[key]) s.stats[key][kk] = num(data.stats[key][kk], 0);
        }
      });
    }
    return s;
  }

  function num(v, def) {
    v = Number(v);
    return isFinite(v) ? v : def;
  }

  function touch() { dirty = true; emit('change'); }

  // --- Хамбар ------------------------------------------------------------
  function barnCap() { return D.barnCapacity(S.barnLvl); }
  function barnUsed() {
    var n = 0;
    for (var k in S.inv) n += S.inv[k];
    return n;
  }
  function barnFree() { return Math.max(0, barnCap() - barnUsed()); }

  function addItem(id, qty) {
    if (qty <= 0) return 0;
    var free = barnFree();
    var take = Math.min(free, qty);
    if (take <= 0) return 0;
    S.inv[id] = (S.inv[id] || 0) + take;
    return take;
  }
  function hasItems(cost) {
    for (var k in cost) if ((S.inv[k] || 0) < cost[k]) return false;
    return true;
  }
  function takeItems(cost) {
    if (!hasItems(cost)) return false;
    for (var k in cost) {
      S.inv[k] -= cost[k];
      if (S.inv[k] <= 0) delete S.inv[k];
    }
    return true;
  }
  function countItem(id) { return S.inv[id] || 0; }

  // --- Монети, диаманти, опит -------------------------------------------
  function addCoins(n) {
    S.coins += n;
    if (n > 0) S.stats.coinsEarned += n;
  }
  function spendCoins(n) {
    if (S.coins < n) return false;
    S.coins -= n;
    return true;
  }
  function spendGems(n) {
    if (S.gems < n) return false;
    S.gems -= n;
    return true;
  }

  function addXP(n) {
    S.xp += n;
    var ups = [];
    while (S.xp >= D.xpForLevel(S.level)) {
      S.xp -= D.xpForLevel(S.level);
      S.level++;
      var reward = { coins: 100 * S.level, gems: S.level % 2 === 0 ? 2 : 1 };
      addCoins(reward.coins);
      S.gems += reward.gems;
      ups.push({ level: S.level, reward: reward, unlocks: unlocksAt(S.level) });
    }
    if (ups.length) emit('levelup', ups);
    questTick('level', null, S.level, true);
  }

  function unlocksAt(level) {
    var out = [];
    D.CROPS.forEach(function (c) { if (c.lvl === level) out.push('Култура: ' + D.itemName(c.item)); });
    for (var pen in D.PENS) if (D.PENS[pen].lvl === level) out.push('Постройка: ' + D.PENS[pen].name);
    D.BUILDINGS.forEach(function (b) { if (b.lvl === level) out.push('Цех: ' + b.name); });
    D.BUILDINGS.forEach(function (b) {
      b.recipes.forEach(function (r) { if (r.lvl === level && b.lvl !== level) out.push('Рецепта: ' + D.itemName(r.out)); });
    });
    return out;
  }

  // --- Ниви --------------------------------------------------------------
  function plotState(i) {
    var p = S.plots[i];
    if (!p.open) return 'locked';
    if (!p.crop) return 'empty';
    var c = D.cropById(p.crop);
    return (sec() - p.at >= c.time) ? 'ripe' : 'growing';
  }
  function plotLeft(i) {
    var p = S.plots[i];
    if (!p.crop) return 0;
    var c = D.cropById(p.crop);
    return Math.max(0, c.time - (sec() - p.at));
  }
  function plotProgress(i) {
    var p = S.plots[i];
    if (!p.crop) return 0;
    var c = D.cropById(p.crop);
    return Math.min(1, (sec() - p.at) / c.time);
  }

  function nextLockedPlot() {
    for (var i = 0; i < S.plots.length; i++) if (!S.plots[i].open) return i;
    return -1;
  }
  function openPlots() {
    var n = 0;
    for (var i = 0; i < S.plots.length; i++) if (S.plots[i].open) n++;
    return n;
  }
  function plotPrice(i) {
    var rank = 0;
    for (var k = 0; k < i; k++) if (!S.plots[k].open) rank++;
    return D.plotCost(openPlots() - D.PLOTS_AT_START + rank);
  }

  function canPlant(cropId) {
    var c = D.cropById(cropId);
    if (!c || c.lvl > S.level) return false;
    return S.coins >= c.seed;
  }

  function plant(i, cropId) {
    var c = D.cropById(cropId);
    if (!c || plotState(i) !== 'empty' || c.lvl > S.level) return fail('Още не си отключил тази култура');
    if (!spendCoins(c.seed)) return fail('Нямаш достатъчно монети');
    S.plots[i].crop = cropId;
    S.plots[i].at = sec();
    S.stats.planted++;
    questTick('plant', null, 1);
    touch();
    return ok();
  }

  function plantAll(cropId) {
    var n = 0;
    for (var i = 0; i < S.plots.length; i++) {
      if (plotState(i) !== 'empty') continue;
      var c = D.cropById(cropId);
      if (S.coins < c.seed) break;
      if (plant(i, cropId).ok) n++;
    }
    return n;
  }

  function harvest(i) {
    if (plotState(i) !== 'ripe') return fail('Още не е узряло');
    var p = S.plots[i];
    var c = D.cropById(p.crop);
    if (barnFree() < 1) return fail('Хамбарът е пълен');
    var got = addItem(c.item, 1);
    p.crop = null; p.at = 0;
    addXP(c.xp);
    S.stats.harvested[c.item] = (S.stats.harvested[c.item] || 0) + got;
    questTick('harvest', c.item, got);
    touch();
    return ok({ item: c.item, qty: got, xp: c.xp });
  }

  function harvestAll() {
    var got = {};
    for (var i = 0; i < S.plots.length; i++) {
      if (plotState(i) !== 'ripe') continue;
      if (barnFree() < 1) break;
      var r = harvest(i);
      if (r.ok) got[r.data.item] = (got[r.data.item] || 0) + r.data.qty;
    }
    return got;
  }

  function unlockPlot(i) {
    if (S.plots[i].open) return fail('Вече е твоя');
    var price = plotPrice(i);
    if (!spendCoins(price)) return fail('Трябват ти ' + price + ' монети');
    S.plots[i].open = true;
    questTick('plots', null, openPlots(), true);
    touch();
    return ok({ price: price });
  }

  // --- Животни -----------------------------------------------------------
  var NAMES = ['Мара', 'Пена', 'Зорка', 'Белка', 'Роса', 'Гери', 'Милка', 'Лиса', 'Звезда', 'Дора', 'Тина', 'Малина'];

  function buyPen(pen) {
    var def = D.PENS[pen];
    if (S.pens[pen].owned) return fail('Вече е построено');
    if (S.level < def.lvl) return fail('Отключва се на ниво ' + def.lvl);
    if (!spendCoins(def.cost)) return fail('Трябват ти ' + def.cost + ' монети');
    S.pens[pen].owned = true;
    touch();
    return ok();
  }

  function buyAnimal(pen) {
    var def = D.PENS[pen];
    var an = D.animalById(def.animal);
    var st = S.pens[pen];
    if (!st.owned) return fail('Първо построй ' + def.name.toLowerCase());
    if (st.animals.length >= st.slots) return fail('Няма свободно място');
    if (S.level < an.lvl) return fail('Отключва се на ниво ' + an.lvl);
    if (!spendCoins(an.cost)) return fail('Трябват ти ' + an.cost + ' монети');
    st.animals.push({ done: 0, fed: false, name: NAMES[Math.floor(Math.random() * NAMES.length)] });
    S.stats.animals[an.id] = (S.stats.animals[an.id] || 0) + 1;
    questTick('buyAnimal', an.id, 1);
    touch();
    return ok({ animal: an.id });
  }

  function upgradePen(pen) {
    var st = S.pens[pen];
    if (!st.owned) return fail('Първо построй постройката');
    if (st.slots >= 6) return fail('Постройката е разширена докрай');
    var price = D.penUpgradeCost(pen, st.slots);
    if (!spendCoins(price)) return fail('Трябват ти ' + price + ' монети');
    st.slots++;
    touch();
    return ok({ price: price });
  }

  function penAnimalDef(pen) { return D.animalById(D.PENS[pen].animal); }

  function penNeedsFeed(pen) {
    var st = S.pens[pen];
    if (!st.owned) return 0;
    var an = penAnimalDef(pen);
    var n = 0;
    for (var i = 0; i < st.animals.length; i++) if (!st.animals[i].fed) n += an.feed;
    return n;
  }

  function feedPen(pen) {
    var st = S.pens[pen];
    var an = penAnimalDef(pen);
    if (!st.owned || !st.animals.length) return fail('Няма кого да храниш');
    var need = penNeedsFeed(pen);
    if (need <= 0) return fail('Вече са нахранени');
    var have = countItem('feed');
    if (have <= 0) return fail('Нямаш фураж — направи го във фуражния цех');
    var fedCount = 0;
    for (var i = 0; i < st.animals.length; i++) {
      var a = st.animals[i];
      if (a.fed) continue;
      if (countItem('feed') < an.feed) break;
      takeItems({ feed: an.feed });
      a.fed = true;
      a.done = sec() + an.time;
      fedCount++;
    }
    if (!fedCount) return fail('Трябва ти още фураж');
    touch();
    return ok({ fed: fedCount });
  }

  function penReadyCount(pen) {
    var st = S.pens[pen];
    if (!st.owned) return 0;
    var n = 0, t = sec();
    for (var i = 0; i < st.animals.length; i++) {
      var a = st.animals[i];
      if (a.fed && a.done && t >= a.done) n++;
    }
    return n;
  }

  function penNextReady(pen) {
    var st = S.pens[pen];
    var best = 0, t = sec();
    for (var i = 0; i < st.animals.length; i++) {
      var a = st.animals[i];
      if (a.fed && a.done > t) { var left = a.done - t; if (!best || left < best) best = left; }
    }
    return best;
  }

  function collectPen(pen) {
    var st = S.pens[pen];
    var an = penAnimalDef(pen);
    var ready = penReadyCount(pen);
    if (!ready) return fail('Още няма готова продукция');
    if (barnFree() < 1) return fail('Хамбарът е пълен');
    var got = 0, xp = 0, t = sec();
    for (var i = 0; i < st.animals.length; i++) {
      var a = st.animals[i];
      if (!(a.fed && a.done && t >= a.done)) continue;
      if (barnFree() < 1) break;
      got += addItem(an.item, 1);
      xp += an.xp;
      a.fed = false; a.done = 0;
    }
    addXP(xp);
    S.stats.collected[an.item] = (S.stats.collected[an.item] || 0) + got;
    questTick('collect', an.item, got);
    touch();
    return ok({ item: an.item, qty: got, xp: xp });
  }

  // --- Цехове ------------------------------------------------------------
  function buildBuilding(id) {
    var def = D.buildingById(id);
    var st = S.buildings[id];
    if (st.owned) return fail('Вече е построен');
    if (S.level < def.lvl) return fail('Отключва се на ниво ' + def.lvl);
    if (!spendCoins(def.cost)) return fail('Трябват ти ' + def.cost + ' монети');
    st.owned = true;
    touch();
    return ok();
  }

  function craft(buildingId, recipeId) {
    var st = S.buildings[buildingId];
    var r = D.recipeById(recipeId);
    if (!st || !st.owned) return fail('Цехът не е построен');
    if (!r) return fail('Няма такава рецепта');
    if (S.level < r.lvl) return fail('Отключва се на ниво ' + r.lvl);
    if (st.queue.length >= st.slots) return fail('Опашката е пълна');
    if (!hasItems(r.cost)) return fail('Липсват съставки');
    takeItems(r.cost);
    var start = sec();
    // Новата поръчка тръгва след последната в опашката.
    var last = st.queue.length ? st.queue[st.queue.length - 1].done : start;
    st.queue.push({ r: recipeId, done: Math.max(start, last) + r.time });
    touch();
    return ok();
  }

  function craftLeft(buildingId, idx) {
    var q = S.buildings[buildingId].queue[idx];
    if (!q) return 0;
    return Math.max(0, q.done - sec());
  }

  function collectCraft(buildingId) {
    var st = S.buildings[buildingId];
    var t = sec(), got = {}, xp = 0;
    while (st.queue.length && st.queue[0].done <= t) {
      if (barnFree() < 1) break;
      var q = st.queue.shift();
      var r = D.recipeById(q.r);
      var n = addItem(r.out, r.qty);
      got[r.out] = (got[r.out] || 0) + n;
      xp += r.xp;
      S.stats.crafted[r.out] = (S.stats.crafted[r.out] || 0) + n;
      questTick('craft', r.out, n);
    }
    if (!xp && !Object.keys(got).length) return fail('Още нищо не е готово');
    addXP(xp);
    touch();
    return ok({ got: got, xp: xp });
  }

  function buildingReady(buildingId) {
    var st = S.buildings[buildingId];
    if (!st.owned) return 0;
    var n = 0, t = sec();
    for (var i = 0; i < st.queue.length; i++) if (st.queue[i].done <= t) n++;
    return n;
  }

  // --- Ускоряване с диаманти --------------------------------------------
  function gemCost(secondsLeft) {
    if (secondsLeft <= 0) return 0;
    return Math.max(1, Math.ceil(secondsLeft / 120));
  }

  function speedPlot(i) {
    var left = plotLeft(i);
    if (left <= 0) return fail('Вече е готово');
    var cost = gemCost(left);
    if (!spendGems(cost)) return fail('Трябват ти ' + cost + ' диаманта');
    S.plots[i].at = sec() - D.cropById(S.plots[i].crop).time;
    touch();
    return ok({ cost: cost });
  }

  function speedPen(pen) {
    var st = S.pens[pen];
    var left = penNextReady(pen);
    if (!left) return fail('Няма какво да ускориш');
    var total = 0, t = sec();
    for (var i = 0; i < st.animals.length; i++) if (st.animals[i].done > t) total += gemCost(st.animals[i].done - t);
    if (!spendGems(total)) return fail('Трябват ти ' + total + ' диаманта');
    for (var k = 0; k < st.animals.length; k++) if (st.animals[k].done > t) st.animals[k].done = t;
    touch();
    return ok({ cost: total });
  }

  function speedBuilding(buildingId) {
    var st = S.buildings[buildingId];
    if (!st.queue.length) return fail('Опашката е празна');
    var t = sec(), total = 0;
    for (var i = 0; i < st.queue.length; i++) if (st.queue[i].done > t) total += gemCost(st.queue[i].done - t);
    if (!total) return fail('Вече е готово');
    if (!spendGems(total)) return fail('Трябват ти ' + total + ' диаманта');
    for (var k = 0; k < st.queue.length; k++) st.queue[k].done = t;
    touch();
    return ok({ cost: total });
  }

  // --- Продажба ----------------------------------------------------------
  function sell(item, qty) {
    qty = Math.min(qty, countItem(item));
    if (qty <= 0) return fail('Нямаш такава стока');
    var price = D.itemSell(item) * qty;
    S.inv[item] -= qty;
    if (S.inv[item] <= 0) delete S.inv[item];
    addCoins(price);
    touch();
    return ok({ coins: price, qty: qty });
  }

  // --- Поръчки -----------------------------------------------------------
  function availableItems() {
    var pool = [];
    D.CROPS.forEach(function (c) { if (c.lvl <= S.level) pool.push(c.item); });
    for (var pen in D.PENS) {
      if (S.pens[pen].owned && S.pens[pen].animals.length) pool.push(D.animalById(D.PENS[pen].animal).item);
    }
    D.BUILDINGS.forEach(function (b) {
      if (!S.buildings[b.id].owned) return;
      b.recipes.forEach(function (r) { if (r.lvl <= S.level && r.out !== 'feed') pool.push(r.out); });
    });
    return pool;
  }

  function makeOrder() {
    var pool = availableItems();
    if (!pool.length) return null;
    var count = S.level < 3 ? 1 : (S.level < 7 ? (Math.random() < 0.5 ? 1 : 2) : (Math.random() < 0.35 ? 3 : 2));
    var items = {}, picked = 0, guard = 0;
    while (picked < count && guard++ < 30) {
      var id = pool[Math.floor(Math.random() * pool.length)];
      if (items[id]) continue;
      var sellPrice = D.itemSell(id);
      var maxQty = sellPrice > 300 ? 2 : sellPrice > 120 ? 3 : 5;
      items[id] = 1 + Math.floor(Math.random() * maxQty);
      picked++;
    }
    var base = 0;
    for (var k in items) base += D.itemSell(k) * items[k];
    return {
      items: items,
      coins: Math.round(base * 1.7 / 5) * 5,
      xp: Math.max(3, Math.round(base / 22)),
      gems: Math.random() < 0.18 ? 1 : 0,
      refillAt: 0
    };
  }

  function refillOrders(instant) {
    var t = sec(), changed = false;
    for (var i = 0; i < S.orders.length; i++) {
      var o = S.orders[i];
      if (o && o.items) continue;
      if (!o) {
        S.orders[i] = { refillAt: instant ? t : t + ORDER_REFILL };
        o = S.orders[i];
        changed = true;
      }
      if (t >= o.refillAt) {
        var made = makeOrder();
        if (made) { S.orders[i] = made; changed = true; }
      }
    }
    return changed;
  }

  function canFillOrder(i) {
    var o = S.orders[i];
    if (!o || !o.items) return false;
    return hasItems(o.items);
  }

  function fillOrder(i) {
    var o = S.orders[i];
    if (!o || !o.items) return fail('Празно място');
    if (!hasItems(o.items)) return fail('Липсват стоки');
    takeItems(o.items);
    addCoins(o.coins);
    S.gems += o.gems || 0;
    addXP(o.xp);
    S.stats.ordersDone++;
    questTick('orders', null, 1);
    S.orders[i] = { refillAt: sec() + ORDER_REFILL };
    touch();
    return ok({ coins: o.coins, xp: o.xp, gems: o.gems || 0 });
  }

  function skipOrder(i) {
    var o = S.orders[i];
    if (!o || !o.items) return fail('Празно място');
    S.orders[i] = { refillAt: sec() + Math.round(ORDER_REFILL / 2) };
    touch();
    return ok();
  }

  function orderRefillLeft(i) {
    var o = S.orders[i];
    if (!o || o.items) return 0;
    return Math.max(0, o.refillAt - sec());
  }

  // --- Задачи ------------------------------------------------------------
  function currentQuest() {
    return S.questIdx < D.QUESTS.length ? D.QUESTS[S.questIdx] : null;
  }

  function questTick(type, key, amount, absolute) {
    var q = currentQuest();
    if (!q || q.type !== type) return;
    if (q.item && q.item !== key) return;
    if (q.animal && q.animal !== key) return;
    S.questProg = absolute ? Math.max(S.questProg, amount) : S.questProg + amount;
    if (S.questProg >= q.goal) {
      addCoins(q.reward.coins || 0);
      S.gems += q.reward.gems || 0;
      S.questIdx++;
      S.questProg = 0;
      emit('quest', q);
      // Догонване: следващата задача може вече да е изпълнена.
      syncQuestProgress();
    }
    dirty = true;
  }

  // Задачите тип level/plots се измерват спрямо текущото състояние.
  function syncQuestProgress() {
    var q = currentQuest();
    if (!q) return;
    if (q.type === 'level') questTick('level', null, S.level, true);
    else if (q.type === 'plots') questTick('plots', null, openPlots(), true);
  }

  // --- Спасителен пояс ---------------------------------------------------
  // Играч без монети, без посеви и с празен хамбар няма как да продължи.
  function isStuck() {
    if (S.coins >= D.CROPS[0].seed) return false;
    if (barnUsed() > 0) return false;
    for (var i = 0; i < S.plots.length; i++) if (S.plots[i].crop) return false;
    for (var pen in S.pens) {
      var list = S.pens[pen].animals;
      for (var a = 0; a < list.length; a++) if (list[a].fed) return false;
    }
    for (var b in S.buildings) if (S.buildings[b].queue.length) return false;
    return true;
  }

  function rescue() {
    if (!isStuck()) return false;
    addCoins(60);
    touch();
    return true;
  }

  // --- Дневен бонус ------------------------------------------------------
  function dailyReady() { return sec() - S.lastDaily >= 20 * 3600; }
  function claimDaily() {
    if (!dailyReady()) return fail('Ела пак по-късно');
    var coins = 200 + S.level * 120;
    addCoins(coins);
    S.gems += 1;
    S.lastDaily = sec();
    touch();
    return ok({ coins: coins, gems: 1 });
  }

  // --- Резултат ----------------------------------------------------------
  function ok(data) { return { ok: true, data: data || {} }; }
  function fail(msg) { return { ok: false, msg: msg }; }

  function reset() {
    S = freshState();
    refillOrders(true);
    dirty = true;
    save(true);
    emit('change');
  }

  function exportSave() { return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
  function importSave(text) {
    try {
      var data = JSON.parse(decodeURIComponent(escape(atob(text.trim()))));
      S = migrate(data);
      refillOrders(false);
      dirty = true;
      save(true);
      emit('change');
      return true;
    } catch (e) { return false; }
  }

  global.G = {
    on: on, emit: emit,
    load: load, save: save, reset: reset, touch: touch,
    exportSave: exportSave, importSave: importSave,
    get state() { return S; },
    sec: sec, now: now,
    barnCap: barnCap, barnUsed: barnUsed, barnFree: barnFree,
    addItem: addItem, hasItems: hasItems, takeItems: takeItems, countItem: countItem,
    addCoins: addCoins, spendCoins: spendCoins, spendGems: spendGems, addXP: addXP, unlocksAt: unlocksAt,
    plotState: plotState, plotLeft: plotLeft, plotProgress: plotProgress, plotPrice: plotPrice,
    nextLockedPlot: nextLockedPlot, openPlots: openPlots, canPlant: canPlant,
    plant: plant, plantAll: plantAll, harvest: harvest, harvestAll: harvestAll, unlockPlot: unlockPlot,
    buyPen: buyPen, buyAnimal: buyAnimal, upgradePen: upgradePen, penAnimalDef: penAnimalDef,
    penNeedsFeed: penNeedsFeed, feedPen: feedPen, penReadyCount: penReadyCount,
    penNextReady: penNextReady, collectPen: collectPen,
    buildBuilding: buildBuilding, craft: craft, craftLeft: craftLeft,
    collectCraft: collectCraft, buildingReady: buildingReady,
    gemCost: gemCost, speedPlot: speedPlot, speedPen: speedPen, speedBuilding: speedBuilding,
    sell: sell, availableItems: availableItems,
    refillOrders: refillOrders, canFillOrder: canFillOrder, fillOrder: fillOrder,
    skipOrder: skipOrder, orderRefillLeft: orderRefillLeft,
    currentQuest: currentQuest, syncQuestProgress: syncQuestProgress,
    dailyReady: dailyReady, claimDaily: claimDaily, rescue: rescue,
    barnUpgrade: function () {
      var price = D.barnUpgradeCost(S.barnLvl);
      if (!spendCoins(price)) return fail('Трябват ти ' + price + ' монети');
      S.barnLvl++;
      touch();
      return ok({ price: price });
    }
  };
})(window);
