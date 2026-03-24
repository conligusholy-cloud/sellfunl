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
      // Zpětná kompatibilita s jedním textem
      message, headline, description, imageUrl,
    } = request.data;

    if (!adAccountId || !adSetId || !name || !pageId || !linkUrl) {
      throw new HttpsError("invalid-argument", "Chybí povinné parametry.");
    }

    const { accessToken } = await getFbToken(request.auth.uid);

    // Sloučit nový formát (pole) se starým (jednotlivé řetězce)
    const allMessages = [...(messages.filter(Boolean)), ...(message ? [message] : [])].filter(Boolean);
    const allHeadlines = [...(headlines.filter(Boolean)), ...(headline ? [headline] : [])].filter(Boolean);
    const allDescriptions = [...(descriptions.filter(Boolean)), ...(description ? [description] : [])].filter(Boolean);

    // Pokud máme víc textů/obrázků → použij asset_feed_spec (Dynamic Creative)
    const hasMultiple = allMessages.length > 1 || allHeadlines.length > 1 || allDescriptions.length > 1 || imageHashes.length > 1;

    let creativeBody;

    if (hasMultiple) {
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