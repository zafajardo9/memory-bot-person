import { z } from "zod";

import { streamCompanyChat } from "@/ai/chat/stream-chat";
import { auth } from "@/app/(auth)/auth";
import { deleteChatById, getChatById, saveChat } from "@/db/queries";

import type { UIMessage } from "ai";

const chatRequestSchema = z.object({
  id: z.string().uuid(),
  messages: z.array(z.custom<UIMessage>()),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { id, messages } = chatRequestSchema.parse(await request.json());
    const { result } = await streamCompanyChat({
      chatId: id,
      messages,
      userId: session.user.id,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onFinish: async ({ messages: finishedMessages }) => {
        try {
          await saveChat({
            id,
            messages: finishedMessages,
            userId: session.user!.id!,
          });
        } catch (error) {
          console.error("Failed to save chat", error);
        }
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start the AI response.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new Response("Not Found", { status: 404 });

  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const chat = await getChatById({ id });
  if (!chat) return new Response("Not Found", { status: 404 });
  if (chat.userId !== session.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  await deleteChatById({ id });
  return new Response("Chat deleted", { status: 200 });
}
