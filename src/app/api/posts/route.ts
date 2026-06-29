import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { post, slide } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { headers } from "next/headers"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const posts = await db.query.post.findMany({
    where: eq(post.userId, session.user.id),
    orderBy: desc(post.createdAt),
    with: { slides: { orderBy: slide.order } },
  })

  return NextResponse.json(posts)
}
