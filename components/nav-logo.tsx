"use client";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { BookOpenIcon } from "lucide-react";
import Link from "next/link";

export function SidebarLogo() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton render={<Link href="/" />} size="logo">
          <BookOpenIcon className="text-primary" />
          <p className="text-lg font-bold whitespace-nowrap">Boobs reviews</p>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
