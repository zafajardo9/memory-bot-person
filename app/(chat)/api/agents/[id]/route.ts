import { NextResponse } from "next/server";

import {
  deleteAgent,
  getAgentForUser,
  setDefaultAgent,
  updateAgent,
} from "@/db/agent-queries";
import { updateAgentSchema } from "@/lib/agents";
import { getAuthenticatedUser } from "@/lib/auth/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const agent = await getAgentForUser(id, user.id);
  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  return NextResponse.json({ agent });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const body = await request.json();
    if (body?.makeDefault === true) {
      return NextResponse.json({ agent: await setDefaultAgent(id, user.id) });
    }
    return NextResponse.json({
      agent: await updateAgent(id, user.id, updateAgentSchema.parse(body)),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update agent." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    await deleteAgent(id, user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete agent." },
      { status: 400 },
    );
  }
}
