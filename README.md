# ChAMAI Checklist – Web Edition

An interactive Apple-style web tool for evaluating the methodological quality of medical AI studies.

---

## 📘 Overview

**ChAMAI (Checklist for Assessment of Medical AI)** è un framework progettato per valutare la qualità metodologica e la trasparenza degli studi basati su AI/ML in medicina.
Questa web-app riproduce l’intera checklist in una versione **interattiva e pulita**, completamente eseguibile nel browser.

La piattaforma è **statica**, sviluppata in **HTML + CSS + JavaScript**, e può essere pubblicata facilmente tramite **GitHub Pages**.

---

## ✨ Features

* **Interactive scoring system**
  Valutazione per item con opzioni NA / OK / mR / MR secondo le linee guida ChAMAI.

* **Apple-inspired UI/UX**
  Tipografia chiara, card arrotondate, ombre morbide e un design moderno e leggibile.

* **Fully static and lightweight**
  Nessuna dipendenza esterna, nessun backend, caricamento immediato.

* **Automatic score calculation**
  Totali aggiornati in tempo reale, con differenziazione per priorità alta/bassa.

---

## 🏗️ Technology Stack

* **HTML5**
* **CSS3** (Apple-style custom)
* **JavaScript** (render dinamico + scoring)
* **JSON** (struttura e contenuti della checklist)
* **GitHub Pages** (hosting)

---

## 📦 Project Structure

```
chamai-checklist/
│
├── assets/
│   ├── css/style.css
│   ├── js/app.js
│   └── img/
│
├── data/
│   └── chamai-checklist.json
│
├── index.html
├── checklist.html
└── README.md
```