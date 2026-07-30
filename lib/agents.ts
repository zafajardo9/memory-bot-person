import { z } from "zod";

import {
  AGENT_MOODS,
  RESPONSE_LENGTHS,
} from "@/lib/agent-settings";

export const AGENT_TOOLS = [
  "knowledge",
  "memory",
  "web",
  "browser",
  "weather",
  "flights",
] as const;

export type AgentTool = (typeof AGENT_TOOLS)[number];

export const AGENT_AVATARS = [
  "spark",
  "compass",
  "brain",
  "book",
  "code",
  "briefcase",
] as const;

export const AGENT_COLORS = [
  "violet",
  "blue",
  "emerald",
  "amber",
  "rose",
  "slate",
] as const;

const profileFields = {
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(240).default(""),
  avatar: z.enum(AGENT_AVATARS).default("spark"),
  color: z.enum(AGENT_COLORS).default("violet"),
  mood: z.enum(AGENT_MOODS).default("balanced"),
  responseLength: z.enum(RESPONSE_LENGTHS).default("balanced"),
  customInstructions: z.string().trim().max(6000).default(""),
  providerId: z.string().trim().min(1).max(50).nullable().optional(),
  modelId: z.string().trim().min(1).max(200).nullable().optional(),
  enabledTools: z.array(z.enum(AGENT_TOOLS)).max(AGENT_TOOLS.length).default([...AGENT_TOOLS]),
};

export const createAgentSchema = z.object(profileFields);
export const updateAgentSchema = z.object(profileFields).partial();

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

export function agentSettingsFromProfile(profile: {
  name: string;
  mood: string;
  responseLength: string;
  customInstructions: string;
}) {
  return {
    agentName: profile.name,
    mood: z.enum(AGENT_MOODS).parse(profile.mood),
    responseLength: z.enum(RESPONSE_LENGTHS).parse(profile.responseLength),
    customInstructions: profile.customInstructions,
  };
}

export function toolEnabled(enabledTools: string[], tool: AgentTool) {
  return enabledTools.includes(tool);
}
