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

  const [result] = await db.select().from(identity).where(eq(identity.userId, session.user.id)).limit(1)
  if (!result) return NextResponse.json(null)

  // Exclude heavy footerVariants from this response — use /api/footer/variants
  const { footerVariants: _fv, footerText: _ft, ...rest } = result
  return NextResponse.json(rest)
}

export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  // logo is managed via /api/upload/logo — only accept brand text fields here
  const { companyName, logoPosition, website, tagline } = body

  const [existing] = await db.select().from(identity).where(eq(identity.userId, session.user.id)).limit(1)

  if (existing) {
    await db.update(identity).set({
      companyName, logoPosition: logoPosition || "none", website, tagline,
      updatedAt: new Date(),
    }).where(eq(identity.userId, session.user.id))
  } else {
    await db.insert(identity).values({
      id: uuidv4(),
      userId: session.user.id,
      companyName, logoPosition: logoPosition || "none", website, tagline,
    })
  }

  return NextResponse.json({ success: true })
}
