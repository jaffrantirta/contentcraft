import { Sidebar } from "@/components/app/sidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-60 p-8 max-w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
