import { NextRequest, NextResponse, after } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { slide, post } from "@/lib/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { headers } from "next/headers"
import { generateSlideImage } from "@/lib/generate-slide-image"

export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id: postId } = await params
  const { slideIds } = await req.json() as { slideIds: string[] }

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

  await Promise.all(
    slides.map(s => db.update(slide).set({ imageUrl: null }).where(eq(slide.id, s.id)))
  )
  await db.update(post).set({ status: "generating" }).where(eq(post.id, postId))

  const userId = session.user.id
  after(async () => {
    await Promise.all(
      slides.map(s =>
        generateSlideImage(s.id, userId).catch(err =>
          console.error(`[regenerate] slide ${s.id} failed:`, err instanceof Error ? err.message : err)
        )
      )
    )
  })

  return NextResponse.json({ oldImages })
}
