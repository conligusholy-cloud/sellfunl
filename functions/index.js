const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();

const STRIPE_SECRET   = defineSecret("STRIPE_SECRET_KEY");
const WEBHOOK_SECRET  = defineSecret("STRIPE_WEBHOOK_SECRET");
const CF_API_TOKEN    = defineSecret("CLOUDFLARE_API_TOKEN");
const CF_ACCOUNT_ID   = defineSecret("CLOUDFLARE_ACCOUNT_ID");
const FB_APP_ID       = defineSecret("FACEBOOK_APP_ID");
const FB_APP_SECRET   = defineSecret("FACEBOOK_APP_SECRET");
const SMTP_USER       = defineSecret("SMTP_USER");
const SMTP_PASS       = defineSecret("SMTP_PASS");

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
    const baseUrl = isDev ? "http://localhost:5173" : "https://sellfunl.com";
    try {
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${baseUrl}/dashboard`,
        return_url:  `${baseUrl}/dashboard`,
        type: "account_onboarding",
      });
      return { url: accountLink.url };
    } catch (stripeErr) {
      // Stripe účet může být v neplatném stavu — vytvoř nový
      console.error("Stripe accountLink error:", stripeErr.message);
      if (stripeErr.code === "account_invalid" || stripeErr.type === "StripeInvalidRequestError") {
        const newAccount = await stripe.accounts.create({
          type: "express", country: "CZ",
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        });
        await userRef.set({ stripeAccountId: newAccount.id }, { merge: true });
        const accountLink = await stripe.accountLinks.create({
          account: newAccount.id,
          refresh_url: `${baseUrl}/dashboard`,
          return_url:  `${baseUrl}/dashboard`,
          type: "account_onboarding",
        });
        return { url: accountLink.url };
      }
      throw new HttpsError("internal", `Stripe chyba: ${stripeErr.message}`);
    }
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
  // Povolit requesty pouze z vlastních domén a Cloudflare Workers
  const allowedOrigins = [
    "https://sellfunl.cz",
    "https://www.sellfunl.cz",
    "https://sellfunl.web.app",
    "https://sellfunl.firebaseapp.com",
  ];
  const origin = req.headers.origin || "";
  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  // Cloudflare Workers nemají origin — povolíme requesty bez origin headeru
  // (přicházejí server-to-server), ale blokujeme cizí originy z prohlížečů

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Max-Age", "3600");
    return res.status(204).send("");
  }

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

// ─── FACEBOOK: vytvoř OAuth link ────────────────────────────────────────────
exports.facebookCreateConnectLink = onCall(
  { secrets: [FB_APP_ID] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");

    const uid = request.auth.uid;
    const appId = FB_APP_ID.value();

    // Ulož state token pro ověření callbacku
    const stateToken = `fb_${uid}_${Date.now()}`;
    const db = admin.firestore();
    await db.collection("fbOAuthState").doc(stateToken).set({
      userId: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const isDev = process.env.FUNCTIONS_EMULATOR === "true";
    const redirectUri = isDev
      ? "http://localhost:5173/fb-ads/callback"
      : "https://sellfunl.web.app/fb-ads/callback";

    const scopes = [
      "ads_management",
      "ads_read",
      "pages_show_list",
      "business_management",
      "pages_read_engagement",
      "pages_manage_ads",
    ].join(",");

    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${stateToken}&scope=${scopes}&response_type=code`;

    return { url };
  }
);

// ─── FACEBOOK: vyměň code za access token ───────────────────────────────────
exports.facebookExchangeToken = onCall(
  { secrets: [FB_APP_ID, FB_APP_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");

    const { code, state } = request.data;
    if (!code || !state) throw new HttpsError("invalid-argument", "Chybí code nebo state.");

    const uid = request.auth.uid;
    const db = admin.firestore();

    // Ověř state token
    const stateDoc = await db.collection("fbOAuthState").doc(state).get();
    if (!stateDoc.exists || stateDoc.data().userId !== uid) {
      throw new HttpsError("permission-denied", "Neplatný OAuth state.");
    }
    // Smaž state token (jednorázový)
    await db.collection("fbOAuthState").doc(state).delete();

    const appId = FB_APP_ID.value();
    const appSecret = FB_APP_SECRET.value();

    const isDev = process.env.FUNCTIONS_EMULATOR === "true";
    const redirectUri = isDev
      ? "http://localhost:5173/fb-ads/callback"
      : "https://sellfunl.web.app/fb-ads/callback";

    // Vyměň code za short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new HttpsError("internal", `Facebook token error: ${tokenData.error.message}`);
    }

    // Vyměň za long-lived token (60 dní)
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    );
    const longTokenData = await longTokenRes.json();
    const accessToken = longTokenData.access_token || tokenData.access_token;

    // Získej info o uživateli a reklamních účtech
    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${accessToken}`
    );
    const meData = await meRes.json();

    // Získej reklamní účty
    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status,currency&access_token=${accessToken}`
    );
    const adAccountsData = await adAccountsRes.json();

    // Ulož do Firestore
    await db.collection("facebookAccounts").doc(uid).set({
      accessToken,
      tokenExpiry: longTokenData.expires_in
        ? admin.firestore.Timestamp.fromDate(new Date(Date.now() + longTokenData.expires_in * 1000))
        : null,
      fbUserId: meData.id,
      accountName: meData.name,
      adAccounts: adAccountsData.data || [],
      connectedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "connected",
    });

    return { success: true, name: meData.name };
  }
);

