import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { slide, post } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { headers } from "next/headers"
import { generateSlideImage } from "@/lib/generate-slide-image"

export const maxDuration = 120

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id: slideId } = await params

  const [slideRow] = await db.select().from(slide).where(eq(slide.id, slideId)).limit(1)
  if (!slideRow) return NextResponse.json({ error: "not found" }, { status: 404 })

  const [postRow] = await db.select().from(post).where(and(eq(post.id, slideRow.postId), eq(post.userId, session.user.id))).limit(1)
  if (!postRow) return NextResponse.json({ error: "not found" }, { status: 404 })

  const imageUrl = await generateSlideImage(slideId, session.user.id)
  if (imageUrl === null) {
    return NextResponse.json({ error: "image generation failed" }, { status: 500 })
  }

  return NextResponse.json({ imageUrl })
}
