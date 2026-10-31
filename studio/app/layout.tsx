import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ParadoXSoftware — Ideas into applications",
  description: "Explore ParadoXSoftware and our applications for mobile, desktop, and the web.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/company-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
