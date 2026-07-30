"use client";

import { ExternalLink } from "lucide-react";
import { Streamdown, type Components } from "streamdown";

import { normalizeChatMarkdown } from "@/lib/ai/chat-markdown";
import { cn } from "@/lib/utils";

import type { ComponentPropsWithoutRef, ElementType } from "react";

type MarkdownElementProps<T extends ElementType> =
  ComponentPropsWithoutRef<T> & {
    node?: unknown;
  };

const components = {
  a: ({
    children,
    className,
    href,
    node: _node,
    ...props
  }: MarkdownElementProps<"a">) => {
    const external = /^https?:\/\//i.test(href ?? "");

    return (
      <a
        {...props}
        href={href}
        className={cn(
          "font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary",
          className,
        )}
        rel={external ? "noopener noreferrer" : undefined}
        target={external ? "_blank" : undefined}
      >
        {children}
        {external ? (
          <ExternalLink
            size={11}
            className="ml-1 inline-block align-baseline"
            aria-hidden="true"
          />
        ) : null}
      </a>
    );
  },
  blockquote: ({
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<"blockquote">) => (
    <blockquote
      {...props}
      className={cn(
        "my-4 rounded-r-lg border-l-2 border-primary/40 bg-primary/[0.04] py-2 pl-4 pr-3 text-foreground/85",
        className,
      )}
    />
  ),
  h1: ({
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<"h1">) => (
    <h1
      {...props}
      className={cn(
        "mb-3 mt-6 text-xl font-semibold leading-tight tracking-[-0.02em] first:mt-0",
        className,
      )}
    />
  ),
  h2: ({
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<"h2">) => (
    <h2
      {...props}
      className={cn(
        "mb-2.5 mt-6 text-lg font-semibold leading-snug tracking-[-0.015em] first:mt-0",
        className,
      )}
    />
  ),
  h3: ({
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<"h3">) => (
    <h3
      {...props}
      className={cn(
        "mb-2 mt-5 text-[15px] font-semibold leading-snug first:mt-0",
        className,
      )}
    />
  ),
  hr: ({
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<"hr">) => (
    <hr {...props} className={cn("my-5 border-border/80", className)} />
  ),
  li: ({
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<"li">) => (
    <li
      {...props}
      className={cn(
        "pl-1 leading-7 marker:font-medium marker:text-primary/70",
        className,
      )}
    />
  ),
  ol: ({
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<"ol">) => (
    <ol
      {...props}
      className={cn("my-3 list-decimal space-y-1.5 pl-5", className)}
    />
  ),
  p: ({
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<"p">) => (
    <p
      {...props}
      className={cn(
        "my-3 text-pretty leading-7 first:mt-0 last:mb-0",
        className,
      )}
    />
  ),
  strong: ({
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<"strong">) => (
    <strong
      {...props}
      className={cn("font-semibold text-foreground", className)}
    />
  ),
  table: ({
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<"table">) => (
    <div className="my-4 max-w-full overflow-x-auto rounded-lg border">
      <table
        {...props}
        className={cn("w-full min-w-[32rem] text-sm", className)}
      />
    </div>
  ),
  td: ({
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<"td">) => (
    <td
      {...props}
      className={cn(
        "border-b border-r p-2.5 align-top last:border-r-0",
        className,
      )}
    />
  ),
  th: ({
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<"th">) => (
    <th
      {...props}
      className={cn(
        "border-b border-r bg-muted/70 p-2.5 text-left text-xs font-semibold last:border-r-0",
        className,
      )}
    />
  ),
  ul: ({
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<"ul">) => (
    <ul
      {...props}
      className={cn("my-3 list-disc space-y-1.5 pl-5", className)}
    />
  ),
} satisfies Components;

export function ChatMarkdown({
  children,
  streaming = false,
}: {
  children: string;
  streaming?: boolean;
}) {
  return (
    <Streamdown
      className="min-w-0 break-words text-[15px]"
      components={components}
      controls={{ code: true, table: true }}
      lineNumbers={false}
      mode={streaming ? "streaming" : "static"}
      normalizeHtmlIndentation
      skipHtml
    >
      {normalizeChatMarkdown(children)}
    </Streamdown>
  );
}
