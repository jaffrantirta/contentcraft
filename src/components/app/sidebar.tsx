"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "@/lib/auth-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sparkles, LayoutDashboard, PlusCircle, Image, Settings, CreditCard, LogOut, Key, User } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "dashboard" },
  { href: "/create", icon: PlusCircle, label: "create" },
  { href: "/posts", icon: Image, label: "my posts" },
]

const settingsItems = [
  { href: "/settings/identity", icon: User, label: "my identity" },
  { href: "/settings/api-key", icon: Key, label: "api key" },
  { href: "/billing", icon: CreditCard, label: "billing" },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="fixed left-0 top-0 h-full w-60 border-r border-border/60 bg-card flex flex-col">
      {/* logo */}
      <div className="h-14 border-b border-border/60 flex items-center px-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold">contentcraft</span>
        </Link>
      </div>

      {/* nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        <div className="pb-3">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors",
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
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors",
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
      <div className="border-t border-border/60 p-3">
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
    </aside>
  )
}
