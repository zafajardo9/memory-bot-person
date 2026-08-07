import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createCustomProvider,
  listProviderStatuses,
} from "@/ai/providers/service";
import { getAdminUser } from "@/lib/auth/permissions";

export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({
    providers: await listProviderStatuses(),
    canConfigure: user.role === "ADMIN",
  });
}

const customProviderSchema = z.object({
  label: z.string().trim().min(2).max(80),
  baseUrl: z.string().trim().min(1).max(500),
  apiKey: z.string().trim().max(500).optional(),
  modelIds: z.array(z.string().trim().min(1).max(200)).min(1).max(50),
});

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = customProviderSchema.parse(await request.json());
    return NextResponse.json(
      {
        provider: await createCustomProvider({
          ...body,
          updatedById: admin.id,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add provider" },
      { status: 400 },
    );
  }
}
