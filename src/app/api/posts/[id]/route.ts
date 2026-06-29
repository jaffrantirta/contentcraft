import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { post, slide } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { headers } from "next/headers"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params
  const result = await db.query.post.findFirst({
    where: and(eq(post.id, id), eq(post.userId, session.user.id)),
    with: { slides: { orderBy: slide.order } },
  })

  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(result)
}
