// ahaChat.js
// ─────────────────────────────────────────────
// AHA Chat – ren klient over InsightsEngine
// ─────────────────────────────────────────────

const SUBJECT_ID = "sub_laring";
const STORAGE_KEY = "aha_insight_chamber_v1";

// ── Lagring av kammer ───────────────────────

function loadChamberFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return InsightsEngine.createEmptyChamber();
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Kunne ikke laste innsiktskammer, lager nytt.", e);
    return InsightsEngine.createEmptyChamber();
  }
}

function saveChamberToStorage(chamber) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chamber));
  } catch (e) {
    console.warn("Kunne ikke lagre innsiktskammer.", e);
  }
}

// ── UI helpers ───────────────────────────────

function getCurrentThemeId() {
  const input = document.getElementById("theme-id");
  const val = input && input.value.trim();
  return val || "th_default";
}

function getOutEl() {
  return document.getElementById("out");
}

function clearOutput() {
  const el = getOutEl();
  if (el) el.textContent = "";
}

function log(msg) {
  const el = getOutEl();
  if (!el) return;
  el.textContent += msg + "\n";
}

function getChatLogEl() {
  return document.getElementById("chat-log");
}

function addChatMessage(text, sender) {
  const logEl = getChatLogEl();
  if (!logEl) return;

  const row = document.createElement("div");
  row.className = "msg-row " + (sender === "user" ? "user" : "system");

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = text;

  row.appendChild(bubble);
  logEl.appendChild(row);

  // auto-scroll til bunn
  logEl.scrollTop = logEl.scrollHeight;
}

// ── AHA operations (bruker motoren) ──────────

function handleUserMessage(messageText) {
  const sentences = InsightsEngine.splitIntoSentences(messageText);
  const themeId = getCurrentThemeId();

  let chamber = loadChamberFromStorage();

  if (sentences.length === 0) {
    const signal = InsightsEngine.createSignalFromMessage(
      messageText,
      SUBJECT_ID,
      themeId
    );
    chamber = InsightsEngine.addSignalToChamber(chamber, signal);
    saveChamberToStorage(chamber);
    return 1;
  }

  sentences.forEach((sentence) => {
    const signal = InsightsEngine.createSignalFromMessage(
      sentence,
      SUBJECT_ID,
      themeId
    );
    chamber = InsightsEngine.addSignalToChamber(chamber, signal);
  });

  saveChamberToStorage(chamber);
  return sentences.length;
}

function showInsightsForCurrentTopic() {
  const chamber = loadChamberFromStorage();
  const themeId = getCurrentThemeId();
  const insights = InsightsEngine.getInsightsForTopic(
    chamber,
    SUBJECT_ID,
    themeId
  );

  clearOutput();

  if (insights.length === 0) {
    log("Ingen innsikter ennå for tema: " + themeId);
    return;
  }

  log("Innsikter for temaet: " + themeId);
  insights.forEach((ins, idx) => {
    const sem = ins.semantic || {};
    log(
      (idx + 1) +
        ". " +
        ins.title +
        " (score: " +
        ins.strength.total_score +
        ", freq: " +
        (sem.frequency || "ukjent") +
        ", valens: " +
        (sem.valence || "nøytral") +
        ")"
    );
  });
}

function showTopicStatus() {
  const chamber = loadChamberFromStorage();
  const themeId = getCurrentThemeId();
  const stats = InsightsEngine.computeTopicStats(
    chamber,
    SUBJECT_ID,
    themeId
  );

  clearOutput();
  log("Status for tema " + themeId + ":");
  log("- Innsikter: " + stats.insight_count);
  log("- Innsiktsmetningsgrad: " + stats.insight_saturation + "/100");
  log("- Begrepstetthet: " + stats.concept_density + "/100");
  log("→ Foreslått form: " + stats.artifact_type);
}

function showSynthesisForCurrentTopic() {
  const chamber = loadChamberFromStorage();
  const themeId = getCurrentThemeId();
  const insights = InsightsEngine.getInsightsForTopic(
    chamber,
    SUBJECT_ID,
    themeId
  );
  const txt = InsightsEngine.createSynthesisText(
    insights,
    themeId
  );
  clearOutput();
  log(txt);
}

function showPathForCurrentTopic() {
  const chamber = loadChamberFromStorage();
  const themeId = getCurrentThemeId();
  const insights = InsightsEngine.getInsightsForTopic(
    chamber,
    SUBJECT_ID,
    themeId
  );

  const steps = InsightsEngine.createPathSteps(insights, 5);
  clearOutput();
  log("Foreslått sti for temaet " + themeId + ":");
  steps.forEach((s) => log(s));
}

