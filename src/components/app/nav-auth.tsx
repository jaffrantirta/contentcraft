"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, LayoutDashboard } from "lucide-react"
import { useSession } from "@/lib/auth-client"

// Auth-aware landing-page nav buttons: shows "dashboard" when signed in,
// otherwise the log in / get started pair.
export function NavAuth() {
  const { data: session, isPending } = useSession()

  if (!isPending && session) {
    return (
      <Link href="/dashboard">
        <Button size="sm" className="text-xs h-8 gap-1.5">
          <LayoutDashboard className="h-3.5 w-3.5" /> dashboard
        </Button>
      </Link>
    )
  }

  return (
    <>
      <Link href="/login">
        <Button variant="ghost" size="sm" className="text-xs">log in</Button>
      </Link>
      <Link href="/login">
        <Button size="sm" className="text-xs h-8">get started <ArrowRight className="ml-1 h-3 w-3" /></Button>
      </Link>
    </>
  )
}
