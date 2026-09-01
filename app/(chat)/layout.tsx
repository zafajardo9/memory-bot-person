import { auth } from "@/app/(auth)/auth";
import { ActiveAgentProvider } from "@/components/custom/active-agent-context";
import { ChatSidebar } from "@/components/custom/chat-sidebar";
import { Navbar } from "@/components/custom/navbar";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const accountName = session?.user?.name ?? session?.user?.email ?? "";
  const monogram = (accountName.charAt(0) || "M").toUpperCase();

  return (
    <ActiveAgentProvider>
      <div className="flex">
        <div className="sticky top-0 hidden h-dvh shrink-0 md:block">
          <ChatSidebar workspace={{ name: "Memory", monogram }} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar />
          {children}
        </div>
      </div>
    </ActiveAgentProvider>
  );
}
