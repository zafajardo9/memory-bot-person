import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-black/[0.07] bg-white/60 px-3 py-2 text-sm ring-offset-background transition-[background-color,border-color,box-shadow] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary/30 focus-visible:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/12 dark:border-white/[0.08] dark:bg-white/[0.045] dark:focus-visible:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
