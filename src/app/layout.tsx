import type { Metadata, Viewport } from "next";
import { APP_NAME } from "@/lib/config";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: `${APP_NAME} — your collaboration space: ideas, briefs, tasks and a shared content calendar.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d8073",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
