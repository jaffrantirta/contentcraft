"use client"

import { use, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { ArrowLeft, Copy, Download, ImageOff, Loader2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { GeneratingAnimation } from "@/components/app/generating-animation"
import { cn } from "@/lib/utils"

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
  designStyle: string
  language: string
  aspectRatio: string
  slideCount: number
  withSubject: boolean
  colorPalette: string[]
  createdAt: string
  slides: Slide[]
}

type LogoPosition = "none" | "top-left" | "top-center" | "top-right" | "footer-left" | "footer-center" | "footer-right"

interface Identity {
  companyName: string | null
  logoUrl: string | null
  logoPosition: LogoPosition
  footerText: string | null
}

function logoOverlayClass(position: LogoPosition): string {
  switch (position) {
    case "top-left":    return "top-2 left-2 justify-start"
    case "top-center":  return "top-2 left-0 right-0 justify-center"
    case "top-right":   return "top-2 right-2 justify-end"
    case "footer-left":   return "bottom-0 left-0 right-0 justify-start px-2 py-1.5 bg-black/30"
    case "footer-center": return "bottom-0 left-0 right-0 justify-center py-1.5 bg-black/30"
    case "footer-right":  return "bottom-0 left-0 right-0 justify-end px-2 py-1.5 bg-black/30"
    default: return ""
  }
}

async function getPost(id: string): Promise<Post | null> {
  const res = await fetch(`/api/posts/${id}`)
  if (!res.ok) return null
  return res.json()
}

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [generatingSlides, setGeneratingSlides] = useState<Set<string>>(new Set())
  const generationStarted = useRef(false)

  useEffect(() => {
    Promise.all([
      getPost(id),
      fetch("/api/identity").then(r => r.ok ? r.json() : null),
    ]).then(([postData, identityData]) => {
      setPost(postData)
      if (identityData) setIdentity(identityData)
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

  const downloadSlide = useCallback(async (imageUrl: string, slideNum: number) => {
    const logoUrl = identity?.logoUrl
    const logoPos = identity?.logoPosition ?? "none"

    if (!logoUrl || logoPos === "none") {
      const a = document.createElement("a")
      a.href = imageUrl
      a.download = `slide-${slideNum}.png`
      a.target = "_blank"
      a.click()
      return
    }

    try {
      const proxyUrl = (url: string) =>
        url.startsWith("data:") ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`

      const loadImg = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = src
        })

      const [base, logo] = await Promise.all([
        loadImg(proxyUrl(imageUrl)),
        loadImg(proxyUrl(logoUrl)),
      ])

      const canvas = document.createElement("canvas")
      canvas.width = base.naturalWidth
      canvas.height = base.naturalHeight
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(base, 0, 0)

      const logoH = Math.round(canvas.height * 0.09)
      const logoW = Math.round(logo.naturalWidth * (logoH / logo.naturalHeight))
      const pad = Math.round(canvas.width * 0.03)

      const isTop = logoPos.startsWith("top")
      const isFooter = logoPos.startsWith("footer")
      const side = logoPos.split("-")[1] as "left" | "center" | "right"

      let x = pad
      const y = isTop ? pad : (isFooter ? canvas.height - logoH - pad : pad)

      if (side === "center") x = (canvas.width - logoW) / 2
      if (side === "right") x = canvas.width - logoW - pad

      if (isFooter) {
        ctx.fillStyle = "rgba(0,0,0,0.25)"
        ctx.fillRect(0, canvas.height - logoH - pad * 2, canvas.width, logoH + pad * 2)
      }

      ctx.drawImage(logo, x, y, logoW, logoH)

      canvas.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `slide-${slideNum}.png`
        a.click()
        URL.revokeObjectURL(url)
      }, "image/png")
    } catch {
      // fallback: download without logo
      const a = document.createElement("a")
      a.href = imageUrl
      a.download = `slide-${slideNum}.png`
      a.target = "_blank"
      a.click()
    }
  }, [identity])

  async function handleRegenerate() {
    if (!post || regenerating) return
    setRegenerating(true)
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: post.brief,
          aspectRatio: post.aspectRatio,
          language: post.language,
          slideCount: post.slideCount,
          withSubject: post.withSubject,
          vibe: post.vibe,
          designStyle: post.designStyle,
          colorPalette: post.colorPalette,
        }),
      })

      if (res.status === 403) {
        toast.error("free limit reached — upgrade to pro or add your api key")
        router.push("/billing")
        return
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || err.error || "generation failed")
      }

      const data = await res.json()
      router.push(`/posts/${data.postId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "regeneration failed")
    } finally {
      setRegenerating(false)
    }
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
      {(isGeneratingImages || regenerating) && <GeneratingAnimation slideCount={post.slideCount} />}
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
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">{post.status}</Badge>
            <Badge variant="outline" className="text-[10px]">{post.vibe}</Badge>
            <Badge variant="outline" className="text-[10px]">{post.designStyle}</Badge>
            <Badge variant="outline" className="text-[10px]">{post.language}</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5"
            onClick={handleRegenerate}
            disabled={regenerating || isGeneratingImages}
          >
            {regenerating
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> regenerating...</>
              : <><RefreshCw className="h-3.5 w-3.5" /> regenerate</>
            }
          </Button>
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
              <div className="relative w-full h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentSlide.imageUrl}
                  alt={currentSlide.imagePrompt || "slide"}
                  className="w-full h-full object-cover"
                />
                {identity?.logoUrl && identity.logoPosition !== "none" && (
                  <div className={cn("absolute flex items-center pointer-events-none", logoOverlayClass(identity.logoPosition))}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={identity.logoUrl}
                      alt="logo"
                      className="h-8 object-contain drop-shadow-md"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                    />
                  </div>
                )}
              </div>
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
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 w-full gap-2"
              onClick={() => downloadSlide(currentSlide.imageUrl!, activeSlide + 1)}
            >
              <Download className="h-3.5 w-3.5" />
              download slide {activeSlide + 1}
              {identity?.logoUrl && identity.logoPosition !== "none" && (
                <span className="text-[10px] text-muted-foreground ml-1">+ logo</span>
              )}
            </Button>
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
