import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { post, slide } from "@/lib/db/schema"
import { eq, desc, asc, inArray } from "drizzle-orm"
import { headers } from "next/headers"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const posts = await db
      .select()
      .from(post)
      .where(eq(post.userId, session.user.id))
      .orderBy(desc(post.createdAt))

    if (posts.length === 0) return NextResponse.json([])

    const slides = await db
      .select()
      .from(slide)
      .where(inArray(slide.postId, posts.map(p => p.id)))
      .orderBy(asc(slide.order))

    const result = posts.map(p => ({
      ...p,
      slides: slides.filter(s => s.postId === p.id),
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error("[posts] query failed:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "failed to load posts" }, { status: 500 })
  }
}
