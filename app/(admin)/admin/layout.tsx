import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // const session = await auth.api.getSession({ headers: await headers() });

  // if (!session || session.user.role !== "admin") {
  //   redirect("/");
  // }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Admin</h1>
        <Link
          href="/"
          transitionTypes={["nav-back"]}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to site
        </Link>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
