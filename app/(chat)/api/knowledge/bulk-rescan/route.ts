import { after, NextResponse } from "next/server";
import { z } from "zod";

import { createRescanJobs, listKnowledgeSourceOwners } from "@/db/knowledge-queries";
import { getAuthenticatedUser } from "@/lib/auth/permissions";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";
import { processKnowledgeJob } from "@/lib/knowledge/ingestion";
import { assertKnowledgeWriteRateLimit } from "@/lib/knowledge/rate-limit";
import { withTransientRetry } from "@/lib/prisma";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

// Bulk refresh queues many ingestion jobs post-response; 60s keeps it under the
// Hobby plan hard kill while Pro honors up to 300s.
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isKnowledgeManagementEnabled()) return new NextResponse(null, { status: 404 });
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { ids } = schema.parse(await request.json());
    const owners = await withTransientRetry(() => listKnowledgeSourceOwners(ids));
    if (owners.length !== ids.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (
      user.role !== "ADMIN" &&
      owners.some((source) => source.createdById !== user.id)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await assertKnowledgeWriteRateLimit(user.id, ids.length);

    const jobs = await createRescanJobs(ids, user.id);
    after(() => {
      // Process sequentially to bound concurrent load; each job has its own
      // error handling inside processKnowledgeJob.
      return jobs.reduce(
        (chain, { job }) => chain.then(() => processKnowledgeJob(job.id)),
        Promise.resolve(),
      );
    });
    return NextResponse.json(
      { jobs: jobs.map(({ job }) => job), count: jobs.length },
      { status: 202 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to refresh sources" },
      { status: 400 },
    );
  }
}
