import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "@/trpc/client";
import { ThemeProvider } from "@/services/theme";
import { ThemeLoader } from "@/services/theme";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "@/styles/globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Hire",
  description:
    "AI-powered career fair platform — match roles, manage applications, and track your pipeline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${plusJakartaSans.variable} ${inter.variable}`}
      >
        <body className="font-[family-name:var(--font-plus-jakarta)] antialiased">
          <Suspense>
            <NuqsAdapter>
              <TRPCReactProvider>
                <ThemeProvider>
                  <ThemeLoader>{children}</ThemeLoader>
                </ThemeProvider>
              </TRPCReactProvider>
            </NuqsAdapter>
          </Suspense>
        </body>
      </html>
    </ClerkProvider>
  );
}
