const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();

const STRIPE_SECRET   = defineSecret("STRIPE_SECRET_KEY");
const WEBHOOK_SECRET  = defineSecret("STRIPE_WEBHOOK_SECRET");
const CF_API_TOKEN    = defineSecret("CLOUDFLARE_API_TOKEN");
const CF_ACCOUNT_ID   = defineSecret("CLOUDFLARE_ACCOUNT_ID");

// ─── PŘEKLAD ───────────────────────────────────────────────────────────────
exports.translate = onCall(
  { region: "us-central1", timeoutSeconds: 120, secrets: ["ANTHROPIC_API_KEY"] },
  async (request) => {
    const { prompt, max_tokens = 4000 } = request.data;
    if (!prompt) throw new HttpsError("invalid-argument", "Chybí prompt.");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens, messages: [{ role: "user", content: prompt }] }),
    });
    if (!response.ok) { const err = await response.text(); throw new HttpsError("internal", `Anthropic API error: ${response.status}`); }
    const data = await response.json();
    return { result: data.content?.[0]?.text || "" };
  }
);

// ─── AI GENERÁTOR OBSAHU ────────────────────────────────────────────────────
exports.generateContent = onCall(
  { region: "us-central1", timeoutSeconds: 120, secrets: ["ANTHROPIC_API_KEY"] },
  async (request) => {
    const { topic, pageTitle, section, max_tokens = 4000 } = request.data;
    if (!topic) throw new HttpsError("invalid-argument", "Chybí popis produktu/tématu.");

    let prompt = "";
    if (section === "hero") {
      prompt = `Jsi expert na copywriting a tvorbu přistávacích stránek.\nVygeneruj obsah pro HERO sekci webové stránky.\n\nProdukt / téma: ${topic}\nNázev stránky: ${pageTitle || ""}\n\nVygeneruj následující pole jako JSON objekt (bez markdown, jen čistý JSON):\n{\n  "badge": "krátký badge text (max 5 slov)",\n  "headline": "hlavní nadpis (max 10 slov, výrazný, prodejní)",\n  "subheadline": "podnadpis (max 20 slov, benefit-oriented)",\n  "ctaPrimary": "text hlavního tlačítka (max 5 slov)",\n  "ctaSecondary": "text vedlejšího tlačítka (max 5 slov)"\n}\nBuď konkrétní, prodejní a přesvědčivý.`;
    } else if (section === "content") {
      prompt = `Jsi expert na copywriting a tvorbu přistávacích stránek.\nVygeneruj bohatý obsah pro stránku.\n\nProdukt / téma: ${topic}\nNázev stránky: ${pageTitle || ""}\n\nVygeneruj jako JSON objekt (bez markdown, jen čistý JSON):\n{\n  "headline": "hlavní nadpis sekce (výrazný, s emoji)",\n  "perex": "úvodní odstavec (2-3 věty, benefit-oriented)",\n  "bullets": ["✅ benefit 1","✅ benefit 2","✅ benefit 3","✅ benefit 4","✅ benefit 5"],\n  "cta": "text výzvy k akci (max 8 slov)"\n}\nBuď konkrétní, prodejní, používej emoji.`;
    } else {
      prompt = `Jsi expert na copywriting.\nProdukt / téma: ${topic}\nNázev stránky: ${pageTitle || ""}\n\nVygeneruj prodejní text pro webovou stránku. Buď konkrétní a přesvědčivý.\nPoužij emoji. Odpověz jako JSON: { "text": "vygenerovaný obsah" }`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens, messages: [{ role: "user", content: prompt }] }),
    });
    if (!response.ok) { const err = await response.text(); throw new HttpsError("internal", `Anthropic API error: ${response.status}`); }
    const data = await response.json();
    const rawText = data.content?.[0]?.text || "";
    try { return { result: JSON.parse(rawText) }; }
    catch { return { result: { text: rawText } }; }
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
        type: "express", country: "CZ",
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      });
      stripeAccountId = account.id;
      await userRef.set({ stripeAccountId }, { merge: true });
    }

    const isDev = process.env.FUNCTIONS_EMULATOR === "true";
    const baseUrl = isDev ? "http://localhost:5173" : "https://sellfunl.cz";
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

