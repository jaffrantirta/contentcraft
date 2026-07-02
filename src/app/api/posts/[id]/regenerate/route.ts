import { NextRequest, NextResponse, after } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { slide, post } from "@/lib/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { headers } from "next/headers"
import { generateSlideImage } from "@/lib/generate-slide-image"
import { ASPECT_RATIOS, normalizeCustomSize } from "@/lib/tokenrouter"

export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id: postId } = await params
  const { slideIds, vibe, designStyle, colorPalette, revisionPrompt, aspectRatio, imageWidth, imageHeight } = await req.json() as {
    slideIds: string[]
    vibe?: string
    designStyle?: string
    colorPalette?: string[]
    revisionPrompt?: string
    aspectRatio?: string
    imageWidth?: number
    imageHeight?: number
  }

  if (!Array.isArray(slideIds) || slideIds.length === 0) {
    return NextResponse.json({ error: "slideIds required" }, { status: 400 })
  }

  const [postRow] = await db
    .select()
    .from(post)
    .where(and(eq(post.id, postId), eq(post.userId, session.user.id)))
    .limit(1)
  if (!postRow) return NextResponse.json({ error: "not found" }, { status: 404 })

  const slides = await db
    .select()
    .from(slide)
    .where(and(eq(slide.postId, postId), inArray(slide.id, slideIds)))

  if (slides.length === 0) {
    return NextResponse.json({ error: "no matching slides" }, { status: 400 })
  }

  // Capture old URLs for comparison, then clear them so polling detects "regenerating"
  const oldImages: Record<string, string | null> = {}
  for (const s of slides) {
    oldImages[s.id] = s.imageUrl
  }

  // Apply any style overrides to the post so the new images reflect them (and persist for future views).
  const postUpdate: Record<string, unknown> = { status: "generating" }
  if (typeof vibe === "string" && vibe) postUpdate.vibe = vibe
  if (typeof designStyle === "string" && designStyle) postUpdate.designStyle = designStyle
  if (Array.isArray(colorPalette) && colorPalette.length) postUpdate.colorPalette = colorPalette

  // Ratio/size override — regenerated slides can switch to a different ratio or a custom size.
  if (typeof aspectRatio === "string" && aspectRatio) {
    if (aspectRatio === "custom") {
      const customSize = normalizeCustomSize(imageWidth, imageHeight)
      if (!customSize) return NextResponse.json({ error: "invalid custom size" }, { status: 400 })
      postUpdate.aspectRatio = "custom"
      postUpdate.imageWidth = customSize.width
      postUpdate.imageHeight = customSize.height
    } else if (ASPECT_RATIOS.some(r => r.id === aspectRatio)) {
      postUpdate.aspectRatio = aspectRatio
      postUpdate.imageWidth = null
      postUpdate.imageHeight = null
    }
  }

  await Promise.all(
    slides.map(s => db.update(slide).set({ imageUrl: null }).where(eq(slide.id, s.id)))
  )
  await db.update(post).set(postUpdate).where(eq(post.id, postId))

  const userId = session.user.id
  const revisionNote = typeof revisionPrompt === "string" ? revisionPrompt.trim() : ""
  after(async () => {
    await Promise.all(
      slides.map(s =>
        generateSlideImage(s.id, userId, revisionNote ? { revisionNote } : undefined).catch(err =>
          console.error(`[regenerate] slide ${s.id} failed:`, err instanceof Error ? err.message : err)
        )
      )
    )
  })

  return NextResponse.json({ oldImages })
}
