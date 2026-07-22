import { Navbar } from "@/components/custom/navbar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
