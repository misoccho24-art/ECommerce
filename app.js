// Grounded — zero-dependency storefront. Every view renders synchronously from in-memory data,
// so navigation never waits on the network; only photos stream in (hero is preloaded in <head>).
(() => {
  const { cats, products, byId, media } = window.CATALOG;
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const app = $("#app");
  const FREE_SHIP = 100, SHIP = 8, EXPRESS = 15, TAX = 0.08;
  const PROMOS = { FIRSTSTEP: 0.15 };
  const SIZES = [6, 7, 8, 8.5, 9, 9.5, 10, 10.5, 11, 12];

  const money = n => "$" + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const soldOut = (p, s) => (p.idx * 7 + SIZES.indexOf(+s) * 3) % 11 === 0;

  // Unsplash CDN resizes on the fly: request exactly the pixels each slot needs (1x + 2x).
  const src = (id, w, h, q = 70) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=${q}`;
  const img = (id, w, h, alt = "", eager = false) =>
    `<img src="${src(id, w, h)}" srcset="${src(id, w, h)} 1x, ${src(id, w * 2, h * 2, 60)} 2x" width="${w}" height="${h}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;

  // ---------- icons ----------
  const ICONS = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    truck: '<path d="M2 6h11v10H2zM13 9h4l4 4v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    ret: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19 13 11"/>',
    ruler: '<path d="M3 16 16 3l5 5L8 21z"/><path d="m7 12 2 2M10 9l2 2M13 6l2 2"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    home: '<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  };
  const ic = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

  // ---------- storage (never throws) ----------
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem("gr:" + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("gr:" + k, JSON.stringify(v)); } catch {} },
  };

  // ---------- state ----------
  let cart = store.get("cart", {});  // { "id|size": qty }
  let saved = new Set(store.get("saved", []));
  let promo = store.get("promo", null);
  for (const k in cart) if (!byId[k.split("|")[0]]) delete cart[k];
  const lines = () => Object.entries(cart).map(([k, q]) => { const [id, size] = k.split("|"); return { k, p: byId[id], size, q }; });
  const count = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const totals = (express = false) => {
    const sub = lines().reduce((s, l) => s + l.p.price * l.q, 0);
    const disc = promo && PROMOS[promo] ? sub * PROMOS[promo] : 0;
    const ship = sub === 0 ? 0 : express ? EXPRESS : sub - disc >= FREE_SHIP ? 0 : SHIP;
    const tax = (sub - disc) * TAX;
    return { sub, disc, ship, tax, total: sub - disc + ship + tax };
  };

  function setQty(k, q) {
    if (q <= 0) delete cart[k]; else cart[k] = Math.min(q, 10);
    store.set("cart", cart);
    renderBag();
  }
  function add(id, size, q = 1) {
    const k = `${id}|${size}`;
    setQty(k, (cart[k] || 0) + q);
    bump("#cartCount");
    toast(`${byId[id].name}, US ${size}${q > 1 ? ` × ${q}` : ""}, added to cart`);
  }
  function toggleSave(id) {
    saved.has(id) ? saved.delete(id) : saved.add(id);
    store.set("saved", [...saved]);
    $$(`[data-save="${id}"]`).forEach(b => b.setAttribute("aria-pressed", saved.has(id)));
    $("#savedCount").textContent = saved.size || "";
    if (saved.has(id)) { bump("#savedCount"); toast("Saved for later"); }
  }
  const bump = sel => { const b = $(sel); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); };

  let tt;
  function toast(msg) {
    const t = $("#toast");
    t.innerHTML = ic("check") + esc(msg);
    t.classList.add("show");
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 1600);
  }

  // ---------- templates ----------
  const priceTag = p => p.was
    ? `<div class="price on">${money(p.price)}<s>${money(p.was)}</s></div>`
    : `<div class="price">${money(p.price)}</div>`;

  const card = p => `
    <article class="pc">
      <div class="media">
        <a href="#/p/${p.id}" data-qv="${p.id}" aria-label="Quick view: ${esc(p.name)}">${img(p.img, 400, 500, p.name)}</a>
        ${p.was ? `<span class="pill sale">-${Math.round(100 - p.price / p.was * 100)}%</span>` : p.tag ? `<span class="pill">${p.tag}</span>` : ""}
        <button class="heart" data-save="${p.id}" aria-pressed="${saved.has(p.id)}" aria-label="Save ${esc(p.name)}">${ic("heart")}</button>
        <div class="quick">
          <button class="qa" data-quick>${ic("plus")}Quick add</button>
          <div class="sizes"><span class="qlabel">Select US size</span>${SIZES.slice(1, 9).map(s =>
            `<button data-qadd="${p.id}" data-size="${s}"${soldOut(p, s) ? " disabled" : ""}>${s}</button>`).join("")}</div>
        </div>
      </div>
      <div class="info">
        <div>
          <h3><a href="#/p/${p.id}">${esc(p.name)}</a></h3>
          <div class="sub">${esc(p.color)}</div>
        </div>
        ${priceTag(p)}
      </div>
    </article>`;

  // ---------- home ----------
  let homeTab = "all";
  function viewHome() {
    const loved = products.slice().sort((a, b) => b.rating - a.rating || b.reviews - a.reviews).slice(0, 4);
    const trending = products.slice().sort((a, b) => b.reviews - a.reviews).slice(0, 9);
    app.innerHTML = `
    <div>
      <section class="hero">
        <img src="${src(media.hero, 1400, 820)}"
          srcset="${src(media.hero, 800, 1000)} 800w, ${src(media.hero, 1400, 820)} 1400w, ${src(media.hero, 2000, 1100)} 2000w"
          sizes="100vw" alt="Man in olive trousers and fresh sneakers sitting under palm trees" fetchpriority="high" decoding="async">
        <div class="wrap">
          <span class="eyebrow">Autumn / Winter 26</span>
          <h1>Made for the <em>long way</em> round.</h1>
          <p>Earth-toned sneakers in small runs: suede, canvas and leather that look better the more miles you put on them.</p>
          <div class="ctas">
            <a class="btn light" href="#/shop/new">Shop new arrivals ${ic("arrow", "arr")}</a>
            <a class="btn outline" href="#collections">Explore collections</a>
          </div>
          <div class="hero-foot">
            <div><strong>${products.length} styles</strong>in the current drop</div>
            <div><strong>4.7 / 5</strong>from 9,000+ reviews</div>
            <div><strong>48 hrs</strong>average delivery</div>
          </div>
        </div>
      </section>

      <section class="values"><div class="wrap">
        <div>${ic("truck")}<span><b>Free shipping</b>On orders over $${FREE_SHIP}</span></div>
        <div>${ic("ret")}<span><b>30-day returns</b>Worn it? Still fine.</span></div>
        <div>${ic("shield")}<span><b>2-year warranty</b>On every sole we make</span></div>
        <div>${ic("leaf")}<span><b>Lower impact</b>Recycled rubber outsoles</span></div>
      </div></section>

      <section class="sec" id="collections"><div class="wrap">
        <div class="sec-h">
          <div><h2>Shop by <em>mood</em></h2><p>Three edits for three kinds of days. Start with the one that sounds like yours.</p></div>
          <a class="more" href="#/shop/all">All sneakers ${ic("arrow")}</a>
        </div>
        <div class="collections">
          <a class="col" href="#/shop/running">${img(media.street, 760, 640, "Close-up of sneakers on an asphalt road")}
            <small>The street edit</small><h3>Built for pavement</h3><span class="go">Shop running ${ic("arrow")}</span></a>
          <a class="col" href="#/shop/canvas">${img(media.canvas, 620, 320, "Blue canvas sneakers on a wooden floor")}
            <small>Canvas classics</small><h3>Easy, everyday</h3><span class="go">Shop canvas ${ic("arrow")}</span></a>
          <a class="col" href="#/shop/leather">${img(media.leather, 620, 320, "Leather shoes on warm wooden floorboards")}
            <small>Weekend leather</small><h3>Suede &amp; full-grain</h3><span class="go">Shop leather ${ic("arrow")}</span></a>
        </div>
      </div></section>

      <section class="sec"><div class="wrap">
        <div class="sec-h">
          <div><h2>Fresh off <em>the box</em></h2><p>New this month, restocked weekly. Hover a pair for quick add.</p></div>
          <div class="tabs" role="group" aria-label="Filter new arrivals">
            ${[["all", "All"], ...Object.entries(cats).map(([k, v]) => [k, v.name])].map(([k, n]) =>
              `<button class="tab" data-htab="${k}" aria-pressed="${homeTab === k}">${n}</button>`).join("")}
          </div>
        </div>
        <div class="grid" id="fresh"></div>
      </div></section>

      <section class="sec"><div class="wrap">
        <div class="story">
          <div class="txt">
            ${firstStepUsed() ? `
            <span class="eyebrow">Back again</span>
            <h2>Ready for your <em>next</em> pair?</h2>
            <p>Every order ships in a recycled box with free shipping over $${FREE_SHIP} and free 30-day returns, so finding your size never costs a thing.</p>` : `
            <span class="eyebrow">The first pair</span>
            <h2>Your first pair is <em>on us</em>, almost.</h2>
            <p>New here? Take 15% off your first order. Every pair ships in a recycled box with free returns, so finding your size costs nothing.</p>
            <span class="code">Use code <b>FIRSTSTEP</b> at checkout</span>`}
            <a class="btn light" href="#/shop/all">Find your pair ${ic("arrow", "arr")}</a>
          </div>
          <div class="pic">${img(media.story, 700, 620, "Sneakers on a road with white painted lines")}</div>
        </div>
      </div></section>

      <section class="sec"><div class="wrap">
        <div class="sec-h">
          <div><h2>Most <em>loved</em></h2><p>The highest-rated pairs, chosen by the people who wear them.</p></div>
          <a class="more" href="#/shop/all">See all ${ic("arrow")}</a>
        </div>
        <div class="grid">${loved.map(card).join("")}</div>
      </div></section>

      <section class="sec"><div class="wrap">
        <div class="sec-h">
          <div><h2>Trending <em>now</em></h2><p>What everyone's adding to their cart this week.</p></div>
          <div class="arrows"><button data-rail="-1" aria-label="Scroll left">${ic("left")}</button><button data-rail="1" aria-label="Scroll right">${ic("arrow")}</button></div>
        </div>
        <div class="rail" id="rail">${trending.map(card).join("")}</div>
      </div></section>

      <section class="sec" id="faq"><div class="wrap faq">
        <div class="faq-h">
          <h2>Questions, <em>answered</em></h2>
          <p>The things people ask us most before ordering. Can't find yours?</p>
          <a class="more" href="#/help/contact">Talk to our team ${ic("arrow")}</a>
        </div>
        <div class="faq-list">
          ${[
            ["How do your sneakers fit?", `True to size for most people. If you're between sizes, go half a size up. Our <a href="#/help/size">size guide</a> has a full US, UK and EU chart.`],
            ["How long does delivery take?", `Orders ship within 24 hours. Standard delivery takes 2–4 business days and is free over $${FREE_SHIP}; Express arrives the next business day for ${money(EXPRESS)}.`],
            ["Can I return shoes I've worn?", `Yes. You have 30 days from delivery to return any pair, worn outside or not, and returns are free. <a href="#/help/returns">See how returns work</a>.`],
            ["Do you offer exchanges?", "Yes, and they're free. Start a return, tell us the size you want, and we'll ship the new pair as soon as yours is on its way back."],
            ["What are the shoes made of?", "Leather and suede uppers from certified tanneries, heavyweight cotton canvas, and outsoles with recycled rubber. Each product page lists the details."],
            ["Is there a discount for my first order?", "Use code <b>FIRSTSTEP</b> at checkout for 15% off your first order."],
          ].map(([q, a], i) => `<details name="faq"${i === 0 ? " open" : ""}><summary>${q} ${ic("plus")}</summary><p>${a}</p></details>`).join("")}
        </div>
      </div></section>

      <section class="cta"><div class="wrap">
        <h2>Get first dibs on <em>every drop.</em></h2>
        <div>
          <p>Small runs sell out. Join the list for early access to new colourways and restocks, about twice a month.</p>
          <form id="news"><input type="email" required placeholder="Your email address" aria-label="Email address" autocomplete="email"><button class="btn light" type="submit">Join</button></form>
          <p class="fine">No spam. Unsubscribe in one click.</p>
        </div>
      </div></section>
    </div>`;
    renderFresh();
  }
  function renderFresh() {
    const el = $("#fresh"); if (!el) return;
    const list = products.filter(p => homeTab === "all" || p.cat === homeTab);
    el.innerHTML = list.sort((a, b) => (b.tag === "New") - (a.tag === "New")).slice(0, 8).map(card).join("");
  }

  // ---------- shop ----------
  const shopState = { sort: "featured", q: "" };
  const FILTERS = {
    all: { t: "All sneakers", tab: "All", d: "Every pair we make, in every colourway.", f: () => true },
    new: { t: "New in", tab: "New in", d: "Fresh from the latest drop.", f: p => p.tag === "New" },
    sale: { t: "Sale", tab: "Sale", d: "Last pairs at lower prices. Once they're gone, they're gone.", f: p => p.was },
    saved: { t: "Saved", tab: "Saved", d: "Pairs you've hearted, stored on this device.", f: p => saved.has(p.id) },
    ...Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, { t: v.name, tab: v.name, d: `Our ${v.name.toLowerCase()} range, from first drop to latest.`, f: p => p.cat === k }])),
  };
  const curFilter = () => FILTERS[route.cur?.[1]] || FILTERS.all;
  function viewShop(key) {
    const F = FILTERS[key] || FILTERS.all;
    $$(".nav a").forEach(a => a.getAttribute("href") === `#/shop/${key}` && a.setAttribute("aria-current", "page"));
    app.innerHTML = `
      <div class="wrap">
        <div class="page-h">
          <nav class="crumbs"><a href="#/">Home</a><span>/</span><span>${F.t}</span></nav>
          <h1 id="shopTitle"></h1>
          <p id="shopSub"></p>
        </div>
        <div class="filters">
          <div class="tabs">${["all", "new", ...Object.keys(cats), "sale"].map(k =>
            `<a class="tab" href="#/shop/${k}" aria-pressed="${k === key}" style="display:inline-flex;align-items:center">${FILTERS[k].tab}</a>`).join("")}</div>
          <div style="display:flex;gap:14px;align-items:center">
            <span class="results-n" id="resN"></span>
            <select id="sort" aria-label="Sort">${[["featured", "Featured"], ["new", "Newest"], ["rating", "Top rated"], ["low", "Price: Low to High"], ["high", "Price: High to Low"]]
              .map(([v, n]) => `<option value="${v}"${shopState.sort === v ? " selected" : ""}>${n}</option>`).join("")}</select>
          </div>
        </div>
        <div id="results"></div>
      </div>`;
    renderResults();
  }
  function renderResults() {
    const F = curFilter();
    const q = shopState.q.trim().toLowerCase();
    $("#shopTitle").textContent = q ? `Results for “${shopState.q.trim()}”` : F.t;
    $("#shopSub").textContent = q ? `Searching all ${products.length} styles.` : F.d;
    const list = products.filter(p => q
      ? `${p.name} ${p.color} ${cats[p.cat].name} ${p.desc}`.toLowerCase().includes(q)
      : F.f(p));
    const s = shopState.sort;
    if (s === "low") list.sort((a, b) => a.price - b.price);
    if (s === "high") list.sort((a, b) => b.price - a.price);
    if (s === "rating") list.sort((a, b) => b.rating - a.rating);
    if (s === "new") list.sort((a, b) => (b.tag === "New") - (a.tag === "New"));
    $("#resN").textContent = `${list.length} ${list.length === 1 ? "style" : "styles"}`;
    $("#results").innerHTML = list.length
      ? `<div class="grid">${list.map(card).join("")}</div>`
      : `<div class="empty"><h2>Nothing here yet</h2>${q ? "No pairs match that search. Try a colour, like “sand” or “white”." : "Heart a pair and it'll show up here."}<br><a class="btn dark" href="#/shop/all">Browse all sneakers</a></div>`;
  }

  // ---------- buy box (size + quantity + actions), shared by product page and quick view ----------
  // Each box keeps its own size/qty in data attributes, so a quick view opened over a product page
  // never fights with that page's own selector.
  const MAX_QTY = 10;
  const buyBox = p => `
    <div class="buybox" data-buybox="${p.id}" data-qty="1">
      <div class="opt-h">Select size (US)<a href="#/help/size" class="sg">Size guide</a></div>
      <div class="sizegrid">${SIZES.map(s => soldOut(p, s)
        ? `<button disabled aria-label="US ${s}, sold out">${s}</button>`
        : `<button data-pick="${s}" aria-pressed="false">${s}</button>`).join("")}</div>
      <div class="err-msg" role="alert"></div>
      <div class="opt-h">Quantity<span>In stock &middot; ships in 24h</span></div>
      <div class="stepper qty" role="group" aria-label="Quantity">
        <button data-qty="-1" aria-label="Decrease quantity" disabled>${ic("minus")}</button><span data-qtyval aria-live="polite">1</span><button data-qty="1" aria-label="Increase quantity">${ic("plus")}</button>
      </div>
      <div class="buyrow">
        <button class="btn dark" data-buy>${ic("bag")}<span>Add to cart &middot; ${money(p.price)}</span></button>
        <button class="btn olive" data-buynow>Buy now</button>
        <button class="heart" data-save="${p.id}" aria-pressed="${saved.has(p.id)}" aria-label="Save ${esc(p.name)}">${ic("heart")}</button>
      </div>
    </div>`;
  // Returns { p, size, qty } or null after flagging the missing size.
  function boxChoice(box) {
    const p = byId[box.dataset.buybox], size = box.dataset.size, qty = +box.dataset.qty;
    if (!size) {
      box.querySelector(".sizegrid").classList.add("err");
      box.querySelector(".err-msg").textContent = "Please choose a size first.";
      return null;
    }
    return { p, size, qty };
  }

  // ---------- quick view ----------
  function openQuick(id) {
    const p = byId[id];
    if (!p) return;
    $("#qvBox").innerHTML = `
      <button class="tbtn qv-x" data-qvclose aria-label="Close">${ic("x")}</button>
      <div class="qv-grid">
        <div class="qv-shot">${img(p.img, 560, 640, p.name, true)}
          ${p.was ? `<span class="pill sale">-${Math.round(100 - p.price / p.was * 100)}%</span>` : p.tag ? `<span class="pill">${p.tag}</span>` : ""}</div>
        <div class="qv-info">
          <span class="qv-cat">${cats[p.cat].name} &middot; ${esc(p.color)}</span>
          <h2 id="qvTitle">${esc(p.name)}</h2>
          <span class="rating">${ic("star").repeat(5)} ${p.rating} &middot; ${p.reviews.toLocaleString()} reviews</span>
          <div class="pr">${money(p.price)}${p.was ? `<s>${money(p.was)}</s><span class="off">SAVE ${money(p.was - p.price)}</span>` : ""}</div>
          <p class="lede">${esc(p.desc)}</p>
          <ul class="qv-specs">
            <li><span>Colourway</span>${esc(p.color)}</li>
            <li><span>Outsole</span>Recycled rubber</li>
            <li><span>Insole</span>Removable, cushioned</li>
            <li><span>Style code</span>GR-${String(p.idx + 101).padStart(4, "0")}</li>
          </ul>
          ${buyBox(p)}
          <a class="more" href="#/p/${p.id}">View full details ${ic("arrow")}</a>
        </div>
      </div>`;
    $("#qv").classList.add("open"); $("#qv").setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    $("#qvBox").scrollTop = 0;
    $("#qvBox .qv-x").focus({ preventScroll: true });
  }
  function closeQuick() {
    if (!$("#qv").classList.contains("open")) return false;
    $("#qv").classList.remove("open"); $("#qv").setAttribute("aria-hidden", "true");
    $("#qvBox").innerHTML = "";
    document.body.style.overflow = "";
    return true;
  }

  // ---------- product ----------
  function viewProduct(id) {
    const p = byId[id];
    if (!p) return viewMissing();
    document.title = `${p.name} · Grounded`;
    const related = products.filter(x => x.cat === p.cat && x.id !== p.id).concat(products.filter(x => x.cat !== p.cat)).slice(0, 4);
    app.innerHTML = `
      <div class="wrap">
        <div class="pdp">
          <div class="shot">${img(p.img, 720, 720, p.name, true)}</div>
          <div>
            <nav class="crumbs"><a href="#/">Home</a><span>/</span><a href="#/shop/${p.cat}">${cats[p.cat].name}</a><span>/</span><span>${esc(p.name)}</span></nav>
            <span class="rating">${ic("star").repeat(5)} ${p.rating} &middot; ${p.reviews.toLocaleString()} reviews</span>
            <h1>${esc(p.name)}</h1>
            <div style="color:var(--muted)">${cats[p.cat].name} &middot; ${esc(p.color)}</div>
            <div class="pr">${money(p.price)}${p.was ? `<s>${money(p.was)}</s><span class="off">SAVE ${money(p.was - p.price)}</span>` : ""}</div>
            <p class="lede">${esc(p.desc)}</p>

            ${buyBox(p)}

            <div class="assure">
              <div>${ic("truck")}Free shipping over $${FREE_SHIP}</div>
              <div>${ic("ret")}Free 30-day returns</div>
            </div>

            <details open><summary>Details ${ic("plus")}</summary>
              <ul><li>Colourway: ${esc(p.color)}</li><li>Recycled rubber outsole</li><li>Removable cushioned insole</li><li>Style code GR-${String(p.idx + 101).padStart(4, "0")}</li></ul></details>
            <details><summary>Shipping &amp; returns ${ic("plus")}</summary>
              <p>Orders ship within 24 hours. Standard delivery takes 2–4 business days and is free over $${FREE_SHIP}. Return unworn or lightly worn pairs within 30 days for a full refund.</p></details>
            <details><summary>Care ${ic("plus")}</summary>
              <p>Brush off dirt once dry. Spot-clean with a damp cloth and mild soap. Let them air-dry away from direct heat.</p></details>
          </div>
        </div>
        <section class="sec">
          <div class="sec-h"><div><h2>Pairs well <em>with</em></h2></div><a class="more" href="#/shop/${p.cat}">More ${cats[p.cat].name.toLowerCase()} ${ic("arrow")}</a></div>
          <div class="grid">${related.map(card).join("")}</div>
        </section>
      </div>`;
  }

  // ---------- accounts (demo: stored in this browser only) ----------
  // There's no server, so accounts live in localStorage. Passwords are salted and SHA-256 hashed
  // before saving, never stored as typed. Fine for a demo; a real store needs server-side auth.
  const users = () => store.get("users", {});
  const me = () => { const e = store.get("session", null); return e ? users()[e] || null : null; };
  const saveUser = u => store.set("users", { ...users(), [u.email]: u });
  const firstStepUsed = () => !!me()?.firstStepOrder;
  const myOrders = () => { const u = me(); return u ? Object.values(store.get("orders", {})).filter(o => o.user === u.email).sort((a, b) => b.created - a.created) : []; };
  async function hashPw(pw, salt) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pw}`));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  function syncAccountUI() {
    const u = me();
    $("#annCode").hidden = firstStepUsed();
    const b = $("#acctBtn");
    b.classList.toggle("in", !!u);
    b.setAttribute("aria-label", u ? `Your account (${u.name})` : "Log in");
  }

  let authState = { mode: "login", next: "#/account", heading: "Welcome back", sub: "Log in to see your orders and check out faster." };
  const authPanel = () => {
    const { mode, next, heading, sub } = authState, signup = mode === "signup";
    return `
      <div class="auth panel">
        <h1>${heading}</h1>
        <p class="auth-sub">${sub}</p>
        <div class="gw-tabs auth-tabs" role="tablist">
          <button type="button" role="tab" data-authmode="login" aria-selected="${!signup}">Log in</button>
          <button type="button" role="tab" data-authmode="signup" aria-selected="${signup}">Create account</button>
        </div>
        <div class="auth-warn" role="note">
          ${ic("shield")}
          <p><b>Demo store: don't use real details.</b> Make up a name and email, and never reuse a password you use anywhere else. Accounts here are for testing only and are saved in this browser.</p>
        </div>
        <form id="authForm" data-mode="${mode}" data-next="${next}" novalidate>
          ${signup ? `<label>Full name<input name="name" autocomplete="name" required></label>` : ""}
          <label>Email<input name="email" type="email" autocomplete="email" required></label>
          <label><span>Password${signup ? " <i>(at least 8 characters)</i>" : ""}</span><input name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" required></label>
          <div class="err-msg" role="alert"></div>
          <button class="btn dark block" type="submit">${signup ? "Create account" : "Log in"} ${ic("arrow", "arr")}</button>
        </form>
        <p class="auth-note">Example: test@example.com with any made-up password of 8+ characters.</p>
      </div>`;
  };
  function renderAuth() { app.innerHTML = `<div class="wrap">${authPanel()}</div>`; app.querySelector("input")?.focus(); }

  async function handleAuth(f) {
    const signup = f.dataset.mode === "signup", err = f.querySelector(".err-msg");
    const email = f.email.value.trim().toLowerCase(), pw = f.password.value, name = f.elements.name?.value.trim();
    const fail = (m, field) => { err.textContent = m; if (field) { field.classList.add("bad"); field.focus(); } };
    if (signup && !name) return fail("Enter your name.", f.elements.name);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.", f.email);
    if (pw.length < 8) return fail("Password must be at least 8 characters.", f.password);
    if (!window.crypto?.subtle) return fail("Sign-in needs a secure page. Open the site over https or localhost.");
    const all = users();
    if (signup) {
      if (all[email]) return fail("An account with this email already exists. Log in instead.", f.email);
      const salt = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
      saveUser({ email, name, salt, hash: await hashPw(pw, salt), created: Date.now(), firstStepOrder: null });
    } else {
      const u = all[email];
      // One message for both cases, so the form doesn't reveal which emails have accounts.
      if (!u || u.hash !== await hashPw(pw, u.salt)) return fail("Email or password is incorrect.", f.password);
    }
    store.set("session", email);
    authState.mode = "login"; // next time the form opens, default to logging in
    syncAccountUI();
    toast(`${signup ? "Welcome to Grounded" : "Welcome back"}, ${me().name.split(" ")[0]}`);
    const next = f.dataset.next || "#/account";
    if (location.hash === next) route(); else location.hash = next;
  }

  function viewAccount() {
    const u = me();
    document.title = "Your account · Grounded";
    if (!u) {
      authState = { mode: authState.mode, next: "#/account", heading: "Welcome back", sub: "Log in to see your orders and check out faster." };
      return renderAuth();
    }
    const orders = myOrders();
    const delivered = orders.filter(o => trackStage(o) === STAGES.length - 1).length;
    const spent = orders.reduce((s, o) => s + o.total, 0);
    app.innerHTML = `
      <div class="wrap">
        <div class="page-h acct-head">
          <div>
            <nav class="crumbs"><a href="#/">Home</a><span>/</span><span>Account</span></nav>
            <h1>Hi, <em class="hl">${esc(u.name.split(" ")[0])}</em></h1>
            <p>${esc(u.email)} &middot; member since ${new Date(u.created).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
          </div>
          <button class="btn outline" data-act="logout">Log out</button>
        </div>

        <div class="stats">
          <div class="stat"><span>Orders placed</span><b>${orders.length}</b></div>
          <div class="stat"><span>Delivered</span><b>${delivered}</b></div>
          <div class="stat"><span>On the way</span><b>${orders.length - delivered}</b></div>
          <div class="stat"><span>Total spent</span><b>${money(spent)}</b><small>${taka(spent)}</small></div>
        </div>

        <div class="fs-card ${u.firstStepOrder ? "used" : ""}">
          ${ic(u.firstStepOrder ? "check" : "bag")}
          <div>${u.firstStepOrder
            ? `<b>First-order code used</b>You saved 15% with FIRSTSTEP on order <a href="#/track/${u.firstStepOrder}">#${u.firstStepOrder}</a>. It can only be used once per account.`
            : `<b>FIRSTSTEP is ready</b>Take 15% off your first order. Enter it at checkout; it works once per account.`}</div>
        </div>

        <section class="sec" style="padding-top:56px">
          <div class="sec-h"><div><h2>Your <em>orders</em></h2></div></div>
          ${orders.length ? `<div class="orders">${orders.map(o => {
            const st = trackStage(o), n = (o.items || []).reduce((s, i) => s + i.q, 0);
            return `
              <a class="orow" href="#/orders/${o.id}">
                <div class="othumbs">${(o.items || []).slice(0, 3).map(i => byId[i.id] ? `<span>${img(byId[i.id].img, 96, 96, byId[i.id].name)}</span>` : "").join("")}</div>
                <div class="omain"><b>#${o.id}</b><span>${fmtDay(o.created)} &middot; ${n} ${n === 1 ? "pair" : "pairs"}${o.promo ? ` &middot; ${o.promo}` : ""}</span></div>
                <span class="trk-badge${st === STAGES.length - 1 ? " done" : ""}">${STAGES[st][0]}</span>
                <span class="oamt">${money(o.total)}</span>
                ${ic("arrow")}
              </a>`; }).join("")}</div>`
            : `<div class="empty" style="padding:48px 16px"><h2>No orders yet</h2>Your orders and their delivery status will show up here.<br><a class="btn dark" href="#/shop/all">Shop sneakers</a></div>`}
        </section>
      </div>`;
  }

  // ---------- my orders: receipt (left) + details (right) ----------
  let ordersTab = "all";
  const isDelivered = o => trackStage(o) === STAGES.length - 1;
  // Older orders (placed before receipts were added) lack snapshots; fall back to catalog data.
  const itemOf = i => ({ ...i, name: i.name || byId[i.id]?.name || "Item", color: i.color || byId[i.id]?.color || "", price: i.price ?? byId[i.id]?.price ?? 0 });
  // A decorative barcode derived from the tracking number (same code always draws the same bars).
  const barcode = code => {
    let x = 0, bars = "";
    for (const ch of code + code) { const w = 1 + (ch.charCodeAt(0) % 3); bars += `<rect x="${x}" width="${w}" height="40"/>`; x += w + 1 + (ch.charCodeAt(0) % 2); }
    return `<svg class="barcode" viewBox="0 0 ${x} 40" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
  };

  function receipt(o) {
    const items = (o.items || []).map(itemOf);
    const b = o.breakdown, sub = b ? b.sub : items.reduce((s, i) => s + i.price * i.q, 0);
    const row = (l, v, cls = "") => `<div class="rc-row ${cls}"><span>${l}</span><span>${v}</span></div>`;
    return `
      <article class="receipt" aria-label="Receipt for order ${o.id}">
        <header class="rc-head">
          <span class="logo"><svg class="gr" viewBox="0 0 100 50" aria-hidden="true"><use href="#gr"/></svg>ounded<i>.</i></span>
          <small>Grounded Footwear &middot; Dhaka, Bangladesh</small>
          <b class="rc-title">Receipt</b>
        </header>
        <div class="rc-meta">
          ${row("Order", `#${o.id}`)}
          ${row("Date", fmtTime(o.created))}
          ${row("Customer", esc(`${o.first || ""} ${o.last || ""}`.trim()))}
          ${row("Payment", esc(o.paidWith || "Demo payment"))}
        </div>
        <div class="rc-items">
          ${items.map(i => `
            <div class="rc-item">
              <div><b>${esc(i.name)}</b><small>US ${i.size}${i.color ? ` &middot; ${esc(i.color)}` : ""}</small><small>${i.q} &times; ${money(i.price)}</small></div>
              <span>${money(i.price * i.q)}</span>
            </div>`).join("")}
        </div>
        <div class="rc-totals">
          ${row("Subtotal", money(sub))}
          ${b ? `${b.disc ? row(`Discount${o.promo ? ` (${esc(o.promo)})` : ""}`, `&minus;${money(b.disc)}`, "disc") : ""}
          ${row(`Shipping${o.express ? " (Express)" : ""}`, b.ship ? money(b.ship) : "Free")}
          ${row("Tax (8%)", money(b.tax))}` : `<p class="rc-note">Detailed breakdown isn't available for orders placed before receipts were added.</p>`}
          ${row("Total", money(o.total), "grand")}
          ${row("Paid in BDT", taka(o.total), "bdt")}
        </div>
        <footer class="rc-foot">
          ${barcode(o.tracking || o.id)}
          <small>${o.tracking || o.id}</small>
          <p>Thank you for shopping with us.<br>Free returns within 30 days of delivery.</p>
          <small class="rc-demo">Demo receipt &middot; no real payment was taken</small>
        </footer>
      </article>`;
  }

  function orderDetails(o) {
    const st = trackStage(o), done = isDelivered(o);
    const eta = o.created + (o.express ? 1 : 3) * 864e5;
    const items = (o.items || []).map(itemOf);
    return `
      <div class="od">
        <div class="od-top">
          <div><span class="od-label">Order</span><h2>#${o.id}</h2><span class="od-date">Placed ${fmtTime(o.created)}</span></div>
          <span class="trk-badge${done ? " done" : ""}">${STAGES[st][0]}</span>
        </div>
        <ol class="trk-steps od-steps" style="--p:${st / (STAGES.length - 1) * 100}%">${STAGES.map(([n, icon], i) => `
          <li class="${i < st ? "past" : i === st ? "now" : ""}"><i>${ic(icon)}</i><span>${n}</span></li>`).join("")}
        </ol>
        <p class="od-eta">${done ? `Delivered ${fmtTime(stageTime(o, STAGES.length - 1))}` : `Estimated delivery: <b>${fmtDay(eta)}</b>`} &middot; ${o.express ? "Express" : "Standard"} shipping</p>

        <div class="od-grid">
          <div><span class="od-label">Ship to</span><p>${esc(`${o.first || ""} ${o.last || ""}`.trim())}<br>${esc(o.address || "")}<br>${esc(o.city || "")} ${esc(o.zip || "")}</p></div>
          <div><span class="od-label">Contact</span><p>${esc(o.email || "")}</p></div>
          <div><span class="od-label">Tracking number</span><p>${o.tracking || "-"}</p></div>
          <div><span class="od-label">Payment</span><p>${esc(o.paidWith || "Demo payment")}<br>${money(o.total)} &middot; ${taka(o.total)}</p></div>
        </div>

        <span class="od-label">Items</span>
        <div class="od-items">${items.map(i => byId[i.id] ? `
          <a class="line" href="#/p/${i.id}"><div class="th">${img(byId[i.id].img, 128, 128, i.name)}</div>
            <div><h4>${esc(i.name)}</h4><div class="meta">US ${i.size} &middot; Qty ${i.q}</div></div><span class="amt">${money(i.price * i.q)}</span></a>` : "").join("")}
        </div>

        <div class="od-actions">
          <a class="btn olive" href="#/track/${o.id}">${ic("truck")}Track package</a>
          <button class="btn outline" data-act="print">Print receipt</button>
          <button class="btn outline" data-reorder="${o.id}">${ic("bag")}Buy again</button>
        </div>
      </div>`;
  }

  function viewOrders(id) {
    document.title = "My orders · Grounded";
    $$(".nav a").forEach(a => a.getAttribute("href") === "#/orders" && a.setAttribute("aria-current", "page"));
    if (!me()) {
      authState = { mode: authState.mode, next: location.hash || "#/orders", heading: "Log in to see your orders", sub: "Your receipts and delivery updates are saved to your account." };
      return renderAuth();
    }
    const all = myOrders();
    if (!all.length) {
      app.innerHTML = `<div class="wrap"><div class="page-h"><h1>My <em class="hl">orders</em></h1></div><div class="empty" style="padding-top:20px"><h2>No orders yet</h2>When you place an order, its receipt and delivery status will appear here.<br><a class="btn dark" href="#/shop/all">Shop sneakers</a></div></div>`;
      return;
    }
    const current = all.filter(o => !isDelivered(o)), past = all.filter(isDelivered);
    const list = ordersTab === "current" ? current : ordersTab === "past" ? past : all;
    const sel = list.find(o => o.id === id) || (!list.length && all.find(o => o.id === id)) || list[0] || all[0];
    app.innerHTML = `
      <div class="wrap">
        <div class="page-h">
          <nav class="crumbs"><a href="#/">Home</a><span>/</span><a href="#/account">Account</a><span>/</span><span>My orders</span></nav>
          <h1>My <em class="hl">orders</em></h1>
          <p>${all.length} ${all.length === 1 ? "order" : "orders"} &middot; ${current.length} on the way &middot; ${past.length} delivered</p>
        </div>
        <div class="tabs" role="group" aria-label="Filter orders" style="margin-bottom:14px">
          ${[["all", "All", all.length], ["current", "On the way", current.length], ["past", "Delivered", past.length]].map(([k, n, c]) =>
            `<button class="tab" data-otab="${k}" aria-pressed="${ordersTab === k}">${n} <span class="tab-n">${c}</span></button>`).join("")}
        </div>
        <div class="olist">${list.length ? list.map(o => `
          <a class="ochip" href="#/orders/${o.id}"${o.id === sel.id ? ' aria-current="true"' : ""}>
            <b>#${o.id}</b><span>${fmtDay(o.created)}</span>
            <span class="ochip-foot"><i class="dot${isDelivered(o) ? " done" : ""}"></i>${STAGES[trackStage(o)][0]}<em>${money(o.total)}</em></span>
          </a>`).join("") : `<p class="results-n">No ${ordersTab === "past" ? "delivered" : "current"} orders.</p>`}
        </div>
        <div class="orders-view">
          <div class="rc-col">${receipt(sel)}</div>
          ${orderDetails(sel)}
        </div>
      </div>`;
  }

  // ---------- checkout ----------
  let express = false;
  function viewCheckout() {
    if (!lines().length) {
      app.innerHTML = `<div class="wrap"><div class="empty"><h2>Your cart is empty</h2>Add a pair or two, then come back.<br><a class="btn dark" href="#/shop/all">Shop sneakers</a></div></div>`;
      return;
    }
    const u = me();
    if (!u) {
      authState = { mode: authState.mode, next: "#/checkout", heading: "Log in to check out", sub: "You need an account to place an order, so we can track it for you. Your cart is saved." };
      return renderAuth();
    }
    if (promo === "FIRSTSTEP" && firstStepUsed()) { promo = null; store.set("promo", null); }
    const [uFirst, ...uLast] = u.name.split(" ");
    const a = { first: uFirst, last: uLast.join(" "), email: u.email, ...store.get("addr:" + u.email, {}) };
    const f = (n, l, type = "text", cls = "", ac = "") =>
      `<label class="${cls}">${l}<input name="${n}" type="${type}" required autocomplete="${ac}" value="${esc(a[n] || "")}"></label>`;
    app.innerHTML = `
      <div class="wrap">
        <div class="page-h"><nav class="crumbs"><a href="#/">Home</a><span>/</span><span>Checkout</span></nav><h1>Checkout</h1></div>
        <form class="co" id="coForm" novalidate>
          <div class="panel">
            <h2>Where to?</h2>
            <div class="fields">
              ${f("first", "First name", "text", "", "given-name")}${f("last", "Last name", "text", "", "family-name")}
              ${f("email", "Email", "email", "full", "email")}
              ${f("address", "Street address", "text", "full", "street-address")}
              ${f("city", "City", "text", "", "address-level2")}${f("zip", "Postal code", "text", "", "postal-code")}
            </div>
            <h2 style="margin-top:32px">Delivery</h2>
            <div class="ship-opts">
              <label><input type="radio" name="ship" value="std"${express ? "" : " checked"}><div>Standard<small>2–4 business days</small></div><span id="stdPrice"></span></label>
              <label><input type="radio" name="ship" value="exp"${express ? " checked" : ""}><div>Express<small>Next business day</small></div><span>${money(EXPRESS)}</span></label>
            </div>
            <p class="note">Payment happens in a demo gateway (cards, bKash, Nagad, Rocket, Upay, net banking). No real money moves, so never enter real card details.</p>
          </div>
          <div class="panel">
            <h2>Order summary</h2>
            ${lines().map(({ p, size, q }) => `
              <div class="line">
                <div class="th">${img(p.img, 128, 128, p.name)}</div>
                <div><h4>${esc(p.name)}</h4><div class="meta">US ${size} &middot; Qty ${q}</div></div>
                <span class="amt">${money(p.price * q)}</span>
              </div>`).join("")}
            <div class="promo"><input id="promo" placeholder="Promo code" aria-label="Promo code" value="${promo || ""}"><button type="button" class="btn dark" data-act="promo">Apply</button></div>
            <div class="totals" id="coTotals"></div>
            <button class="btn olive block" type="submit" style="height:56px">Continue to payment ${ic("arrow", "arr")}</button>
          </div>
        </form>
      </div>`;
    renderCoTotals();
  }
  function renderCoTotals() {
    const el = $("#coTotals"); if (!el) return;
    const t = totals(express), std = totals(false);
    $("#stdPrice").textContent = std.ship ? money(std.ship) : "Free";
    el.innerHTML = `
      <div class="sum"><span>Subtotal</span><span>${money(t.sub)}</span></div>
      ${t.disc ? `<div class="sum disc"><span>Promo ${promo}</span><span>−${money(t.disc)}</span></div>` : ""}
      <div class="sum"><span>Shipping</span><span>${t.ship ? money(t.ship) : "Free"}</span></div>
      <div class="sum"><span>Estimated tax</span><span>${money(t.tax)}</span></div>
      <div class="sum big"><span>Total</span><span>${money(t.total)}</span></div>`;
  }

  const getOrder = id => store.get("orders", {})[id] || null;
  function viewOrder(id) {
    const o = getOrder(id);
    if (!o) return viewMissing();
    app.innerHTML = `
      <div class="done-pg">
        <div class="tick">${ic("check")}</div>
        <h1>Thanks, ${esc(o.first)}.</h1>
        <p>Order <strong>#${o.id}</strong> is confirmed and will ship within 24 hours.<br>We've sent a receipt to ${esc(o.email)}.<br>Paid <strong>${taka(o.total)}</strong> (${money(o.total)})${o.paidWith ? ` with ${esc(o.paidWith)}` : ""}.</p>
        <div class="done-ctas">
          <a class="btn outline" href="#/">${ic("left")}Return to shop</a>
          <a class="btn olive" href="#/track/${o.id}">${ic("truck")}Track your package</a>
        </div>
      </div>`;
  }

  // ---------- demo package tracking ----------
  // Status is derived from time since the order (one stage every TRACK_STEP), plus any
  // "simulate next update" clicks, so it survives reloads and needs no server.
  const TRACK_STEP = 30_000;
  const STAGES = [
    ["Order placed", "bag"],
    ["Packed", "box"],
    ["Shipped", "truck"],
    ["Out for delivery", "pin"],
    ["Delivered", "home"],
  ];
  const fmtTime = t => new Date(t).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const fmtDay = t => new Date(t).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const stageTime = (o, i) => Math.min(Date.now(), o.created + i * TRACK_STEP);
  const trackStage = o => Math.min(STAGES.length - 1, Math.floor((Date.now() - o.created) / TRACK_STEP) + (o.boost || 0));
  function trackEvents(o) {
    const city = esc(o.city || "your area");
    return [
      ["Order confirmed", `Paid with ${esc(o.paidWith || "demo payment")}`, "Online"],
      ["Packed and labelled", "Your pair passed quality check and was boxed", "Grounded Fulfilment Center, Tejgaon, Dhaka"],
      ["Handed to courier", `Tracking number ${o.tracking}`, "Dhaka Central Sorting Hub"],
      ["Out for delivery", "A rider has your package and will call before arriving", `${city} delivery hub`],
      ["Delivered", `Signed for by ${esc(o.first)}`, esc(o.address || city)],
    ];
  }
  let trackTimer;
  function viewTrack(id) {
    if (!id) {
      const orders = myOrders();
      app.innerHTML = `
        <div class="wrap">
          <div class="page-h"><nav class="crumbs"><a href="#/">Home</a><span>/</span><span>Track order</span></nav><h1>Track your <em class="hl">package</em></h1>
            <p>Enter the order number from your confirmation email.</p></div>
          <form class="track-find" id="trackFind"><input name="oid" placeholder="Order number, e.g. GR4K2Z9Q" aria-label="Order number" autocomplete="off"><button class="btn dark" type="submit">Track</button></form>
          ${orders.length ? `<div class="recent"><span>Your recent orders</span>${orders.slice(0, 5).map(o =>
            `<a href="#/track/${o.id}"><b>#${o.id}</b>${fmtDay(o.created)} &middot; ${STAGES[trackStage(o)][0]}${ic("arrow")}</a>`).join("")}</div>`
            : me() ? "" : `<p class="results-n" style="padding-bottom:60px"><a class="more" href="#/account">Log in to see all your orders ${ic("arrow")}</a></p>`}
        </div>`;
      return;
    }
    const o = getOrder(id);
    if (!o) return viewMissing();
    document.title = `Tracking #${o.id} · Grounded`;
    const stage = trackStage(o), events = trackEvents(o);
    const eta = o.created + (o.express ? 1 : 3) * 864e5;
    const pct = stage / (STAGES.length - 1) * 100;
    app.innerHTML = `
      <div class="wrap">
        <div class="page-h">
          <nav class="crumbs"><a href="#/">Home</a><span>/</span><a href="#/track">Track order</a><span>/</span><span>#${o.id}</span></nav>
          <h1>${stage === 4 ? "Delivered" : stage === 3 ? "Arriving <em class=\"hl\">today</em>" : "On its <em class=\"hl\">way</em>"}</h1>
          <p>${stage === 4 ? `Delivered ${fmtTime(stageTime(o, 4))}. Enjoy the new pair.` : `Estimated delivery: <b>${fmtDay(eta)}</b> &middot; ${o.express ? "Express" : "Standard"} shipping`}</p>
        </div>

        <div class="trk">
          <div class="trk-head">
            <div><span>Tracking number</span><b>${o.tracking}</b></div>
            <div><span>Courier</span><b>Grounded Express (demo)</b></div>
            <div><span>Order</span><b>#${o.id}</b></div>
            <span class="trk-badge${stage === 4 ? " done" : ""}">${STAGES[stage][0]}</span>
          </div>
          <ol class="trk-steps" style="--p:${pct}%">${STAGES.map(([n, icon], i) => `
            <li class="${i < stage ? "past" : i === stage ? "now" : ""}"><i>${ic(icon)}</i><span>${n}</span></li>`).join("")}
          </ol>
        </div>

        <div class="trk-grid">
          <div class="panel">
            <h2>Shipment updates</h2>
            <ul class="timeline">${events.slice(0, stage + 1).map(([t, d, where], i) => `
              <li class="${i === stage ? "now" : ""}"><time>${fmtTime(stageTime(o, i))}</time><b>${t}</b><span>${d}</span><small>${where}</small></li>`).reverse().join("")}
            </ul>
            ${stage < 4 ? `<div class="trk-demo"><span>Demo tracking: the next update arrives automatically within 30 seconds.</span><button class="btn outline" data-tnext="${o.id}">Simulate next update</button></div>` : ""}
          </div>
          <div class="panel">
            <h2>Delivery details</h2>
            <dl class="trk-dl">
              <dt>Ship to</dt><dd>${esc(o.first)} ${esc(o.last || "")}<br>${esc(o.address || "")}<br>${esc(o.city || "")} ${esc(o.zip || "")}</dd>
              <dt>Paid</dt><dd>${taka(o.total)} (${money(o.total)})<br>${esc(o.paidWith || "")}</dd>
            </dl>
            <div class="trk-items">${(o.items || []).map(({ id: pid, size, q }) => { const p = byId[pid]; return p ? `
              <a class="line" href="#/p/${p.id}"><div class="th">${img(p.img, 128, 128, p.name)}</div><div><h4>${esc(p.name)}</h4><div class="meta">US ${size} &middot; Qty ${q}</div></div><span class="amt">${money(p.price * q)}</span></a>` : ""; }).join("")}
            </div>
            <a class="more" href="#/help/contact">Problem with this delivery? ${ic("arrow")}</a>
          </div>
        </div>
      </div>`;
    // Re-render the moment the next stage is due, while this page is open.
    clearTimeout(trackTimer);
    if (stage < 4) trackTimer = setTimeout(() => route.cur?.[0] === "track" && route.cur[1] === id && viewTrack(id),
      TRACK_STEP - ((Date.now() - o.created) % TRACK_STEP) + 50);
  }
  function viewMissing() {
    app.innerHTML = `<div class="wrap"><div class="empty"><h2>Wrong turn</h2>We couldn't find that page.<br><a class="btn dark" href="#/">Back to the shop</a></div></div>`;
  }

  // ---------- cart drawer ----------
  function renderBag() {
    const n = count(), ls = lines(), t = totals();
    $("#cartCount").textContent = n || "";
    $("#bagN").textContent = n ? `(${n})` : "";
    const left = FREE_SHIP - t.sub;
    $("#shipbar").innerHTML = ls.length ? `<div class="shipbar">${left > 0 ? `You're <b>${money(left)}</b> away from free shipping` : "<b>Free shipping</b> unlocked on this order"}<div class="meter"><i style="width:${Math.min(100, t.sub / FREE_SHIP * 100)}%"></i></div></div>` : "";
    $("#lines").innerHTML = ls.length ? ls.map(({ k, p, size, q }) => `
      <div class="line">
        <a class="th" href="#/p/${p.id}">${img(p.img, 168, 168, p.name)}</a>
        <div>
          <h4><a href="#/p/${p.id}">${esc(p.name)}</a></h4>
          <div class="meta">${esc(p.color)} &middot; US ${size}</div>
          <div class="ctl">
            <div class="stepper"><button data-step="${k}" data-d="-1" aria-label="Decrease">${ic("minus")}</button><span>${q}</span><button data-step="${k}" data-d="1" aria-label="Increase">${ic("plus")}</button></div>
            <button class="rm" data-rm="${k}">Remove</button>
          </div>
        </div>
        <span class="amt">${money(p.price * q)}</span>
      </div>`).join("")
      : `<div class="empty"><h2>Your cart is empty</h2>Good things are waiting.<br><a class="btn dark" href="#/shop/new" data-act="close">Shop new in</a></div>`;
    $("#cartFoot").innerHTML = ls.length ? `
      <div class="sum big"><span>Subtotal</span><span>${money(t.sub)}</span></div>
      <div class="sum" style="font-size:12.5px"><span>Shipping and tax calculated at checkout</span></div>
      <a class="btn dark block" href="#/checkout" data-act="close">Checkout ${ic("arrow", "arr")}</a>` : "";
    $("#cartFoot").style.display = ls.length ? "" : "none";
    renderCoTotals();
  }
  const openBag = () => { $("#cart").classList.add("open"); $("#cart").setAttribute("aria-hidden", "false"); };
  const closeBag = () => { $("#cart").classList.remove("open"); $("#cart").setAttribute("aria-hidden", "true"); };

  // ---------- help ----------
  const HELP = [
    ["shipping", "Shipping", "truck", "Delivery times, costs and tracking"],
    ["returns", "Returns", "ret", "30 days to change your mind"],
    ["size", "Size guide", "ruler", "Find your fit before you order"],
    ["contact", "Contact", "chat", "Talk to a real person"],
  ];
  // US men's / unisex conversions. Measure heel to longest toe.
  const SIZE_CHART = [[6, 5.5, 38.5, 24], [7, 6, 40, 25], [8, 7, 41, 26], [8.5, 7.5, 42, 26.5], [9, 8, 42.5, 27],
    [9.5, 8.5, 43, 27.5], [10, 9, 44, 28], [10.5, 9.5, 44.5, 28.5], [11, 10, 45, 29], [12, 11, 46, 30]];
  const faq = (q, a) => `<details><summary>${q} ${ic("plus")}</summary><p>${a}</p></details>`;

  let helpObs;
  function viewHelp() {
    document.title = "Help · Grounded";
    $$(".nav a").forEach(a => a.getAttribute("href") === "#/help" && a.setAttribute("aria-current", "page"));
    app.innerHTML = `
      <div class="wrap">
        <div class="page-h">
          <nav class="crumbs"><a href="#/">Home</a><span>/</span><span>Help</span></nav>
          <h1>How can we <em class="hl">help?</em></h1>
          <p>Answers to the questions we get most. Still stuck? Our team replies within a day.</p>
        </div>
        <div class="topics">${HELP.map(([k, t, icon, d]) => `
          <a class="topic" href="#/help/${k}">${ic(icon)}<b>${t}</b><span>${d}</span></a>`).join("")}
        </div>

        <div class="help">
          <nav class="help-nav" aria-label="Help topics">${HELP.map(([k, t, icon]) =>
            `<a href="#/help/${k}" data-hnav="${k}">${ic(icon)}${t}</a>`).join("")}
          </nav>
          <div>
            <section class="hsec" id="help-shipping">
              <span class="eyebrow">01</span><h2>Shipping</h2>
              <p class="hlede">Every order leaves our warehouse within 24 hours on business days. You'll get a tracking link by email as soon as it ships.</p>
              <div class="htable"><table>
                <thead><tr><th>Method</th><th>Delivery time</th><th>Cost</th></tr></thead>
                <tbody>
                  <tr><td>Standard</td><td>2–4 business days</td><td>${money(SHIP)}, <b>free over $${FREE_SHIP}</b></td></tr>
                  <tr><td>Express</td><td>Next business day</td><td>${money(EXPRESS)}</td></tr>
                </tbody></table></div>
              ${faq("When will my order ship?", "Orders placed before 2pm ship the same business day. Orders placed later, or on weekends, ship the next business day.")}
              ${faq("How do I track my order?", "Use the tracking link in your shipping confirmation email. It can take a few hours after shipping for the first scan to appear.")}
              ${faq("Can I change my address after ordering?", "If your order hasn't shipped yet, contact us and we'll update it. Once it's on its way, the carrier's tracking page lets you redirect it.")}
            </section>

            <section class="hsec" id="help-returns">
              <span class="eyebrow">02</span><h2>Returns</h2>
              <p class="hlede">You have 30 days from delivery to return any pair, worn outdoors or not. Returns are free, and so are exchanges.</p>
              <ol class="steps">
                <li><b>Start a return</b>Send us your order number through the contact form below and tell us what's wrong.</li>
                <li><b>Pack it up</b>Use the original box if you still have it. We'll email you a prepaid label.</li>
                <li><b>Get your refund</b>Refunds go back to your original payment method within 5 business days of arrival.</li>
              </ol>
              ${faq("Can I exchange for a different size?", "Yes. Tell us the size you want when you start the return and we'll ship the new pair as soon as yours is scanned by the carrier.")}
              ${faq("Are sale items returnable?", "Yes, sale items have the same 30-day return window as everything else.")}
              ${faq("What if my pair arrives damaged?", "Send us a photo through the contact form and we'll ship a replacement right away. No need to send the damaged pair back first.")}
            </section>

            <section class="hsec" id="help-size">
              <span class="eyebrow">03</span><h2>Size guide</h2>
              <p class="hlede">Our sneakers fit true to size. If you're between sizes, go half a size up. Sizes are unisex, listed in US men's.</p>
              <div class="htable"><table class="sizes-t">
                <thead><tr><th>US</th><th>UK</th><th>EU</th><th>Foot length</th></tr></thead>
                <tbody>${SIZE_CHART.map(([us, uk, eu, cm]) => `<tr><td><b>${us}</b></td><td>${uk}</td><td>${eu}</td><td>${cm} cm</td></tr>`).join("")}</tbody>
              </table></div>
              <div class="measure">
                <b>How to measure your foot</b>
                <ol><li>Stand on a sheet of paper with your heel against a wall.</li><li>Mark the tip of your longest toe.</li><li>Measure from the wall to the mark and match it to the foot length column.</li></ol>
                <span>Women's sizing: subtract 1.5 from your usual women's US size (a women's 8.5 is a 7 here).</span>
              </div>
            </section>

            <section class="hsec" id="help-contact">
              <span class="eyebrow">04</span><h2>Contact</h2>
              <p class="hlede">Real people, not bots. We answer every message within one business day, usually much faster.</p>
              <div class="contact">
                <div class="channels">
                  <div>${ic("mail")}<span><b>Email</b>help@grounded.example</span></div>
                  <div>${ic("phone")}<span><b>Phone</b>+1 (555) 014-2026</span></div>
                  <div>${ic("clock")}<span><b>Hours</b>Mon–Fri, 9am–6pm</span></div>
                </div>
                <form id="contactForm" class="panel" novalidate>
                  <div class="fields">
                    <label>Name<input name="name" required autocomplete="name"></label>
                    <label>Email<input name="email" type="email" required autocomplete="email"></label>
                    <label><span>Order number <i>(optional)</i></span><input name="order" placeholder="GR..."></label>
                    <label>Topic<select name="topic"><option>Shipping</option><option>Returns &amp; exchanges</option><option>Sizing</option><option>Something else</option></select></label>
                    <label class="full">Message<textarea name="message" required rows="5"></textarea></label>
                  </div>
                  <button class="btn dark" type="submit" style="margin-top:18px">Send message ${ic("arrow", "arr")}</button>
                </form>
              </div>
            </section>
          </div>
        </div>
      </div>`;

    // Highlight the side-nav item for whichever section is on screen.
    helpObs?.disconnect();
    helpObs = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) $$("[data-hnav]").forEach(a => a.toggleAttribute("aria-current", a.dataset.hnav === e.target.id.slice(5)));
    }), { rootMargin: "-30% 0px -60% 0px" });
    $$(".hsec").forEach(s => helpObs.observe(s));
  }
  function scrollToHelp(topic) {
    const el = topic && document.getElementById("help-" + topic);
    if (!el) return window.scrollTo(0, 0);
    // Always jump: browser smooth-scrolling over a long page can take ~1s, past our 0.7s budget.
    el.scrollIntoView({ behavior: "instant", block: "start" });
  }

  const closeMenu = () => { $("#nav").classList.remove("open"); const b = $("#menuBtn"); b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-label", "Menu"); };

  // ---------- router ----------
  function route() {
    const [, view, arg] = (location.hash.slice(1) || "/").split("/");
    const prev = route.cur?.[0];
    route.cur = [view, arg];
    clearTimeout(trackTimer);
    closeMenu();
    // Moving between help topics: page is already rendered, just jump to the section.
    if (view === "help" && prev === "help" && $(".help")) return scrollToHelp(arg);
    document.title = "Grounded Sneakers";
    $$(".nav a").forEach(a => a.removeAttribute("aria-current"));
    if (view !== "shop") { shopState.q = ""; $("#q").value = ""; }
    if (!view) viewHome();
    else if (view === "shop") viewShop(arg || "all");
    else if (view === "p") viewProduct(decodeURIComponent(arg || ""));
    else if (view === "checkout") viewCheckout();
    else if (view === "order") viewOrder(arg);
    else if (view === "track") viewTrack(arg);
    else if (view === "account") viewAccount();
    else if (view === "orders") viewOrders(arg);
    else if (view === "help") { viewHelp(); return scrollToHelp(arg); }
    else viewMissing();
    window.scrollTo(0, 0);
  }

  // ---------- events ----------
  document.addEventListener("click", e => {
    // In-page anchor (e.g. "Explore collections"): scroll instead of routing.
    const a = e.target.closest('a[href^="#"]:not([href^="#/"])');
    if (a) { e.preventDefault(); document.getElementById(a.getAttribute("href").slice(1))?.scrollIntoView({ behavior: "smooth" }); return; }

    // Product photo: open the quick view. Ctrl/Cmd/middle-click still opens the full page normally.
    const qv = e.target.closest("[data-qv]");
    if (qv && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) { e.preventDefault(); return openQuick(qv.dataset.qv); }

    const el = e.target.closest("[data-save],[data-quick],[data-qadd],[data-htab],[data-rail],[data-pick],[data-qty],[data-buy],[data-buynow],[data-qvclose],[data-authmode],[data-otab],[data-reorder],[data-step],[data-rm],[data-act],#cartBtn,#searchBtn,#menuBtn");
    if (!el) return;
    const d = el.dataset;
    if (el.id === "cartBtn") return openBag();
    if (el.id === "searchBtn") { const sb = $("#searchbar"); sb.classList.toggle("open"); if (sb.classList.contains("open")) $("#q").focus(); return; }
    if (el.id === "menuBtn") { const n = $("#nav").classList.toggle("open"); el.setAttribute("aria-expanded", n); el.setAttribute("aria-label", n ? "Close menu" : "Menu"); return; }
    if (d.save) { e.preventDefault(); return toggleSave(d.save); }
    if ("quick" in d) { $$(".quick.open").forEach(q => q.classList.remove("open")); el.closest(".quick").classList.add("open"); return; }
    if (d.qadd) { el.closest(".quick").classList.remove("open"); return add(d.qadd, d.size); }
    if (d.htab) { homeTab = d.htab; $$("[data-htab]").forEach(t => t.setAttribute("aria-pressed", t === el)); return renderFresh(); }
    if (d.rail) { const r = $("#rail"); return r.scrollBy({ left: +d.rail * r.clientWidth * 0.75 }); }
    if (d.pick) {
      const box = el.closest("[data-buybox]");
      box.dataset.size = d.pick;
      box.querySelectorAll("[data-pick]").forEach(b => b.setAttribute("aria-pressed", b === el));
      box.querySelector(".sizegrid").classList.remove("err"); box.querySelector(".err-msg").textContent = "";
      return;
    }
    if (d.qty) {
      const box = el.closest("[data-buybox]"), p = byId[box.dataset.buybox];
      const q = Math.max(1, Math.min(MAX_QTY, +box.dataset.qty + +d.qty));
      box.dataset.qty = q;
      box.querySelector("[data-qtyval]").textContent = q;
      box.querySelector('[data-qty="-1"]').disabled = q === 1;
      box.querySelector('[data-qty="1"]').disabled = q === MAX_QTY;
      box.querySelector("[data-buy] span").innerHTML = `Add to cart &middot; ${money(p.price * q)}`;
      return;
    }
    if ("buy" in d) {
      const c = boxChoice(el.closest("[data-buybox]")); if (!c) return;
      add(c.p.id, c.size, c.qty);
      const html = el.innerHTML;
      el.classList.add("done"); el.innerHTML = ic("check") + "Added to cart";
      setTimeout(() => { el.classList.remove("done"); el.innerHTML = html; }, 900);
      return;
    }
    if ("buynow" in d) {
      const c = boxChoice(el.closest("[data-buybox]")); if (!c) return;
      add(c.p.id, c.size, c.qty);
      location.hash = "#/checkout"; // hashchange closes the quick view
      return;
    }
    if ("qvclose" in d) return closeQuick();
    if (d.authmode) { authState.mode = d.authmode; return renderAuth(); }
    if (d.otab) { ordersTab = d.otab; return viewOrders(route.cur?.[1]); }
    if (d.act === "print") return window.print();
    if (d.reorder) {
      const o = getOrder(d.reorder); let added = 0, skipped = 0;
      for (const i of o?.items || []) {
        const p = byId[i.id];
        if (!p || soldOut(p, +i.size)) { skipped++; continue; }
        const k = `${i.id}|${i.size}`; cart[k] = Math.min((cart[k] || 0) + i.q, 10); added += i.q;
      }
      store.set("cart", cart); renderBag();
      if (added) { bump("#cartCount"); openBag(); }
      return toast(added ? `${added} ${added === 1 ? "pair" : "pairs"} added to cart${skipped ? ` (${skipped} unavailable)` : ""}` : "Those items are no longer available");
    }
    if (d.act === "logout") { store.set("session", null); authState.mode = "login"; promo = null; store.set("promo", null); syncAccountUI(); toast("You're logged out"); location.hash = "#/"; return; }
    if (d.step) return setQty(d.step, cart[d.step] + +d.d);
    if (d.rm) return setQty(d.rm, 0);
    if (d.act === "close") return closeBag();
    if (d.act === "promo") {
      const code = $("#promo").value.trim().toUpperCase();
      if (!code) { promo = null; store.set("promo", null); renderCoTotals(); return; }
      if (code === "FIRSTSTEP" && firstStepUsed()) { $("#promo").classList.add("bad"); return toast(`You've already used FIRSTSTEP on order #${me().firstStepOrder}`); }
      if (PROMOS[code]) { promo = code; store.set("promo", code); renderCoTotals(); toast(`${code} applied: ${PROMOS[code] * 100}% off`); }
      else { $("#promo").classList.add("bad"); toast("That code isn't valid"); }
    }
  });
  // Close an open quick-size panel when the pointer leaves its card.
  document.addEventListener("mouseleave", e => { if (e.target.classList?.contains("pc")) e.target.querySelector(".quick.open")?.classList.remove("open"); }, true);

  document.addEventListener("change", e => {
    if (e.target.id === "sort") { shopState.sort = e.target.value; renderResults(); }
    if (e.target.name === "ship") { express = e.target.value === "exp"; renderCoTotals(); }
  });
  document.addEventListener("input", e => {
    if (e.target.id === "promo" || e.target.closest("#coForm,#contactForm")) e.target.classList.remove("bad");
  });
  $("#q").addEventListener("input", e => {
    shopState.q = e.target.value;
    if (route.cur?.[0] !== "shop") { location.hash = "#/shop/all"; return; }
    renderResults();
  });

  document.addEventListener("submit", e => {
    e.preventDefault();
    const form = e.target;
    if (form.id === "news") { form.reset(); return toast("You're on the list"); }
    if (form.id === "authForm") return handleAuth(form);
    if (form.id === "contactForm") {
      const bad = [...form.querySelectorAll("[required]")].find(i => !i.value.trim() || !i.checkValidity());
      if (bad) { bad.classList.add("bad"); bad.focus(); return toast(`Please check: ${bad.closest("label").firstChild.textContent.trim()}`); }
      const name = form.elements.name.value.trim().split(" ")[0];
      form.reset();
      return toast(`Thanks ${name}, we'll reply within a day`);
    }
    if (form.id !== "coForm") return;
    const bad = [...form.querySelectorAll("input[required]")].find(i => !i.value.trim() || !i.checkValidity());
    if (bad) { bad.classList.add("bad"); bad.focus(); toast(`Please check: ${bad.closest("label").firstChild.textContent.trim()}`); return; }
    const data = Object.fromEntries(new FormData(form));
    const { ship, ...addr } = data;
    if (!me()) return route(); // session ended in another tab: back to the login gate
    store.set("addr:" + me().email, addr);
    openGateway(data, totals(express).total);
  });

  function finishOrder(data, total, paidWith) {
    const id = "GR" + Date.now().toString(36).toUpperCase().slice(-6);
    const u = me();
    const order = {
      id, total, paidWith, created: Date.now(), express, user: u?.email, promo,
      first: data.first, last: data.last, email: data.email, address: data.address, city: data.city, zip: data.zip,
      tracking: "GX" + String(Date.now()).slice(-9) + "BD",
      // Snapshot names and prices so the receipt stays correct even if the catalog changes later.
      items: lines().map(({ p, size, q }) => ({ id: p.id, name: p.name, color: p.color, price: p.price, size, q })),
      breakdown: totals(express),
    };
    store.set("orders", { ...store.get("orders", {}), [id]: order });
    if (promo === "FIRSTSTEP" && u) { u.firstStepOrder = id; saveUser(u); syncAccountUI(); }
    cart = {}; promo = null; express = false;
    store.set("cart", cart); store.set("promo", null);
    renderBag();
    location.hash = "#/order/" + id;
  }

  // ---------- demo payment gateway (Bangladesh) ----------
  // Nothing typed here leaves the page or is stored: card digits are only used to pick a demo outcome,
  // and the order keeps just a masked label like "Visa •••• 4242".
  const BDT_RATE = 122; // demo conversion rate, USD → BDT
  const taka = usd => "৳" + Math.round(usd * BDT_RATE).toLocaleString("en-IN");
  const MFS = [["bkash", "bKash", "#e2136e"], ["nagad", "Nagad", "#ec1c24"], ["rocket", "Rocket", "#8c3494"], ["upay", "Upay", "#0b4ea2"]];
  const BANKS = ["Dutch-Bangla Bank", "BRAC Bank", "City Bank", "Eastern Bank", "Islami Bank", "Sonali Bank"];
  const TEST_CARDS = { "4242424242424242": "ok", "5555555555554444": "ok", "4000000000000002": "decline" };
  const DEMO_OTP = "123456";
  const gw = { data: null, total: 0, tab: "card", mfs: null, bank: null, otpSent: false };

  const cardBrand = n => /^4/.test(n) ? "Visa" : /^(5[1-5]|2[2-7])/.test(n) ? "Mastercard" : /^3[47]/.test(n) ? "Amex" : "";

  function openGateway(data, total) {
    Object.assign(gw, { data, total, tab: "card", mfs: null, bank: null, otpSent: false });
    $("#pay").classList.add("open"); $("#pay").setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    demoBanner(true);
    renderGateway();
  }
  function closeGateway() {
    $("#pay").classList.remove("open"); $("#pay").setAttribute("aria-hidden", "true");
    $("#gw").innerHTML = ""; // drop anything typed into the card fields
    document.body.style.overflow = "";
    demoBanner(false);
  }
  function demoBanner(show) { $("#demoBanner").classList.toggle("show", show); }

  function renderGateway() {
    const tabs = [["card", "Card"], ["mfs", "Mobile banking"], ["net", "Net banking"]];
    let body = "";
    if (gw.tab === "card") body = `
      <form id="gwCard" class="gw-form" novalidate autocomplete="off">
        <div class="gw-brands"><span>Visa</span><span>Mastercard</span><span>Amex</span></div>
        <label>Card number<div class="cardnum"><input name="gwnum" inputmode="numeric" placeholder="4242 4242 4242 4242" maxlength="19" autocomplete="off"><b id="gwBrand"></b></div></label>
        <div class="fields">
          <label>Expiry<input name="gwexp" inputmode="numeric" placeholder="MM / YY" maxlength="7" autocomplete="off"></label>
          <label>CVC<input name="gwcvc" inputmode="numeric" placeholder="123" maxlength="4" autocomplete="off"></label>
        </div>
        <label>Name on card<input name="gwname" placeholder="As printed on the card" autocomplete="off"></label>
        <div class="testcards">Any made-up details work. Or tap:
          <button type="button" data-tcard="4242424242424242">4242 … 4242 succeeds</button>
          <button type="button" data-tcard="4000000000000002">4000 … 0002 declines</button>
        </div>
        <div class="gw-err" id="gwErr" role="alert"></div>
        <button class="btn olive block" type="submit">Pay ${taka(gw.total)}</button>
      </form>`;
    if (gw.tab === "mfs") body = !gw.mfs ? `
      <p class="gw-hint">Choose your mobile wallet</p>
      <div class="mfs">${MFS.map(([k, n, c]) => `<button type="button" data-mfs="${k}"><i style="background:${c}">${n[0]}</i>${n}</button>`).join("")}</div>` : (() => {
        const [, n, c] = MFS.find(m => m[0] === gw.mfs);
        return `
      <form id="gwMfs" class="gw-form" novalidate autocomplete="off">
        <div class="mfs-head" style="--c:${c}"><i>${n[0]}</i><span><b>Pay with ${n}</b>Demo wallet, no money moves</span><button type="button" class="link" data-mfs="">Change</button></div>
        <label>${n} account number<input name="gwphone" inputmode="numeric" placeholder="01XXXXXXXXX" maxlength="11" autocomplete="off"${gw.otpSent ? " readonly" : ""}></label>
        ${gw.otpSent ? `<label>Verification code<input name="gwotp" inputmode="numeric" placeholder="6-digit code" maxlength="6" autocomplete="one-time-code"></label>
        <p class="gw-hint">Demo code sent: <b>${DEMO_OTP}</b>. A real wallet would text this to your phone.</p>` : ""}
        <div class="gw-err" id="gwErr" role="alert"></div>
        <button class="btn block" style="background:${c};color:#fff" type="submit">${gw.otpSent ? `Confirm ${taka(gw.total)}` : "Send code"}</button>
      </form>`; })();
    if (gw.tab === "net") body = `
      <form id="gwNet" class="gw-form" novalidate>
        <p class="gw-hint">Choose your bank</p>
        <div class="banks">${BANKS.map(b => `<button type="button" data-bank="${b}" aria-pressed="${gw.bank === b}">${b}</button>`).join("")}</div>
        <div class="gw-err" id="gwErr" role="alert"></div>
        <button class="btn olive block" type="submit">Pay ${taka(gw.total)}</button>
      </form>`;

    $("#gw").innerHTML = `
      <div class="gw-top">
        <div><span class="gw-tag">Demo gateway</span><b class="gw-m" role="img" aria-label="Grounded"><svg class="gr" viewBox="0 0 100 50" aria-hidden="true"><use href="#gr"/></svg>ounded<i>.</i></b></div>
        <button class="tbtn" data-gw="cancel" aria-label="Cancel payment"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <div class="gw-amt"><span>Amount to pay</span><strong>${taka(gw.total)}</strong><small>${money(gw.total)} at ৳${BDT_RATE}/USD demo rate</small></div>
      <div class="gw-tabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" role="tab" data-gwtab="${k}" aria-selected="${gw.tab === k}">${n}</button>`).join("")}</div>
      <div class="gw-body">${body}</div>
      <button class="gw-cancel" data-gw="cancel">Cancel and return to checkout</button>`;
  }

  function gwFail(msg, field) {
    $("#gwErr").textContent = msg;
    if (field) { field.classList.add("bad"); field.focus(); }
  }
  function gwProcess(paidWith, ok = true) {
    // Under 0.7s by design: a short beat so the state change reads, never a real wait.
    $("#gw .gw-body").innerHTML = `<div class="gw-state"><span class="spin"></span><b>Processing payment</b></div>`;
    setTimeout(() => {
      if (!ok) {
        renderGateway();
        return gwFail("Card declined by the issuing bank (demo). That number is the decline test card; any other number works.");
      }
      $("#gw .gw-body").innerHTML = `<div class="gw-state ok"><span class="tick">${ic("check")}</span><b>Payment successful</b><small>${esc(paidWith)} &middot; ${taka(gw.total)}</small></div>`;
      $("#gw .gw-cancel").remove();
      $$("#gw [data-gwtab]").forEach(b => b.disabled = true);
      setTimeout(() => { const d = gw.data, t = gw.total; closeGateway(); finishOrder(d, t, paidWith); }, 550);
    }, 400);
  }

  document.addEventListener("submit", e => {
    const f = e.target;
    if (f.id === "gwCard") {
      const num = f.gwnum.value.replace(/\D/g, ""), [mm, yy] = f.gwexp.value.split("/").map(s => +s.trim());
      // Demo: any made-up details are accepted. We only check the fields are filled in a sensible shape
      // (no checksum, card-type or expiry-date checks). The one exception is the 4000…0002 decline test card.
      if (num.length < 12) return gwFail("Enter a card number (any 12–16 digits work in this demo).", f.gwnum);
      if (!(mm >= 1 && mm <= 12) || !(yy >= 0)) return gwFail("Enter an expiry as MM / YY (any month and year work).", f.gwexp);
      if (f.gwcvc.value.replace(/\D/g, "").length < 3) return gwFail("Enter any 3 or 4 digit security code.", f.gwcvc);
      if (!f.gwname.value.trim()) return gwFail("Enter any name.", f.gwname);
      return gwProcess(`${cardBrand(num) || "Card"} •••• ${num.slice(-4)}`, TEST_CARDS[num] !== "decline");
    }
    if (f.id === "gwMfs") {
      const n = MFS.find(m => m[0] === gw.mfs)[1], phone = f.gwphone.value.trim();
      if (!gw.otpSent) {
        if (!/^01[3-9]\d{8}$/.test(phone)) return gwFail("Enter an 11-digit Bangladeshi mobile number, like 01712345678.", f.gwphone);
        gw.otpSent = true; gw.phone = phone; renderGateway();
        $("#gwMfs").gwphone.value = phone; $("#gwMfs").gwotp.focus();
        return;
      }
      if (f.gwotp.value.trim() !== DEMO_OTP) return gwFail(`That code doesn't match. In this demo it's ${DEMO_OTP}.`, f.gwotp);
      return gwProcess(`${n} ${gw.phone.slice(0, 3)}••••${gw.phone.slice(-4)}`);
    }
    if (f.id === "trackFind") {
      e.preventDefault();
      const oid = f.oid.value.trim().toUpperCase().replace(/^#/, "");
      if (getOrder(oid)) { location.hash = "#/track/" + oid; return; }
      f.oid.classList.add("bad");
      return toast(oid ? "No order with that number on this device" : "Enter your order number");
    }
    if (f.id === "gwNet") {
      if (!gw.bank) return gwFail("Choose a bank to continue.");
      return gwProcess(`${gw.bank} net banking`);
    }
  });
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-gwtab],[data-mfs],[data-bank],[data-tcard],[data-gw],[data-tnext],#demoBanner [data-banner]");
    if (!el) return;
    const d = el.dataset;
    if (d.gwtab) { gw.tab = d.gwtab; gw.mfs = null; gw.otpSent = false; return renderGateway(); }
    if ("mfs" in d) { gw.mfs = d.mfs || null; gw.otpSent = false; renderGateway(); return $("#gwMfs")?.gwphone.focus(); }
    if (d.bank) { gw.bank = d.bank; $$("[data-bank]").forEach(b => b.setAttribute("aria-pressed", b === el)); $("#gwErr").textContent = ""; return; }
    if (d.tcard) {
      const f = $("#gwCard"), y = (new Date().getFullYear() + 3) % 100;
      f.gwnum.value = d.tcard.replace(/(\d{4})(?=\d)/g, "$1 "); f.gwexp.value = `12 / ${y}`; f.gwcvc.value = "123"; f.gwname.value = "Test User";
      f.gwnum.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    if (d.tnext) { const all = store.get("orders", {}), o = all[d.tnext]; o.boost = (o.boost || 0) + 1; store.set("orders", all); return viewTrack(o.id); }
    if (d.gw === "cancel") { closeGateway(); return toast("Payment cancelled. Your cart is saved."); }
    if ("banner" in d) demoBanner(false);
  });
  // Live formatting: "4242 4242 …", "MM / YY", digits only for CVC / phone / OTP.
  document.addEventListener("input", e => {
    const t = e.target;
    if (!t.closest("#gw")) return;
    t.classList.remove("bad"); const err = $("#gwErr"); if (err) err.textContent = "";
    if (t.name === "gwnum") {
      const n = t.value.replace(/\D/g, "").slice(0, 16);
      t.value = n.replace(/(\d{4})(?=\d)/g, "$1 ");
      $("#gwBrand").textContent = cardBrand(n);
    }
    if (t.name === "gwexp") { const v = t.value.replace(/\D/g, "").slice(0, 4); t.value = v.length > 2 ? `${v.slice(0, 2)} / ${v.slice(2)}` : v; }
    if (["gwcvc", "gwphone", "gwotp"].includes(t.name)) t.value = t.value.replace(/\D/g, "");
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { if ($("#pay").classList.contains("open")) { closeGateway(); return toast("Payment cancelled. Your cart is saved."); } if (closeQuick()) return; closeBag(); closeMenu(); $("#searchbar").classList.remove("open"); }
    if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $("#searchbar").classList.add("open"); $("#q").focus(); }
  });

  window.addEventListener("storage", e => {
    if (e.key === "gr:cart") { cart = store.get("cart", {}); renderBag(); }
    if (e.key === "gr:session" || e.key === "gr:users") { syncAccountUI(); route(); }
    if (e.key === "gr:saved") { saved = new Set(store.get("saved", [])); $("#savedCount").textContent = saved.size || ""; }
  });
  window.addEventListener("hashchange", () => { closeBag(); closeQuick(); route(); });

  $("#savedCount").textContent = saved.size || "";
  syncAccountUI();
  renderBag();
  route();
})();
