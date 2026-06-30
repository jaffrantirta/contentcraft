import { db } from "@/lib/db"
import { slide, post, userSettings, identity } from "@/lib/db/schema"
import { getTokenRouterClient, DEFAULT_IMAGE_MODEL } from "@/lib/tokenrouter"
import { uploadFile, storageEnabled } from "@/lib/storage"
import { eq, asc } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"

export async function generateSlideImage(slideId: string, userId: string): Promise<string | null> {
  const slideRow = await db.select().from(slide).where(eq(slide.id, slideId)).limit(1).then(r => r[0])
  if (!slideRow) return null

  const postRow = await db.select().from(post).where(eq(post.id, slideRow.postId)).limit(1).then(r => r[0])
  if (!postRow || postRow.userId !== userId || !slideRow.imagePrompt) return null

  const [settings, identityRow] = await Promise.all([
    db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1).then(r => r[0] ?? null),
    db.select().from(identity).where(eq(identity.userId, userId)).limit(1).then(r => r[0] ?? null),
  ])

  const plan = settings?.plan ?? "free"
  const isByok = plan === "byok" && settings?.byokApiKey
  const isPro = plan === "pro"

  const client = getTokenRouterClient(
    isByok ? { apiKey: settings!.byokApiKey!, baseURL: settings!.byokBaseUrl || undefined } : {}
  )
  const imageModel = isByok && settings?.byokModel ? settings.byokModel : DEFAULT_IMAGE_MODEL

  const sizeMap: Record<string, string> = {
    "1:1":  "1024x1024",
    "4:5":  "1024x1536",
    "9:16": "1024x1536",
    "16:9": "1536x1024",
  }
  const imageSize = sizeMap[postRow.aspectRatio] || "1024x1024"

  const hasCaption = !!slideRow.caption?.trim()
  const logoZone = (identityRow?.logoUrl && identityRow.logoPosition && identityRow.logoPosition !== "none")
    ? `Leave the ${identityRow.logoPosition.replace("-", " ")} corner completely empty — a brand logo will be placed there.`
    : ""

  let fullPrompt: string
  if (hasCaption) {
    fullPrompt = [
      "Create a complete, professional social media carousel slide graphic.",
      `Slide text (must appear clearly and prominently in the design): "${slideRow.caption}"`,
      `Visual concept: ${slideRow.imagePrompt}`,
      logoZone,
      "Bold, readable typography integrated naturally into the design. High quality, eye-catching, Instagram-ready. Full bleed — no empty bars or borders.",
    ].filter(Boolean).join(" ")
  } else {
    fullPrompt = [
      slideRow.imagePrompt,
      logoZone,
      "No text or words in the image. Full bleed — no empty bars or borders.",
    ].filter(Boolean).join(" ")
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

  if (!imageUrl) return null

  // Pro users: upload to S3 for persistent storage (30-day lifecycle configured on bucket)
  if (isPro && storageEnabled()) {
    try {
      let buf: Buffer
      if (imageUrl.startsWith("data:")) {
        buf = Buffer.from(imageUrl.split(",")[1], "base64")
      } else {
        const resp = await fetch(imageUrl)
        buf = Buffer.from(await resp.arrayBuffer())
      }
      const key = `slides/${userId}/${postRow.id}/${uuidv4()}.png`
      imageUrl = await uploadFile(key, buf, "image/png")
    } catch (err) {
      console.error(`[image] s3 upload failed for slide ${slideId}:`, err instanceof Error ? err.message : err)
      // fall back to AI URL
    }
  }

  await db.update(slide).set({ imageUrl }).where(eq(slide.id, slideId))

  const allSlides = await db.select().from(slide).where(eq(slide.postId, slideRow.postId)).orderBy(asc(slide.createdAt))
  const allDone = allSlides.every(s => s.id === slideId ? true : s.imageUrl !== null)
  if (allDone) {
    await db.update(post).set({ status: "done" }).where(eq(post.id, slideRow.postId))
  }

  return imageUrl
}
