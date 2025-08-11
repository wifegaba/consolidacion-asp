// File: src/app/api/estudiantes/[id]/resumen/route.ts
import { NextResponse } from 'next/server';

// (Opcional) Fuerza runtime Node si lo usas en DB
export const runtime = 'nodejs';

// Firma tolerante: evita choques con el generador de tipos de Next
export async function GET(_req: Request, context: any) {
    const { id } = (context?.params ?? {}) as { id: string };

    // --- TU LÓGICA REAL AQUÍ ---
    // const resumen = await obtenerResumenDeEstudiante(id);

    // Ejemplo mínimo (borra cuando uses tu lógica real)
    const resumen = {
        1: { avance: 80, prom: 4.0 },
        2: { avance: 65, prom: 3.8 },
        3: { avance: 20, prom: null },
        4: { avance: 0,  prom: null },
        5: { avance: 0,  prom: null },
    };

    return NextResponse.json({ ok: true, id, resumen });
}
