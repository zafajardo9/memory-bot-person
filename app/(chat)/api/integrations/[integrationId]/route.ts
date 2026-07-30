import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminUser } from "@/lib/auth/permissions";
import { isIntegrationId } from "@/lib/integrations/registry";
import {
  getIntegrationCredentialStatus,
  removeIntegrationCredential,
  saveIntegrationCredential,
} from "@/lib/integrations/service";

function invalidIntegration(integrationId: string) {
  if (!isIntegrationId(integrationId)) {
    return NextResponse.json({ error: "Unknown integration" }, { status: 404 });
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { integrationId } = await params;
  const invalid = invalidIntegration(integrationId);
  if (invalid) return invalid;
  return NextResponse.json({
    integration: await getIntegrationCredentialStatus(integrationId),
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { integrationId } = await params;
  const invalid = invalidIntegration(integrationId);
  if (invalid) return invalid;

  try {
    const { apiKey } = z
      .object({ apiKey: z.string().trim().min(1).max(500) })
      .parse(await request.json());
    return NextResponse.json({
      integration: await saveIntegrationCredential({
        integrationId,
        apiKey,
        updatedById: admin.id,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save API key",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { integrationId } = await params;
  const invalid = invalidIntegration(integrationId);
  if (invalid) return invalid;
  return NextResponse.json({
    integration: await removeIntegrationCredential(integrationId),
  });
}
