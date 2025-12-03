// server.js
// Enkel AHA-agent-backend med stubbet "AI"-logikk.
// Senere kan du bytte ut buildAHAResponse med et faktisk LLM-kall.

import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Hjelpefunksjon: lag et enkelt, men meningsfullt svar basert på state
function buildAHAResponse(state) {
  const themeId = state.theme_id || "ukjent_tema";
  const stats = state.topic_stats || {};
  const sem = state.topic_semantics || {};
  const dims = state.topic_dimensions || {};
  const meta = state.meta_profile || null;

  const sat = stats.insight_saturation || 0;
  const density = stats.concept_density || 0;
  const phase = stats.user_phase || "ukjent";

  const freqOfteAlltid =
    ((sem.frequency && sem.frequency.ofte) || 0) +
    ((sem.frequency && sem.frequency.alltid) || 0);

  const totalInsights = stats.insight_count || 0;
  const neg = (sem.valence && sem.valence.negativ) || 0;
  const pos = (sem.valence && sem.valence.positiv) || 0;

  const krav = (sem.modality && sem.modality.krav) || 0;
  const hindring = (sem.modality && sem.modality.hindring) || 0;

  const fokus = [];
  if (dims.emosjon > 0) fokus.push("følelser");
  if (dims.tanke > 0) fokus.push("tanker");
  if (dims.atferd > 0) fokus.push("konkrete handlinger");
  if (dims.kropp > 0) fokus.push("kroppslige reaksjoner");
  if (dims.relasjon > 0) fokus.push("relasjoner");

  // Sammendrag
  const summaryLines = [];

  if (sat < 20) {
    summaryLines.push(
      "Dette temaet er så vidt påbegynt – du har gitt motoren noen første smakebiter, men lite samlet materiale ennå."
    );
  } else if (sat < 60) {
    summaryLines.push(
      "Her begynner det å tegne seg et mønster – du har skrevet en del, og motoren ser konturene av noe som gjentar seg."
    );
  } else {
    summaryLines.push(
      "Dette fremstår som et tydelig mønster i livet ditt – du har delt såpass mye at motoren leser dette som et sentralt tema."
    );
  }

  // Fase-tekst
  const phaseMap = {
    utforskning:
      "Du er i utforskning: du undersøker, beskriver og prøver å forstå hva som faktisk skjer.",
    mønster:
      "Du er i mønster-fase: du har begynt å se gjentakelser og kan snart formulere en slags regel for hvordan dette fungerer hos deg.",
    press:
      "Motoren leser mye indre trykk her – mye ‘må/burde’ og opplevelse av krav rundt dette temaet.",
    fastlåst:
      "Motoren leser dette som mer fastlåst: mye trykk og ubehag, og lite opplevd handlingsrom akkurat nå.",
    integrasjon:
      "Motoren leser deg som i integrasjonsfase: du er i ferd med å flette det du har forstått inn i hverdagen."
  };

  if (phaseMap[phase]) {
    summaryLines.push(phaseMap[phase]);
  }

  // Det jeg ser
  const whatISee = [];

  if (freqOfteAlltid > 0 && totalInsights > 0) {
    const andel = Math.round((freqOfteAlltid / totalInsights) * 100);
    if (andel >= 60) {
      whatISee.push(
        "Du beskriver dette som noe som skjer «ofte» eller «alltid», ikke bare som enkelthendelser."
      );
    } else {
      whatISee.push(
        "Noe av dette skjer ofte, men ikke alt – det er både sterke mønstre og mer sporadiske episoder."
      );
    }
  }

  if (neg > 0 || pos > 0) {
    const negPct = totalInsights
      ? Math.round((neg / totalInsights) * 100)
      : 0;
    const posPct = totalInsights
      ? Math.round((pos / totalInsights) * 100)
      : 0;

    if (neg > 0 && pos === 0) {
      whatISee.push(
        "Språket ditt her er mest negativt – dette området kjennes ofte tungt, krevende eller frustrerende."
      );
    } else if (pos > 0 && neg === 0) {
      whatISee.push(
        "Her beskriver du mest positive erfaringer – dette temaet har preg av ressurser, flyt eller mestring."
      );
    } else {
      whatISee.push(
        `Du har både negative og positive beskrivelser her (ca. ${negPct}% negative og ${posPct}% positive) – temaet rommer både det som er vanskelig og det som faktisk fungerer.`
      );
    }
  }

  if (krav + hindring > 0) {
    if (krav > 0 && hindring > 0) {
      whatISee.push(
        "Det er både mye «må/burde/skal» og «klarer ikke/får ikke til» – altså både indre krav og opplevd hindring."
      );
    } else if (krav > 0) {
      whatISee.push(
        "Det er en del ‘må/burde/skal’ i språket ditt – du setter tydelige krav til deg selv på dette området."
      );
    } else if (hindring > 0) {
      whatISee.push(
        "Du beskriver flere situasjoner der du opplever å ikke få det til – hindringer kommer tydelig frem i måten du skriver på."
      );
    }
  }

  if (fokus.length > 0) {
    whatISee.push(
      "Du beskriver dette temaet mest gjennom " + fokus.join(", ") + "."
    );
  }

  // Neste steg
  const nextSteps = [];

  if (sat < 30) {
    nextSteps.push(
      "Bruk et par minutter på å beskrive én konkret situasjon der dette dukker opp. Hva skjer først, og hva skjer etterpå?"
    );
    nextSteps.push(
      "Prøv å sette ord på hva du kjenner i kroppen når dette skjer – én setning er nok."
    );
  } else if (sat < 60) {
    nextSteps.push(
      "Velg én typisk situasjon i dette temaet og beskriv den i litt mer detalj. Det gjør det lettere å lage en liten sti senere."
    );
    nextSteps.push(
      "Formuler én setning som starter med «Når dette skjer, pleier jeg å…» – det hjelper motoren å se mønsteret tydeligere."
    );
  } else {
    if (density >= 60) {
      nextSteps.push(
        "Forsøk å skrive en kort tekst på 4–6 setninger om hva du egentlig har forstått om deg selv i dette temaet."
      );
      nextSteps.push(
        "Se om du kan trekke ut 1–2 prinsipper eller læresetninger du vil ta med deg videre."
      );
    } else {
      nextSteps.push(
        "Prøv å samle det du har skrevet til 3–4 overskrifter eller nøkkelord som fanger essensen av dette temaet."
      );
      nextSteps.push(
        "For hvert nøkkelord: skriv én setning som forklarer hva det betyr for deg i praksis."
      );
    }
  }

  // Spørsmål – enkelt og brukbart
  let oneQuestion =
    "Hvis du skulle beskrive hva som egentlig er viktigst for deg å få til i dette temaet akkurat nå, hva ville du sagt?";

  if (phase === "fastlåst") {
    oneQuestion =
      "Kan du huske én situasjon der dette var litt mindre fastlåst enn vanlig – hva var annerledes da?";
  } else if (phase === "integrasjon") {
    oneQuestion =
      "Hva er én liten måte du allerede har begynt å leve annerledes på, som du vil fortsette å støtte fremover?";
  }

  // Tone
  const tone = "rolig, støttende, nysgjerrig";

  return {
    theme_id: themeId,
    summary: summaryLines.join(" "),
    what_i_see: whatISee,
    next_steps: nextSteps,
    one_question: oneQuestion,
    tone
  };
}

// Endepunktet AHA-AI-knappen i frontend kaller
app.post("/api/aha-agent", (req, res) => {
  try {
    const state = req.body || {};
    const response = buildAHAResponse(state);
    res.json(response);
  } catch (err) {
    console.error("Feil i /api/aha-agent:", err);
    res.status(500).json({
      error: "Internal server error in AHA-agent",
      detail: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`AHA-agent backend kjører på http://localhost:${PORT}`);
});
