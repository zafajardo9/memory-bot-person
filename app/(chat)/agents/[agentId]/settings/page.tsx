import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { AgentSettingsPanel } from "@/components/settings/agent-settings";
import { getAgentForUser } from "@/db/agent-queries";
import { queryUserMemories } from "@/db/memory-queries";
import { agentSettingsFromProfile } from "@/lib/agents";

export default async function AgentSettingsPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { agentId } = await params;
  const agent = await getAgentForUser(agentId, session.user.id);
  if (!agent) notFound();
  const memories = await queryUserMemories({
    userId: session.user.id,
    agentId,
    limit: 200,
  });
  return (
    <AgentSettingsPanel
      agentId={agent.id}
      initialSettings={agentSettingsFromProfile(agent)}
      initialEnabledTools={agent.enabledTools}
      initialMemories={memories.map((memory) => ({
        ...memory,
        createdAt: memory.createdAt.toISOString(),
        updatedAt: memory.updatedAt.toISOString(),
      }))}
    />
  );
}
