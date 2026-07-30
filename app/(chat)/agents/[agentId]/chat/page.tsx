import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/custom/chat";
import { getAgentForUser } from "@/db/agent-queries";
import { generateUUID } from "@/lib/utils";

export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { agentId } = await params;
  const agent = await getAgentForUser(agentId, session.user.id);
  if (!agent) notFound();
  const id = generateUUID();
  return (
    <Chat
      key={id}
      id={id}
      initialMessages={[]}
      agentId={agent.id}
      agentName={agent.name}
    />
  );
}
