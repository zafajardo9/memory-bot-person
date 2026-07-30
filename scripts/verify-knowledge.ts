import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { prisma } = await import("../lib/prisma");
  const { createFileKnowledgeSource, approveKnowledgeVersion } = await import(
    "../db/knowledge-queries"
  );
  const { processKnowledgeJob } = await import("../lib/knowledge/ingestion");
  const { searchCompanyKnowledge } = await import("../lib/knowledge/retrieval");

  const user = await prisma.user.create({
    data: {
      email: `knowledge-smoke-${Date.now()}@example.invalid`,
      password: "smoke-test-only",
      role: "ADMIN",
    },
  });
  const agent = await prisma.agent.create({
    data: {
      userId: user.id,
      slug: "knowledge-smoke",
      name: "Knowledge smoke test",
      isDefault: true,
    },
  });

  let sourceId: string | undefined;
  try {
    const created = await createFileKnowledgeSource({
      title: "Knowledge Smoke Test",
      mimeType: "text/markdown",
      tags: ["smoke-test"],
      createdById: user.id,
      agentId: agent.id,
      bytes: new TextEncoder().encode(
        "# Outline Work\nThe weekly operations report must be prepared every Friday.\n\n## Approval\nThe team lead reviews and approves the report before distribution.",
      ),
    });
    sourceId = created.source.id;
    await processKnowledgeJob(created.job.id);

    const job = await prisma.knowledgeIngestionJob.findUnique({ where: { id: created.job.id } });
    const version = await prisma.knowledgeSourceVersion.findUnique({ where: { id: created.version.id } });
    if (job?.status !== "COMPLETED" || version?.status !== "READY") {
      throw new Error(job?.errorMessage ?? version?.errorMessage ?? "Knowledge ingestion did not complete");
    }

    await approveKnowledgeVersion(sourceId, version.id, user.id);
    const results = await searchCompanyKnowledge({
      query: "When should I prepare the operations report and who approves it?",
      userId: user.id,
      agentId: agent.id,
      limit: 3,
    });
    if (!results.some((result) => result.content.includes("every Friday"))) {
      throw new Error("Hybrid retrieval did not return the expected approved knowledge");
    }

    console.log(
      JSON.stringify({
        migration: "connected",
        ingestion: job.stage,
        chunks: await prisma.knowledgeChunk.count({ where: { versionId: version.id } }),
        retrievalResults: results.length,
        citation: results[0]?.citation,
      }),
    );
  } finally {
    await prisma.knowledgeQueryLog.deleteMany({ where: { userId: user.id } });
    if (sourceId) await prisma.knowledgeSource.deleteMany({ where: { id: sourceId } });
    await prisma.knowledgeAuditEvent.deleteMany({ where: { actorId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
