import { Xray } from "@stinsky/xray";
import { Metadata } from "next";
import { Toaster } from "sonner";

import { AppBackground } from "@/components/custom/app-background";
import { ReactGrabDev } from "@/components/custom/react-grab-dev";
import { ThemeProvider } from "@/components/custom/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://gemini.vercel.ai"),
  title: "Kairo — Company knowledge assistant",
  description: "Capture, organize, and ask questions across your company knowledge.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppBackground />
          <Toaster position="top-center" richColors closeButton />
          {process.env.NODE_ENV === "development" ? <ReactGrabDev /> : null}
          <div className="relative z-10 min-h-dvh">{children}</div>
          {process.env.NODE_ENV === "development" ? (
            <Xray color="#639ee8" />
          ) : null}
        </ThemeProvider>
      </body>
    </html>
  );
}
