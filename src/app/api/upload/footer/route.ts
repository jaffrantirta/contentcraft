import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { identity, footerImage, userSettings } from "@/lib/db/schema"
import { uploadFile, ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/storage"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { v4 as uuidv4 } from "uuid"

const PLAN_LIMITS: Record<string, number> = { free: 1, byok: 1, pro: 5 }

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const brief = (formData.get("brief") as string | null)?.trim() || ""

  if (!file) return NextResponse.json({ error: "no file provided" }, { status: 400 })

  const ext = ALLOWED_IMAGE_TYPES[file.type]
  if (!ext) return NextResponse.json({ error: "unsupported file type" }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "file too large (max 5MB)" }, { status: 400 })

  const [settingsRow, identityRow] = await Promise.all([
    db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).limit(1).then(r => r[0] ?? null),
    db.select().from(identity).where(eq(identity.userId, session.user.id)).limit(1).then(r => r[0] ?? null),
  ])

  const plan = settingsRow?.plan ?? "free"
  const limit = PLAN_LIMITS[plan] ?? 1
  const currentVariants: { id: string; brief: string; createdAt: string }[] = identityRow?.footerVariants ?? []

  if (currentVariants.length >= limit) {
    return NextResponse.json({ error: "limit_reached", limit, plan }, { status: 400 })
  }

  const id = uuidv4()
  const key = `footers/${session.user.id}/${id}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const url = await uploadFile(key, buffer, file.type)

  await db.insert(footerImage).values({ id, userId: session.user.id, imageUrl: url, storageKey: key, brief })

  const newMeta = { id, brief, createdAt: new Date().toISOString() }
  const updatedVariants = [...currentVariants, newMeta]
  const isFirst = currentVariants.length === 0

  if (identityRow) {
    await db.update(identity).set({
      footerVariants: updatedVariants,
      activeFooterVariantId: isFirst ? id : identityRow.activeFooterVariantId,
      updatedAt: new Date(),
    }).where(eq(identity.userId, session.user.id))
  } else {
    await db.insert(identity).values({
      id: uuidv4(),
      userId: session.user.id,
      footerVariants: updatedVariants,
      activeFooterVariantId: id,
    })
  }

  return NextResponse.json({
    variant: newMeta,
    variants: updatedVariants,
    activeId: isFirst ? id : (identityRow?.activeFooterVariantId ?? null),
    imageUrl: url,
  })
}
