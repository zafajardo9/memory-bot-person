import {
  BookOpen,
  ChevronDown,
  LogOut,
  MessageSquarePlus,
  MessageSquareText,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { auth, signOut } from "@/app/(auth)/auth";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";

import { History } from "./history";
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
  const accountName = email.split("@")[0] || "Account";
  const initial = accountName.charAt(0).toUpperCase();

  return (
    <header className="fixed inset-x-0 top-0 z-30 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex size-full items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <History user={user} />

          <Link
            href="/"
            aria-label="Memory home"
            className="group flex min-w-0 items-center gap-2.5 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <MessageSquareText size={16} />
            </span>
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
              <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
              <NavigationLinks knowledgeEnabled={knowledgeEnabled} />
            </>
          ) : null}
        </div>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group flex h-10 shrink-0 items-center gap-2 rounded-xl border bg-card p-1.5 pr-2 text-left shadow-sm transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open account menu"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
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
              className="w-72 rounded-xl p-1.5 shadow-xl"
            >
              <DropdownMenuLabel className="flex items-center gap-3 p-2 font-normal">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
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
              {user.role === "ADMIN" ? (
                <DropdownMenuItem asChild className="h-10 gap-3 rounded-lg">
                  <Link href="/settings/ai">
                    <Settings2 size={15} className="text-muted-foreground" />
                    AI model settings
                  </Link>
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="h-10 rounded-lg p-0">
                <ThemeToggle className="h-10 px-2" />
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
        ) : (
          <Button className="h-9 px-3 font-normal" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
