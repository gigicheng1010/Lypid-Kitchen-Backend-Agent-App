import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lypid Kitchen | Creator Ops",
  description: "Influencer marketing operations dashboard for Lypid Kitchen.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
