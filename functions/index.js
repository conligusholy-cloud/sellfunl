const { onCall, HttpsError } = require("firebase-functions/v2/https");

// ─── PŘEKLAD ───────────────────────────────────────────────────────────────
exports.translate = onCall(
  { region: "us-central1", timeoutSeconds: 120, secrets: ["ANTHROPIC_API_KEY"] },
  async (request) => {
    const { prompt, max_tokens = 4000 } = request.data;

    if (!prompt) {
      throw new HttpsError("invalid-argument", "Chybí prompt.");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", response.status, err);
      throw new HttpsError("internal", `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return { result: data.content?.[0]?.text || "" };
  }
);

// ─── AI GENERÁTOR OBSAHU ────────────────────────────────────────────────────
exports.generateContent = onCall(
  { region: "us-central1", timeoutSeconds: 120, secrets: ["ANTHROPIC_API_KEY"] },
  async (request) => {
    const { topic, pageTitle, section, fields, max_tokens = 4000 } = request.data;

    if (!topic) {
      throw new HttpsError("invalid-argument", "Chybí popis produktu/tématu.");
    }

    // Sestavení promptu podle sekce (hero / obsah stránky)
    let prompt = "";

    if (section === "hero") {
      prompt = `
Jsi expert na copywriting a tvorbu přistávacích stránek.
Vygeneruj obsah pro HERO sekci webové stránky.

Produkt / téma: ${topic}
Název stránky: ${pageTitle || ""}

Vygeneruj následující pole jako JSON objekt (bez markdown, jen čistý JSON):
{
  "badge": "krátký badge text (max 5 slov, např. '⚡ Limitovaná nabídka 2024')",
  "headline": "hlavní nadpis (max 10 slov, výrazný, prodejní)",
  "subheadline": "podnadpis (max 20 slov, benefit-oriented)",
  "ctaPrimary": "text hlavního tlačítka (max 5 slov)",
  "ctaSecondary": "text vedlejšího tlačítka (max 5 slov)"
}

Piš v jazyce odpovídajícím tématu. Buď konkrétní, prodejní a přesvědčivý.
      `;
    } else if (section === "content") {
      prompt = `
Jsi expert na copywriting a tvorbu přistávacích stránek.
Vygeneruj bohatý obsah pro stránku.

Produkt / téma: ${topic}
Název stránky: ${pageTitle || ""}

Vygeneruj jako JSON objekt (bez markdown, jen čistý JSON):
{
  "headline": "hlavní nadpis sekce (výrazný, s emoji)",
  "perex": "úvodní odstavec (2-3 věty, benefit-oriented)",
  "bullets": [
    "✅ benefit 1 (1 věta)",
    "✅ benefit 2 (1 věta)",
    "✅ benefit 3 (1 věta)",
    "✅ benefit 4 (1 věta)",
    "✅ benefit 5 (1 věta)"
  ],
  "cta": "text výzvy k akci (max 8 slov)"
}

Buď konkrétní, prodejní, používej emoji. Piš ve stejném jazyce jako téma.
      `;
    } else {
      // Obecný generátor
      prompt = `
Jsi expert na copywriting.
Produkt / téma: ${topic}
Název stránky: ${pageTitle || ""}

Vygeneruj prodejní text pro webovou stránku. Buď konkrétní a přesvědčivý.
Použij emoji. Odpověz jako JSON: { "text": "vygenerovaný obsah" }
      `;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", response.status, err);
      throw new HttpsError("internal", `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || "";

    // Bezpečné parsování JSON odpovědi
    try {
      const parsed = JSON.parse(rawText);
      return { result: parsed };
    } catch {
      return { result: { text: rawText } };
    }
  }
);