/* Lumière by Bee — shared rate-card engine.
   Every page supplies its own PACKAGES, ADDONS and message wording, then calls
   Lumiere.renderTiers() and (where the page has one) Lumiere.initBuilder(). */
(function (global) {
"use strict";

const naira = n => "₦" + n.toLocaleString("en-NG");

const CAMERA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 8.5h3l2-2.5h8l2 2.5h3V19H3z"/><circle cx="12" cy="13" r="3.6"/></svg>';

const el = s => typeof s === "string" ? document.querySelector(s) : s;

/* ---------- Tier cards ---------- */

function tierCard(key, p, cfg){
  const shown = p.gets.slice(0,5), rest = p.gets.slice(5);
  const featured = !!(p.badge && !p.soft);
  const panel = cfg.panelPrefix + "-" + key;
  const wa = "https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent(cfg.tierMessage(p));
  return `<article class="tier${featured ? " tier-featured" : ""}" aria-label="${p.name} package">
    <div class="tier-head">
      <div class="tier-top"><span class="tier-no">${p.no}</span>${p.badge ? `<span class="badge${p.soft ? " badge-soft" : ""}">${p.badge}</span>` : ""}</div>
      <h3>${p.name}</h3>
      <p class="tier-who">${CAMERA}${p.who}</p>
      <div class="tier-price"><span class="cur">₦</span><span class="amt">${p.price.toLocaleString("en-NG")}</span></div>
      <p class="tier-unit">${cfg.unit(p)}</p>
      ${p.tagline ? `<p class="tier-tag">${p.tagline}</p>` : ""}
      ${p.value ? `<p class="tier-value">${p.value}</p>` : ""}
    </div>
    <div class="tier-body">
      <p class="gets-head">You get</p>
      <ul class="list">${shown.map(g => `<li>${g}</li>`).join("")}</ul>
      <div class="more-panel" id="${panel}" inert><div class="panel-inner">
        ${rest.length ? `<ul class="list" style="margin-top:9px">${rest.map(g => `<li>${g}</li>`).join("")}</ul>` : ""}
        <dl class="specs">${p.specs.map(([t,d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("")}</dl>
      </div></div>
      <div class="tier-foot">
        <a class="btn ${featured ? "btn-gold" : "btn-line"}" target="_blank" rel="noopener noreferrer" href="${wa}"><span>${cfg.cta || "Check your date"}</span><span aria-hidden="true">↗</span></a>
        ${cfg.builder ? `<a class="btn btn-line btn-quiet" href="#add-ons" data-build="${key}"><span>Add prints &amp; extras</span><span aria-hidden="true">↓</span></a>` : ""}
        <button class="more-toggle" type="button" aria-expanded="false" aria-controls="${panel}"><span>See everything included</span><span class="chev" aria-hidden="true"></span></button>
      </div>
    </div>
  </article>`;
}

function renderTiers(cfg){
  const mount = el(cfg.mount || "#tiers");
  cfg.panelPrefix = cfg.panelPrefix || "more";
  mount.innerHTML = Object.entries(cfg.packages).map(([k,p]) => tierCard(k, p, cfg)).join("");
  /* Delegated, so a page that re-renders its cards (portraits swaps
     Personal/Family) doesn't have to re-bind anything. */
  if (!mount.dataset.wired){
    mount.dataset.wired = "1";
    mount.addEventListener("click", e => {
      const b = e.target.closest(".more-toggle");
      if (!b) return;
      const panel = document.getElementById(b.getAttribute("aria-controls"));
      const open = b.getAttribute("aria-expanded") === "true";
      b.setAttribute("aria-expanded", String(!open));
      panel.inert = open;
      b.firstElementChild.textContent = open ? "See everything included" : "Show less";
    });
  }
}

/* ---------- Add-on builder ---------- */

function rowHtml(i){
  let control;
  if (i.type === "qty"){
    control = `<div class="stepper"><button type="button" data-dec="${i.id}" aria-label="Remove one ${i.name.toLowerCase()}">−</button><output id="q-${i.id}" aria-label="${i.name} quantity">0</output><button type="button" data-inc="${i.id}" aria-label="Add one ${i.name.toLowerCase()}">+</button></div>`;
  } else if (i.type === "toggle"){
    control = `<button type="button" class="switch" role="switch" aria-checked="false" data-sw="${i.id}" aria-label="Add ${i.name.toLowerCase()}"></button><span class="included" data-inc-tag="${i.id}" hidden>Included</span>`;
  } else {
    control = `<span class="tag-muted">Ask to add</span>`;
  }
  return `<div class="row${i.type === "info" ? " row-info" : ""}" data-row="${i.id}">
    <div class="row-text"><h4>${i.name}</h4><p>${i.note}<span class="row-flag" data-flag="${i.id}" hidden></span></p></div>
    <div class="row-side"><span class="row-price">${naira(i.price)}</span>${control}</div></div>`;
}

function initBuilder(cfg){
  const items = cfg.addons.flatMap(g => g.items);
  const priced = items.filter(i => i.type !== "info");
  const state = {pkg: cfg.defaultPkg, sel: Object.fromEntries(priced.map(i => [i.id, 0]))};

  /* Browsers restore radio state on soft reload — trust the DOM over the default. */
  const restored = document.querySelector('input[name="pkg"]:checked');
  if (restored && cfg.packages[restored.value]) state.pkg = restored.value;

  document.getElementById("groups").innerHTML = cfg.addons.map(g =>
    `<div class="group"><h3 class="group-title">${g.group}</h3>${g.items.map(rowHtml).join("")}</div>`).join("");

  document.getElementById("groups").addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    const max = id => (items.find(i => i.id === id) || {}).max || 5;
    if (t.dataset.inc) state.sel[t.dataset.inc] = Math.min(max(t.dataset.inc), state.sel[t.dataset.inc] + 1);
    if (t.dataset.dec) state.sel[t.dataset.dec] = Math.max(0, state.sel[t.dataset.dec] - 1);
    if (t.dataset.sw)  state.sel[t.dataset.sw]  = state.sel[t.dataset.sw] ? 0 : 1;
    render();
  });

  document.querySelectorAll('input[name="pkg"]').forEach(r =>
    r.addEventListener("change", () => { state.pkg = r.value; render(); }));

  /* "Add prints & extras" on a tier card jumps here and selects that package. */
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-build]"); if (!a) return;
    const radio = document.getElementById("pk-" + a.dataset.build);
    if (radio){ radio.checked = true; state.pkg = a.dataset.build; render(); }
  });

  const sum = document.getElementById("summary"), tog = document.getElementById("sumToggle");
  tog.addEventListener("click", () => {
    const open = sum.classList.toggle("open");
    tog.setAttribute("aria-expanded", String(open));
    tog.firstElementChild.textContent = open ? "Hide breakdown" : "Show breakdown";
  });

  let shownTotal = cfg.packages[state.pkg].price, raf;
  function animateTo(target){
    const node = document.getElementById("sumTotal");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches){ shownTotal = target; node.textContent = naira(target); return; }
    cancelAnimationFrame(raf);
    const from = shownTotal, t0 = performance.now();
    const tick = now => {
      const q = Math.min(1, (now - t0) / 420), e = 1 - Math.pow(1 - q, 3);
      shownTotal = Math.round(from + (target - from) * e);
      node.textContent = naira(Math.round(shownTotal / 1000) * 1000);
      if (q < 1) raf = requestAnimationFrame(tick); else { shownTotal = target; node.textContent = naira(target); }
    };
    raf = requestAnimationFrame(tick);
  }

  function render(){
    const p = cfg.packages[state.pkg];
    const lines = [];
    let total = p.price;

    items.forEach(i => {
      const row = document.querySelector(`[data-row="${i.id}"]`);
      const flag = row.querySelector("[data-flag]");
      const included = i.includedIn === state.pkg;

      let note = "";
      if (included && i.includedNote) note = i.includedNote;
      else if (i.noteWhen && i.noteWhen.pkg === state.pkg) note = i.noteWhen.text;
      flag.hidden = !note;
      flag.textContent = note ? " " + note : "";

      if (i.type === "info") return;           // shown for reference, never priced

      if (included) state.sel[i.id] = 0;
      row.classList.toggle("is-included", included);

      if (i.type === "qty"){
        document.getElementById("q-" + i.id).textContent = state.sel[i.id];
        row.querySelector("[data-dec]").disabled = state.sel[i.id] === 0;
        row.querySelector("[data-inc]").disabled = state.sel[i.id] === (i.max || 5);
      } else {
        const sw = row.querySelector("[data-sw]");
        sw.hidden = included;
        row.querySelector("[data-inc-tag]").hidden = !included;
        sw.setAttribute("aria-checked", String(!!state.sel[i.id]));
      }

      if (state.sel[i.id]){
        const cost = i.price * state.sel[i.id];
        total += cost;
        lines.push([(i.type === "qty" ? state.sel[i.id] + " × " : "") + i.name, cost]);
      }
    });

    document.getElementById("sumLines").innerHTML =
      `<li class="pkg"><span>${p.name}</span><span>${naira(p.price)}</span></li>` +
      (lines.length ? lines.map(([n,c]) => `<li><span>+ ${n}</span><span>${naira(c)}</span></li>`).join("")
                    : `<li class="sum-empty"><span>No add-ons yet</span></li>`);

    const dep = Math.round(total * 0.8);
    document.getElementById("sumDeposit").textContent = naira(dep);
    document.getElementById("sumBalance").textContent = naira(total - dep);
    animateTo(total);

    /* Announce the settled figure once, not on every animation frame. */
    document.getElementById("sumAnnounce").textContent =
      `${p.name}. Estimated total ${naira(total)}. Deposit ${naira(dep)}.`;

    document.getElementById("sendQuote").href =
      "https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent(cfg.quote({p, lines, total, dep, balance: total - dep}));
  }

  render();
}

global.Lumiere = {naira, renderTiers, initBuilder};
})(window);
