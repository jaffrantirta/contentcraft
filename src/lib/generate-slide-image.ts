import { db } from "@/lib/db"
import { slide, post, userSettings, identity } from "@/lib/db/schema"
import { getTokenRouterClient, DEFAULT_IMAGE_MODEL } from "@/lib/tokenrouter"
import { uploadFile, storageEnabled } from "@/lib/storage"
import { eq, asc } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"

export async function generateSlideImage(
  slideId: string,
  userId: string,
  opts?: { revisionNote?: string },
): Promise<string | null> {
  const slideRow = await db.select().from(slide).where(eq(slide.id, slideId)).limit(1).then(r => r[0])
  if (!slideRow) return null

  const postRow = await db.select().from(post).where(eq(post.id, slideRow.postId)).limit(1).then(r => r[0])
  if (!postRow || postRow.userId !== userId || !slideRow.imagePrompt) return null
  if (postRow.status === "cancelled") return null

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

  const textAlignHints: Record<string, string> = {
    left:   "All slide text must be LEFT-aligned, anchored to the left side of the design.",
    center: "All slide text must be CENTERED horizontally in the design.",
    right:  "All slide text must be RIGHT-aligned, anchored to the right side of the design.",
  }
  const textAlignHint = textAlignHints[postRow.textPosition ?? ""] ?? ""

  const typographyHints: Record<string, string> = {
    bold:        "Typography: ultra-bold, heavy display fonts — thick strokes, maximum visual weight, high-impact headlines.",
    serif:       "Typography: classic elegant serif fonts — refined, authoritative, editorial.",
    sans:        "Typography: clean geometric sans-serif — modern, minimal, corporate.",
    handwritten: "Typography: casual handwritten/brush-script style — organic, personal, expressive lettering.",
    decorative:  "Typography: ornate decorative display fonts — artistic, elaborate, attention-grabbing.",
  }
  const typographyHint = typographyHints[postRow.typographyStyle ?? ""] ?? ""

  // Design-style keyword hint, so that changing the style on regenerate actually changes the look.
  const styleKeywords: Record<string, string> = {
    realistic:    "Rendering: photorealistic DSLR photo, sharp focus, natural lighting.",
    illustration: "Rendering: editorial illustration, vector-style, clean linework.",
    "3d":         "Rendering: 3D render, octane render, glossy materials, depth of field.",
    flat:         "Rendering: flat design, geometric shapes, bold colors, no shadows.",
    anime:        "Rendering: anime style, cel shading, clean lineart, vibrant colors.",
    watercolor:   "Rendering: watercolor painting, soft edges, paper texture.",
    abstract:     "Rendering: abstract art, expressionist brushstrokes, textured layers.",
    minimal:      "Rendering: minimalist, lots of negative space, ultra-clean.",
  }
  const styleHint = styleKeywords[postRow.designStyle ?? ""] ?? ""
  const vibeHint = postRow.vibe ? `Overall mood/vibe: ${postRow.vibe}.` : ""
  const colorHint = Array.isArray(postRow.colorPalette) && postRow.colorPalette.length
    ? `Color palette to build the design around: ${postRow.colorPalette.join(", ")}.`
    : ""
  // Minor-revision instruction from the regenerate dialog (e.g. "remove the word SALE").
  const revisionHint = opts?.revisionNote?.trim()
    ? `IMPORTANT revision request — apply this change precisely: ${opts.revisionNote.trim()}`
    : ""

  let fullPrompt: string
  if (hasCaption) {
    fullPrompt = [
      "Create a complete, professional social media carousel slide graphic.",
      `Slide text (must appear clearly and prominently in the design): "${slideRow.caption}"`,
      `Visual concept: ${slideRow.imagePrompt}`,
      styleHint,
      vibeHint,
      colorHint,
      textAlignHint,
      typographyHint,
      revisionHint,
      logoZone,
      "High quality, eye-catching, Instagram-ready. Full bleed — no empty bars or borders.",
    ].filter(Boolean).join(" ")
  } else {
    fullPrompt = [
      slideRow.imagePrompt,
      styleHint,
      vibeHint,
      colorHint,
      revisionHint,
      logoZone,
      "No text or words in the image. Full bleed — no empty bars or borders.",
    ].filter(Boolean).join(" ")
  }

  let imageUrl: string | null = null

  // If a subject image was uploaded, try images.edit to blend the subject into the design
  if (postRow.subjectImageUrl) {
    try {
      const subjectResp = await fetch(postRow.subjectImageUrl)
      const subjectBuf = Buffer.from(await subjectResp.arrayBuffer())
      const subjectFile = new File([subjectBuf], "subject.png", { type: "image/png" })

      const editPrompt = [
        "Incorporate the person or subject from the provided reference image naturally into this design.",
        fullPrompt,
      ].join(" ")

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editRes = await (client.images as any).edit({
        model: imageModel,
        image: subjectFile,
        prompt: editPrompt,
        size: imageSize,
        n: 1,
      })
      const editData = editRes.data?.[0]
      if (editData?.url) imageUrl = editData.url
      else if (editData?.b64_json) imageUrl = `data:image/png;base64,${editData.b64_json}`
      console.log(`[image] slide ${slideId} generated via images.edit (subject blend)`)
    } catch (editErr) {
      console.warn(`[image] images.edit failed, falling back to generate:`, editErr instanceof Error ? editErr.message : editErr)
    }
  }

  // Standard generation (used when no subject image, or edit failed)
  if (!imageUrl) {
    const subjectHint = postRow.subjectImageUrl
      ? "The design must prominently feature a real person as the main subject, naturally integrated into the scene."
      : ""

    try {
      const imgRes = await client.images.generate({
        model: imageModel,
        prompt: [fullPrompt, subjectHint].filter(Boolean).join(" "),
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
    const [latestPost] = await db.select({ status: post.status }).from(post).where(eq(post.id, slideRow.postId)).limit(1)
    if (latestPost?.status !== "cancelled") {
      await db.update(post).set({ status: "done" }).where(eq(post.id, slideRow.postId))
    }
  }

  return imageUrl
}
