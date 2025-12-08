// insightsChamber.js
// ─────────────────────────────────────────────
// AHA InsightsEngine – ren innsiktsmotor (ingen DOM)
// ─────────────────────────────────────────────
//
// Typer (mental modell):
//
// type Signal = {
//   id: string;
//   timestamp: string;
//   subject_id: string;
//   theme_id: string;
//   text: string;
// };
//
// type Insight = {
//   id: string;
//   subject_id: string;
//   theme_id: string;
//   title: string;
//   summary: string;
//   strength: { evidence_count: number; total_score: number };
//   first_seen: string;
//   last_updated: string;
//   semantic: { ... };
//   dimensions: string[]; // ["emosjon","tanke", ...]
// };
//
// type InsightChamber = { insights: Insight[] };
//
// type TopicStats = {
//   topic_id: string;
//   subject_id: string;
//   insight_saturation: number;
//   concept_density: number;
//   artifact_type: "kort" | "liste" | "sti" | "artikkel";
//   insight_count: number;
// };
// ─────────────────────────────────────────────

(function (global) {
  "use strict";

  // ── Utils ──────────────────────────────────

  function nowIso() {
    return new Date().toISOString();
  }

  function generateSignalId() {
    return "sig_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
  }

  function generateInsightId() {
    return "ins_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
  }

  function generateTitleFromText(text) {
    const words = text.split(/\s+/).filter(Boolean);
    const short = words.slice(0, 10).join(" ");
    return words.length > 10 ? short + " …" : short;
  }

  // ── Tekstlikhet (Jaccard) ───────────────────

  function textSimilarity(a, b) {
    const tokensA = new Set(
      a.toLowerCase().split(/\W+/).filter((t) => t.length > 2)
    );
    const tokensB = new Set(
      b.toLowerCase().split(/\W+/).filter((t) => t.length > 2)
    );
    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersection = 0;
    for (const t of tokensA) if (tokensB.has(t)) intersection++;
    const union = tokensA.size + tokensB.size - intersection;
    return intersection / union;
  }

  // ── Semantisk analyse ──────────────────────

  function analyzeSentenceSemantics(text) {
    const lower = text.toLowerCase();
    const containsAny = (list) => list.some((w) => lower.includes(w));

    // Intensitet
    let intensity = "middels";
    if (
      containsAny([
        "helt",
        "ekstremt",
        "kjempe",
        "totalt",
        "utrolig",
        "veldig"
      ])
    ) {
      intensity = "høy";
    } else if (containsAny(["litt", "noe", "ganske"])) {
      intensity = "lav";
    }

    // Frekvens
    let frequency = "ukjent";
    if (containsAny(["alltid", "hver gang", "hele tiden"])) {
      frequency = "alltid";
    } else if (containsAny(["ofte", "stadig", "som regel", "vanligvis"])) {
      frequency = "ofte";
    } else if (containsAny(["sjelden", "aldri", "nesten aldri"])) {
      frequency = "sjelden";
    }

    // Modalitet (krav/mulighet/hindring)
    let modality = "nøytral";
    if (containsAny(["må ", "måtte", "burde", "skulle"])) {
      modality = "krav";
    } else if (containsAny(["kan ", "har lyst", "vil ", "ønsker"])) {
      modality = "mulighet";
    }
    if (
      containsAny([
        "klarer ikke",
        "får ikke til",
        "får det ikke til",
        "får ikke lov"
      ])
    ) {
      modality = "hindring";
    }

    // Tid
    let timeRefs = [];
    if (
      containsAny(["nå", "for tiden", "i det siste", "hver dag"])
    ) {
      timeRefs.push("nå");
    }
    if (
      containsAny([
        "før",
        "tidligere",
        "da jeg var liten",
        "en gang",
        "før i tiden"
      ])
    ) {
      timeRefs.push("fortid");
    }
    if (
      containsAny([
        "skal",
        "kommer til",
        "neste gang",
        "fremover",
        "etterpå"
      ])
    ) {
      timeRefs.push("fremtid");
    }
    let time_ref = "blandet";
    if (timeRefs.length === 0) time_ref = "nå";
    else if (timeRefs.length === 1) time_ref = timeRefs[0];

    // Subjekt / ansvar
    let subject_type = "diffus";
    if (/\bjeg\b/.test(lower)) {
      subject_type = "jeg";
    } else if (
      /\bde\b|\bandre\b|\bfolk\b|\balle\b/.test(lower)
    ) {
      subject_type = "andre";
    }

    // Valens
    const positiveWords = [
      "godt",
      "bra",
      "lett",
      "digg",
      "gøy",
      "rolig",
      "fornøyd",
      "stolt",
      "trygg",
      "håpefull",
      "optimistisk"
    ];
    const negativeWords = [
      "vondt",
      "tungt",
      "stressa",
      "stresset",
      "urolig",
      "skam",
      "skamfull",
      "skyld",
      "redd",
      "engstelig",
      "bekymret",
      "lei meg",
      "trist",
      "sliten",
      "utmattet"
    ];

    let posCount = 0;
    let negCount = 0;
    positiveWords.forEach((w) => {
      if (lower.includes(w)) posCount++;
    });
    negativeWords.forEach((w) => {
      if (lower.includes(w)) negCount++;
    });

    let valence = "nøytral";
    if (posCount > negCount && posCount > 0) valence = "positiv";
    else if (negCount > posCount && negCount > 0) valence = "negativ";
    else if (posCount > 0 && negCount > 0) valence = "blandet";

    // Tempo
    let tempo = "ukjent";
    if (containsAny(["plutselig", "brått", "med en gang"])) {
      tempo = "plutselig";
    } else if (
      containsAny(["gradvis", "etter hvert", "litt etter litt"])
    ) {
      tempo = "gradvis";
    } else if (containsAny(["sakte", "roligere"])) {
      tempo = "sakte";
    }

    // Metaspråk / meta
    let meta = "ingen";
    if (
      containsAny([
        "egentlig",
        "faktisk",
        "tydeligvis",
        "visstnok",
        "på en måte"
      ])
    ) {
      meta = "meta";
    } else if (
      containsAny(["kanskje", "virker som", "føles som"])
    ) {
      meta = "usikker";
    }

    // Kontraster
    const has_contrast = containsAny([
      " men ",
      "men ",
      " samtidig",
      "likevel",
      "selv om",
      "på den ene siden",
      "på den andre siden"
    ]);

    // Absolutter
    const has_absolute = containsAny([
      "alltid",
      "aldri",
      "hver gang",
      "hele tiden",
      "ingen",
      "alle"
    ]);

    return {
      intensity,
      frequency,
      valence,
      modality,
      subject_type,
      time_ref,
      tempo,
      meta,
      has_contrast,
      has_absolute
    };
  }



    function computeDepthHeuristic(semantic, dimensions, semiotic) {
    let score = 0;

    // Meta-språk (refleksjon)
    if (semantic && semantic.meta === "meta") {
      score += 3;
    }

    // Blandet valens tyder ofte på kompleksitet/integrasjon
    if (semantic && semantic.valence === "blandet") {
      score += 2;
    }

    // Flere dimensjoner aktiv samtidig (tanke + følelse + atferd...)
    const dimCount = Array.isArray(dimensions)
      ? dimensions.length
      : 0;
    if (dimCount >= 3) {
      score += 2;
    } else if (dimCount === 2) {
      score += 1;
    }

    // Kropp + negativ valens → ofte "tunge" innsikter
    if (
      semiotic &&
      semiotic.domains &&
      semiotic.domains.body &&
      semantic &&
      semantic.valence === "negativ"
    ) {
      score += 2;
    }

    // Mange emojis eller kraftig tegnbruk kan tyde på intensitet
    if (semiotic && Array.isArray(semiotic.emojis)) {
      if (semiotic.emojis.length >= 3) score += 1;
    }
    if (semiotic && semiotic.markers && semiotic.markers.exclamation) {
      score += 1;
    }

    return score;
  }


    function classifyInsightType(semantic, dimensions, semiotic) {
    if (!semantic) return "uklassifisert";

    const isPress =
      semantic.modality === "krav" &&
      semantic.valence === "negativ";

    const isOpportunity =
      semantic.modality === "mulighet" &&
      semantic.valence === "positiv";

    const hasMeta = semantic.meta === "meta";
    const dimCount = Array.isArray(dimensions)
      ? dimensions.length
      : 0;

    if (isPress) {
      return "press";
    }

    if (isOpportunity && dimCount >= 2) {
      return "oppdagelse";
    }

    if (
      hasMeta &&
      semantic.valence === "blandet" &&
      dimCount >= 2
    ) {
      return "integrasjon";
    }

    return "uklassifisert";
  }

  

  // ── Narrativ analyse (V1) ──────────────────
  // Forsøker å fange:
  // - aktør (jeg/vi/man/alle)
  // - normbrudd (snyte, ta mer enn kvoten, jukse osv.)
  // - begrunnelse/bagatellisering ("det har ikke så mye å si", "bare litt")
  // - systemeffekt ("når alle", "til slutt går det galt")
  // - moralsk tone (kritikk av egoisme, normbrudd osv.)
  function analyzeNarrative(text) {
    const lower = text.toLowerCase();
    const containsAny = (list) => list.some((w) => lower.includes(w));

    // Aktør
    let actor = null;
    if (/\bjeg\b/.test(lower)) actor = "jeg";
    else if (/\bvi\b/.test(lower)) actor = "vi";
    else if (/\bman\b/.test(lower)) actor = "man";
    else if (/\balle\b/.test(lower) || /\bfolk\b/.test(lower)) actor = "alle";
    else if (/\bde\b/.test(lower)) actor = "de";

    // Normbrudd – ting som peker på å bryte regler / ta mer enn egen del
    let norm_break = null;
    if (
      containsAny([
        "snyter på skatten",
        "snyte på skatten",
        "snyter",
        "snyte",
        "jukser",
        "jukse",
        "over kvoten",
        "mer enn kvoten",
        "ta mer enn",
        "tar mer enn",
        "skipper unna",
        "snike",
        "sniker meg unna",
        "bryter reglene"
      ])
    ) {
      norm_break = "normbrudd";
    }

    // Begrunnelse / bagatellisering
    let justification = null;
    if (
      containsAny([
        "har ikke så mye å si",
        "har ikke så mye og si",
        "det har ikke så mye å si",
        "det spiller ingen rolle",
        "spiller ingen rolle",
        "bare litt",
        "bare denne gangen",
        "alle gjør det",
        "alle gjør jo det",
        "hva gjør det vel"
      ])
    ) {
      justification = "bagatellisering";
    }

    // Systemeffekt – at det blir alvorlig når mange gjør det samme
    let systemic_effect = null;
    if (
      containsAny([
        "når alle tenker slikt",
        "når alle tenker sånn",
        "når alle gjør det",
        "hvis alle gjør det",
        "hvis alle tenker sånn",
        "hvis alle tenker slikt",
        "til slutt går det galt",
        "til slutt forsvinner",
        "systemet kollapser",
        "kollapser",
        "går tomt",
        "blir ødelagt"
      ])
    ) {
      systemic_effect = "systemeffekt";
    }

    // Moralsk tone – eksplisitt kritikk av egoisme / hensynsløshet
    let moral_tone = null;
    if (
      containsAny([
        "egoisme",
        "egoistisk",
        "hensynsløs",
        "usolidarisk",
        "urettferdig"
      ])
    ) {
      moral_tone = "kritisk";
    } else if (
      containsAny([
        "bør",
        "må",
        "riktig",
        "rettferdig",
        "ta hensyn",
        "vise hensyn"
      ])
    ) {
      moral_tone = "normativ";
    }

    return {
      actor,
      norm_break,
      justification,
      systemic_effect,
      moral_tone
    };
  }
  
  // ── Dimensjoner ────────────────────────────

  function analyzeDimensions(text) {
    const lower = text.toLowerCase();
    const containsAny = (list) => list.some((w) => lower.includes(w));
    const dims = new Set();

    // Emosjon
    if (
      containsAny([
        "redd",
        "engstelig",
        "bekymret",
        "stressa",
        "stresset",
        "urolig",
        "lei meg",
        "skam",
        "skamfull",
        "skyld",
        "flau",
        "trist",
        "glad",
        "fornøyd",
        "stolt",
        "urolig",
        "rolig"
      ])
    ) {
      dims.add("emosjon");
    }

    // Atferd
    if (
      containsAny([
        "utsetter",
        "rømmer",
        "prokrastinerer",
        "scroller",
        "ligger på sofaen",
        "ser på",
        "åpner",
        "lukker",
        "gjør ingenting",
        "overjobber",
        "jobber masse",
        "skriver",
        "ringer",
        "sletter",
        "ignorerer"
      ])
    ) {
      dims.add("atferd");
    }

    // Tanke
    if (
      containsAny([
        "tenker",
        "tror",
        "føles som",
        "virker som",
        "jeg sier til meg selv",
        "overtenker",
        "grubler",
        "forestiller meg",
        "bekymrer meg",
        "vurderer",
        "planlegger"
      ])
    ) {
      dims.add("tanke");
    }

    // Kropp
    if (
      containsAny([
        "i kroppen",
        "spenning",
        "spenninger",
        "stram",
        "hodepine",
        "smerte",
        "puste",
        "puster",
        "magesmerter",
        "klump i magen",
        "sliten",
        "utmattet",
        "kvalm",
        "svimmel",
        "hjertet banker"
      ])
    ) {
      dims.add("kropp");
    }

    // Relasjon
    if (
      containsAny([
        "andre",
        "de",
        "folk",
        "venner",
        "familie",
        "sjefen",
        "kollega",
        "partner",
        "kjæreste",
        "barn",
        "foreldre",
        "læreren",
        "klassen"
      ])
    ) {
      dims.add("relasjon");
    }

    // Hvis vi ikke finner noe, anta "tanke"
    if (dims.size === 0) {
      dims.add("tanke");
    }

    return Array.from(dims);
  }


  function semanticSimilarityBetweenSignalAndInsight(signal, insight) {
    // 1) Tekstlikhet (Jaccard)
    const textSim = textSimilarity(signal.text, insight.summary || "");

    // 2) Semantikk på signalet
    const sigSem = analyzeSentenceSemantics(signal.text);
    const sigDims = analyzeDimensions(signal.text);

    const insSem = insight.semantic || null;
    const insDims = insight.dimensions || [];

    let semScore = 0;
    let semWeight = 0;

    // Frekvens ("alltid", "ofte", "sjelden", "ukjent")
    if (insSem && sigSem.frequency !== "ukjent" && insSem.frequency !== "ukjent") {
      semWeight += 1;
      if (sigSem.frequency === insSem.frequency) {
        semScore += 1;
      }
    }

    // Valens (positiv/negativ/blandet/nøytral)
    if (insSem) {
      semWeight += 1;
      if (sigSem.valence === insSem.valence) {
        semScore += 1;
      }
    }

    // Modalitet (krav/mulighet/hindring/nøytral)
    if (insSem && sigSem.modality !== "nøytral" && insSem.modality !== "nøytral") {
      semWeight += 1;
      if (sigSem.modality === insSem.modality) {
        semScore += 1;
      }
    }

    // Tid (nå/fortid/fremtid/blandet)
    if (insSem && sigSem.time_ref !== "blandet" && insSem.time_ref !== "blandet") {
      semWeight += 1;
      if (sigSem.time_ref === insSem.time_ref) {
        semScore += 1;
      }
    }

    // Dimensjoner (emosjon/tanke/atferd/kropp/relasjon)
    if (sigDims.length && insDims.length) {
      const setA = new Set(sigDims);
      const setB = new Set(insDims);
      let inter = 0;
      for (const d of setA) if (setB.has(d)) inter++;
      const uni = setA.size + setB.size - inter || 1;
      const dimSim = inter / uni;

      semScore += dimSim;
      semWeight += 1;
    }

    const semanticSim = semWeight > 0 ? semScore / semWeight : 0;

    // Kombiner tekst + semantikk
    const alpha = 0.6; // hvor mye vekt tekst har vs semantikk
    const finalSim = alpha * textSim + (1 - alpha) * semanticSim;

    return Math.max(0, Math.min(1, finalSim));
  }
  
  // ── Innsiktskammer / Insight-objekter ──────

  function createEmptyChamber() {
    return { insights: [] };
  }

  function createSignalFromMessage(messageText, subjectId, themeId, context) {
  const ctx = context || {};

  return {
    id: generateSignalId(),
    timestamp: nowIso(),
    subject_id: subjectId,
    theme_id: themeId,
    text: (messageText || "").trim(),

    // NYTT: valgfri kontekst-akse (fra History Go / AHA / andre)
    place_id: ctx.place_id || null,
    person_id: ctx.person_id || null,
    field_id: ctx.field_id || null,
    emner: Array.isArray(ctx.emner) ? ctx.emner.slice() : []
  };
}
  
function createInsightFromSignal(signal) {
  const text = (signal.text || "").trim();
  const title = generateTitleFromText(text);
  const semantic = analyzeSentenceSemantics(text);
  const dimensions = analyzeDimensions(text);
  const narrative = analyzeNarrative(text);
  const concepts = extractConcepts(text);
  const semiotic = analyzeSemioticSignals(text);

  const depthScore = computeDepthHeuristic(
    semantic,
    dimensions,
    semiotic
  );
  const insightType = classifyInsightType(
    semantic,
    dimensions,
    semiotic
  );

  const insight = {
    id: generateInsightId(),
    subject_id: signal.subject_id,
    theme_id: signal.theme_id,

    // NYTT: viderefør kontekst-aksene fra signalet
    place_id: signal.place_id || null,
    person_id: signal.person_id || null,
    field_id: signal.field_id || null,
    emner: Array.isArray(signal.emner) ? signal.emner.slice() : [],

    title,
    summary: text,
    strength: {
      evidence_count: 1,
      total_score: Math.min(100, 10 + depthScore),
    },
    depth_score: depthScore,
    insight_type: insightType,
    first_seen: signal.timestamp,
    last_updated: signal.timestamp,
    semantic,
    dimensions,
    narrative,
    concepts,
    semiotic,

    coherence: computeCoherence(signal.text),
    terminology: computeTerminologyDensity(signal.text),
    logical: computeLogicalPatterns(signal.text),
    meta_concepts: computeMetaConcepts(concepts),
 
  };

  
  return insight;
}
  
  function getInsightsForTopic(chamber, subjectId, themeId) {
    return chamber.insights.filter(
      (ins) =>
        ins.subject_id === subjectId &&
        ins.theme_id === themeId
    );
  }

    function mergeSemiotic(a, b) {
  if (!a) return b || null;
  if (!b) return a;

  const merged = {
    emojis: [],
    markers: { ...(a.markers || {}) },
    domains: { ...(a.domains || {}) },
  };

  // Emojis: slå sammen og begrens litt
  const allEmojis = [...(a.emojis || []), ...(b.emojis || [])];
  merged.emojis = Array.from(new Set(allEmojis)).slice(0, 20);

  // Markers: OR-logikk
  Object.keys(merged.markers).forEach((k) => {
    merged.markers[k] =
      (a.markers && a.markers[k]) ||
      (b.markers && b.markers[k]) ||
      false;
  });

  // Domains: OR-logikk
  Object.keys(merged.domains).forEach((k) => {
    merged.domains[k] =
      (a.domains && a.domains[k]) ||
      (b.domains && b.domains[k]) ||
      false;
  });

  return merged;
}

  function reinforceInsight(insight, signal) {
    if (!insight || !signal) return insight;
  insight.strength.evidence_count += 1;
  insight.last_updated = signal.timestamp;

  // Oppdater begreper basert på den nye teksten
  const newConcepts = extractConcepts(signal.text);
  insight.concepts = mergeConcepts(
    insight.concepts || [],
    newConcepts
  );

  // Oppdater semiotikk basert på den nye teksten
  const newSemiotic = analyzeSemioticSignals(signal.text);
  insight.semiotic = mergeSemiotic(
    insight.semiotic || null,
    newSemiotic
  );

  // Bruk dybdescoren som "grunnfjell" + evidens
      const baseDepth = insight.depth_score || 0;
    insight.strength.total_score = Math.min(
      100,
      insight.strength.evidence_count * 10 + baseDepth
    );
}

    function addSignalToChamber(chamber, signal) {
    const candidates = getInsightsForTopic(
      chamber,
      signal.subject_id,
      signal.theme_id
    );

    let best = null;
    let bestSim = 0;
    for (const ins of candidates) {
      const sim = semanticSimilarityBetweenSignalAndInsight(signal, ins);
      if (sim > bestSim) {
        bestSim = sim;
        best = ins;
      }
    }

    const THRESHOLD = 0.5; // kan finjusteres senere
    if (best && bestSim >= THRESHOLD) {
      reinforceInsight(best, signal);
    } else {
      chamber.insights.push(createInsightFromSignal(signal));
    }

    return chamber;
  }
  
  // ── Tekst → setninger ──────────────────────

  function splitIntoSentences(text) {
    return text
      .split(/[.!?]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 15);
  }

  // ── TopicStats: metning + tetthet ──────────

  const STOPWORDS = new Set([
  // grunnleggende funksjonsord
  "og", "i", "på", "som", "for", "med", "til", "av", "fra", "om", "så",
  "men", "da", "når", "hvor", "hvordan",

  // artikler / pronomen
  "det", "dette", "den", "de", "en", "et",
  "jeg", "du", "vi", "dere", "han", "hun", "oss",

  // hjelpeverb / modale
  "er", "var", "ble", "bli", "blir",
  "kan", "kunne", "ville", "skal", "skulle", "må", "måtte",

  // småord / fyllord
  "ikke", "bare", "alt", "selv", "opp", "ned", "mellom",

  // feiltokens vi så i testen
  "ogs", "ell"
]);

  
  function tokenize(text) {
    return text.toLowerCase().split(/\W+/).filter(Boolean);
  }

  function filterStopwords(tokens) {
  return tokens.filter((t) => {
    if (!t) return false;

    // min. lengde – kast "var", "kan" osv.
    if (t.length <= 3) return false;

    // kun rene bokstav-ord (fjerner rsm/ell-artefakter, tall, blanding)
    if (!/^[a-zæøå]+$/.test(t)) return false;

    // ikke ta med stopwords
    if (STOPWORDS.has(t)) return false;

    return true;
  });
}

  // ── Begrepsmotor: enkle "concepts" per innsikt ─────────────

  // ── Begrepsanalyse per innsikt (fasit) ─────────────

  // Normaliserer et ord til et konsept-key:
  //  - lower-case
  //  - fjerner støy / tegn
  //  - fjerner noen vanlige norske endelser: -ene, -er, -en, -et, -a
  function normalizeConceptToken(t) {
  if (!t) return "";

  // 1. Gjør om til små bokstaver
  t = t.toLowerCase();

  // 2. Fjern tegnsetting i start/slutt
  t = t.replace(/^[^a-zæøå]+|[^a-zæøå]+$/g, "");

  // 3. Fjern interne tegn som splitter ord (men IKKE kutt ordet)
  t = t.replace(/[^a-zæøå]/g, "");

  // 4. BEHOLD hele ordet – ikke gjør stemming eller truncation
  return t;
}

  // Tar inn tekst og returnerer en liste med konsepter:
//  [{ key, count, examples: ["..."] }]
function extractConcepts(text) {
  if (!text || typeof text !== "string") return [];

  const rawTokens = tokenize(text);
  if (!rawTokens.length) return [];

  const conceptMap = new Map();

  for (let token of rawTokens) {
    // NORMALISER FØR ALT ANNET
    let norm = normalizeConceptToken(token);

    if (!norm) continue;

    // STOPWORDS MÅ HAMRE PÅ DEN NORMALISERTE VERSJONEN
    if (STOPWORDS.has(norm)) continue;

    // ord som “begrepet”, “snakket”, “diskuterte” → fjernes her:
    if (norm.endsWith("et") && norm.length <= 8) continue; 
    if (norm.endsWith("et") && norm.startsWith("begrep")) continue;

    // min-lengde og rent innehold
    if (norm.length <= 3) continue;
    if (!/^[a-zæøå]+$/.test(norm)) continue;

    // få eller oppdelt feil → fjern
    if (norm === "else") continue;
    if (norm === "eller") continue;

    let entry = conceptMap.get(norm);
    if (!entry) {
      entry = { key: norm, count: 0, examples: [] };
      conceptMap.set(norm, entry);
    }

    // Faglig boost
    if (
      norm.endsWith("het") ||
      norm.endsWith("else") ||
      norm.endsWith("skap") ||
      norm.endsWith("sjon") ||
      norm.endsWith("ering") ||
      norm.endsWith("ologi") ||
      norm.endsWith("dom") ||
      norm.endsWith("ning")
    ) {
      entry.count += 2;
    }

    entry.count += 1;

    if (entry.examples.length < 5 && !entry.examples.includes(token)) {
      entry.examples.push(token);
    }
  }

  return Array.from(conceptMap.values()).sort((a, b) => b.count - a.count);
}
  // Slår sammen to concept-lister:
  //  - summerer count
  //  - beholder maks 5 eksempler per key
  function mergeConcepts(existing, incoming) {
    const map = new Map();

    (existing || []).forEach((c) => {
      if (!c || !c.key) return;
      map.set(c.key, {
        key: c.key,
        count: c.count || 0,
        examples: Array.isArray(c.examples)
          ? [...c.examples]
          : [],
      });
    });

    (incoming || []).forEach((c) => {
      if (!c || !c.key) return;
      let current = map.get(c.key);
      if (!current) {
        current = { key: c.key, count: 0, examples: [] };
        map.set(c.key, current);
      }
      current.count += c.count || 0;

      (c.examples || []).forEach((ex) => {
        if (
          ex &&
          current.examples.length < 5 &&
          !current.examples.includes(ex)
        ) {
          current.examples.push(ex);
        }
      });
    });

    return Array.from(map.values()).sort(
      (a, b) => b.count - a.count
    );
  }

// ── Koherens, terminologi, logiske mønstre, meta-begreper ─────────────

function computeCoherence(text) {
  if (!text || typeof text !== "string") return 0;

  const raw = text.trim();
  if (!raw) return 0;

  const lower = raw.toLowerCase();

  // Del enkelt i setninger
  const sentences = raw
    .split(/[.!?…]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  // 1) Tell logiske bindere
  const connectors = [
    "fordi",
    "derfor",
    "dermed",
    "sånn at",
    "slik at",
    "samtidig",
    "likevel",
    "mens",
    "derimot",
    "på den andre siden",
    "på den ene siden",
  ];
  let connectorCount = 0;
  for (const c of connectors) {
    if (lower.includes(c)) connectorCount++;
  }

  // 2) Tematisk overlapp mellom nabosetninger (enkel Jaccard-ish)
  function sentenceTokens(s) {
    return s
      .toLowerCase()
      .replace(/[^a-zæøå0-9\s]/gi, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  const sets = sentences.map((s) => new Set(sentenceTokens(s)));

  let overlapSum = 0;
  let pairs = 0;
  for (let i = 0; i < sets.length - 1; i++) {
    const a = sets[i];
    const b = sets[i + 1];
    if (!a.size || !b.size) continue;

    let inter = 0;
    const union = new Set(a);
    for (const t of b) {
      if (a.has(t)) inter++;
      union.add(t);
    }
    const j = union.size ? inter / union.size : 0;
    overlapSum += j;
    pairs++;
  }

  const avgOverlap = pairs ? overlapSum / pairs : 0;

  // 3) Sett sammen til 0–10-score (max 4 fra connectives, 6 fra overlapp)
  const connectorScore = Math.min(connectorCount, 4); // 0–4
  const overlapScore = Math.max(0, Math.min(avgOverlap * 6, 6)); // 0–6

  let score = connectorScore + overlapScore;
  if (score > 10) score = 10;
  if (score < 0) score = 0;

  return score;
}

function computeTerminologyDensity(text) {
  if (!text || typeof text !== "string") return 0;

  const tokens = filterStopwords(tokenize(text));
  if (!tokens.length) return 0;

  const lowerTokens = tokens.map((t) => t.toLowerCase());

  const technicalSuffixes = [
    "sjon",
    "asjon",
    "ering",
    "itet",
    "isme",
    "logi",
    "grafi",
  ];

  const technicalWordList = [
    "industri",
    "teknologi",
    "struktur",
    "prosess",
    "funksjon",
    "kontekst",
    "narrativ",
    "institusjon",
    "identitet",
    "analyse",
    "perspektiv",
    "diskurs",
  ];

  let technicalCount = 0;

  for (const tok of lowerTokens) {
    if (tok.length >= 12) {
      technicalCount++;
      continue;
    }
    if (technicalWordList.includes(tok)) {
      technicalCount++;
      continue;
    }
    if (technicalSuffixes.some((suf) => tok.endsWith(suf))) {
      technicalCount++;
      continue;
    }
  }

  const density = technicalCount / lowerTokens.length;
  if (density < 0) return 0;
  if (density > 1) return 1;
  return density;
}

function computeLogicalPatterns(text) {
  if (!text || typeof text !== "string") {
    return {
      causal: 0,
      inferential: 0,
      contrast: 0,
      balancing: 0,
    };
  }

  const lower = text.toLowerCase();

  const causalPhrases = [
    "fordi",
    "på grunn av",
    "som følge av",
    "førte til",
    "det gjør at",
    "det fører til",
    "derfor",
    "dermed",
  ];
  const inferentialPhrases = [
    "tyder på",
    "betyr at",
    "viser at",
    "indikerer at",
  ];
  const contrastPhrases = [
    "men",
    "likevel",
    "derimot",
    "samtidig",
    "på den andre siden",
  ];
  const balancingPhrases = [
    "på den ene siden",
    "på den andre siden",
  ];

  function countOccurrences(haystack, needle) {
    let count = 0;
    let idx = haystack.indexOf(needle);
    while (idx !== -1) {
      count++;
      idx = haystack.indexOf(needle, idx + needle.length);
    }
    return count;
  }

  let causal = 0;
  for (const p of causalPhrases) {
    causal += countOccurrences(lower, p);
  }

  let inferential = 0;
  for (const p of inferentialPhrases) {
    inferential += countOccurrences(lower, p);
  }

  let contrast = 0;
  for (const p of contrastPhrases) {
    contrast += countOccurrences(lower, p);
  }

  let balancing = 0;
  for (const p of balancingPhrases) {
    balancing += countOccurrences(lower, p);
  }

  return {
    causal,
    inferential,
    contrast,
    balancing,
  };
}

function computeMetaConcepts(concepts) {
  if (!Array.isArray(concepts) || !concepts.length) {
    return [];
  }

  const keys = concepts
    .map((c) => (c && c.key ? c.key.toLowerCase() : null))
    .filter(Boolean);

  const domainMap = {
    kropp: [
      "kropp",
      "energi",
      "sliten",
      "utmattet",
      "uro",
      "rastløs",
      "belastning",
      "stress",
    ],
    tid: [
      "tid",
      "fremtid",
      "fortid",
      "plan",
      "struktur",
      "utvikling",
      "prosess",
      "deadline",
    ],
    arbeid: [
      "arbeid",
      "jobb",
      "industri",
      "produksjon",
      "effektivitet",
      "rutiner",
      "skift",
      "kontor",
    ],
    samfunn: [
      "samfunn",
      "lokalsamfunn",
      "institusjon",
      "stat",
      "offentlig",
      "befolkning",
      "kollektiv",
      "historie",
      "politikk",
    ],
    teknologi: [
      "teknologi",
      "maskin",
      "data",
      "digital",
      "system",
      "plattform",
      "skjerm",
    ],
  };

  const hits = new Set();

  for (const [domain, words] of Object.entries(domainMap)) {
    if (words.some((w) => keys.includes(w))) {
      hits.add(domain);
    }
  }

  return Array.from(hits);
}
  
  // ── Hjelpere for semiotikk ─────────────────────

  function containsAnyInLower(lowerText, phrases) {
    return phrases.some((p) => lowerText.includes(p));
  }

  function extractEmojis(text) {
    // Fanger en del vanlige emojis (ikke perfekt, men godt nok)
    const match = text.match(/[\u{1F300}-\u{1FAFF}]/gu);
    return match || [];
  }

  function analyzeSemioticSignals(text) {
    const lower = text.toLowerCase();

    const emojis = extractEmojis(text);

    const markers = {
      heart: /❤️|💜|💙|💚|💛|🧡|💕|💖|💗/.test(text),
      stars: /⭐|✨|🌟/.test(text),
      arrow: /→|←|↔|⇄|->|<-/.test(text),
      exclamation: /!{2,}/.test(text), // mange utropstegn
    };

    const domains = {
      body: containsAnyInLower(lower, [
        "hjertet banker",
        "klump i magen",
        "knute i magen",
        "kvalm",
        "svetter",
        "skjelver",
        "stiv i nakken",
        "rygg",
        "pusten",
        "pusten går",
        "tung i kroppen",
      ]),
      space: containsAnyInLower(lower, [
        "rommet",
        "scenen",
        "døren",
        "korridor",
        "gatehjørne",
        "hjørnet",
        "mørkt rom",
        "lyssetting",
        "spotlight",
        "salen",
        "lokalet",
      ]),
      tech: containsAnyInLower(lower, [
        "skjermen",
        "skjerm",
        "mobilen",
        "telefonen",
        "appen",
        "chatten",
        "feed",
        "notifikasjon",
        "varsling",
        "pc-en",
        "laptopen",
      ]),
    };

    return {
      emojis,
      markers,
      domains,
    };
  }
  
  function computeConceptDensity(insights) {
    const combined = insights
      .map((ins) => `${ins.title}. ${ins.summary}`)
      .join(" ");

    const tokens = filterStopwords(tokenize(combined));
    if (tokens.length === 0) return 0;

    const unique = new Set(tokens);
    const rawDensity = unique.size / tokens.length;
    const normalized = Math.max(
      0,
      Math.min(1, rawDensity / 0.25)
    );
    return Math.round(normalized * 100);
  }

  // smartere innsiktsmetning (V2)
  function computeInsightSaturation(insights) {
    const n = insights.length;
    if (n === 0) return 0;

    // base: antall innsikter
    let base = Math.min(10, n) * 7; // 0–70

    const dimsSeen = new Set();
    const timeSeen = new Set();
    const valenceSeen = new Set();

    insights.forEach((ins) => {
      (ins.dimensions || []).forEach((d) => dimsSeen.add(d));
      if (ins.semantic) {
        if (ins.semantic.time_ref)
          timeSeen.add(ins.semantic.time_ref);
        if (ins.semantic.valence)
          valenceSeen.add(ins.semantic.valence);
      }
    });

    const dimBonus = Math.min(dimsSeen.size, 5) * 4; // maks +20
    const timeBonus = Math.min(timeSeen.size, 3) * 3; // maks +9
    const valBonus = Math.min(valenceSeen.size, 4) * 1; // maks +4

    const total = base + dimBonus + timeBonus + valBonus;
    return Math.max(0, Math.min(100, total));
  }

  function decideArtifactType(saturation, density) {
    if (saturation < 30 && density < 30) return "kort";
    if (saturation >= 30 && saturation < 60 && density < 60)
      return "liste";
    if (saturation >= 30 && saturation < 60 && density >= 60)
      return "sti";
    if (saturation >= 60 && density >= 60) return "artikkel";
    if (saturation >= 60 && density < 60) return "sti";
    return "kort";
  }

    function computeTopicStats(chamber, subjectId, themeId) {
  const insights = getInsightsForTopic(
    chamber,
    subjectId,
    themeId
  );

  const saturation = computeInsightSaturation(insights);
  const density = computeConceptDensity(insights);
  const artifactType = decideArtifactType(
    saturation,
    density
  );

  // Semantikk → fase
  const counts = computeSemanticCounts(insights);
  const userPhase = computeUserPhase(
    saturation,
    density,
    counts
  );

  // ── NYTT: tekstlig / faglig analyse aggregert per tema ──
  let avgCoherence = 0;
  let avgTerminology = 0;

  const logicalAgg = {
    causal: 0,
    inferential: 0,
    contrast: 0,
    balancing: 0,
  };

  const metaConceptCounts = Object.create(null);
  const n = insights.length;

  if (n > 0) {
    insights.forEach((ins) => {
      // Koherens og terminologi er tall per innsikt
      const coh =
        typeof ins.coherence === "number" ? ins.coherence : 0;
      const term =
        typeof ins.terminology === "number"
          ? ins.terminology
          : 0;

      avgCoherence += coh;
      avgTerminology += term;

      // Logiske mønstre – liten struktur per innsikt
      const lp = ins.logical || {};
      if (typeof lp.causal === "number") {
        logicalAgg.causal += lp.causal;
      }
      if (typeof lp.inferential === "number") {
        logicalAgg.inferential += lp.inferential;
      }
      if (typeof lp.contrast === "number") {
        logicalAgg.contrast += lp.contrast;
      }
      if (typeof lp.balancing === "number") {
        logicalAgg.balancing += lp.balancing;
      }

      // Meta-begreper – domenenøkler per innsikt
      if (Array.isArray(ins.meta_concepts)) {
        ins.meta_concepts.forEach((key) => {
          if (!key) return;
          metaConceptCounts[key] =
            (metaConceptCounts[key] || 0) + 1;
        });
      }
    });

    avgCoherence = avgCoherence / n;
    avgTerminology = avgTerminology / n;

    logicalAgg.causal = logicalAgg.causal / n;
    logicalAgg.inferential = logicalAgg.inferential / n;
    logicalAgg.contrast = logicalAgg.contrast / n;
    logicalAgg.balancing = logicalAgg.balancing / n;
  }

  const metaConceptKeys = Object.keys(metaConceptCounts);
  const metaConceptTop = metaConceptKeys
    .map((key) => ({
      key,
      count: metaConceptCounts[key],
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    topic_id: themeId,
    subject_id: subjectId,
    insight_saturation: saturation,
    concept_density: density,
    artifact_type: artifactType,
    insight_count: n,
    user_phase: userPhase,

    // ── nye felt ──
    avg_coherence: avgCoherence,         // gj.snitt 0–10
    avg_terminology: avgTerminology,     // gj.snitt 0–1
    logical_patterns: logicalAgg,        // gj.snitt per innsikt
    meta_concepts: {
      unique_count: metaConceptKeys.length,
      top: metaConceptTop,              // [{ key, count }]
    },
  };
}

  // ── Semantisk telling ──────────────────────

  function computeSemanticCounts(insights) {
    const counts = {
      frequency: { ukjent: 0, sjelden: 0, ofte: 0, alltid: 0 },
      valence: {
        negativ: 0,
        positiv: 0,
        blandet: 0,
        nøytral: 0
      },
      modality: {
        krav: 0,
        mulighet: 0,
        hindring: 0,
        nøytral: 0
      },
      time_ref: { nå: 0, fortid: 0, fremtid: 0, blandet: 0 },
      tempo: { ukjent: 0, plutselig: 0, gradvis: 0, sakte: 0 },
      meta: { ingen: 0, meta: 0, usikker: 0 },
      contrast_count: 0,
      absolute_count: 0
    };

    insights.forEach((ins) => {
      const sem = ins.semantic || {};

      if (
        sem.frequency &&
        counts.frequency[sem.frequency] !== undefined
      ) {
        counts.frequency[sem.frequency]++;
      } else {
        counts.frequency.ukjent++;
      }

      if (
        sem.valence &&
        counts.valence[sem.valence] !== undefined
      ) {
        counts.valence[sem.valence]++;
      } else {
        counts.valence.nøytral++;
      }

      if (
        sem.modality &&
        counts.modality[sem.modality] !== undefined
      ) {
        counts.modality[sem.modality]++;
      } else {
        counts.modality.nøytral++;
      }

      if (
        sem.time_ref &&
        counts.time_ref[sem.time_ref] !== undefined
      ) {
        counts.time_ref[sem.time_ref]++;
      } else {
        counts.time_ref.blandet++;
      }

      if (
        sem.tempo &&
        counts.tempo[sem.tempo] !== undefined
      ) {
        counts.tempo[sem.tempo]++;
      } else {
        counts.tempo.ukjent++;
      }

      if (sem.meta && counts.meta[sem.meta] !== undefined) {
        counts.meta[sem.meta]++;
      } else {
        counts.meta.ingen++;
      }

      if (sem.has_contrast) counts.contrast_count++;
      if (sem.has_absolute) counts.absolute_count++;
    });

    return counts;
  }

  function computeUserPhase(saturation, density, counts) {
    // Enkel heuristikk basert på metningsgrad + semantikk

    if (saturation < 30) {
      return "utforskning"; // lite innsikt, lite metning
    }

    // Mellomnivå: vi ser mønstrene begynne å ta form
    if (saturation >= 30 && saturation < 60) {
      const krav = counts.modality.krav;
      const hindring = counts.modality.hindring;
      const mulighet = counts.modality.mulighet;

      if (krav + hindring > mulighet) {
        return "press"; // mye "må/burde/klarer ikke"
      }
      return "mønster"; // mer nøytral/mulighetspreget
    }

    // Høy metning: temaet er "tett" i kammeret
    if (saturation >= 60) {
      const negativ = counts.valence.negativ;
      const positiv = counts.valence.positiv;

      if (negativ > positiv) {
        return "fastlåst"; // mettet + mye negativ valens
      }
      return "integrasjon"; // mettet + mer positiv/balansert
    }

    return "utforskning";
  }
  
  // ── Dimensjons-sammendrag ──────────────────

  function computeDimensionsSummary(insights) {
    const counts = {
      emosjon: 0,
      atferd: 0,
      tanke: 0,
      kropp: 0,
      relasjon: 0
    };

    insights.forEach((ins) => {
      (ins.dimensions || []).forEach((d) => {
        if (counts[d] !== undefined) counts[d]++;
      });
    });

    return counts;
  }

  // ── Sti-steps ──────────────────────────────

  function createPathSteps(insights, maxSteps) {
    const limit = maxSteps || 5;
    if (insights.length === 0) {
      return ["Ingen innsikter å lage sti av ennå."];
    }

    const sorted = [...insights].sort((a, b) =>
      a.first_seen.localeCompare(b.first_seen)
    );

    const limited = sorted.slice(0, limit);

    return limited.map((ins, idx) => {
      return idx + 1 + ". " + ins.summary;
    });
  }

  // ── Begrepssti for ett begrep ──────────────────────────
  // Bygger en "tankerekke" for et begrep på tvers av innsikter:
  // - første gang begrepet dukker opp
  // - hvor det er sterkest / mest ladet
  // - midt i utviklingen
  // - hvordan du snakker om det nå
  function createConceptPathForConcept(insights, conceptKey, maxSteps) {
    const limit = maxSteps || 5;

    if (!conceptKey || !conceptKey.trim()) {
      return ["Ingen begrepssti: du må velge et begrep først."];
    }

    const key = conceptKey.trim().toLowerCase();

    const candidates = (insights || []).filter((ins) =>
      (ins.concepts || []).some(
        (c) => c && typeof c.key === "string" && c.key.toLowerCase() === key
      )
    );

    if (candidates.length === 0) {
      return [
        'Ingen innsikter for begrepet "' + key + '" ennå i dette temaet.',
      ];
    }

    // Sorter på tid
    const sorted = candidates
      .slice()
      .sort((a, b) =>
        (a.first_seen || a.timestamp || "").localeCompare(
          b.first_seen || b.timestamp || ""
        )
      );

    // Hvis få treff: bare vis alle i rekkefølge
    if (sorted.length <= limit) {
      return sorted.map((ins, idx) => {
        return (
          idx +
          1 +
          ". " +
          "«" +
          key +
          "» – " +
          (ins.summary || ins.text || "")
        );
      });
    }

    // Hjelper: hvor "sterk" er bruken av begrepet i dette insightet?
    function getConceptStrength(ins) {
      const concept = (ins.concepts || []).find(
        (c) => c && typeof c.key === "string" && c.key.toLowerCase() === key
      );
      const base = concept ? concept.count || 1 : 1;

      const sem = ins.semantic || {};
      const intensity = sem.intensity || "middels";
      const val = sem.valence || "nøytral";

      let bonus = 0;
      if (intensity === "høy") bonus += 2;
      else if (intensity === "middels") bonus += 1;

      if (val === "negativ") bonus += 2;
      else if (val === "blandet") bonus += 1;

      return base + bonus;
    }

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    // Finn det mest "ladede" insightet for begrepet
    let strongest = null;
    let strongestScore = -Infinity;
    sorted.forEach((ins) => {
      const s = getConceptStrength(ins);
      if (s > strongestScore) {
        strongestScore = s;
        strongest = ins;
      }
    });

    // Ta et punkt omtrent midt i utviklingen
    const mid = sorted[Math.floor(sorted.length / 2)];

    const picked = [];
    function add(ins) {
      if (!ins) return;
      if (!picked.includes(ins)) picked.push(ins);
    }

    add(first);
    add(strongest);
    add(mid);
    add(last);

    // Hvis vi fortsatt har plass, fyll på med andre sterke kandidater
    if (picked.length < limit) {
      const remaining = sorted.filter((ins) => !picked.includes(ins));
      remaining
        .sort((a, b) => getConceptStrength(b) - getConceptStrength(a))
        .slice(0, limit - picked.length)
        .forEach(add);
    }

    // Sorter valgt sti kronologisk
    picked.sort((a, b) =>
      (a.first_seen || a.timestamp || "").localeCompare(
        b.first_seen || b.timestamp || ""
      )
    );

    // Formater output som tankerekke
    return picked.map((ins, idx) => {
      const parts = [];

      if (ins === first) parts.push("første gang du nevner begrepet");
      if (ins === last) parts.push("slik du snakker om det nå");
      if (ins === strongest) parts.push("mest ladet bruk");
      if (ins === mid && ins !== first && ins !== last)
        parts.push("midt i utviklingen");

      const role =
        parts.length > 0 ? " (" + parts.join(", ") + ")" : "";

      const txt = ins.summary || ins.text || "";

      return (
        idx +
        1 +
        ". «" +
        key +
        "»" +
        role +
        ": " +
        txt
      );
    });
  }
  
  // ── Syntese-tekst ──────────────────────────

  function createSynthesisText(insights, themeId) {
    if (insights.length === 0) {
      return "Ingen innsikter å lage syntese av ennå.";
    }
    const bullets = insights.map((ins) => "- " + ins.summary);
    const intro = "Syntese for temaet " + themeId + ":\n";
    const body = bullets.join("\n");
    return intro + body;
  }

  // ── Artikkelutkast ─────────────────────────

  function createArticleDraft(insights, stats, themeId) {
    if (insights.length === 0) {
      return "Ingen innsikter å lage artikkel av ennå.";
    }

    const intro =
      "Artikkelutkast for tema " +
      themeId +
      " (basert på " +
      stats.insight_count +
      " innsikter, metning " +
      stats.insight_saturation +
      "/100, begrepstetthet " +
      stats.concept_density +
      "/100):\n\n";

    const sorted = [...insights].sort(
      (a, b) => b.strength.total_score - a.strength.total_score
    );
    const limited = sorted.slice(0, 5);

    const body = limited
      .map((ins, idx) => idx + 1 + ") " + ins.summary)
      .join("\n");

    const outro =
      "\n\n→ Dette er et råutkast. AHA-agenten kan senere hjelpe deg å skrive det om til flytende tekst.";

    return intro + body + outro;
  }

  // ── Tema-oversikt ──────────────────────────

  function computeTopicsOverview(chamber) {
    const ins = chamber.insights;
    if (ins.length === 0) return [];

    const keys = new Set();
    ins.forEach((i) => {
      keys.add(i.subject_id + "||" + i.theme_id);
    });

    const result = [];
    keys.forEach((key) => {
      const [subjectId, themeId] = key.split("||");
      const stats = computeTopicStats(
        chamber,
        subjectId,
        themeId
      );
      result.push({
        subject_id: subjectId,
        topic_id: themeId,
        insight_count: stats.insight_count,
        insight_saturation: stats.insight_saturation,
        concept_density: stats.concept_density,
        artifact_type: stats.artifact_type
      });
    });

    return result;
  }

  // ── Narrativ analysemotor V1 ─────────────────

  function createNarrativeForTopic(chamber, subjectId, themeId) {
    const insights = getInsightsForTopic(chamber, subjectId, themeId);
    if (!insights || insights.length === 0) {
      return "Ingen narrativ innsikt ennå – skriv noen setninger først.";
    }

    const stats = computeTopicStats(chamber, subjectId, themeId);
    const sem = computeSemanticCounts(insights);
    const dims = computeDimensionsSummary(insights);
    const total = insights.length || 1;

    const lines = [];

    // 1) Åpning / hovedtema
    lines.push(`Narrativ innsikt for tema «${themeId}»:`);
    lines.push("");

    // Hovedfarge ut fra dimensjoner
    const dimLabels = [];
    if (dims.emosjon > 0) dimLabels.push("følelser");
    if (dims.atferd > 0) dimLabels.push("konkrete handlinger");
    if (dims.tanke > 0) dimLabels.push("tanker og tolkninger");
    if (dims.kropp > 0) dimLabels.push("kroppslige reaksjoner");
    if (dims.relasjon > 0) dimLabels.push("relasjoner til andre");

    if (dimLabels.length > 0) {
      lines.push(
        "Du beskriver dette temaet først og fremst gjennom " +
        dimLabels.join(", ") +
        "."
      );
    } else {
      lines.push(
        "Du beskriver dette temaet mest gjennom generelle tanker og observasjoner."
      );
    }

    // 2) Typisk mønster (frekvens + valens)
    const freqOfteAlltid = sem.frequency.ofte + sem.frequency.alltid;
    const neg = sem.valence.negativ;
    const pos = sem.valence.positiv;

    if (freqOfteAlltid > 0) {
      const andel = Math.round((freqOfteAlltid / total) * 100);
      lines.push(
        `${andel}% av innsiktene dine handler om noe som skjer «ofte» eller «alltid». ` +
        "Det tyder på at dette oppleves som et stabilt mønster hos deg."
      );
    } else {
      lines.push(
        "Det du beskriver høres mer ut som enkeltsituasjoner enn et veldig stabilt mønster."
      );
    }

    if (neg > 0 || pos > 0) {
      const andelNeg = Math.round((neg / total) * 100);
      const andelPos = Math.round((pos / total) * 100);

      if (neg > 0 && pos === 0) {
        lines.push(
          `${andelNeg}% av innsiktene har en tydelig negativ farge – stress, ubehag eller vanskelige følelser dominerer.`
        );
      } else if (pos > 0 && neg === 0) {
        lines.push(
          `${andelPos}% av innsiktene har en positiv farge – det er mye ressurs og mestring i dette temaet.`
        );
      } else {
        lines.push(
          `${andelNeg}% av innsiktene er preget av det som er vanskelig, ` +
          `mens ${andelPos}% peker mot noe som faktisk fungerer eller gir energi.`
        );
      }
    }

    // 3) Indre logikk: krav / hindring / meta / absolutter
    const krav = sem.modality.krav;
    const hindring = sem.modality.hindring;
    const meta = sem.meta.meta + sem.meta.usikker;
    const kontrast = sem.contrast_count;
    const absolutt = sem.absolute_count;

    if (krav + hindring > 0) {
      lines.push(
        "Språket ditt inneholder en del «må/burde/skal» eller «klarer ikke/får ikke til» – " +
        "det tyder på både indre krav og opplevelse av å stå fast."
      );
    }

    if (meta > 0) {
      lines.push(
        "Du bruker også metaspråk som «egentlig», «kanskje» eller «føles som», " +
        "som viser at du prøver å forstå mønsteret ditt litt utenfra."
      );
    }

    if (kontrast > 0 || absolutt > 0) {
      const biter = [];
      if (kontrast > 0) {
        biter.push("kontraster som «men», «samtidig» eller «likevel»");
      }
      if (absolutt > 0) {
        biter.push("absoluttspråk som «alltid», «aldri» eller «ingen»");
      }
      lines.push(
        "Motoren finner også " +
        biter.join(" og ") +
        ", som ofte henger sammen med sterke følelser og litt svart–hvitt-tenkning."
      );
    }

    // 4) Representativ situasjon (plukker én eller to setninger)
    let repNeg = null;
    let repPos = null;

    insights.forEach((ins) => {
      const sem = ins.semantic || {};
      if (!repNeg && (sem.valence === "negativ" || sem.valence === "blandet")) {
        repNeg = ins.summary;
      }
      if (!repPos && sem.valence === "positiv") {
        repPos = ins.summary;
      }
    });

    if (repNeg) {
      lines.push("");
      lines.push("Et eksempel på hvordan dette kan høres ut hos deg:");
      lines.push(`«${repNeg}»`);
    }

    if (repPos) {
      lines.push("");
      lines.push("Samtidig finnes det også spor av noe som fungerer bedre:");
      lines.push(`«${repPos}»`);
    }

    // 5) Retning / neste kapittel basert på stats
    lines.push("");
    lines.push(
      `Metningsgrad ${stats.insight_saturation}/100 og begrepstetthet ${stats.concept_density}/100 ` +
      `tilsier at dette temaet nå egner seg som «${stats.artifact_type}».`
    );

    if (stats.insight_saturation < 30) {
      lines.push(
        "Narrativt sett er du fortsatt i en utforskningsfase: du samler bruddstykker, " +
        "og neste steg er å beskrive flere konkrete situasjoner."
      );
    } else if (stats.insight_saturation < 60) {
      lines.push(
        "Narrativt sett begynner det å tegne seg et mønster. Neste steg er å samle trådene i en liten «sti» " +
        "eller liste over hvordan dette typisk starter, hva du gjør, og hva som skjer etterpå."
      );
    } else {
      lines.push(
        "Narrativt sett er dette et ganske modent tema hos deg. Du kunne skrevet en kort tekst eller artikkel " +
        "om hva du har lært her, og hvilke prinsipper du vil ta med deg videre."
      );
    }

    return lines.join("\n");
  }


  // ── Begreper pr tema ──────────────────────────────────────
function getConceptsForTheme(chamber, subjectId, themeId) {
  const insights = getInsightsForTopic(chamber, subjectId, themeId) || [];
  const map = Object.create(null);

  insights.forEach((ins) => {
    const theme = ins.theme_id || themeId || "ukjent";
    (ins.concepts || []).forEach((c) => {
      if (!c || !c.key) return;
      if (!map[c.key]) {
        map[c.key] = {
          key: c.key,
          total_count: 0,
          themes: new Set(),
          examples: [],
        };
      }
      map[c.key].total_count += c.count || 1;
      map[c.key].themes.add(theme);

      if (Array.isArray(c.examples)) {
        c.examples.forEach((ex) => {
          if (
            ex &&
            map[c.key].examples.length < 5 &&
            !map[c.key].examples.includes(ex)
          ) {
            map[c.key].examples.push(ex);
          }
        });
      }
    });
  });

  const arr = Object.values(map).map((entry) => ({
    key: entry.key,
    total_count: entry.total_count,
    theme_count: entry.themes.size,
    themes: Array.from(entry.themes),
    examples: entry.examples,
  }));

  arr.sort((a, b) => b.total_count - a.total_count);
  return arr;
}


  // ── Public API ─────────────────────────────

  const InsightsEngine = {
    // modeller
    createEmptyChamber,
    createSignalFromMessage,
    addSignalToChamber,
    splitIntoSentences,
    getInsightsForTopic,
    computeTopicStats,
    computeSemanticCounts,
    computeDimensionsSummary,
    createPathSteps,
    createConceptPathForConcept,
    createSynthesisText,
    createArticleDraft,
    computeTopicsOverview,
    createNarrativeForTopic,
    extractConcepts,
  mergeConcepts,
  getConceptsForTheme
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = InsightsEngine;
  } else {
    global.InsightsEngine = InsightsEngine;
  }
})(this);
