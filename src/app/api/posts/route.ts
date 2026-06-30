import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { post } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { headers } from "next/headers"
import { neon } from "@neondatabase/serverless"

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

    // use raw Neon SQL for slides — Drizzle query builder fails on the slide table
    let slideThumbs: Array<{ id: string; postId: string; imageUrl: string | null }> = []
    try {
      const sql = neon(process.env.DATABASE_URL!)
      const postIds = posts.map(p => p.id)
      const rows = await sql`
        SELECT id, post_id AS "postId", image_url AS "imageUrl"
        FROM slide
        WHERE post_id = ANY(${postIds}::text[])
      `
      slideThumbs = rows as typeof slideThumbs
    } catch (slideErr) {
      console.error("[posts] slide thumb query failed:", slideErr instanceof Error ? slideErr.message : slideErr)
    }

    const result = posts.map(p => ({
      ...p,
      slides: slideThumbs.filter(s => s.postId === p.id),
    }))

    return NextResponse.json(result)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error("[posts] query failed:", detail)
    return NextResponse.json({ error: "failed to load posts", detail }, { status: 500 })
  }
}
