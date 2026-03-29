"use client"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const handleGoogleSignIn = () => {
    authClient.signIn.social({ provider: "google" })
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">Sign in to Books Reviews</h1>
      <p className="text-muted-foreground">
        Sign in to leave reviews, manage characters, and generate AI illustrations.
      </p>
      <Button onClick={handleGoogleSignIn} className="w-full max-w-xs" size="lg">
        Sign in with Google
      </Button>
    </div>
  )
}
