/* Clothing store view.
 *
 * Deliberately a separate listener from app.js: the wardrobe is a whole screen
 * with its own state (active tab, active category, item page), not another
 * entry in the generic list menu, and keeping it apart means the two cannot
 * fight over the same DOM.
 */
(function () {
    "use strict";

    const resourceName = (window.GetParentResourceName && window.GetParentResourceName()) || "rsg-character";

    const root = document.getElementById("wardrobe");
    if (!root) return;

    const tabsEl = document.getElementById("wd-tabs");
    const titleEl = document.getElementById("wd-title");
    const subtitleEl = document.getElementById("wd-subtitle");
    const catsEl = document.getElementById("wd-cats");
    const catNameEl = document.getElementById("wd-cat-name");
    const jumpLabel = document.getElementById("wd-jump-label");
    const jumpInput = document.getElementById("wd-jump-input");
    const browserEl = document.getElementById("wd-browser");
    const moneyLabel = document.getElementById("wd-money-label");
    const moneyEl = document.getElementById("wd-money");
    const totalLabel = document.getElementById("wd-total-label");
    const priceEl = document.getElementById("wd-price");
    const removeBtn = document.getElementById("wd-remove");
    const saveBtn = document.getElementById("wd-save");
    const exitBtn = document.getElementById("wd-exit");

    /* How many item chips to draw at once. Some categories carry hundreds of
     * models and drawing them all makes every click re-layout the grid. */
    const PAGE_SIZE = 120;
    /* Channel strip resolution: 0..254 shown as 32 steps of 8. */
    const STRIP_STEP = 8;

    let payload = null;
    let activeTabId = null;
    let activeCatId = null;
    let page = 0;
    /* Picking an item re-renders the browser. Without carrying these over, the
     * grid would jump back to the top and the colour channels would fold away
     * on every single click. */
    let gridScroll = 0;
    let advancedOpen = false;

    function post(cb, data) {
        fetch(`https://${resourceName}/${cb}`, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=UTF-8" },
            body: JSON.stringify(data || {})
        }).catch((err) => {
            console.warn(`[rsg-character] wardrobe post("${cb}") failed:`, err);
        });
    }

    function labels() { return (payload && payload.labels) || {}; }
    function tintOff() { return (payload && payload.tintOff) || 255; }

    function findTab(id) {
        if (!payload) return null;
        return (payload.tabs || []).find((t) => t.id === id) || null;
    }

    function findCategory(id) {
        if (!payload) return null;
        for (const tab of payload.tabs || []) {
            const cat = (tab.categories || []).find((c) => c.id === id);
            if (cat) return cat;
        }
        return null;
    }

    function activeCategory() { return activeCatId ? findCategory(activeCatId) : null; }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function money(value) {
        const n = Number(value) || 0;
        return "$" + (Math.round(n * 100) / 100).toFixed(2);
    }

    /* ---- tabs ---------------------------------------------------------- */

    function renderTabs() {
        tabsEl.innerHTML = "";
        for (const tab of (payload && payload.tabs) || []) {
            const btn = el("button", "wd-tab" + (tab.id === activeTabId ? " active" : ""));
            btn.type = "button";
            btn.title = tab.label || tab.id;

            const icon = el("div", "wd-tab-icon");
            if (tab.icon) icon.style.backgroundImage = `url("${encodeURI(tab.icon).replace(/"/g, "%22")}")`;
            btn.appendChild(icon);
            btn.appendChild(el("div", "wd-tab-label", tab.label || tab.id));

            /* A dot marks a tab that currently has something worn, so you can
             * see at a glance where your outfit lives. */
            if ((tab.categories || []).some((c) => (c.model || 0) > 0)) {
                btn.appendChild(el("div", "wd-tab-dot"));
            }

            btn.addEventListener("click", () => selectTab(tab.id));
            tabsEl.appendChild(btn);
        }
    }

    function selectTab(id) {
        const tab = findTab(id);
        if (!tab) return;
        activeTabId = id;
        const first = (tab.categories || [])[0];
        activeCatId = first ? first.id : null;
        page = pageOf(activeCategory());
        gridScroll = 0;
        renderTabs();
        renderCategories();
        renderBrowser();
    }

    /* ---- category list ------------------------------------------------- */

    function renderCategories() {
        catsEl.innerHTML = "";
        const tab = findTab(activeTabId);
        if (!tab) return;

        for (const cat of tab.categories || []) {
            const btn = el("button", "wd-cat" + (cat.id === activeCatId ? " active" : ""));
            btn.type = "button";
            btn.dataset.category = cat.id;

            const body = el("div", "wd-cat-body");
            body.appendChild(el("div", "wd-cat-name", cat.label || cat.id));
            body.appendChild(categoryMeta(cat));
            btn.appendChild(body);

            if (cat.price) btn.appendChild(el("div", "wd-cat-price", money(cat.price)));

            btn.addEventListener("click", () => selectCategory(cat.id));
            catsEl.appendChild(btn);
        }
    }

    function categoryMeta(cat) {
        const worn = (cat.model || 0) > 0;
        const meta = el("div", "wd-cat-meta" + (worn ? " wd-cat-worn" : ""));
        if (!worn) {
            meta.textContent = labels().none || "None";
        } else if ((cat.maxVariants || 0) > 1) {
            meta.textContent = `#${cat.model}/${cat.maxModels} · ${cat.variant}/${cat.maxVariants}`;
        } else {
            meta.textContent = `#${cat.model}/${cat.maxModels}`;
        }
        return meta;
    }

    function refreshCategoryRow(cat) {
        const row = catsEl.querySelector(`.wd-cat[data-category="${CSS.escape(cat.id)}"]`);
        if (!row) return;
        const body = row.querySelector(".wd-cat-body");
        const meta = body && body.querySelector(".wd-cat-meta");
        if (meta) body.replaceChild(categoryMeta(cat), meta);
    }

    function selectCategory(id) {
        activeCatId = id;
        page = pageOf(activeCategory());
        gridScroll = 0;
        renderCategories();
        renderBrowser();
    }

    function pageOf(cat) {
        if (!cat || !(cat.model > 0)) return 0;
        return Math.floor((cat.model - 1) / PAGE_SIZE);
    }

    /* ---- browser ------------------------------------------------------- */

    function renderBrowser() {
        const keptScroll = gridScroll;
        browserEl.innerHTML = "";
        const cat = activeCategory();

        catNameEl.textContent = cat ? (cat.label || cat.id) : "";
        jumpInput.value = cat && cat.model ? cat.model : "";
        jumpInput.max = cat ? cat.maxModels : 0;
        jumpInput.disabled = !cat;

        if (!cat) {
            browserEl.appendChild(el("div", "wd-empty", labels().empty || ""));
            return;
        }

        browserEl.appendChild(itemsSection(cat));

        /* Variants and colour stay pinned below the scrolling item grid - they
         * are the point of the screen and must not need scrolling to reach. */
        const pinned = el("div", "wd-section-fixed");
        if ((cat.model || 0) > 0 && (cat.maxVariants || 0) > 1) {
            pinned.appendChild(variantsSection(cat));
        }
        if (cat.tintable && (cat.model || 0) > 0) {
            pinned.appendChild(tintSection(cat));
        }
        if (pinned.childElementCount > 0) browserEl.appendChild(pinned);

        const grid = browserEl.querySelector(".wd-section-items .wd-grid");
        if (grid) {
            grid.scrollTop = keptScroll;
            grid.addEventListener("scroll", () => { gridScroll = grid.scrollTop; });
        }
    }

    function section(title, note) {
        const wrap = el("div", "wd-section");
        const head = el("div", "wd-section-head");
        head.appendChild(el("div", "wd-section-title", title || ""));
        if (note) head.appendChild(el("div", "wd-section-note", note));
        wrap.appendChild(head);
        return wrap;
    }

    function chip(label, active, onClick, className) {
        const btn = el("button", "wd-chip" + (className ? " " + className : "") + (active ? " active" : ""), label);
        btn.type = "button";
        btn.addEventListener("click", onClick);
        return btn;
    }

    function itemsSection(cat) {
        const pages = Math.max(1, Math.ceil(cat.maxModels / PAGE_SIZE));
        page = Math.min(Math.max(0, page), pages - 1);

        const wrap = section(labels().items || "Items", `${cat.model || 0}/${cat.maxModels}`);
        wrap.classList.add("wd-section-items");
        const grid = el("div", "wd-grid");

        /* "None" only belongs on the first page - it is index 0, not an item. */
        if (page === 0) {
            grid.appendChild(chip(labels().none || "None", (cat.model || 0) === 0,
                () => setItem(cat.id, 0), "wd-chip-none"));
        }

        const from = page * PAGE_SIZE + 1;
        const to = Math.min(cat.maxModels, (page + 1) * PAGE_SIZE);
        for (let i = from; i <= to; i++) {
            grid.appendChild(chip(String(i), cat.model === i, () => setItem(cat.id, i)));
        }
        wrap.appendChild(grid);

        if (pages > 1) wrap.appendChild(pager(pages));
        return wrap;
    }

    function pager(pages) {
        const bar = el("div", "wd-pager");

        const prev = el("button", "wd-pager-btn", "‹");
        prev.type = "button";
        prev.disabled = page <= 0;
        prev.addEventListener("click", () => { page -= 1; gridScroll = 0; renderBrowser(); });

        const next = el("button", "wd-pager-btn", "›");
        next.type = "button";
        next.disabled = page >= pages - 1;
        next.addEventListener("click", () => { page += 1; gridScroll = 0; renderBrowser(); });

        bar.appendChild(prev);
        bar.appendChild(el("div", "wd-pager-count", `${page + 1} / ${pages}`));
        bar.appendChild(next);
        return bar;
    }

    function variantsSection(cat) {
        const wrap = section(labels().variants || "Variants", `${cat.variant}/${cat.maxVariants}`);
        const grid = el("div", "wd-grid");
        for (let i = 1; i <= cat.maxVariants; i++) {
            grid.appendChild(chip(String(i), cat.variant === i, () => setVariant(cat.id, i)));
        }
        wrap.appendChild(grid);
        return wrap;
    }

    /* ---- tints --------------------------------------------------------- */

    function currentTint(cat) {
        const off = tintOff();
        return {
            palette: cat.palette || 0,
            t0: cat.tint0 == null ? off : cat.tint0,
            t1: cat.tint1 == null ? off : cat.tint1,
            t2: cat.tint2 == null ? off : cat.tint2
        };
    }

    /* The engine resolves the real colour from the palette, so these are
     * navigation colours only - distinct enough to tell steps apart. */
    function channelColour(channel, value) {
        const hue = Math.round((value / 254) * 360);
        const tone = [[45, 42], [34, 35], [28, 29]][channel] || [40, 38];
        return `hsl(${hue}, ${tone[0]}%, ${tone[1]}%)`;
    }

    function tintSection(cat) {
        const tint = currentTint(cat);
        const wrap = section(labels().tint || "Colour");

        /* Presets first: these carry a real hex, so they are the honest swatches. */
        const presets = el("div", "wd-grid");
        for (const preset of (payload.presets || [])) {
            const active = tint.palette === (preset.palette || 0)
                && tint.t0 === preset.t0 && tint.t1 === preset.t1 && tint.t2 === preset.t2;
            const btn = el("button", "wd-chip wd-swatch" + (active ? " active" : ""));
            btn.type = "button";
            btn.title = preset.name || "";
            const colour = el("div", "wd-swatch-colour");
            colour.style.background = preset.hex || "#000";
            btn.appendChild(colour);
            btn.addEventListener("click", () => setTint(cat.id, {
                palette: preset.palette || 0, t0: preset.t0, t1: preset.t1, t2: preset.t2
            }));
            presets.appendChild(btn);
        }
        wrap.appendChild(presets);

        wrap.appendChild(channelStrip(cat, 0, labels().primary || "Primary", tint));

        /* Secondary, tertiary and the palette index are for fine-tuning; most
         * players only ever touch a preset or the primary channel. */
        const toggle = el("button", "wd-advanced-toggle",
            (advancedOpen ? "\u2212 " : "+ ") + (labels().advanced || "Advanced"));
        toggle.type = "button";
        toggle.addEventListener("click", () => { advancedOpen = !advancedOpen; renderBrowser(); });
        wrap.appendChild(toggle);

        if (advancedOpen) {
            wrap.appendChild(channelStrip(cat, 1, labels().secondary || "Secondary", tint));
            wrap.appendChild(channelStrip(cat, 2, labels().tertiary || "Tertiary", tint));
            wrap.appendChild(paletteRow(cat, tint));
        }
        return wrap;
    }

    function channelStrip(cat, channel, title, tint) {
        const key = "t" + channel;
        const value = tint[key];
        const wrap = section(title, value === tintOff() ? (labels().none || "None") : String(value));
        const strip = el("div", "wd-strip");

        strip.appendChild(chip("×", value === tintOff(),
            () => setTint(cat.id, Object.assign({}, tint, { [key]: tintOff() }))));

        for (let v = 0; v <= 254; v += STRIP_STEP) {
            const active = value !== tintOff() && Math.abs(value - v) < STRIP_STEP / 2;
            const btn = el("button", "wd-chip wd-swatch" + (active ? " active" : ""));
            btn.type = "button";
            btn.title = String(v);
            const colour = el("div", "wd-swatch-colour");
            colour.style.background = channelColour(channel, v);
            btn.appendChild(colour);
            btn.addEventListener("click", () => setTint(cat.id, Object.assign({}, tint, { [key]: v })));
            strip.appendChild(btn);
        }

        wrap.appendChild(strip);
        return wrap;
    }

    function paletteRow(cat, tint) {
        const wrap = section(labels().palette || "Palette", String(tint.palette));
        const bar = el("div", "wd-pager");

        const down = el("button", "wd-pager-btn", "‹");
        down.type = "button";
        down.disabled = tint.palette <= 0;
        down.addEventListener("click", () => setTint(cat.id, Object.assign({}, tint, { palette: tint.palette - 1 })));

        const up = el("button", "wd-pager-btn", "›");
        up.type = "button";
        up.addEventListener("click", () => setTint(cat.id, Object.assign({}, tint, { palette: tint.palette + 1 })));

        bar.appendChild(down);
        bar.appendChild(el("div", "wd-pager-count", String(tint.palette)));
        bar.appendChild(up);
        wrap.appendChild(bar);
        return wrap;
    }

    /* ---- outbound ------------------------------------------------------ */

    function setItem(category, value) { post("wardrobeItem", { category, value }); }
    function setVariant(category, value) { post("wardrobeVariant", { category, value }); }
    function setTint(category, tint) {
        post("wardrobeTint", { category, palette: tint.palette, t0: tint.t0, t1: tint.t1, t2: tint.t2 });
    }

    /* ---- bar ----------------------------------------------------------- */

    function renderBar() {
        if (!payload) return;
        const l = labels();
        moneyLabel.textContent = l.money || "Cash";
        totalLabel.textContent = l.total || "Total";
        removeBtn.textContent = l.removeAll || "Remove all";
        saveBtn.textContent = l.save || "Save";
        exitBtn.textContent = l.exit || "Leave";
        jumpLabel.textContent = l.search || "Go to #";
        titleEl.textContent = payload.title || "";
        subtitleEl.textContent = payload.subtitle || "";
        saveBtn.classList.toggle("hidden", payload.purchasable === false);
        renderFigures();
    }

    function renderFigures() {
        const price = Number(payload.price) || 0;
        const cash = Number(payload.money) || 0;
        moneyEl.textContent = money(cash);
        priceEl.textContent = money(price);
        priceEl.classList.toggle("over", price > cash);
        priceEl.classList.toggle("spend", price > 0 && price <= cash);
    }

    /* ---- messages ------------------------------------------------------ */

    function open(msg) {
        payload = msg;
        const tabs = payload.tabs || [];
        if (!findTab(activeTabId)) activeTabId = tabs.length ? tabs[0].id : null;
        if (!findCategory(activeCatId)) {
            const tab = findTab(activeTabId);
            const first = tab && (tab.categories || [])[0];
            activeCatId = first ? first.id : null;
        }
        page = pageOf(activeCategory());

        renderBar();
        renderTabs();
        renderCategories();
        renderBrowser();
        root.classList.remove("hidden");
    }

    function update(msg) {
        if (!payload) return;

        if (msg.price != null) payload.price = msg.price;
        if (msg.money != null) payload.money = msg.money;
        renderFigures();

        let activeChanged = false;
        for (const patch of msg.categories || []) {
            const cat = findCategory(patch.id);
            if (!cat) continue;
            Object.assign(cat, patch);
            refreshCategoryRow(cat);
            if (cat.id === activeCatId) activeChanged = true;
        }

        if (activeChanged) {
            renderTabs();
            renderBrowser();
        }
    }

    function close() {
        payload = null;
        activeTabId = null;
        activeCatId = null;
        page = 0;
        root.classList.add("hidden");
    }

    removeBtn.addEventListener("click", () => post("wardrobeAction", { id: "remove_all" }));
    saveBtn.addEventListener("click", () => post("wardrobeAction", { id: "save" }));
    exitBtn.addEventListener("click", () => post("wardrobeAction", { id: "exit" }));

    jumpInput.addEventListener("change", () => {
        const cat = activeCategory();
        if (!cat) return;
        const value = parseInt(jumpInput.value, 10);
        if (Number.isNaN(value)) return;
        setItem(cat.id, Math.max(0, Math.min(value, cat.maxModels)));
    });

    document.addEventListener("keydown", (ev) => {
        if (root.classList.contains("hidden")) return;
        if (ev.key === "Escape") {
            ev.preventDefault();
            post("wardrobeClose", {});
        }
    });

    window.addEventListener("message", (event) => {
        const msg = event.data;
        if (!msg || !msg.action) return;
        switch (msg.action) {
            case "openWardrobe": open(msg); break;
            case "updateWardrobe": update(msg); break;
            case "closeWardrobe":
            case "closeAll": close(); break;
        }
    });
})();
