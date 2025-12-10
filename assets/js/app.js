// assets/js/app.js

document.addEventListener("DOMContentLoaded", () => {
  const STATE_KEY = "clarityAiChecklistState";

  const startBtn = document.getElementById("startChecklist");
  const resetAllBtn = document.getElementById("resetChecklist");
  const commitAllBtn = document.getElementById("commitAll");
  const resetAllMacroBtn = document.getElementById("resetChecklistMacro");
  const commitAllMacroBtn = document.getElementById("commitAllMacro");
  const exportCsvBtn = document.getElementById("exportCsv");
  const exportPdfBtn = document.getElementById("exportPdf");

  // Root per Structural / Macro
  const legacyRoot = document.getElementById("checklistRoot");
  const structuralRoot =
    document.getElementById("checklistRootStructural") || legacyRoot;
  const macroRoot = document.getElementById("checklistRootMacro") || null;

  // Header STRUCTURAL
  const checklistCounter = document.getElementById("checklistCounter");
  const checklistScore = document.getElementById("checklistScore");
  const checklistMax = document.getElementById("checklistMax");

  // Header MACRO
  const checklistCounterMacro = document.getElementById("checklistCounterMacro");
  const checklistScoreMacro = document.getElementById("checklistScoreMacro");
  const checklistMaxMacro = document.getElementById("checklistMaxMacro");

  const SCALE_LABELS = {
    0: "0 ★ - Does not meet the criteria",
    1: "1 ★ - Minimally meets the criteria",
    2: "2 ★ - Meets some criteria, with gaps",
    3: "3 ★ - Adequately meets the criteria",
    4: "4 ★ - Meets criteria well",
    5: "5 ★ - Model of best practice",
  };

  let checklistData = null;
  let checklistState = {
    scores: {}, // { [itemId]: number }
    committedGroups: {}, // { [groupId]: true }
  };

  // ---- MAPPING COLORI (arcobaleno Apple) ----
  const COLOR_MAP = {
    /* =========================
       STRUCTURAL ITEMS (S)
       ========================= */

    // TITLE – rosso
    ti: "title",
    title: "title",
    "title": "title",

    // ABSTRACT – arancio
    ab: "abstract",
    abstract: "abstract",

    // INTRODUCTION – giallo
    in: "introduction",
    introduction: "introduction",

    // METHODS – verde
    me: "methods",
    methods: "methods",

    // RESULTS – teal
    re: "results",
    results: "results",

    // DISCUSSION – blu
    di: "discussion",
    discussion: "discussion",

    // CONCLUSIONS – indigo
    co: "conclusions",
    conclusions: "conclusions",

    // OTHER ELEMENTS – etica / purple
    oe: "ethics",
    "other elements": "ethics",

    /* =========================
       MACRO-TOPIC ITEMS (M)
       ========================= */

    // Study Identification → come TITLE (rosso)
    si: "title",
    "study identification": "title",

    // Structured Summary → come ABSTRACT (arancio)
    ss: "abstract",
    "structured summary": "abstract",

    // Background & Objectives → INTRODUCTION (giallo)
    bo: "introduction",
    "background & objectives": "introduction",

    // Study Design and Methods → METHODS (verde)
    sd: "methods",
    "study design and methods": "methods",

    // Data Handling → METHODS (verde, parte operativa)
    dh: "methods",
    "data handling": "methods",

    // Model Details → METHODS (verde, modello)
    md: "methods",
    "model details": "methods",

    // Performance Metrics → RESULTS (teal)
    pm: "results",
    "performance metrics": "results",

    // Results and Findings → RESULTS (teal)
    rf: "results",
    "results and findings": "results",

    // Discussion and Implications → DISCUSSION (blu)
    di2: "discussion",
    "discussion and implications": "discussion",

    // Ethics and Governance → ETHICS (viola)
    eg: "ethics",
    "ethics and governance": "ethics",

    // Human Factors and Usability → LIMITATIONS/USABILITY (viola/secondario)
    hf: "limitations",
    "human factors and usability": "limitations",

    // Transparency and Reproducibility → FUTURE (prospettive / viola)
    tr: "future",
    "transparency and reproducibility": "future",
  };

  function getColorKey(group) {
    const candidates = [];

    if (group.code) candidates.push(group.code);
    if (group.id) candidates.push(group.id);
    if (group.label) candidates.push(group.label);

    for (const raw of candidates) {
      if (!raw) continue;
      const key = raw.toString().toLowerCase().trim();

      if (COLOR_MAP[key]) return COLOR_MAP[key];

      const cleaned = key.replace(/\s+/g, "-");
      if (COLOR_MAP[cleaned]) return COLOR_MAP[cleaned];

      // es. "sti" -> "ti"
      if (key.length === 3) {
        const lastTwo = key.slice(1);
        if (COLOR_MAP[lastTwo]) return COLOR_MAP[lastTwo];
      }

      // es. "sti-title" -> "sti", "title"
      const parts = key.split(/[-_]/);
      if (parts.length > 1) {
        for (const p of parts) {
          if (COLOR_MAP[p]) return COLOR_MAP[p];
        }
      }
    }

    return null;
  }

  // ---- SCORE PANEL (solo barre) ----
  const CLARITY_STRUCTURAL_MAX = 190;
  const CLARITY_MACRO_MAX = 215;
  const CLARITY_TOTAL_MAX = CLARITY_STRUCTURAL_MAX + CLARITY_MACRO_MAX; // 405

  function getStructuralLevel(score) {
    if (score >= 171) return ["Excellent Completeness", "csp-badge-excellent"];
    if (score >= 152) return ["High Completeness", "csp-badge-high"];
    if (score >= 133) return ["Moderate Completeness", "csp-badge-moderate"];
    if (score >= 114) return ["Basic Completeness", "csp-badge-basic"];
    if (score >= 95)  return ["Low Completeness", "csp-badge-low"];
    if (score >= 76)  return ["Very Low Completeness", "csp-badge-verylow"];
    return ["Incomplete", "csp-badge-incomplete"];
  }

  function getMacroLevel(score) {
    if (score >= 193) return ["Excellent Completeness", "csp-badge-excellent"];
    if (score >= 171) return ["High Completeness", "csp-badge-high"];
    if (score >= 150) return ["Moderate Completeness", "csp-badge-moderate"];
    if (score >= 128) return ["Basic Completeness", "csp-badge-basic"];
    if (score >= 107) return ["Low Completeness", "csp-badge-low"];
    if (score >= 85)  return ["Very Low Completeness", "csp-badge-verylow"];
    return ["Incomplete", "csp-badge-incomplete"];
  }

  function updateClarityScorePanel(structuralScore, macroScore) {
    const structuralScoreEl   = document.getElementById("clarityStructuralScore");
    const structuralBadgeEl   = document.getElementById("clarityStructuralBadge");
    const structuralBadgeTxt  = document.getElementById("clarityStructuralBadgeText");
    const structuralProgress  = document.getElementById("clarityStructuralProgress");

    const macroScoreEl        = document.getElementById("clarityMacroScore");
    const macroBadgeEl        = document.getElementById("clarityMacroBadge");
    const macroBadgeTxt       = document.getElementById("clarityMacroBadgeText");
    const macroProgress       = document.getElementById("clarityMacroProgress");

    const totalScoreEl        = document.getElementById("clarityTotalScore");
    const totalProgress       = document.getElementById("clarityTotalProgress");

    // se il pannello non esiste, esci
    if (!structuralScoreEl || !macroScoreEl) return;

    // Structural
    structuralScoreEl.textContent = `${structuralScore} / ${CLARITY_STRUCTURAL_MAX}`;
    const [structLabel, structClass] = getStructuralLevel(structuralScore);
    structuralBadgeTxt.textContent = structLabel;
    structuralBadgeEl.className = `csp-badge ${structClass}`;
    const structPerc = Math.max(
      0,
      Math.min(100, (structuralScore / CLARITY_STRUCTURAL_MAX) * 100)
    );
    if (structuralProgress) structuralProgress.style.width = `${structPerc}%`;

    // Macro
    macroScoreEl.textContent = `${macroScore} / ${CLARITY_MACRO_MAX}`;
    const [macroLabel, macroClass] = getMacroLevel(macroScore);
    macroBadgeTxt.textContent = macroLabel;
    macroBadgeEl.className = `csp-badge ${macroClass}`;
    const macroPerc = Math.max(
      0,
      Math.min(100, (macroScore / CLARITY_MACRO_MAX) * 100)
    );
    if (macroProgress) macroProgress.style.width = `${macroPerc}%`;

    // Totale globale
    if (totalScoreEl) {
      const totalScore = structuralScore + macroScore;
      totalScoreEl.textContent = `${totalScore} / ${CLARITY_TOTAL_MAX}`;
      const totalPerc = Math.max(
        0,
        Math.min(100, (totalScore / CLARITY_TOTAL_MAX) * 100)
      );
      if (totalProgress) {
        totalProgress.style.width = `${totalPerc}%`;
      }
    }
  }

    // ---- HELPERS PER EXPORT (totali + righe) ----
  function getCurrentScoresFromState() {
    let structuralScoreSum = 0;
    let macroScoreSum = 0;

    if (!checklistData || !Array.isArray(checklistData.sections)) {
      return { structural: 0, macro: 0 };
    }

    checklistData.sections.forEach((section) => {
      const isMacroSection =
        typeof section.id === "string" &&
        section.id.trim().toUpperCase().startsWith("M");

      section.groups.forEach((group) => {
        group.items.forEach((item) => {
          const val = checklistState.scores[item.id];
          const score = typeof val === "number" ? val : 0;
          if (isMacroSection) {
            macroScoreSum += score;
          } else {
            structuralScoreSum += score;
          }
        });
      });
    });

    return { structural: structuralScoreSum, macro: macroScoreSum };
  }

  function buildExportRows() {
    if (!checklistData || !Array.isArray(checklistData.sections)) {
      alert("Checklist not loaded yet.");
      return null;
    }

    const rows = [];

    checklistData.sections.forEach((section) => {
      const isMacroSection =
        typeof section.id === "string" &&
        section.id.trim().toUpperCase().startsWith("M");

      const sectionType = isMacroSection ? "Macro-topic" : "Structural";

      section.groups.forEach((group) => {
        const groupCode = group.code || "";
        const groupLabel = group.label || "";

        group.items.forEach((item) => {
          const rawVal = checklistState.scores[item.id];
          const score =
            typeof rawVal === "number" || typeof rawVal === "string"
              ? rawVal
              : "";

          rows.push({
            sectionType,
            sectionId: section.id,
            sectionLabel: section.label || "",
            groupCode,
            groupLabel,
            itemId: item.id,
            itemLabel: item.label || "",
            score,
          });
        });
      });
    });

    return rows;
  }

    function exportCsv() {
    const rows = buildExportRows();
    if (!rows) return;

    const { structural, macro } = getCurrentScoresFromState();
    const total = structural + macro;

    const lines = [];

    // Intestazione "Summary"
    lines.push("Summary");
    lines.push(`Structural total,${structural},/ ${CLARITY_STRUCTURAL_MAX}`);
    lines.push(`Macro total,${macro},/ ${CLARITY_MACRO_MAX}`);
    lines.push(`Global total,${total},/ ${CLARITY_TOTAL_MAX}`);
    lines.push(""); // riga vuota

    // Header tabellare
    lines.push(
      [
        "SectionType",
        "SectionId",
        "SectionLabel",
        "GroupCode",
        "GroupLabel",
        "ItemId",
        "ItemLabel",
        "Score",
      ].join(",")
    );

    // Righe item
    rows.forEach((r) => {
      const values = [
        r.sectionType,
        r.sectionId,
        r.sectionLabel,
        r.groupCode,
        r.groupLabel,
        r.itemId,
        r.itemLabel,
        r.score,
      ];

      const escaped = values.map((v) => {
        const s = String(v ?? "");
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      });

      lines.push(escaped.join(","));
    });

    const blob = new Blob([lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "clarity-checklist-results.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

    function exportPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF export not available (jsPDF not loaded).");
      return;
    }

    const rows = buildExportRows();
    if (!rows) return;

    const { structural, macro } = getCurrentScoresFromState();
    const total = structural + macro;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    // Titolo
    doc.setFontSize(18);
    doc.text("CLARITY AI – Checklist Results", 40, 40);

    // Riepilogo
    doc.setFontSize(11);
    doc.text(
      `Structural: ${structural}/${CLARITY_STRUCTURAL_MAX}   •   Macro: ${macro}/${CLARITY_MACRO_MAX}   •   Global: ${total}/${CLARITY_TOTAL_MAX}`,
      40,
      60
    );

    const head = [["Type", "Section", "Group", "Item", "Score"]];
    const body = rows.map((r) => [
      r.sectionType,
      `${r.sectionId} – ${r.sectionLabel}`.trim(),
      `${r.groupCode ? r.groupCode + " – " : ""}${r.groupLabel}`.trim(),
      `${r.itemId} – ${r.itemLabel}`.trim(),
      r.score === "" ? "-" : String(r.score),
    ]);

    if (typeof doc.autoTable === "function") {
      doc.autoTable({
        head,
        body,
        startY: 80,
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [10, 132, 255],
          textColor: 255,
        },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 180 },
          2: { cellWidth: 140 },
          3: { cellWidth: 280 },
          4: { cellWidth: 40, halign: "center" },
        },
      });
    }

    doc.save("clarity-checklist-results.pdf");
  }


  // ---- STATE HELPERS ----
  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        checklistState = {
          scores: parsed.scores || {},
          committedGroups: parsed.committedGroups || {},
        };
      }
    } catch (err) {
      console.warn("Failed to load saved state:", err);
    }
  }

  function persistState() {
    try {
      localStorage.setItem(
        STATE_KEY,
        JSON.stringify({
          scores: checklistState.scores,
          committedGroups: checklistState.committedGroups,
        })
      );
    } catch (err) {
      console.warn("Failed to save state:", err);
    }
  }

  function clearState() {
    checklistState = {
      scores: {},
      committedGroups: {},
    };
    localStorage.removeItem(STATE_KEY);
  }

  // ---- RENDERING ----
  function buildChecklist(sections) {
    if (structuralRoot) structuralRoot.innerHTML = "";
    if (macroRoot) macroRoot.innerHTML = "";

    let structuralMaxTotal = 0;
    let macroMaxTotal = 0;

    sections.forEach((section) => {
      // Sezione macro se l'id inizia per "M"
      const isMacroSection =
        typeof section.id === "string" &&
        section.id.trim().toUpperCase().startsWith("M");

      const targetRoot = isMacroSection ? macroRoot : structuralRoot;
      if (!targetRoot) return;

      const sectionMaxScore = Number(section.maxScore || 0);
      if (isMacroSection) {
        macroMaxTotal += sectionMaxScore;
      } else {
        structuralMaxTotal += sectionMaxScore;
      }

      const sectionEl = document.createElement("div");
      sectionEl.className = "checklist-section";
      sectionEl.dataset.sectionId = section.id;

      // Header interno (al momento nascosto via CSS, ma lo lasciamo per semantica)
      const sectionHeader = document.createElement("div");
      sectionHeader.className = "section-header";

      const sectionTitle = document.createElement("div");
      sectionTitle.className = "section-title";
      sectionTitle.textContent = section.label;

      const sectionMax = document.createElement("div");
      sectionMax.className = "section-max";
      sectionMax.textContent = `Max score: ${section.maxScore}`;

      sectionHeader.appendChild(sectionTitle);
      sectionHeader.appendChild(sectionMax);
      sectionEl.appendChild(sectionHeader);

      // Groups (Title, Abstract, ecc.)
      section.groups.forEach((group) => {
        const groupId = `${section.id}-${group.code}`; // es. "S-TI"

        const groupEl = document.createElement("div");
        // group-card + item-group per Apple-style
        groupEl.className = "group-card item-group";
        groupEl.dataset.groupId = groupId;

        // Colore del gruppo
        const colorKey = getColorKey(group);
        if (colorKey) {
          groupEl.classList.add(`item-group--${colorKey}`);
        }

        if (checklistState.committedGroups[groupId]) {
          groupEl.classList.add("group-committed");
        }

        const groupHeader = document.createElement("div");
        groupHeader.className = "group-header";

        const groupLeft = document.createElement("div");
        groupLeft.className = "group-header-left";

        const groupLabel = document.createElement("div");
        groupLabel.className = "group-label item-group-label";
        groupLabel.textContent = group.label;

        const groupStatus = document.createElement("div");
        groupStatus.className = "group-status-chip";
        groupStatus.textContent = checklistState.committedGroups[groupId]
          ? "Committed"
          : "In progress";

        groupLeft.appendChild(groupLabel);
        groupLeft.appendChild(groupStatus);

        const groupActions = document.createElement("div");
        groupActions.className = "group-actions";

        const btnReset = document.createElement("button");
        btnReset.type = "button";
        btnReset.className = "btn-secondary btn-small";
        btnReset.textContent = "Reset section";
        btnReset.dataset.action = "reset-group";

        const btnCommit = document.createElement("button");
        btnCommit.type = "button";
        btnCommit.className = "btn-secondary btn-small btn-commit";
        btnCommit.textContent = "Commit section";
        btnCommit.dataset.action = "commit-group";

        groupActions.appendChild(btnReset);
        groupActions.appendChild(btnCommit);

        groupHeader.appendChild(groupLeft);
        groupHeader.appendChild(groupActions);
        groupEl.appendChild(groupHeader);

        // Corpo: items
        const groupBody = document.createElement("div");
        groupBody.className = "group-body";

        group.items.forEach((item, index) => {
          const itemEl = document.createElement("div");
          itemEl.className = "checklist-item";

          const indexEl = document.createElement("div");
          indexEl.className = "checklist-index";
          indexEl.textContent = String(index + 1);

          const contentEl = document.createElement("div");
          contentEl.className = "checklist-content";

          const labelEl = document.createElement("div");
          labelEl.className = "checklist-label";
          labelEl.textContent = `${item.id} – ${item.label}`;

          const descEl = document.createElement("div");
          descEl.className = "checklist-help";
          descEl.textContent = item.description || "";

          const controlsEl = document.createElement("div");
          controlsEl.className = "checklist-controls";

          const selectEl = document.createElement("select");
          selectEl.className = "checklist-select";
          selectEl.dataset.itemId = item.id;
          selectEl.dataset.groupId = groupId;

          const defaultOpt = document.createElement("option");
          defaultOpt.value = "";
          defaultOpt.textContent = "Select…";
          selectEl.appendChild(defaultOpt);

          (item.scale || []).forEach((val) => {
            const opt = document.createElement("option");
            opt.value = String(val);
            opt.textContent =
              SCALE_LABELS[val] !== undefined
                ? SCALE_LABELS[val]
                : String(val);
            selectEl.appendChild(opt);
          });

          const savedValue = checklistState.scores[item.id];
          if (savedValue !== undefined && savedValue !== null) {
            selectEl.value = String(savedValue);
          }

          const chipEl = document.createElement("span");
          chipEl.className = "score-chip";
          chipEl.dataset.scoreChip = "true";
          const initialScore =
            savedValue !== undefined && savedValue !== null ? savedValue : 0;
          chipEl.textContent = `Score: ${initialScore}`;

          controlsEl.appendChild(selectEl);
          controlsEl.appendChild(chipEl);

          contentEl.appendChild(labelEl);
          contentEl.appendChild(descEl);
          contentEl.appendChild(controlsEl);

          itemEl.appendChild(indexEl);
          itemEl.appendChild(contentEl);
          groupBody.appendChild(itemEl);
        });

        groupEl.appendChild(groupBody);
        sectionEl.appendChild(groupEl);
      });

      targetRoot.appendChild(sectionEl);
    });

    // Aggiorniamo i Max negli header principali
    if (checklistMax) {
      checklistMax.textContent = ` / Max: ${structuralMaxTotal}`;
    }
    if (checklistMaxMacro) {
      checklistMaxMacro.textContent = ` / Max: ${macroMaxTotal}`;
    }

    updateScore();
  }

  // ---- SCORING ----
  function updateScore() {
    const allSelects = document.querySelectorAll(".checklist-select");

    let structuralItems = 0;
    let structuralScoreSum = 0;
    let macroItems = 0;
    let macroScoreSum = 0;

    allSelects.forEach((select) => {
      const val = select.value ? Number(select.value) : 0;

      const chip = select
        .closest(".checklist-item")
        ?.querySelector("[data-score-chip], .score-chip");
      if (chip) {
        chip.textContent = `Score: ${val}`;
      }

      const isMacro = !!select.closest(".card-checklist--macro");
      if (isMacro) {
        macroItems += 1;
        macroScoreSum += val;
      } else {
        structuralItems += 1;
        structuralScoreSum += val;
      }
    });

    if (checklistCounter) {
      checklistCounter.textContent = `${structuralItems} item${
        structuralItems !== 1 ? "s" : ""
      }`;
    }
    if (checklistScore) {
      checklistScore.textContent = `Total score: ${structuralScoreSum}`;
    }

    if (checklistCounterMacro) {
      checklistCounterMacro.textContent = `${macroItems} item${
        macroItems !== 1 ? "s" : ""
      }`;
    }
    if (checklistScoreMacro) {
      checklistScoreMacro.textContent = `Total score: ${macroScoreSum}`;
    }

    // aggiorna pannello di destra
    updateClarityScorePanel(structuralScoreSum, macroScoreSum);
  }

  function updateGroupStatusVisual(groupId) {
    const groupEl = document.querySelector(
      `.group-card[data-group-id="${groupId}"]`
    );
    if (!groupEl) return;

    const statusEl = groupEl.querySelector(".group-status-chip");
    if (!statusEl) return;

    const committed = !!checklistState.committedGroups[groupId];

    if (committed) {
      groupEl.classList.add("group-committed");
      statusEl.textContent = "Committed";
    } else {
      groupEl.classList.remove("group-committed");
      statusEl.textContent = "In progress";
    }
  }

  // ---- EVENTI ----
  function handleSelectChange(event) {
    if (!event.target.matches(".checklist-select")) return;

    const select = event.target;
    const itemId = select.dataset.itemId;
    const value = select.value === "" ? null : Number(select.value);

    if (!itemId) return;

    if (value === null) {
      delete checklistState.scores[itemId];
    } else {
      checklistState.scores[itemId] = value;
    }
    persistState();
    updateScore();
  }

  function handleGroupButtonClick(event) {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const groupEl = btn.closest(".group-card");
    if (!groupEl) return;
    const groupId = groupEl.dataset.groupId;

    if (action === "reset-group") {
      const selects = groupEl.querySelectorAll(".checklist-select");
      selects.forEach((s) => {
        const itemId = s.dataset.itemId;
        s.value = "";
        if (itemId) {
          delete checklistState.scores[itemId];
        }
      });
      delete checklistState.committedGroups[groupId];
      persistState();
      updateGroupStatusVisual(groupId);
      updateScore();
    }

    if (action === "commit-group") {
      checklistState.committedGroups[groupId] = true;
      persistState();
      updateGroupStatusVisual(groupId);
    }
  }

  [structuralRoot, macroRoot].forEach((root) => {
    if (!root) return;
    root.addEventListener("change", handleSelectChange);
    root.addEventListener("click", handleGroupButtonClick);
  });

  // Start checklist
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      const firstGroup = document.querySelector(".group-card");
      if (firstGroup) {
        firstGroup.scrollIntoView({ behavior: "smooth", block: "start" });
        const firstSelect = firstGroup.querySelector(".checklist-select");
        if (firstSelect) {
          firstSelect.focus();
        }
      }
    });
  }

  // Reset ALL
  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", () => {
      const confirmReset = window.confirm(
        "Reset all sections? This will clear all scores and committed states."
      );
      if (!confirmReset) return;

      clearState();

      const selects = document.querySelectorAll(".checklist-select");
      selects.forEach((s) => {
        s.value = "";
      });

      const groups = document.querySelectorAll(".group-card");
      groups.forEach((g) => g.classList.remove("group-committed"));

      const statuses = document.querySelectorAll(".group-status-chip");
      statuses.forEach((st) => (st.textContent = "In progress"));

      updateScore();
    });
  }

  // Commit ALL
  if (commitAllBtn) {
    commitAllBtn.addEventListener("click", () => {
      const groups = document.querySelectorAll(".group-card");
      groups.forEach((g) => {
        const groupId = g.dataset.groupId;
        if (!groupId) return;
        checklistState.committedGroups[groupId] = true;
        updateGroupStatusVisual(groupId);
      });
      persistState();
    });
  }

  if (resetAllMacroBtn) {
    resetAllMacroBtn.addEventListener("click", () => {
      if (!confirm("Reset all MACRO sections?")) return;

      const macroGroups = document.querySelectorAll(
        ".card-checklist--macro .group-card"
      );

      macroGroups.forEach((group) => {
        const selects = group.querySelectorAll(".checklist-select");
        selects.forEach((s) => {
          delete checklistState.scores[s.dataset.itemId];
          s.value = "";
        });
        delete checklistState.committedGroups[group.dataset.groupId];
        updateGroupStatusVisual(group.dataset.groupId);
      });

      persistState();
      updateScore();
    });
  }

  if (commitAllMacroBtn) {
    commitAllMacroBtn.addEventListener("click", () => {
      const macroGroups = document.querySelectorAll(
        ".card-checklist--macro .group-card"
      );

      macroGroups.forEach((g) => {
        checklistState.committedGroups[g.dataset.groupId] = true;
        updateGroupStatusVisual(g.dataset.groupId);
      });

      persistState();
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", exportCsv);
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", exportPdf);
  }

  // ---- GUIDELINES COLLAPSE ----
  const guidelinesCard = document.querySelector(".card-guidelines");
  const guidelinesToggle = document.querySelector(".guidelines-toggle");
  const guidelinesLabel = document.querySelector(".guidelines-toggle-label");

  if (guidelinesCard && guidelinesToggle && guidelinesLabel) {
    // ✅ di default: SEZIONE CHIUSA
    guidelinesCard.classList.add("collapsed");
    guidelinesToggle.setAttribute("aria-expanded", "false");
    guidelinesLabel.textContent = "Show details";

    guidelinesToggle.addEventListener("click", () => {
      const collapsed = guidelinesCard.classList.toggle("collapsed");
      if (collapsed) {
        guidelinesToggle.setAttribute("aria-expanded", "false");
        guidelinesLabel.textContent = "Show details";
      } else {
        guidelinesToggle.setAttribute("aria-expanded", "true");
        guidelinesLabel.textContent = "Hide details";
      }
    });
  }
  
  // ---- INIT ----
  loadState();

  fetch("data/clarity-checklist.json")
    .then((res) => res.json())
    .then((data) => {
      checklistData = data;
      if (!Array.isArray(checklistData.sections)) {
        console.error("Invalid checklist data. Expected sections[]");
        const target =
          structuralRoot || macroRoot || document.getElementById("checklistRoot");
        if (target) {
          target.innerHTML =
            '<p style="font-size: 13px; color: #c00;">Invalid checklist configuration.</p>';
        }
        return;
      }
      buildChecklist(checklistData.sections);
    })
    .catch((err) => {
      console.error("Failed to load checklist JSON:", err);
      const target =
        structuralRoot || macroRoot || document.getElementById("checklistRoot");
      if (target) {
        target.innerHTML =
          '<p style="font-size: 13px; color: #c00;">Unable to load checklist configuration.</p>';
      }
    });
});
