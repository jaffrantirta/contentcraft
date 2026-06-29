import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowRight, Sparkles, ImageIcon, Languages, Palette, Layers, Star, Zap, Lock } from "lucide-react"

const features = [
  { icon: Sparkles, title: "ai-powered briefs", desc: "just describe your idea — ai handles the rest" },
  { icon: ImageIcon, title: "multi-slide images", desc: "generate up to 10 images per post, matched to your brand" },
  { icon: Languages, title: "bilingual captions", desc: "captions in indonesian or english, ready to post" },
  { icon: Palette, title: "custom color palettes", desc: "pick vibes and palettes that match your brand identity" },
  { icon: Layers, title: "ratio-ready formats", desc: "square, portrait, story, landscape — all covered" },
  { icon: Lock, title: "bring your own key", desc: "use your own api key for unlimited generation" },
]

const vibes = ["fun 🎉", "chill 😌", "shock ⚡", "professional 💼", "aesthetic ✨", "dark 🖤", "warm 🧡", "minimal ◻️"]

const plans = [
  {
    name: "free",
    price: "rp 0",
    desc: "try it once",
    features: ["1 content generation", "max 5 slides", "all vibes & palettes", "id + en captions"],
    cta: "get started",
    highlight: false,
  },
  {
    name: "byok",
    price: "free",
    desc: "bring your own api key",
    features: ["unlimited generations", "your own model", "custom base url", "max 10 slides"],
    cta: "use my key",
    highlight: false,
  },
  {
    name: "pro",
    price: "rp 99.000",
    desc: "per month",
    features: ["unlimited generations", "app-managed api", "max 10 slides", "priority support"],
    cta: "go pro",
    highlight: true,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight">contentcraft</span>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-xs">log in</Button>
            </Link>
            <Link href="/login">
              <Button size="sm" className="text-xs h-8">get started <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <Badge variant="secondary" className="text-xs px-3 py-1">
            <Sparkles className="h-3 w-3 mr-1" />
            ai content generator
          </Badge>
          <h1 className="text-5xl font-bold tracking-tight leading-tight">
            create stunning<br />
            <span className="text-muted-foreground">social content</span><br />
            in seconds
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
            write a brief. pick your vibe. get images + captions ready to post — for instagram, stories, linkedin, and more.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link href="/login">
              <Button size="lg" className="text-sm">
                try for free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="#pricing">
              <Button variant="outline" size="lg" className="text-sm">see pricing</Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">no credit card needed · 1 free generation</p>
        </div>
      </section>

      {/* vibes marquee */}
      <section className="py-8 border-y border-border/40 overflow-hidden">
        <div className="flex gap-4 animate-none">
          <div className="flex gap-4 px-6 flex-wrap justify-center max-w-5xl mx-auto">
            {vibes.map((v) => (
              <Badge key={v} variant="outline" className="text-xs px-3 py-1.5 font-normal">{v}</Badge>
            ))}
          </div>
        </div>
      </section>

      {/* features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl font-bold tracking-tight">everything you need</h2>
            <p className="text-muted-foreground">to go from idea to ready-to-post content</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-xl border border-border/60 bg-card hover:border-border transition-colors">
                <f.icon className="h-5 w-5 mb-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="py-24 px-6 bg-muted/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl font-bold tracking-tight">how it works</h2>
            <p className="text-muted-foreground">four steps to your finished content</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "01", title: "write your brief", desc: "describe what your content is about" },
              { step: "02", title: "set the vibe", desc: "pick ratio, language, slides, colors, and mood" },
              { step: "03", title: "generate", desc: "ai creates images and matching captions" },
              { step: "04", title: "download & post", desc: "grab your slides and hashtags and go" },
            ].map((s) => (
              <div key={s.step} className="text-center space-y-3">
                <span className="text-4xl font-bold text-border">{s.step}</span>
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl font-bold tracking-tight">simple pricing</h2>
            <p className="text-muted-foreground">start free, scale when you need</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`p-6 rounded-xl border ${plan.highlight ? "border-primary bg-primary/5" : "border-border/60 bg-card"}`}
              >
                {plan.highlight && (
                  <Badge className="mb-4 text-xs">
                    <Star className="h-3 w-3 mr-1" /> most popular
                  </Badge>
                )}
                <div className="mb-6">
                  <p className="text-xs text-muted-foreground mb-1">{plan.name}</p>
                  <p className="text-2xl font-bold">{plan.price}</p>
                  <p className="text-xs text-muted-foreground">{plan.desc}</p>
                </div>
                <ul className="space-y-2 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Zap className="h-3 w-3 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/login">
                  <Button
                    className="w-full text-xs h-9"
                    variant={plan.highlight ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* cta */}
      <section className="py-24 px-6 bg-muted/20">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">ready to create?</h2>
          <p className="text-muted-foreground">your first content is free. no setup, no commitment.</p>
          <Link href="/login">
            <Button size="lg" className="text-sm">
              start creating <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-border/40 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xs text-muted-foreground">contentcraft © 2025</span>
          <div className="flex gap-4">
            <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">log in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
