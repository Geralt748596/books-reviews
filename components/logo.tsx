import { cn } from "@/lib/utils";
import Image from "next/image";

import books from "./assets/books.png";

export const Logo = ({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Image>, "src" | "alt">) => {
  return (
    <Image
      alt="logo"
      className={cn("size-7", className)}
      src={books}
      {...props}
    />
  );
};