// ─── FACEBOOK ADS: AI generátor textů reklam ────────────────────────────────
exports.generateAdCopy = onCall(
  { region: "us-central1", timeoutSeconds: 120, secrets: ["ANTHROPIC_API_KEY"] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");

    const { productName, productDescription, targetAudience, tone, language = "cs" } = request.data;
    if (!productName || !productDescription) {
      throw new HttpsError("invalid-argument", "Chybí název produktu nebo popis.");
    }

    const langLabel = language === "cs" ? "češtině" : "angličtině";
    const toneLabel = tone || "profesionální a přesvědčivý";

    const prompt = `Jsi expert na Facebook reklamy a copywriting. Vygeneruj texty pro Facebook reklamu v ${langLabel}.

PRODUKT: ${productName}
POPIS: ${productDescription}
CÍLOVÁ SKUPINA: ${targetAudience || "široká veřejnost"}
TÓN: ${toneLabel}

Vygeneruj JSON objekt s těmito poli (bez markdown, jen čistý JSON):
{
  "primaryTexts": [
    "Primární text varianta 1 (max 125 znaků, prodejní, s emoji)",
    "Primární text varianta 2 (jiný úhel pohledu)",
    "Primární text varianta 3 (emotivní přístup)"
  ],
  "headlines": [
    "Nadpis 1 (max 40 znaků, výrazný)",
    "Nadpis 2 (s číslem nebo statistikou)",
    "Nadpis 3 (otázka nebo výzva)",
    "Nadpis 4 (benefit-focused)",
    "Nadpis 5 (urgentní)"
  ],
  "descriptions": [
    "Popisek 1 (max 30 znaků, doplňující info)",
    "Popisek 2 (CTA oriented)",
    "Popisek 3 (social proof nebo benefit)"
  ],
  "callToActions": ["SHOP_NOW", "LEARN_MORE", "SIGN_UP", "GET_OFFER"]
}

Pravidla:
- Primární texty: 3 varianty, max 125 znaků, každá jiný přístup (racionální, emotivní, urgentní)
- Nadpisy: 5 variant, max 40 znaků, výrazné a klikatelné
- Popisky: 3 varianty, max 30 znaků, stručné
- CTA: vyber 2-3 nejvhodnější z FB možností
- Používej emoji střídmě ale efektivně
- Buď konkrétní k produktu, ne generický`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new HttpsError("internal", `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || "";

    try {
      // Extrahuj JSON z odpovědi (může být obalený v markdown)
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      return { result: JSON.parse(jsonMatch[0]) };
    } catch {
      return { result: { raw: rawText } };
    }
  }
);

// ─── FACEBOOK ADS: AI generátor kreativních konceptů ─────────────────────────
exports.generateAdCreative = onCall(
  { region: "us-central1", timeoutSeconds: 120, secrets: ["ANTHROPIC_API_KEY"] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");

    const { productName, productDescription, style, formats } = request.data;
    if (!productName) throw new HttpsError("invalid-argument", "Chybí název produktu.");

    const styleLabel = style || "moderní a čistý";
    const formatList = (formats || ["feed_square", "feed_landscape", "story"]).join(", ");

    const prompt = `Jsi expert na design Facebook reklam. Navrhni 3 vizuální koncepty pro reklamu.

PRODUKT: ${productName}
POPIS: ${productDescription || ""}
STYL: ${styleLabel}
FORMÁTY: ${formatList}

Pro KAŽDÝ z 3 konceptů vygeneruj JSON (bez markdown):
{
  "concepts": [
    {
      "name": "Název konceptu",
      "headline": "Hlavní text na obrázku (max 6 slov, velký, výrazný)",
      "subtext": "Podtext (max 10 slov)",
      "ctaText": "Text tlačítka (max 3 slova)",
      "bgGradient": ["#hex1", "#hex2"],
      "textColor": "#hex",
      "ctaBgColor": "#hex",
      "ctaTextColor": "#hex",
      "accentColor": "#hex",
      "layout": "centered|left-aligned|split",
      "mood": "popis nálady a vizuálního stylu (2-3 slova)",
      "emoji": "1 relevantní emoji pro produkt"
    },
    { ... koncept 2 (jiná barevná paleta) ... },
    { ... koncept 3 (jiný layout a styl) ... }
  ]
}

Pravidla:
- Každý koncept musí mít JINOU barevnou paletu a layout
- Barvy musí být kontrastní a čitelné
- Gradientní pozadí (2 barvy) pro moderní vzhled
- Headline musí být krátký a impaktní
- CTA tlačítko musí vynikat
- Koncept 1: čistý a profesionální
- Koncept 2: odvážný a energický
- Koncept 3: elegantní a prémiový`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new HttpsError("internal", `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || "";

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      return { result: JSON.parse(jsonMatch[0]) };
    } catch {
      return { result: { raw: rawText } };
    }
  }
);

// ─── FACEBOOK ADS: helper pro FB API volání ──────────────────────────────────
async function fbApi(path, accessToken, params = {}) {
  const qs = new URLSearchParams({ access_token: accessToken, ...params }).toString();
  const url = `https://graph.facebook.com/v19.0/${path}?${qs}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new HttpsError("internal", `Facebook API: ${data.error.message} (code: ${data.error.code})`);
  return data;
}

async function fbApiPost(path, accessToken, body = {}) {
  const url = `https://graph.facebook.com/v19.0/${path}`;
  // FB Marketing API vyžaduje form-encoded data, objekty jako JSON string
  const formData = new URLSearchParams();
  formData.append("access_token", accessToken);
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    formData.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });
  const data = await res.json();
  if (data.error) {
    const msg = data.error.error_user_msg || data.error.message || "Neznámá chyba";
    throw new HttpsError("internal", `Facebook API: ${msg} (code: ${data.error.code})`);
  }
  return data;
}

// Helper: získej access token z Firestore
async function getFbToken(uid) {
  const db = admin.firestore();
  const docSnap = await db.collection("facebookAccounts").doc(uid).get();
  if (!docSnap.exists) throw new HttpsError("failed-precondition", "Facebook účet není propojený.");
  const { accessToken, adAccounts } = docSnap.data();
  if (!accessToken) throw new HttpsError("failed-precondition", "Chybí Facebook access token.");
  return { accessToken, adAccounts: adAccounts || [] };
}

