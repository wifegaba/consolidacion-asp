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
  themeColor: "#0f172a",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CRM Ministerial"
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "192x192", type: "image/png" }
    ]
  }
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
