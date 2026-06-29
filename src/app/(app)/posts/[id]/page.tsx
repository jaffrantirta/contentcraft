"use client"

import { use, useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { ArrowLeft, Copy, Download, ImageOff } from "lucide-react"
import Link from "next/link"
import { GeneratingAnimation } from "@/components/app/generating-animation"

interface Slide {
  id: string
  order: number
  imageUrl: string | null
  imagePrompt: string | null
  caption: string | null
  hashtags: string | null
}

interface Post {
  id: string
  title: string
  brief: string
  status: string
  vibe: string
  language: string
  aspectRatio: string
  slideCount: number
  withSubject: boolean
  createdAt: string
  slides: Slide[]
}

async function getPost(id: string): Promise<Post | null> {
  const res = await fetch(`/api/posts/${id}`)
  if (!res.ok) return null
  return res.json()
}

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSlide, setActiveSlide] = useState(0)
  const [generatingSlides, setGeneratingSlides] = useState<Set<string>>(new Set())
  const generationStarted = useRef(false)

  useEffect(() => {
    getPost(id).then(data => {
      setPost(data)
    }).finally(() => setLoading(false))
  }, [id])

  // trigger per-slide image generation when captions are ready
  useEffect(() => {
    if (!post || generationStarted.current) return
    const pendingSlides = post.slides.filter(s => !s.imageUrl && s.imagePrompt)
    if (pendingSlides.length === 0) return
    if (post.status !== "captions_done" && post.status !== "generating") return

    generationStarted.current = true
    setGeneratingSlides(new Set(pendingSlides.map(s => s.id)))

    pendingSlides.forEach(async (s) => {
      try {
        const res = await fetch(`/api/slides/${s.id}/image`, { method: "POST" })
        if (res.ok) {
          const { imageUrl } = await res.json()
          setPost(prev => {
            if (!prev) return prev
            const updatedSlides = prev.slides.map(sl =>
              sl.id === s.id ? { ...sl, imageUrl } : sl
            )
            const allDone = updatedSlides.every(sl => sl.imageUrl)
            return { ...prev, slides: updatedSlides, status: allDone ? "done" : prev.status }
          })
        } else {
          const err = await res.json().catch(() => ({}))
          toast.error(`slide ${s.order + 1} image failed: ${err.detail || "unknown error"}`)
        }
      } catch {
        toast.error(`slide ${s.order + 1} image generation failed`)
      } finally {
        setGeneratingSlides(prev => {
          const next = new Set(prev)
          next.delete(s.id)
          return next
        })
      }
    })
  }, [post?.status, post?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function copyCaption(caption: string | null, hashtags: string | null) {
    const text = [caption, hashtags].filter(Boolean).join("\n\n")
    navigator.clipboard.writeText(text)
    toast.success("copied to clipboard")
  }

  if (loading) return (
    <div className="space-y-4 max-w-4xl">
      <div className="h-8 w-48 rounded bg-muted animate-pulse" />
      <div className="grid grid-cols-2 gap-6">
        <div className="aspect-square rounded-xl bg-muted animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
        </div>
      </div>
    </div>
  )

  if (!post) return (
    <div className="text-center py-16 space-y-3">
      <p className="text-sm text-muted-foreground">post not found</p>
      <Link href="/posts"><Button variant="outline" size="sm" className="text-xs">back to posts</Button></Link>
    </div>
  )

  const isGeneratingImages = generatingSlides.size > 0
  const currentSlide = post.slides?.[activeSlide]
  const currentSlideGenerating = currentSlide ? generatingSlides.has(currentSlide.id) : false

  return (
    <>
      {isGeneratingImages && <GeneratingAnimation slideCount={post.slideCount} />}
      <div className="space-y-4 md:space-y-6 max-w-5xl pb-8">
      {/* header */}
      <div className="flex items-center gap-3">
        <Link href="/posts">
          <Button variant="ghost" size="sm" className="text-xs h-8 gap-1.5 shrink-0">
            <ArrowLeft className="h-3.5 w-3.5" /> back
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base md:text-lg font-bold tracking-tight truncate">{post.title || post.brief}</h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-[10px]">{post.status}</Badge>
          <Badge variant="outline" className="text-[10px]">{post.vibe}</Badge>
          <Badge variant="outline" className="text-[10px]">{post.language}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* image area */}
        <div className="space-y-4">
          <div className="aspect-square rounded-xl overflow-hidden bg-muted flex items-center justify-center border border-border/60">
            {currentSlideGenerating ? (
              <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                  <p className="text-xs text-muted-foreground">generating image...</p>
                </div>
              </div>
            ) : currentSlide?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentSlide.imageUrl}
                alt={currentSlide.imagePrompt || "slide"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center space-y-2">
                <ImageOff className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground">image unavailable</p>
              </div>
            )}
          </div>

          {/* slide thumbnails */}
          {post.slides.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {post.slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSlide(i)}
                  className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                    activeSlide === i ? "border-primary" : "border-border/40 hover:border-border"
                  }`}
                >
                  {generatingSlides.has(s.id) ? (
                    <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full border border-primary border-t-transparent animate-spin" />
                    </div>
                  ) : s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground">{i + 1}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* download */}
          {currentSlide?.imageUrl && !currentSlideGenerating && (
            <a href={currentSlide.imageUrl} download={`slide-${activeSlide + 1}.png`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="text-xs h-8 w-full gap-2">
                <Download className="h-3.5 w-3.5" />
                download slide {activeSlide + 1}
              </Button>
            </a>
          )}
        </div>

        {/* captions */}
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              slide {activeSlide + 1} of {post.slides.length}
              {isGeneratingImages && (
                <span className="ml-2 text-primary">
                  · {generatingSlides.size} image{generatingSlides.size !== 1 ? "s" : ""} generating
                </span>
              )}
            </p>
            <h2 className="text-sm font-semibold">caption</h2>
          </div>

          <Card className="p-4 space-y-3">
            <p className="text-sm leading-relaxed">{currentSlide?.caption || "no caption generated"}</p>
            {currentSlide?.hashtags && (
              <>
                <Separator />
                <p className="text-xs text-muted-foreground font-mono">{currentSlide.hashtags}</p>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-2 w-full"
              onClick={() => copyCaption(currentSlide?.caption || null, currentSlide?.hashtags || null)}
            >
              <Copy className="h-3.5 w-3.5" />
              copy caption + hashtags
            </Button>
          </Card>

          {currentSlide?.imagePrompt && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">image prompt used</p>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">
                {currentSlide.imagePrompt}
              </p>
            </div>
          )}

          {/* all captions */}
          {post.slides.length > 1 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium">all captions</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {post.slides.map((s, i) => (
                  <div key={s.id} className="p-3 rounded-lg bg-muted/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground font-medium">
                        slide {i + 1}
                        {generatingSlides.has(s.id) && <span className="ml-1 text-primary">· generating...</span>}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => copyCaption(s.caption, s.hashtags)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs line-clamp-2">{s.caption}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
