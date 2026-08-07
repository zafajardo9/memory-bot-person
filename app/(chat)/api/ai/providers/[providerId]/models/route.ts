import { NextResponse } from "next/server";

import { getProviderModels, providerExists } from "@/ai/providers/service";
import { getAuthenticatedUser } from "@/lib/auth/permissions";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { providerId } = await params;
  if (!(await providerExists(providerId))) {
    return NextResponse.json({ error: "Unknown AI provider" }, { status: 404 });
  }
  try {
    const forceRefresh = new URL(request.url).searchParams.get("refresh") === "true";
    const models = await getProviderModels(providerId, {
      forceRefresh,
      requireEnabled: user.role !== "ADMIN",
    });
    return NextResponse.json({ models });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list models" },
      { status: 400 },
    );
  }
}
