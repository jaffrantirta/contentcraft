import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { post, slide, userSettings } from "@/lib/db/schema"
import { getTokenRouterClient, DEFAULT_IMAGE_MODEL, DEFAULT_CHAT_MODEL } from "@/lib/tokenrouter"
import { eq } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { headers } from "next/headers"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const userId = session.user.id
  const settings = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) })

  // free tier check
  if (!settings || settings.plan === "free") {
    const used = settings?.freeGenerationsUsed ?? 0
    if (used >= 1) {
      return NextResponse.json({ error: "free_limit_reached" }, { status: 403 })
    }
  }

  const body = await req.json()
  const { brief, aspectRatio, language, slideCount, withSubject, vibe, colorPalette } = body

  if (!brief) return NextResponse.json({ error: "brief is required" }, { status: 400 })
  const count = Math.min(Math.max(1, Number(slideCount) || 3), settings?.plan === "free" ? 5 : 10)

  // determine api config
  const isByok = settings?.plan === "byok" && settings.byokApiKey
  const clientConfig = isByok
    ? { apiKey: settings.byokApiKey!, baseURL: settings.byokBaseUrl || undefined, model: settings.byokModel || undefined }
    : {}
  const client = getTokenRouterClient(clientConfig)
  const imageModel = (isByok && settings?.byokModel) ? settings.byokModel : DEFAULT_IMAGE_MODEL
  const chatModel = DEFAULT_CHAT_MODEL

  // create post record
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

  // generate captions first
  const lang = language === "en" ? "English" : "Indonesian"
  const captionPrompt = `You are a social media content writer. Create ${count} slide captions for a social media post.

Brief: ${brief}
Language: ${lang}
Vibe: ${vibe}
Slide count: ${count}

Return a JSON array with exactly ${count} objects. Each object has:
- "caption": engaging caption text (2-4 sentences)
- "hashtags": 5 relevant hashtags as a string
- "imagePrompt": a detailed image generation prompt for this slide

The image prompts should be vivid and visual. Style: ${vibe}. Color palette: ${colorPalette?.join(", ") || "vibrant"}.${withSubject ? " Include a person/subject in the design." : " No person in the design, focus on objects, text, and abstract visuals."}

Respond ONLY with the JSON array, no markdown.`

  let slidesData: Array<{ caption: string; hashtags: string; imagePrompt: string }> = []

  try {
    const chatRes = await client.chat.completions.create({
      model: chatModel,
      messages: [{ role: "user", content: captionPrompt }],
      response_format: { type: "json_object" },
    })

    const raw = chatRes.choices[0]?.message?.content || "[]"
    const parsed = JSON.parse(raw)
    slidesData = Array.isArray(parsed) ? parsed : parsed.slides || parsed.data || []
  } catch {
    await db.update(post).set({ status: "error", errorMessage: "caption generation failed" }).where(eq(post.id, postId))
    return NextResponse.json({ error: "caption generation failed" }, { status: 500 })
  }

  // generate images in parallel (max 5 concurrently)
  const slideRecords = await Promise.all(
    slidesData.slice(0, count).map(async (s, i) => {
      const slideId = uuidv4()
      let imageUrl: string | null = null

      try {
        const imgRes = await client.images.generate({
          model: imageModel,
          prompt: s.imagePrompt,
          size: "1024x1024",
          quality: "standard",
          n: 1,
        })
        imageUrl = imgRes.data?.[0]?.url || null
      } catch {
        imageUrl = null
      }

      await db.insert(slide).values({
        id: slideId,
        postId,
        order: i,
        imageUrl,
        imagePrompt: s.imagePrompt,
        caption: s.caption,
        hashtags: s.hashtags,
      })

      return { id: slideId, order: i, imageUrl, caption: s.caption, hashtags: s.hashtags }
    })
  )

  // update post status
  await db.update(post).set({ status: "done", title: brief.slice(0, 80) }).where(eq(post.id, postId))

  // increment free usage
  if (!settings || settings.plan === "free") {
    if (settings) {
      await db.update(userSettings).set({ freeGenerationsUsed: (settings.freeGenerationsUsed || 0) + 1 }).where(eq(userSettings.userId, userId))
    } else {
      await db.insert(userSettings).values({ id: uuidv4(), userId, freeGenerationsUsed: 1 })
    }
  }

  return NextResponse.json({ postId, slides: slideRecords })
}
