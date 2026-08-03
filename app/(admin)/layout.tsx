import { ActiveAgentProvider } from "@/components/custom/active-agent-context";
import { Navbar } from "@/components/custom/navbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ActiveAgentProvider>
      <Navbar />
      {children}
    </ActiveAgentProvider>
  );
}
