import { NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteUserSkill,
  SkillNotFoundError,
  updateUserSkill,
} from "@/db/skill-queries";
import { getAuthenticatedUser } from "@/lib/auth/permissions";
import { updateSkillSchema } from "@/lib/skills";

const paramsSchema = z.object({ skillId: z.string().uuid() });

function routeError(error: unknown) {
  if (error instanceof SkillNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  const duplicate =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002";
  return NextResponse.json(
    {
      error: duplicate
        ? "That skill command is already in use."
        : error instanceof Error
          ? error.message
          : "Unable to update skill.",
    },
    { status: duplicate ? 409 : 400 },
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ skillId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { skillId } = paramsSchema.parse(await context.params);
    const input = updateSkillSchema.parse(await request.json());
    return NextResponse.json({
      skill: await updateUserSkill(user.id, skillId, input),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ skillId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { skillId } = paramsSchema.parse(await context.params);
    await deleteUserSkill(user.id, skillId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return routeError(error);
  }
}
