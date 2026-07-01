import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { uploadFile, deleteFile, ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/storage"
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

  const key = `subjects/${session.user.id}/${uuidv4()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const url = await uploadFile(key, buffer, file.type)

  return NextResponse.json({ url, key })
}

// Called when user removes subject image before submitting (cleanup orphaned upload)
export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { key } = await req.json() as { key: string }
  if (!key?.startsWith(`subjects/${session.user.id}/`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  await deleteFile(key)
  return NextResponse.json({ success: true })
}
