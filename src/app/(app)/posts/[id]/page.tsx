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
  captionMode: string
  slideBriefs: string[]
  showFooter: boolean
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
  activeFooterVariantId: string | null
  activeFooterImageUrl: string | null
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
  const [plan, setPlan] = useState<string>("free")
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [dlWithLogo, setDlWithLogo] = useState(true)
  const [dlWithFooter, setDlWithFooter] = useState(true)
  const [footerAspect, setFooterAspect] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    Promise.all([
      getPost(id),
      fetch("/api/identity").then(r => r.ok ? r.json() : null),
      fetch("/api/settings").then(r => r.ok ? r.json() : null),
    ]).then(([postData, identityData, settingsData]) => {
      setPost(postData)
      if (identityData) setIdentity(identityData)
      if (settingsData?.plan) setPlan(settingsData.plan)
    }).finally(() => setLoading(false))
  }, [id])

  // poll for updated slide images while post is still generating
  useEffect(() => {
    if (!post) return
    const isPending = post.status === "captions_done" || post.status === "generating"
    const hasUnfinished = post.slides.some(s => !s.imageUrl)
    if (!isPending && !hasUnfinished) return

    pollRef.current = setTimeout(async () => {
      const fresh = await getPost(id)
      if (fresh) setPost(fresh)
    }, 4000)

    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [post, id])

  // reset footer aspect when active footer changes (new image will re-set it on load)
  useEffect(() => { setFooterAspect(null) }, [identity?.activeFooterVariantId])

  // derived: which slides are still pending
  const generatingSlides = new Set(
    (post?.slides ?? []).filter(s => !s.imageUrl).map(s => s.id)
  )
  const isGeneratingImages = post?.status !== "done" && generatingSlides.size > 0

  function copyCaption(caption: string | null, hashtags: string | null) {
    const text = [caption, hashtags].filter(Boolean).join("\n\n")
    navigator.clipboard.writeText(text)
    toast.success("copied to clipboard")
  }

  const downloadSlide = useCallback(async (
    imageUrl: string,
    slideNum: number,
    caption: string | null,
    opts: { withLogo: boolean; withFooter: boolean },
  ) => {
    const logoUrl = identity?.logoUrl
    const logoPos = identity?.logoPosition ?? "none"
    const activeFooterImageUrl = identity?.activeFooterImageUrl ?? null
    const showCaption = post?.captionMode === "per_slide" && caption

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

      const toLoad: Promise<HTMLImageElement | null>[] = [loadImg(proxyUrl(imageUrl))]
      if (opts.withLogo && logoUrl && logoPos !== "none") toLoad.push(loadImg(proxyUrl(logoUrl)))
      else toLoad.push(Promise.resolve(null))
      if (opts.withFooter && activeFooterImageUrl) toLoad.push(loadImg(proxyUrl(activeFooterImageUrl)))
      else toLoad.push(Promise.resolve(null))

      const [base, logo, footerImg] = await Promise.all(toLoad) as [HTMLImageElement, HTMLImageElement | null, HTMLImageElement | null]

      const canvas = document.createElement("canvas")
      canvas.width = base.naturalWidth
      canvas.height = base.naturalHeight
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(base, 0, 0)

      const pad = Math.round(canvas.width * 0.05)

      // footer image — pure ratio: scale to canvas width, show entire image at natural proportions
      if (footerImg) {
        const fH = Math.round((footerImg.naturalHeight / footerImg.naturalWidth) * canvas.width)
        ctx.drawImage(footerImg, 0, canvas.height - fH, canvas.width, fH)
      }

      // caption text overlay
      if (showCaption) {
        const fontSize = Math.round(canvas.width * 0.048)
        const lineH = fontSize * 1.4
        ctx.font = `700 ${fontSize}px system-ui, sans-serif`
        const maxW = canvas.width - pad * 2
        const words = caption!.split(" ")
        const lines: string[] = []
        let line = ""
        for (const w of words) {
          const test = line ? `${line} ${w}` : w
          if (ctx.measureText(test).width > maxW && line) {
            lines.push(line); if (lines.length >= 5) break; line = w
          } else { line = test }
        }
        if (line && lines.length < 5) lines.push(line)

        const gradH = lines.length * lineH + pad * 2.5
        const grad = ctx.createLinearGradient(0, canvas.height - gradH, 0, canvas.height)
        grad.addColorStop(0, "rgba(0,0,0,0)")
        grad.addColorStop(0.4, "rgba(0,0,0,0.65)")
        grad.addColorStop(1, "rgba(0,0,0,0.88)")
        ctx.fillStyle = grad
        ctx.fillRect(0, canvas.height - gradH, canvas.width, gradH)

        ctx.fillStyle = "#ffffff"
        ctx.shadowColor = "rgba(0,0,0,0.7)"
        ctx.shadowBlur = 12
        ctx.textAlign = "left"
        ctx.textBaseline = "bottom"
        lines.forEach((l, i) => {
          ctx.fillText(l, pad, canvas.height - pad - (lines.length - 1 - i) * lineH)
        })
        ctx.shadowBlur = 0
      }

      // logo overlay
      if (logo && logoPos !== "none") {
        const lPad = Math.round(canvas.width * 0.03)
        const logoH = Math.round(canvas.height * 0.08)
        const logoW = Math.round(logo.naturalWidth * (logoH / logo.naturalHeight))
        const isTop = logoPos.startsWith("top")
        const side = logoPos.split("-")[1] as "left" | "center" | "right"
        let lx = lPad
        const ly = isTop ? lPad : canvas.height - logoH - lPad
        if (side === "center") lx = (canvas.width - logoW) / 2
        if (side === "right") lx = canvas.width - logoW - lPad
        ctx.drawImage(logo, lx, ly, logoW, logoH)
      }

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
      const a = document.createElement("a")
      a.href = imageUrl
      a.download = `slide-${slideNum}.png`
      a.target = "_blank"
      a.click()
    }
  }, [identity, post])

  async function handleRegenerate() {
    if (!post || regenerating) return
    setRegenerating(true)
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: post.brief,
          slideBriefs: post.slideBriefs,
          aspectRatio: post.aspectRatio,
          language: post.language,
          slideCount: post.slideCount,
          withSubject: post.withSubject,
          vibe: post.vibe,
          designStyle: post.designStyle,
          captionMode: post.captionMode,
          showFooter: post.showFooter,
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

      {/* image expiry warning for free/byok users */}
      {(plan === "free" || plan === "byok") && post.status === "done" && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/8 px-4 py-2.5 flex items-start gap-2.5">
          <span className="text-yellow-500 text-xs mt-0.5 shrink-0">⚠</span>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 leading-relaxed">
            <span className="font-medium">images may expire soon</span> — AI-generated images are not stored on your plan.
            Download your slides now. <Link href="/billing" className="underline underline-offset-2">upgrade to Pro</Link> to store images for 30 days.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* image area */}
        <div className="space-y-4">
          <div
            style={{ containerType: "inline-size" }}
            className={cn(
              "rounded-xl overflow-hidden bg-muted flex items-center justify-center border border-border/60",
              post.aspectRatio === "16:9" ? "aspect-video" :
              post.aspectRatio === "4:5"  ? "aspect-[4/5]" :
              post.aspectRatio === "9:16" ? "aspect-[9/16]" :
              "aspect-square"
            )}>
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

                {/* footer image overlay — height driven by footer image's own aspect ratio */}
                {identity?.activeFooterVariantId && (
                  <div
                    className="absolute bottom-0 left-0 right-0 pointer-events-none"
                    style={footerAspect ? { aspectRatio: footerAspect } : { height: "18%" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/footer/images/${identity.activeFooterVariantId}`}
                      alt="footer"
                      className="w-full h-full block"
                      onLoad={e => {
                        const img = e.currentTarget
                        setFooterAspect(`${img.naturalWidth} / ${img.naturalHeight}`)
                      }}
                    />
                  </div>
                )}

                {/* logo overlay */}
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
                  className={cn(
                    "shrink-0 rounded-lg overflow-hidden border-2 transition-colors",
                    post.aspectRatio === "16:9" ? "w-20 h-[45px]" :
                    post.aspectRatio === "4:5"  ? "w-11 h-[55px]" :
                    post.aspectRatio === "9:16" ? "w-8 h-[57px]" :
                    "w-14 h-14",
                    activeSlide === i ? "border-primary" : "border-border/40 hover:border-border"
                  )}
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
            <div className="space-y-2">
              {/* overlay options */}
              {(identity?.logoUrl && identity.logoPosition !== "none" || identity?.activeFooterVariantId) && (
                <div className="flex items-center gap-4 px-1">
                  <p className="text-[10px] text-muted-foreground shrink-0">include:</p>
                  {identity?.logoUrl && identity.logoPosition !== "none" && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={dlWithLogo}
                        onChange={e => setDlWithLogo(e.target.checked)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <span className="text-[11px] text-muted-foreground">logo</span>
                    </label>
                  )}
                  {identity?.activeFooterVariantId && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={dlWithFooter}
                        onChange={e => setDlWithFooter(e.target.checked)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <span className="text-[11px] text-muted-foreground">footer</span>
                    </label>
                  )}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 w-full gap-2"
                onClick={() => downloadSlide(
                  currentSlide.imageUrl!,
                  activeSlide + 1,
                  currentSlide.caption,
                  { withLogo: dlWithLogo, withFooter: dlWithFooter },
                )}
              >
                <Download className="h-3.5 w-3.5" />
                download slide {activeSlide + 1}
              </Button>
            </div>
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
            {post.captionMode !== "none" && (
              <h2 className="text-sm font-semibold">
                {post.captionMode === "single" ? "caption" : "caption"}
              </h2>
            )}
          </div>

          {post.captionMode === "none" ? (
            <p className="text-xs text-muted-foreground">no caption — pure visual slides</p>
          ) : (
            <Card className="p-4 space-y-3">
              {post.captionMode === "single" && (
                <p className="text-[10px] text-muted-foreground">single caption (same for all slides)</p>
              )}
              <p className="text-sm leading-relaxed">{currentSlide?.caption || "—"}</p>
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
          )}

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
