-- Agrega dirección y edad a la tabla de coordinadores kids
ALTER TABLE public.kids_coordinadores
  ADD COLUMN IF NOT EXISTS direccion text,
  ADD COLUMN IF NOT EXISTS edad      integer CHECK (edad IS NULL OR (edad >= 0 AND edad <= 120));