// ─── FACEBOOK ADS: načti kampaně ─────────────────────────────────────────────
exports.fbListCampaigns = onCall(
  { secrets: [FB_APP_ID], timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const { adAccountId } = request.data;
    if (!adAccountId) throw new HttpsError("invalid-argument", "Chybí ID reklamního účtu.");

    const { accessToken } = await getFbToken(request.auth.uid);

    const campaigns = await fbApi(`${adAccountId}/campaigns`, accessToken, {
      fields: "id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time,start_time,stop_time",
      limit: "50",
    });

    // Vrať kampaně bez počítání ad setů (šetří API volání, zamezí rate limitu)
    return { campaigns: campaigns.data || [] };
  }
);

// ─── FACEBOOK ADS: načti ad sety kampaně ─────────────────────────────────────
exports.fbListAdSets = onCall(
  { secrets: [FB_APP_ID], timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const { campaignId } = request.data;
    if (!campaignId) throw new HttpsError("invalid-argument", "Chybí ID kampaně.");

    const { accessToken } = await getFbToken(request.auth.uid);

    const adSets = await fbApi(`${campaignId}/adsets`, accessToken, {
      fields: "id,name,status,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event,start_time,end_time",
      limit: "50",
    });

    return { adSets: adSets.data || [] };
  }
);

// ─── FACEBOOK ADS: načti reklamy ad setu ─────────────────────────────────────
exports.fbListAds = onCall(
  { secrets: [FB_APP_ID], timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const { adSetId } = request.data;
    if (!adSetId) throw new HttpsError("invalid-argument", "Chybí ID ad setu.");

    const { accessToken } = await getFbToken(request.auth.uid);

    const ads = await fbApi(`${adSetId}/ads`, accessToken, {
      fields: "id,name,status,creative{id,name,title,body,image_url,thumbnail_url,object_story_spec,asset_feed_spec}",
      limit: "50",
    });

    return { ads: ads.data || [] };
  }
);

// ─── FACEBOOK ADS: vytvoř kampaň ────────────────────────────────────────────
exports.fbCreateCampaign = onCall(
  { secrets: [FB_APP_ID], timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const { adAccountId, name, objective, dailyBudget, status = "PAUSED" } = request.data;
    if (!adAccountId || !name || !objective || !dailyBudget) {
      throw new HttpsError("invalid-argument", "Chybí povinné parametry (adAccountId, name, objective, dailyBudget).");
    }

    const { accessToken } = await getFbToken(request.auth.uid);

    const body = {
      name,
      objective,
      status,
      special_ad_categories: [],
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      daily_budget: Math.round(dailyBudget * 100),
    };

    const result = await fbApiPost(`${adAccountId}/campaigns`, accessToken, body);
    return { campaignId: result.id };
  }
);

// ─── FACEBOOK ADS: vytvoř ad set ─────────────────────────────────────────────
exports.fbCreateAdSet = onCall(
  { secrets: [FB_APP_ID], timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const {
      adAccountId, campaignId, name,
      optimizationGoal, billingEvent = "IMPRESSIONS",
      targeting, startTime, endTime, status = "PAUSED",
      isDynamicCreative = false,
    } = request.data;

    if (!adAccountId || !campaignId || !name || !targeting) {
      throw new HttpsError("invalid-argument", "Chybí povinné parametry.");
    }

    const { accessToken } = await getFbToken(request.auth.uid);

    const body = {
      campaign_id: campaignId,
      name,
      status,
      optimization_goal: optimizationGoal || "LINK_CLICKS",
      billing_event: billingEvent,
      targeting,
      is_dynamic_creative: isDynamicCreative,
    };
    if (startTime) body.start_time = startTime;
    if (endTime) body.end_time = endTime;

    const result = await fbApiPost(`${adAccountId}/adsets`, accessToken, body);
    return { adSetId: result.id };
  }
);

// ─── FACEBOOK ADS: upload obrázku do ad accountu ───────────────────────────
exports.fbUploadAdImage = onCall(
  { secrets: [FB_APP_ID], timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const { adAccountId, imageBase64, filename = "ad_image.png" } = request.data;
    if (!adAccountId || !imageBase64) throw new HttpsError("invalid-argument", "Chybí adAccountId nebo imageBase64.");

    const { accessToken } = await getFbToken(request.auth.uid);

    // FB requires multipart/form-data for image uploads
    const boundary = "----FormBoundary" + Date.now().toString(36);
    const imageBuffer = Buffer.from(imageBase64, "base64");

    const bodyParts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="access_token"\r\n\r\n${accessToken}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="filename"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`,
    ];

    const bufferParts = [
      Buffer.from(bodyParts[0] + "\r\n", "utf-8"),
      Buffer.from(bodyParts[1], "utf-8"),
      imageBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8"),
    ];
    const fullBody = Buffer.concat(bufferParts);

    const res = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/adimages`, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body: fullBody,
    });
    const data = await res.json();
    if (data.error) {
      throw new HttpsError("internal", `Facebook API: ${data.error.error_user_msg || data.error.message} (code: ${data.error.code})`);
    }

    // Response: { images: { "filename": { hash: "abc123", url: "..." } } }
    const images = data.images || {};
    const firstKey = Object.keys(images)[0];
    if (!firstKey) throw new HttpsError("internal", "Upload obrázku selhal.");
    return { hash: images[firstKey].hash, url: images[firstKey].url };
  }
);

