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
      className={cn("flex w-full cursor-pointer items-center gap-3", className)}
      {...props}
      onClick={(event) => {
        setTheme(isDark ? "light" : "dark");
        onClick?.(event);
      }}
    >
      {isDark ? (
        <Sun size={15} className="text-muted-foreground" />
      ) : (
        <Moon size={15} className="text-muted-foreground" />
      )}
      {isDark ? "Use light theme" : "Use dark theme"}
    </button>
  );
});

ThemeToggle.displayName = "ThemeToggle";
