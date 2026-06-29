"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "@/lib/auth-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Sparkles, LayoutDashboard, PlusCircle, ImageIcon, CreditCard, LogOut, Key, User, Menu } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "dashboard" },
  { href: "/create", icon: PlusCircle, label: "create" },
  { href: "/posts", icon: ImageIcon, label: "my posts" },
]

const settingsItems = [
  { href: "/settings/identity", icon: User, label: "my identity" },
  { href: "/settings/api-key", icon: Key, label: "api key" },
  { href: "/billing", icon: CreditCard, label: "billing" },
]

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <div className="flex flex-col h-full">
      {/* logo */}
      <div className="h-14 border-b border-border/60 flex items-center px-5 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={onNavigate}>
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold">contentcraft</span>
        </Link>
      </div>

      {/* nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <div className="pb-3">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={onNavigate}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-colors",
                pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}>
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </div>
            </Link>
          ))}
        </div>

        <div className="border-t border-border/40 pt-3">
          <p className="px-3 py-1 text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">settings</p>
          {settingsItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={onNavigate}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-colors",
                pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}>
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </div>
            </Link>
          ))}
        </div>
      </nav>

      {/* user */}
      <div className="border-t border-border/60 p-3 shrink-0">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={session?.user?.image || ""} />
            <AvatarFallback className="text-[10px]">{session?.user?.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{session?.user?.name || "user"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{session?.user?.email || ""}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/" } } })}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function MobileHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="md:hidden fixed top-0 inset-x-0 z-50 h-14 border-b border-border/60 bg-background/95 backdrop-blur-sm flex items-center justify-between px-4">
      <Link href="/dashboard" className="flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-semibold">contentcraft</span>
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent transition-colors">
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <NavContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 border-r border-border/60 bg-card flex-col">
      <NavContent />
    </aside>
  )
}
