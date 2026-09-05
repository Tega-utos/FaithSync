import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import { TimerProvider } from "@/context/TimerContext";
import { AppShell } from "@/components/navigation/AppShell";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
  colorScheme: "light dark",
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
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('faithsync_theme')||localStorage.getItem('theme');var d=s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d){r.classList.add('dark');r.setAttribute('data-theme','dark');}else{r.classList.remove('dark');r.setAttribute('data-theme','light');}}catch(_){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-text-primary selection:bg-[#FBBF24]/30">
        <ThemeProvider>
          <TimerProvider>
            <AppShell>
              {children}
            </AppShell>
          </TimerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
