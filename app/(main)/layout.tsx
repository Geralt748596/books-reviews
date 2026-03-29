import Link from "next/link"
import { DarkModeToggle } from "@/components/dark-mode-toggle"
import { UserNav } from "@/components/user-nav"
import { MainNav } from "@/components/main-nav"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-14 items-center px-4">
          <div className="flex flex-1 items-center gap-6">
            <Link href="/" className="text-lg font-bold">
              Books Reviews
            </Link>
            <MainNav />
          </div>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <UserNav />
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
