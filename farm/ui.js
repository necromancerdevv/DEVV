/* Слънчева Ферма — интерфейс: HUD, панели, поръчки, хамбар и диалози. */
(function (global) {
  'use strict';

  var D = global.GD, G = global.G, Icon = global.GIcon;
  var el = {};
  var openPanel = null;
  var selectedCrop = 'wheat';
  var lastHud = '';

  function $(id) { return document.getElementById(id); }

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function icon(id, size, cls) {
    return Icon.el(id, size || 40, cls);
  }

  function fmt(n) {
    n = Math.round(n);
    if (n < 10000) return String(n);
    if (n < 1000000) return (n / 1000).toFixed(n < 100000 ? 1 : 0).replace('.0', '') + 'хил';
    return (n / 1000000).toFixed(1).replace('.0', '') + 'млн';
  }

  function time(s) {
    s = Math.max(0, Math.round(s));
    if (s < 60) return s + 'с';
    var m = Math.floor(s / 60), r = s % 60;
    if (m < 60) return m + 'м' + (r ? ' ' + r + 'с' : '');
    var hh = Math.floor(m / 60);
    return hh + 'ч' + (m % 60 ? ' ' + (m % 60) + 'м' : '');
  }

  // --- Известия ----------------------------------------------------------
  function toast(msg, kind) {
    var t = h('div', 'toast' + (kind ? ' toast-' + kind : ''), msg);
    el.toasts.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 2200);
    setTimeout(function () { t.remove(); }, 2700);
  }

  function floatText(text, x, y, kind) {
    var f = h('div', 'float' + (kind ? ' float-' + kind : ''), text);
    f.style.left = x + 'px';
    f.style.top = y + 'px';
    el.floats.appendChild(f);
    setTimeout(function () { f.remove(); }, 1100);
  }

  // Прибраното литва към хамбара горе, а лентата му подскача при пристигане.
  function harvestFx(itemId, qty, x, y, soil) {
    var Scene = global.GScene;
    if (!Scene || !Scene.fly) return;
    var n = Math.min(3, Math.max(1, qty || 1));
    for (var i = 0; i < n; i++) {
      (function (k) {
        setTimeout(function () {
          Scene.fly(itemId, x + (k - (n - 1) / 2) * 14, y - k * 6, 'chipBarn');
        }, k * 90);
      })(i);
    }
    if (soil) Scene.puff(x, y, soil);
    clearTimeout(harvestFx._t);
    harvestFx._t = setTimeout(function () { bump(el.chipBarn); }, 620 + (n - 1) * 90);
  }

  function bump(node) {
    if (!node) return;
    node.classList.remove('bump');
    void node.offsetWidth;
    node.classList.add('bump');
  }

  function floatGain(data, x, y) {
    var parts = [];
    if (data.coins) parts.push('+' + fmt(data.coins) + ' монети');
    if (data.xp) parts.push('+' + data.xp + ' опит');
    if (data.gems) parts.push('+' + data.gems + ' 💎');
    if (parts.length) floatText(parts.join('  '), x, y, 'gain');
  }

  // --- HUD ---------------------------------------------------------------
  function syncHUD() {
    var S = G.state;
    var need = D.xpForLevel(S.level);
    var key = [S.coins, S.gems, S.level, S.xp, G.barnUsed(), G.barnCap()].join('|');
    if (key !== lastHud) {
      lastHud = key;
      el.coinNum.textContent = fmt(S.coins);
      el.gemNum.textContent = fmt(S.gems);
      el.lvlNum.textContent = S.level;
      el.lvlFill.style.width = Math.min(100, S.xp / need * 100) + '%';
      el.barnNum.textContent = G.barnUsed() + '/' + G.barnCap();
      el.chipBarn.classList.toggle('warn', G.barnFree() <= 3);
    }
    syncQuestCard();
    syncOrdersBadge();
  }

  function syncOrdersBadge() {
    var n = 0;
    for (var i = 0; i < G.state.orders.length; i++) if (G.canFillOrder(i)) n++;
    el.ordersBadge.textContent = n;
    el.ordersBadge.classList.toggle('hidden', n === 0);
  }

  function syncQuestCard() {
    var q = G.currentQuest();
    if (!q) { el.questCard.classList.add('hidden'); return; }
    el.questCard.classList.remove('hidden');
    var prog = Math.min(q.goal, G.state.questProg);
    el.questTitle.textContent = q.title;
    el.questFill.style.width = (prog / q.goal * 100) + '%';
    el.questProg.textContent = prog + ' / ' + q.goal;
    var r = [];
    if (q.reward.coins) r.push(fmt(q.reward.coins) + ' монети');
    if (q.reward.gems) r.push(q.reward.gems + ' 💎');
    el.questReward.textContent = r.join(' · ');
  }

  // --- Долен панел -------------------------------------------------------
  var current = null; // последният показан панел, за да може да се пре-рисува

  function sheet(title, build) {
    current = { title: title, build: build };
    el.sheetTitle.textContent = title;
    el.sheetBody.innerHTML = '';
    build(el.sheetBody);
    el.sheet.classList.remove('hidden');
    el.scrim.classList.remove('hidden');
    requestAnimationFrame(function () { el.sheet.classList.add('up'); });
  }

  function closeSheet() {
    el.sheet.classList.remove('up');
    el.scrim.classList.add('hidden');
    openPanel = null;
    current = null;
    setTimeout(function () {
      if (!el.sheet.classList.contains('up')) el.sheet.classList.add('hidden');
    }, 220);
    document.querySelectorAll('.dock-btn.on').forEach(function (b) { b.classList.remove('on'); });
  }

  // Пре-рисува отворения панел, без да губи позицията на скрола.
  function reopen() {
    if (!current || el.sheet.classList.contains('hidden')) return;
    var top = el.sheetBody.scrollTop;
    el.sheetBody.innerHTML = '';
    current.build(el.sheetBody);
    el.sheetBody.scrollTop = top;
  }

  function panel(name) {
    openPanel = name;
    document.querySelectorAll('.dock-btn').forEach(function (b) {
      b.classList.toggle('on', b.dataset.panel === name);
    });
    if (name === 'shop') sheet('Магазин', buildShop);
    else if (name === 'barn') sheet('Хамбар', buildBarn);
    else if (name === 'orders') sheet('Поръчки', buildOrders);
    else if (name === 'quests') sheet('Задачи', buildQuests);
    else if (name === 'menu') sheet('Меню', buildMenu);
  }

  function row(opts) {
    var r = h('div', 'row' + (opts.dim ? ' dim' : ''));
    if (opts.icon) r.appendChild(icon(opts.icon, 44, 'row-ico'));
    var mid = h('div', 'row-mid');
    mid.appendChild(h('div', 'row-title', opts.title));
    if (opts.note) mid.appendChild(h('div', 'row-note', opts.note));
    if (opts.extra) mid.appendChild(opts.extra);
    r.appendChild(mid);
    if (opts.action) r.appendChild(opts.action);
    return r;
  }

  function btn(label, onClick, cls) {
    var b = h('button', 'btn' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      onClick(ev);
    });
    return b;
  }

  function priceBtn(label, cost, currency, onClick, disabled) {
    var b = h('button', 'btn btn-buy' + (disabled ? ' off' : ''));
    b.type = 'button';
    b.appendChild(h('span', 'btn-label', label));
    var p = h('span', 'btn-price');
    p.appendChild(icon(currency === 'gem' ? 'gem' : 'coin', 22, 'mini'));
    p.appendChild(h('b', null, fmt(cost)));
    b.appendChild(p);
    if (!disabled) b.addEventListener('click', function (ev) { ev.stopPropagation(); onClick(ev); });
    return b;
  }

  function act(res, gainAt) {
    if (!res.ok) { toast(res.msg, 'bad'); return false; }
    G.save();
    syncHUD();
    reopen();
    return true;
  }

  // --- Магазин -----------------------------------------------------------
  function buildShop(body) {
    var S = G.state;
    body.appendChild(h('h3', 'sec', 'Семена'));
    D.CROPS.forEach(function (c) {
      var locked = c.lvl > S.level;
      var note = locked ? 'Отключва се на ниво ' + c.lvl
        : time(c.time) + ' · продава се за ' + fmt(D.itemSell(c.item)) + ' монети · +' + c.xp + ' опит';
      var action;
      if (locked) {
        action = icon('lock', 28, 'mini');
      } else {
        var chosen = selectedCrop === c.id;
        action = btn(chosen ? 'Избрано' : 'Избери', function () {
          selectedCrop = c.id;
          toast('Избра ' + D.itemName(c.item).toLowerCase() + ' — докосни нива, за да засееш', 'good');
          reopen();
        }, chosen ? 'on' : '');
      }
      var r = row({ icon: c.item, title: D.itemName(c.item), note: note, action: action, dim: locked });
      if (!locked) {
        var price = h('div', 'row-price');
        price.appendChild(icon('coin', 20, 'mini'));
        price.appendChild(h('b', null, fmt(c.seed)));
        r.insertBefore(price, r.lastChild);
      }
      body.appendChild(r);
    });

    var plantAllBtn = btn('Засей всички свободни ниви с ' + D.itemName(D.cropById(selectedCrop).item).toLowerCase(), function () {
      var n = G.plantAll(selectedCrop);
      if (n) { toast('Засети ' + n + ' ниви', 'good'); G.save(); syncHUD(); reopen(); }
      else toast('Няма свободни ниви или монети', 'bad');
    }, 'wide');
    body.appendChild(plantAllBtn);

    body.appendChild(h('h3', 'sec', 'Животни и постройки'));
    Object.keys(D.PENS).forEach(function (penId) {
      var def = D.PENS[penId];
      var st = S.pens[penId];
      var an = D.animalById(def.animal);
      if (!st.owned) {
        var canBuild = S.level >= def.lvl;
        body.appendChild(row({
          icon: def.animal, title: def.name, dim: !canBuild,
          note: canBuild ? 'Дава ' + D.itemName(an.item).toLowerCase() + ' на всеки ' + time(an.time) : 'Отключва се на ниво ' + def.lvl,
          action: canBuild ? priceBtn('Построй', def.cost, 'coin', function () {
            if (act(G.buyPen(penId))) toast(def.name + ' е готова!', 'good');
          }, S.coins < def.cost) : icon('lock', 28, 'mini')
        }));
        return;
      }
      var full = st.animals.length >= st.slots;
      body.appendChild(row({
        icon: def.animal, title: an.name,
        note: st.animals.length + ' от ' + st.slots + ' места · ' + time(an.time) + ' за ' + D.itemName(an.item).toLowerCase(),
        action: full
          ? priceBtn('Разшири', D.penUpgradeCost(penId, st.slots), 'coin', function () {
            if (act(G.upgradePen(penId))) toast('Има място за още едно животно', 'good');
          }, st.slots >= 6 || S.coins < D.penUpgradeCost(penId, st.slots))
          : priceBtn('Купи', an.cost, 'coin', function () {
            var r = G.buyAnimal(penId);
            if (act(r)) toast('Добре дошла в стопанството!', 'good');
          }, S.coins < an.cost || S.level < an.lvl)
      }));
    });

    body.appendChild(h('h3', 'sec', 'Цехове'));
    D.BUILDINGS.forEach(function (b) {
      var st = S.buildings[b.id];
      if (st.owned) {
        body.appendChild(row({
          icon: b.recipes[0].out, title: b.name, note: 'Построен · ' + st.slots + ' работни места',
          action: btn('Отвори', function () { closeSheet(); openBuilding(b.id); })
        }));
      } else {
        var can = S.level >= b.lvl;
        body.appendChild(row({
          icon: b.recipes[0].out, title: b.name, dim: !can,
          note: can ? 'Прави ' + b.recipes.map(function (r) { return D.itemName(r.out).toLowerCase(); }).join(', ') : 'Отключва се на ниво ' + b.lvl,
          action: can ? priceBtn('Построй', b.cost, 'coin', function () {
            if (act(G.buildBuilding(b.id))) toast(b.name + ' е построен!', 'good');
          }, S.coins < b.cost) : icon('lock', 28, 'mini')
        }));
      }
    });

    body.appendChild(h('h3', 'sec', 'Стопанство'));
    var lock = G.nextLockedPlot();
    if (lock >= 0) {
      body.appendChild(row({
        icon: 'plus', title: 'Нова нива', note: 'Имаш ' + G.openPlots() + ' от ' + D.PLOTS_TOTAL + ' ниви',
        action: priceBtn('Разчисти', G.plotPrice(lock), 'coin', function () {
          if (act(G.unlockPlot(lock))) toast('Нивата е твоя!', 'good');
        }, S.coins < G.plotPrice(lock))
      }));
    }
    body.appendChild(row({
      icon: 'barn', title: 'Разшири хамбара', note: 'Побира ' + G.barnCap() + ' стоки',
      action: priceBtn('Разшири', D.barnUpgradeCost(S.barnLvl), 'coin', function () {
        if (act(G.barnUpgrade())) toast('Хамбарът вече побира ' + G.barnCap(), 'good');
      }, S.coins < D.barnUpgradeCost(S.barnLvl))
    }));
  }

  // --- Хамбар ------------------------------------------------------------
  function buildBarn(body) {
    var S = G.state;
    var bar = h('div', 'barn-bar');
    var fill = h('i');
    fill.style.width = Math.min(100, G.barnUsed() / G.barnCap() * 100) + '%';
    bar.appendChild(fill);
    body.appendChild(bar);
    body.appendChild(h('div', 'barn-cap', G.barnUsed() + ' от ' + G.barnCap() + ' места заети'));

    var keys = Object.keys(S.inv).filter(function (k) { return S.inv[k] > 0; });
    if (!keys.length) {
      body.appendChild(h('p', 'empty-note', 'Хамбарът е празен. Засей нива и се върни, като узрее.'));
    }
    keys.sort(function (a, b) { return D.itemSell(b) - D.itemSell(a); });
    keys.forEach(function (k) {
      var qty = S.inv[k];
      var actions = h('div', 'row-actions');
      actions.appendChild(btn('Продай 1', function () {
        var r = G.sell(k, 1);
        if (r.ok) { toast('+' + fmt(r.data.coins) + ' монети', 'good'); G.save(); syncHUD(); reopen(); }
        else toast(r.msg, 'bad');
      }));
      actions.appendChild(btn('Всички', function () {
        var r = G.sell(k, qty);
        if (r.ok) { toast('Продаде ' + r.data.qty + ' за ' + fmt(r.data.coins) + ' монети', 'good'); G.save(); syncHUD(); reopen(); }
      }, 'ghost'));
      body.appendChild(row({
        icon: k, title: D.itemName(k) + ' × ' + qty,
        note: fmt(D.itemSell(k)) + ' монети за брой',
        action: actions
      }));
    });

    body.appendChild(row({
      icon: 'barn', title: 'Разшири хамбара', note: '+30 места',
      action: priceBtn('Разшири', D.barnUpgradeCost(S.barnLvl), 'coin', function () {
        if (act(G.barnUpgrade())) toast('Хамбарът е по-голям', 'good');
      }, S.coins < D.barnUpgradeCost(S.barnLvl))
    }));
  }

  // --- Поръчки -----------------------------------------------------------
  function buildOrders(body) {
    var S = G.state;
    body.appendChild(h('p', 'panel-note', 'Събери стоките и получаваш монети и опит. Нова поръчка идва на всяко освободено място.'));
    var grid = h('div', 'orders');
    S.orders.forEach(function (o, i) {
      var card = h('div', 'order');
      if (!o || !o.items) {
        card.classList.add('order-wait');
        card.appendChild(icon('clock', 40, 'order-clock'));
        card.appendChild(h('div', 'order-wait-txt', 'Нова поръчка след ' + time(G.orderRefillLeft(i))));
        grid.appendChild(card);
        return;
      }
      var items = h('div', 'order-items');
      Object.keys(o.items).forEach(function (k) {
        var need = o.items[k], have = G.countItem(k);
        var it = h('div', 'order-item' + (have >= need ? ' ok' : ''));
        it.appendChild(icon(k, 40));
        it.appendChild(h('span', null, '×' + need));
        it.appendChild(h('em', 'order-have', have >= need ? 'готово' : 'имаш ' + have));
        items.appendChild(it);
      });
      card.appendChild(items);
      var rew = h('div', 'order-reward');
      rew.appendChild(icon('coin', 22, 'mini'));
      rew.appendChild(h('b', null, fmt(o.coins)));
      rew.appendChild(h('span', 'xp', '+' + o.xp + ' опит'));
      if (o.gems) {
        rew.appendChild(icon('gem', 20, 'mini'));
        rew.appendChild(h('b', null, String(o.gems)));
      }
      card.appendChild(rew);
      var can = G.canFillOrder(i);
      var actions = h('div', 'order-actions');
      actions.appendChild(btn('Изпълни', function () {
        var r = G.fillOrder(i);
        if (r.ok) {
          toast('Поръчката е изпратена! +' + fmt(r.data.coins) + ' монети', 'good');
          G.save(); syncHUD(); reopen();
        } else toast(r.msg, 'bad');
      }, can ? 'go' : 'off'));
      actions.appendChild(btn('Откажи', function () {
        G.skipOrder(i); G.save(); syncHUD(); reopen();
      }, 'ghost small'));
      card.appendChild(actions);
      grid.appendChild(card);
    });
    body.appendChild(grid);
  }

  // --- Задачи ------------------------------------------------------------
  function buildQuests(body) {
    var S = G.state;
    var cur = G.currentQuest();
    if (!cur) body.appendChild(h('p', 'panel-note', 'Изпълни си всички задачи. Фермата е твоя — играй на воля!'));
    D.QUESTS.forEach(function (q, i) {
      var done = i < S.questIdx;
      var active = i === S.questIdx;
      if (i > S.questIdx + 2) return;
      var note = done ? 'Изпълнена' : active ? Math.min(q.goal, S.questProg) + ' / ' + q.goal : 'Заключена';
      var r = row({
        icon: done ? 'quest' : 'quest', title: q.title, note: note, dim: !active && !done,
        action: h('span', 'quest-pay', (q.reward.coins ? fmt(q.reward.coins) + ' монети' : '') + (q.reward.gems ? ' + ' + q.reward.gems + ' 💎' : ''))
      });
      if (done) r.classList.add('done');
      if (active) r.classList.add('active');
      body.appendChild(r);
    });
  }

  // --- Меню --------------------------------------------------------------
  function buildMenu(body) {
    var S = G.state;
    body.appendChild(row({
      icon: 'coin', title: 'Дневен подарък',
      note: G.dailyReady() ? 'Готов е за прибиране' : 'Ела пак след ' + time(20 * 3600 - (G.sec() - S.lastDaily)),
      action: btn(G.dailyReady() ? 'Вземи' : 'Чака', function () {
        var r = G.claimDaily();
        if (r.ok) { toast('+' + fmt(r.data.coins) + ' монети и 1 диамант', 'good'); G.save(); syncHUD(); reopen(); }
        else toast(r.msg, 'bad');
      }, G.dailyReady() ? 'go' : 'off')
    }));

    body.appendChild(h('h3', 'sec', 'Статистика'));
    var stats = [
      ['Ниво', S.level],
      ['Изпълнени поръчки', S.stats.ordersDone],
      ['Засети ниви', S.stats.planted],
      ['Изкарани монети', fmt(S.stats.coinsEarned)],
      ['Животни в стопанството', Object.keys(S.pens).reduce(function (n, p) { return n + S.pens[p].animals.length; }, 0)],
      ['Ниви', G.openPlots() + ' от ' + D.PLOTS_TOTAL]
    ];
    var table = h('div', 'stats');
    stats.forEach(function (s) {
      var r = h('div', 'stat');
      r.appendChild(h('span', null, s[0]));
      r.appendChild(h('b', null, String(s[1])));
      table.appendChild(r);
    });
    body.appendChild(table);

    body.appendChild(h('h3', 'sec', 'Настройки'));
    body.appendChild(row({
      icon: 'menu', title: 'Звук', note: S.sound ? 'Включен' : 'Изключен',
      action: btn(S.sound ? 'Изключи' : 'Включи', function () {
        S.sound = !S.sound; G.touch(); G.save(true); reopen();
      })
    }));
    body.appendChild(row({
      icon: 'board', title: 'Запиши кода на играта', note: 'Копирай го, за да пренесеш фермата на друго устройство',
      action: btn('Копирай', function () {
        var code = G.exportSave();
        navigator.clipboard && navigator.clipboard.writeText(code)
          .then(function () { toast('Кодът е копиран', 'good'); })
          .catch(function () { prompt('Копирай кода:', code); });
      })
    }));
    body.appendChild(row({
      icon: 'board', title: 'Възстанови от код', note: 'Постави код от друго устройство',
      action: btn('Постави', function () {
        var code = prompt('Постави кода на фермата:');
        if (!code) return;
        if (G.importSave(code)) { toast('Фермата е възстановена', 'good'); syncHUD(); reopen(); }
        else toast('Кодът не е валиден', 'bad');
      }, 'ghost')
    }));
    body.appendChild(row({
      icon: 'lock', title: 'Започни отначало', note: 'Изтрива целия напредък',
      action: btn('Изтрий', function () {
        if (confirm('Сигурен ли си? Целият напредък се губи.')) {
          G.reset(); closeSheet(); syncHUD();
          toast('Нова ферма!', 'good');
        }
      }, 'danger')
    }));
    body.appendChild(h('p', 'panel-note', 'Слънчева Ферма работи и офлайн. Добави я на началния екран от менюто на браузъра, за да я пускаш като приложение.'));
  }

  // --- Диалози за обекти -------------------------------------------------
  function openPlot(index) {
    var st = G.plotState(index);
    if (st === 'locked') {
      sheet('Нова нива', function (body) {
        body.appendChild(h('p', 'panel-note', 'Разчисти парцела и засявай повече наведнъж.'));
        body.appendChild(row({
          icon: 'plus', title: 'Разчисти нивата', note: 'Имаш ' + G.openPlots() + ' от ' + D.PLOTS_TOTAL,
          action: priceBtn('Разчисти', G.plotPrice(index), 'coin', function () {
            var r = G.unlockPlot(index);
            if (r.ok) { toast('Нивата е твоя!', 'good'); G.save(); syncHUD(); closeSheet(); }
            else toast(r.msg, 'bad');
          }, G.state.coins < G.plotPrice(index))
        }));
      });
      return;
    }
    if (st === 'empty') {
      sheet('Какво да засеем?', function (body) {
        D.CROPS.forEach(function (c) {
          var locked = c.lvl > G.state.level;
          var afford = G.state.coins >= c.seed;
          body.appendChild(row({
            icon: c.item, title: D.itemName(c.item), dim: locked,
            note: locked ? 'Ниво ' + c.lvl : time(c.time) + ' · +' + c.xp + ' опит · продава се за ' + fmt(D.itemSell(c.item)),
            action: locked ? icon('lock', 28, 'mini') : priceBtn('Засей', c.seed, 'coin', function () {
              var r = G.plant(index, c.id);
              if (r.ok) { selectedCrop = c.id; G.save(); syncHUD(); closeSheet(); }
              else toast(r.msg, 'bad');
            }, !afford)
          }));
        });
      });
      return;
    }
    if (st === 'growing') {
      var left = G.plotLeft(index);
      var cost = G.gemCost(left);
      sheet('Расте', function (body) {
        var crop = D.cropById(G.state.plots[index].crop);
        body.appendChild(row({
          icon: crop.item, title: D.itemName(crop.item), note: 'Готово след ' + time(left)
        }));
        body.appendChild(priceBtn('Ускори веднага', cost, 'gem', function () {
          var r = G.speedPlot(index);
          if (r.ok) { toast('Реколтата е готова!', 'good'); G.save(); syncHUD(); closeSheet(); }
          else toast(r.msg, 'bad');
        }, G.state.gems < cost));
      });
    }
  }

  function openPen(penId) {
    var def = D.PENS[penId];
    var an = D.animalById(def.animal);
    var st = G.state.pens[penId];
    sheet(def.name, function (body) {
      if (!st.owned) {
        var can = G.state.level >= def.lvl;
        body.appendChild(row({
          icon: def.animal, title: def.name,
          note: can ? 'Дава ' + D.itemName(an.item).toLowerCase() + ' на всеки ' + time(an.time) : 'Отключва се на ниво ' + def.lvl,
          action: can ? priceBtn('Построй', def.cost, 'coin', function () {
            if (act(G.buyPen(penId))) toast(def.name + ' е готова', 'good');
          }, G.state.coins < def.cost) : icon('lock', 28, 'mini')
        }));
        return;
      }

      body.appendChild(h('p', 'panel-note',
        'Животните дават продукция, след като ги нахраниш. Фуражът се прави във фуражния цех.'));

      var ready = G.penReadyCount(penId);
      if (ready) {
        body.appendChild(row({
          icon: an.item, title: 'Готова продукция: ' + ready,
          note: D.itemName(an.item),
          action: btn('Прибери', function () {
            var r = G.collectPen(penId);
            if (r.ok) { toast('+' + r.data.qty + ' ' + D.itemName(an.item).toLowerCase(), 'good'); G.save(); syncHUD(); reopen(); }
            else toast(r.msg, 'bad');
          }, 'go')
        }));
      }

      var need = G.penNeedsFeed(penId);
      if (need > 0) {
        body.appendChild(row({
          icon: 'feed', title: 'Нахрани животните', note: 'Нужен фураж: ' + need + ' · имаш ' + G.countItem('feed'),
          action: btn('Нахрани', function () {
            var r = G.feedPen(penId);
            if (r.ok) { toast('Нахрани ' + r.data.fed + ' животни', 'good'); G.save(); syncHUD(); reopen(); }
            else toast(r.msg, 'bad');
          }, G.countItem('feed') >= an.feed ? 'go' : 'off')
        }));
      }

      var nxt = G.penNextReady(penId);
      if (nxt) {
        var cost = 0, t = G.sec();
        st.animals.forEach(function (a) { if (a.done > t) cost += G.gemCost(a.done - t); });
        body.appendChild(row({
          icon: 'clock', title: 'Следваща продукция', note: 'След ' + time(nxt),
          action: priceBtn('Ускори', cost, 'gem', function () {
            var r = G.speedPen(penId);
            if (r.ok) { G.save(); syncHUD(); reopen(); } else toast(r.msg, 'bad');
          }, G.state.gems < cost)
        }));
      }

      body.appendChild(h('h3', 'sec', 'Стопанство (' + st.animals.length + '/' + st.slots + ')'));
      st.animals.forEach(function (a) {
        var state = a.fed ? (a.done <= G.sec() ? 'Готово!' : 'Работи · ' + time(a.done - G.sec())) : 'Гладна е';
        body.appendChild(row({ icon: def.animal, title: a.name || an.name, note: state }));
      });

      if (st.animals.length < st.slots) {
        body.appendChild(row({
          icon: def.animal, title: 'Купи ' + an.name.toLowerCase(), note: 'Свободни места: ' + (st.slots - st.animals.length),
          action: priceBtn('Купи', an.cost, 'coin', function () {
            if (act(G.buyAnimal(penId))) toast('Ново животно в стопанството!', 'good');
          }, G.state.coins < an.cost || G.state.level < an.lvl)
        }));
      } else if (st.slots < 6) {
        body.appendChild(row({
          icon: 'plus', title: 'Разшири постройката', note: 'Още едно място',
          action: priceBtn('Разшири', D.penUpgradeCost(penId, st.slots), 'coin', function () {
            if (act(G.upgradePen(penId))) toast('Има ново място', 'good');
          }, G.state.coins < D.penUpgradeCost(penId, st.slots))
        }));
      }
    });
  }

  function openBuilding(id) {
    var def = D.buildingById(id);
    var st = G.state.buildings[id];
    sheet(def.name, function (body) {
      if (!st.owned) {
        var can = G.state.level >= def.lvl;
        body.appendChild(row({
          icon: def.recipes[0].out, title: def.name,
          note: can ? 'Построй го, за да произвеждаш' : 'Отключва се на ниво ' + def.lvl,
          action: can ? priceBtn('Построй', def.cost, 'coin', function () {
            if (act(G.buildBuilding(id))) toast(def.name + ' е построен', 'good');
          }, G.state.coins < def.cost) : icon('lock', 28, 'mini')
        }));
        return;
      }

      var ready = G.buildingReady(id);
      if (ready) {
        body.appendChild(row({
          icon: D.recipeById(st.queue[0].r).out, title: 'Готова продукция: ' + ready,
          action: btn('Прибери', function () {
            var r = G.collectCraft(id);
            if (r.ok) {
              var names = Object.keys(r.data.got).map(function (k) { return r.data.got[k] + ' ' + D.itemName(k).toLowerCase(); });
              toast('Прибра ' + names.join(', '), 'good');
              G.save(); syncHUD(); reopen();
            } else toast(r.msg, 'bad');
          }, 'go')
        }));
      }

      if (st.queue.length) {
        body.appendChild(h('h3', 'sec', 'В работа (' + st.queue.length + '/' + st.slots + ')'));
        st.queue.forEach(function (q, i) {
          var r = D.recipeById(q.r);
          var left = Math.max(0, q.done - G.sec());
          body.appendChild(row({
            icon: r.out, title: D.itemName(r.out) + ' × ' + r.qty,
            note: left ? 'Готово след ' + time(left) : 'Готово!'
          }));
        });
        var total = 0, t = G.sec();
        st.queue.forEach(function (q) { if (q.done > t) total += G.gemCost(q.done - t); });
        if (total) {
          body.appendChild(priceBtn('Ускори всичко', total, 'gem', function () {
            var r = G.speedBuilding(id);
            if (r.ok) { G.save(); syncHUD(); reopen(); } else toast(r.msg, 'bad');
          }, G.state.gems < total));
        }
      }

      body.appendChild(h('h3', 'sec', 'Рецепти'));
      def.recipes.forEach(function (r) {
        var locked = G.state.level > 0 && r.lvl > G.state.level;
        var costTxt = Object.keys(r.cost).map(function (k) {
          return D.itemName(k) + ' ×' + r.cost[k] + ' (имаш ' + G.countItem(k) + ')';
        }).join(' · ');
        var can = !locked && G.hasItems(r.cost) && st.queue.length < st.slots;
        body.appendChild(row({
          icon: r.out, title: D.itemName(r.out) + ' × ' + r.qty, dim: locked,
          note: locked ? 'Отключва се на ниво ' + r.lvl : costTxt + ' · ' + time(r.time),
          action: locked ? icon('lock', 28, 'mini') : btn('Направи', function () {
            var res = G.craft(id, r.id);
            if (res.ok) { toast('Започна работа', 'good'); G.save(); syncHUD(); reopen(); }
            else toast(res.msg, 'bad');
          }, can ? 'go' : 'off')
        }));
      });
    });
  }

  // --- Докосване по сцената ---------------------------------------------
  function tapObject(obj, sx, sy) {
    if (!obj) return;
    if (obj.type === 'plot') {
      var st = G.plotState(obj.index);
      if (st === 'ripe') {
        var crop = D.cropById(G.state.plots[obj.index].crop);
        var r = G.harvest(obj.index);
        if (r.ok) {
          harvestFx(crop.item, 1, sx, sy, '#8b5f38');
          global.GSfx && global.GSfx.play('pop');
          G.save(); syncHUD();
        } else toast(r.msg, 'bad');
      } else if (st === 'empty' && G.canPlant(selectedCrop)) {
        var pr = G.plant(obj.index, selectedCrop);
        if (pr.ok) {
          floatText('−' + D.cropById(selectedCrop).seed, sx, sy, 'cost');
          global.GSfx && global.GSfx.play('plant');
          G.save(); syncHUD();
        } else openPlot(obj.index);
      } else {
        openPlot(obj.index);
      }
    } else if (obj.type === 'pen') {
      var pen = obj.id;
      if (G.state.pens[pen].owned && G.penReadyCount(pen)) {
        var an = G.penAnimalDef(pen);
        var cr = G.collectPen(pen);
        if (cr.ok) {
          harvestFx(an.item, cr.data.qty, sx, sy, '#f3f1ea');
          global.GSfx && global.GSfx.play('pop');
          G.save(); syncHUD();
        } else toast(cr.msg, 'bad');
      } else openPen(pen);
    } else if (obj.type === 'building') {
      if (G.state.buildings[obj.id].owned && G.buildingReady(obj.id)) {
        var res = G.collectCraft(obj.id);
        if (res.ok) {
          var keys = Object.keys(res.data.got);
          if (keys.length) harvestFx(keys[0], res.data.got[keys[0]], sx, sy, '#f2e3c6');
          global.GSfx && global.GSfx.play('pop');
          G.save(); syncHUD();
        } else toast(res.msg, 'bad');
      } else openBuilding(obj.id);
    } else if (obj.type === 'barn') {
      panel('barn');
    } else if (obj.type === 'house') {
      panel('menu');
    }
  }

  // --- Съобщения при ниво и задачи --------------------------------------
  function levelUpDialog(ups) {
    var last = ups[ups.length - 1];
    sheet('Ниво ' + last.level + '!', function (body) {
      body.appendChild(h('p', 'panel-note', 'Браво! Фермата расте.'));
      var r = h('div', 'reward-row');
      r.appendChild(icon('coin', 44));
      r.appendChild(h('b', null, '+' + fmt(last.reward.coins)));
      r.appendChild(icon('gem', 40));
      r.appendChild(h('b', null, '+' + last.reward.gems));
      body.appendChild(r);
      var all = [];
      ups.forEach(function (u) { all = all.concat(u.unlocks); });
      if (all.length) {
        body.appendChild(h('h3', 'sec', 'Отключи'));
        all.forEach(function (u) { body.appendChild(h('div', 'unlock', u)); });
      }
      body.appendChild(btn('Напред!', closeSheet, 'wide go'));
    });
  }

  function hint(text) {
    el.hint.textContent = text;
    el.hint.classList.remove('hidden');
    clearTimeout(el.hint._t);
    el.hint._t = setTimeout(function () { el.hint.classList.add('hidden'); }, 5200);
  }

  // --- Старт -------------------------------------------------------------
  function init() {
    ['coinNum', 'gemNum', 'lvlNum', 'lvlFill', 'barnNum', 'chipBarn', 'sheet', 'sheetTitle',
      'sheetBody', 'sheetClose', 'scrim', 'toasts', 'floats', 'questCard', 'questTitle',
      'questFill', 'questProg', 'questReward', 'questFold', 'ordersBadge', 'hint'].forEach(function (id) {
        el[id] = $(id);
      });

    Icon.paint(document);

    document.querySelectorAll('.dock-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        if (openPanel === b.dataset.panel) closeSheet();
        else panel(b.dataset.panel);
      });
    });
    el.sheetClose.addEventListener('click', closeSheet);
    el.scrim.addEventListener('click', closeSheet);
    el.questFold.addEventListener('click', function () {
      el.questCard.classList.toggle('folded');
      el.questFold.textContent = el.questCard.classList.contains('folded') ? '▸' : '▾';
    });
    el.questCard.addEventListener('click', function (ev) {
      if (ev.target === el.questFold) return;
      panel('quests');
    });

    G.on('levelup', function (ups) {
      global.GSfx && global.GSfx.play('level');
      levelUpDialog(ups);
      syncHUD();
    });
    G.on('quest', function (q) {
      toast('Задача изпълнена: ' + q.title, 'good');
      global.GSfx && global.GSfx.play('quest');
    });

    syncHUD();
  }

  global.GUI = {
    init: init, syncHUD: syncHUD, toast: toast, hint: hint, panel: panel,
    closeSheet: closeSheet, tapObject: tapObject, reopen: reopen,
    isOpen: function () { return !!openPanel || !el.sheet.classList.contains('hidden'); },
    get panelName() { return openPanel; },
    floatText: floatText, time: time, fmt: fmt
  };
})(window);
