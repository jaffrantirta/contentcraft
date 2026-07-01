import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { post } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { headers } from "next/headers"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id: postId } = await params

  const [postRow] = await db
    .select()
    .from(post)
    .where(and(eq(post.id, postId), eq(post.userId, session.user.id)))
    .limit(1)

  if (!postRow) return NextResponse.json({ error: "not found" }, { status: 404 })

  if (postRow.status !== "generating" && postRow.status !== "captions_done") {
    return NextResponse.json({ error: "post is not generating" }, { status: 400 })
  }

  await db.update(post).set({ status: "cancelled" }).where(eq(post.id, postId))

  return NextResponse.json({ success: true })
}
