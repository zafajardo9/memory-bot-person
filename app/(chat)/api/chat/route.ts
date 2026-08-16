import { z } from "zod";

import { streamCompanyChat } from "@/ai/chat/stream-chat";
import { extractAndSaveMemories } from "@/ai/memory/extraction";
import { auth } from "@/app/(auth)/auth";
import { deleteChatById, getChatById, saveChat } from "@/db/queries";
import { publicChatErrorMessage } from "@/lib/ai/chat-errors";
import {
  isAutoMemoryEnabled,
  isUserMemoryEnabled,
} from "@/lib/memory/config";

import type { ChatMessageMetadata } from "@/lib/skills";
import type { UIMessage } from "ai";

type ChatUIMessage = UIMessage<ChatMessageMetadata>;

const chatRequestSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  messages: z.array(z.custom<ChatUIMessage>()),
  researchDepth: z.enum(["quick", "deep"]).optional(),
  humanizerEnabled: z.boolean().optional(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  let parsed: z.infer<typeof chatRequestSchema>;
  try {
    const result = chatRequestSchema.safeParse(await request.json());
    if (!result.success) {
      return Response.json(
        { error: "Invalid chat request." },
        { status: 400 },
      );
    }
    parsed = result.data;
  } catch {
    return Response.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const { id, agentId, messages, researchDepth, humanizerEnabled } = parsed;
  const existingChat = await getChatById({ id });
  // Reject foreign chats before any model work; saveChat enforces this again
  // on write, but only after a full streamed answer has been paid for.
  if (existingChat && existingChat.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const resolvedDepth =
    researchDepth ?? existingChat?.researchDepth ?? "quick";

  try {
    const { result, extractionModel, memoryEnabled, appliedSkill } =
      await streamCompanyChat({
        chatId: id,
        messages,
        userId: session.user.id,
        agentId,
        researchDepth: resolvedDepth,
        humanizerEnabled: humanizerEnabled ?? true,
      });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      sendReasoning: true,
      sendSources: true,
      messageMetadata: appliedSkill ? () => ({ appliedSkill }) : undefined,
      onError: publicChatErrorMessage,
      onFinish: async ({ messages: finishedMessages }) => {
        try {
          await saveChat({
            id,
            messages: finishedMessages,
            userId: session.user!.id!,
            agentId,
            researchDepth: resolvedDepth,
          });
          if (memoryEnabled && isUserMemoryEnabled() && isAutoMemoryEnabled()) {
            try {
              await extractAndSaveMemories({
                messages: finishedMessages,
                userId: session.user!.id!,
                agentId,
                model: extractionModel,
              });
            } catch (error) {
              console.error("Automatic memory extraction failed", error);
            }
          }
        } catch (error) {
          console.error("Failed to save chat", error);
        }
      },
    });
  } catch (error) {
    console.error("Failed to start chat stream", error);
    return Response.json(
      { error: "Unable to start the AI response." },
      { status: 500 },
    );
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
