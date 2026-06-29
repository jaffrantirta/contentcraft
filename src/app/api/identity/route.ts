import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { identity } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { headers } from "next/headers"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const result = await db.query.identity.findFirst({ where: eq(identity.userId, session.user.id) })
  return NextResponse.json(result || null)
}

export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const { companyName, logoUrl, footerText, website, tagline } = body

  const existing = await db.query.identity.findFirst({ where: eq(identity.userId, session.user.id) })

  if (existing) {
    await db.update(identity).set({
      companyName, logoUrl, footerText, website, tagline,
      updatedAt: new Date(),
    }).where(eq(identity.userId, session.user.id))
  } else {
    await db.insert(identity).values({
      id: uuidv4(),
      userId: session.user.id,
      companyName, logoUrl, footerText, website, tagline,
    })
  }

  return NextResponse.json({ success: true })
}
