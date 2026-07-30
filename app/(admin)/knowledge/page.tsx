import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { KnowledgeManager } from "@/components/knowledge/knowledge-manager";
import { getDefaultAgentForUser } from "@/db/agent-queries";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";

export default async function KnowledgePage() {
  if (!isKnowledgeManagementEnabled()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const agent = await getDefaultAgentForUser(session.user.id);
  return (
    <KnowledgeManager
      isAdmin={session.user.role === "ADMIN"}
      currentUserId={session.user.id}
      agentId={agent.id}
      agentName={agent.name}
    />
  );
}
