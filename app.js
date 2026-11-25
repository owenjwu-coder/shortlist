/* ============================================================
   app.js: how the site works.
   Sections, top to bottom:
     storage        saves each visitor's list in their browser
     data           plan names, testing labels, Common App prompts
     dates          countdown math ("12 days")
     views          viewList, viewDeadlines, viewCompare,
                    viewEssays, viewBrowse, viewSchool
     router         which view shows for each #tab in the address
     events         clicks, typing, dropdowns
     search         the "Add a school" box
     boot           loads schools.json and draws the page
   School facts (deadlines, prompts, stats) are NOT in here;
   they're in schools.json.
   ============================================================ */
(() => {
  "use strict";

  /* ---------- storage (per-viewer convenience only) ---------- */
  const KEY = "shortlist.v1";
  const EXAMPLE = ["stanford", "northwestern", "umich", "ucla", "tufts", "uwmadison", "pomona"];
  function loadState() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; }
    if (!s || !Array.isArray(s.list)) s = { list: EXAMPLE.slice(), example: true, status: {}, essays: {}, scores: {}, showPassed: false };
    s.status = s.status || {}; s.essays = s.essays || {}; s.scores = s.scores || {};
    return s;
  }
  const state = loadState();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ } }

  /* ---------- data ---------- */
  let META = {}, SCHOOLS = [], BY = {};
  const PLAN = {
    "ED": ["Early Decision", true], "ED II": ["Early Decision II", true],
    "EA": ["Early Action", false], "EA (GA)": ["Early Action, Georgia residents", false],
    "REA": ["Restrictive Early Action", false], "SCEA": ["Single-Choice Early Action", false],
    "RD": ["Regular Decision", false], "UC": ["UC Application deadline", false], "Regular": ["Application deadline", false]
  };
  const TEST = { required: "Test required", optional: "Test-optional", blind: "Test-blind", check: "Policy changing" };
  const STATUS = ["Researching", "Planning to apply", "Application in progress", "Submitted"];
  const ESSAY_STATES = ["todo", "drafting", "done"];
  const ESSAY_LABEL = { todo: "Not started", drafting: "Drafting", done: "Done" };
  const COMMON_APP = [
    "A background, identity, interest or talent so meaningful your application would be incomplete without it.",
    "A challenge, setback or failure: how it affected you and what you learned.",
    "A time you questioned or challenged a belief or idea, and what came of it.",
    "Something someone did for you that made you thankful in a surprising way.",
    "An accomplishment, event or realization that sparked personal growth.",
    "A topic, idea or concept so engaging that you lose track of time.",
    "An essay on any topic of your choice."
  ];

  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => n == null ? "—" : n.toLocaleString("en-US");

  /* ---------- dates ---------- */
  const today = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const daysUntil = (s) => Math.round((parseDate(s) - today) / 86400000);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const shortDate = (s) => { const d = parseDate(s); return MONTHS[d.getMonth()] + " " + d.getDate(); };
  function leftText(n) {
    if (n < 0) return "passed";
    if (n === 0) return "today";
    if (n === 1) return "tomorrow";
    return n + " days";
  }
  const deadlineClass = (n) => n < 0 ? "passed" : n <= 14 ? "soon" : "upcoming";

  /* ---------- derived ---------- */
  function rankLabel(s) {
    const tie = SCHOOLS.filter((x) => x.cat === s.cat && x.rank === s.rank).length > 1;
    return "#" + (tie ? "T" : "") + s.rank + " " + (s.cat === "Liberal Arts College" ? "Liberal Arts" : "National");
  }
  function stats(s) {
    const r = (META.stats || {})[s.id];
    if (!r) return null;
    const [apps, rate, sat, act] = r;
    return { apps, rate, admitted: Math.round(apps * rate / 100), sat, act };
  }
  function nextDeadline(s) {
    const up = s.plans.map(([code, date]) => ({ code, date, n: daysUntil(date) })).filter((p) => p.n >= 0).sort((a, b) => a.n - b.n);
    return up[0] || null;
  }
  function lastDeadline(s) { return s.plans.map((p) => p[1]).sort().slice(-1)[0]; }
  function scoreFit(score, range) {
    if (!score || !range) return null;
    if (score < range[0]) return "below";
    if (score > range[1]) return "above";
    return "within";
  }
  const fitText = { below: "Below middle 50%", within: "Within middle 50%", above: "Above middle 50%" };
  const listSchools = () => state.list.map((id) => BY[id]).filter(Boolean);
  const essayKey = (id, i) => id + ":" + i;
  const essayItems = () => {
    const items = [];
    const schools = listSchools();
    if (schools.some((s) => s.apps.includes("Common App"))) items.push({ key: "commonapp:0" });
    if (schools.some((s) => s.apps.includes("UC Application"))) items.push({ key: "ucpiq:0" });
    schools.forEach((s) => { if (s.apps.includes("UC Application")) return; s.essays.forEach((e, i) => { if (e[1] !== 0 || !/^No supplement/.test(e[0])) items.push({ key: essayKey(s.id, i) }); }); });
    return items;
  };

  /* ---------- list mutations ---------- */
  function addSchool(id) {
    if (!BY[id]) return;
    if (state.example) { state.example = false; }
    if (!state.list.includes(id)) { state.list.push(id); toast("Added " + BY[id].short); }
    save(); render();
  }
  function removeSchool(id) {
    state.example = false;
    state.list = state.list.filter((x) => x !== id);
    save(); render(); toast("Removed " + (BY[id] ? BY[id].short : "school"));
  }
  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ---------- small renderers ---------- */
  const testPill = (s) => `<span class="pill ${s.test.p}" title="${esc(s.test.n)}">${TEST[s.test.p]}</span>`;
  function planPill(code, date) {
    const n = daysUntil(date);
    const [, binding] = PLAN[code] || [code, false];
    return `<span class="pill ${deadlineClass(n)} ${binding ? "binding" : ""}" title="${esc((PLAN[code] || [code])[0])}: ${shortDate(date)} (${leftText(n)})">${esc(code)} · ${shortDate(date)}</span>`;
  }
  function rangeBar(range, me, lo, hi) {
    if (!range) return `<span class="range-text">Not reported</span>`;
    const pct = (v) => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
    const meMark = me ? `<div class="me" style="left:${pct(me)}%" title="Your score: ${me}"></div>` : "";
    return `<div class="range" role="img" aria-label="Middle 50%: ${range[0]} to ${range[1]}${me ? "; your score " + me : ""}"><div class="axis"></div><div class="band" style="left:${pct(range[0])}%;width:${Math.max(2, pct(range[1]) - pct(range[0]))}%"></div>${meMark}</div>`;
  }

  /* ---------- views ---------- */
  function viewList() {
    const schools = listSchools();
    const sat = Number(state.scores.sat) || null, act = Number(state.scores.act) || null;
    const upcoming = schools.flatMap((s) => s.plans.map(([code, date]) => ({ s, code, date, n: daysUntil(date) }))).filter((d) => d.n >= 0).sort((a, b) => a.n - b.n);
    const nx = upcoming[0];
    const items = essayItems();
    const done = items.filter((i) => state.essays[i.key] === "done").length;
    const counts = { required: 0, optional: 0, blind: 0, check: 0 };
    schools.forEach((s) => counts[s.test.p]++);

    const notice = state.example ? `<div class="notice"><span><strong>This is an example list.</strong> Search above to add your own schools; the example clears as soon as you change it.</span><button class="btn small" data-action="clear-list">Start an empty list</button></div>` : "";

    const summary = `<div class="summary">
      <div><div class="label">Schools</div><div class="big num">${schools.length}</div><div class="sub">${schools.filter((s) => s.cat === "Liberal Arts College").length} liberal arts · ${schools.filter((s) => s.cat !== "Liberal Arts College").length} universities</div></div>
      <div><div class="label">Next deadline</div>${nx ? `<div class="big">${shortDate(nx.date)}</div><div class="sub">${esc(nx.s.short)} ${esc(nx.code)} · ${leftText(nx.n)}</div>` : `<div class="big">—</div><div class="sub">No upcoming deadlines</div>`}</div>
      <div><div class="label">Essays done</div><div class="big num">${done} / ${items.length}</div><div class="sub"><a href="#essays">Open the essay tracker</a></div></div>
      <div><div class="label">Testing</div><div class="big num">${counts.required} req.</div><div class="sub">${counts.optional} optional · ${counts.blind} blind${counts.check ? " · " + counts.check + " changing" : ""}</div></div>
    </div>`;

    const cards = schools.length ? schools.map((s) => {
      const st = stats(s);
      const nd = nextDeadline(s);
      const fitS = st && scoreFit(sat, st.sat), fitA = st && scoreFit(act, st.act);
      const fit = [fitS && `<span class="pill ${fitS}">SAT ${sat}: ${fitText[fitS]}</span>`, fitA && `<span class="pill ${fitA}">ACT ${act}: ${fitText[fitA]}</span>`].filter(Boolean).join(" ");
      const statusSel = `<select aria-label="Status for ${esc(s.short)}" data-action="status" data-id="${s.id}" id="status-${s.id}">${STATUS.map((o) => `<option ${state.status[s.id] === o ? "selected" : ""}>${o}</option>`).join("")}</select>`;
      return `<article class="card">
        <div class="card-head">
          <div><h3><a href="#school-${s.id}">${esc(s.name)}</a></h3>
            <div class="meta"><span>${esc(s.city)}, ${esc(s.state)}</span><span>${esc(s.type)}</span><span>${rankLabel(s)}</span><span class="num">≈${fmt(s.ug)} undergrads</span></div></div>
          <div class="card-actions">${statusSel}<button class="btn ghost small" data-action="remove" data-id="${s.id}" aria-label="Remove ${esc(s.short)}">Remove</button></div>
        </div>
        <div class="facts">
          <div class="fact"><div class="label">Admit rate</div><div class="v">${st ? st.rate.toFixed(1) + "%" : "—"}</div><div class="s num">${st ? fmt(st.apps) + " applied" : ""}</div></div>
          <div class="fact"><div class="label">SAT mid-50%</div><div class="v">${st && st.sat ? st.sat[0] + "–" + st.sat[1] : "—"}</div><div class="s">${st && st.sat ? "enrolled students" : s.test.p === "blind" ? "not considered" : "not reported"}</div></div>
          <div class="fact"><div class="label">ACT mid-50%</div><div class="v">${st && st.act ? st.act[0] + "–" + st.act[1] : "—"}</div><div class="s">${testPill(s)}</div></div>
          <div class="fact"><div class="label">Next deadline</div><div class="v">${nd ? shortDate(nd.date) : "All passed"}</div><div class="s">${nd ? esc(nd.code) + " · " + leftText(nd.n) : "last was " + shortDate(lastDeadline(s))}</div></div>
        </div>
        <div class="card-foot"><div class="plans">${s.plans.map(([c, d]) => planPill(c, d)).join("")}</div>${fit ? `<div class="plans">${fit}</div>` : `<a href="#school-${s.id}" class="btn small">Details</a>`}</div>
      </article>`;
    }).join("") : `<div class="empty-state"><h3>Your list is empty</h3><p>Type a school name in the search box, or <a href="#browse">browse all ${SCHOOLS.length} schools</a>.</p></div>`;

    const side = `<aside class="side">
      <div class="panel"><h3>Your scores</h3><p>Optional. Shows where you fall against each school's middle 50% of enrolled students.</p>
        <div class="score-inputs">
          <div class="field"><label for="score-sat">SAT total</label><input id="score-sat" type="number" inputmode="numeric" min="400" max="1600" step="10" placeholder="e.g. 1480" value="${esc(state.scores.sat || "")}" data-action="score" data-k="sat"></div>
          <div class="field"><label for="score-act">ACT composite</label><input id="score-act" type="number" inputmode="numeric" min="1" max="36" placeholder="e.g. 33" value="${esc(state.scores.act || "")}" data-action="score" data-k="act"></div>
        </div></div>
      <div class="panel"><h3>Deadline key</h3><div class="legend">
        <div><span class="pill soon">Within 14 days</span></div>
        <div><span class="pill upcoming">Upcoming</span></div>
        <div><span class="pill passed">Passed</span></div>
        <div><span class="pill upcoming binding">ED</span><span>Binding if admitted</span></div>
      </div></div>
      <div class="panel"><h3>Take it with you</h3><p>Copies your schools, deadlines and testing policies as plain text.</p><button class="btn" data-action="copy-list">Copy list as text</button></div>
    </aside>`;

    return `<div class="view-head"><div><h2>My list</h2><p>Deadlines, testing policy and admissions numbers for each school you're considering. Select a school name for its full file.</p></div><a class="btn" href="#browse">Browse all schools</a></div>
      ${notice}${summary}<div class="list-layout"><div class="cards">${cards}</div>${side}</div>`;
  }

  function viewDeadlines() {
    const schools = listSchools();
    const rows = schools.flatMap((s) => s.plans.map(([code, date]) => ({ s, code, date, n: daysUntil(date) }))).sort((a, b) => a.date.localeCompare(b.date) || a.s.short.localeCompare(b.s.short));
    const shown = state.showPassed ? rows : rows.filter((r) => r.n >= 0);
    const passedCount = rows.length - rows.filter((r) => r.n >= 0).length;
    const groups = {};
    shown.forEach((r) => { const d = parseDate(r.date); const k = d.getFullYear() + "-" + String(d.getMonth()).padStart(2, "0"); (groups[k] = groups[k] || []).push(r); });
    const body = !schools.length ? `<div class="empty-state"><h3>No schools yet</h3><p>Add schools to see their deadlines in one timeline.</p></div>`
      : !shown.length ? `<div class="empty-state"><h3>No upcoming deadlines</h3><p>Every deadline on your list has passed. Turn on “Show passed deadlines” to see them.</p></div>`
      : Object.keys(groups).sort().map((k) => {
        const rs = groups[k]; const d = parseDate(rs[0].date);
        return `<section class="month"><h3>${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()} <span class="label">${rs.length} deadline${rs.length > 1 ? "s" : ""}</span></h3><div class="log">${rs.map((r) => {
          const dd = parseDate(r.date); const [name, binding] = PLAN[r.code] || [r.code, false];
          return `<div class="log-row ${r.n < 0 ? "is-passed" : r.n <= 14 ? "is-soon" : ""}">
            <div class="datebox"><div class="d">${MONTHS[dd.getMonth()]} ${dd.getDate()}</div><div class="w">${DOW[dd.getDay()]}</div></div>
            <div><div class="who"><a href="#school-${r.s.id}">${esc(r.s.name)}</a></div><div class="what">${esc(name)}${binding ? " · binding" : ""} · ${esc(r.s.apps.join(" / "))}</div></div>
            <div class="left">${r.n < 0 ? "passed" : leftText(r.n)}</div></div>`;
        }).join("")}</div></section>`;
      }).join("");
    return `<div class="view-head"><div><h2>Deadlines</h2><p>Every application plan for the schools on your list, in date order. ${esc(META.deadlineNote || "")}</p></div>
      <div class="toolbar"><label class="toggle"><input type="checkbox" id="show-passed" data-action="toggle-passed" ${state.showPassed ? "checked" : ""}> Show passed deadlines (${passedCount})</label></div></div>${body}`;
  }

  let sortKey = "rate", sortDir = 1;
  function viewCompare() {
    const sat = Number(state.scores.sat) || null, act = Number(state.scores.act) || null;
    const rows = listSchools().map((s) => ({ s, st: stats(s) || {} }));
    const val = {
      name: (r) => r.s.short, rank: (r) => (r.s.cat === "Liberal Arts College" ? 1000 : 0) + r.s.rank,
      rate: (r) => r.st.rate ?? 999, apps: (r) => r.st.apps ?? 0, sat: (r) => r.st.sat ? r.st.sat[1] : -1, act: (r) => r.st.act ? r.st.act[1] : -1,
      test: (r) => r.s.test.p, early: (r) => (r.s.plans[0] || [, "9"])[1], ug: (r) => r.s.ug
    };
    rows.sort((a, b) => { const x = val[sortKey](a), y = val[sortKey](b); return (x > y ? 1 : x < y ? -1 : 0) * sortDir; });
    const maxRate = Math.max(50, ...rows.map((r) => r.st.rate || 0));
    const th = (k, label) => `<th scope="col"><button data-action="sort" data-k="${k}" aria-sort="${sortKey === k ? (sortDir > 0 ? "ascending" : "descending") : "none"}">${label}</button></th>`;
    const body = rows.map(({ s, st }) => {
      const early = s.plans.filter(([c]) => c !== "RD" && c !== "UC" && c !== "Regular");
      const final = s.plans.filter(([c]) => c === "RD" || c === "UC" || c === "Regular");
      return `<tr>
        <td><a class="school-link" href="#school-${s.id}">${esc(s.short)}</a><div class="range-text">${esc(s.state)} · ${esc(s.type)}</div></td>
        <td class="mono">${rankLabel(s).replace(" National", " Nat'l").replace(" Liberal Arts", " LAC")}</td>
        <td><div class="ratebar"><span class="num" style="min-width:44px">${st.rate != null ? st.rate.toFixed(1) + "%" : "—"}</span><div class="track"><div class="fill" style="width:${st.rate ? st.rate / maxRate * 100 : 0}%"></div></div></div></td>
        <td class="n">${fmt(st.apps)}</td><td class="n">${fmt(st.admitted)}</td>
        <td>${rangeBar(st.sat, sat, 1200, 1600)}<div class="range-text">${st.sat ? st.sat.join("–") : s.test.p === "blind" ? "Not considered" : ""}</div></td>
        <td class="mono">${st.act ? st.act.join("–") : "—"}</td>
        <td>${testPill(s)}</td>
        <td>${early.length ? early.map(([c, d]) => planPill(c, d)).join(" ") : `<span class="range-text">None</span>`}</td>
        <td>${final.map(([c, d]) => planPill(c, d)).join(" ")}</td>
        <td class="n">${fmt(s.ug)}</td></tr>`;
    }).join("");
    return `<div class="view-head"><div><h2>Compare</h2><p>Side-by-side numbers for your list. Select a column heading to sort. SAT bars run on a 1200–1600 scale${sat ? "; the dark tick is your score" : ""}.</p></div></div>
      ${rows.length ? `<div class="table-wrap"><table><thead><tr>${th("name", "School")}${th("rank", "U.S. News")}${th("rate", "Admit rate")}${th("apps", "Applied")}<th scope="col">Admitted</th>${th("sat", "SAT 25–75")}${th("act", "ACT 25–75")}${th("test", "Testing")}${th("early", "Early plans")}<th scope="col">Final deadline</th>${th("ug", "Undergrads")}</tr></thead><tbody>${body}</tbody></table></div>
      <p class="source">${esc(META.statsSource || "")}</p>` : `<div class="empty-state"><h3>Nothing to compare yet</h3><p>Add two or more schools to compare them.</p></div>`}`;
  }

  function stateBtn(key, label) {
    const st = state.essays[key] || "todo";
    return `<button class="btn small state-btn" data-action="essay" data-key="${esc(key)}" data-state="${st}" aria-label="${esc(label)}: ${ESSAY_LABEL[st]}. Select to change.">${ESSAY_LABEL[st]}</button>`;
  }
  function viewEssays() {
    const schools = listSchools();
    const items = essayItems();
    const done = items.filter((i) => state.essays[i.key] === "done").length;
    const pct = items.length ? Math.round(done / items.length * 100) : 0;
    const usesCA = schools.filter((s) => s.apps.includes("Common App"));
    const usesUC = schools.filter((s) => s.apps.includes("UC Application"));
    let html = `<div class="view-head"><div><h2>Essays</h2><p>Every essay your list asks for, with word limits. Select a status button to move it from Not started to Drafting to Done. ${esc(META.essayNote || "")}</p></div>
      <div class="progress"><span class="num"><strong>${done}</strong> of ${items.length} done</span><div class="track"><div class="fill" style="width:${pct}%"></div></div></div></div>`;
    if (!schools.length) return html + `<div class="empty-state"><h3>No essays yet</h3><p>Add schools to collect their essay prompts here.</p></div>`;
    if (usesCA.length) {
      html += `<section class="essay-group"><header><h3>Common App personal essay</h3><span class="range-text">Used by ${usesCA.length} of your schools</span></header>
        <div class="essay"><p>One essay, chosen from seven prompts, sent to every Common App school.</p><span class="limit">650 words</span>${stateBtn("commonapp:0", "Common App essay")}</div>
        <ol class="ca-prompts">${COMMON_APP.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></section>`;
    }
    if (usesUC.length) {
      html += `<section class="essay-group"><header><h3>UC Personal Insight Questions</h3><span class="range-text">${esc(usesUC.map((s) => s.short).join(", "))}</span></header>
        <div class="essay"><p>${esc(usesUC[0].essays[0][0])} One set of answers goes to every UC campus.</p><span class="limit">350 words each</span>${stateBtn("ucpiq:0", "UC Personal Insight Questions")}</div></section>`;
    }
    schools.filter((s) => !s.apps.includes("UC Application")).forEach((s) => {
      html += `<section class="essay-group"><header><h3><a href="#school-${s.id}" style="color:inherit;text-decoration:none">${esc(s.short)}</a></h3><a class="btn small" href="${esc(s.site)}" target="_blank" rel="noopener">Official prompts ↗</a></header>
        ${s.essays.map((e, i) => {
          const none = /^No supplement/.test(e[0]);
          return `<div class="essay"><p>${esc(e[0])}</p><span class="limit">${e[1] ? "≤ " + e[1] + " words" : none ? "" : "see site"}</span>${none ? "" : stateBtn(essayKey(s.id, i), s.short + " essay " + (i + 1))}</div>`;
        }).join("")}</section>`;
    });
    return html;
  }

  let browseFilter = "";
  function viewBrowse() {
    const q = browseFilter.trim().toLowerCase();
    const match = (s) => !q || (s.name + " " + s.short + " " + s.city + " " + s.state).toLowerCase().includes(q);
    const section = (cat, title) => {
      const list = SCHOOLS.filter((s) => s.cat === cat && match(s)).sort((a, b) => a.rank - b.rank || a.short.localeCompare(b.short));
      if (!list.length) return "";
      return `<section class="browse-section"><h3>${title} <span class="label">${list.length}</span></h3><div class="browse-grid">${list.map((s) => {
        const inList = state.list.includes(s.id); const st = stats(s);
        return `<div class="browse-item ${inList ? "in" : ""}"><div style="min-width:0"><a href="#school-${s.id}">${esc(s.short)}</a><div class="r-sub">${rankLabel(s)} · ${esc(s.state)}${st ? " · " + st.rate.toFixed(1) + "% admit" : ""}</div></div>
          <button class="btn small ${inList ? "" : "primary"}" data-action="${inList ? "remove" : "add"}" data-id="${s.id}">${inList ? "Remove" : "Add"}</button></div>`;
      }).join("")}</div></section>`;
    };
    return `<div class="view-head"><div><h2>All schools</h2><p>${esc(META.rankings || "")}</p></div>
      <div class="field" style="min-width:min(260px,100%)"><label for="browse-filter">Filter</label><input id="browse-filter" type="search" placeholder="Name, city or state" value="${esc(browseFilter)}" data-action="browse-filter"></div></div>
      <div id="browse-body">${section("National University", "National universities") + section("Liberal Arts College", "Liberal arts colleges") || `<div class="empty-state"><h3>No matches</h3><p>Try a different name or a state abbreviation like “CA”.</p></div>`}</div>`;
  }

  function viewSchool(id) {
    const s = BY[id];
    if (!s) return `<div class="empty-state"><h3>School not found</h3><p><a href="#browse">Browse all schools</a></p></div>`;
    const st = stats(s); const inList = state.list.includes(s.id);
    const sat = Number(state.scores.sat) || null, act = Number(state.scores.act) || null;
    const cdsSearch = "https://www.google.com/search?q=" + encodeURIComponent(s.name + " Common Data Set");
    const fitS = st && scoreFit(sat, st.sat), fitA = st && scoreFit(act, st.act);
    const dlRows = s.plans.map(([code, date]) => { const n = daysUntil(date); const [name, binding] = PLAN[code] || [code, false];
      return `<tr><td><strong>${esc(name)}</strong>${binding ? ` <span class="pill check">Binding</span>` : ""}</td><td class="mono">${DOW[parseDate(date).getDay()]} ${shortDate(date)}, ${parseDate(date).getFullYear()}</td><td class="n"><span class="pill ${deadlineClass(n)}">${leftText(n)}</span></td></tr>`; }).join("");
    return `<div class="crumbs"><a href="#list">My list</a> · <a href="#browse">All schools</a></div>
      <div class="detail-head"><div><h2>${esc(s.name)}</h2><div class="meta"><span>${esc(s.city)}, ${esc(s.state)}</span><span>${esc(s.type)} ${esc(s.cat.toLowerCase())}</span><span>U.S. News 2027: ${rankLabel(s)}</span><span class="num">≈${fmt(s.ug)} undergrads</span></div></div>
        <div class="card-actions"><a class="btn" href="${esc(s.site)}" target="_blank" rel="noopener">Admissions site ↗</a><button class="btn ${inList ? "" : "primary"}" data-action="${inList ? "remove" : "add"}" data-id="${s.id}">${inList ? "Remove from list" : "Add to my list"}</button></div></div>
      <div class="detail-grid"><div>
        <section class="section"><h3>Deadlines <span class="label">Fall 2027 entry</span></h3><div style="overflow-x:auto"><table class="dl-table"><tbody>${dlRows}</tbody></table></div><p class="source">${esc(META.deadlineNote || "")}</p></section>
        <section class="section"><h3>Essay prompts <span class="label">${s.essays.length} supplement${s.essays.length > 1 ? "s" : ""}</span></h3>
          <ul class="prompt-list">${s.essays.map((e) => `<li><span>${esc(e[0])}</span><span class="limit">${e[1] ? "≤ " + e[1] + " words" : ""}</span></li>`).join("")}</ul>
          <p class="source">${s.apps.includes("Common App") ? "Plus the Common App personal essay (650 words). " : ""}${esc(META.essayNote || "")} <a href="${esc(s.site)}" target="_blank" rel="noopener">Official wording ↗</a></p></section>
        <section class="section"><h3>Application requirements</h3><dl class="kv">
          <dt>Apply through</dt><dd>${esc(s.apps.join(", "))}</dd>
          <dt>Testing</dt><dd>${testPill(s)} ${esc(s.test.n)}</dd>
          <dt>Recommendations</dt><dd>${esc(s.recs)}</dd>
          <dt>Interview</dt><dd>${esc(s.interview)}</dd>
          ${s.notes ? `<dt>Good to know</dt><dd>${esc(s.notes)}</dd>` : ""}
        </dl></section>
      </div><div>
        <section class="section"><h3>Admissions statistics <span class="label">CDS sections C1 · C9</span></h3>
          ${st ? `<div class="stat-grid">
            <div><div class="code">C1 · APPLIED</div><div class="v">${fmt(st.apps)}</div><div class="s">first-year applicants</div></div>
            <div><div class="code">C1 · ADMITTED</div><div class="v">≈${fmt(st.admitted)}</div><div class="s">applicants × admit rate</div></div>
            <div><div class="code">ADMIT RATE</div><div class="v">${st.rate.toFixed(2)}%</div><div class="s">about 1 in ${Math.max(1, Math.round(100 / st.rate))}</div></div>
            <div><div class="code">TESTING</div><div class="v" style="font-size:1.05rem">${TEST[s.test.p]}</div><div class="s">for fall 2027 entry</div></div>
            <div><div class="code">C9 · SAT 25TH–75TH</div><div class="v">${st.sat ? st.sat.join("–") : "—"}</div><div class="s">${st.sat ? "enrolled students who submitted" : s.test.p === "blind" ? "scores not considered" : "not reported"}</div>${fitS ? `<span class="pill ${fitS}">You: ${fitText[fitS]}</span>` : ""}</div>
            <div><div class="code">C9 · ACT 25TH–75TH</div><div class="v">${st.act ? (st.act[0] === st.act[1] ? st.act[0] : st.act.join("–")) : "—"}</div><div class="s">${st.act ? "enrolled students who submitted" : ""}</div>${fitA ? `<span class="pill ${fitA}">You: ${fitText[fitA]}</span>` : ""}</div>
          </div>
          ${st.sat ? `<div style="margin-top:14px"><div class="label">SAT middle 50% on a 1200–1600 scale</div>${rangeBar(st.sat, sat, 1200, 1600)}</div>` : ""}` : `<p>No statistics on file.</p>`}
          <p class="source">${esc(META.statsSource || "")} For early-round admit rates (C21), waitlist numbers (C2) and how each factor is weighed (C7), open the full report: <a href="${cdsSearch}" target="_blank" rel="noopener">find ${esc(s.short)}'s Common Data Set ↗</a></p>
        </section>
      </div></div>`;
  }

  /* ---------- router ---------- */
  const TABS = [["list", "My list"], ["deadlines", "Deadlines"], ["compare", "Compare"], ["essays", "Essays"], ["browse", "All schools"]];
  function currentView() { const h = location.hash.replace(/^#/, ""); return h || "list"; }
  function render() {
    const v = currentView();
    const tab = v.startsWith("school-") ? "browse" : v;
    $("#tabs").innerHTML = TABS.map(([k, l]) => `<a href="#${k}" ${tab === k ? 'aria-current="page"' : ""}>${l}${k === "list" ? `<span class="count">${listSchools().length}</span>` : ""}</a>`).join("");
    const app = $("#app");
    if (!SCHOOLS.length) return;
    app.innerHTML = v === "deadlines" ? viewDeadlines() : v === "compare" ? viewCompare() : v === "essays" ? viewEssays() : v === "browse" ? viewBrowse() : v.startsWith("school-") ? viewSchool(v.slice(7)) : viewList();
  }
  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

  /* ---------- events ---------- */
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]"); if (!el) return;
    const a = el.dataset.action;
    if (a === "add") addSchool(el.dataset.id);
    else if (a === "remove") removeSchool(el.dataset.id);
    else if (a === "clear-list") { state.list = []; state.example = false; save(); render(); }
    else if (a === "sort") { const k = el.dataset.k; if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; } render(); }
    else if (a === "essay") {
      const k = el.dataset.key; const cur = state.essays[k] || "todo";
      state.essays[k] = ESSAY_STATES[(ESSAY_STATES.indexOf(cur) + 1) % 3];
      if (state.example) state.example = false;
      save(); render();
      const again = document.querySelector(`[data-action="essay"][data-key="${CSS.escape(k)}"]`); if (again) again.focus();
    }
    else if (a === "copy-list") copyList();
  });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.action === "status") { state.status[el.dataset.id] = el.value; state.example = false; save(); toast("Status saved"); }
    if (el.dataset.action === "toggle-passed") { state.showPassed = el.checked; save(); render(); }
    if (el.dataset.action === "score") { state.scores[el.dataset.k] = el.value; save(); render(); const f = document.getElementById(el.id); if (f) f.focus(); }
  });
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.action === "browse-filter") {
      browseFilter = el.value; render();
      const f = document.getElementById("browse-filter"); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    }
  });

  function copyList() {
    const lines = listSchools().map((s) => {
      const st = stats(s);
      return `${s.name} (${s.city}, ${s.state})\n  Deadlines: ${s.plans.map(([c, d]) => c + " " + shortDate(d)).join(", ")}\n  Testing: ${TEST[s.test.p]}${st ? `\n  Admit rate: ${st.rate.toFixed(1)}% of ${fmt(st.apps)} applicants` : ""}${st && st.sat ? ` · SAT ${st.sat.join("-")}` : ""}`;
    });
    const text = "My college list (" + (META.cycle || "") + ")\n\n" + lines.join("\n\n");
    const done = () => toast("List copied");
    try {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text));
    } catch (err) { fallbackCopy(text); }
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove(); toast(ok ? "List copied" : "Copy isn't available here. Select the text on the Deadlines tab instead.");
  }

  /* ---------- search combobox ---------- */
  const input = $("#search"), results = $("#results"), box = $("#search-box");
  let hits = [], active = -1;
  function searchSchools(q) {
    q = q.trim().toLowerCase(); if (!q) return [];
    const score = (s) => { const n = s.name.toLowerCase(), sh = s.short.toLowerCase();
      if (sh.startsWith(q) || n.startsWith(q)) return 0; if (n.includes(q) || sh.includes(q)) return 1;
      if ((s.city + " " + s.state).toLowerCase().includes(q)) return 2; return 9; };
    return SCHOOLS.map((s) => [score(s), s]).filter(([sc]) => sc < 9).sort((a, b) => a[0] - b[0] || a[1].rank - b[1].rank).slice(0, 8).map(([, s]) => s);
  }
  function drawResults() {
    if (!input.value.trim()) { results.hidden = true; box.setAttribute("aria-expanded", "false"); return; }
    results.innerHTML = hits.length ? hits.map((s, i) => { const inList = state.list.includes(s.id);
      return `<li role="option" id="opt-${s.id}" data-id="${s.id}" aria-selected="${i === active}"><div><div class="r-name">${esc(s.name)}</div><div class="r-sub">${esc(s.city)}, ${esc(s.state)} · ${rankLabel(s)}</div></div><span class="r-tag ${inList ? "added" : ""}">${inList ? "On your list" : "+ Add"}</span></li>`; }).join("")
      : `<li class="empty">No match among the ${SCHOOLS.length} schools in this planner yet.</li>`;
    results.hidden = false; box.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-activedescendant", active >= 0 && hits[active] ? "opt-" + hits[active].id : "");
  }
  function pick(s) { if (!s) return; addSchool(s.id); input.value = ""; hits = []; active = -1; drawResults(); }
  input.addEventListener("input", () => { hits = searchSchools(input.value); active = hits.length ? 0 : -1; drawResults(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (hits.length) { active = (active + 1) % hits.length; drawResults(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (hits.length) { active = (active - 1 + hits.length) % hits.length; drawResults(); } }
    else if (e.key === "Enter") { e.preventDefault(); pick(hits[active]); }
    else if (e.key === "Escape") { input.value = ""; hits = []; drawResults(); }
  });
  results.addEventListener("mousedown", (e) => { const li = e.target.closest("li[data-id]"); if (li) { e.preventDefault(); pick(BY[li.dataset.id]); } });
  input.addEventListener("blur", () => setTimeout(() => { results.hidden = true; box.setAttribute("aria-expanded", "false"); }, 120));
  input.addEventListener("focus", () => { if (input.value.trim()) drawResults(); });

  /* ---------- boot ---------- */
  function footer() {
    $("#foot").innerHTML = `<p><strong>Where the numbers come from.</strong> ${esc(META.rankings)} ${esc(META.statsSource)} ${esc(META.testSource)}</p>
      <p>${esc(META.deadlineNote)} ${esc(META.essayNote)} Your list, statuses and scores are saved only in this browser.</p>`;
  }
  fetch("schools.json", { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((d) => {
    META = d.meta || {}; META.stats = d.stats || {}; SCHOOLS = d.schools || [];
    SCHOOLS.forEach((s) => { BY[s.id] = s; });
    state.list = state.list.filter((id) => BY[id]);
    if (META.cycle) $("#cycle").textContent = META.cycle.replace(" application cycle", " cycle");
    footer(); render();
  }).catch(() => {
    $("#app").innerHTML = `<div class="empty-state"><h3>School data didn't load</h3><p>This page reads <span class="mono">schools.json</span> from the same folder. It loads once the site is online (for example on Netlify). Opening index.html straight from your computer can't read it.</p></div>`;
  });
})();