function showSemanticSummaryForCurrentTopic() {
  const chamber = loadChamberFromStorage();
  const themeId = getCurrentThemeId();
  const insights = InsightsEngine.getInsightsForTopic(
    chamber,
    SUBJECT_ID,
    themeId
  );

  clearOutput();

  if (insights.length === 0) {
    log("Ingen innsikter å oppsummere ennå for tema: " + themeId);
    return;
  }

  const counts = InsightsEngine.computeSemanticCounts(insights);

  log("Semantisk sammendrag for tema " + themeId + ":");

  log("• Frekvens:");
  Object.entries(counts.frequency).forEach(([k, v]) => {
    if (v > 0) log("  - " + k + ": " + v);
  });

  log("• Valens:");
  Object.entries(counts.valence).forEach(([k, v]) => {
    if (v > 0) log("  - " + k + ": " + v);
  });

  log("• Modalitet:");
  Object.entries(counts.modality).forEach(([k, v]) => {
    if (v > 0) log("  - " + k + ": " + v);
  });

  log("• Tid:");
  Object.entries(counts.time_ref).forEach(([k, v]) => {
    if (v > 0) log("  - " + k + ": " + v);
  });

  log("• Tempo:");
  Object.entries(counts.tempo).forEach(([k, v]) => {
    if (v > 0) log("  - " + k + ": " + v);
  });

  log("• Metaspråk:");
  Object.entries(counts.meta).forEach(([k, v]) => {
    if (v > 0) log("  - " + k + ": " + v);
  });

  log("• Kontraster/absolutter:");
  log("  - Setninger med kontrastord: " + counts.contrast_count);
  log("  - Setninger med absolutter: " + counts.absolute_count);
}

function showAutoArtifactForCurrentTopic() {
  const chamber = loadChamberFromStorage();
  const themeId = getCurrentThemeId();
  const insights = InsightsEngine.getInsightsForTopic(
    chamber,
    SUBJECT_ID,
    themeId
  );
  const stats = InsightsEngine.computeTopicStats(
    chamber,
    SUBJECT_ID,
    themeId
  );

  clearOutput();

  if (insights.length === 0) {
    log("Ingen innsikter ennå – ingen artefakt å vise for tema: " + themeId);
    return;
  }

  log("Auto-artefakt for tema " + themeId + ":");
  log("Form (basert på stats): " + stats.artifact_type);
  log("");

  if (stats.artifact_type === "kort") {
    const first = insights[0];
    log("Viser ett enkelt innsiktskort:");
    log("- " + first.summary);
  } else if (stats.artifact_type === "liste") {
    log("Liste over innsikter:");
    insights.forEach((ins, idx) => {
      log(idx + 1 + ". " + ins.title);
    });
  } else if (stats.artifact_type === "sti") {
    log("Sti-beskrivelse:");
    const steps = InsightsEngine.createPathSteps(insights, 5);
    steps.forEach((s) => log(s));
  } else if (stats.artifact_type === "artikkel") {
    const draft = InsightsEngine.createArticleDraft(
      insights,
      stats,
      themeId
    );
    log(draft);
  } else {
    log("Ukjent artefakt-type, viser liste som fallback:");
    insights.forEach((ins, idx) => {
      log(idx + 1 + ". " + ins.title);
    });
  }
}

