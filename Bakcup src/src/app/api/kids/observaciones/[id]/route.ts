// src/app/api/kids/observaciones/[id]/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

// ── DELETE — Soft delete de observación ──────────────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });

    const supabase = getServerSupabase();

    // Hard delete — elimina la fila directamente
    const { error, count } = await supabase
      .from('kids_observaciones')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) throw error;

    console.log(`[OBS] 🗑️ Eliminada (hard): ${id} | filas afectadas: ${count}`);
    return NextResponse.json({ ok: true, deleted: count });
  } catch (e: any) {
    console.error('[OBS DELETE] ❌', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
