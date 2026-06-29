"use client"

import { useEffect, useState } from "react"
import { useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { PlusCircle, ImageIcon, Zap, ArrowRight } from "lucide-react"

interface Settings {
  plan: string
  freeGenerationsUsed: number
}

interface Post {
  id: string
  title: string
  brief: string
  status: string
  createdAt: string
  slides: Array<{ imageUrl: string | null }>
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then(r => r.json()),
      fetch("/api/posts").then(r => r.json()),
    ]).then(([s, p]) => {
      setSettings(s)
      setPosts(Array.isArray(p) ? p : [])
    }).finally(() => setLoading(false))
  }, [])

  const planColor = { free: "secondary", byok: "outline", pro: "default" }[settings?.plan || "free"] as "secondary" | "outline" | "default"

  return (
    <div className="space-y-8 max-w-4xl">
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            hey, {session?.user?.name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">ready to create something?</p>
        </div>
        <Link href="/create">
          <Button size="sm" className="text-xs h-9">
            <PlusCircle className="h-3.5 w-3.5 mr-2" />
            new post
          </Button>
        </Link>
      </div>

      {/* plan status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">current plan</p>
            <Badge variant={planColor} className="text-[10px]">{settings?.plan || "free"}</Badge>
          </div>
          {settings?.plan === "free" && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {settings.freeGenerationsUsed}/1 free generations used
              </p>
              {settings.freeGenerationsUsed >= 1 && (
                <Link href="/billing">
                  <Button variant="outline" size="sm" className="text-xs h-7 w-full mt-2">
                    upgrade to pro <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          )}
          {settings?.plan === "pro" && (
            <p className="text-xs text-muted-foreground">unlimited generations</p>
          )}
          {settings?.plan === "byok" && (
            <p className="text-xs text-muted-foreground">using your api key</p>
          )}
        </Card>

        <Card className="p-5 space-y-2">
          <p className="text-xs text-muted-foreground">total posts</p>
          <p className="text-3xl font-bold">{loading ? "—" : posts.length}</p>
        </Card>

        <Card className="p-5 space-y-2">
          <p className="text-xs text-muted-foreground">total slides</p>
          <p className="text-3xl font-bold">
            {loading ? "—" : posts.reduce((acc, p) => acc + (p.slides?.length || 0), 0)}
          </p>
        </Card>
      </div>

      {/* free trial banner */}
      {settings?.plan === "free" && settings.freeGenerationsUsed === 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">you have 1 free generation</p>
              <p className="text-xs text-muted-foreground">create your first post — no card needed</p>
            </div>
          </div>
          <Link href="/create">
            <Button size="sm" className="text-xs h-8">
              create now <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {/* recent posts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">recent posts</h2>
          <Link href="/posts">
            <Button variant="ghost" size="sm" className="text-xs h-7">view all</Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <Card key={i} className="h-32 animate-pulse bg-muted" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-12 text-center space-y-3">
            <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">no posts yet</p>
            <Link href="/create">
              <Button variant="outline" size="sm" className="text-xs h-8">
                create your first post
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.slice(0, 4).map((p) => (
              <Link key={p.id} href={`/posts/${p.id}`}>
                <Card className="p-4 hover:border-border transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                      {p.slides?.[0]?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.slides[0].imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{p.title || p.brief}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{p.slides?.length || 0} slides</p>
                      <Badge
                        variant={p.status === "done" ? "secondary" : "outline"}
                        className="text-[10px] mt-1"
                      >
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
