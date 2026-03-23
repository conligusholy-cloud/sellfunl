const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();

const STRIPE_SECRET = defineSecret("STRIPE_SECRET_KEY");
const WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

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
    const { topic, pageTitle, section, max_tokens = 4000 } = request.data;

    if (!topic) {
      throw new HttpsError("invalid-argument", "Chybí popis produktu/tématu.");
    }

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

    try {
      const parsed = JSON.parse(rawText);
      return { result: parsed };
    } catch {
      return { result: { text: rawText } };
    }
  }
);

// ─── STRIPE CONNECT: vytvoř Express účet + onboarding URL ──────────────────
exports.createConnectOnboarding = onCall(
  { secrets: [STRIPE_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");

    const uid = request.auth.uid;
    const stripe = Stripe(STRIPE_SECRET.value());
    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    let stripeAccountId = userDoc.data()?.stripeAccountId;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "CZ",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      stripeAccountId = account.id;
      await userRef.set({ stripeAccountId }, { merge: true });
    }

    const isDev = process.env.FUNCTIONS_EMULATOR === "true";
    const baseUrl = isDev ? "http://localhost:5173" : "https://selffunl.cz";

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${baseUrl}/dashboard`,
      return_url:  `${baseUrl}/dashboard`,
      type: "account_onboarding",
    });

    return { url: accountLink.url };
  }
);

// ─── STRIPE CONNECT: zkontroluj stav účtu ──────────────────────────────────
exports.getConnectStatus = onCall(
  { secrets: [STRIPE_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");

    const uid = request.auth.uid;
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(uid).get();
    const stripeAccountId = userDoc.data()?.stripeAccountId;

    if (!stripeAccountId) return { connected: false };

    const stripe = Stripe(STRIPE_SECRET.value());
    const account = await stripe.accounts.retrieve(stripeAccountId);

    return {
      connected: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    };
  }
);

// ─── STRIPE CONNECT: webhook ────────────────────────────────────────────────
exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET, WEBHOOK_SECRET] },
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const stripe = Stripe(STRIPE_SECRET.value());
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, WEBHOOK_SECRET.value());
    } catch (err) {
      console.error("Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "account.updated") {
      const account = event.data.object;
      const db = admin.firestore();

      const snap = await db
        .collection("users")
        .where("stripeAccountId", "==", account.id)
        .limit(1)
        .get();

      if (!snap.empty) {
        await snap.docs[0].ref.set(
          {
            stripeChargesEnabled: account.charges_enabled,
            stripePayoutsEnabled: account.payouts_enabled,
            stripeDetailsSubmitted: account.details_submitted,
          },
          { merge: true }
        );
      }
    }

    res.json({ received: true });
  }
);