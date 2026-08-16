import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { prisma } = await import("../lib/prisma");

  const chats = await prisma.chat.findMany({
    orderBy: { createdAt: "desc" },
    take: 2,
    select: { id: true, createdAt: true, messages: true },
  });
  for (const chat of chats) {
    const msgs = chat.messages as Array<{
      role: string;
      parts?: Array<{ type: string; text?: string }>;
    }>;
    console.log("CHAT", chat.id, chat.createdAt.toISOString());
    for (const m of msgs ?? []) {
      const text = (m.parts ?? [])
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("")
        .slice(0, 200);
      console.log(" ", m.role.toUpperCase(), JSON.stringify(text));
    }
  }

  const total = await prisma.knowledgeQueryLog.count();
  console.log("TOTAL KnowledgeQueryLog rows:", total);
  const recent = await prisma.knowledgeQueryLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { query: true, resultCount: true, createdAt: true },
  });
  for (const row of recent) {
    console.log(
      "LOG:",
      JSON.stringify(row.query),
      "hits:",
      row.resultCount,
      row.createdAt.toISOString(),
    );
  }
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
