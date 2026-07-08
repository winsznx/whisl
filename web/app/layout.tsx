import type { Metadata } from "next";
import { Anton, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Whisl · turn the whistle into settlement",
  description:
    "A peer to peer football settlement room. Friends pledge into one pot, a referee confirms the result on the room, and the reward pays out in USD-T. No central server.",
  openGraph: {
    title: "Whisl · turn the whistle into settlement",
    description:
      "Capture the moment, let the room confirm it, and pay out in USD-T. Built on Pears, QVAC, and WDK.",
    type: "website",
    siteName: "Whisl",
  },
  twitter: {
    card: "summary_large_image",
    title: "Whisl · turn the whistle into settlement",
    description:
      "Capture the moment, let the room confirm it, and pay out in USD-T. Built on Pears, QVAC, and WDK.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${anton.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
