import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { KnowledgeManager } from "@/components/knowledge/knowledge-manager";
import { getAgentForUserDetailed } from "@/db/agent-queries";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";

export default async function AgentKnowledgePage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  if (!isKnowledgeManagementEnabled()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { agentId } = await params;
  const agent = await getAgentForUserDetailed(agentId, session.user.id);
  if (!agent) notFound();
  return (
    <KnowledgeManager
      isAdmin={session.user.role === "ADMIN"}
      currentUserId={session.user.id}
      agentId={agent.id}
      agentName={agent.name}
    />
  );
}
