import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CompanyNow — Someone nearby. A moment together.",
  description:
    "An opt-in nearby connection app for spontaneous company while walking, travelling, having coffee, exercising, waiting, or simply talking.",
  applicationName: "CompanyNow",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07110f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