// ─── STRIPE: vytvoř Checkout Session přes Connect účet ─────────────────────
exports.createCheckoutSession = onCall(
  { secrets: [STRIPE_SECRET], region: "us-central1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");

    const { pageId, productName, priceAmount, currency = "czk", successUrl, cancelUrl } = request.data;
    if (!productName || !priceAmount) throw new HttpsError("invalid-argument", "Chybí název produktu nebo cena.");

    const uid = request.auth.uid;
    const db = admin.firestore();
    const stripe = Stripe(STRIPE_SECRET.value());

    const userDoc = await db.collection("users").doc(uid).get();
    const stripeAccountId = userDoc.data()?.stripeAccountId;
    if (!stripeAccountId) throw new HttpsError("failed-precondition", "Stripe účet není propojený.");

    const isDev = process.env.FUNCTIONS_EMULATOR === "true";
    const baseUrl = isDev ? "http://localhost:5173" : "https://sellfunl.cz";

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{
          price_data: {
            currency,
            unit_amount: Math.round(priceAmount * 100),
            product_data: { name: productName },
          },
          quantity: 1,
        }],
        success_url: successUrl || `${baseUrl}/p/${pageId}?payment=success`,
        cancel_url:  cancelUrl  || `${baseUrl}/p/${pageId}?payment=cancelled`,
        metadata: { pageId: pageId || "", uid },
      },
      { stripeAccount: stripeAccountId }
    );

    return { url: session.url };
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
      const snap = await db.collection("users").where("stripeAccountId", "==", account.id).limit(1).get();
      if (!snap.empty) {
        await snap.docs[0].ref.set({
          stripeChargesEnabled: account.charges_enabled,
          stripePayoutsEnabled: account.payouts_enabled,
          stripeDetailsSubmitted: account.details_submitted,
        }, { merge: true });
      }
    }
    res.json({ received: true });
  }
);

// ─── CLOUDFLARE: přidej doménu + nasaď Worker ──────────────────────────────
exports.addDomain = onCall(
  { secrets: [CF_API_TOKEN, CF_ACCOUNT_ID], timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const { domain } = request.data;
    if (!domain) throw new HttpsError("invalid-argument", "Chybí doména.");

    const token     = CF_API_TOKEN.value();
    const accountId = CF_ACCOUNT_ID.value();
    const headers   = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

    const zoneRes = await fetch("https://api.cloudflare.com/client/v4/zones", {
      method: "POST", headers,
      body: JSON.stringify({ name: domain, account: { id: accountId }, jump_start: true }),
    });
    const zoneData = await zoneRes.json();

    if (!zoneData.success) {
      const alreadyExists = zoneData.errors?.some(e => e.code === 1061);
      if (!alreadyExists) throw new HttpsError("internal", `Cloudflare error: ${zoneData.errors?.[0]?.message}`);
    }

    let zoneId = zoneData.result?.id;
    if (!zoneId) {
      const listRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, { headers });
      const listData = await listRes.json();
      zoneId = listData.result?.[0]?.id;
    }
    if (!zoneId) throw new HttpsError("internal", "Nepodařilo se získat Zone ID.");

    const workerScript = `addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const host = url.hostname
  const slug = url.pathname.replace(/^\\//, '') || ''
  const apiUrl = 'https://us-central1-sellfunl.cloudfunctions.net/resolvePageByDomain'
  const res = await fetch(apiUrl + '?domain=' + encodeURIComponent(host) + '&slug=' + encodeURIComponent(slug))
  if (!res.ok) return new Response('Stránka nenalezena', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  const data = await res.json()
  if (!data.pageId) return new Response('Stránka nenalezena', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  return Response.redirect('https://sellfunl.web.app/p/' + data.pageId, 302)
}`;

    const workerRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/sellfunl-router`,
      { method: "PUT", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/javascript" }, body: workerScript }
    );
    const workerData = await workerRes.json();
    if (!workerData.success) throw new HttpsError("internal", `Worker error: ${workerData.errors?.[0]?.message}`);

    await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`, {
      method: "POST", headers,
      body: JSON.stringify({ pattern: `${domain}/*`, script: "sellfunl-router" }),
    });

    const nsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, { headers });
    const nsData = await nsRes.json();
    const nameservers = nsData.result?.name_servers || [];

    return { success: true, zoneId, nameservers };
  }
);

// ─── CLOUDFLARE: resolve stránky podle domény a slugu ─────────────────────
exports.resolvePageByDomain = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const domain = req.query.domain;
  const slug   = req.query.slug || "";

  if (!domain) return res.status(400).json({ error: "Chybí doména." });

  const db = admin.firestore();
  const snap = await db.collection("pages")
    .where("domain", "==", domain)
    .where("slug", "==", slug)
    .where("published", "==", true)
    .limit(1)
    .get();

  if (snap.empty) return res.status(404).json({ error: "Stránka nenalezena." });
  return res.json({ pageId: snap.docs[0].id });
});