import { NextRequest, NextResponse, after } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { post, slide, userSettings, identity } from "@/lib/db/schema"
import { getTokenRouterClient, DEFAULT_CHAT_MODEL } from "@/lib/tokenrouter"
import { generateSlideImage } from "@/lib/generate-slide-image"
import { eq } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { headers } from "next/headers"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const userId = session.user.id

  const [settingsRows, identityRows] = await Promise.all([
    db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)
      .catch((err: unknown) => { console.error("[generate] userSettings query failed:", err); return [] }),
    db.select().from(identity).where(eq(identity.userId, userId)).limit(1)
      .catch((err: unknown) => { console.error("[generate] identity query failed:", err); return [] }),
  ])
  const settings = settingsRows[0]
  const identityData = identityRows[0]

  if (!settings || settings.plan === "free") {
    const used = settings?.freeGenerationsUsed ?? 0
    if (used >= 1) return NextResponse.json({ error: "free_limit_reached" }, { status: 403 })
  }

  const body = await req.json()
  const {
    brief,
    slideBriefs,
    aspectRatio,
    language,
    slideCount,
    withSubject,
    vibe,
    designStyle,
    colorPalette,
    captionMode, // "text_ready" | "raw_brief"
    showFooter,
    textPosition, // auto | left | center | right
    typographyStyle, // auto | bold | serif | sans | handwritten | decorative
  } = body

  if (!brief) return NextResponse.json({ error: "brief is required" }, { status: 400 })

  const count = Math.min(Math.max(1, Number(slideCount) || 3), settings?.plan === "free" ? 5 : 10)
  const inputMode: "text_ready" | "raw_brief" = captionMode === "text_ready" ? "text_ready" : "raw_brief"

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
    captionMode: inputMode,
    slideBriefs: Array.isArray(slideBriefs) ? slideBriefs : [],
    showFooter: showFooter !== false,
    colorPalette: colorPalette || [],
    textPosition: textPosition || "auto",
    typographyStyle: typographyStyle || "auto",
    status: "generating",
  })

  const lang = language === "en" ? "English" : "Indonesian"

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

  const positionHints: Record<string, string> = {
    left:   "Compose the scene so the main visual subject sits on the RIGHT; keep the left side open and uncluttered for text.",
    center: "Use a symmetrical, center-focused composition; visual elements frame the edges, leaving the center clear for text.",
    right:  "Compose the scene so the main visual subject sits on the LEFT; keep the right side open and uncluttered for text.",
  }
  const positionHint = positionHints[textPosition] ?? ""

  const imagePromptRule = `For "imagePrompt": describe the visual concept, scene, mood, lighting, composition, and objects. Style: ${styleHint}. Color palette: ${colorPalette?.join(", ") || "vibrant"}.${withSubject ? " Include a person/subject." : " No people."}${brandNote}${positionHint ? ` ${positionHint}` : ""} Do NOT include any text or words here — only the visual scene.`

  function cleanRaw(s: string): string {
    return s
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/^```(?:json)?\n?/im, "")
      .replace(/\n?```$/im, "")
      .trim()
  }

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

  let slidesData: Array<{ caption: string; hashtags: string; imagePrompt: string }> = []

  try {
    if (inputMode === "text_ready") {
      // User wrote the exact text — only generate imagePrompts, one call per slide
      console.log(`[generate] text_ready mode: ${count} slides, generating image prompts only`)
      const briefs = Array.isArray(slideBriefs) ? slideBriefs.slice(0, count) : []

      slidesData = await Promise.all(
        Array.from({ length: count }, async (_, i) => {
          const slideText = briefs[i]?.trim() || ""
          const prompt = `You are a visual designer. Create an image concept for a social media slide.

The slide already has this exact text: "${slideText}"
Overall context: ${brief}
Vibe: ${vibe}
Language of text: ${lang}

Return a JSON object with only:
- "imagePrompt": visual scene description for the background and design — mood, colors, composition, objects. The text will be overlaid on this design.
- "hashtags": 5 relevant hashtags as a string

${imagePromptRule}

Respond ONLY with valid JSON.`

          const raw = await callChat(prompt)
          const parsed = JSON.parse(raw)
          return {
            caption: slideText,
            hashtags: parsed.hashtags || "",
            imagePrompt: parsed.imagePrompt || "",
          }
        })
      )
      console.log(`[generate] text_ready prompts done: ${slidesData.length} slides`)

    } else {
      // raw_brief — AI writes caption + imagePrompt for each slide from the brief
      console.log(`[generate] raw_brief mode: ${count} slides, generating content in parallel`)
      const briefs = Array.isArray(slideBriefs) ? slideBriefs.slice(0, count) : []

      slidesData = await Promise.all(
        Array.from({ length: count }, async (_, i) => {
          const slideBrief = briefs[i]?.trim() || brief
          const prompt = `You are a social media content writer. Write content for slide ${i + 1} of a ${count}-slide carousel.

This slide's topic: ${slideBrief}
General context: ${brief}
Language: ${lang}
Vibe: ${vibe}

Return a JSON object with exactly:
- "caption": the text that will appear on this slide in ${lang} (2-4 short sentences, punchy and readable)
- "hashtags": 5 relevant hashtags as a string
- "imagePrompt": visual concept for this slide

${imagePromptRule}

Respond ONLY with valid JSON.`

          const raw = await callChat(prompt)
          const parsed = JSON.parse(raw)
          return {
            caption: parsed.caption || "",
            hashtags: parsed.hashtags || "",
            imagePrompt: parsed.imagePrompt || "",
          }
        })
      )
      console.log(`[generate] raw_brief generation done: ${slidesData.length} slides`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[generate] generation failed:", msg)
    await db.update(post).set({ status: "error", errorMessage: `generation failed: ${msg}` }).where(eq(post.id, postId))
    return NextResponse.json({ error: "generation failed", detail: msg }, { status: 500 })
  }

  if (!slidesData.length) {
    await db.update(post).set({ status: "error", errorMessage: "no slides returned from AI" }).where(eq(post.id, postId))
    return NextResponse.json({ error: "no slides data returned" }, { status: 500 })
  }

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

  after(async () => {
    console.log(`[generate] background image generation for post ${postId} (${slideRecords.length} slides)`)
    await Promise.all(
      slideRecords.map(s =>
        generateSlideImage(s.id, userId).catch(err =>
          console.error(`[generate] image failed for slide ${s.id}:`, err)
        )
      )
    )
    console.log(`[generate] image generation done for post ${postId}`)
  })

  return NextResponse.json({ postId, slides: slideRecords })
}
