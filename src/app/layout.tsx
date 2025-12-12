// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import ClickToComponentClient from "./ClickToComponentClient";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "Consolidación ASP",
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
    title: "Consolidación"
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" }
    ]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {/* ✅ Activado solo en desarrollo */}
        <ClickToComponentClient />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