function suggestNextActionForCurrentTopic() {
  const chamber = loadChamberFromStorage();
  const themeId = getCurrentThemeId();
  const insights = InsightsEngine.getInsightsForTopic(
    chamber,
    SUBJECT_ID,
    themeId
  );

  clearOutput();

  if (insights.length === 0) {
    log(
      "AHA-agent: Du har ingen innsikter i dette temaet ennå (" +
        themeId +
        ")."
    );
    log("Skriv noen tanker først, så kan jeg foreslå neste steg.");
    return;
  }

  const stats = InsightsEngine.computeTopicStats(
    chamber,
    SUBJECT_ID,
    themeId
  );
  const counts = InsightsEngine.computeSemanticCounts(insights);

  const total = insights.length || 1;
  const freqAlltid = counts.frequency.alltid;
  const freqOfte = counts.frequency.ofte;
  const neg = counts.valence.negativ;
  const krav = counts.modality.krav;
  const hindring = counts.modality.hindring;

  log("AHA-agent – forslag for tema " + themeId + ":");
  log("");

  log("1) Slik jeg leser innsiktskammeret ditt nå:");
  log(
    "- Du har " +
      stats.insight_count +
      " innsikter i dette temaet " +
      "(metningsgrad " +
      stats.insight_saturation +
      "/100, " +
      "begrepstetthet " +
      stats.concept_density +
      "/100)."
  );

  if (freqAlltid + freqOfte > 0) {
    const andel = Math.round(
      ((freqAlltid + freqOfte) / total) * 100
    );
    log(
      "- " +
        andel +
        "% av innsiktene beskriver noe som skjer «ofte» eller «alltid»."
    );
  }

  if (neg > 0) {
    const andelNeg = Math.round((neg / total) * 100);
    log(
      "- " +
        andelNeg +
        "% av innsiktene har negativ valens (stress, ubehag, vanskelige følelser)."
    );
  }

  if (krav + hindring > 0) {
    log(
      "- Flere setninger inneholder «må/burde/skal» eller «klarer ikke/får ikke til» – altså både krav og hindring."
    );
  }

  log("");
  log("2) Hva motoren mener er neste naturlige steg:");

  if (stats.insight_saturation < 30) {
    log(
      "- Du er fortsatt i utforskningsfasen. Neste steg er å beskrive mønsteret enda litt mer: " +
        "hvordan kjennes det ut i kroppen, hva gjør du konkret, og hva skjer etterpå?"
    );
  } else if (
    stats.insight_saturation >= 30 &&
    stats.insight_saturation < 60
  ) {
    if (neg > 0 && (freqAlltid + freqOfte) > 0) {
      log(
        "- Du har nok innsikt til å lage en liten sti. Et naturlig neste steg er å velge ÉN situasjon " +
          "der dette skjer ofte, og definere et lite eksperiment du kan teste neste uke."
      );
    } else {
      log(
        "- Det er nok innsikt til å samle dette i en konkret liste eller sti. " +
          "Neste steg er å formulere 3–5 setninger som beskriver mønsteret ditt fra start til slutt."
      );
    }
  } else {
    if (stats.concept_density >= 60) {
      log(
        "- Temaet er ganske mettet og begrepstetthet høy. Neste steg er å skrive dette ut som en kort tekst " +
          "eller artikkel: Hva har du lært om deg selv her, og hvilke prinsipper tar du med deg videre?"
      );
    } else {
      log(
        "- Du har mange innsikter, men språket er fortsatt hverdagslig. " +
          "Neste steg er å prøve å samle det til 3–4 nøkkelbegreper eller overskrifter som beskriver det viktigste."
      );
    }
  }

  log("");
  log("3) Konkrete mikro-forslag du kan teste:");
  log("- Skriv én setning som starter med «Når dette skjer, pleier jeg…».");
  log("- Skriv én setning som starter med «Et lite eksperiment jeg kunne testet er…».");
  log("- Skriv én setning som starter med «Hvis dette faktisk fungerte bedre, ville livet mitt blitt litt mer…».");
}

function showDimensionSummaryForCurrentTopic() {
  const chamber = loadChamberFromStorage();
  const themeId = getCurrentThemeId();
  const insights = InsightsEngine.getInsightsForTopic(
    chamber,
    SUBJECT_ID,
    themeId
  );

  clearOutput();

  if (insights.length === 0) {
    log("Ingen innsikter å analysere dimensjoner av ennå for tema: " + themeId);
    return;
  }

  const counts = InsightsEngine.computeDimensionsSummary(insights);

  log("Dimensjonsfordeling for tema " + themeId + ":");
  Object.entries(counts).forEach(([dim, v]) => {
    if (v > 0) log("- " + dim + ": " + v + " innsikt(er)");
  });
}

function showDialecticViewForCurrentTopic() {
  const chamber = loadChamberFromStorage();
  const themeId = getCurrentThemeId();
  const insights = InsightsEngine.getInsightsForTopic(
    chamber,
    SUBJECT_ID,
    themeId
  );

  clearOutput();

  if (insights.length === 0) {
    log("Ingen innsikter å lage dialektikk av ennå for tema: " + themeId);
    return;
  }

  const theses = insights.filter((ins) => {
    const sem = ins.semantic || {};
    return (
      (sem.valence === "negativ" || sem.valence === "blandet") &&
      (sem.frequency === "ofte" || sem.frequency === "alltid")
    );
  });

  const antitheses = insights.filter((ins) => {
    const sem = ins.semantic || {};
    return (
      (sem.valence === "positiv" || sem.valence === "nøytral") &&
      (sem.frequency === "ofte" || sem.frequency === "alltid")
    );
  });

  log("Dialektisk visning for tema " + themeId + ":");
  log("");

  log("1) Teser (vanskelige mønstre som skjer ofte/alltid):");
  if (theses.length === 0) {
    log("- Ingen tydelige teser funnet.");
  } else {
    theses.slice(0, 5).forEach((ins, idx) => {
      log("  " + (idx + 1) + ". " + ins.summary);
    });
  }
  log("");

  log("2) Kontrateser (ressurser/lyspunkter som skjer ofte/alltid):");
  if (antitheses.length === 0) {
    log("- Ingen tydelige kontrateser funnet.");
  } else {
    antitheses.slice(0, 5).forEach((ins, idx) => {
      log("  " + (idx + 1) + ". " + ins.summary);
    });
  }
  log("");

  log("3) Syntese (V1 – enkel tekst):");
  if (theses.length === 0 && antitheses.length === 0) {
    log(
      "- Motoren ser ikke sterke motsetninger ennå. Neste steg er å utforske både det vanskelige " +
        "og det som fungerer litt, slik at det blir noe å lage syntese av."
    );
  } else if (theses.length > 0 && antitheses.length === 0) {
    log(
      "- Bildet er mest preget av det som er vanskelig. Syntesen nå er: «Dette er et tema der " +
        "det negative dominerer. Neste steg er å lete etter små unntak der det går litt bedre, " +
        "for å ha noe å bygge videre på.»"
    );
  } else if (theses.length === 0 && antitheses.length > 0) {
    log(
      "- Du har flere gode spor og erfaringer. Syntesen nå er: «Dette temaet rommer flere gode erfaringer. " +
        "Neste steg er å se om det fortsatt finnes noe som skurrer, eller om du kan bygge videre på det positive.»"
    );
  } else {
    log(
      "- Motoren ser både tydelige vanskeligheter og ressurser. Syntesen: «Dette er et område hvor du både sliter " +
        "og har noen gode spor. Neste steg er å undersøke hvordan du kan ta med deg det som fungerer inn i " +
        "situasjonene som er vanskeligst.»"
    );
  }
}

