"use client";

import { AlertCircle, RotateCcw, X } from "lucide-react";

import { classifyClientChatError } from "@/lib/ai/chat-errors";

export function ChatErrorNotice({
  error,
  onDismiss,
  onRetry,
}: {
  error: Error;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const publicError = classifyClientChatError(error);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 border-b border-amber-500/20 bg-amber-500/[0.07] px-4 py-3"
    >
      <AlertCircle
        size={17}
        className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {publicError.title}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {publicError.message}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline decoration-amber-500/40 underline-offset-4 hover:decoration-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw size={12} />
            Try again
          </button>
          <span className="text-[11px] text-muted-foreground">
            Or select another model above.
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss model error"
        title="Dismiss"
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-amber-500/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={14} />
      </button>
    </div>
  );
}
