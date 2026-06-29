import { Sidebar, MobileHeader } from "@/components/app/sidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <MobileHeader />
      <main className="flex-1 md:ml-60 pt-14 md:pt-0 p-4 md:p-8 max-w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
