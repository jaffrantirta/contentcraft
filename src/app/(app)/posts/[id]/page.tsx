"use client"

import { use, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Copy, Download, ImageOff, Loader2, RefreshCw, X } from "lucide-react"
import Link from "next/link"
import { GeneratingAnimation } from "@/components/app/generating-animation"
import { VIBES, DESIGN_STYLES, ASPECT_RATIOS, CUSTOM_SIZE_MIN, CUSTOM_SIZE_MAX } from "@/lib/tokenrouter"
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
  imageWidth: number | null
  imageHeight: number | null
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

function statusDotClass(status: string): string {
  switch (status) {
    case "done":       return "bg-green-500"
    case "error":      return "bg-destructive"
    case "cancelled":  return "bg-muted-foreground"
    default:           return "bg-primary animate-pulse" // generating / captions_done
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "done":       return "border-green-500/40 text-green-600 dark:text-green-400"
    case "error":      return "border-destructive/40 text-destructive"
    case "cancelled":  return "border-border text-muted-foreground"
    default:           return "border-primary/40 text-primary"
  }
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

// CSS aspect-ratio for the post's target size (preset or custom)
function postAspectStyle(p: Pick<Post, "aspectRatio" | "imageWidth" | "imageHeight">): React.CSSProperties {
  if (p.aspectRatio === "custom" && p.imageWidth && p.imageHeight) {
    return { aspectRatio: `${p.imageWidth} / ${p.imageHeight}` }
  }
  const preset = ASPECT_RATIOS.find(r => r.id === p.aspectRatio)
  return { aspectRatio: preset ? `${preset.width} / ${preset.height}` : "1 / 1" }
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
  const [activeSlide, setActiveSlide] = useState(0)
  const [dlWithLogo, setDlWithLogo] = useState(true)
  const [dlWithFooter, setDlWithFooter] = useState(true)
  const [footerAspect, setFooterAspect] = useState<string | null>(null)
  // regenerate state
  const [showRegenPanel, setShowRegenPanel] = useState(false)
  const [regenSelected, setRegenSelected] = useState<Set<string>>(new Set())
  const [regenning, setRegenning] = useState(false)
  const [regenVibe, setRegenVibe] = useState<string>("professional")
  const [regenStyle, setRegenStyle] = useState<string>("realistic")
  const [regenRatio, setRegenRatio] = useState<string>("1:1")
  const [regenWidth, setRegenWidth] = useState("1080")
  const [regenHeight, setRegenHeight] = useState("1350")
  const [regenRevision, setRegenRevision] = useState("")
  const [prevImages, setPrevImages] = useState<Record<string, string>>({})
  const [overlayDismissed, setOverlayDismissed] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
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
  const isWorking = post?.status === "generating" || post?.status === "captions_done"
  const noSlidesYet = (post?.slides.length ?? 0) === 0
  // "writing captions" (no slides yet) OR "generating images" (slides exist but images pending)
  const isGeneratingImages = !!isWorking && (noSlidesYet || generatingSlides.size > 0)
  const isCancelled = post?.status === "cancelled"
  const hasComparison = Object.keys(prevImages).length > 0
  // Full-screen overlay only for the initial generation — regenerate uses the inline before/after view.
  const showOverlay = isGeneratingImages && !overlayDismissed && !hasComparison

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

  function seedRegenOptions() {
    setRegenVibe(post?.vibe ?? "professional")
    setRegenStyle(post?.designStyle ?? "realistic")
    setRegenRatio(post?.aspectRatio ?? "1:1")
    setRegenWidth(String(post?.imageWidth ?? 1080))
    setRegenHeight(String(post?.imageHeight ?? 1350))
    setRegenRevision("")
  }

  function openRegenPanel() {
    seedRegenOptions()
    setRegenSelected(new Set(post?.slides.map(s => s.id) ?? []))
    setShowRegenPanel(true)
  }

  function openRegenPanelForMissing() {
    seedRegenOptions()
    setRegenSelected(new Set(post?.slides.filter(s => !s.imageUrl).map(s => s.id) ?? []))
    setShowRegenPanel(true)
  }

  async function handleCancel() {
    if (!post) return
    try {
      const res = await fetch(`/api/posts/${id}/cancel`, { method: "POST" })
      if (!res.ok) throw new Error("cancel failed")
      const fresh = await getPost(id)
      if (fresh) setPost(fresh)
      toast.success("generation cancelled")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "cancel failed")
    }
  }

  async function startRegen() {
    if (!post || regenning || regenSelected.size === 0) return
    let customW: number | undefined
    let customH: number | undefined
    if (regenRatio === "custom") {
      const w = Math.round(Number(regenWidth))
      const h = Math.round(Number(regenHeight))
      const valid = (n: number) => Number.isFinite(n) && n >= CUSTOM_SIZE_MIN && n <= CUSTOM_SIZE_MAX
      if (!valid(w) || !valid(h)) {
        toast.error(`custom size must be between ${CUSTOM_SIZE_MIN} and ${CUSTOM_SIZE_MAX}px`)
        return
      }
      customW = w
      customH = h
    }
    setRegenning(true)
    try {
      const res = await fetch(`/api/posts/${id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideIds: Array.from(regenSelected),
          vibe: regenVibe,
          designStyle: regenStyle,
          aspectRatio: regenRatio,
          imageWidth: customW,
          imageHeight: customH,
          revisionPrompt: regenRevision.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "regeneration failed")
      }
      const data = await res.json()
      const oldImgs: Record<string, string> = {}
      for (const [slideId, url] of Object.entries(data.oldImages ?? {})) {
        if (url) oldImgs[slideId] = url as string
      }
      setPrevImages(prev => ({ ...prev, ...oldImgs }))
      const fresh = await getPost(id)
      if (fresh) setPost(fresh)
      setShowRegenPanel(false)
      toast.success(`regenerating ${regenSelected.size} slide${regenSelected.size !== 1 ? "s" : ""}…`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "regeneration failed")
    } finally {
      setRegenning(false)
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
  const currentSlideGenerating = !isCancelled && (currentSlide ? generatingSlides.has(currentSlide.id) : false)

  return (
    <>
      {showOverlay && (
        <GeneratingAnimation
          slideCount={post.slideCount}
          onCancel={handleCancel}
          onClose={() => setOverlayDismissed(true)}
          label={noSlidesYet ? "writing your captions…" : undefined}
        />
      )}
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
            <Badge variant="outline" className={cn("text-[10px] gap-1.5", statusBadgeClass(post.status))}>
              <span className={cn("w-1.5 h-1.5 rounded-full", statusDotClass(post.status))} />
              {post.status === "captions_done" ? "generating" : post.status}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{post.vibe}</Badge>
            <Badge variant="outline" className="text-[10px]">{post.designStyle}</Badge>
            <Badge variant="outline" className="text-[10px]">{post.language}</Badge>
          </div>
          {isGeneratingImages ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5 text-destructive hover:text-destructive"
              onClick={handleCancel}
            >
              <X className="h-3.5 w-3.5" /> cancel
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={openRegenPanel}
              disabled={isCancelled}
            >
              <RefreshCw className="h-3.5 w-3.5" /> regenerate
            </Button>
          )}
        </div>
      </div>

      {/* cancelled banner */}
      {isCancelled && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs text-destructive leading-relaxed">
            <span className="font-medium">generation cancelled</span>
            {" — "}{post.slides.filter(s => s.imageUrl).length} of {post.slides.length} slides completed
          </p>
          {post.slides.some(s => !s.imageUrl) && (
            <Button size="sm" variant="outline" className="text-xs h-7 shrink-0 border-destructive/40 text-destructive hover:text-destructive"
              onClick={openRegenPanelForMissing}>
              complete missing
            </Button>
          )}
        </div>
      )}

      {/* image expiry warning for free/byok users */}
      {(plan === "free" || plan === "byok") && post.status === "done" && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/8 px-4 py-2.5 flex items-start gap-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
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
            style={{ containerType: "inline-size", ...postAspectStyle(post) }}
            className="rounded-xl overflow-hidden bg-muted flex items-center justify-center border border-border/60">
            {(() => {
              // captions still being written — no slides exist yet
              if (noSlidesYet && isWorking) {
                return (
                  <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                      <p className="text-xs text-muted-foreground">writing captions…</p>
                    </div>
                  </div>
                )
              }

              const oldUrl = currentSlide ? prevImages[currentSlide.id] : undefined
              const isComparing = !!oldUrl

              if (isComparing) {
                // Split before/after comparison view
                return (
                  <div className="relative w-full h-full flex">
                    {/* divider */}
                    <div className="absolute inset-y-0 left-1/2 w-px bg-white/50 z-10 pointer-events-none" />

                    {/* before */}
                    <div className="relative w-1/2 h-full overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={oldUrl} alt="before" className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                        <span className="text-[10px] font-medium bg-black/60 text-white px-2 py-0.5 rounded-full">before</span>
                      </div>
                    </div>

                    {/* after */}
                    <div className="relative w-1/2 h-full overflow-hidden">
                      {currentSlideGenerating ? (
                        <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        </div>
                      ) : currentSlide?.imageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={currentSlide.imageUrl} alt="after" className="w-full h-full object-cover" />
                          {/* footer overlay on after side */}
                          {identity?.activeFooterVariantId && dlWithFooter && (
                            <div className="absolute bottom-0 left-0 right-0 pointer-events-none"
                              style={footerAspect ? { aspectRatio: footerAspect } : { height: "18%" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={`/api/footer/images/${identity.activeFooterVariantId}`} alt="footer" className="w-full h-full block"
                                onLoad={e => { const img = e.currentTarget; setFooterAspect(`${img.naturalWidth} / ${img.naturalHeight}`) }} />
                            </div>
                          )}
                          {identity?.logoUrl && identity.logoPosition !== "none" && dlWithLogo && (
                            <div className={cn("absolute flex items-center pointer-events-none", logoOverlayClass(identity.logoPosition))}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={identity.logoUrl} alt="logo" className="h-6 object-contain drop-shadow-md"
                                onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                            </div>
                          )}
                        </>
                      ) : null}
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                        <span className="text-[10px] font-medium bg-primary/80 text-primary-foreground px-2 py-0.5 rounded-full">
                          {currentSlideGenerating ? "generating…" : "after"}
                        </span>
                      </div>
                    </div>

                    {/* dismiss comparison */}
                    <button
                      onClick={() => setPrevImages(prev => { const n = { ...prev }; if (currentSlide) delete n[currentSlide.id]; return n })}
                      className="absolute top-2 right-2 z-20 bg-black/50 hover:bg-black/70 rounded-full p-1 text-white transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              }

              // Normal single view
              if (currentSlideGenerating) {
                return (
                  <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                      <p className="text-xs text-muted-foreground">generating image...</p>
                    </div>
                  </div>
                )
              }

              if (currentSlide?.imageUrl) {
                return (
                  <div className="relative w-full h-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentSlide.imageUrl} alt={currentSlide.imagePrompt || "slide"} className="w-full h-full object-cover" />
                    {identity?.activeFooterVariantId && (
                      <div className="absolute bottom-0 left-0 right-0 pointer-events-none"
                        style={footerAspect ? { aspectRatio: footerAspect } : { height: "18%" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/footer/images/${identity.activeFooterVariantId}`} alt="footer" className="w-full h-full block"
                          onLoad={e => { const img = e.currentTarget; setFooterAspect(`${img.naturalWidth} / ${img.naturalHeight}`) }} />
                      </div>
                    )}
                    {identity?.logoUrl && identity.logoPosition !== "none" && (
                      <div className={cn("absolute flex items-center pointer-events-none", logoOverlayClass(identity.logoPosition))}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={identity.logoUrl} alt="logo" className="h-8 object-contain drop-shadow-md"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div className="text-center space-y-2">
                  {isCancelled
                    ? <><X className="h-8 w-8 text-destructive/50 mx-auto" /><p className="text-xs text-muted-foreground">cancelled</p></>
                    : <><ImageOff className="h-8 w-8 text-muted-foreground mx-auto" /><p className="text-xs text-muted-foreground">image unavailable</p></>
                  }
                </div>
              )
            })()}
          </div>

          {/* slide thumbnails */}
          {post.slides.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {post.slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSlide(i)}
                  style={postAspectStyle(post)}
                  className={cn(
                    "relative shrink-0 h-14 rounded-lg overflow-hidden border-2 transition-colors",
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
                  {prevImages[s.id] && (
                    <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-primary rounded-full border border-background" />
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
            <h2 className="text-sm font-semibold">caption</h2>
          </div>

          <Card className="p-4 space-y-3">
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

          {currentSlide?.imagePrompt && (
            <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
              <button
                onClick={() => setPromptOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs font-medium text-muted-foreground">image prompt used</span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", promptOpen && "rotate-180")} />
              </button>
              {promptOpen && (
                <p className="text-xs text-muted-foreground px-3 pb-3 leading-relaxed border-t border-border/40 pt-2.5">
                  {currentSlide.imagePrompt}
                </p>
              )}
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

      {/* regenerate panel */}
      <Dialog open={showRegenPanel} onOpenChange={setShowRegenPanel}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>regenerate slides</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1 max-h-[60vh] overflow-y-auto pr-1">
            {/* slide selection */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">slides</Label>
                <button
                  className="text-[11px] text-primary hover:underline"
                  onClick={() =>
                    setRegenSelected(
                      regenSelected.size === post.slides.length
                        ? new Set()
                        : new Set(post.slides.map(s => s.id))
                    )
                  }
                >
                  {regenSelected.size === post.slides.length ? "deselect all" : "select all"}
                </button>
              </div>

              <div className={cn(
                "grid gap-2",
                post.slides.length <= 3 ? "grid-cols-3" : "grid-cols-4"
              )}>
                {post.slides.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() =>
                      setRegenSelected(prev => {
                        const n = new Set(prev)
                        if (n.has(s.id)) n.delete(s.id); else n.add(s.id)
                        return n
                      })
                    }
                    style={postAspectStyle(post)}
                    className={cn(
                      "relative rounded-lg overflow-hidden border-2 transition-colors",
                      regenSelected.has(s.id) ? "border-primary" : "border-border/40 hover:border-border"
                    )}
                  >
                    {s.imageUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-muted flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground">{i + 1}</span>
                        </div>
                    }
                    {regenSelected.has(s.id) && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-[9px] text-white text-center py-0.5 pointer-events-none">
                      {i + 1}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* vibe override */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">vibe</Label>
              <div className="flex flex-wrap gap-1.5">
                {VIBES.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setRegenVibe(v.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors",
                      regenVibe === v.id
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border/60 hover:border-border bg-card text-muted-foreground"
                    )}
                  >
                    <v.icon className="h-3 w-3" /> {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* style override */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">design style</Label>
              <div className="flex flex-wrap gap-1.5">
                {DESIGN_STYLES.map(sOpt => (
                  <button
                    key={sOpt.id}
                    onClick={() => setRegenStyle(sOpt.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors",
                      regenStyle === sOpt.id
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border/60 hover:border-border bg-card text-muted-foreground"
                    )}
                  >
                    <sOpt.icon className="h-3 w-3" /> {sOpt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ratio & size override */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">ratio & size</Label>
              <div className="flex flex-wrap gap-1.5">
                {ASPECT_RATIOS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setRegenRatio(r.id)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors",
                      regenRatio === r.id
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border/60 hover:border-border bg-card text-muted-foreground"
                    )}
                  >
                    {r.label} · {r.width}×{r.height}
                  </button>
                ))}
                <button
                  onClick={() => setRegenRatio("custom")}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors",
                    regenRatio === "custom"
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border/60 hover:border-border bg-card text-muted-foreground"
                  )}
                >
                  custom
                </button>
              </div>
              {regenRatio === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={CUSTOM_SIZE_MIN}
                    max={CUSTOM_SIZE_MAX}
                    value={regenWidth}
                    onChange={e => setRegenWidth(e.target.value)}
                    placeholder="width"
                    className="flex-1 text-xs rounded-lg border border-border/60 bg-background px-3 py-2 font-mono"
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                  <input
                    type="number"
                    min={CUSTOM_SIZE_MIN}
                    max={CUSTOM_SIZE_MAX}
                    value={regenHeight}
                    onChange={e => setRegenHeight(e.target.value)}
                    placeholder="height"
                    className="flex-1 text-xs rounded-lg border border-border/60 bg-background px-3 py-2 font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground shrink-0">px ({CUSTOM_SIZE_MIN}–{CUSTOM_SIZE_MAX})</span>
                </div>
              )}
              {regenRatio !== post.aspectRatio && (
                <p className="text-[10px] text-muted-foreground">the whole post switches to this ratio — slides you don&apos;t regenerate will keep their old shape until regenerated</p>
              )}
            </div>

            {/* revision note */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">minor revision <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                placeholder='e.g. "remove the word SALE", "make the background darker", "use a bigger headline"'
                className="min-h-16 text-xs resize-none"
                value={regenRevision}
                onChange={e => setRegenRevision(e.target.value)}
                maxLength={300}
              />
              <p className="text-[10px] text-muted-foreground">the ai applies this tweak to the selected slides on regenerate</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              className="text-xs w-full"
              disabled={regenSelected.size === 0 || regenning}
              onClick={startRegen}
            >
              {regenning
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> regenerating…</>
                : `regenerate ${regenSelected.size} slide${regenSelected.size !== 1 ? "s" : ""}`
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
