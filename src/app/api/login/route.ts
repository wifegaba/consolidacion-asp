// src/app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Mapea el rol (en minúsculas) a la ruta correspondiente.
 * - coordinador|director -> /panel
 * - maestro -> /login/maestros
 * - contactos -> /login/contactos1
 * - default -> /login
 */
function roleToRoute(rol: string | null | undefined): string {
  const v = (rol || "").toLowerCase();
  if (v === "coordinador" || v === "director") return "/panel";
  if (v === "maestro") return "/login/maestros";
  if (v === "contactos") return "/login/contactos1";
  return "/login";
}

export async function POST(req: NextRequest) {
  try {
    const { cedula } = await req.json();

    if (!cedula || typeof cedula !== "string" || cedula.trim() === "") {
      return NextResponse.json({ error: "Falta cédula" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Config faltante" }, { status: 500 });
    }

    // Cliente Supabase server-side (no persistir sesión en server)
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1) Buscar servidor por cédula (activo)
    const { data: servidor, error: errServ } = await supabase
      .from("servidores")
      .select("id, nombre, activo")
      .eq("cedula", cedula.trim())
      .maybeSingle();

    if (errServ) {
      console.error("[servidores]", errServ);
      return NextResponse.json({ error: "Error consultando servidor" }, { status: 500 });
    }
    if (!servidor || servidor.activo === false) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2) ¿Tiene rol ADMIN vigente? (Coordinador/Director) -> /panel
    const { data: adminRow, error: errAdmin } = await supabase
      .from("servidores")
      .select(`
        id,
        servidores_roles!inner(rol, vigente)
      `)
      .eq("id", servidor.id)
      .eq("servidores_roles.vigente", true)
      .in("servidores_roles.rol", ["Coordinador", "Director"])
      .limit(1)
      .maybeSingle();

    if (errAdmin) {
      console.error("[admin check]", errAdmin);
      return NextResponse.json({ error: "Error validando rol" }, { status: 500 });
    }

    // Si es admin, redirige a /panel
    if (adminRow?.servidores_roles && Array.isArray(adminRow.servidores_roles) && adminRow.servidores_roles.length > 0) {
      const rol = String(adminRow.servidores_roles[0].rol); // 'Coordinador' | 'Director'
      const redirect = roleToRoute(rol);
      return NextResponse.json({ redirect, rol, nombre: servidor.nombre });
    }

    // 3) No es admin -> resuelve rol básico (tu lógica existente)
    // Si ya tienes esta RPC, la usamos; si no, devuelve null y caerá a /login
    const { data: rolBasico, error: errBasic } = await supabase
      .rpc("fn_resolver_rol", { p_cedula: cedula.trim() });

    if (errBasic) {
      console.error("[fn_resolver_rol]", errBasic);
      const redirect = roleToRoute(null);
      return NextResponse.json({ redirect, rol: null, nombre: servidor.nombre });
    }

    const rol = (rolBasico as string | null) || null; // 'maestro' | 'contactos' | null
    const redirect = roleToRoute(rol);
    return NextResponse.json({ redirect, rol, nombre: servidor.nombre });
  } catch (e: any) {
    console.error("[/api/login] error", e);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}
