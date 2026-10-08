import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from '@/components/theme-provider';
export const metadata: Metadata = { title: "Avenli — Make room for what matters", description: "A calmer personal workspace for tasks, meaningful goals, and focused days.", icons: { icon: "/favicon.svg" } };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en" suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider></body></html>; }

