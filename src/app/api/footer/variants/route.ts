import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { identity } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { v4 as uuidv4 } from "uuid"

export interface FooterVariant {
  id: string
  text: string
  createdAt: string
}

const MAX_VARIANTS = 3

async function getIdentityRow(userId: string) {
  const [row] = await db.select().from(identity).where(eq(identity.userId, userId)).limit(1)
  return row ?? null
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const row = await getIdentityRow(session.user.id)
  const variants: FooterVariant[] = row?.footerVariants ?? []
  return NextResponse.json({ variants, maxVariants: MAX_VARIANTS })
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 })

  const row = await getIdentityRow(session.user.id)
  const current: FooterVariant[] = row?.footerVariants ?? []

  if (current.length >= MAX_VARIANTS) {
    return NextResponse.json({ error: "max_variants_reached", max: MAX_VARIANTS }, { status: 400 })
  }

  const newVariant: FooterVariant = {
    id: uuidv4(),
    text: text.trim(),
    createdAt: new Date().toISOString(),
  }
  const updated = [...current, newVariant]

  if (row) {
    await db.update(identity).set({ footerVariants: updated, updatedAt: new Date() }).where(eq(identity.userId, session.user.id))
  } else {
    await db.insert(identity).values({ id: uuidv4(), userId: session.user.id, footerVariants: updated })
  }

  return NextResponse.json({ variant: newVariant, variants: updated })
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await req.json()
  const row = await getIdentityRow(session.user.id)
  const current: FooterVariant[] = row?.footerVariants ?? []
  const updated = current.filter(v => v.id !== id)

  if (row) {
    await db.update(identity).set({ footerVariants: updated, updatedAt: new Date() }).where(eq(identity.userId, session.user.id))
  }

  return NextResponse.json({ variants: updated })
}
