import { NextResponse } from "next/server";

import {
  countUserSkills,
  createUserSkill,
  listUserSkills,
} from "@/db/skill-queries";
import { getAuthenticatedUser } from "@/lib/auth/permissions";
import {
  createSkillSchema,
  isChatSkillsEnabled,
  normalizeSkillSlug,
  SKILL_LIMITS,
} from "@/lib/skills";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to save skill.";
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    enabled: isChatSkillsEnabled(),
    skills: await listUserSkills(user.id),
  });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = createSkillSchema.parse(await request.json());
    if ((await countUserSkills(user.id)) >= SKILL_LIMITS.maxPerUser) {
      return NextResponse.json(
        { error: `You can save up to ${SKILL_LIMITS.maxPerUser} skills.` },
        { status: 409 },
      );
    }
    const skill = await createUserSkill(user.id, {
      ...parsed,
      slug: parsed.slug ?? normalizeSkillSlug(parsed.name),
    });
    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    const duplicate =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002";
    return NextResponse.json(
      { error: duplicate ? "That skill command is already in use." : errorMessage(error) },
      { status: duplicate ? 409 : 400 },
    );
  }
}
