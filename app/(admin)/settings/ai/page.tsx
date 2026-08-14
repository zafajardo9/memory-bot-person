import { notFound, redirect } from "next/navigation";

import { getWorkspaceAISettings } from "@/ai/providers/research-settings";
import { listProviderStatuses } from "@/ai/providers/service";
import { auth } from "@/app/(auth)/auth";
import { AIProviderSettings } from "@/components/settings/ai-provider-settings";
import { getKnowledgeAISettings } from "@/lib/knowledge/embedding-settings";

export default async function AiSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") notFound();

  const [providers, knowledgeSettings, researchSettings] = await Promise.all([
    listProviderStatuses(),
    getKnowledgeAISettings(),
    getWorkspaceAISettings(),
  ]);

  return (
    <AIProviderSettings
      initialProviders={providers}
      initialKnowledgeSettings={knowledgeSettings}
      initialResearchSettings={researchSettings}
    />
  );
}
