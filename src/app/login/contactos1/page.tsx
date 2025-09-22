import { Suspense } from "react";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import Contactos1Client from "./Contactos1Client";
import "../../panel/contactos/contactos.css";
import "../../panel/servidores/servidores.css";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function Page() {
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  const COOKIE_NAME = isProd ? "__Host-session" : "session";
  const token = cookieStore.get(COOKIE_NAME)?.value;

  let cedula: string | undefined = undefined;
  let etapa: string | undefined = undefined;
  let dia: string | undefined = undefined;
  let semana: number | undefined = undefined;

  if (token && process.env.JWT_SECRET) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET) as any;
      cedula = String(payload?.cedula || "");
      etapa = payload?.etapa ?? undefined;
      dia = payload?.dia ?? undefined;
      semana = typeof payload?.semana === "number" ? payload.semana : undefined;
    } catch {
      // token inválido -> no bloqueamos la pantalla, que el client maneje el estado
    }
  }

  return (
    <Suspense fallback={<Fallback />}>
      <Contactos1Client
        cedula={cedula}
        etapaInicial={etapa}
        diaInicial={dia}
        semanaInicial={semana}
      />
    </Suspense>
  );
}

function Fallback() {
  return (
    <main className="min-h-[100dvh] grid place-items-center">
      <div>Cargando…</div>
    </main>
  );
}
