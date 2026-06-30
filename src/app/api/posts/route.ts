import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { post } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
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

    // return posts with empty slides — slides load on the detail page
    return NextResponse.json(posts.map(p => ({ ...p, slides: [] })))
  } catch (err) {
    const detail = err instanceof Error
      ? { message: err.message, stack: err.stack?.slice(0, 500) }
      : String(err)
    console.error("[posts] query failed:", detail)
    return NextResponse.json({ error: "failed to load posts", detail }, { status: 500 })
  }
}
