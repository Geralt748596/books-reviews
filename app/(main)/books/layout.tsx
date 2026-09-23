export default function BooksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="@container">{children}</div>;
}
