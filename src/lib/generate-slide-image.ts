import { db } from "@/lib/db"
import { slide, post, userSettings, identity } from "@/lib/db/schema"
import { getTokenRouterClient, DEFAULT_IMAGE_MODEL } from "@/lib/tokenrouter"
import { eq } from "drizzle-orm"

export async function generateSlideImage(slideId: string, userId: string): Promise<string | null> {
  const slideRow = await db.query.slide.findFirst({
    where: eq(slide.id, slideId),
    with: { post: true },
  })

  if (!slideRow || slideRow.post.userId !== userId || !slideRow.imagePrompt || !slideRow.caption) return null

  const [settings, identityRow] = await Promise.all([
    db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) }),
    db.query.identity.findFirst({ where: eq(identity.userId, userId) }),
  ])

  const isByok = settings?.plan === "byok" && settings.byokApiKey
  const client = getTokenRouterClient(
    isByok ? { apiKey: settings.byokApiKey!, baseURL: settings.byokBaseUrl || undefined } : {}
  )
  const imageModel = isByok && settings?.byokModel ? settings.byokModel : DEFAULT_IMAGE_MODEL

  // map stored aspect ratio to image API size
  const sizeMap: Record<string, string> = {
    "1:1":  "1024x1024",
    "4:5":  "1024x1536",
    "9:16": "1024x1536",
    "16:9": "1536x1024",
  }
  const imageSize = sizeMap[slideRow.post.aspectRatio] || "1024x1024"

  let imageUrl: string | null = null

  // build prompt: visual scene + caption + footer + logo zone
  let fullPrompt = `${slideRow.imagePrompt}

Typography: render the following caption as bold, legible text integrated into the design. Match the font style to the visual aesthetic. Ensure strong contrast (white text on dark backgrounds, dark text on light backgrounds):

"${slideRow.caption}"`

  // footer: burn consistent footer text on every slide
  if (identityRow?.footerText) {
    fullPrompt += `

Footer: add a thin footer bar at the very bottom of the image. Inside it, render this text in small, clean typography: "${identityRow.footerText}". Keep it subtle but readable — use a semi-transparent dark or brand-colored strip. This footer must appear on every slide consistently.`
  }

  // logo zone: if user has a real logo, keep that area blank — CSS overlay will place it
  if (identityRow?.logoUrl && identityRow.logoPosition && identityRow.logoPosition !== "none") {
    const zone = identityRow.logoPosition.replace("-", " ") // e.g. "top center"
    fullPrompt += `

Logo zone: leave the ${zone} area of the image completely empty — no text, no icons, no graphic elements in that zone. A real brand logo image will be placed there as an overlay after generation.`
  }

  fullPrompt += `

Output: a complete, polished social media slide graphic.`

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

  // mark post done if all slides now have images
  const allSlides = await db.query.slide.findMany({ where: eq(slide.postId, slideRow.postId) })
  const allDone = allSlides.every(s => s.id === slideId ? true : s.imageUrl !== null)
  if (allDone) {
    await db.update(post).set({ status: "done" }).where(eq(post.id, slideRow.postId))
  }

  return imageUrl
}
