import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { put, head } from "@vercel/blob"
import { headers } from "next/headers"

const MAX_VARIANTS = 3

export interface FooterVariant {
  id: string
  text: string
  createdAt: string
}

function blobKey(userId: string) {
  return `footer-variants/${userId}.json`
}

async function readVariants(userId: string): Promise<FooterVariant[]> {
  try {
    const blobUrl = process.env.BLOB_VARIANTS_BASE_URL
      ? `${process.env.BLOB_VARIANTS_BASE_URL}/${blobKey(userId)}`
      : null

    // try to fetch via stored URL pattern or by listing
    if (blobUrl) {
      const res = await fetch(blobUrl, { cache: "no-store" })
      if (res.ok) return await res.json()
    }

    // fallback: check blob store for the key
    const info = await head(blobKey(userId)).catch(() => null)
    if (!info) return []
    const res = await fetch(info.url, { cache: "no-store" })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

async function writeVariants(userId: string, variants: FooterVariant[]): Promise<string> {
  const { url } = await put(blobKey(userId), JSON.stringify(variants), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return url
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const variants = await readVariants(session.user.id)
  return NextResponse.json({ variants, maxVariants: MAX_VARIANTS })
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 })

  const variants = await readVariants(session.user.id)
  if (variants.length >= MAX_VARIANTS) {
    return NextResponse.json({ error: "max_variants_reached", max: MAX_VARIANTS }, { status: 400 })
  }

  const newVariant: FooterVariant = {
    id: crypto.randomUUID(),
    text: text.trim(),
    createdAt: new Date().toISOString(),
  }

  const updated = [...variants, newVariant]
  await writeVariants(session.user.id, updated)

  return NextResponse.json({ variant: newVariant, variants: updated })
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await req.json()
  const variants = await readVariants(session.user.id)
  const updated = variants.filter(v => v.id !== id)
  await writeVariants(session.user.id, updated)

  return NextResponse.json({ variants: updated })
}