// ─── FACEBOOK ADS: vytvoř reklamu (ad creative + ad) ─────────────────────────
exports.fbCreateAd = onCall(
  { secrets: [FB_APP_ID], timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const {
      adAccountId, adSetId, name,
      pageId, linkUrl,
      messages = [], headlines = [], descriptions = [],
      callToAction = "LEARN_MORE",
      imageHashes = [],
      // Lead gen formulář (alternativa k URL)
      leadFormId,
      // Zpětná kompatibilita s jedním textem
      message, headline, description, imageUrl,
    } = request.data;

    if (!adAccountId || !adSetId || !name || !pageId || (!linkUrl && !leadFormId)) {
      throw new HttpsError("invalid-argument", "Chybí povinné parametry (potřeba linkUrl nebo leadFormId).");
    }

    const { accessToken } = await getFbToken(request.auth.uid);

    // Sloučit nový formát (pole) se starým (jednotlivé řetězce)
    const allMessages = [...(messages.filter(Boolean)), ...(message ? [message] : [])].filter(Boolean);
    const allHeadlines = [...(headlines.filter(Boolean)), ...(headline ? [headline] : [])].filter(Boolean);
    const allDescriptions = [...(descriptions.filter(Boolean)), ...(description ? [description] : [])].filter(Boolean);

    // Pokud máme víc textů/obrázků → použij asset_feed_spec (Dynamic Creative)
    const hasMultiple = allMessages.length > 1 || allHeadlines.length > 1 || allDescriptions.length > 1 || imageHashes.length > 1;

    let creativeBody;

    if (leadFormId) {
      // Lead Gen formulář — vždy single creative s lead_gen_form_id
      const pageTokenData = await fbApi(`${pageId}`, accessToken, { fields: "access_token" });
      const pToken = pageTokenData.access_token || accessToken;

      creativeBody = {
        name: `Creative - ${name}`,
        object_story_spec: {
          page_id: pageId,
          link_data: {
            link: linkUrl || `https://fb.me/`,
            message: allMessages[0] || "",
            name: allHeadlines[0] || "",
            description: allDescriptions[0] || "",
            call_to_action: {
              type: callToAction || "SIGN_UP",
              value: { lead_gen_form_id: leadFormId },
            },
          },
        },
      };
      if (imageHashes.length > 0) {
        creativeBody.object_story_spec.link_data.image_hash = imageHashes[0];
      }
      // Lead gen creative musí být vytvořen s page access tokenem
      const creative = await fbApiPost(`${adAccountId}/adcreatives`, pToken, creativeBody);
      const adBody = {
        name,
        adset_id: adSetId,
        creative: { creative_id: creative.id },
        status: "PAUSED",
      };
      const ad = await fbApiPost(`${adAccountId}/ads`, accessToken, adBody);
      return { adId: ad.id, creativeId: creative.id };
    } else if (hasMultiple) {
      // Dynamic Creative (Advantage+ creative) - asset_feed_spec
      const assetFeedSpec = {
        bodies: (allMessages.length > 0 ? allMessages : [""]).map(t => ({ text: t })),
        titles: (allHeadlines.length > 0 ? allHeadlines : [""]).map(t => ({ text: t })),
        descriptions: (allDescriptions.length > 0 ? allDescriptions : [""]).map(t => ({ text: t })),
        call_to_action_types: [callToAction],
        link_urls: [{ website_url: linkUrl }],
        ad_formats: ["SINGLE_IMAGE"],
      };
      if (imageHashes.length > 0) {
        assetFeedSpec.images = imageHashes.map(h => ({ hash: h }));
      }
      creativeBody = {
        name: `Creative - ${name}`,
        asset_feed_spec: assetFeedSpec,
        degrees_of_freedom_spec: {
          creative_features_spec: {
            standard_enhancements: { enroll_status: "OPT_OUT" },
          },
        },
      };
    } else {
      // Klasický single creative
      creativeBody = {
        name: `Creative - ${name}`,
        object_story_spec: {
          page_id: pageId,
          link_data: {
            link: linkUrl,
            message: allMessages[0] || "",
            name: allHeadlines[0] || "",
            description: allDescriptions[0] || "",
            call_to_action: { type: callToAction },
          },
        },
      };
      if (imageHashes.length > 0) {
        creativeBody.object_story_spec.link_data.image_hash = imageHashes[0];
      } else if (imageUrl) {
        creativeBody.object_story_spec.link_data.image_url = imageUrl;
      }
    }

    const creative = await fbApiPost(`${adAccountId}/adcreatives`, accessToken, creativeBody);

    const adBody = {
      name,
      adset_id: adSetId,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    };

    const ad = await fbApiPost(`${adAccountId}/ads`, accessToken, adBody);
    return { adId: ad.id, creativeId: creative.id };
  }
);

// ─── FACEBOOK ADS: změň status kampaně/ad setu/reklamy ──────────────────────
exports.fbUpdateStatus = onCall(
  { secrets: [FB_APP_ID], timeoutSeconds: 15 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const { objectId, status } = request.data;
    if (!objectId || !status) throw new HttpsError("invalid-argument", "Chybí objectId nebo status.");

    const allowed = ["ACTIVE", "PAUSED", "ARCHIVED"];
    if (!allowed.includes(status)) {
      throw new HttpsError("invalid-argument", `Status musí být: ${allowed.join(", ")}`);
    }

    const { accessToken } = await getFbToken(request.auth.uid);

    const url = `https://graph.facebook.com/v19.0/${objectId}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken, status }),
    });
    const data = await res.json();
    if (data.error) throw new HttpsError("internal", `FB API: ${data.error.message}`);

    return { success: true };
  }
);

// ─── FACEBOOK ADS: smaž objekt (kampaň / ad set / reklamu) ────────────────
exports.fbDeleteObject = onCall(
  { secrets: [FB_APP_ID], timeoutSeconds: 15 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const { objectId } = request.data;
    if (!objectId) throw new HttpsError("invalid-argument", "Chybí objectId.");

    const { accessToken } = await getFbToken(request.auth.uid);

    const url = `https://graph.facebook.com/v19.0/${objectId}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ access_token: accessToken }).toString(),
    });
    const data = await res.json();
    if (data.error) throw new HttpsError("internal", `FB API: ${data.error.error_user_msg || data.error.message}`);
    return { success: true };
  }
);

// ─── FACEBOOK ADS: náhled reklamy (ad preview iframe) ─────────────────────
exports.fbGetAdPreview = onCall(
  { secrets: [FB_APP_ID], timeoutSeconds: 15 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const { adId, format = "DESKTOP_FEED_STANDARD" } = request.data;
    if (!adId) throw new HttpsError("invalid-argument", "Chybí adId.");

    const { accessToken } = await getFbToken(request.auth.uid);

    const preview = await fbApi(`${adId}/previews`, accessToken, {
      ad_format: format,
    });

    return { previews: preview.data || [] };
  }
);

