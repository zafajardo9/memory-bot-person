import { notFound, redirect } from "next/navigation";

import { listProviderStatuses } from "@/ai/providers/service";
import { auth } from "@/app/(auth)/auth";
import { AIProviderSettings } from "@/components/settings/ai-provider-settings";
import { getKnowledgeAISettings } from "@/lib/knowledge/embedding-settings";

export default async function AiSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") notFound();

  const [providers, knowledgeSettings] = await Promise.all([
    listProviderStatuses(),
    getKnowledgeAISettings(),
  ]);

  return (
    <AIProviderSettings
      initialProviders={providers}
      initialKnowledgeSettings={knowledgeSettings}
    />
  );
}
