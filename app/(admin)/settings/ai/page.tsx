import { notFound, redirect } from "next/navigation";

import { listProviderStatuses } from "@/ai/providers/service";
import { auth } from "@/app/(auth)/auth";
import { AIProviderSettings } from "@/components/settings/ai-provider-settings";

export default async function AiSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") notFound();

  return <AIProviderSettings initialProviders={await listProviderStatuses()} />;
}
