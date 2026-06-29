"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ImageIcon, PlusCircle } from "lucide-react"

interface Post {
  id: string
  title: string
  brief: string
  status: string
  vibe: string
  language: string
  slideCount: number
  createdAt: string
  slides: Array<{ imageUrl: string | null }>
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/posts").then(r => r.json()).then(data => {
      setPosts(Array.isArray(data) ? data : [])
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">my posts</h1>
          <p className="text-sm text-muted-foreground mt-1">all your generated content</p>
        </div>
        <Link href="/create">
          <Button size="sm" className="text-xs h-9">
            <PlusCircle className="h-3.5 w-3.5 mr-2" />
            new post
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Card key={i} className="h-40 animate-pulse bg-muted" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-16 text-center space-y-3">
          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">you haven&apos;t created any posts yet</p>
          <Link href="/create">
            <Button variant="outline" size="sm" className="text-xs h-8">create first post</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.map(p => (
            <Link key={p.id} href={`/posts/${p.id}`}>
              <Card className="p-4 hover:border-border transition-colors cursor-pointer group">
                <div className="flex gap-3">
                  {/* preview strip */}
                  <div className="flex gap-1 shrink-0">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-10 h-14 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                        {p.slides?.[i]?.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.slides[i].imageUrl!} alt="" className="w-full h-full object-cover" />
                        ) : i === 0 ? (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {/* info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                      {p.title || p.brief}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{p.brief}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                      <Badge variant="outline" className="text-[10px]">{p.vibe}</Badge>
                      <Badge variant="outline" className="text-[10px]">{p.language}</Badge>
                      <span className="text-[10px] text-muted-foreground">{p.slides?.length || p.slideCount} slides</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
