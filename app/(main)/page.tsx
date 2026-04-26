import { PopularBooks } from "@/components/PopularBooks";

export default function HomePage() {
  return (
    <main className="grid flex-1 grid-cols-1 items-start gap-6 px-4 py-6 lg:grid-cols-[minmax(150px,200px)_1fr_minmax(150px,200px)]">
      <aside className="hidden lg:block sticky top-[80px]" />
      <div className="min-w-0">
        <h1 className="text-4xl font-bold">Books Reviews</h1>
      </div>
      <aside className="hidden lg:block sticky top-[80px] pt-4">
        <PopularBooks />
      </aside>
    </main>
  );
}
