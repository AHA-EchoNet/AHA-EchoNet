// server.js
// Ekte AHA-agent backend (ESM) + statisk server for AHA-frontenden

import express from "express";
import cors from "cors";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3001;

// ESM-hjelpere for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sjekk at vi har API-nøkkel
if (!process.env.OPENAI_API_KEY) {
  console.error("Mangler OPENAI_API_KEY i miljøvariablene.");
  process.exit(1);
}

// OpenAI-klient
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// 🚩 NYTT: server static filer (index.html, ahaChat.js, css, osv.) fra repoet
app.use(express.static(__dirname));

// Egen liten healthcheck (valgfritt)
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "AHA-agent backend kjører" });
});

// Bygger prompt til modellen basert på state
function buildPromptFromState(state) {
  return `
Du er en AHA-agent som hjelper en bruker å forstå egne mønstre i livet sitt.

Du får et JSON-objekt kalt "state" fra en innsiktsmotor. Det inneholder:
- "theme_id": hvilket tema dette gjelder (f.eks. "th_motstand_prokrastinering")
- "topic_stats": metning, begrepstetthet, fase, foreslått artefakt-type osv.
- "topic_semantics": tellinger for frekvens (ofte/alltid), valens (positiv/negativ/blandet), modalitet (må/burde/skal, klarer ikke/får ikke til), tid, tempo, osv.
- "topic_dimensions": hvilke dimensjoner dette temaet handler mest om (følelser, tanker, atferd, kropp, relasjon)
- "topic_narrative": en enkel narrativ tekst som motoren har laget
- "top_insights": de 3–5 sterkeste innsiktene for dette temaet (med tittel, summary, semantic, strength osv.)
- "meta_profile": en global profil på tvers av temaer (kan være null hvis ikke beregnet)
- "field_profile": en fag-/feltprofil (f.eks. "Historie", "Vitenskap") hentet fra History Go-merker – bruk den hvis det gir mening for språk og vinkling

OPPGAVE:
Du skal lese state som en klok terapeut/coach som forstår prosesser over tid.
Du skal ikke bare gjenta state, men bruke den til å si noe meningsfullt og konkret.

Du skal:

1) Lage et kort sammendrag ("summary") på 2–4 setninger om hvordan dette temaet ser ut nå.
   - Bruk gjerne ord som "mønster", "trykk", "fase", "metning" hvis det gir mening.
   - Knytt gjerne til fase hvis "topic_stats.user_phase" er satt (utforskning, mønster, press, fastlåst, integrasjon).

2) Skrive 2–4 konkrete observasjoner ("what_i_see") om mønstre du ser.
   Eksempler på typer observasjoner:
   - hvor ofte dette ser ut til å skje (ofte/alltid vs sporadisk)
   - emosjonell farge (mest negativt, både negativt og positivt, mest positivt)
   - grad av krav/hindring (må/burde/skal vs klarer ikke/får ikke til)
   - hvilke dimensjoner som er mest aktive (følelser, tanker, atferd, kropp, relasjon)
   Observasjonene skal være spesifikke og tydelig knyttet til dataen i state.

3) Foreslå 2–4 små, konkrete neste steg ("next_steps") som brukeren faktisk kan teste i hverdagen.
   Eksempler:
   - beskrive én typisk situasjon mer detaljert
   - formulere én setning av typen "Når dette skjer, pleier jeg å..."
   - lage et lite eksperiment de kan teste neste uke
   Stegene må være små, gjennomførbare og ikke dramatiske.

4) Stille ett godt, åpent spørsmål ("one_question") som brukeren kan svare på nå.
   - Ikke ja/nei-spørsmål.
   - Gjerne knyttet til å utforske mønstre, unntak, ønsker eller retning videre.
   - Hvis fasen er "fastlåst": spør gjerne etter unntak eller små bevegelser.
   - Hvis fasen er "integrasjon": spør gjerne etter hvordan de vil støtte det som allerede fungerer.

5) Sette "tone" til noe som beskriver holdningen i svaret, f.eks.
   - "rolig, støttende, nysgjerrig"
   - "tydelig, konkret, varm"
   Hold deg til korte beskrivelser.

SPRÅK:
- Svar på norsk.
- Bruk enkelt, hverdagslig språk.
- Ikke sykeliggjør, og ikke overdriv dramatikk.

VIKTIG:
- Ikke lov mer enn det dataen støtter.
- Ikke gi direkte råd om medisiner, terapi eller diagnose.
- Ikke legg inn ekstra tekst rundt JSON – svaret skal kun være et JSON-objekt.

JSON-formatet må være HELT NØYAKTIG slik:

{
  "theme_id": string,
  "summary": string,
  "what_i_see": string[],
  "next_steps": string[],
  "one_question": string,
  "tone": string
}

Her er "state"-objektet du skal bruke:
${JSON.stringify(state, null, 2)}
`;
}

// Endepunkt frontend kaller fra callAHAAgentForCurrentTopic()
app.post("/api/aha-agent", async (req, res) => {
  try {
    const state = req.body || {};

    if (!state.theme_id) {
      return res.status(400).json({ error: "Mangler theme_id i state." });
    }

    const prompt = buildPromptFromState(state);

    const completion = await openai.responses.create({
      model: "gpt-4.1-mini", // evt. bytt modell senere
      input: [
        {
          role: "system",
          content:
            "Du er en AHA-agent som gir kortfattede, konkrete og omsorgsfulle tilbakemeldinger basert på innsiktsdata.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "AHAAgentResponse",
          schema: {
            type: "object",
            required: [
              "theme_id",
              "summary",
              "what_i_see",
              "next_steps",
              "one_question",
              "tone",
            ],
            properties: {
              theme_id: { type: "string" },
              summary: { type: "string" },
              what_i_see: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
              },
              next_steps: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
              },
              one_question: { type: "string" },
              tone: { type: "string" },
            },
          },
          strict: true,
        },
      },
    });

    const first = completion.output[0].content[0];
    let data;

    if (first.json) {
      data = first.json;
    } else if (typeof first.text === "string") {
      data = JSON.parse(first.text);
    } else {
      throw new Error("Uventet format på model-output.");
    }

    res.json(data);
  } catch (err) {
    console.error("Feil i /api/aha-agent:", err);
    res.status(500).json({
      error: "Internal server error in AHA-agent",
      detail: err.message,
    });
  }
});

// Fallback: send index.html for rot-url (nyttig hvis noen går til /)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`AHA-agent backend + frontend kjører på http://localhost:${PORT}`);
});
