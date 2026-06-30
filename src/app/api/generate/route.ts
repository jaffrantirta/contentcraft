import { NextRequest, NextResponse, after } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { post, slide, userSettings, identity } from "@/lib/db/schema"
import { getTokenRouterClient, DEFAULT_CHAT_MODEL } from "@/lib/tokenrouter"
import { generateSlideImage } from "@/lib/generate-slide-image"
import { eq } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { headers } from "next/headers"

// captions (~30s) + background image generation via after()
export const maxDuration = 300

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
  const { brief, slideBriefs, aspectRatio, language, slideCount, withSubject, vibe, designStyle, colorPalette, captionMode, showFooter } = body
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
    captionMode: captionMode || "per_slide",
    slideBriefs: Array.isArray(slideBriefs) ? slideBriefs : [],
    showFooter: showFooter !== false,
    colorPalette: colorPalette || [],
    status: "generating",
  })

  const lang = language === "en" ? "English" : "Indonesian"
  const effectiveCaptionMode = captionMode || "per_slide"
  const isSingleCaption = effectiveCaptionMode === "single"
  const isNoCaption = effectiveCaptionMode === "none"
  const hasPrewrittenSlides = /SLIDE\s*\d+/i.test(brief)
  const hasPerSlideBriefs = Array.isArray(slideBriefs) && slideBriefs.some((s: string) => s?.trim())
  const perSlideLines = hasPerSlideBriefs
    ? slideBriefs.slice(0, count).map((b: string, i: number) => `Slide ${i + 1}: ${b?.trim() || "(see general brief)"}`)
    : []

  const styleKeywords: Record<string, string> = {
    realistic:    "photorealistic DSLR photo, sharp focus, natural lighting",
    illustration: "editorial illustration, vector-style, clean linework",
    "3d":         "3D render, octane render, subsurface scattering, depth of field",
    flat:         "flat design, geometric shapes, bold colors, no shadows",
    anime:        "anime style, cel shading, clean lineart, vibrant colors",
    watercolor:   "watercolor painting, wet-on-wet technique, soft edges, paper texture",
    abstract:     "abstract art, expressionist brushstrokes, textured layers",
    minimal:      "minimalist, negative space, single accent color, ultra-clean",
  }
  const styleHint = styleKeywords[designStyle || "realistic"] || styleKeywords.realistic
  const brandNote = identityData?.companyName
    ? ` Brand context: ${identityData.companyName}${identityData.tagline ? ` — ${identityData.tagline}` : ""}.`
    : ""

  // imagePrompt = pure visual background — text is overlaid client-side (consistent unlike AI text rendering)
  const imagePromptRule = `For "imagePrompt": describe a visually striking background scene — colors, mood, lighting, composition, objects. Style: ${styleHint}. Color palette: ${colorPalette?.join(", ") || "vibrant"}.${withSubject ? " Include a person/subject." : " No people."}${brandNote} NO text, words, or typography — pure visual background only. Caption text is overlaid separately.`

  let captionPrompt: string

  if (isNoCaption) {
    // no caption at all — only need image prompts per slide
    captionPrompt = "" // handled via parallel path below

  } else if (isSingleCaption) {
    const slidePart = hasPerSlideBriefs
      ? `Each slide has a specific visual topic:\n${perSlideLines.join("\n")}\n\nGeneral context: ${brief}`
      : `Brief: ${brief}`
    captionPrompt = `You are a social media content writer. Create one shared caption for a ${count}-slide carousel, plus a unique image prompt per slide.

${slidePart}
Language: ${lang}
Vibe: ${vibe}

Return a JSON object with a "slides" key — array of exactly ${count} objects. ALL slides share the same caption and hashtags but each has a UNIQUE imagePrompt based on its slide topic.
- "caption": ONE engaging caption (3-5 sentences) in ${lang} — same for all slides
- "hashtags": 5 hashtags — same for all slides
- "imagePrompt": unique visual scene for this slide's specific topic

${imagePromptRule}

Respond ONLY with valid JSON, no markdown, no extra text.`

  } else if (hasPrewrittenSlides) {
    captionPrompt = `You are a social media content assistant. The user has pre-written text for each slide. Extract each slide's text exactly and create image prompts.

Brief:
${brief}

Language: ${lang}
Vibe: ${vibe}

Return a JSON object with a "slides" key — array of exactly ${count} objects:
- "caption": EXACT text from that slide. Preserve emojis, bullets, line breaks. Do NOT rewrite.
- "hashtags": 5 relevant hashtags
- "imagePrompt": visual scene for this slide

${imagePromptRule}

Respond ONLY with valid JSON, no markdown, no extra text.`

  } else if (hasPerSlideBriefs) {
    // parallel path — captionPrompt unused, handled below
    captionPrompt = ""

  } else {
    captionPrompt = `You are a social media content writer. Create ${count} slide captions for a carousel post.

Brief: ${brief}
Language: ${lang}
Vibe: ${vibe}
Slide count: ${count}

Make each slide cover a different angle or point. Do NOT repeat the same message across slides.

Return a JSON object with a "slides" key — array of exactly ${count} objects:
- "caption": caption for this slide in ${lang} (2-4 sentences)
- "hashtags": 5 relevant hashtags
- "imagePrompt": visual scene for this slide

${imagePromptRule}

Respond ONLY with valid JSON, no markdown, no extra text.`
  }

  function cleanRaw(s: string): string {
    return s
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/^```(?:json)?\n?/im, "")
      .replace(/\n?```$/im, "")
      .trim()
  }

  let slidesData: Array<{ caption: string; hashtags: string; imagePrompt: string }> = []

  async function callChat(prompt: string): Promise<string> {
    try {
      const res = await client.chat.completions.create({
        model: chatModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      })
      return cleanRaw(res.choices[0]?.message?.content || "{}")
    } catch {
      const res = await client.chat.completions.create({
        model: chatModel,
        messages: [{ role: "user", content: prompt }],
      })
      return cleanRaw(res.choices[0]?.message?.content || "{}")
    }
  }

  try {
    if (isNoCaption) {
      // no captions — generate only imagePrompts, one call per slide in parallel
      console.log(`[generate] no-caption mode: generating ${count} image prompts`)
      const briefs = hasPerSlideBriefs
        ? slideBriefs.slice(0, count)
        : Array.from({ length: count }, () => brief)
      slidesData = await Promise.all(
        briefs.map(async (slideBrief: string, i: number) => {
          const slidePrompt = `Describe a visual scene for a social media slide image.

Topic: ${slideBrief?.trim() || brief}
Context: ${brief}
Vibe: ${vibe}

Return a JSON object with only:
- "imagePrompt": visual scene description (background, mood, colors, composition)

${imagePromptRule}

Respond ONLY with valid JSON.`
          const raw = await callChat(slidePrompt)
          const parsed = JSON.parse(raw)
          return { caption: "", hashtags: "", imagePrompt: parsed.imagePrompt || "" }
        })
      )
      console.log(`[generate] no-caption image prompts done: ${slidesData.length}`)

    } else if (hasPerSlideBriefs) {
      // one AI call per slide in parallel — each only sees its own brief, no chance to repeat
      console.log(`[generate] parallel per-slide generation: ${count} slides`)
      slidesData = await Promise.all(
        slideBriefs.slice(0, count).map(async (slideBrief: string, i: number) => {
          const slidePrompt = `You are a social media content writer. Write content for slide ${i + 1} of a carousel post.

This slide's topic: ${slideBrief?.trim() || brief}
General context: ${brief}
Language: ${lang}
Vibe: ${vibe}

Return a JSON object with exactly:
- "caption": caption in ${lang} for this slide's specific topic (2-4 sentences)
- "hashtags": 5 relevant hashtags as a string
- "imagePrompt": visual scene for this slide's topic

${imagePromptRule}

Respond ONLY with valid JSON.`
          const raw = await callChat(slidePrompt)
          const parsed = JSON.parse(raw)
          return {
            caption: parsed.caption || "",
            hashtags: parsed.hashtags || "",
            imagePrompt: parsed.imagePrompt || "",
          }
        })
      )
      console.log(`[generate] parallel generation done: ${slidesData.length} slides`)

    } else {
      let raw = "{}"
      console.log(`[generate] calling chat model: ${chatModel}`)
      raw = await callChat(captionPrompt)
      console.log("[generate] raw response length:", raw.length, "| preview:", raw.slice(0, 120))
      const parsed = JSON.parse(raw)
      slidesData = Array.isArray(parsed)
        ? parsed
        : parsed.slides || parsed.data || parsed.captions || (Object.values(parsed)[0] as typeof slidesData) || []
      console.log("[generate] parsed slides:", slidesData.length)
    }
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

  await db.update(post).set({ status: "captions_done", title: brief.slice(0, 80) }).where(eq(post.id, postId))

  if (!settings || settings.plan === "free") {
    if (settings) {
      await db.update(userSettings).set({ freeGenerationsUsed: (settings.freeGenerationsUsed || 0) + 1 }).where(eq(userSettings.userId, userId))
    } else {
      await db.insert(userSettings).values({ id: uuidv4(), userId, freeGenerationsUsed: 1 })
    }
  }

  // fire image generation in background — response is sent first, window can be closed
  after(async () => {
    console.log(`[generate] background image generation started for post ${postId} (${slideRecords.length} slides)`)
    await Promise.all(
      slideRecords.map(s =>
        generateSlideImage(s.id, userId).catch(err =>
          console.error(`[generate] background image failed for slide ${s.id}:`, err)
        )
      )
    )
    console.log(`[generate] background image generation done for post ${postId}`)
  })

  return NextResponse.json({ postId, slides: slideRecords })
}
