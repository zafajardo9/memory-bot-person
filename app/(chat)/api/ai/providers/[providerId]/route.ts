import { NextResponse } from "next/server";
import { z } from "zod";

import { isAIProviderId } from "@/ai/providers/registry";
import {
  getProviderStatus,
  removeSiteProviderKey,
  saveProviderConfiguration,
  testProviderConnection,
} from "@/ai/providers/service";
import { getAdminUser } from "@/lib/auth/permissions";

const providerConfigSchema = z.object({
  apiKey: z.string().trim().max(500).optional(),
  enabled: z.boolean(),
  defaultModelId: z.string().trim().max(200).optional(),
});

function validProvider(providerId: string) {
  if (!isAIProviderId(providerId)) {
    return NextResponse.json({ error: "Unknown AI provider" }, { status: 404 });
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { providerId } = await params;
  const invalid = validProvider(providerId);
  if (invalid) return invalid;
  return NextResponse.json({ provider: await getProviderStatus(providerId) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { providerId } = await params;
  const invalid = validProvider(providerId);
  if (invalid) return invalid;
  try {
    const body = await request.json().catch(() => ({}));
    const apiKey = z.string().trim().max(500).optional().parse(body.apiKey);
    return NextResponse.json(await testProviderConnection(providerId, apiKey));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection test failed" },
      { status: 400 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { providerId } = await params;
  const invalid = validProvider(providerId);
  if (invalid) return invalid;
  try {
    const body = providerConfigSchema.parse(await request.json());
    return NextResponse.json({
      provider: await saveProviderConfiguration({
        providerId,
        ...body,
        updatedById: admin.id,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save provider" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { providerId } = await params;
  const invalid = validProvider(providerId);
  if (invalid) return invalid;
  return NextResponse.json({
    provider: await removeSiteProviderKey(providerId, admin.id),
  });
}
