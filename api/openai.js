import { OpenAI } from "openai";
import { Redis } from "@upstash/redis";

const MAX_DAILY_CHAT = 30; // Per-IP limit (optimize for cost)
const MAX_DAILY_IMAGES = 5; // Per-IP limit (optimize for cost)
const MAX_GLOBAL_DAILY_CHAT = 100; // Global limit across all IPs (VPN protection)
const MAX_GLOBAL_DAILY_IMAGES = 20; // Global limit across all IPs (VPN protection)

// Initialize Redis client (only if environment variables are set)
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Check and increment usage count
async function checkAndIncrement(key, maxLimit, clientIp, globalMaxLimit) {
  // If Redis is not configured, allow all requests (for local dev)
  if (!redis) {
    console.warn("Redis not configured, rate limit disabled");
    return { allowed: true, count: 0, globalCount: 0 };
  }

  try {
    const today = new Date().toDateString();
    const redisKey = `${key}:${today}:${clientIp}`;
    const globalKey = `${key}:${today}:global`; // Global count

    // Get per-IP count
    let count = await redis.get(redisKey);
    if (count === null) {
      count = 0;
    } else {
      count = parseInt(count);
    }

    // Check per-IP limit
    if (count >= maxLimit) {
      return { allowed: false, reason: "ip_limit" };
    }

    // Check global limit
    let globalCount = await redis.get(globalKey);
    if (globalCount === null) {
      globalCount = 0;
    } else {
      globalCount = parseInt(globalCount);
    }

    if (globalCount >= globalMaxLimit) {
      return { allowed: false, reason: "global_limit" };
    }

    // Increment both counts
    const newCount = await redis.incr(redisKey);
    await redis.expire(redisKey, 86400); // 24 hours in seconds

    const newGlobalCount = await redis.incr(globalKey);
    await redis.expire(globalKey, 86400); // 24 hours in seconds

    return { allowed: true, count: newCount, globalCount: newGlobalCount };
  } catch (err) {
    console.error("Redis error:", err);
    // Fail closed - reject request if Redis fails (safer for cost control)
    return { allowed: false, reason: "rate_limit_service_unavailable" };
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

  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    "unknown";

  // Debug: Log IP address
  console.log("Client IP:", clientIp);
  console.log("All headers:", JSON.stringify(req.headers, null, 2));

  try {
    if (type === "chat") {
      // Check rate limit (per-IP + global)
      const limitCheck = await checkAndIncrement(
        "chat",
        MAX_DAILY_CHAT,
        clientIp,
        MAX_GLOBAL_DAILY_CHAT
      );
      if (!limitCheck.allowed) {
        let errorMsg;
        if (limitCheck.reason === "global_limit") {
          errorMsg = `Global daily chat limit reached (${MAX_GLOBAL_DAILY_CHAT} requests across all IPs)`;
        } else if (limitCheck.reason === "rate_limit_service_unavailable") {
          errorMsg =
            "Rate limit service temporarily unavailable. Please try again later.";
        } else {
          errorMsg = `Daily chat limit reached for this IP (${MAX_DAILY_CHAT} requests)`;
        }
        return res.status(429).json({ error: errorMsg });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.3,
        max_tokens: 500,
      });

      console.log(
        `Chat usage: IP ${limitCheck.count}/${MAX_DAILY_CHAT}, Global ${limitCheck.globalCount}/${MAX_GLOBAL_DAILY_CHAT}`
      );
      return res
        .status(200)
        .json({ result: response.choices[0].message.content });
    } else if (type === "image") {
      // Check rate limit (per-IP + global)
      const limitCheck = await checkAndIncrement(
        "image",
        MAX_DAILY_IMAGES,
        clientIp,
        MAX_GLOBAL_DAILY_IMAGES
      );
      if (!limitCheck.allowed) {
        let errorMsg;
        if (limitCheck.reason === "global_limit") {
          errorMsg = `Global daily image limit reached (${MAX_GLOBAL_DAILY_IMAGES} requests across all IPs)`;
        } else if (limitCheck.reason === "rate_limit_service_unavailable") {
          errorMsg =
            "Rate limit service temporarily unavailable. Please try again later.";
        } else {
          errorMsg = `Daily image limit reached for this IP (${MAX_DAILY_IMAGES} requests)`;
        }
        return res.status(429).json({ error: errorMsg });
      }

      const response = await openai.images.generate({
        model: "dall-e-2",
        prompt: imagePrompt,
        n: 1,
        size: "512x512",
        response_format: "b64_json",
      });

      console.log(
        `Image usage: IP ${limitCheck.count}/${MAX_DAILY_IMAGES}, Global ${limitCheck.globalCount}/${MAX_GLOBAL_DAILY_IMAGES}`
      );
      return res.status(200).json({ image: response.data[0].b64_json });
    } else {
      return res.status(400).json({ error: "Invalid request type" });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
