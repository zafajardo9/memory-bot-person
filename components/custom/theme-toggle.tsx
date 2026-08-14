"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export const ThemeToggle = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const { setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      ref={ref}
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Use light theme" : "Use dark theme"}
      className={cn(
        "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full p-0 text-muted-foreground transition-colors hover:bg-foreground/[0.055] hover:text-foreground",
        className,
      )}
      {...props}
      onClick={(event) => {
        setTheme(isDark ? "light" : "dark");
        onClick?.(event);
      }}
    >
      {isDark ? (
        <Sun size={16} className="text-muted-foreground" />
      ) : (
        <Moon size={16} className="text-muted-foreground" />
      )}
    </button>
  );
});

ThemeToggle.displayName = "ThemeToggle";
