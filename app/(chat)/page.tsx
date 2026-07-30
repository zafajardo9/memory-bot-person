import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/custom/chat";
import { getDefaultAgentForUser } from "@/db/agent-queries";
import { generateUUID } from "@/lib/utils";

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const id = generateUUID();
  const agent = await getDefaultAgentForUser(session.user.id);
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
