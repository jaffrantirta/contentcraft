import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { identity, footerImage, userSettings } from "@/lib/db/schema"
import { getTokenRouterClient, DEFAULT_IMAGE_MODEL } from "@/lib/tokenrouter"
import { uploadFile } from "@/lib/storage"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { v4 as uuidv4 } from "uuid"

const PLAN_LIMITS: Record<string, number> = { free: 1, byok: 1, pro: 5 }

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { brief, save } = await req.json()
  if (!brief?.trim()) return NextResponse.json({ error: "brief is required" }, { status: 400 })

  const [identityRow, settingsRow] = await Promise.all([
    db.select().from(identity).where(eq(identity.userId, session.user.id)).limit(1).then(r => r[0] ?? null),
    db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).limit(1).then(r => r[0] ?? null),
  ])

  // Limit check (only enforce when saving)
  if (save) {
    const plan = settingsRow?.plan ?? "free"
    const limit = PLAN_LIMITS[plan] ?? 1
    const current: unknown[] = identityRow?.footerVariants ?? []
    if (current.length >= limit) {
      return NextResponse.json({ error: "limit_reached", limit, plan }, { status: 400 })
    }
  }

  const brandParts = [
    identityRow?.companyName && `Brand: ${identityRow.companyName}`,
    identityRow?.tagline && `Tagline: ${identityRow.tagline}`,
    identityRow?.website && `Website: ${identityRow.website}`,
  ].filter(Boolean)

  const isByok = settingsRow?.plan === "byok" && settingsRow?.byokApiKey
  const client = getTokenRouterClient(
    isByok ? { apiKey: settingsRow!.byokApiKey!, baseURL: settingsRow!.byokBaseUrl || undefined } : {}
  )
  const imageModel = isByok && settingsRow?.byokModel ? settingsRow.byokModel : DEFAULT_IMAGE_MODEL

  const prompt = [
    "Design a professional horizontal footer banner strip for a social media carousel slide.",
    `User brief: ${brief.trim()}`,
    ...brandParts,
    "IMPORTANT: The design will be cropped to a very wide, thin horizontal strip (approximately 6:1 width-to-height ratio). Place ALL key design elements — brand name, social handle, website, CTA — in the TOP THIRD of the image only. The bottom two-thirds will be cropped out. Keep the layout wide and flat, not tall or centered.",
    "Clean background, elegant typography, no extra white borders. High quality, Instagram-ready.",
  ].join("\n")

  try {
    const imgRes = await client.images.generate({
      model: imageModel,
      prompt,
      size: "1536x1024",
      n: 1,
    })

    const imgData = imgRes.data?.[0]
    let pngBuffer: Buffer | null = null
    let previewUrl: string | null = null

    if (imgData?.b64_json) {
      pngBuffer = Buffer.from(imgData.b64_json, "base64")
    } else if (imgData?.url) {
      const resp = await fetch(imgData.url)
      pngBuffer = Buffer.from(await resp.arrayBuffer())
      if (!save) previewUrl = imgData.url // keep original URL for preview only
    }

    if (!pngBuffer) return NextResponse.json({ error: "no image returned" }, { status: 500 })

    if (!save) {
      // Preview mode: return base64 data URL, do not persist
      const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`
      return NextResponse.json({ imageDataUrl: dataUrl, preview: true })
    }

    // Save mode: upload to S3 and persist
    const id = uuidv4()
    const key = `footers/${session.user.id}/${id}.png`
    const url = await uploadFile(key, pngBuffer, "image/png")

    await db.insert(footerImage).values({
      id,
      userId: session.user.id,
      imageUrl: url,
      storageKey: key,
      brief: brief.trim(),
    })

    const currentVariants: { id: string; brief: string; createdAt: string }[] = identityRow?.footerVariants ?? []
    const newMeta = { id, brief: brief.trim(), createdAt: new Date().toISOString() }
    const updatedVariants = [...currentVariants, newMeta]
    const isFirst = currentVariants.length === 0

    if (identityRow) {
      await db.update(identity).set({
        footerVariants: updatedVariants,
        activeFooterVariantId: isFirst ? id : identityRow.activeFooterVariantId,
        updatedAt: new Date(),
      }).where(eq(identity.userId, session.user.id))
    } else {
      await db.insert(identity).values({
        id: uuidv4(),
        userId: session.user.id,
        footerVariants: updatedVariants,
        activeFooterVariantId: id,
      })
    }

    return NextResponse.json({
      imageUrl: url,
      variant: newMeta,
      variants: updatedVariants,
      activeId: isFirst ? id : (identityRow?.activeFooterVariantId ?? null),
    })
  } catch (err) {
    console.error("[footer/generate-image]", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "generation failed" }, { status: 500 })
  }
}
