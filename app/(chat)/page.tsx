import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/custom/chat";
import { generateUUID } from "@/lib/utils";

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const id = generateUUID();
  return <Chat key={id} id={id} initialMessages={[]} />;
}
