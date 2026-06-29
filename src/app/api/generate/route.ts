import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { post, slide, userSettings, identity } from "@/lib/db/schema"
import { getTokenRouterClient, DEFAULT_CHAT_MODEL } from "@/lib/tokenrouter"
import { eq } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { headers } from "next/headers"

// captions only — image generation happens per-slide from the post page
export const maxDuration = 45

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const userId = session.user.id

  const settings = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) })
    .catch((err: unknown) => { console.error("[generate] userSettings query failed:", err); return undefined })

  const identityData = await db.query.identity.findFirst({ where: eq(identity.userId, userId) })
    .catch((err: unknown) => { console.error("[generate] identity query failed:", err); return undefined })

  if (!settings || settings.plan === "free") {
    const used = settings?.freeGenerationsUsed ?? 0
    if (used >= 1) return NextResponse.json({ error: "free_limit_reached" }, { status: 403 })
  }

  const body = await req.json()
  const { brief, aspectRatio, language, slideCount, withSubject, vibe, designStyle, colorPalette } = body
  if (!brief) return NextResponse.json({ error: "brief is required" }, { status: 400 })

  const count = Math.min(Math.max(1, Number(slideCount) || 3), settings?.plan === "free" ? 5 : 10)

  const isByok = settings?.plan === "byok" && settings.byokApiKey
  const client = getTokenRouterClient(isByok
    ? { apiKey: settings.byokApiKey!, baseURL: settings.byokBaseUrl || undefined }
    : {}
  )
  const chatModel = (isByok && settings?.byokChatModel) ? settings.byokChatModel : DEFAULT_CHAT_MODEL

  const postId = uuidv4()
  await db.insert(post).values({
    id: postId,
    userId,
    brief,
    aspectRatio: aspectRatio || "1:1",
    language: language || "id",
    slideCount: count,
    withSubject: !!withSubject,
    vibe: vibe || "professional",
    designStyle: designStyle || "realistic",
    colorPalette: colorPalette || [],
    status: "generating",
  })

  const lang = language === "en" ? "English" : "Indonesian"

  // detect if the brief already contains pre-written slide content
  const hasPrewrittenSlides = /SLIDE\s*\d+/i.test(brief)

  const styleKeywords: Record<string, string> = {
    realistic:    "DSLR photo, sharp focus, natural lighting, photorealistic",
    illustration: "editorial illustration, vector-style, clean linework",
    "3d":         "3D render, octane render, subsurface scattering, depth of field",
    flat:         "flat design, geometric shapes, bold colors, no shadows",
    anime:        "anime style, cel shading, clean lineart, vibrant colors",
    watercolor:   "watercolor painting, wet-on-wet technique, soft edges, paper texture",
    abstract:     "abstract art, expressionist brushstrokes, textured layers",
    minimal:      "minimalist design, negative space, single accent color, clean typography",
  }
  const styleHint = styleKeywords[designStyle || "realistic"] || styleKeywords.realistic
  const brandNote = identityData?.companyName
    ? ` Brand context: ${identityData.companyName}${identityData.tagline ? ` — ${identityData.tagline}` : ""}.`
    : ""
  const logoNote = identityData?.companyName && identityData?.logoPosition && identityData.logoPosition !== "none"
    ? ` Reserve a clean uncluttered zone at the ${identityData.logoPosition.replace("-", " ")} for a brand logo overlay.${identityData.footerText ? ` Also reserve footer space for: "${identityData.footerText}".` : ""}`
    : ""

  const captionPrompt = hasPrewrittenSlides
    ? `You are a social media content designer. The user has already written the exact text for each slide. Your job is to extract each slide's text and create image prompts.

Brief (contains pre-written slides):
${brief}

Language: ${lang}
Vibe: ${vibe}
Design style: ${designStyle || "realistic"}
Color palette: ${colorPalette?.join(", ") || "vibrant"}
${withSubject ? "Include a person/subject in the design." : "No people — focus on objects, graphic elements, and text layout."}${brandNote}

Return a JSON object with a "slides" key — an array of exactly ${count} objects. Rules:
- "caption": copy the EXACT text from that slide in the brief. Do NOT rewrite or summarize it. Preserve emojis, bullet points, line breaks.
- "hashtags": 5 relevant hashtags as a string
- "imagePrompt": a social media graphic design prompt. Describe it as a DESIGNED SLIDE (not a plain photo): styled background, typography layout area, graphic elements that match the slide content. Style: ${styleHint}.${logoNote} The image must look like a finished social media carousel slide — include visual layout space for the slide text to be readable on top.

Respond ONLY with valid JSON, no markdown, no extra text.`
    : `You are a social media content writer. Create ${count} slide captions for a social media post.

Brief: ${brief}
Language: ${lang}
Vibe: ${vibe}
Slide count: ${count}
Design style: ${designStyle || "realistic"}
Color palette: ${colorPalette?.join(", ") || "vibrant"}
${withSubject ? "Include a person/subject in each image." : "No people — focus on objects, graphic elements, and abstract visuals."}${brandNote}

Return a JSON object with a "slides" key — an array of exactly ${count} objects, each with:
- "caption": engaging caption text (2-4 sentences) in ${lang}
- "hashtags": 5 relevant hashtags as a string
- "imagePrompt": a social media graphic design prompt — describe a DESIGNED SLIDE with styled background, graphic elements, and layout space for text overlay. Style: ${styleHint}.${logoNote}

Respond ONLY with valid JSON, no markdown, no extra text.`

  function cleanRaw(s: string): string {
    return s
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/^```(?:json)?\n?/im, "")
      .replace(/\n?```$/im, "")
      .trim()
  }

  let slidesData: Array<{ caption: string; hashtags: string; imagePrompt: string }> = []

  try {
    let raw = "{}"
    console.log(`[generate] calling chat model: ${chatModel}`)
    try {
      const chatRes = await client.chat.completions.create({
        model: chatModel,
        messages: [{ role: "user", content: captionPrompt }],
        response_format: { type: "json_object" },
      })
      raw = cleanRaw(chatRes.choices[0]?.message?.content || "{}")
    } catch (firstErr) {
      console.error("[generate] chat with response_format failed, retrying without:", firstErr)
      const chatRes = await client.chat.completions.create({
        model: chatModel,
        messages: [{ role: "user", content: captionPrompt }],
      })
      raw = cleanRaw(chatRes.choices[0]?.message?.content || "{}")
    }

    console.log("[generate] raw response length:", raw.length, "| preview:", raw.slice(0, 120))
    const parsed = JSON.parse(raw)
    slidesData = Array.isArray(parsed)
      ? parsed
      : parsed.slides || parsed.data || parsed.captions || (Object.values(parsed)[0] as typeof slidesData) || []
    console.log("[generate] parsed slides:", slidesData.length)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[generate] caption generation failed:", msg)
    await db.update(post).set({ status: "error", errorMessage: `caption failed: ${msg}` }).where(eq(post.id, postId))
    return NextResponse.json({ error: "caption generation failed", detail: msg }, { status: 500 })
  }

  if (!slidesData.length) {
    await db.update(post).set({ status: "error", errorMessage: "no slides returned from AI" }).where(eq(post.id, postId))
    return NextResponse.json({ error: "no slides data returned" }, { status: 500 })
  }

  // insert slides with captions + prompts — imageUrl generated separately per slide
  const slideRecords = await Promise.all(
    slidesData.slice(0, count).map(async (s, i) => {
      const slideId = uuidv4()
      await db.insert(slide).values({
        id: slideId,
        postId,
        order: i,
        imageUrl: null,
        imagePrompt: s.imagePrompt,
        caption: s.caption,
        hashtags: s.hashtags,
      })
      return { id: slideId, order: i, imagePrompt: s.imagePrompt, caption: s.caption, hashtags: s.hashtags }
    })
  )

  // captions done — images will be generated per-slide by the client
  await db.update(post).set({ status: "captions_done", title: brief.slice(0, 80) }).where(eq(post.id, postId))

  if (!settings || settings.plan === "free") {
    if (settings) {
      await db.update(userSettings).set({ freeGenerationsUsed: (settings.freeGenerationsUsed || 0) + 1 }).where(eq(userSettings.userId, userId))
    } else {
      await db.insert(userSettings).values({ id: uuidv4(), userId, freeGenerationsUsed: 1 })
    }
  }

  return NextResponse.json({ postId, slides: slideRecords })
}
