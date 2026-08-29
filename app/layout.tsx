import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import { TimerProvider } from "@/context/TimerContext";
import { AppShell } from "@/components/navigation/AppShell";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "FaithSync | Spiritual Habit Tracking & Accountability",
  description: "Sync your spiritual walk. Track prayer, scripture, study, and grow with faithful buddies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#FAF6EE] text-[#0E0E0E] selection:bg-[#FBBF24]/30">
        <TimerProvider>
          <AppShell>
            {children}
          </AppShell>
        </TimerProvider>
      </body>
    </html>
  );
}
