import Image from "next/image";
import { cn } from "@/lib/utils";

import classes from "./classes.module.css";

interface BookCoverProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export function BookCover3D({ src, alt, className }: BookCoverProps) {
  return (
    <div className={cn(classes.book, className)}>
      <div className={classes.innerBook}>
        <div
          className={classes.img}
          style={{ paddingTop: "calc(1.07 * 100%)" }}
        >
          {src ? <Image src={src} alt={alt} fill /> : null}
        </div>
        <div className={cn(classes.page)}></div>
        <div className={cn(classes.page, classes.page2)}></div>
        <div className={cn(classes.page, classes.page3)}></div>
        <div className={cn(classes.page, classes.page4)}></div>
        <div className={cn(classes.page, classes.page5)}></div>
        <div className={cn(classes.img, classes.finalPage)}></div>
      </div>
    </div>
  );
}
