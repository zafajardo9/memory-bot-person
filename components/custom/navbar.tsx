import {
  BookOpen,
  ChevronDown,
  LogOut,
  MessageSquarePlus,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  User as UserIcon,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { auth, signOut } from "@/app/(auth)/auth";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";

import { AgentSelector } from "./agent-selector";
import { Sessions } from "./history";
import { NavigationLinks } from "./navigation-links";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

import type { User } from "next-auth";

export const Navbar = async () => {
  const session = await auth();
  const knowledgeEnabled = isKnowledgeManagementEnabled();

  return (
    <NavigationBar
      user={session?.user}
      knowledgeEnabled={knowledgeEnabled}
      signOutAction={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    />
  );
};

export function NavigationBar({
  user,
  knowledgeEnabled,
  signOutAction,
}: {
  user?: User;
  knowledgeEnabled: boolean;
  signOutAction: () => Promise<void>;
}) {
  const email = user?.email ?? "";
  const accountName = user?.name || email.split("@")[0] || "Account";
  const initial = accountName.charAt(0).toUpperCase();

  return (
    <header className="fixed inset-x-0 top-3 z-30 px-3 sm:px-5 md:left-56">
      <div className="glass mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-2 rounded-full px-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="md:hidden">
            <Sessions user={user} />
          </div>

          <Link
            href="/"
            aria-label="Memory home"
            className="group flex min-w-0 items-center gap-2 rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="size-6 shrink-0 rounded-full bg-gradient-to-br from-primary to-sky-400 shadow-[0_3px_14px_hsl(var(--primary)/0.28)] transition-transform group-hover:scale-105" />
            <span className="hidden min-w-0 leading-tight sm:block">
              <span className="block text-sm font-semibold tracking-[-0.01em]">
                Memory
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                Shared company knowledge
              </span>
            </span>
          </Link>

          {user ? (
            <>
              <NavigationLinks knowledgeEnabled={knowledgeEnabled} />
            </>
          ) : null}
        </div>

        {user ? (
          <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
            <AgentSelector />
            <ThemeToggle />
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group flex h-9 shrink-0 items-center gap-2 rounded-full p-1 pr-1.5 text-left transition-colors hover:bg-foreground/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:pr-2"
                aria-label="Open account menu"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sky-400 text-xs font-semibold text-white">
                  {initial}
                </span>
                <span className="hidden min-w-0 leading-tight md:block">
                  <span className="block max-w-32 truncate text-xs font-medium">
                    {accountName}
                  </span>
                  <span className="block text-[10px] capitalize text-muted-foreground">
                    {user.role?.toLowerCase() ?? "member"}
                  </span>
                </span>
                <ChevronDown
                  size={13}
                  className="hidden text-muted-foreground transition-transform group-data-[state=open]:rotate-180 md:block"
                />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-72 p-1.5"
            >
              <DropdownMenuLabel className="flex items-center gap-3 p-2 font-normal">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {accountName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {email}
                  </span>
                </span>
                {user.role === "ADMIN" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                    <ShieldCheck size={11} /> Admin
                  </span>
                ) : null}
              </DropdownMenuLabel>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-2 pb-1 pt-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Workspace
              </DropdownMenuLabel>
              <DropdownMenuItem asChild className="h-10 gap-3 rounded-lg">
                <Link href="/">
                  <MessageSquarePlus size={15} className="text-muted-foreground" />
                  New chat
                </Link>
              </DropdownMenuItem>
              {knowledgeEnabled ? (
                <DropdownMenuItem asChild className="h-10 gap-3 rounded-lg">
                  <Link href="/knowledge">
                    <BookOpen size={15} className="text-muted-foreground" />
                    Open team notebook
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild className="h-10 gap-3 rounded-lg">
                  <Link href="/agents">
                  <SlidersHorizontal
                    size={15}
                    className="text-muted-foreground"
                  />
                  Agent workspace
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="h-10 gap-3 rounded-lg">
                <Link href="/tools">
                  <Wrench size={15} className="text-muted-foreground" />
                  Tool integrations
                </Link>
              </DropdownMenuItem>
              {user.role === "ADMIN" ? (
                <DropdownMenuItem asChild className="h-10 gap-3 rounded-lg">
                  <Link href="/settings/ai">
                    <Settings2 size={15} className="text-muted-foreground" />
                    AI model settings
                  </Link>
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuItem asChild className="h-10 gap-3 rounded-lg">
                <Link href="/account">
                  <UserIcon size={15} className="text-muted-foreground" />
                  Account settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action={signOutAction}>
                <DropdownMenuItem
                  asChild
                  className="h-10 rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <button type="submit" className="w-full gap-3">
                    <LogOut size={15} />
                    Sign out
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Button className="h-9 px-3 font-normal" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
