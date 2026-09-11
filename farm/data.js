/* Слънчева Ферма — съдържание на играта: култури, животни, цехове, стоки, задачи. */
(function (global) {
  'use strict';

  // --- Стоки -------------------------------------------------------------
  // sell — базова цена при продажба в хамбара.
  var ITEMS = {
    wheat:      { name: 'Пшеница',    sell: 14,  cat: 'crop' },
    corn:       { name: 'Царевица',   sell: 36,  cat: 'crop' },
    carrot:     { name: 'Морков',     sell: 70,  cat: 'crop' },
    tomato:     { name: 'Домат',      sell: 130, cat: 'crop' },
    sunflower:  { name: 'Слънчоглед', sell: 240, cat: 'crop' },
    strawberry: { name: 'Ягода',      sell: 420, cat: 'crop' },
    pumpkin:    { name: 'Тиква',      sell: 760, cat: 'crop' },

    egg:        { name: 'Яйце',       sell: 55,  cat: 'animal' },
    milk:       { name: 'Мляко',      sell: 110, cat: 'animal' },
    wool:       { name: 'Вълна',      sell: 190, cat: 'animal' },
    honey:      { name: 'Мед',        sell: 340, cat: 'animal' },

    feed:       { name: 'Фураж',      sell: 18,  cat: 'goods' },
    flour:      { name: 'Брашно',     sell: 75,  cat: 'goods' },
    bread:      { name: 'Хляб',       sell: 230, cat: 'goods' },
    butter:     { name: 'Масло',      sell: 280, cat: 'goods' },
    cheese:     { name: 'Сирене',     sell: 420, cat: 'goods' },
    cake:       { name: 'Кекс',       sell: 520, cat: 'goods' },
    jam:        { name: 'Сладко',     sell: 690, cat: 'goods' },
    yarn:       { name: 'Прежда',     sell: 780, cat: 'goods' }
  };

  // --- Култури -----------------------------------------------------------
  // time — секунди за узряване, seed — цена на семената, xp — опит за реколта.
  var CROPS = [
    { id: 'wheat',      item: 'wheat',      seed: 6,   time: 30,   xp: 2,  lvl: 1,
      plant: { style: 'grain', stem: '#8fbf4a', head: '#e3b53f' } },
    { id: 'corn',       item: 'corn',       seed: 16,  time: 90,   xp: 4,  lvl: 2,
      plant: { style: 'tall', stem: '#4f9e3a', head: '#f4c93b' } },
    { id: 'carrot',     item: 'carrot',     seed: 30,  time: 180,  xp: 7,  lvl: 3,
      plant: { style: 'leafy', stem: '#3f8f3a', head: '#e8802a' } },
    { id: 'tomato',     item: 'tomato',     seed: 55,  time: 420,  xp: 12, lvl: 5,
      plant: { style: 'bush', stem: '#2f7a35', head: '#e0402f' } },
    { id: 'sunflower',  item: 'sunflower',  seed: 100, time: 900,  xp: 20, lvl: 7,
      plant: { style: 'sun', stem: '#4a8f38', head: '#f2b705' } },
    { id: 'strawberry', item: 'strawberry', seed: 175, time: 1800, xp: 32, lvl: 9,
      plant: { style: 'bush', stem: '#2f7a35', head: '#e23a4e' } },
    { id: 'pumpkin',    item: 'pumpkin',    seed: 320, time: 3600, xp: 55, lvl: 12,
      plant: { style: 'vine', stem: '#3f8a38', head: '#f08a24' } }
  ];

  // --- Животни -----------------------------------------------------------
  // feed — колко фураж яде за един цикъл; time — секунди до продукта.
  var ANIMALS = [
    { id: 'chicken', name: 'Кокошка', pen: 'coop',    cost: 220,  feed: 1, time: 240,  xp: 6,  lvl: 1, item: 'egg'  },
    { id: 'cow',     name: 'Крава',   pen: 'pasture', cost: 950,  feed: 2, time: 600,  xp: 14, lvl: 4, item: 'milk' },
    { id: 'sheep',   name: 'Овца',    pen: 'fold',    cost: 2400, feed: 3, time: 1200, xp: 26, lvl: 6, item: 'wool' },
    { id: 'bee',     name: 'Пчели',   pen: 'apiary',  cost: 5200, feed: 4, time: 1800, xp: 40, lvl: 10, item: 'honey' }
  ];

  // --- Цехове ------------------------------------------------------------
  var BUILDINGS = [
    { id: 'feedmill', name: 'Фуражен цех', lvl: 1,  cost: 0,
      recipes: [
        { id: 'feed_wheat', out: 'feed', qty: 2, time: 30,  xp: 2, lvl: 1, cost: { wheat: 2 } },
        { id: 'feed_corn',  out: 'feed', qty: 5, time: 60,  xp: 4, lvl: 3, cost: { corn: 2 } }
      ] },
    { id: 'mill', name: 'Мелница', lvl: 3, cost: 900,
      recipes: [
        { id: 'flour', out: 'flour', qty: 1, time: 120, xp: 6, lvl: 3, cost: { wheat: 3 } }
      ] },
    { id: 'bakery', name: 'Фурна', lvl: 5, cost: 2600,
      recipes: [
        { id: 'bread', out: 'bread', qty: 1, time: 300, xp: 16, lvl: 5, cost: { flour: 2, egg: 1 } },
        { id: 'cake',  out: 'cake',  qty: 1, time: 720, xp: 34, lvl: 8, cost: { flour: 2, egg: 2, milk: 1 } }
      ] },
    { id: 'dairy', name: 'Мандра', lvl: 6, cost: 4800,
      recipes: [
        { id: 'butter', out: 'butter', qty: 1, time: 300, xp: 18, lvl: 6, cost: { milk: 3 } },
        { id: 'cheese', out: 'cheese', qty: 1, time: 660, xp: 30, lvl: 9, cost: { milk: 4 } }
      ] },
    { id: 'jamshop', name: 'Сладкарница', lvl: 11, cost: 12000,
      recipes: [
        { id: 'jam', out: 'jam', qty: 1, time: 900, xp: 46, lvl: 11, cost: { strawberry: 3, honey: 1 } }
      ] },
    { id: 'loom', name: 'Тъкачница', lvl: 13, cost: 18000,
      recipes: [
        { id: 'yarn', out: 'yarn', qty: 1, time: 1200, xp: 58, lvl: 13, cost: { wool: 3 } }
      ] }
  ];

  var PENS = {
    coop:    { name: 'Курник',   animal: 'chicken', lvl: 1,  cost: 0,    cap: 3 },
    pasture: { name: 'Пасище',   animal: 'cow',     lvl: 4,  cost: 1800, cap: 3 },
    fold:    { name: 'Кошара',   animal: 'sheep',   lvl: 6,  cost: 5200, cap: 3 },
    apiary:  { name: 'Пчелин',   animal: 'bee',     lvl: 10, cost: 11000, cap: 3 }
  };

  // --- Нива и разширения -------------------------------------------------
  var PLOTS_AT_START = 6;
  var PLOTS_TOTAL = 20;

  function plotCost(index) {
    // index е поредният заключен парцел (0 = първият за отключване)
    return Math.round(240 * Math.pow(1.55, index) / 10) * 10;
  }

  var BARN_START = 60;
  function barnUpgradeCost(level) {
    return Math.round(500 * Math.pow(1.8, level) / 10) * 10;
  }
  function barnCapacity(level) {
    return BARN_START + level * 30;
  }

  function penUpgradeCost(pen, slots) {
    return Math.round(PENS[pen].cost * 0.6 * Math.pow(1.9, slots - PENS[pen].cap + 1) / 10) * 10 + 400;
  }

  // --- Нива на играча ----------------------------------------------------
  function xpForLevel(level) {
    return Math.round(45 * Math.pow(level, 1.5));
  }

  // --- Задачи (водеща верига) -------------------------------------------
  // type: harvest | craft | sell | orders | buyAnimal | collect | plots | level
  var QUESTS = [
    { id: 'q1',  title: 'Засей първата си нива',   type: 'plant',      goal: 3,  reward: { coins: 60 } },
    { id: 'q2',  title: 'Прибери 6 житни класа',   type: 'harvest',    item: 'wheat', goal: 6, reward: { coins: 120 } },
    { id: 'q3',  title: 'Направи 4 фуража',        type: 'craft',      item: 'feed',  goal: 4, reward: { coins: 150 } },
    { id: 'q4',  title: 'Купи кокошка',            type: 'buyAnimal',  goal: 1,  reward: { coins: 200, gems: 1 } },
    { id: 'q5',  title: 'Събери 4 яйца',           type: 'collect',    item: 'egg', goal: 4, reward: { coins: 260 } },
    { id: 'q6',  title: 'Изпълни 2 поръчки',       type: 'orders',     goal: 2,  reward: { coins: 400, gems: 1 } },
    { id: 'q7',  title: 'Отключи още 2 ниви',      type: 'plots',      goal: 8,  reward: { coins: 500 } },
    { id: 'q8',  title: 'Смели 3 брашна',          type: 'craft',      item: 'flour', goal: 3, reward: { coins: 700 } },
    { id: 'q9',  title: 'Стигни 5-о ниво',         type: 'level',      goal: 5,  reward: { coins: 900, gems: 2 } },
    { id: 'q10', title: 'Опечи 5 хляба',           type: 'craft',      item: 'bread', goal: 5, reward: { coins: 1400 } },
    { id: 'q11', title: 'Купи крава',              type: 'buyAnimal',  animal: 'cow', goal: 1, reward: { coins: 1600, gems: 2 } },
    { id: 'q12', title: 'Изпълни 10 поръчки',      type: 'orders',     goal: 10, reward: { coins: 2500, gems: 3 } },
    { id: 'q13', title: 'Прибери 20 домата',       type: 'harvest',    item: 'tomato', goal: 20, reward: { coins: 3200 } },
    { id: 'q14', title: 'Стигни 8-о ниво',         type: 'level',      goal: 8,  reward: { coins: 4000, gems: 3 } },
    { id: 'q15', title: 'Произведи 6 сирена',      type: 'craft',      item: 'cheese', goal: 6, reward: { coins: 6000, gems: 3 } },
    { id: 'q16', title: 'Стигни 12-о ниво',        type: 'level',      goal: 12, reward: { coins: 12000, gems: 5 } }
  ];

  // --- Оформление на фермата (изометрична мрежа) -------------------------
  var WORLD = { w: 15, h: 13 };

  var PLOT_SPOTS = [];
  (function () {
    // 5 колони x 4 реда ниви, подредени така, че първите да са най-отпред.
    var order = [];
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 5; c++) order.push({ x: 1 + c, y: 1 + r, rank: r * 5 + c });
    }
    order.sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
    PLOT_SPOTS = order.map(function (p) { return { x: p.x, y: p.y }; });
  })();

  var STRUCTURES = [
    { kind: 'pen',      id: 'coop',     x: 8,  y: 1 },
    { kind: 'pen',      id: 'pasture',  x: 11, y: 1 },
    { kind: 'pen',      id: 'fold',     x: 8,  y: 4 },
    { kind: 'pen',      id: 'apiary',   x: 11, y: 4 },
    { kind: 'building', id: 'feedmill', x: 1,  y: 6 },
    { kind: 'building', id: 'mill',     x: 4,  y: 6 },
    { kind: 'building', id: 'bakery',   x: 7,  y: 6 },
    { kind: 'building', id: 'dairy',    x: 10, y: 6 },
    { kind: 'building', id: 'jamshop',  x: 1,  y: 9 },
    { kind: 'building', id: 'loom',     x: 4,  y: 9 },
    { kind: 'barn',     id: 'barn',     x: 7,  y: 9 },
    { kind: 'house',    id: 'house',    x: 10, y: 9 }
  ];

  var DECOR = [
    { kind: 'tree', x: 0,  y: 0 }, { kind: 'tree', x: 6, y: 0 }, { kind: 'tree', x: 13, y: 0 },
    { kind: 'tree', x: 0,  y: 5 }, { kind: 'tree', x: 13, y: 8 }, { kind: 'tree', x: 6, y: 11 },
    { kind: 'tree', x: 0,  y: 12 }, { kind: 'tree', x: 13, y: 12 },
    { kind: 'pond', x: 12, y: 10 },
    { kind: 'bush', x: 3,  y: 12 }, { kind: 'bush', x: 9, y: 12 }, { kind: 'bush', x: 14, y: 3 },
    { kind: 'bush', x: 0,  y: 8 },  { kind: 'bush', x: 7, y: 12 }
  ];

  // --- Помощни -----------------------------------------------------------
  function cropById(id) {
    for (var i = 0; i < CROPS.length; i++) if (CROPS[i].id === id) return CROPS[i];
    return null;
  }
  function animalById(id) {
    for (var i = 0; i < ANIMALS.length; i++) if (ANIMALS[i].id === id) return ANIMALS[i];
    return null;
  }
  function buildingById(id) {
    for (var i = 0; i < BUILDINGS.length; i++) if (BUILDINGS[i].id === id) return BUILDINGS[i];
    return null;
  }
  function recipeById(id) {
    for (var i = 0; i < BUILDINGS.length; i++) {
      var rs = BUILDINGS[i].recipes;
      for (var j = 0; j < rs.length; j++) if (rs[j].id === id) return rs[j];
    }
    return null;
  }
  function itemName(id) { return ITEMS[id] ? ITEMS[id].name : id; }
  function itemSell(id) { return ITEMS[id] ? ITEMS[id].sell : 1; }

  global.GD = {
    ITEMS: ITEMS, CROPS: CROPS, ANIMALS: ANIMALS, BUILDINGS: BUILDINGS, PENS: PENS,
    QUESTS: QUESTS, WORLD: WORLD, PLOT_SPOTS: PLOT_SPOTS, STRUCTURES: STRUCTURES, DECOR: DECOR,
    PLOTS_AT_START: PLOTS_AT_START, PLOTS_TOTAL: PLOTS_TOTAL, BARN_START: BARN_START,
    plotCost: plotCost, barnUpgradeCost: barnUpgradeCost, barnCapacity: barnCapacity,
    penUpgradeCost: penUpgradeCost, xpForLevel: xpForLevel,
    cropById: cropById, animalById: animalById, buildingById: buildingById, recipeById: recipeById,
    itemName: itemName, itemSell: itemSell
  };
})(window);
