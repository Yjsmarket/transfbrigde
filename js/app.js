(() => {
  /* ---------- Instellingen: komen uit js/config.js (later uit het beheerdersdashboard) ---------- */
  const { NL_PRICE, SR_PRICE, NL_RUSH, RUSH_HOURS, MAX_PAX, MAX_BAGS, TZ, WA_NUMBER } = window.TB_CONFIG;
  const waUrl = t => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(t)}`;

  const LEG = {
    "nl-to":   { country: "NL", title: "Naar Schiphol",  from: "Ophaaladres", to: "Schiphol", fields: ["city", "addr", "date", "time"] },
    "nl-from": { country: "NL", title: "Van Schiphol",   from: "Schiphol", to: "Afleveradres", fields: ["flight", "date", "time", "city", "addr"] },
    "sr-from": { country: "SR", title: "Van Zanderij",   from: "Zanderij", to: "Bestemming", fields: ["flight", "date", "addr"] },
    "sr-to":   { country: "SR", title: "Naar Zanderij",  from: "Ophaaladres", to: "Zanderij", fields: ["addr", "date", "time"] }
  };
  const DIRS = {
    nl: [["to", "Naar Schiphol"], ["from", "Van Schiphol"]],
    sr: [["from", "Van Zanderij"], ["to", "Naar Zanderij"]],
    combi: [["out", "Naar Suriname"], ["home", "Naar Nederland"]]
  };

  const pad = n => String(n).padStart(2, "0");
  const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const inDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return isoDay(d); };
  const state = {
    step: 0, type: "nl", dir: "to", trip: "enkel",
    pax: 2, bag: 2, hand: 2,
    legs: { "nl-to": { city: "Amsterdam", addr: "", date: inDays(14), time: "06:30" } },
    done: null
  };

  function legKinds() {
    const r = state.trip === "retour";
    if (state.type === "nl") return state.dir === "to" ? ["nl-to", ...(r ? ["nl-from"] : [])] : ["nl-from", ...(r ? ["nl-to"] : [])];
    if (state.type === "sr") return state.dir === "from" ? ["sr-from", ...(r ? ["sr-to"] : [])] : ["sr-to", ...(r ? ["sr-from"] : [])];
    return state.dir === "out" ? ["nl-to", "sr-from", ...(r ? ["sr-to", "nl-from"] : [])] : ["sr-to", "nl-from", ...(r ? ["nl-to", "sr-from"] : [])];
  }
  const legData = k => (state.legs[k] ||= { city: "Amsterdam", addr: "", date: "", time: "", flight: "" });

  /* ---------- Tijdzones ---------- */
  function tzOffset(ts, tz) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ts)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ts;
  }
  function zonedToUtc(date, time, tz) {
    const [y, m, d] = date.split("-").map(Number); const [hh, mm] = (time || "00:00").split(":").map(Number);
    const guess = Date.UTC(y, m - 1, d, hh, mm);
    let utc = guess - tzOffset(guess, tz);
    const off2 = tzOffset(utc, tz); if (guess - off2 !== utc) utc = guess - off2;
    return utc;
  }
  const legUtc = k => { const L = legData(k); return L.date ? zonedToUtc(L.date, LEG[k].fields.includes("time") ? L.time : "00:00", TZ[LEG[k].country]) : null; };

  /* ---------- Voertuig en prijs ---------- */
  const vehicle = () => state.pax > MAX_PAX || state.bag > MAX_BAGS ? "aanvraag" : state.pax >= 5 || state.bag > 2 ? "bus" : "auto";
  function priced() {
    const veh = vehicle(), now = Date.now();
    return legKinds().map((k, i) => {
      const def = LEG[k], L = legData(k), t = legUtc(k);
      const rush = t !== null && t - now < RUSH_HOURS * 3600e3;
      let price = null, why = "";
      if (veh === "aanvraag") why = "maatwerk";
      else if (def.country === "NL") { if (L.city === "Amsterdam") price = NL_PRICE[veh]; else why = "andere plaats"; }
      else if (SR_PRICE) price = SR_PRICE[veh];
      else why = "prijs volgt";
      const fee = rush && price !== null && def.country === "NL" ? Math.round(price * NL_RUSH * 100) / 100 : 0;
      return { k, i, def, L, rush, price, fee, why };
    });
  }
  const eur = n => "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const fmtDay = s => s ? new Date(s + "T12:00").toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }) : "datum nog kiezen";
  function mode(P) {
    if (P.some(p => p.price === null)) return "aanvraag";
    if (P.some(p => p.rush)) return "spoed";
    return "betaal";
  }

  /* ---------- Stap 1 ---------- */
  const $ = s => document.querySelector(s);
  function renderTrip() {
    document.querySelectorAll("#segType button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.type === state.type)));
    $("#segDir").innerHTML = DIRS[state.type].map(([v, t]) => `<button type="button" data-dir="${v}" aria-pressed="${v === state.dir}">${t}</button>`).join("");
    document.querySelectorAll("#segTrip button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.trip === state.trip)));
    const n = legKinds().length;
    $("#tripNote span").textContent = `Je boeking krijgt ${n} ${n === 1 ? "rit" : "ritten"}: ${legKinds().map(k => LEG[k].title.replace(/^\w/, c => c.toLowerCase())).join(", ")}.`;
  }
  $("#segType").addEventListener("click", e => { const b = e.target.closest("[data-type]"); if (!b) return; setType(b.dataset.type); });
  $("#segDir").addEventListener("click", e => { const b = e.target.closest("[data-dir]"); if (!b) return; state.dir = b.dataset.dir; render(); });
  $("#segTrip").addEventListener("click", e => { const b = e.target.closest("[data-trip]"); if (!b) return; state.trip = b.dataset.trip; render(); });
  function setType(t) { state.type = t; state.dir = DIRS[t][0][0]; render(); }

  /* ---------- Stap 2: ritten ---------- */
  const FIELD = {
    city: (k, L) => `<div class="f"><label for="${k}-city">Plaats</label><select id="${k}-city" data-f="city"><option ${L.city === "Amsterdam" ? "selected" : ""}>Amsterdam</option><option value="Anders" ${L.city === "Anders" ? "selected" : ""}>Andere plaats (prijs op maat)</option></select><span class="f__err"></span></div>`,
    addr: (k, L) => `<div class="f ${LEG[k].fields.length > 3 ? "" : "f--full"}"><label for="${k}-addr">${LEG[k].country === "SR" && k === "sr-from" ? "Bestemming in Suriname" : k === "nl-from" ? "Afleveradres" : "Ophaaladres"}</label><input id="${k}-addr" data-f="addr" value="${L.addr}" autocomplete="street-address" placeholder="${LEG[k].country === "SR" ? "Straat, wijk, district" : "Straat en huisnummer"}"><span class="f__err"></span></div>`,
    flight: (k, L) => `<div class="f"><label for="${k}-flight">Vluchtnummer</label><input id="${k}-flight" data-f="flight" value="${L.flight || ""}" placeholder="Bijv. KL 713" autocapitalize="characters"><span class="f__err"></span></div>`,
    date: (k, L) => `<div class="f"><label for="${k}-date">${LEG[k].fields.includes("flight") ? "Aankomstdatum" : "Datum"}</label><input id="${k}-date" data-f="date" type="date" value="${L.date}" min="${isoDay(new Date())}"><span class="f__err"></span></div>`,
    time: (k, L) => `<div class="f"><label for="${k}-time">${k === "nl-from" ? "Gewenste ophaaltijd" : "Ophaaltijd"}</label><input id="${k}-time" data-f="time" type="time" value="${L.time}"><span class="f__err"></span></div>`
  };
  function renderLegs() {
    $("#legs").innerHTML = legKinds().map((k, i) => {
      const def = LEG[k], L = legData(k);
      const note = k === "sr-from" ? `<div class="note"><svg aria-hidden="true"><use href="#plane"/></svg><span>Je kiest hier geen tijd. Je chauffeur volgt je vlucht en wacht ongeveer 60 minuten na de landing op je.</span></div>` : "";
      return `<div class="leg" data-leg="${k}"><div class="leg__head"><span class="leg__n">RIT ${i + 1}</span><h4>${def.title}</h4><span class="leg__flag">${def.country === "NL" ? "NEDERLAND · NL-TIJD" : "SURINAME · SR-TIJD"}</span></div>
        <div class="grid2">${def.fields.map(f => FIELD[f](k, L)).join("")}</div>${note}</div>`;
    }).join("");
  }
  $("#legs").addEventListener("input", e => { const f = e.target.dataset.f; if (!f) return; const k = e.target.closest("[data-leg]").dataset.leg; legData(k)[f] = e.target.value; e.target.closest(".f").classList.remove("is-err"); e.target.closest(".f").querySelector(".f__err").textContent = ""; renderSum(); });
  $("#legs").addEventListener("change", e => { if (e.target.dataset.f === "city") { legData(e.target.closest("[data-leg]").dataset.leg).city = e.target.value; renderSum(); } });

  function validateLegs() {
    let ok = true, prev = null;
    const err = (k, f, msg) => { const el = document.getElementById(`${k}-${f}`); if (!el) return; el.closest(".f").classList.add("is-err"); el.closest(".f").querySelector(".f__err").textContent = msg; ok = false; };
    for (const k of legKinds()) {
      const L = legData(k), def = LEG[k];
      if (def.fields.includes("addr") && !L.addr.trim()) err(k, "addr", "Vul een adres in.");
      if (def.fields.includes("flight") && !/^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/i.test((L.flight || "").trim())) err(k, "flight", "Vul een vluchtnummer in, zoals KL 713.");
      if (!L.date) err(k, "date", "Kies een datum.");
      if (def.fields.includes("time") && !L.time) err(k, "time", "Kies een tijd.");
      const t = legUtc(k);
      if (t !== null && def.fields.includes("time") && L.time && t < Date.now()) err(k, "time", "Deze tijd is al voorbij.");
      if (t !== null && prev !== null && L.date && t < prev.t - 36 * 3600e3) err(k, "date", `Deze rit ligt vóór rit ${prev.i + 1}. Controleer de volgorde.`);
      if (t !== null) prev = { t, i: legKinds().indexOf(k) };
    }
    return ok;
  }

  /* ---------- Stap 3: bagage ---------- */
  document.querySelector('[data-step="2"]').addEventListener("click", e => {
    const b = e.target.closest("[data-c]"); if (!b) return;
    state[b.dataset.c] = Math.max(b.dataset.c === "pax" ? 1 : 0, Math.min(12, state[b.dataset.c] + Number(b.dataset.d)));
    render();
  });
  function renderVeh() {
    ["pax", "bag", "hand"].forEach(c => $("#c-" + c).textContent = state[c]);
    const v = vehicle();
    $("#veh").innerHTML = v === "aanvraag"
      ? `<span class="veh__ico"><svg aria-hidden="true"><use href="#bus"/></svg></span><span><strong>Groepsvervoer op maat</strong><span>Zoveel mensen of koffers passen niet in onze standaardbus. Je krijgt een prijs op maat.</span></span>`
      : `<span class="veh__ico"><svg aria-hidden="true"><use href="#${v}"/></svg></span><span><strong>Wij sturen een ${v}</strong><span>${v === "auto" ? "Past bij maximaal 4 personen en 2 grote koffers." : state.pax >= 5 ? "Je bent met 5 of meer personen." : "Je hebt meer dan 2 grote koffers."}</span></span>`;
  }

  /* ---------- Samenvatting ---------- */
  function renderSum() {
    const P = priced(), m = mode(P), v = vehicle();
    $("#sumLegs").innerHTML = P.map(p => `<li><b>RIT ${p.i + 1}</b><span>${p.def.title}<small>${fmtDay(p.L.date)}${p.def.fields.includes("time") && p.L.time ? " · " + p.L.time : p.k === "sr-from" ? " · op je landingstijd" : ""}</small></span>${p.price === null ? `<em class="q">op maat</em>` : `<em>${eur(p.price)}</em>`}</li>${p.fee ? `<li><b></b><span>Spoedtoeslag 15%<small>alleen op deze Nederlandse rit</small></span><em>${eur(p.fee)}</em></li>` : ""}`).join("");
    $("#sumVeh").textContent = v === "aanvraag" ? "Groepsvervoer op maat" : `${v === "auto" ? "Auto" : "Bus"} · ${state.pax} ${state.pax === 1 ? "persoon" : "personen"} · ${state.bag} ${state.bag === 1 ? "koffer" : "koffers"}`;
    const total = P.reduce((s, p) => s + (p.price || 0) + p.fee, 0);
    const partial = P.some(p => p.price === null);
    $("#sumTotalLabel").textContent = partial ? (total ? "Bekend deel" : "Totaal") : "Totaal";
    $("#sumTotal").textContent = partial && !total ? "Op maat" : eur(total);
    $("#sumMode").innerHTML = m === "betaal" ? "<b>Prijs bekend.</b> Verstuur je reis via WhatsApp. Je krijgt je betaallink van ons in WhatsApp."
      : m === "spoed" ? `<b>Spoedaanvraag.</b> Je rit is binnen ${RUSH_HOURS} uur. We kijken eerst of er een chauffeur vrij is. Daarna krijg je een betaallink in WhatsApp, 30 minuten geldig.`
      : "<b>Prijs op maat.</b> Voor een deel van je reis maken we de prijs persoonlijk. Je krijgt de prijs en je betaallink in WhatsApp.";
    const ms = $("#modeNote");
    ms.className = "note " + (m === "betaal" ? "note--ok" : "note--warn");
    ms.querySelector("span").innerHTML = $("#sumMode").innerHTML;
    $("#next").hidden = state.step === 3 || !!state.done;
    $("#sendWa").hidden = state.step !== 3 || !!state.done;
    $("#mTotal").textContent = $("#sumTotal").textContent;
    $("#mLabel").textContent = `Jouw boeking · ${P.length} ${P.length === 1 ? "rit" : "ritten"}`;
  }

  /* ---------- Stappen ---------- */
  function showStep(n) {
    state.step = n;
    document.querySelectorAll("[data-step]").forEach(c => c.hidden = Number(c.dataset.step) !== n || !!state.done);
    document.querySelectorAll(".steps button").forEach((b, i) => { b.toggleAttribute("aria-current", false); if (i === n) b.setAttribute("aria-current", "step"); b.classList.toggle("is-done", i < n); });
    $("#prev").style.visibility = n === 0 ? "hidden" : "";
    renderSum();
  }
  function validateContact() {
    let ok = true;
    const chk = (id, test, msg) => { const el = $(id), f = el.closest(".f"); const bad = !test(el.value.trim()); f.classList.toggle("is-err", bad); f.querySelector(".f__err").textContent = bad ? msg : ""; if (bad) ok = false; };
    chk("#c-name", v => v.length > 1, "Vul je naam in.");
    chk("#c-mail", v => /^\S+@\S+\.\S+$/.test(v), "Vul een geldig e-mailadres in.");
    chk("#c-tel", v => v.replace(/\D/g, "").length >= 9, "Vul je telefoonnummer in, met landcode.");
    const t = $("#c-terms").checked; $("#termsErr").textContent = t ? "" : "Ga akkoord met de voorwaarden om verder te gaan."; if (!t) ok = false;
    return ok;
  }
  $("#next").addEventListener("click", () => {
    if (state.step === 1 && !validateLegs()) { document.querySelector(".f.is-err input, .f.is-err select")?.focus(); return; }
    if (state.step < 3) { showStep(state.step + 1); document.getElementById("boeken").scrollIntoView({ block: "start" }); }
  });
  /* De link wordt pas bij de klik gevuld, na de controle; de browser opent daarna de bijgewerkte href */
  $("#sendWa").addEventListener("click", e => {
    if (!validateContact()) { e.preventDefault(); return; }
    $("#sendWa").href = waUrl(message());
    setTimeout(finish, 50);
  });
  function message() {
    const P = priced(), v = vehicle(), val = id => $(id).value.trim();
    const lines = ["Hoi TransferBridge, ik wil graag een rit boeken.", ""];
    for (const p of P) {
      const L = p.L, f = p.def.fields;
      lines.push(`Rit ${p.i + 1}: ${p.def.title} (${p.def.country === "NL" ? "Nederland" : "Suriname"})`);
      if (f.includes("flight")) lines.push(`- Vlucht: ${L.flight.toUpperCase()}, aankomst ${fmtDay(L.date)}`);
      else lines.push(`- Datum: ${fmtDay(L.date)}`);
      if (f.includes("time")) lines.push(`- ${p.k === "nl-from" ? "Gewenste ophaaltijd" : "Ophaaltijd"}: ${L.time} (${p.def.country === "NL" ? "NL-tijd" : "SR-tijd"})`);
      const where = `${L.addr}${p.def.country === "NL" ? ", " + (L.city === "Amsterdam" ? "Amsterdam" : "andere plaats") : ""}`;
      lines.push(p.k.endsWith("-to") ? `- Van: ${where}` : `- Naar: ${where}`);
      lines.push(`- Prijs: ${p.price === null ? "graag een prijs op maat" : eur(p.price)}${p.fee ? ` + spoedtoeslag ${eur(p.fee)}` : ""}`);
      lines.push("");
    }
    lines.push(`Passagiers: ${state.pax} · grote koffers: ${state.bag} · handbagage: ${state.hand}`);
    lines.push(`Vervoer: ${v === "aanvraag" ? "groepsvervoer op maat" : v}`);
    if (P.some(p => p.rush)) lines.push("Let op: spoedaanvraag, binnen 12 uur. Kunnen jullie eerst checken of er een chauffeur vrij is?");
    lines.push("", `Naam: ${val("#c-name")}`, `E-mail: ${val("#c-mail")}`, `Telefoon: ${val("#c-tel")}`);
    if (val("#c-note")) lines.push(`Opmerkingen: ${val("#c-note")}`);
    lines.push("", "Graag ontvang ik de betaallink.");
    return lines.join("\n");
  }
  $("#prev").addEventListener("click", () => showStep(Math.max(0, state.step - 1)));
  document.querySelector(".steps").addEventListener("click", e => {
    const b = e.target.closest("[data-go]"); if (!b) return;
    const to = Number(b.dataset.go);
    if (to > 1 && state.step <= 1 && !validateLegs()) { showStep(1); return; }
    showStep(to);
  });

  function finish() {
    const m = mode(priced());
    state.done = m;
    const steps = [
      ["on", "Je bericht staat klaar in WhatsApp", "Druk daar op verzenden. Dan komt je aanvraag bij ons binnen."],
      ["now", m === "spoed" ? "Wij zoeken een chauffeur" : m === "aanvraag" ? "Je krijgt een prijs op maat" : "Wij checken je rit", m === "spoed" ? "Is er een vrij? Dan krijg je een betaallink, 30 minuten geldig." : "Daarna sturen we je een betaallink in WhatsApp."],
      ["", "Betalen en klaar", "Na je betaling staat je rit vast en krijg je je boekingsnummer."],
      ["", "Gegevens van je chauffeur", "24 uur voor vertrek krijg je zijn naam en nummer."]
    ];
    $("#doneCard").innerHTML = `<div class="done"><h3>Bijna klaar. Verstuur je bericht in WhatsApp.</h3>
      <p class="card__hint" style="margin:0">Opent WhatsApp niet? App ons dan op <b>${WA_NUMBER ? "+" + WA_NUMBER : '<span class="todo">[nummer]</span>'}</b>.</p>
      <ol class="track">${steps.map(([s, t, d]) => `<li class="${s === "on" ? "is-on" : s === "now" ? "is-now" : ""}"><i aria-hidden="true"></i><span><strong>${t}</strong><span>${d}</span></span></li>`).join("")}</ol>
      <button type="button" class="btn btn--ghost" id="again">Nog een rit boeken</button></div>`;
    $("#doneCard").hidden = false; $("#navSteps").hidden = true; document.querySelector(".steps").hidden = true;
    document.querySelectorAll("[data-step]").forEach(c => c.hidden = true);
    $("#again").addEventListener("click", () => { state.done = null; $("#doneCard").hidden = true; $("#navSteps").hidden = false; document.querySelector(".steps").hidden = false; showStep(0); });
  }

  function render() { renderTrip(); renderLegs(); renderVeh(); renderSum(); }

  /* ---------- Keuzelijst + paneel ---------- */
  const PANEL = {
    nl: { t: "Van huis naar Schiphol, of terug", p: "Je chauffeur haalt je op op de tijd die jij kiest. Kom je aan op Schiphol? Geef je vluchtnummer door, dan staan we klaar.", legs: [["RIT", "Thuis → Schiphol"], ["RIT", "Schiphol → thuis"]], price: `<div><small>Amsterdam ↔ Schiphol, auto</small><strong>€55</strong></div><div><small>Amsterdam ↔ Schiphol, bus</small><strong>€65</strong></div>` },
    sr: { t: "Van Zanderij naar je bestemming", p: "Familie, hotel of eigen huis. Je chauffeur volgt je vlucht, dus je hoeft geen tijd te kiezen. Voor de terugweg kies je zelf hoe laat we je ophalen.", legs: [["RIT", "Zanderij → bestemming"], ["RIT", "Bestemming → Zanderij"]], price: `<div><small>Prijs per rit in Suriname</small><strong><span class="todo">[prijs SR]</span></strong></div>` },
    combi: { t: "Nederland en Suriname in één boeking", p: "Van je voordeur hier tot je bestemming daar. Retour zijn dat maximaal vier ritten, met één boekingsnummer en één betaling.", legs: [["RIT 1", "Thuis → Schiphol"], ["RIT 2", "Zanderij → bestemming"], ["RIT 3", "Bestemming → Zanderij"], ["RIT 4", "Schiphol → thuis"]], price: `<div><small>Je betaalt per rit</small><strong>1 boeking</strong></div>` }
  };
  function renderPanel(key) {
    const d = PANEL[key];
    document.querySelectorAll(".pick__opt").forEach(b => b.setAttribute("aria-selected", String(b.dataset.pick === key)));
    $("#pickPanel").setAttribute("aria-labelledby", "tab-" + key);
    $("#pickPanel").innerHTML = `<div class="panel__fade" style="display:grid;gap:22px"><span class="label">${key === "nl" ? "Nederland" : key === "sr" ? "Suriname" : "Allebei"}</span><h3>${d.t}</h3><p>${d.p}</p>
      <ul class="panel__legs">${d.legs.map(([n, t]) => `<li><b>${n}</b>${t}</li>`).join("")}</ul>
      <div class="panel__price">${d.price}</div>
      <a class="btn btn--orange" href="#boeken" data-book="${key}">Boek deze rit <span class="btn__dot"><svg aria-hidden="true"><use href="#arrow"/></svg></span></a></div>`;
  }
  $("#pickList").addEventListener("click", e => { const b = e.target.closest("[data-pick]"); if (b) renderPanel(b.dataset.pick); });
  $("#pickList").addEventListener("keydown", e => {
    if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
    const tabs = [...document.querySelectorAll(".pick__opt")], i = tabs.indexOf(document.activeElement);
    const n = tabs[(i + (e.key === "ArrowDown" ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); renderPanel(n.dataset.pick); e.preventDefault();
  });
  $("#pickPanel").addEventListener("click", e => { const b = e.target.closest("[data-book]"); if (b) { setType(b.dataset.book); showStep(0); } });

  /* ---------- Tijdlijn licht op bij scrollen ---------- */
  const items = [...document.querySelectorAll("#tl li")];
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) en.target.classList.add("is-lit"); }), { rootMargin: "0px 0px -40% 0px" });
  items.forEach(li => io.observe(li));
  const fill = () => {
    const tl = $("#tl"), r = tl.getBoundingClientRect(), mid = innerHeight * 0.6;
    tl.style.setProperty("--fill", Math.max(0, Math.min(r.height - 16, mid - r.top)) + "px");
  };
  addEventListener("scroll", fill, { passive: true }); fill();

  /* ---------- Mobiele balk ---------- */
  const mbar = $("#mbar"); let inBook = false, sumSeen = false;
  new IntersectionObserver(([en]) => { inBook = en.isIntersecting; mbar.classList.toggle("is-hidden", !inBook || sumSeen); }).observe($("#boeken"));
  new IntersectionObserver(([en]) => { sumSeen = en.isIntersecting; mbar.classList.toggle("is-hidden", !inBook || sumSeen); }).observe($("#sum"));

  /* ---------- Losse WhatsApp-knoppen ---------- */
  document.querySelectorAll("[data-wa]").forEach(a => {
    if (WA_NUMBER) { a.href = waUrl(a.dataset.wa); a.target = "_blank"; a.rel = "noopener"; a.querySelector(".todo")?.remove(); }
  });

  renderPanel("nl");
  render(); showStep(0);
})();