// ─── FACEBOOK ADS: načti FB stránky uživatele ───────────────────────────────
exports.fbListPages = onCall(
  { secrets: [FB_APP_ID], timeoutSeconds: 15 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");

    const { accessToken } = await getFbToken(request.auth.uid);

    const pages = await fbApi("me/accounts", accessToken, {
      fields: "id,name,category,picture{url}",
      limit: "50",
    });

    return { pages: pages.data || [] };
  }
);

// ─── FACEBOOK ADS: načti lead gen formuláře stránky ──────────────────────
exports.fbListLeadForms = onCall(
  { secrets: [FB_APP_ID], timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const { pageId } = request.data;
    if (!pageId) throw new HttpsError("invalid-argument", "Chybí pageId.");

    const { accessToken } = await getFbToken(request.auth.uid);

    // Need page access token for lead gen forms
    const pageToken = await fbApi(`${pageId}`, accessToken, { fields: "access_token" });
    const pToken = pageToken.access_token || accessToken;

    const forms = await fbApi(`${pageId}/leadgen_forms`, pToken, {
      fields: "id,name,status,leads_count,created_time,questions,privacy_policy,thank_you_page",
      limit: "50",
    });

    return { forms: forms.data || [] };
  }
);

// ─── FACEBOOK ADS: vytvoř lead gen formulář ──────────────────────────────
exports.fbCreateLeadForm = onCall(
  { secrets: [FB_APP_ID], timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const { pageId, name, questions, privacyPolicyUrl, thankYouTitle, thankYouBody, thankYouButtonText, thankYouUrl } = request.data;
    if (!pageId || !name || !questions || !privacyPolicyUrl) {
      throw new HttpsError("invalid-argument", "Chybí povinné parametry (pageId, name, questions, privacyPolicyUrl).");
    }

    const { accessToken } = await getFbToken(request.auth.uid);

    // Need page access token
    const pageToken = await fbApi(`${pageId}`, accessToken, { fields: "access_token" });
    const pToken = pageToken.access_token || accessToken;

    const body = {
      name,
      questions,
      privacy_policy: { url: privacyPolicyUrl },
      follow_up_action_url: thankYouUrl || privacyPolicyUrl,
    };

    if (thankYouTitle || thankYouBody) {
      body.thank_you_page = {};
      if (thankYouTitle) body.thank_you_page.title = thankYouTitle;
      if (thankYouBody) body.thank_you_page.body = thankYouBody;
      if (thankYouButtonText) body.thank_you_page.button_text = thankYouButtonText;
      if (thankYouUrl) body.thank_you_page.button_type = "VIEW_WEBSITE";
    }

    const result = await fbApiPost(`${pageId}/leadgen_forms`, pToken, body);
    return { formId: result.id };
  }
);

