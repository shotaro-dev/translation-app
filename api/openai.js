import { OpenAI } from "openai";
import { Redis } from "@upstash/redis";

const MAX_DAILY_CHAT = 50; // optimize for cost
const MAX_DAILY_IMAGES = 10; // optimize for cost

// Initialize Redis client (only if environment variables are set)
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Check and increment usage count
async function checkAndIncrement(key, maxLimit) {
  // If Redis is not configured, allow all requests (for local dev)
  if (!redis) {
    console.warn("Redis not configured, rate limit disabled");
    return { allowed: true, count: 0 };
  }

  try {
    // simple IP-based implementation
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["x-real-ip"] ||
      "unknown";

    // デバッグ用: IPアドレスをログに出力
    console.log("Client IP:", clientIp);
    console.log("All headers:", JSON.stringify(req.headers, null, 2));

    const today = new Date().toDateString();
    const redisKey = `${key}:${today}:${clientIp}`;

    // Get current count
    let count = await redis.get(redisKey);
    if (count === null) {
      count = 0;
    } else {
      count = parseInt(count);
    }

    // Check if limit reached
    if (count >= maxLimit) {
      return { allowed: false };
    }

    // Increment count and set expiration (24 hours)
    const newCount = await redis.incr(redisKey);
    await redis.expire(redisKey, 86400); // 24 hours in seconds

    return { allowed: true, count: newCount };
  } catch (err) {
    console.error("Redis error:", err);
    // Fail open - allow request if Redis fails (better UX)
    return { allowed: true, count: 0 };
  }
}

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
      // Check rate limit
      const limitCheck = await checkAndIncrement("chat", MAX_DAILY_CHAT);
      if (!limitCheck.allowed) {
        return res.status(429).json({
          error: `Daily chat limit reached (${MAX_DAILY_CHAT} requests)`,
        });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.3,
        max_tokens: 500,
      });

      console.log(`Chat usage: ${limitCheck.count}/${MAX_DAILY_CHAT}`);
      return res
        .status(200)
        .json({ result: response.choices[0].message.content });
    } else if (type === "image") {
      // Check rate limit
      const limitCheck = await checkAndIncrement("image", MAX_DAILY_IMAGES);
      if (!limitCheck.allowed) {
        return res.status(429).json({
          error: `Daily image limit reached (${MAX_DAILY_IMAGES} requests)`,
        });
      }

      const response = await openai.images.generate({
        model: "dall-e-2",
        prompt: imagePrompt,
        n: 1,
        size: "512x512",
        response_format: "b64_json",
      });

      console.log(`Image usage: ${limitCheck.count}/${MAX_DAILY_IMAGES}`);
      return res.status(200).json({ image: response.data[0].b64_json });
    } else {
      return res.status(400).json({ error: "Invalid request type" });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
