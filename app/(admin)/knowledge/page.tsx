import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { KnowledgeManager } from "@/components/knowledge/knowledge-manager";
import { getAgentForUserDetailed, getDefaultAgentForUser } from "@/db/agent-queries";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  if (!isKnowledgeManagementEnabled()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // The agent is part of the URL (?agent=<id>) so each agent's notebook is its
  // own addressable page — refreshing keeps the selected agent and tabs can be
  // opened per agent. Falls back to the default agent when missing/invalid.
  const { agent: agentParam } = await searchParams;
  const selected = agentParam
    ? await getAgentForUserDetailed(agentParam, session.user.id)
    : null;
  if (agentParam && !selected) redirect("/knowledge");
  const agent = selected ?? (await getDefaultAgentForUser(session.user.id));

  return (
    <KnowledgeManager
      isAdmin={session.user.role === "ADMIN"}
      currentUserId={session.user.id}
      agentId={agent.id}
      agentName={agent.name}
    />
  );
}