// ─── FACEBOOK ADS: smaž lead gen formulář ────────────────────────────────
exports.fbDeleteLeadForm = onCall(
  { secrets: [FB_APP_ID], timeoutSeconds: 15 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const { formId } = request.data;
    if (!formId) throw new HttpsError("invalid-argument", "Chybí formId.");

    const { accessToken } = await getFbToken(request.auth.uid);

    const url = `https://graph.facebook.com/v19.0/${formId}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ access_token: accessToken }).toString(),
    });
    const data = await res.json();
    if (data.error) throw new HttpsError("internal", `FB API: ${data.error.error_user_msg || data.error.message}`);
    return { success: true };
  }
);

// ─── FACEBOOK ADS: duplikuj kampaň / ad set / reklamu s překladem ──────────
exports.fbDuplicate = onCall(
  { secrets: [FB_APP_ID, "ANTHROPIC_API_KEY"], timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const {
      type,           // "campaign" | "adset" | "ad"
      sourceId,       // ID zdroje
      adAccountId,
      targetLanguage, // null = bez překladu, jinak kód jazyka
      newTargeting,   // null = stejné, jinak nový targeting objekt
      campaignId,     // potřeba pro adset duplikaci
      newUrl,         // null = stejný odkaz, jinak nový URL
    } = request.data;

    if (!type || !sourceId || !adAccountId) {
      throw new HttpsError("invalid-argument", "Chybí type, sourceId nebo adAccountId.");
    }

    // Validace URL — odmítni localhost, prázdné a neplatné URL
    let validatedUrl = newUrl?.trim() || null;
    if (validatedUrl) {
      try {
        const parsed = new URL(validatedUrl);
        if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname.endsWith(".local")) {
          console.warn(`Ignoruji neplatný overrideUrl (localhost): ${validatedUrl}`);
          validatedUrl = null;
        }
      } catch {
        console.warn(`Ignoruji neplatný overrideUrl (parse error): ${validatedUrl}`);
        validatedUrl = null;
      }
    }

    const { accessToken } = await getFbToken(request.auth.uid);

    // Helper: přelož texty přes Anthropic
    async function translateTexts(texts, lang) {
      if (!lang || texts.length === 0) return texts;
      const nonEmpty = texts.filter(Boolean);
      if (nonEmpty.length === 0) return texts;

      const prompt = `Přelož následující reklamní texty do jazyka "${lang}". Zachovej formátování, emoji a tón. Vrať POUZE JSON pole řetězců, nic jiného.\n\nTexty:\n${JSON.stringify(nonEmpty)}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!response.ok) return texts;
      const data = await response.json();
      try {
        const raw = data.content?.[0]?.text || "[]";
        const match = raw.match(/\[[\s\S]*\]/);
        return match ? JSON.parse(match[0]) : texts;
      } catch {
        return texts;
      }
    }

    // ─── DUPLIKACE REKLAMY ───
    async function duplicateAd(adId, adSetId, lang, overrideUrl, isDynamicAdSet = false) {
      const ad = await fbApi(adId, accessToken, { fields: "name,creative" });
      const creativeId = ad.creative?.id;
      if (!creativeId) throw new HttpsError("internal", `Reklama ${adId} nemá kreativu.`);
      let newName = ad.name + (lang ? ` [${lang}]` : " (kopie)");

      // Bez překladu a bez změny URL — jednoduše použij originální kreativu
      if (!lang && !overrideUrl) {
        const newAd = await fbApiPost(`${adAccountId}/ads`, accessToken, {
          name: newName, adset_id: adSetId, creative: { creative_id: creativeId }, status: "PAUSED",
        });
        return { adId: newAd.id };
      }

      // S překladem nebo změnou URL — načti kreativu a vytvoř novou
      const creative = await fbApi(creativeId, accessToken, {
        fields: "name,object_story_spec,asset_feed_spec,url_tags",
      });
      console.log(`Creative ${creativeId} keys:`, Object.keys(creative));
      console.log(`Creative ${creativeId} oss keys:`, creative.object_story_spec ? Object.keys(creative.object_story_spec) : "none");

      let newCreativeBody;

      // DŮLEŽITÉ: asset_feed_spec (dynamic creative) MUSÍ být kontrolován PRVNÍ,
      // protože FB může vrátit kreativu s oběma poli (object_story_spec i asset_feed_spec).
      // Pokud ad set je dynamic creative, musíme použít asset_feed_spec formát.
      if (creative.asset_feed_spec) {
        // Dynamic creative — vytvoř ČISTÝ asset_feed_spec od nuly, jen s potřebnými poli
        const origAfs = creative.asset_feed_spec;

        const bodyTexts = (origAfs.bodies || []).map(b => b.text);
        const titleTexts = (origAfs.titles || []).map(t => t.text);
        const descTexts = (origAfs.descriptions || []).map(d => d.text);
        const [trBodies, trTitles, trDescs] = lang
          ? await Promise.all([translateTexts(bodyTexts, lang), translateTexts(titleTexts, lang), translateTexts(descTexts, lang)])
          : [bodyTexts, titleTexts, descTexts];

        // Vybuduj čistý asset_feed_spec — jen povolená pole
        const cleanAfs = {
          bodies: trBodies.map(t => ({ text: t })),
          titles: trTitles.map(t => ({ text: t })),
          descriptions: trDescs.map(t => ({ text: t })),
        };
        // Images: jen hash, nic jiného
        if (origAfs.images) {
          cleanAfs.images = origAfs.images.map(img => ({ hash: img.hash || img.image_hash })).filter(i => i.hash);
        }
        // Videos: jen video_id + thumbnail
        if (origAfs.videos) {
          cleanAfs.videos = origAfs.videos.map(vid => {
            const v = {};
            if (vid.video_id) v.video_id = vid.video_id;
            if (vid.thumbnail_hash) v.thumbnail_hash = vid.thumbnail_hash;
            return v;
          }).filter(v => v.video_id);
        }
        // Link URLs — přepsat pokud je overrideUrl
        if (overrideUrl) {
          cleanAfs.link_urls = [{ website_url: overrideUrl }];
        } else if (origAfs.link_urls) {
          cleanAfs.link_urls = origAfs.link_urls.map(lu => {
            const clean = {};
            if (lu.website_url) clean.website_url = lu.website_url;
            if (lu.display_url) clean.display_url = lu.display_url;
            return clean;
          });
        }
        // CTA typy
        if (origAfs.call_to_action_types) cleanAfs.call_to_action_types = origAfs.call_to_action_types;
        // ad_formats: FB vyžaduje když jsou images i videos
        if (origAfs.ad_formats) cleanAfs.ad_formats = origAfs.ad_formats;
        // Nic jiného — žádné asset_customization_rules, optimization_type, autotranslate, adlabels

        console.log(`Dynamic creative clean AFS:`, JSON.stringify(cleanAfs).slice(0, 500));

        newCreativeBody = {
          name: `Creative - ${newName}`,
          asset_feed_spec: cleanAfs,
        };
        if (creative.object_story_spec?.page_id) {
          newCreativeBody.object_story_spec = { page_id: creative.object_story_spec.page_id };
        }

      } else if (creative.object_story_spec?.link_data) {
        const oss = creative.object_story_spec;
        const ld = oss.link_data;
        const texts = [ld.message || "", ld.name || "", ld.description || ""];
        const translated = lang ? await translateTexts(texts, lang) : texts;

        const linkUrl = overrideUrl || ld.link;
        const cleanLinkData = {
          message: translated[0] || "",
          name: translated[1] || "",
          description: translated[2] || "",
        };
        if (linkUrl) cleanLinkData.link = linkUrl;
        if (ld.image_hash) cleanLinkData.image_hash = ld.image_hash;
        else if (ld.picture) cleanLinkData.picture = ld.picture;
        if (ld.call_to_action?.type) {
          cleanLinkData.call_to_action = { type: ld.call_to_action.type };
          if (linkUrl) cleanLinkData.call_to_action.value = { link: linkUrl };
        }

        newCreativeBody = {
          name: `Creative - ${newName}`,
          object_story_spec: { page_id: oss.page_id, link_data: cleanLinkData },
        };

      } else if (creative.object_story_spec?.video_data) {
        const oss = creative.object_story_spec;
        const vd = oss.video_data;
        const texts = [vd.message || "", vd.title || ""];
        const translated = lang ? await translateTexts(texts, lang) : texts;

        const linkUrl = overrideUrl || vd.call_to_action?.value?.link;
        const cleanVideoData = {
          message: translated[0] || "",
          title: translated[1] || "",
        };
        if (vd.video_id) cleanVideoData.video_id = vd.video_id;
        if (vd.image_hash) cleanVideoData.image_hash = vd.image_hash;
        else if (vd.image_url) cleanVideoData.image_url = vd.image_url;
        if (vd.call_to_action?.type) {
          cleanVideoData.call_to_action = { type: vd.call_to_action.type };
          if (linkUrl) cleanVideoData.call_to_action.value = { link: linkUrl };
        }

        newCreativeBody = {
          name: `Creative - ${newName}`,
          object_story_spec: { page_id: oss.page_id, video_data: cleanVideoData },
        };

      } else {
        // Neznámý formát — použij originální kreativu bez překladu
        console.warn(`Reklama ${adId}: neznámý formát kreativy, kopíruji bez překladu.`);
        const newAd = await fbApiPost(`${adAccountId}/ads`, accessToken, {
          name: newName, adset_id: adSetId, creative: { creative_id: creativeId }, status: "PAUSED",
        });
        return { adId: newAd.id };
      }

      // Vytvoř novou kreativu s přeloženými texty
      console.log(`Vytvářím kreativu pro ${newName}, body:`, JSON.stringify(newCreativeBody).slice(0, 800));
      try {
        const newCreative = await fbApiPost(`${adAccountId}/adcreatives`, accessToken, newCreativeBody);
        const newAd = await fbApiPost(`${adAccountId}/ads`, accessToken, {
          name: newName, adset_id: adSetId, creative: { creative_id: newCreative.id }, status: "PAUSED",
        });
        return { adId: newAd.id };
      } catch (creativeErr) {
        // Fallback: pokud je dynamic creative ad set, nemůžeme jen použít creative_id
        console.error(`Kreativa selhala (${creativeErr.message}), fallback...`);

        if (isDynamicAdSet && creative.asset_feed_spec) {
          // Pokus 2: Zkopíruj originální asset_feed_spec BEZ překladu, jen s URL override
          console.log(`Dynamic creative fallback: kopíruji originální AFS bez překladu.`);
          try {
            const origAfs = creative.asset_feed_spec;
            const fallbackAfs = {
              bodies: (origAfs.bodies || []).map(b => ({ text: b.text })),
              titles: (origAfs.titles || []).map(t => ({ text: t.text })),
              descriptions: (origAfs.descriptions || []).map(d => ({ text: d.text })),
            };
            if (origAfs.images) fallbackAfs.images = origAfs.images.map(img => ({ hash: img.hash || img.image_hash })).filter(i => i.hash);
            if (origAfs.videos) fallbackAfs.videos = origAfs.videos.map(vid => {
              const v = {};
              if (vid.video_id) v.video_id = vid.video_id;
              if (vid.thumbnail_hash) v.thumbnail_hash = vid.thumbnail_hash;
              return v;
            }).filter(v => v.video_id);
            if (overrideUrl) {
              fallbackAfs.link_urls = [{ website_url: overrideUrl }];
            } else if (origAfs.link_urls) {
              fallbackAfs.link_urls = origAfs.link_urls.map(lu => {
                const clean = {};
                if (lu.website_url) clean.website_url = lu.website_url;
                if (lu.display_url) clean.display_url = lu.display_url;
                return clean;
              });
            }
            if (origAfs.call_to_action_types) fallbackAfs.call_to_action_types = origAfs.call_to_action_types;
            if (origAfs.ad_formats) fallbackAfs.ad_formats = origAfs.ad_formats;

            const fallbackBody = { name: `Creative - ${newName}`, asset_feed_spec: fallbackAfs };
            if (creative.object_story_spec?.page_id) {
              fallbackBody.object_story_spec = { page_id: creative.object_story_spec.page_id };
            }
            console.log(`Fallback AFS:`, JSON.stringify(fallbackAfs).slice(0, 500));
            const fbCreative = await fbApiPost(`${adAccountId}/adcreatives`, accessToken, fallbackBody);
            const newAd = await fbApiPost(`${adAccountId}/ads`, accessToken, {
              name: newName, adset_id: adSetId, creative: { creative_id: fbCreative.id }, status: "PAUSED",
            });
            return { adId: newAd.id, warning: `Překlad selhal, použit originální text: ${creativeErr.message}` };
          } catch (fallbackErr) {
            console.error(`Dynamic fallback also failed:`, fallbackErr.message);
            // Poslední pokus: použij přímo creative_id originálu
            try {
              const newAd = await fbApiPost(`${adAccountId}/ads`, accessToken, {
                name: newName, adset_id: adSetId, creative: { creative_id: creativeId }, status: "PAUSED",
              });
              return { adId: newAd.id, warning: `Překlad selhal, použit originál: ${fallbackErr.message}` };
            } catch (lastErr) {
              throw new Error(`Kreativa i fallback selhaly: ${creativeErr.message} → ${fallbackErr.message} → ${lastErr.message}`);
            }
          }
        } else {
          // Nedynamický ad set — klasický fallback
          const newAd = await fbApiPost(`${adAccountId}/ads`, accessToken, {
            name: newName, adset_id: adSetId, creative: { creative_id: creativeId }, status: "PAUSED",
          });
          return { adId: newAd.id, warning: `Překlad selhal: ${creativeErr.message}` };
        }
      }
    }

    // ─── DUPLIKACE AD SETU ───
    async function duplicateAdSet(adSetId, campId, lang, newTargetingOverride, overrideUrl) {
      const adSet = await fbApi(adSetId, accessToken, {
        fields: "name,optimization_goal,billing_event,targeting,is_dynamic_creative,daily_budget,lifetime_budget,start_time,end_time,promoted_object",
      });
      let newName = adSet.name + (lang ? ` [${lang}]` : " (kopie)");

      // Sloučit targeting: zachovat originál a jen přepsat geo_locations pokud jsou nové
      let finalTargeting = adSet.targeting || {};
      if (newTargetingOverride?.geo_locations) {
        finalTargeting = { ...finalTargeting, geo_locations: newTargetingOverride.geo_locations };
      }

      const body = {
        campaign_id: campId, name: newName, status: "PAUSED",
        optimization_goal: adSet.optimization_goal || "LINK_CLICKS",
        billing_event: adSet.billing_event || "IMPRESSIONS",
        targeting: finalTargeting,
      };
      if (adSet.daily_budget) body.daily_budget = adSet.daily_budget;
      if (adSet.lifetime_budget) body.lifetime_budget = adSet.lifetime_budget;
      if (adSet.promoted_object) body.promoted_object = adSet.promoted_object;
      if (adSet.start_time) body.start_time = adSet.start_time;
      if (adSet.end_time) body.end_time = adSet.end_time;

      // Načti reklamy PŘEDEM, abychom mohli zjistit jestli jsou dynamic creative
      const ads = await fbApi(`${adSetId}/ads`, accessToken, { fields: "id,name,creative{asset_feed_spec}", limit: "50" });
      const hasDynamicCreative = (ads.data || []).some(a => a.creative?.asset_feed_spec);
      // Pokud FB API vrátí is_dynamic_creative NEBO některá reklama má asset_feed_spec, nastav true
      const isDynamic = adSet.is_dynamic_creative === true || adSet.is_dynamic_creative === "true" || hasDynamicCreative;
      body.is_dynamic_creative = isDynamic;
      console.log(`Vytvářím adset: is_dynamic_creative=${isDynamic} (orig: ${adSet.is_dynamic_creative}, type: ${typeof adSet.is_dynamic_creative}, hasDynAds: ${hasDynamicCreative})`);
      const newAdSet = await fbApiPost(`${adAccountId}/adsets`, accessToken, body);
      console.log(`AdSet ${adSetId}: nalezeno ${(ads.data || []).length} reklam ke kopírování`);
      const adResults = [];
      const adErrors = [];
      for (const ad of (ads.data || [])) {
        try {
          console.log(`Kopíruji reklamu ${ad.id} (${ad.name})...`);
          adResults.push(await duplicateAd(ad.id, newAdSet.id, lang, overrideUrl, isDynamic));
        } catch (err) {
          console.error(`CHYBA duplikace reklamy ${ad.id}:`, err.message || err);
          adErrors.push(`${ad.name || ad.id}: ${err.message}`);
        }
      }
      return { adSetId: newAdSet.id, ads: adResults, adErrors };
    }

    // ─── DUPLIKACE KAMPANĚ ───
    async function duplicateCampaign(campId, lang, newTargetingOverride, overrideUrl) {
      const camp = await fbApi(campId, accessToken, {
        fields: "name,objective,daily_budget,lifetime_budget,bid_strategy,special_ad_categories",
      });
      let newName = camp.name + (lang ? ` [${lang}]` : " (kopie)");
      const body = {
        name: newName, objective: camp.objective, status: "PAUSED",
        special_ad_categories: camp.special_ad_categories || [],
      };
      if (camp.bid_strategy) body.bid_strategy = camp.bid_strategy;
      if (camp.daily_budget) body.daily_budget = camp.daily_budget;
      if (camp.lifetime_budget) body.lifetime_budget = camp.lifetime_budget;

      const newCamp = await fbApiPost(`${adAccountId}/campaigns`, accessToken, body);

      // Kopírovat všechny ad sety (a jejich reklamy)
      const adSets = await fbApi(`${campId}/adsets`, accessToken, { fields: "id", limit: "50" });
      const adSetResults = [];
      const adSetErrors = [];
      for (const as of (adSets.data || [])) {
        try { adSetResults.push(await duplicateAdSet(as.id, newCamp.id, lang, newTargetingOverride, overrideUrl)); }
        catch (err) { adSetErrors.push(`AdSet ${as.id}: ${err.message}`); }
      }
      if (adSetErrors.length > 0) console.warn("Chyby duplikace ad setů:", adSetErrors);
      return { campaignId: newCamp.id, adSets: adSetResults, adSetErrors };
    }

    if (type === "campaign") return await duplicateCampaign(sourceId, targetLanguage, newTargeting, validatedUrl);
    if (type === "adset") {
      if (!campaignId) throw new HttpsError("invalid-argument", "Chybí campaignId.");
      return await duplicateAdSet(sourceId, campaignId, targetLanguage, newTargeting, validatedUrl);
    }
    if (type === "ad") {
      const adDetail = await fbApi(sourceId, accessToken, { fields: "adset_id" });
      return await duplicateAd(sourceId, adDetail.adset_id, targetLanguage, validatedUrl);
    }
    throw new HttpsError("invalid-argument", "Neplatný type.");
  }
);

