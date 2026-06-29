import { db } from "@/lib/db"
import { slide, post, userSettings } from "@/lib/db/schema"
import { getTokenRouterClient, DEFAULT_IMAGE_MODEL } from "@/lib/tokenrouter"
import { eq } from "drizzle-orm"

export async function generateSlideImage(slideId: string, userId: string): Promise<string | null> {
  const slideRow = await db.query.slide.findFirst({
    where: eq(slide.id, slideId),
    with: { post: true },
  })

  if (!slideRow || slideRow.post.userId !== userId || !slideRow.imagePrompt) return null

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  })

  const isByok = settings?.plan === "byok" && settings.byokApiKey
  const client = getTokenRouterClient(
    isByok ? { apiKey: settings.byokApiKey!, baseURL: settings.byokBaseUrl || undefined } : {}
  )
  const imageModel = isByok && settings?.byokModel ? settings.byokModel : DEFAULT_IMAGE_MODEL

  let imageUrl: string | null = null

  try {
    const imgRes = await client.images.generate({
      model: imageModel,
      prompt: slideRow.imagePrompt,
      size: "1024x1024",
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
