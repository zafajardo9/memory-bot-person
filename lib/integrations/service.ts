import "server-only";

import { decryptSecret, encryptSecret } from "@/ai/providers/crypto";
import { prisma } from "@/lib/prisma";

import { getIntegrationDefinition } from "./registry";

import type { IntegrationCredentialStatus } from "./types";

async function integrationCredential(integrationId: string) {
  return prisma.integrationCredential.findUnique({
    where: { integrationId },
    include: { updatedBy: { select: { email: true } } },
  });
}

function environmentSecret(integrationId: string) {
  const definition = getIntegrationDefinition(integrationId);
  return process.env[definition.environmentKey]?.trim() || null;
}

export async function getIntegrationSecret(integrationId: string) {
  const credential = await integrationCredential(integrationId);
  if (credential) return decryptSecret(credential.encryptedValue);
  const fallback = environmentSecret(integrationId);
  if (fallback) return fallback;
  throw new Error(`${getIntegrationDefinition(integrationId).label} is not configured.`);
}

export async function getIntegrationCredentialStatus(
  integrationId: string,
): Promise<IntegrationCredentialStatus> {
  const definition = getIntegrationDefinition(integrationId);
  const credential = await integrationCredential(integrationId);
  const siteSecret = credential
    ? decryptSecret(credential.encryptedValue)
    : null;
  const fallback = environmentSecret(integrationId);
  const activeSecret = siteSecret ?? fallback;

  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    configured: Boolean(activeSecret),
    source: siteSecret ? "SITE" : fallback ? "ENVIRONMENT" : "NONE",
    maskedKey: activeSecret ? `••••••••${activeSecret.slice(-4)}` : null,
    updatedAt: credential?.updatedAt.toISOString() ?? null,
    updatedBy: credential?.updatedBy.email ?? null,
  };
}

export async function saveIntegrationCredential(input: {
  integrationId: string;
  apiKey: string;
  updatedById: string;
}) {
  const definition = getIntegrationDefinition(input.integrationId);
  const apiKey = definition.normalizeSecret(input.apiKey);
  await definition.testConnection(apiKey);
  await prisma.integrationCredential.upsert({
    where: { integrationId: input.integrationId },
    create: {
      integrationId: input.integrationId,
      encryptedValue: encryptSecret(apiKey),
      updatedById: input.updatedById,
    },
    update: {
      encryptedValue: encryptSecret(apiKey),
      updatedById: input.updatedById,
    },
  });
  return getIntegrationCredentialStatus(input.integrationId);
}

export async function removeIntegrationCredential(
  integrationId: string,
) {
  getIntegrationDefinition(integrationId);
  await prisma.integrationCredential.deleteMany({ where: { integrationId } });
  return getIntegrationCredentialStatus(integrationId);
}
