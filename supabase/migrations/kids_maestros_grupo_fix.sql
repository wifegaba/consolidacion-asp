-- ══════════════════════════════════════════════════════════════════════════════
-- Migración: kids_maestros — columnas grupo + puede_dirigir + fix constraint
-- Ejecutar en Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Agregar columna "grupo" si no existe ───────────────────────────────────
ALTER TABLE public.kids_maestros
  ADD COLUMN IF NOT EXISTS grupo text;

-- ── 2. Agregar columna "puede_dirigir" si no existe ──────────────────────────
ALTER TABLE public.kids_maestros
  ADD COLUMN IF NOT EXISTS puede_dirigir boolean NOT NULL DEFAULT false;

-- ── 3. Eliminar constraint anterior (puede tener valores incorrectos) ─────────
ALTER TABLE public.kids_maestros
  DROP CONSTRAINT IF EXISTS kids_maestros_grupo_check;

-- ── 4. Agregar constraint correcto con todos los grupos válidos ───────────────
ALTER TABLE public.kids_maestros
  ADD CONSTRAINT kids_maestros_grupo_check
  CHECK (grupo IS NULL OR grupo IN (
    'Grupo 1',
    'Grupo 2',
    'Grupo 3',
    'Grupo 4',
    'Grupo 5',
    'Grupo 6'
  ));

-- ── 5. Índice en grupo para búsquedas rápidas (coordinadores ↔ maestros) ──────
CREATE INDEX IF NOT EXISTS idx_kids_maestros_grupo ON public.kids_maestros (grupo);

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable, column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'kids_maestros'
ORDER  BY ordinal_position;
