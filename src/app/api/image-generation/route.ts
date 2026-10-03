import OpenAI from "openai";

export const runtime = "nodejs";

const MAX_PROMPT_LENGTH = 700;
const REQUEST_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;
const requestWindows = new Map<string, { count: number; expiresAt: number }>();

function takeGenerationSlot(clientKey: string) {
  const now = Date.now();
  const current = requestWindows.get(clientKey);
  if (!current || current.expiresAt <= now) {
    requestWindows.set(clientKey, { count: 1, expiresAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= REQUEST_LIMIT) return false;
  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "Image generation is not configured on this server." }, { status: 503 });

  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!takeGenerationSlot(clientKey)) {
    return Response.json({ error: "Generation limit reached. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Enter an image description to generate." }, { status: 400 }); }

  const prompt = typeof body === "object" && body !== null && "prompt" in body ? body.prompt : null;
  if (typeof prompt !== "string" || prompt.trim().length < 4 || prompt.length > MAX_PROMPT_LENGTH) {
    return Response.json({ error: `Image descriptions must be 4-${MAX_PROMPT_LENGTH} characters.` }, { status: 400 });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const result = await openai.images.generate({
      model: "gpt-image-2.5-flare",
      prompt: `Create one original garment-print graphic. ${prompt.trim()}. Isolated artwork only, transparent background, no clothing mockup, no border.`,
      size: "1024x1024",
      quality: "low",
      background: "transparent",
      output_format: "png",
      n: 1,
    });
    const image = result.data?.[0]?.b64_json;
    if (!image) return Response.json({ error: "The image service returned no artwork." }, { status: 502 });
    return Response.json({ imageUrl: `data:image/png;base64,${image}` });
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error("OpenAI image generation failed", { status: error.status, code: error.code, requestId: error.requestID });
      const code = `${error.code ?? ""} ${error.type ?? ""}`.toLowerCase();
      if (code.includes("quota") || code.includes("billing")) {
        return Response.json({ error: "OpenAI image credits or billing are unavailable. Check the API account's billing and usage limits." }, { status: 402 });
      }
      if (error.status === 429) return Response.json({ error: "OpenAI is rate-limiting image generation. Wait briefly, then try again." }, { status: 429 });
    } else {
      console.error("Unexpected image generation error", error);
    }
    return Response.json({ error: "Image generation failed. Please try a different description." }, { status: 502 });
  }
}