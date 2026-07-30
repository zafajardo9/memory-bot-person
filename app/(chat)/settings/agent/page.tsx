import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getDefaultAgentForUser } from "@/db/agent-queries";

export default async function LegacyAgentSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const agent = await getDefaultAgentForUser(session.user.id);
  redirect(`/agents/${agent.id}/settings`);
}
