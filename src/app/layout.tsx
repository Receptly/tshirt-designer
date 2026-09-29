import type { Metadata } from "next";
import Script from "next/script";
import { createElement } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Garment Designer",
  description: "Workshop garment design studio",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        {children}
        {createElement("receptly-convai", { "agent-id": "agent_4201kq8k58wre8vaxw9tsq6bc5sh" })}
        <Script src="https://cdn.jsdelivr.net/gh/Receptly/Receptly-convai@v1.0.1/receptly-convai.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
