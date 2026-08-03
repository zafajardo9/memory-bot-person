import Link from "next/link";

export function AuthNavbar() {
  return (
    <header className="fixed inset-x-0 top-3 z-30 px-3 sm:px-5">
      <div className="glass mx-auto flex h-12 w-full max-w-5xl items-center rounded-full px-3">
        <Link
          href="/"
          aria-label="Memory home"
          className="group flex items-center gap-2 rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="size-6 rounded-full bg-gradient-to-br from-primary to-sky-400 shadow-[0_3px_14px_hsl(var(--primary)/0.28)] transition-transform group-hover:scale-105" />
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
