import Footer from "@/components/footer";
import Navbar from "@/components/navbar";
import { PopularBooks } from "@/components/PopularBooks";
import { Toaster } from "@/components/ui/sonner";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      {children}
      <Toaster />
      <Footer className="mt-auto w-full" />
    </div>
  );
}
