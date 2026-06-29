import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { slide, post, userSettings } from "@/lib/db/schema"
import { getTokenRouterClient, DEFAULT_IMAGE_MODEL } from "@/lib/tokenrouter"
import { eq, and } from "drizzle-orm"
import { headers } from "next/headers"

export const maxDuration = 120

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id: slideId } = await params

  // verify ownership via post
  const slideRow = await db.query.slide.findFirst({
    where: eq(slide.id, slideId),
    with: { post: true },
  })

  if (!slideRow || slideRow.post.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  if (!slideRow.imagePrompt) {
    return NextResponse.json({ error: "no image prompt" }, { status: 400 })
  }

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.user.id),
  })

  const isByok = settings?.plan === "byok" && settings.byokApiKey
  const client = getTokenRouterClient(isByok
    ? { apiKey: settings.byokApiKey!, baseURL: settings.byokBaseUrl || undefined }
    : {}
  )
  const imageModel = (isByok && settings?.byokModel) ? settings.byokModel : DEFAULT_IMAGE_MODEL

  let imageUrl: string | null = null

  try {
    const imgRes = await client.images.generate({
      model: imageModel,
      prompt: slideRow.imagePrompt,
      size: "1024x1024",
      n: 1,
    })
    const imgData = imgRes.data?.[0]
    if (imgData?.url) {
      imageUrl = imgData.url
    } else if (imgData?.b64_json) {
      imageUrl = `data:image/png;base64,${imgData.b64_json}`
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`image gen failed for slide ${slideId}:`, msg)
    return NextResponse.json({ error: "image generation failed", detail: msg }, { status: 500 })
  }

  await db.update(slide).set({ imageUrl }).where(eq(slide.id, slideId))

  // check if all slides in this post now have images — if so, mark post done
  const allSlides = await db.query.slide.findMany({ where: eq(slide.postId, slideRow.postId) })
  const allDone = allSlides.every(s => s.id === slideId ? true : s.imageUrl !== null)
  if (allDone) {
    await db.update(post).set({ status: "done" }).where(eq(post.id, slideRow.postId))
  }

  return NextResponse.json({ imageUrl })
}
