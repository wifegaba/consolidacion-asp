-- ══════════════════════════════════════════════════════════════════════════════
-- Migración: kids_observaciones
-- Ejecutar en Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Tabla principal ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_observaciones (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relaciones
  maestro_id      uuid        NOT NULL REFERENCES public.kids_maestros(id)      ON DELETE CASCADE,
  coordinador_id  uuid        NOT NULL REFERENCES public.kids_coordinadores(id)  ON DELETE CASCADE,

  -- Clasificación
  grupo           text        NOT NULL,   -- 'Grupo 1' … 'Grupo 6'
  tipo            text        NOT NULL DEFAULT 'general'
                              CHECK (tipo IN (
                                'general','puntualidad','desempeño',
                                'logro','conducta','asistencia'
                              )),

  -- Contenido
  titulo          text        NOT NULL,
  descripcion     text,

  -- Fecha de la observación (no necesariamente la fecha de creación)
  fecha           date        NOT NULL DEFAULT CURRENT_DATE,

  -- Control
  activo          boolean     NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

-- ── Trigger actualizado_en ─────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_kids_obs_updated ON public.kids_observaciones;
CREATE TRIGGER trg_kids_obs_updated
  BEFORE UPDATE ON public.kids_observaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Índices para consultas frecuentes ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kids_obs_maestro      ON public.kids_observaciones (maestro_id);
CREATE INDEX IF NOT EXISTS idx_kids_obs_coordinador  ON public.kids_observaciones (coordinador_id);
CREATE INDEX IF NOT EXISTS idx_kids_obs_grupo        ON public.kids_observaciones (grupo);
CREATE INDEX IF NOT EXISTS idx_kids_obs_fecha        ON public.kids_observaciones (fecha DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.kids_observaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access"
  ON public.kids_observaciones
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'kids_observaciones'
ORDER  BY ordinal_position;
