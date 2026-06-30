import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { footerImage } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { headers } from "next/headers"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params
  const [row] = await db
    .select()
    .from(footerImage)
    .where(and(eq(footerImage.id, id), eq(footerImage.userId, session.user.id)))
    .limit(1)

  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 })

  return NextResponse.redirect(row.imageUrl, { status: 302 })
}
