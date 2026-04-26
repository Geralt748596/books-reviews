import { cn } from "@/lib/utils";

type Props = {
  title: string;
  className?: string;
} & React.ComponentProps<"h1">;

export const ClipTitle = ({ title, className, ...props }: Props) => {
  return (
    <h1
      data-title={title}
      className={cn(
        "relative text-7xl font-black uppercase italic text-transparent text-nowrap",
        "before:absolute before:inset-0 before:text-foreground before:content-[attr(data-title)] before:[clip-path:polygon(0_0,110%_0,100%_65%,0_25%)]",
        "after:absolute after:-left-2.5 after:-top-0.5 after:text-foreground after:content-[attr(data-title)] after:[clip-path:polygon(0_25%,100%_65%,100%_100%,0%_100%)]",
        className,
      )}
      {...props}
    >
      {title}
    </h1>
  );
};
