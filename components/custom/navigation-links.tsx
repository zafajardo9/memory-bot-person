"use client";

import { BookOpen, Bot, MessageSquareText, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavigationLinks({
  knowledgeEnabled,
}: {
  knowledgeEnabled: boolean;
}) {
  const pathname = usePathname();
  const notebookActive = pathname.startsWith("/knowledge");
  const chatActive = pathname === "/" || pathname.startsWith("/chat/");
  const agentActive = pathname.startsWith("/agents");
  const toolsActive = pathname === "/tools";

  return (
    <nav className="flex items-center gap-1" aria-label="Workspace navigation">
      <Link
        href="/"
        aria-current={chatActive ? "page" : undefined}
        className={`hidden h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors lg:flex ${
          chatActive
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        }`}
      >
        <MessageSquareText size={15} />
        Chat
      </Link>
      {knowledgeEnabled ? (
        <Link
          href="/knowledge"
          aria-current={notebookActive ? "page" : undefined}
          aria-label="Team notebook"
          className={`flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors sm:px-3 ${
            notebookActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          }`}
        >
          <BookOpen size={15} />
          <span>Notebook</span>
        </Link>
      ) : null}
      <Link
        href="/agents"
        aria-current={agentActive ? "page" : undefined}
        aria-label="Agent workspace"
        className={`hidden h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors xl:flex ${
          agentActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        }`}
      >
        <Bot size={15} />
        Agents
      </Link>
      <Link
        href="/tools"
        aria-current={toolsActive ? "page" : undefined}
        aria-label="Tool integrations"
        className={`hidden h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors xl:flex ${
          toolsActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        }`}
      >
        <Wrench size={15} />
        Tools
      </Link>
    </nav>
  );
}
