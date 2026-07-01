"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { signIn, useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [loading, setLoading] = useState(false)

  // Already signed in — skip the login screen and go straight to the app.
  useEffect(() => {
    if (session) router.replace("/dashboard")
  }, [session, router])

  async function handleGoogle() {
    setLoading(true)
    await signIn.social({ provider: "google", callbackURL: "/dashboard" })
    setLoading(false)
  }

  if (isPending || session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold mb-6">
            <Sparkles className="h-4 w-4" />
            contentcraft
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">welcome back</h1>
          <p className="text-sm text-muted-foreground">sign in to start creating content</p>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full h-11 text-sm gap-3"
            variant="outline"
            onClick={handleGoogle}
            disabled={loading}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {loading ? "signing in..." : "continue with google"}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          by signing in, you agree to our terms of service.<br />
          <Link href="/" className="underline underline-offset-4 hover:text-foreground">
            back to homepage
          </Link>
        </p>
      </div>
    </div>
  )
}