// ─── ODESLÁNÍ POZVÁNKY E-MAILEM ─────────────────────────────────────────────
exports.sendInvitation = onCall(
  { region: "us-central1", secrets: [SMTP_USER, SMTP_PASS] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musíš být přihlášen.");
    const { email, orgName, role, inviterName, appUrl } = request.data;
    if (!email || !orgName) throw new HttpsError("invalid-argument", "Chybí email nebo název organizace.");

    const nodemailer = require("nodemailer");

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const loginUrl = appUrl || "https://sellfunl.com/login";

    const roleLabels = { admin: "Administrátor", editor: "Editor", viewer: "Prohlížeč" };
    const roleLabel = roleLabels[role] || role;

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:1.3rem;color:#1f2937;margin:0;">🏢 Pozvánka do organizace</h1>
        </div>
        <p style="font-size:.95rem;color:#374151;line-height:1.6;">
          ${inviterName || "Někdo"} tě zve do organizace <strong>${orgName}</strong> v aplikaci SellFunl.
        </p>
        <div style="background:#f3f0ff;border-radius:8px;padding:14px 18px;margin:16px 0;">
          <p style="margin:0;font-size:.88rem;color:#6b21a8;"><strong>Role:</strong> ${roleLabel}</p>
        </div>
        <p style="font-size:.88rem;color:#6b7280;line-height:1.5;">
          Pro přijetí pozvánky se přihlaš do SellFunl. Pozvánka na tebe čeká v sekci Organizace.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${loginUrl}" style="display:inline-block;padding:12px 32px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:.95rem;">
            Přihlásit se do SellFunl
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:.72rem;color:#9ca3af;text-align:center;margin:0;">
          Pokud jsi tuto pozvánku nečekal/a, můžeš ji ignorovat.
        </p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"SellFunl" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Pozvánka do organizace ${orgName} — SellFunl`,
        html,
      });
      return { success: true };
    } catch (err) {
      console.error("Email send error:", err);
      throw new HttpsError("internal", "Nepodařilo se odeslat e-mail: " + err.message);
    }
  }
);