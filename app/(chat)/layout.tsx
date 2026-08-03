import { ActiveAgentProvider } from "@/components/custom/active-agent-context";
import { Navbar } from "@/components/custom/navbar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ActiveAgentProvider>
      <Navbar />
      {children}
    </ActiveAgentProvider>
  );
}
