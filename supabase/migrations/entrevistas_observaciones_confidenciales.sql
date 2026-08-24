-- Observaciones confidenciales de la hoja de vida académica.
-- Ejecutar en Supabase SQL Editor antes de desplegar esta funcionalidad.

CREATE TABLE IF NOT EXISTS public.entrevistas_observaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrevista_id uuid NOT NULL REFERENCES public.entrevistas(id) ON DELETE CASCADE,
  autor_servidor_id uuid NOT NULL REFERENCES public.servidores(id),
  contenido text NOT NULL CHECK (length(btrim(contenido)) > 0),
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entrevistas_observaciones_entrevista_fecha
  ON public.entrevistas_observaciones (entrevista_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_entrevistas_observaciones_autor
  ON public.entrevistas_observaciones (autor_servidor_id);

-- El acceso ocurre exclusivamente por /api/estudiantes/[id]/observaciones,
-- que valida la sesión y nunca entrega el contenido a quien no corresponde.
ALTER TABLE public.entrevistas_observaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access entrevistas observaciones" ON public.entrevistas_observaciones;
CREATE POLICY "service_role full access entrevistas observaciones"
  ON public.entrevistas_observaciones
  TO service_role
  USING (true)
  WITH CHECK (true);
