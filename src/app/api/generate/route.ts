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
  const [settings, identityData] = await Promise.all([
    db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) }),
    db.query.identity.findFirst({ where: eq(identity.userId, userId) }),
  ])

  if (!settings || settings.plan === "free") {
    const used = settings?.freeGenerationsUsed ?? 0
    if (used >= 1) return NextResponse.json({ error: "free_limit_reached" }, { status: 403 })
  }

  const body = await req.json()
  const { brief, aspectRatio, language, slideCount, withSubject, vibe, colorPalette } = body
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
    colorPalette: colorPalette || [],
    status: "generating",
  })

  const lang = language === "en" ? "English" : "Indonesian"
  const captionPrompt = `You are a social media content writer. Create ${count} slide captions for a social media post.

Brief: ${brief}
Language: ${lang}
Vibe: ${vibe}
Slide count: ${count}

Return a JSON object with a "slides" key containing an array of exactly ${count} objects. Each object must have:
- "caption": engaging caption text (2-4 sentences)
- "hashtags": 5 relevant hashtags as a string
- "imagePrompt": a detailed image generation prompt for this slide

Style: ${vibe}. Color palette: ${colorPalette?.join(", ") || "vibrant"}.${withSubject ? " Include a person/subject in the design." : " No person in the design, focus on objects, text, and abstract visuals."}${identityData?.companyName ? ` Brand: ${identityData.companyName}${identityData.tagline ? ` — ${identityData.tagline}` : ""}.` : ""}

For the imagePrompt field of each slide: create a detailed visual prompt.${identityData?.companyName && identityData?.logoPosition && identityData.logoPosition !== "none" ? ` Reserve a clear area at the ${identityData.logoPosition.replace("-", " ")} of the image for a brand logo. Leave that zone clean and uncluttered so a logo can be overlaid.${identityData.footerText ? ` Also reserve the footer area for text: "${identityData.footerText}".` : ""}` : ""}

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
    try {
      const chatRes = await client.chat.completions.create({
        model: chatModel,
        messages: [{ role: "user", content: captionPrompt }],
        response_format: { type: "json_object" },
      })
      raw = cleanRaw(chatRes.choices[0]?.message?.content || "{}")
    } catch {
      const chatRes = await client.chat.completions.create({
        model: chatModel,
        messages: [{ role: "user", content: captionPrompt }],
      })
      raw = cleanRaw(chatRes.choices[0]?.message?.content || "{}")
    }

    const parsed = JSON.parse(raw)
    slidesData = Array.isArray(parsed)
      ? parsed
      : parsed.slides || parsed.data || parsed.captions || (Object.values(parsed)[0] as typeof slidesData) || []
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
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
