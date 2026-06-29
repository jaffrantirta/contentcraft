import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) return new NextResponse("missing url", { status: 400 })

  try {
    const res = await fetch(url)
    if (!res.ok) return new NextResponse("fetch failed", { status: 502 })

    const contentType = res.headers.get("content-type") || "image/png"
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch {
    return new NextResponse("proxy error", { status: 502 })
  }
}
