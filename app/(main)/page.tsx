import { PopularBooks } from "@/components/PopularBooks";
import { HomeFeed, HomeFeedSkeleton } from "@/components/feed/home-feed";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { BreadcrumbList } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Build Your Application</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Data Fetching</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 pt-0 @container">
        <Suspense fallback={<HomeFeedSkeleton />}>
          <HomeFeed />
        </Suspense>
        {/* <h2 className="text-4xl font-bold col-start-2 col-span-1 row-start-1 row-span-1 hidden md:flex">
        Popular books
      </h2>
      <PopularBooks className="col-start-2 col-span-1 row-start-2 row-span-1 hidden md:flex" /> */}
      </main>
      {/* <Footer className="mt-auto w-full" /> */}
    </>
  );
}
