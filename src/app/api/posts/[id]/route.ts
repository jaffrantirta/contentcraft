import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { post, slide } from "@/lib/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { headers } from "next/headers"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params

  try {
    const [postRow] = await db
      .select()
      .from(post)
      .where(and(eq(post.id, id), eq(post.userId, session.user.id)))
      .limit(1)

    if (!postRow) return NextResponse.json({ error: "not found" }, { status: 404 })

    const slides = await db
      .select()
      .from(slide)
      .where(eq(slide.postId, id))
      .orderBy(asc(slide.createdAt))

    return NextResponse.json({ ...postRow, slides })
  } catch (err) {
    console.error("[post] query failed:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "failed to load post" }, { status: 500 })
  }
}
