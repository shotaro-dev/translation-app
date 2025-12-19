// Simple server handler that proxies translation requests to OpenAI Chat Completions.
// Expects POST { text: string, target: string }.




export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }


  try {
    const { text, target } = await readBody(req);
    if (!text) return res.status(400).json({ error: "Missing text" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      return res.status(500).json({ error: "OpenAI API key not configured" });

    const system = `You are a helpful translator. Translate the user's text into ${escapeForPrompt(
      target
    )}. Keep it concise.`;
    const user = `Translate this text: "${escapeForPrompt(text)}"`;

    const payload = {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("OpenAI error", r.status, errText);
      return res
        .status(502)
        .json({ error: "OpenAI request failed", details: errText });
    }

    const result = await r.json();
    const content =
      result.choices &&
      result.choices[0] &&
      result.choices[0].message &&
      result.choices[0].message.content;
    res.status(200).json({ translation: content, raw: result });
  } catch (e) {
    console.error("Handler error", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
}

// Read body in a Vercel-friendly minimal way.
// - If `req.body` already exists (framework parsed it), return that.
// - Otherwise, collect chunks from the request stream and parse JSON.
// This avoids fragile `req.headers["content-type"]` checks and works
// in serverless environments like Vercel.
async function readBody(req) {
  if (req.body) return req.body;

  // Safely get content-type (optional chaining) and check for JSON
  const ct = String(req.headers?.["content-type"] || "");
  if (!ct.toLowerCase().includes("application/json")) return {};

  let data = "";
  for await (const chunk of req) {
    data += typeof chunk === "string" ? chunk : chunk.toString();
  }
  try {
    return JSON.parse(data || "{}");
  } catch (e) {
    return {};
  }
}

function escapeForPrompt(s) {
  if (!s) return "";
  return String(s).replace(/"/g, '\\"');
}
