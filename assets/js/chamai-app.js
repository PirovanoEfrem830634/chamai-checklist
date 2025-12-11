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

  // 🔹 Ruoli e opzioni per le risposte
  const ROLE_AUTHOR   = "author";
  const ROLE_REVIEWER = "reviewer";

  const AUTHOR_OPTIONS   = ["NA", "No", "Yes"];
  const REVIEWER_OPTIONS = ["OK", "mR", "MR"];

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

  // 🔹 Toggle Author / Reviewer
  const roleToggleEl = document.getElementById("roleToggle");

  //-----------------------------------------------------------
  // STATE
  //-----------------------------------------------------------

  let checklistData = null;

  // NUOVA struttura:
  // state.scores[itemCode] = { author: "NA|No|Yes|null", reviewer: "NA|OK|mR|MR|null" }
  // state.committed = { "PU": true, ... }
  // state.role = "author" | "reviewer"
  let state = {
    scores: {},
    committed: {},
    role: ROLE_REVIEWER
  };

  //-----------------------------------------------------------
  // LOAD / SAVE STATE
  //-----------------------------------------------------------

  function migrateLegacyState() {
    // Se in localStorage avevi solo "OK"/"mR"/"MR" come stringa, li converto
    if (!state || !state.scores) return;

    let changed = false;

    Object.keys(state.scores).forEach(code => {
      const val = state.scores[code];
      if (typeof val === "string") {
        state.scores[code] = {
          author: null,
          reviewer: val
        };
        changed = true;
      }
    });

    if (!state.role) {
      state.role = ROLE_REVIEWER;
      changed = true;
    }

    if (changed) {
      saveState();
    }
  }

  function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        state = parsed;
      }
    }

    migrateLegacyState();

    // 🔹 FORZA SEMPRE IL DEFAULT SUI REVIEWERS
    state.role = ROLE_REVIEWER;
    saveState();
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
    state = { scores: {}, committed: {}, role: ROLE_REVIEWER };
    localStorage.removeItem(STATE_KEY);
  }

  //-----------------------------------------------------------
  //  ROLE TOGGLE
  //-----------------------------------------------------------

  function getCurrentRole() {
    return state.role === ROLE_AUTHOR ? ROLE_AUTHOR : ROLE_REVIEWER;
  }

  function getOptionsForCurrentRole() {
    return getCurrentRole() === ROLE_AUTHOR ? AUTHOR_OPTIONS : REVIEWER_OPTIONS;
  }

  function setRole(newRole) {
    const role = (newRole === ROLE_AUTHOR) ? ROLE_AUTHOR : ROLE_REVIEWER;
    state.role = role;
    saveState();

    // aggiorno la UI del toggle se esiste
    if (roleToggleEl) {
      const buttons = roleToggleEl.querySelectorAll("[data-role]");
      buttons.forEach(btn => {
        const r = btn.getAttribute("data-role");
        if (r === role) {
          btn.classList.add("role-active");
        } else {
          btn.classList.remove("role-active");
        }
      });
    }

    // ricostruisco la checklist con le nuove opzioni
    if (checklistData) {
      buildChecklist();
    }
  }

  function initRoleToggle() {
    if (!roleToggleEl) return;

    roleToggleEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-role]");
      if (!btn) return;
      const newRole = btn.getAttribute("data-role");
      setRole(newRole);
    });

    setRole(ROLE_REVIEWER);
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

  function getReviewerChoiceForItem(itemCode) {
    const entry = state.scores[itemCode];
    if (!entry) return null;
    if (typeof entry === "string") return entry; // vecchio formato, per sicurezza
    return entry.reviewer || null;
  }

  function getAuthorChoiceForItem(itemCode) {
  const entry = state.scores[itemCode];
  if (!entry) return null;
  // nel formato legacy (stringa) non avevamo risposte author
  if (typeof entry === "string") return null;
  return entry.author || null;
  }

  function computeTotalScore() {
    if (!checklistData) return 0;
    let total = 0;

    checklistData.sections.forEach(section => {
      section.items.forEach(item => {
        const choice = getReviewerChoiceForItem(item.code);
        if (!choice || choice === "NA") return;
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

    // --- CONTROLLI: dipendono dal ruolo ---
    const controls = document.createElement("div");
    controls.className = "chamai-controls";

    // layout: colonna destra allineata con la PRIMA riga del testo
    controls.style.display = "flex";
    controls.style.flexShrink = "0";
    controls.style.gap = "8px";
    controls.style.alignItems = "center";
    controls.style.marginTop = "0";
    controls.style.alignSelf = "flex-start";

    const options = getOptionsForCurrentRole();
    const role = getCurrentRole();

    const itemEntry = state.scores[item.code] || { author: null, reviewer: null };
    const currentValue =
      typeof itemEntry === "string"
        ? itemEntry
        : (itemEntry[role] || null);

    options.forEach(choice => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chamai-btn";
      btn.textContent = choice;
      btn.dataset.choice = choice;
      btn.dataset.itemCode = item.code;

      if (currentValue === choice) {
        btn.classList.add("active");
      }

      btn.addEventListener("click", () => {
        const prev = state.scores[item.code];
        let entry;

        if (!prev || typeof prev === "string") {
          entry = { author: null, reviewer: null };
          if (typeof prev === "string") {
            entry.reviewer = prev;
          }
        } else {
          entry = { ...prev };
        }

        entry[role] = choice; // salvo solo per il ruolo corrente
        state.scores[item.code] = entry;
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
    const role = getCurrentRole();

    document.querySelectorAll(".chamai-btn").forEach(btn => {
      const code    = btn.dataset.itemCode;
      const choice  = btn.dataset.choice;
      const entry   = state.scores[code];

      let current = null;
      if (entry) {
        if (typeof entry === "string") {
          current = entry;
        } else {
          current = entry[role] || null;
        }
      }

      btn.classList.toggle("active", current === choice);
    });

    updateScorePanel();
  }

  //-----------------------------------------------------------
  //  BUILD CHECKLIST
  //-----------------------------------------------------------

  function buildChecklist() {
    rootEl.innerHTML = "";
    if (!checklistData) return;

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
      const role = getCurrentRole(); // author o reviewer
      let rows = [];
      let csv = "";

      if (role === ROLE_AUTHOR) {
        // 🔹 Modalità AUTHOR: solo le scelte Yes/No/NA, niente punteggi
        rows.push(["Item", "Description", "Priority", "Choice (Author)"]);

        checklistData.sections.forEach(section => {
          section.items.forEach(item => {
            const choiceAuthor = getAuthorChoiceForItem(item.code) || "";
            const pr = item.priority;
            rows.push([
              item.code,
              item.description || "",
              pr,
              choiceAuthor
            ]);
          });
        });

        csv += "ChAMAI Summary – Author self-assessment\n\n";

      } else {
        // 🔹 Modalità REVIEWER: come prima, con punteggi
        const max   = computeMaxScore();
        const total = computeTotalScore();

        rows.push(["Item", "Description", "Priority", "Choice (Reviewer)", "Score"]);

        checklistData.sections.forEach(section => {
          section.items.forEach(item => {
            const choice = getReviewerChoiceForItem(item.code) || "";
            const pr     = item.priority;
            const score  = (choice && choice !== "NA") ? SCORE_MAP[pr][choice] : "";
            rows.push([
              item.code,
              item.description || "",
              pr,
              choice,
              score
            ]);
          });
        });

        csv += "ChAMAI Summary – Reviewer evaluation\n";
        csv += `Total Score,${total},/ ${max}\n\n`;
      }

      // costruzione CSV comune ai due casi
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

      const role = getCurrentRole();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape" });

      if (role === ROLE_AUTHOR) {
        // 🔹 PDF per AUTHORS: solo scelte Yes/No/NA
        doc.setFontSize(16);
        doc.text("ChAMAI Checklist – Author self-assessment", 20, 20);

        const table = [];
        checklistData.sections.forEach(section => {
          section.items.forEach(item => {
            const choiceAuthor = getAuthorChoiceForItem(item.code) || "";
            const pr = item.priority;
            table.push([
              item.code,
              item.description || "",
              pr,
              choiceAuthor
            ]);
          });
        });

        if (doc.autoTable) {
          doc.autoTable({
            head: [["Item", "Description", "Priority", "Choice (Author)"]],
            body: table,
            startY: 40
          });
        }

      } else {
        // 🔹 PDF per REVIEWERS: come prima, con punteggi
        const max   = computeMaxScore();
        const total = computeTotalScore();

        doc.setFontSize(16);
        doc.text("ChAMAI Checklist Results – Reviewer evaluation", 20, 20);

        doc.setFontSize(11);
        doc.text(`Score: ${total} / ${max}`, 20, 40);

        const table = [];
        checklistData.sections.forEach(section => {
          section.items.forEach(item => {
            const choice = getReviewerChoiceForItem(item.code) || "";
            const pr     = item.priority;
            const score  = (choice && choice !== "NA") ? SCORE_MAP[pr][choice] : "";
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
            head: [["Item", "Description", "Priority", "Choice (Reviewer)", "Score"]],
            body: table,
            startY: 60
          });
        }
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
  initRoleToggle();

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
