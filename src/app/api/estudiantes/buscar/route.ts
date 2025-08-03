import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🔑 Inicializa Supabase correctamente
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ estudiantes: [] }, { status: 200 });
    }

    const { data, error } = await supabase
      .from('estudiantes')
      .select('*')
      .or(`nombre.ilike.%${query}%,telefono.ilike.%${query}%,cedula.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ estudiantes: data }, { status: 200 });
  } catch (err: any) {
    console.error('Server error:', err.message);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
