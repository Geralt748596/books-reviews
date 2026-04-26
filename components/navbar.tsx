import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { SearchComboboxClient } from "@/components/search-combobox";
import { getSession } from "@/lib/actions/session";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TypographyP } from "@/components/ui/typography";
import { CreatePost } from "@/components/create-post";
import Link from "next/link";

const Navbar = () => {
  return (
    <header className="px-4 w-full sticky inset-x-4 top-6 z-50">
      <nav className="w-full rounded-full border bg-background py-3 px-5">
        <div className="mx-auto flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-2 md:gap-6">
            <Link href="/" transitionTypes={["nav-back"]}>
              <Logo className="shrink-0" />
            </Link>

            <div className="hidden md:block">
              <SearchComboboxClient className="w-[280px] rounded-full border-none bg-muted shadow-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="rounded-full bg-muted text-foreground shadow-none hover:bg-accent md:hidden"
              size="icon"
            >
              <Search className="h-5! w-5!" />
            </Button>
            <Suspense fallback={<Skeleton className="h-8 w-14" />}>
              <ProfileOrLogin />
            </Suspense>
          </div>
        </div>
      </nav>
    </header>
  );
};

async function ProfileOrLogin() {
  const session = await getSession();

  if (!session) {
    return (
      <Button className="hidden rounded-full sm:inline-flex" variant="outline">
        Sign In
      </Button>
    );
  }

  return (
    <div className="flex gap-4 items-center-safe">
      <TypographyP>{session.user.name}</TypographyP>
      <Avatar>
        <AvatarFallback>{session.user.name.slice(0, 2)}</AvatarFallback>
        <AvatarImage src={session.user.image || ""} />
      </Avatar>
      <CreatePost />
    </div>
  );
}

export default Navbar;