function showAllTopicsOverview() {
  const chamber = loadChamberFromStorage();
  const overview = InsightsEngine.computeTopicsOverview(chamber);

  clearOutput();

  if (overview.length === 0) {
    log("Ingen innsikter lagret ennå – ingen tema å vise.");
    return;
  }

  log("Oversikt over temaer i innsiktskammeret:");
  overview.forEach((t) => {
    log(
      "- " +
        t.topic_id +
        " (" +
        t.subject_id +
        "): " +
        t.insight_count +
        " innsikter, metning " +
        t.insight_saturation +
        "/100, tetthet " +
        t.concept_density +
        "/100 → form: " +
        t.artifact_type
    );
  });
}

function exportChamberJson() {
  const chamber = loadChamberFromStorage();
  clearOutput();
  log("Eksport av innsiktskammer (JSON):");
  log(JSON.stringify(chamber, null, 2));
}

// ── Setup ────────────────────────────────────

function setupUI() {
  const txt = document.getElementById("msg");
  const btnSend = document.getElementById("btn-send");

  const btnInsights = document.getElementById("btn-insights");
  const btnStatus = document.getElementById("btn-status");
  const btnSynth = document.getElementById("btn-synth");
  const btnPath = document.getElementById("btn-path");
  const btnSem = document.getElementById("btn-sem");
  const btnAuto = document.getElementById("btn-auto");
  const btnAgent = document.getElementById("btn-agent");
  const btnDim = document.getElementById("btn-dim");
  const btnDial = document.getElementById("btn-dial");
  const btnTopics = document.getElementById("btn-topics");
  const btnExport = document.getElementById("btn-export");
  const btnReset = document.getElementById("btn-reset");

  btnSend.addEventListener("click", () => {
    const val = (txt.value || "").trim();
    if (!val) return;

    // chat-boble
    addChatMessage(val, "user");

    const n = handleUserMessage(val);

    addChatMessage(
      `AHA: Jeg har lagt til ${n} setning(er) i innsiktskammeret for tema «${getCurrentThemeId()}».`,
      "system"
    );

    txt.value = "";
  });

  // Send på Enter (Shift+Enter = ny linje)
  txt.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      btnSend.click();
    }
  });

  btnInsights.addEventListener("click", showInsightsForCurrentTopic);
  btnStatus.addEventListener("click", showTopicStatus);
  btnSynth.addEventListener("click", showSynthesisForCurrentTopic);
  btnPath.addEventListener("click", showPathForCurrentTopic);
  btnSem.addEventListener("click", showSemanticSummaryForCurrentTopic);
  btnAuto.addEventListener("click", showAutoArtifactForCurrentTopic);
  btnAgent.addEventListener("click", suggestNextActionForCurrentTopic);
  btnDim.addEventListener("click", showDimensionSummaryForCurrentTopic);
  btnDial.addEventListener("click", showDialecticViewForCurrentTopic);
  btnTopics.addEventListener("click", showAllTopicsOverview);
  btnExport.addEventListener("click", exportChamberJson);

  btnReset.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    clearOutput();
    const logEl = getChatLogEl();
    if (logEl) logEl.textContent = "";
    addChatMessage("Innsiktskammer nullstilt (alle tema slettet).", "system");
  });

  clearOutput();
  addChatMessage(
    "Hei! Jeg er AHA Chat. Skriv om et tema du vil forstå bedre, så bygger jeg innsikt i bakgrunnen.",
    "system"
  );
}

document.addEventListener("DOMContentLoaded", setupUI);
