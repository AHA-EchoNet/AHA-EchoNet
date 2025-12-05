async function matchEmneForText(subjectId, text) {
  if (!text || !text.trim()) return null;

  // 1) Hent alle emner for faget (merket)
  const emner = await Emner.loadForSubject(subjectId);
  if (!Array.isArray(emner) || emner.length === 0) return null;

  const lower = text.toLowerCase();

  let best = null;
  let bestScore = 0;

  for (const emne of emner) {
    const keywords = (emne.keywords || []).map(k => String(k).toLowerCase());
    const concepts = (emne.core_concepts || []).map(c => String(c).toLowerCase());

    let score = 0;

    keywords.forEach(k => {
      if (k && lower.includes(k)) score += 3; // nøkkelord teller litt mer
    });

    concepts.forEach(c => {
      if (c && lower.includes(c)) score += 2;
    });

    if (score > bestScore) {
      bestScore = score;
      best = emne;
    }
  }

  // Enkel terskel: minst litt treff
  if (!best || bestScore === 0) return null;

  return {
    emne_id: best.emne_id || best.id,
    title: best.title,
    short_label: best.short_label,
    score: bestScore
  };
}
