import "server-only";

import {
  agentSettingsSchema,
  DEFAULT_AGENT_SETTINGS,
  type AgentSettings,
} from "@/lib/agent-settings";
import { prisma } from "@/lib/prisma";

export async function getUserAgentSettings(
  userId: string,
): Promise<AgentSettings> {
  if (!("userAgentSettings" in prisma) || !prisma.userAgentSettings) {
    console.warn(
      "Agent settings are unavailable on the active Prisma client. Restart the development server after generating the client.",
    );
    return { ...DEFAULT_AGENT_SETTINGS };
  }

  const settings = await prisma.userAgentSettings.findUnique({
    where: { userId },
    select: {
      agentName: true,
      mood: true,
      responseLength: true,
      customInstructions: true,
    },
  });

  if (!settings) return { ...DEFAULT_AGENT_SETTINGS };
  return agentSettingsSchema.parse(settings);
}

export async function saveUserAgentSettings(
  userId: string,
  input: AgentSettings,
): Promise<AgentSettings> {
  if (!("userAgentSettings" in prisma) || !prisma.userAgentSettings) {
    throw new Error(
      "Agent settings are not available yet. Restart the development server and try again.",
    );
  }

  const settings = agentSettingsSchema.parse(input);
  const saved = await prisma.userAgentSettings.upsert({
    where: { userId },
    create: { userId, ...settings },
    update: settings,
    select: {
      agentName: true,
      mood: true,
      responseLength: true,
      customInstructions: true,
    },
  });
  return agentSettingsSchema.parse(saved);
}
