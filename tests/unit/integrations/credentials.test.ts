import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  findUnique: vi.fn(),
  testConnection: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/ai/providers/crypto", () => ({
  decryptSecret: (value: string) => value.replace("encrypted:", ""),
  encryptSecret: (value: string) => `encrypted:${value}`,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    integrationCredential: {
      deleteMany: mocks.deleteMany,
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
    },
  },
}));
vi.mock("@/lib/integrations/registry", () => ({
  getIntegrationDefinition: () => ({
    id: "tavily",
    label: "Tavily",
    description: "Live web search",
    environmentKey: "TAVILY_API_KEY",
    normalizeSecret: (value: string) => value.trim(),
    testConnection: mocks.testConnection,
  }),
}));

import {
  getIntegrationCredentialStatus,
  getIntegrationSecret,
  removeIntegrationCredential,
  saveIntegrationCredential,
} from "@/lib/integrations/service";

describe("integration credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TAVILY_API_KEY;
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    mocks.upsert.mockResolvedValue({});
    mocks.testConnection.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.TAVILY_API_KEY;
  });

  it("uses a site-managed secret before the environment fallback", async () => {
    process.env.TAVILY_API_KEY = "environment-secret-0000";
    mocks.findUnique.mockResolvedValue({
      encryptedValue: "encrypted:site-secret-1234",
      updatedAt: new Date("2026-07-30T00:00:00Z"),
      updatedBy: { email: "admin@example.com" },
    });

    await expect(getIntegrationSecret("tavily")).resolves.toBe(
      "site-secret-1234",
    );
    await expect(getIntegrationCredentialStatus("tavily")).resolves.toMatchObject({
      configured: true,
      source: "SITE",
      maskedKey: "••••••••1234",
      updatedBy: "admin@example.com",
    });
  });

  it("falls back to an environment key when no site key exists", async () => {
    process.env.TAVILY_API_KEY = "environment-secret-5678";
    mocks.findUnique.mockResolvedValue(null);

    await expect(getIntegrationCredentialStatus("tavily")).resolves.toMatchObject({
      configured: true,
      source: "ENVIRONMENT",
      maskedKey: "••••••••5678",
    });
  });

  it("verifies and encrypts a new key before saving it", async () => {
    mocks.findUnique.mockResolvedValue({
      encryptedValue: "encrypted:new-secret-9012",
      updatedAt: new Date("2026-07-30T00:00:00Z"),
      updatedBy: { email: "admin@example.com" },
    });

    await saveIntegrationCredential({
      integrationId: "tavily",
      apiKey: " new-secret-9012 ",
      updatedById: "00000000-0000-4000-8000-000000000001",
    });

    expect(mocks.testConnection).toHaveBeenCalledWith("new-secret-9012");
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { integrationId: "tavily" },
      create: {
        integrationId: "tavily",
        encryptedValue: "encrypted:new-secret-9012",
        updatedById: "00000000-0000-4000-8000-000000000001",
      },
      update: {
        encryptedValue: "encrypted:new-secret-9012",
        updatedById: "00000000-0000-4000-8000-000000000001",
      },
    });
  });

  it("reveals the environment fallback after removing a saved key", async () => {
    process.env.TAVILY_API_KEY = "environment-secret-2468";
    mocks.findUnique.mockResolvedValue(null);

    await expect(removeIntegrationCredential("tavily")).resolves.toMatchObject({
      configured: true,
      source: "ENVIRONMENT",
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { integrationId: "tavily" },
    });
  });
});
