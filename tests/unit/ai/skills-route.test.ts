import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  listUserSkills: vi.fn(),
  countUserSkills: vi.fn(),
  createUserSkill: vi.fn(),
  updateUserSkill: vi.fn(),
  deleteUserSkill: vi.fn(),
}));

vi.mock("@/lib/auth/permissions", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));
vi.mock("@/db/skill-queries", () => ({
  SkillNotFoundError: class SkillNotFoundError extends Error {},
  listUserSkills: mocks.listUserSkills,
  countUserSkills: mocks.countUserSkills,
  createUserSkill: mocks.createUserSkill,
  updateUserSkill: mocks.updateUserSkill,
  deleteUserSkill: mocks.deleteUserSkill,
}));

import { DELETE, PATCH } from "@/app/(chat)/api/ai/skills/[skillId]/route";
import { GET, POST } from "@/app/(chat)/api/ai/skills/route";

const skillId = "00000000-0000-4000-8000-000000000001";

describe("user skills routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listUserSkills.mockResolvedValue([]);
    mocks.countUserSkills.mockResolvedValue(0);
  });

  it("requires authentication", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(
      (
        await POST(
          new Request("http://localhost/api/ai/skills", {
            method: "POST",
            body: JSON.stringify({ name: "Brief", instructions: "Summarize." }),
          }),
        )
      ).status,
    ).toBe(401);
  });

  it("creates a normalized owner-scoped skill", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mocks.createUserSkill.mockResolvedValue({ id: skillId, slug: "quick-brief" });
    const response = await POST(
      new Request("http://localhost/api/ai/skills", {
        method: "POST",
        body: JSON.stringify({ name: "Quick Brief", instructions: "Summarize." }),
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.createUserSkill).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ slug: "quick-brief" }),
    );
  });

  it("uses the authenticated owner for updates and deletes", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "owner" });
    mocks.updateUserSkill.mockResolvedValue({ id: skillId, enabled: false });
    const context = { params: Promise.resolve({ skillId }) };
    expect(
      (
        await PATCH(
          new Request(`http://localhost/api/ai/skills/${skillId}`, {
            method: "PATCH",
            body: JSON.stringify({ enabled: false }),
          }),
          context,
        )
      ).status,
    ).toBe(200);
    expect(mocks.updateUserSkill).toHaveBeenCalledWith("owner", skillId, {
      enabled: false,
    });

    mocks.deleteUserSkill.mockResolvedValue(undefined);
    expect(
      (
        await DELETE(
          new Request(`http://localhost/api/ai/skills/${skillId}`, {
            method: "DELETE",
          }),
          context,
        )
      ).status,
    ).toBe(204);
    expect(mocks.deleteUserSkill).toHaveBeenCalledWith("owner", skillId);
  });
});
