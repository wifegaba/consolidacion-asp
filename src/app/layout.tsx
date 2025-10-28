// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import ClickToComponentClient from "./ClickToComponentClient";

export const metadata: Metadata = {
  title: "Consolidación ASP",
  description: "App con múltiples estilos por página",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {/* ✅ Activado solo en desarrollo */}
        <ClickToComponentClient />
        {children}
      </body>
    </html>
  );
}
