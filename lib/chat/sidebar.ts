import type { SidebarRecent } from "@/components/primitives/SidebarNav";
import type { ChatSummary } from "@/db/types";

interface AgentIdentity {
  id: string;
  name: string;
  color: string;
}

const AGENT_BADGE_CLASSES: Record<string, string> = {
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  slate: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
};

export function agentBadgeClass(color: string | undefined) {
  return (
    (color ? AGENT_BADGE_CLASSES[color] : undefined) ??
    "bg-hover-2 text-ink-2"
  );
}

export function sessionLabel(session: ChatSummary) {
  return session.title.trim() || "Untitled chat";
}

export function sessionsToRecents(
  sessions: ChatSummary[] | undefined,
  agents: AgentIdentity[] | undefined = [],
): SidebarRecent[] {
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  return (sessions ?? []).map((session) => {
    const agent = agentsById.get(session.agentId);
    return {
      id: session.id,
      label: sessionLabel(session),
      ...(agent
        ? {
            agent: {
              name: agent.name,
              monogram: agent.name.charAt(0).toUpperCase(),
              badgeClassName: agentBadgeClass(agent.color),
            },
          }
        : {}),
    };
  });
}

export function activeChatTitle(
  pathname: string,
  sessions: ChatSummary[] | undefined,
): string | null {
  const match = pathname.match(/^\/chat\/([^/]+)$/);
  if (!match) return null;
  const session = (sessions ?? []).find((item) => item.id === match[1]);
  return session ? sessionLabel(session) : null;
}
