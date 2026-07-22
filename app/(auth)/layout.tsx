import { AuthNavbar } from "@/components/custom/auth-navbar";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthNavbar />
      {children}
    </>
  );
}
