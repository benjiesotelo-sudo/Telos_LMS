import type { Metadata } from "next";
import { Geist, Geist_Mono, Marcellus_SC } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const marcellusSC = Marcellus_SC({
  variable: "--font-marcellus-sc",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Telos LMS",
  description: "Learning Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${marcellusSC.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
