import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { identity, footerImage, userSettings } from "@/lib/db/schema"
import { deleteFile } from "@/lib/storage"
import { eq, and } from "drizzle-orm"
import { headers } from "next/headers"
import { v4 as uuidv4 } from "uuid"

export interface FooterVariantMeta {
  id: string
  brief: string
  createdAt: string
}

const PLAN_LIMITS: Record<string, number> = { free: 1, byok: 1, pro: 5 }

async function getRows(userId: string) {
  const [identityRow, settingsRow] = await Promise.all([
    db.select().from(identity).where(eq(identity.userId, userId)).limit(1).then(r => r[0] ?? null),
    db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1).then(r => r[0] ?? null),
  ])
  return { identityRow, settingsRow }
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { identityRow, settingsRow } = await getRows(session.user.id)
  const plan = settingsRow?.plan ?? "free"
  const variants: FooterVariantMeta[] = identityRow?.footerVariants ?? []

  // Enrich with imageUrl from footer_image table
  const imageRows = await db.select().from(footerImage).where(eq(footerImage.userId, session.user.id))
  const imageMap = new Map(imageRows.map(r => [r.id, r.imageUrl]))

  return NextResponse.json({
    variants: variants.map(v => ({ ...v, imageUrl: imageMap.get(v.id) ?? null })),
    activeId: identityRow?.activeFooterVariantId ?? null,
    limit: PLAN_LIMITS[plan] ?? 1,
    plan,
  })
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await req.json()
  const { identityRow } = await getRows(session.user.id)
  if (!identityRow) return NextResponse.json({ error: "not found" }, { status: 404 })

  const current: FooterVariantMeta[] = identityRow.footerVariants ?? []
  const updated = current.filter(v => v.id !== id)
  const newActive = identityRow.activeFooterVariantId === id
    ? (updated[0]?.id ?? null)
    : identityRow.activeFooterVariantId

  // delete image from S3
  const [imgRow] = await db
    .select()
    .from(footerImage)
    .where(and(eq(footerImage.id, id), eq(footerImage.userId, session.user.id)))
    .limit(1)
  if (imgRow?.storageKey) await deleteFile(imgRow.storageKey)

  await Promise.all([
    db.delete(footerImage).where(and(eq(footerImage.id, id), eq(footerImage.userId, session.user.id))),
    db.update(identity).set({
      footerVariants: updated,
      activeFooterVariantId: newActive,
      updatedAt: new Date(),
    }).where(eq(identity.userId, session.user.id)),
  ])

  return NextResponse.json({ variants: updated, activeId: newActive })
}

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await req.json()
  const [identityRow] = await db.select().from(identity).where(eq(identity.userId, session.user.id)).limit(1)
  if (!identityRow) return NextResponse.json({ error: "not found" }, { status: 404 })

  const variants: FooterVariantMeta[] = identityRow.footerVariants ?? []
  if (id !== null && !variants.find(v => v.id === id)) {
    return NextResponse.json({ error: "variant not found" }, { status: 404 })
  }

  await db.update(identity).set({
    activeFooterVariantId: id,
    updatedAt: new Date(),
  }).where(eq(identity.userId, session.user.id))

  return NextResponse.json({ activeId: id })
}

// Keep POST for any future use but redirect uploads to /api/upload/footer
export async function POST(req: NextRequest) {
  // Proxy to upload/footer logic for AI-generated saves — use /api/footer/generate-image with save:true instead
  return NextResponse.json({ error: "use /api/upload/footer for uploads or /api/footer/generate-image with save:true" }, { status: 400 })
}

// This route also needs to create an identity row when first activated
async function ensureIdentity(userId: string) {
  const [row] = await db.select().from(identity).where(eq(identity.userId, userId)).limit(1)
  if (!row) {
    await db.insert(identity).values({ id: uuidv4(), userId })
  }
}
void ensureIdentity // suppress unused warning
