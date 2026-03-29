"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/search", label: "Search" },
  { href: "/gallery", label: "Gallery" },
]

export function MainNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-4 text-sm">
      {navLinks.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "transition-colors hover:text-foreground",
            pathname === href || pathname.startsWith(href + "/")
              ? "text-foreground font-medium"
              : "text-muted-foreground"
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
