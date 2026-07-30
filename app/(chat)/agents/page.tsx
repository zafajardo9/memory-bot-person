import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { AgentStudio } from "@/components/agents/agent-studio";
import { listAgents } from "@/db/agent-queries";

export default async function AgentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const agents = await listAgents(session.user.id);
  return <AgentStudio initialAgents={agents} />;
}
