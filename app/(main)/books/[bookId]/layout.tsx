export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="container mx-auto max-w-7xl pt-12 pb-20 px-4">
      {children}
    </main>
  );
}
