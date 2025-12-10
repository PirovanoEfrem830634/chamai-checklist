//-------------------------------------------------------------
//  ChAMAI – Checklist Engine
//-------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

  //-----------------------------------------------------------
  //  CONSTANTS
  //-----------------------------------------------------------

  const STATE_KEY = "chamaiState";
  // 🔹 Path corretto al JSON
  const JSON_PATH = "data/chamai-checklist.json";

  // Score mapping:
  //   high priority → OK=2, mR=1, MR=0
  //   low  priority → OK=1, mR=0.5, MR=0
  const SCORE_MAP = {
    high: { OK: 2, mR: 1, MR: 0 },
    low:  { OK: 1, mR: 0.5, MR: 0 }
  };

  //-----------------------------------------------------------
  //  DOM REFERENCES
  //-----------------------------------------------------------

  const rootEl = document.getElementById("chamaiChecklistRoot");
  const startBtn = document.getElementById("startChecklist");

  // Score overview
  const totalScoreEl   = document.getElementById("chamaiTotalScore");
  const progressEl     = document.getElementById("chamaiTotalProgress");
  const qualityBadge   = document.getElementById("chamaiQualityBadge");
  const qualityLabel   = document.getElementById("chamaiQualityLabel");

  // Export buttons
  const exportCsvBtn   = document.getElementById("exportCsv");
  const exportPdfBtn   = document.getElementById("exportPdf");

  // Reset & Commit
  const commitAllBtn   = document.getElementById("commitAll");
  const resetAllBtn    = document.getElementById("resetAll");

  // Header (sopra la checklist)
  const counterEl      = document.getElementById("chamaiCounter");
  const scoreDisplayEl = document.getElementById("chamaiScoreDisplay");

  // Guidelines collapse
  const guidelinesCard   = document.querySelector(".card-guidelines");
  const guidelinesToggle = document.querySelector(".guidelines-toggle");
  const guidelinesLabel  = document.querySelector(".guidelines-toggle-label");

  //-----------------------------------------------------------
  // STATE
  //-----------------------------------------------------------

  let checklistData = null;

  // state.scores = { "PU01": "OK", ... }
  // state.committed = { "PU": true, ... }
  let state = {
    scores: {},
    committed: {}
  };

  //-----------------------------------------------------------
  // LOAD / SAVE STATE
  //-----------------------------------------------------------

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        state = parsed;
      }
    } catch (e) {
      console.warn("State load error:", e);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("State save error:", e);
    }
  }

  function clearState() {
    state = { scores: {}, committed: {} };
    localStorage.removeItem(STATE_KEY);
  }

  //-----------------------------------------------------------
  //  HELPERS: ITEMS & SCORING
  //-----------------------------------------------------------

  function getTotalItems() {
    if (!checklistData || !Array.isArray(checklistData.sections)) return 0;
    let n = 0;
    checklistData.sections.forEach(sec => {
      if (Array.isArray(sec.items)) n += sec.items.length;
    });
    return n;
  }

  function computeTotalScore() {
    if (!checklistData) return 0;
    let total = 0;

    checklistData.sections.forEach(section => {
      section.items.forEach(item => {
        const choice = state.scores[item.code];
        if (!choice) return;
        const priority = item.priority === "high" ? "high" : "low";
        const points   = SCORE_MAP[priority][choice] ?? 0;
        total += points;
      });
    });

    return total;
  }

  function computeMaxScore() {
    if (!checklistData) return 0;
    let max = 0;

    checklistData.sections.forEach(section => {
      section.items.forEach(item => {
        max += (item.priority === "high" ? 2 : 1);
      });
    });

    return max;
  }

  function qualityFromScore(score, max) {
    const pct = (score / max) * 100;

    if (pct === 0)  return ["Incomplete", "csp-badge-incomplete"];
    if (pct < 30)   return ["Very Low", "csp-badge-verylow"];
    if (pct < 50)   return ["Low", "csp-badge-low"];
    if (pct < 70)   return ["Moderate", "csp-badge-moderate"];
    if (pct < 85)   return ["High", "csp-badge-high"];
    return ["Excellent", "csp-badge-excellent"];
  }

  //-----------------------------------------------------------
  //  SCORE PANEL
  //-----------------------------------------------------------

  function updateScorePanel() {
    const score = computeTotalScore();
    const max   = computeMaxScore();
    const items = getTotalItems();

    if (totalScoreEl) {
      totalScoreEl.textContent = `${score} / ${max}`;
    }

    const pct = max > 0 ? Math.min(100, Math.max(0, (score / max) * 100)) : 0;
    if (progressEl) {
      progressEl.style.width = `${pct}%`;
    }

    const [label, css] = qualityFromScore(score, max || 1);
    if (qualityLabel) qualityLabel.textContent = label;
    if (qualityBadge) qualityBadge.className   = `csp-badge ${css}`;

    if (counterEl)      counterEl.textContent      = `${items} items`;
    if (scoreDisplayEl) scoreDisplayEl.textContent = `Total score: ${score}`;
  }

  //-----------------------------------------------------------
  //  DOM CREATION
  //-----------------------------------------------------------

  function createSectionElement(section) {
    const sectionEl = document.createElement("div");
    sectionEl.className = "checklist-section";
    sectionEl.dataset.sectionId = section.id;

    const header = document.createElement("h3");
    header.className = "section-header-title";
    header.textContent = `${section.id} – ${section.label}`;
    sectionEl.appendChild(header);

    section.items.forEach(item => {
      const itemEl = createItemElement(section, item);
      sectionEl.appendChild(itemEl);
    });

    return sectionEl;
  }

  function createItemElement(section, item) {
    const wrapper = document.createElement("div");
    wrapper.className = "checklist-item chamai-item";
    wrapper.dataset.itemCode = item.code;

    // layout a due colonne via JS (domanda + bottoni affiancati)
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "flex-start";
    wrapper.style.justifyContent = "space-between";
    wrapper.style.gap = "16px";

    const content = document.createElement("div");
    content.className = "chamai-item-content";
    content.style.flex = "1 1 auto";

    // --- TITOLO: SOLO CODE (PU01, DU07, ecc.) + HIGH PRIORITY PILL ---
    const title = document.createElement("div");
    title.className = "checklist-label";
    title.textContent = item.code || "";

    if (item.priority === "high") {
      title.classList.add("chamai-label-high");
      const pill = document.createElement("span");
      pill.className = "chamai-priority-pill";
      pill.textContent = "HIGH PRIORITY";
      title.appendChild(document.createTextNode(" "));
      title.appendChild(pill);
    }
    content.appendChild(title);

    // --- DESCRIZIONE PRINCIPALE ---
    if (item.description) {
      const desc = document.createElement("div");
      desc.className = "checklist-help";
      desc.textContent = item.description;
      content.appendChild(desc);
    }

    // --- SUBITEMS (lista a punti) SE PRESENTI ---
    if (Array.isArray(item.subitems) && item.subitems.length > 0) {
      const subList = document.createElement("ul");
      subList.className = "checklist-subitems";
      item.subitems.forEach(text => {
        const li = document.createElement("li");
        li.textContent = text;
        subList.appendChild(li);
      });
      content.appendChild(subList);
    }

    // --- NOTE (testo aggiuntivo sotto subitems) ---
    if (item.note) {
      const note = document.createElement("div");
      note.className = "checklist-note";
      note.textContent = item.note;
      content.appendChild(note);
    }

      // --- CONTROLLI OK / mR / MR ---
  const controls = document.createElement("div");
  controls.className = "chamai-controls";

  // layout: colonna destra allineata con la PRIMA riga del testo
  controls.style.display = "flex";
  controls.style.flexShrink = "0";
  controls.style.gap = "8px";
  controls.style.alignItems = "center";

  // 👇 importante: niente spinta verso il basso
  controls.style.marginTop = "0";
  controls.style.alignSelf = "flex-start";


    ["OK", "mR", "MR"].forEach(choice => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chamai-btn";
      btn.textContent = choice;
      btn.dataset.choice = choice;
      btn.dataset.itemCode = item.code;
      btn.dataset.priority = item.priority;

      if (state.scores[item.code] === choice) {
        btn.classList.add("active");
      }

      btn.addEventListener("click", () => {
        state.scores[item.code] = choice;
        saveState();
        refreshUI();
      });

      controls.appendChild(btn);
    });

    // ASSEMBLY
    wrapper.appendChild(content);
    wrapper.appendChild(controls);

    return wrapper;
  }

  //-----------------------------------------------------------
  //  UI REFRESH
  //-----------------------------------------------------------

  function refreshUI() {
    document.querySelectorAll(".chamai-btn").forEach(btn => {
      const code    = btn.dataset.itemCode;
      const choice  = btn.dataset.choice;
      const current = state.scores[code];
      btn.classList.toggle("active", current === choice);
    });

    updateScorePanel();
  }

  //-----------------------------------------------------------
  //  BUILD CHECKLIST
  //-----------------------------------------------------------

  function buildChecklist() {
    rootEl.innerHTML = "";
    checklistData.sections.forEach(section => {
      const el = createSectionElement(section);
      rootEl.appendChild(el);
    });
    refreshUI();
  }

  //-----------------------------------------------------------
  //  RESET + COMMIT ALL
  //-----------------------------------------------------------

  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", () => {
      if (!confirm("Reset all responses?")) return;
      clearState();
      buildChecklist(); // ricostruisco così azzero anche i bottoni
    });
  }

  if (commitAllBtn) {
    commitAllBtn.addEventListener("click", () => {
      checklistData.sections.forEach(sec => {
        state.committed[sec.id] = true;
      });
      saveState();
      alert("All sections marked as committed.");
    });
  }

  //-----------------------------------------------------------
  //  START BUTTON
  //-----------------------------------------------------------

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      rootEl.scrollIntoView({ behavior: "smooth" });
    });
  }

  //-----------------------------------------------------------
  //  EXPORT CSV
  //-----------------------------------------------------------

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => {
      const max   = computeMaxScore();
      const total = computeTotalScore();
      const rows  = [["Item", "Description", "Priority", "Choice", "Score"]];

      checklistData.sections.forEach(section => {
        section.items.forEach(item => {
          const choice = state.scores[item.code] || "";
          const pr     = item.priority;
          const score  = choice ? SCORE_MAP[pr][choice] : "";
          rows.push([
            item.code,
            item.description || "",
            pr,
            choice,
            score
          ]);
        });
      });

      let csv = "ChAMAI Summary\n";
      csv += `Total Score,${total},/ ${max}\n\n`;

      rows.forEach(r => {
        csv += r.map(x => `"${x}"`).join(",") + "\n";
      });

      const blob = new Blob([csv], { type: "text/csv" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = "ChAMAI-results.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  //-----------------------------------------------------------
  //  EXPORT PDF
  //-----------------------------------------------------------

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", () => {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("jsPDF missing");
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape" });

      doc.setFontSize(16);
      doc.text("ChAMAI Checklist Results", 20, 20);

      const max   = computeMaxScore();
      const total = computeTotalScore();
      doc.setFontSize(11);
      doc.text(`Score: ${total} / ${max}`, 20, 40);

      const table = [];
      checklistData.sections.forEach(section => {
        section.items.forEach(item => {
          const choice = state.scores[item.code] || "";
          const pr     = item.priority;
          const score  = choice ? SCORE_MAP[pr][choice] : "";
          table.push([
            item.code,
            item.description || "",
            pr,
            choice,
            score
          ]);
        });
      });

      if (doc.autoTable) {
        doc.autoTable({
          head: [["Item", "Description", "Priority", "Choice", "Score"]],
          body: table,
          startY: 60
        });
      }

      doc.save("ChAMAI-results.pdf");
    });
  }

  //-----------------------------------------------------------
  //  GUIDELINES COLLAPSE (default CLOSED)
  //-----------------------------------------------------------

  if (guidelinesCard && guidelinesToggle && guidelinesLabel) {
    guidelinesCard.classList.add("collapsed");
    guidelinesToggle.setAttribute("aria-expanded", "false");
    guidelinesLabel.textContent = "Show details";

    guidelinesToggle.addEventListener("click", (e) => {
      e.preventDefault();
      const isCollapsed = guidelinesCard.classList.toggle("collapsed");
      if (isCollapsed) {
        guidelinesToggle.setAttribute("aria-expanded", "false");
        guidelinesLabel.textContent = "Show details";
      } else {
        guidelinesToggle.setAttribute("aria-expanded", "true");
        guidelinesLabel.textContent = "Hide details";
      }
    });
  }

  //-----------------------------------------------------------
  //  INIT
  //-----------------------------------------------------------

  loadState();

  fetch(JSON_PATH)
    .then(r => r.json())
    .then(json => {
      checklistData = json;
      buildChecklist();
    })
    .catch(e => {
      rootEl.innerHTML = `<p style="color:#c00">Failed to load checklist JSON.</p>`;
      console.error(e);
    });

});
