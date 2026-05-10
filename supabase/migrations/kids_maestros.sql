-- ══════════════════════════════════════════════════════════════════════════════
-- Migración: kids_maestros
-- Ejecutar en Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Tabla principal ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_maestros (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificación
  cedula              text          NOT NULL UNIQUE,
  nombre              text          NOT NULL,
  apellido            text          NOT NULL,
  telefono            text,
  foto_url            text,

  -- Información personal
  direccion           text,
  estudios            text,           -- 'Primaria'|'Bachiller'|'Técnico/a'|'Tecnólogo/a'|'Universitario/a'|'Postgrado'
  profesion           text,
  estado_civil        text,           -- 'Soltero/a'|'Casado/a'|'Unión libre'|'Divorciado/a'|'Viudo/a'
  hijos               integer         DEFAULT 0 CHECK (hijos >= 0),

  -- Asignación de grupo (añadido vía ALTER TABLE — ver kids_maestros_grupo_fix.sql)
  grupo               text            CHECK (grupo IS NULL OR grupo IN (
                                        'Grupo 1','Grupo 2','Grupo 3',
                                        'Grupo 4','Grupo 5','Grupo 6'
                                      )),
  puede_dirigir       boolean         NOT NULL DEFAULT false,

  -- Servicio
  sirve_entre_semana  boolean         NOT NULL DEFAULT false,
  horario_servicio    text,           -- 'Domingo 8:00am' | 'Domingo 10:30am' | etc.
  grupo_servicio      text,           -- 'Semillitas' | 'Exploradores' | etc.

  -- Control
  activo              boolean         NOT NULL DEFAULT true,
  creado_en           timestamptz     NOT NULL DEFAULT now(),
  actualizado_en      timestamptz     NOT NULL DEFAULT now()
);

-- ── Trigger: actualizar actualizado_en automáticamente ────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kids_maestros_updated ON public.kids_maestros;
CREATE TRIGGER trg_kids_maestros_updated
  BEFORE UPDATE ON public.kids_maestros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kids_maestros_cedula  ON public.kids_maestros (cedula);
CREATE INDEX IF NOT EXISTS idx_kids_maestros_activo  ON public.kids_maestros (activo);
CREATE INDEX IF NOT EXISTS idx_kids_maestros_grupo   ON public.kids_maestros (grupo_servicio);

-- ── RLS: acceso solo con service_role (la app usa service_role en el servidor) ─
ALTER TABLE public.kids_maestros ENABLE ROW LEVEL SECURITY;

-- Política que da acceso total al service_role (backend)
CREATE POLICY "service_role full access"
  ON public.kids_maestros
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- Verificación: selecciona la tabla para confirmar que se creó correctamente
-- ══════════════════════════════════════════════════════════════════════════════
SELECT column_name, data_type, is_nullable, column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'kids_maestros'
ORDER  BY ordinal_position;
