import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@/prisma/generated/browser";

type Props = {
  user: Pick<User, "name" | "image">;
};

export function UserAvatar({ user }: Props) {
  return (
    <Avatar>
      <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
      <AvatarImage src={user.image || ""} />
    </Avatar>
  );
}
