-- Perfil especializado de Timoteos
-- Ejecutar en Supabase > SQL Editor.
-- Es idempotente: puede ejecutarse nuevamente sin duplicar registros.

begin;

alter table public.kids_servidores
  add column if not exists cumpleanos varchar(5),
  add column if not exists disponibilidad_domingo_7 boolean not null default false,
  add column if not exists disponibilidad_domingo_9 boolean not null default false,
  add column if not exists disponibilidad_domingo_11 boolean not null default false;

comment on column public.kids_servidores.cumpleanos is
  'Cumpleaños en formato MM-DD; no almacena el año de nacimiento.';
comment on column public.kids_servidores.disponibilidad_domingo_7 is
  'Disponible para servir el domingo a las 7:00 AM.';
comment on column public.kids_servidores.disponibilidad_domingo_9 is
  'Disponible para servir el domingo a las 9:00 AM.';
comment on column public.kids_servidores.disponibilidad_domingo_11 is
  'Disponible para servir el domingo a las 11:00 AM.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'kids_servidores_cumpleanos_formato_check'
      and conrelid = 'public.kids_servidores'::regclass
  ) then
    alter table public.kids_servidores
      add constraint kids_servidores_cumpleanos_formato_check
      check (
        cumpleanos is null
        or cumpleanos ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      );
  end if;
end
$$;

insert into public.kids_servidores (
  cedula,
  apellido,
  nombre,
  cumpleanos,
  edad,
  telefono,
  roles,
  grupo_timoteos_asignado,
  disponibilidad_domingo_7,
  disponibilidad_domingo_9,
  disponibilidad_domingo_11,
  puede_dirigir,
  sirve_entre_semana,
  activo
)
values
  ('TIM-3233731218', 'Aguilar Torres',    'Jans Darwin',       '07-21', null, '3233731218',             array['TIMOTEOS']::text[], 'Grupo 1', false, false, true,  false, false, true),
  ('TIM-3128400403', 'Amu Valencia',      'Aura Alejandra',    '12-27', 0,    '3128400403',             array['TIMOTEOS']::text[], 'Grupo 1', false, true,  false, false, false, true),
  ('TIM-3157989800', 'Andrade Erazo',     'Cristhian David',   '01-20', 14,   '3157989800',             array['TIMOTEOS']::text[], 'Grupo 1', false, true,  false, false, false, true),
  ('TIM-3183838921', 'Ayala Giraldo',     'Samuel',            '03-20', 14,   '3183838921 / 3154681981',array['TIMOTEOS']::text[], 'Grupo 1', false, true,  false, false, false, true),
  ('TIM-3016819600', 'Delgado Montoya',   'Víctor Manuel',     '08-09', 14,   '3016819600',             array['TIMOTEOS']::text[], 'Grupo 1', false, true,  false, false, false, true),
  ('TIM-3184691708', 'García Alegría',    'Joseth David',      '10-25', 15,   '3184691708',             array['TIMOTEOS']::text[], 'Grupo 1', true,  false, false, false, false, true),
  ('TIM-3152114636', 'Girón Barbosa',     'Miguel Ángel',      '08-16', 14,   '3152114636',             array['TIMOTEOS']::text[], 'Grupo 1', false, true,  false, false, false, true),
  ('TIM-3152460856', 'Marín Muguerza',    'Elizabeth',         '09-10', 14,   '3152460856',             array['TIMOTEOS']::text[], 'Grupo 1', false, true,  false, false, false, true),
  ('TIM-3146508831', 'Marínez Quiñones',  'Jean Pierre',       '09-01', 12,   '3146508831',             array['TIMOTEOS']::text[], 'Grupo 1', false, true,  true,  false, false, true),
  ('TIM-3146508831-2','Marínez Quiñones', 'Valerit Andrea',    '06-27', 14,   '3146508831',             array['TIMOTEOS']::text[], 'Grupo 1', false, true,  true,  false, false, true),
  ('TIM-3157382835', 'Martínez Herrera',  'Gerónimo',          '09-22', 14,   '3157382835',             array['TIMOTEOS']::text[], 'Grupo 1', true,  false, false, false, false, true),
  ('TIM-3186752642', 'Paredes Piñero',    'Andrés David',      '09-07', 15,   '3186752642',             array['TIMOTEOS']::text[], 'Grupo 1', false, false, false, false, false, true),
  ('TIM-3137489362', 'Pérez Atahualpa',   'Caleb',             '07-08', 15,   '3137489362',             array['TIMOTEOS']::text[], 'Grupo 1', false, true,  false, false, false, true)
on conflict (cedula) do update set
  apellido = excluded.apellido,
  nombre = excluded.nombre,
  cumpleanos = excluded.cumpleanos,
  edad = excluded.edad,
  telefono = excluded.telefono,
  roles = excluded.roles,
  grupo_timoteos_asignado = excluded.grupo_timoteos_asignado,
  disponibilidad_domingo_7 = excluded.disponibilidad_domingo_7,
  disponibilidad_domingo_9 = excluded.disponibilidad_domingo_9,
  disponibilidad_domingo_11 = excluded.disponibilidad_domingo_11,
  activo = true;

commit;
