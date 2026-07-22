import { MessageSquareText } from "lucide-react";
import Link from "next/link";

export function AuthNavbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex size-full items-center px-4 sm:px-6">
        <Link
          href="/"
          aria-label="Memory home"
          className="group flex items-center gap-2.5 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
            <MessageSquareText size={16} />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-[-0.01em]">
              Memory
            </span>
            <span className="block text-[10px] text-muted-foreground">
              Shared company knowledge
            </span>
          </span>
        </Link>
      </div>
    </header>
  );
}
