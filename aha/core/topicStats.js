// /aha/core/topicStats.js

import { getInsightsForTopic } from './insightsChamber.js';

/**
 * Enkel liste med norske stopwords for V1.
 * Du kan utvide senere.
 */
const STOPWORDS = new Set([
  'og', 'i', 'på', 'som', 'for', 'med', 'til',
  'det', 'den', 'de', 'er', 'en', 'et', 'å',
  'jeg', 'du', 'vi', 'dere', 'han', 'hun',
  'oss', 'av', 'fra', 'men', 'om', 'så'
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean);
}

function filterStopwords(tokens) {
  return tokens.filter(t => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Beregn begrepstetthet (0–100) for et sett innsikter.
 */
function computeConceptDensity(insights) {
  const combined = insights
    .map(ins => `${ins.title}. ${ins.summary}`)
    .join(' ');

  const tokens = filterStopwords(tokenize(combined));
  if (tokens.length === 0) return 0;

  const unique = new Set(tokens);
  const rawDensity = unique.size / tokens.length; // f.eks. 0.05–0.3

  // Normaliser til 0–100 (0.25 ~ veldig tett)
  const normalized = Math.max(0, Math.min(1, rawDensity / 0.25));
  return Math.round(normalized * 100);
}

/**
 * Veldig enkel innsiktsmetningsgrad (0–100) basert på antall innsikter.
 * 0 innsikter = 0, 10+ innsikter = 100.
 */
function computeInsightSaturation(insights) {
  const n = insights.length;
  if (n <= 0) return 0;
  const raw = Math.min(10, n) * 10; // 1 innsikt = 10, 10+ = 100
  return raw;
}

/**
 * Velg artefakt-type basert på metning + begrepstetthet.
 */
function decideArtifactType(saturation, density) {
  if (saturation < 30 && density < 30) return 'kort';
  if (saturation >= 30 && saturation < 60 && density < 60) return 'liste';
  if (saturation >= 30 && saturation < 60 && density >= 60) return 'sti';
  if (saturation >= 60 && density >= 60) return 'artikkel';
  if (saturation >= 60 && density < 60) return 'sti';
  return 'kort';
}

/**
 * Beregn TopicStats for ett subject + tema.
 */
export function computeTopicStats(chamber, subjectId, themeId) {
  const insights = getInsightsForTopic(chamber, subjectId, themeId);
  const saturation = computeInsightSaturation(insights);
  const density = computeConceptDensity(insights);
  const artifactType = decideArtifactType(saturation, density);

  /** @type {import('./types').TopicStats} */
  const stats = {
    topic_id: themeId,
    subject_id: subjectId,
    insight_saturation: saturation,
    concept_density: density,
    artifact_type: artifactType,
    insight_count: insights.length
  };

  return stats;
}
