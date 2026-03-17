const { onCall, HttpsError } = require("firebase-functions/v2/https");

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