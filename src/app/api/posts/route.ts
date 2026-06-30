import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { post, slide } from "@/lib/db/schema"
import { eq, desc, asc } from "drizzle-orm"
import { headers } from "next/headers"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    // single JOIN query — avoids inArray which fails on Neon HTTP driver with many params
    const rows = await db
      .select({
        // post fields
        id: post.id,
        userId: post.userId,
        title: post.title,
        brief: post.brief,
        aspectRatio: post.aspectRatio,
        language: post.language,
        slideCount: post.slideCount,
        withSubject: post.withSubject,
        vibe: post.vibe,
        designStyle: post.designStyle,
        captionMode: post.captionMode,
        slideBriefs: post.slideBriefs,
        showFooter: post.showFooter,
        colorPalette: post.colorPalette,
        status: post.status,
        errorMessage: post.errorMessage,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        // slide fields (nullable — leftJoin means no slides returns null)
        slideId: slide.id,
        slidePostId: slide.postId,
        slideImageUrl: slide.imageUrl,
        slideCaption: slide.caption,
        slideHashtags: slide.hashtags,
        slideCreatedAt: slide.createdAt,
      })
      .from(post)
      .leftJoin(slide, eq(slide.postId, post.id))
      .where(eq(post.userId, session.user.id))
      .orderBy(desc(post.createdAt), asc(slide.createdAt))

    // aggregate rows into posts with slides array
    const postMap = new Map<string, { slides: Array<{ id: string; imageUrl: string | null }> } & Record<string, unknown>>()
    for (const row of rows) {
      if (!postMap.has(row.id)) {
        postMap.set(row.id, {
          id: row.id, userId: row.userId, title: row.title, brief: row.brief,
          aspectRatio: row.aspectRatio, language: row.language, slideCount: row.slideCount,
          withSubject: row.withSubject, vibe: row.vibe, designStyle: row.designStyle,
          captionMode: row.captionMode, slideBriefs: row.slideBriefs, showFooter: row.showFooter,
          colorPalette: row.colorPalette, status: row.status, errorMessage: row.errorMessage,
          createdAt: row.createdAt, updatedAt: row.updatedAt,
          slides: [],
        })
      }
      if (row.slideId) {
        postMap.get(row.id)!.slides.push({ id: row.slideId, imageUrl: row.slideImageUrl })
      }
    }

    return NextResponse.json(Array.from(postMap.values()))
  } catch (err) {
    console.error("[posts] query failed:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "failed to load posts" }, { status: 500 })
  }
}
