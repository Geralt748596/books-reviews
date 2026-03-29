"use client"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"

export function UserNav() {
  const { data: session } = authClient.useSession()

  if (!session) {
    return (
      <Button render={<Link href="/login" />} variant="ghost" size="sm">
        Sign in
      </Button>
    )
  }

  const initials = session.user.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?"

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8">
        <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? ""} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <span className="hidden text-sm font-medium sm:inline">{session.user.name}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => authClient.signOut()}
      >
        Sign out
      </Button>
    </div>
  )
}
