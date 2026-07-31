import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat as PreviewChat } from "@/components/custom/chat";
import { getAgentForUserDetailed } from "@/db/agent-queries";
import { getChatById } from "@/db/queries";
import { convertToUIMessages } from "@/lib/utils";

import type { Chat } from "@/db/types";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const chatFromDb = await getChatById({ id });

  if (!chatFromDb) {
    notFound();
  }

  // type casting and converting messages to UI messages
  const chat: Chat = {
    ...chatFromDb,
    messages: convertToUIMessages(chatFromDb.messages as unknown[]),
  };

  if (session.user.id !== chat.userId) {
    return notFound();
  }

  const agent = await getAgentForUserDetailed(chat.agentId, session.user.id);
  if (!agent) return notFound();
  return (
    <PreviewChat
      id={chat.id}
      initialMessages={chat.messages}
      agentId={agent.id}
      agentName={agent.name}
    />
  );
}
