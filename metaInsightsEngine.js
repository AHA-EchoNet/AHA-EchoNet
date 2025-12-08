// metaInsightsEngine.js
// ─────────────────────────────────────────────
// AHA Meta InsightsEngine – leser data fra InsightsEngine
// og bygger et meta-bilde av brukeren (på tvers av temaer)
// ─────────────────────────────────────────────

(function (global) {
  "use strict";

  // Forvent at insightsChamber.js er lastet før denne
  const IE =
    global.InsightsEngine ||
    (typeof require === "function"
      ? require("./insightsChamber.js")
      : null);

  if (!IE) {
    console.warn(
      "MetaInsightsEngine: Fant ikke InsightsEngine. " +
        "Pass på at insightsChamber.js lastes før metaInsightsEngine.js."
    );
  }

  // ── Hjelpere ────────────────────────────────────────────

  // Finn alle temaer for en gitt bruker (subjectId)
  function listThemesForSubject(chamber, subjectId) {
    const themes = new Set();
    const insights = chamber.insights || [];

    for (const ins of insights) {
      if (ins.subject_id === subjectId && ins.theme_id) {
        themes.add(ins.theme_id);
      }
    }

    return Array.from(themes);
  }

  // Livssyklus for én innsikt (ny → voksende → moden → integrasjon)
  function computeInsightLifecycle(insight, now = new Date()) {
    const first = new Date(insight.first_seen);
    const last = new Date(insight.last_updated || insight.first_seen);

    const ageDays = (now - first) / (1000 * 60 * 60 * 24);
    const recentDays = (now - last) / (1000 * 60 * 60 * 24);

    const evidence = insight.strength?.evidence_count || 0;

    let status = "ny";

    if (evidence >= 2 && ageDays > 1) status = "voksende";
    if (evidence >= 4 && ageDays > 7) status = "moden";
    if (status === "moden" && recentDays > 14) status = "integrasjon";

    // Senere kan du legge til "forkastet" hvis nye signaler motsier den
    return status;
  }

  // Berik alle innsikter for en bruker med lifecycle-status
  function enrichInsightsWithLifecycle(chamber, subjectId) {
    const insights = chamber.insights || [];
    const now = new Date();

    return insights
      .filter((ins) => ins.subject_id === subjectId)
      .map((ins) => {
        const lifecycle = computeInsightLifecycle(ins, now);
        return { ...ins, lifecycle };
      });
  }

  // Global semantisk profil basert på tema-profiler
  function computeGlobalSemanticProfile(topicProfiles) {
    if (!topicProfiles.length) {
      return {
        avg_saturation: 0,
        modality: { krav: 0, mulighet: 0, hindring: 0, nøytral: 0 },
        valence: { negativ: 0, positiv: 0, blandet: 0, nøytral: 0 },
        phases: {
          utforskning: 0,
          mønster: 0,
          press: 0,
          fastlåst: 0,
          integrasjon: 0,
        },
        pressure_index: 0,
        negativity_index: 0,
        stuck_topics: 0,
        integration_topics: 0,
      };
    }

    let sumSaturation = 0;

    const modalityCounts = {
      krav: 0,
      mulighet: 0,
      hindring: 0,
      nøytral: 0,
    };

    const valenceCounts = {
      negativ: 0,
      positiv: 0,
      blandet: 0,
      nøytral: 0,
    };

    const phaseCounts = {
      utforskning: 0,
      mønster: 0,
      press: 0,
      fastlåst: 0,
      integrasjon: 0,
    };

    for (const t of topicProfiles) {
      const stats = t.stats;
      const semCounts = t.semCounts;

      sumSaturation += stats.insight_saturation || 0;

      // modality / valence fra computeSemanticCounts
      if (semCounts && semCounts.modality) {
        for (const key in semCounts.modality) {
          modalityCounts[key] =
            (modalityCounts[key] || 0) + semCounts.modality[key];
        }
      }

      if (semCounts && semCounts.valence) {
        for (const key in semCounts.valence) {
          valenceCounts[key] =
            (valenceCounts[key] || 0) + semCounts.valence[key];
        }
      }

      const phase = stats.user_phase || "utforskning";
      if (phaseCounts[phase] !== undefined) {
        phaseCounts[phase]++;
      }
    }

    const avgSaturation = sumSaturation / topicProfiles.length;

    const pressureIndex =
      (modalityCounts.krav + modalityCounts.hindring) /
      Math.max(1, modalityCounts.mulighet + modalityCounts.nøytral);

    const negativityIndex =
      valenceCounts.negativ /
      Math.max(
        1,
        valenceCounts.positiv +
          valenceCounts.blandet +
          valenceCounts.nøytral
      );

    const stuckTopics = phaseCounts.fastlåst || 0;
    const integrationTopics = phaseCounts.integrasjon || 0;

    return {
      avg_saturation: avgSaturation,
      modality: modalityCounts,
      valence: valenceCounts,
      phases: phaseCounts,
      pressure_index: pressureIndex,
      negativity_index: negativityIndex,
      stuck_topics: stuckTopics,
      integration_topics: integrationTopics,
    };
  }

  // Finn kryss-tema-mønstre (press, utforskning, fastlåst cluster)
  function detectCrossTopicPatterns(topicProfiles, globalProfile) {
    const patterns = [];

    // 1) Press-mønster på tvers av tema
    const highPressure = globalProfile.pressure_index > 1.2;
    if (highPressure) {
      const pressThemes = topicProfiles
        .filter(
          (t) =>
            t.stats.user_phase === "press" ||
            t.stats.user_phase === "fastlåst"
        )
        .map((t) => t.theme_id);

      if (pressThemes.length >= 2) {
        patterns.push({
          id: "cross_pressure",
          type: "global_pattern",
          description:
            "Sterkt press-/må-/burde-/hindringsmønster i flere tema.",
          themes: pressThemes,
        });
      }
    }

    // 2) Utforskende mønster (lavt press + mer positiv/balansert valens)
    const lowPressure = globalProfile.pressure_index < 0.8;
    const morePositive = globalProfile.negativity_index < 0.7;

    if (lowPressure && morePositive) {
      const exploratoryThemes = topicProfiles
        .filter(
          (t) =>
            t.stats.user_phase === "utforskning" ||
            t.stats.user_phase === "integrasjon"
        )
        .map((t) => t.theme_id);

      if (exploratoryThemes.length >= 2) {
        patterns.push({
          id: "cross_exploration",
          type: "global_pattern",
          description:
            "Utforskende/åpent mønster på tvers av flere tema.",
          themes: exploratoryThemes,
        });
      }
    }

    // 3) Cluster av fastlåste tema samtidig
    const stuckClusters = topicProfiles
      .filter((t) => t.stats.user_phase === "fastlåst")
      .map((t) => t.theme_id);

    if (stuckClusters.length >= 2) {
      patterns.push({
        id: "stuck_cluster",
        type: "cluster",
        description: "Flere tema er i fastlåst fase samtidig.",
        themes: stuckClusters,
      });
    }

    return patterns;
  }

  
  // ── Begrepskart på tvers av tema ────────────────────────

  function buildConceptIndex(enrichedInsights) {
    const index = new Map();

    (enrichedInsights || []).forEach((ins) => {
      const themeId = ins.theme_id || "ukjent";

      (ins.concepts || []).forEach((c) => {
        if (!c || !c.key) return;

        let entry = index.get(c.key);
        if (!entry) {
          entry = {
            key: c.key,
            total_count: 0,
            themes: new Set(),
            examples: [],
          };
          index.set(c.key, entry);
        }

        entry.total_count += c.count || 1;
        entry.themes.add(themeId);

        if (Array.isArray(c.examples)) {
          c.examples.forEach((ex) => {
            if (
              ex &&
              entry.examples.length < 5 &&
              !entry.examples.includes(ex)
            ) {
              entry.examples.push(ex);
            }
          });
        }
      });
    });

    return Array.from(index.values())
      .map((entry) => ({
        key: entry.key,
        total_count: entry.total_count,
        theme_count: entry.themes.size,
        themes: Array.from(entry.themes),
        examples: entry.examples,
      }))
      .sort((a, b) => b.total_count - a.total_count);
  }

    // ── Begrepsanalyse: POS-filter + multiword ──────────────

  // Enkel heuristikk: "substantiv-ish" / fagbegreper
  //  - vi beholder:
  //      * ting som har klassiske norske fag-endelser
  //      * 1-ordsbegreper med lengde >= 4
  //  - vi filtrerer ut:
  //      * åpenbart korte/lette ord
  //      * setningsfragmenter med mange småord
  function posFilterConcepts(conceptIndex) {
    const keep = [];

    (conceptIndex || []).forEach((c) => {
      if (!c || !c.key) return;
      const raw = String(c.key).trim();
      if (!raw) return;

      const key = raw.toLowerCase();

      // dropp ekstremt korte "begreper"
      if (key.length <= 3) return;

      const parts = key.split(/\s+/).filter(Boolean);
      const wordCount = parts.length;

      // multiword lar vi slippe igjennom – de fanges også
      // av multiword-funksjonen under
      if (wordCount > 1 && wordCount <= 6) {
        keep.push(c);
        return;
      }

      // 1-ords: sjekk faglige endelser
      const nominalSuffixes = [
        "het",
        "else",
        "skap",
        "sjon",
        "asjon",
        "ering",
        "ologi",
        "logi",
        "dom",
        "ning",
        "isme",
        "itet",
      ];
      const hasNominalSuffix = nominalSuffixes.some((suf) =>
        key.endsWith(suf)
      );

      if (hasNominalSuffix) {
        keep.push(c);
        return;
      }

      // Hvis det er ett ord, >= 4 tegn og ikke åpenbart funksjonsord,
      // behandler vi det som et mulig substantiv/fagord
      const commonStop = [
        "og",
        "eller",
        "men",
        "for",
        "til",
        "fra",
        "som",
        "på",
        "i",
        "av",
        "at",
        "en",
        "et",
        "den",
        "det",
        "de",
      ];

      if (
        wordCount === 1 &&
        key.length >= 4 &&
        !commonStop.includes(key)
      ) {
        keep.push(c);
      }
    });

    // Sorter nedover på total_count hvis feltet finnes
    return keep.slice().sort((a, b) => {
      const ac = a.total_count || a.count || 0;
      const bc = b.total_count || b.count || 0;
      return bc - ac;
    });
  }

  // Multiword-begreper: 2–4 ord, brukes til å plukke opp ting som
  // "symbolsk orden", "kunnskapsregime", "politisk institusjon"
  function extractMultiwordConcepts(conceptIndex, options) {
    const opts = options || {};
    const minWords = opts.minWords || 2;
    const maxWords = opts.maxWords || 4;

    const res = [];

    (conceptIndex || []).forEach((c) => {
      if (!c || !c.key) return;
      const raw = String(c.key).trim();
      if (!raw) return;

      const parts = raw.split(/\s+/).filter(Boolean);
      const n = parts.length;
      if (n < minWords || n > maxWords) return;

      // Dropp åpenbare setningsfragmenter som starter med småord
      const first = parts[0].toLowerCase();
      const badStarters = ["og", "eller", "men", "for", "som", "at"];
      if (badStarters.includes(first)) return;

      res.push(c);
    });

    return res;
  }

  function buildConceptIndexForTheme(chamber, subjectId, themeId) {
    // 1) berik alle innsikter for denne brukeren med livssyklus
    const enriched = enrichInsightsWithLifecycle(chamber, subjectId);

    // 2) bygg globalt begrepsindex
    const allConcepts = buildConceptIndex(enriched);

    // 3) filtrer ned til det temaet vi bryr oss om
    return allConcepts.filter(
      (c) => Array.isArray(c.themes) && c.themes.includes(themeId)
    );
  }

    // ── Fagprofil / samfunnsvitenskapelige teoriklynger ─────

  // Enkle "kanon"-klustere – juster/utvid som du vil.
  // Tanken er: begreper i konseptindeksen → treff på disse nøkkelordene.
  const THEORY_CLUSTERS = [
    {
      id: "marx",
      label: "Marx / kritisk politisk økonomi",
      family: "kritisk",
      disciplines: ["sosiologi", "historie"],
      weight: 1.2,
      keywords: [
        "klasse",
        "klasser",
        "klassestruktur",
        "arbeiderklasse",
        "kapitalisme",
        "kapitalistisk",
        "utbytting",
        "utnytting",
        "produksjonsmidler",
        "produksjonsforhold",
        "økonomisk struktur",
        "ideologi",
        "varefetisjisme",
        "historisk materialisme"
      ]
    },
    {
      id: "weber",
      label: "Weber / handling og rasjonalisering",
      family: "fortolkende",
      disciplines: ["sosiologi"],
      weight: 1.0,
      keywords: [
        "rasjonalisering",
        "byråkrati",
        "myndighet",
        "legitimitet",
        "makt",
        "verdierasjonell",
        "formålsrasjonell",
        "protestantisk etikk",
        "idealtyper"
      ]
    },
    {
      id: "durkheim",
      label: "Durkheim / sosial integrasjon",
      family: "strukturfunksjonell",
      disciplines: ["sosiologi"],
      weight: 1.0,
      keywords: [
        "solidaritet",
        "mekanisk solidaritet",
        "organisk solidaritet",
        "anomi",
        "kollektiv bevissthet",
        "sosiale fakta",
        "selvmord"
      ]
    },
    {
      id: "foucault",
      label: "Foucault / makt, diskurs, styringsregimer",
      family: "poststrukturalistisk",
      disciplines: ["sosiologi", "filosofi", "historie"],
      weight: 1.3,
      keywords: [
        "diskurs",
        "diskurser",
        "makt",
        "maktforhold",
        "makt/kunskap",
        "kunnskapsregime",
        "regime",
        "governmentality",
        "styringsrasjonalitet",
        "overvåkning",
        "biomakt",
        "normalisering",
        "subjektivering",
        "disiplinering",
        "institusjoner"
      ]
    },
    {
      id: "bourdieu",
      label: "Bourdieu / felt, habitus, kapital",
      family: "praksisteori",
      disciplines: ["sosiologi"],
      weight: 1.3,
      keywords: [
        "felt",
        "socialt felt",
        "habitus",
        "symbolsk orden",
        "symbolsk vold",
        "kapital",
        "kulturell kapital",
        "sosial kapital",
        "økonomisk kapital",
        "smak",
        "doxa"
      ]
    },
    {
      id: "goffman",
      label: "Goffman / interaksjonsritualer og roller",
      family: "mikrososiologi",
      disciplines: ["sosiologi", "psykologi"],
      weight: 0.9,
      keywords: [
        "rolle",
        "roller",
        "fasade",
        "frontstage",
        "backstage",
        "stigma",
        "definisjon av situasjonen",
        "ansikt",
        "rammeanalyse"
      ]
    },
    {
      id: "habermas",
      label: "Habermas / kommunikativ handling og offentlighet",
      family: "kritisk teori",
      disciplines: ["sosiologi", "filosofi"],
      weight: 1.1,
      keywords: [
        "offentlighet",
        "borgerlig offentlighet",
        "kommunikativ handling",
        "herredømmefri dialog",
        "system",
        "livsverden",
        "kolonisering av livsverden"
      ]
    },
    {
      id: "chicago",
      label: "Chicago / by, subkultur og hverdagsliv",
      family: "empirisk",
      disciplines: ["sosiologi"],
      weight: 0.9,
      keywords: [
        "subkultur",
        "byliv",
        "nabolag",
        "urban sosiologi",
        "avvik",
        "gategjeng",
        "migrasjon",
        "etnografi"
      ]
    }
  ];

  // Bygger en "fagprofil" fra en eksisterende konseptindeks
  function buildAcademicProfileFromConcepts(conceptIndex) {
    const clusters = THEORY_CLUSTERS.map((cluster) => ({
      id: cluster.id,
      label: cluster.label,
      family: cluster.family || null,
      disciplines: cluster.disciplines || [],
      score: 0,
      hits: []
    }));

    let totalConcepts = 0;

    (conceptIndex || []).forEach((c) => {
      const key = (c.key || "").toLowerCase();
      const freq = c.total_count || c.count || 1;
      if (!key) return;

      totalConcepts += freq;

      THEORY_CLUSTERS.forEach((cluster, idx) => {
        const hit = cluster.keywords.some((kw) =>
          key.includes(kw)
        );
        if (!hit) return;

        const weight = cluster.weight || 1;
        const bump = freq * weight;

        clusters[idx].score += bump;

        if (
          clusters[idx].hits.length < 10 &&
          !clusters[idx].hits.includes(key)
        ) {
          clusters[idx].hits.push(key);
        }
      });
    });

    const maxScore = clusters.reduce(
      (m, c) => (c.score > m ? c.score : m),
      0
    );

    const normalizedClusters = clusters
      .map((c) => ({
        ...c,
        relative: maxScore > 0 ? c.score / maxScore : 0
      }))
      .sort((a, b) => b.score - a.score);

    // Samle på tvers av fag (sosiologi, historie, filosofi, psykologi)
    const disciplineMap = {};
    normalizedClusters.forEach((c) => {
      (c.disciplines || []).forEach((d) => {
        if (!disciplineMap[d]) disciplineMap[d] = 0;
        disciplineMap[d] += c.score;
      });
    });

    const disciplineList = Object.keys(disciplineMap).map((d) => ({
      id: d,
      score: disciplineMap[d]
    }));
    const maxDisc = disciplineList.reduce(
      (m, d) => (d.score > m ? d.score : m),
      0
    );

    const disciplines = disciplineList
      .map((d) => ({
        ...d,
        relative: maxDisc > 0 ? d.score / maxDisc : 0
      }))
      .sort((a, b) => b.score - a.score);

    return {
      total_concepts: totalConcepts,
      clusters: normalizedClusters,
      disciplines
    };
  }

  // Hovedinngang for fagprofilen: tar enrichedInsights, gjenbruker conceptIndex
  function buildAcademicProfile(enrichedInsights) {
    const conceptIndex = buildConceptIndex(enrichedInsights || []);
    return buildAcademicProfileFromConcepts(conceptIndex);
  }
  
  // ── Semiotisk profil på tvers av innsikter ──────────────

  function buildSemioticProfile(enrichedInsights) {
    const summary = {
      total_insights: 0,
      body_count: 0,
      space_count: 0,
      tech_count: 0,
      heart_markers: 0,
      star_markers: 0,
      arrow_markers: 0,
      exclamation_markers: 0,
      emoji_count: 0,
    };

    for (const ins of enrichedInsights || []) {
      if (!ins || !ins.semiotic) continue;
      summary.total_insights += 1;

      const { domains = {}, markers = {}, emojis = [] } = ins.semiotic;

      if (domains.body) summary.body_count += 1;
      if (domains.space) summary.space_count += 1;
      if (domains.tech) summary.tech_count += 1;

      if (markers.heart) summary.heart_markers += 1;
      if (markers.stars) summary.star_markers += 1;
      if (markers.arrow) summary.arrow_markers += 1;
      if (markers.exclamation) summary.exclamation_markers += 1;

      summary.emoji_count += (emojis || []).length;
    }

    if (summary.total_insights > 0) {
      summary.body_ratio =
        summary.body_count / summary.total_insights;
      summary.space_ratio =
        summary.space_count / summary.total_insights;
      summary.tech_ratio =
        summary.tech_count / summary.total_insights;
      summary.emoji_per_insight =
        summary.emoji_count / summary.total_insights;
    } else {
      summary.body_ratio = 0;
      summary.space_ratio = 0;
      summary.tech_ratio = 0;
      summary.emoji_per_insight = 0;
    }

    return summary;
  }

  
  // ── Hovedfunksjon: bygg meta-profil for en bruker ───────

    function buildUserMetaProfile(chamber, subjectId) {
    if (!IE) {
      return null;
    }

    const themes = listThemesForSubject(chamber, subjectId);
    const topicProfiles = [];

    for (const themeId of themes) {
      const stats = IE.computeTopicStats(chamber, subjectId, themeId);
      const insights = IE.getInsightsForTopic(
        chamber,
        subjectId,
        themeId
      );
      const semCounts = IE.computeSemanticCounts(insights);

      topicProfiles.push({
        theme_id: themeId,
        stats,
        semCounts,
      });
    }

    const globalProfile = computeGlobalSemanticProfile(topicProfiles);
    const patterns = detectCrossTopicPatterns(
      topicProfiles,
      globalProfile
    );

        // Berik innsikter med lifecycle-status
    const enrichedInsights = enrichInsightsWithLifecycle(
      chamber,
      subjectId
    );

    // Globalt begrepskart, semiotikk og fagprofil
    const conceptIndex = buildConceptIndex(enrichedInsights);
    const semioticProfile = buildSemioticProfile(enrichedInsights);
    const academicProfile = buildAcademicProfile(enrichedInsights);

    return {
      subject_id: subjectId,
      topics: topicProfiles,
      global: globalProfile,
      semiotic: semioticProfile,
      patterns,
      insights: enrichedInsights, // innsikter med lifecycle-status
      concepts: conceptIndex,     // global begrepsindeks
      buildAcademicProfile,           // 🔹 ny
      buildAcademicProfileFromConcepts, // (valgfri, men nyttig)
     };

  // ── Public API for meta-motoren ─────────────────────────

  const MetaInsightsEngine = {
    buildUserMetaProfile,
    computeGlobalSemanticProfile,
    detectCrossTopicPatterns,
    enrichInsightsWithLifecycle,
    computeInsightLifecycle,
    buildConceptIndex,
    buildConceptIndexForTheme,
     // 🔹 nye begrepsverktøy
    posFilterConcepts,
    extractMultiwordCon,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = MetaInsightsEngine;
  } else {
    global.MetaInsightsEngine = MetaInsightsEngine;
  }
})(this);
