import { OpenAI } from "openai";



export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages, imagePrompt, type } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not set" });
  }

  const openai = new OpenAI({ apiKey });

  try {
    if (type === "chat") {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages,
        temperature: 0.3,
        max_tokens: 500,
      });
      return res
        .status(200)
        .json({ result: response.choices[0].message.content });
    } else if (type === "image") {
      const response = await openai.images.generate({
        prompt: imagePrompt,
        response_format: "b64_json",
      });
      return res.status(200).json({ image: response.data[0].b64_json });
    } else {
      return res.status(400).json({ error: "Invalid request type" });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
