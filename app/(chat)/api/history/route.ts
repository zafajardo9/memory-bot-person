import { auth } from "@/app/(auth)/auth";
import { getChatsByUserId } from "@/db/queries";

export async function GET(request: Request) {
  const session = await auth();

  if (!session || !session.user) {
    return Response.json("Unauthorized!", { status: 401 });
  }

  try {
    const agentId =
      new URL(request.url).searchParams.get("agentId") ?? undefined;
    const chats = await getChatsByUserId({ id: session.user.id, agentId });
    return Response.json(chats);
  } catch (error) {
    console.error("Unable to load chat history", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : "Unknown database error",
    });
    return Response.json(
      { error: "Chat history is temporarily unavailable." },
      { status: 503 },
    );
  }
}
