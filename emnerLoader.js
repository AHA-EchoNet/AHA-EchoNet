// emnerLoader.js
// Felles, enkel loader for emne-filer

window.Emner = (function () {
  const EMNER_INDEX = {
    historie: "/emner/emner_historie.json",
    by: "/emner/emner_by.json",
    kunst: "/emner/emner_kunst.json",
    // legg til flere: musikk, sport, osv.
    musikk: "/emner/emner_musikk.json",
    natur: "/emner/emner_natur.json",
    vitenskap: "/emner/emner_vitenskap.json",
    litteratur: "/emner/emner_litteratur.json",
    populaerkultur: "/emner/emner_popkultur.json",
    naeringsliv: "/emner/emner_naeringsliv.json"
  };

  async function loadForSubject(subjectId) {
    const url = EMNER_INDEX[subjectId];
    if (!url) return [];
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("Kunne ikke laste emner for", subjectId, res.status);
      return [];
    }
    return res.json();
  }

  return {
    loadForSubject
  };
})();
