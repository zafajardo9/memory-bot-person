import { NextResponse } from "next/server";

import {
  getUserAgentSettings,
  saveUserAgentSettings,
} from "@/db/agent-settings-queries";
import { agentSettingsSchema } from "@/lib/agent-settings";
import { getAuthenticatedUser } from "@/lib/auth/permissions";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    settings: await getUserAgentSettings(user.id),
  });
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const input = agentSettingsSchema.parse(await request.json());
    return NextResponse.json({
      settings: await saveUserAgentSettings(user.id, input),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save agent settings.",
      },
      { status: 400 },
    );
  }
}
