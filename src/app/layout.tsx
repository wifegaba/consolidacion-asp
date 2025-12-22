// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import ClickToComponentClient from "./ClickToComponentClient";
import { ToastProvider } from "@/components/ToastProvider";
import SplashScreenWrapper from "@/components/SplashScreenWrapper";

export const metadata: Metadata = {
  title: "CRM Ministerial",
  description: "Sistema de gestión de servidores, estudiantes y asistencias",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CRM Ministerial"
  },
  icons: {
    shortcut: "/favicon.ico",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "192x192", type: "image/png" }
    ]
  }
};

// Viewport must be exported separately in Next.js 15+
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f172a"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {/* ✅ Activado solo en desarrollo */}
        <ClickToComponentClient />
        <SplashScreenWrapper>
          <ToastProvider>{children}</ToastProvider>
        </SplashScreenWrapper>
      </body>
    </html>
  );
}
