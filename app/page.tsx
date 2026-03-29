import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session) {
    redirect("/search")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col gap-3 max-w-md">
        <h1 className="text-4xl font-bold tracking-tight">Books Reviews</h1>
        <p className="text-muted-foreground text-lg">
          Search books, leave reviews, manage characters, and generate AI illustrations.
        </p>
      </div>
      <Button render={<Link href="/login" />} size="lg">
        Sign in with Google
      </Button>
    </div>
  )
}
