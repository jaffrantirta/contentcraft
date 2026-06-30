import { db } from "@/lib/db"
import { slide, post, userSettings, identity } from "@/lib/db/schema"
import { getTokenRouterClient, DEFAULT_IMAGE_MODEL } from "@/lib/tokenrouter"
import { eq } from "drizzle-orm"

export async function generateSlideImage(slideId: string, userId: string): Promise<string | null> {
  const slideRow = await db.query.slide.findFirst({
    where: eq(slide.id, slideId),
    with: { post: true },
  })

  if (!slideRow || slideRow.post.userId !== userId || !slideRow.imagePrompt) return null

  const [settings, identityRow] = await Promise.all([
    db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) }),
    db.query.identity.findFirst({ where: eq(identity.userId, userId) }),
  ])

  const isByok = settings?.plan === "byok" && settings.byokApiKey
  const client = getTokenRouterClient(
    isByok ? { apiKey: settings.byokApiKey!, baseURL: settings.byokBaseUrl || undefined } : {}
  )
  const imageModel = isByok && settings?.byokModel ? settings.byokModel : DEFAULT_IMAGE_MODEL

  const sizeMap: Record<string, string> = {
    "1:1":  "1024x1024",
    "4:5":  "1024x1536",
    "9:16": "1024x1536",
    "16:9": "1536x1024",
  }
  const imageSize = sizeMap[slideRow.post.aspectRatio] || "1024x1024"

  const captionMode = slideRow.post.captionMode ?? "per_slide"
  const showFooter = identityRow?.footerText && slideRow.post.showFooter !== false
  const logoZone = (identityRow?.logoUrl && identityRow.logoPosition && identityRow.logoPosition !== "none")
    ? `Leave the ${identityRow.logoPosition.replace("-", " ")} corner completely empty — a brand logo will be placed there.`
    : ""

  let fullPrompt: string

  if (captionMode === "per_slide" && slideRow.caption) {
    // Thumbai image-gen style: frame as complete slide, text included naturally as content
    const parts = [
      "Create a complete, professional social media carousel slide graphic.",
      `Slide text (must appear clearly and prominently in the design): "${slideRow.caption}"`,
      `Visual concept: ${slideRow.imagePrompt}`,
      showFooter ? `Include a footer strip at the very bottom with this small text: "${identityRow!.footerText}"` : "",
      logoZone,
      "Bold readable typography integrated naturally into the design. High quality, eye-catching, Instagram-ready.",
    ]
    fullPrompt = parts.filter(Boolean).join(" ")
  } else {
    // single / none — clean visual, no text (text handled client-side or not at all)
    const parts = [
      slideRow.imagePrompt,
      showFooter ? `Include a footer strip at the very bottom with this small text: "${identityRow!.footerText}"` : "",
      logoZone,
      "No other text or words in the image.",
    ]
    fullPrompt = parts.filter(Boolean).join(" ")
  }

  let imageUrl: string | null = null

  try {
    const imgRes = await client.images.generate({
      model: imageModel,
      prompt: fullPrompt,
      size: imageSize as "1024x1024" | "1024x1536" | "1536x1024",
      n: 1,
    })
    const imgData = imgRes.data?.[0]
    if (imgData?.url) imageUrl = imgData.url
    else if (imgData?.b64_json) imageUrl = `data:image/png;base64,${imgData.b64_json}`
  } catch (err) {
    console.error(`[image] slide ${slideId} failed:`, err instanceof Error ? err.message : err)
    return null
  }

  await db.update(slide).set({ imageUrl }).where(eq(slide.id, slideId))

  const allSlides = await db.query.slide.findMany({ where: eq(slide.postId, slideRow.postId) })
  const allDone = allSlides.every(s => s.id === slideId ? true : s.imageUrl !== null)
  if (allDone) {
    await db.update(post).set({ status: "done" }).where(eq(post.id, slideRow.postId))
  }

  return imageUrl
}
