import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { identity } from "@/lib/db/schema"
import { uploadFile, deleteFile, ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/storage"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { v4 as uuidv4 } from "uuid"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "no file provided" }, { status: 400 })

  const ext = ALLOWED_IMAGE_TYPES[file.type]
  if (!ext) return NextResponse.json({ error: "unsupported file type" }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "file too large (max 5MB)" }, { status: 400 })

  const [existing] = await db.select().from(identity).where(eq(identity.userId, session.user.id)).limit(1)

  // delete old logo from storage if it exists
  if (existing?.logoStorageKey) {
    await deleteFile(existing.logoStorageKey)
  }

  const key = `logos/${session.user.id}/${uuidv4()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const url = await uploadFile(key, buffer, file.type)

  if (existing) {
    await db.update(identity).set({
      logoUrl: url,
      logoStorageKey: key,
      updatedAt: new Date(),
    }).where(eq(identity.userId, session.user.id))
  } else {
    await db.insert(identity).values({
      id: uuidv4(),
      userId: session.user.id,
      logoUrl: url,
      logoStorageKey: key,
    })
  }

  return NextResponse.json({ url })
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const [existing] = await db.select().from(identity).where(eq(identity.userId, session.user.id)).limit(1)
  if (!existing) return NextResponse.json({ success: true })

  if (existing.logoStorageKey) {
    await deleteFile(existing.logoStorageKey)
  }

  await db.update(identity).set({
    logoUrl: null,
    logoStorageKey: null,
    logoPosition: "none",
    updatedAt: new Date(),
  }).where(eq(identity.userId, session.user.id))

  return NextResponse.json({ success: true })
}
