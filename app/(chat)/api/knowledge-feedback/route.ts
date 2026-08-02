import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { prisma } from "@/lib/prisma";

const feedbackSchema = z.object({
  queryLogId: z.string().uuid(),
  feedback: z.union([z.literal(1), z.literal(-1)]),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid feedback payload." },
      { status: 400 },
    );
  }

  const { queryLogId, feedback } = parsed.data;

  // Owner-only: the log row must belong to the requesting user.
  const log = await prisma.knowledgeQueryLog.findUnique({
    where: { id: queryLogId },
    select: { id: true, userId: true },
  });
  if (!log) {
    return NextResponse.json({ error: "Query log not found." }, { status: 404 });
  }
  if (log.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  await prisma.knowledgeQueryLog.update({
    where: { id: queryLogId },
    data: { feedback },
  });

  return NextResponse.json({ ok: true });
}
