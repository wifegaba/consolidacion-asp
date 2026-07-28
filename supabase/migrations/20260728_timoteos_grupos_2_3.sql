-- Timoteos: importación de los grupos 2 y 3
-- Ejecutar en Supabase > SQL Editor.
-- Es idempotente: puede ejecutarse nuevamente sin duplicar registros.

begin;

alter table public.kids_servidores
  add column if not exists codigo_timoteo varchar(12),
  add column if not exists cumpleanos varchar(5),
  add column if not exists telefono_acudiente varchar(30),
  add column if not exists telefono_propio varchar(30),
  add column if not exists disponibilidad_domingo_7 boolean not null default false,
  add column if not exists disponibilidad_domingo_9 boolean not null default false,
  add column if not exists disponibilidad_domingo_11 boolean not null default false;

comment on column public.kids_servidores.codigo_timoteo is
  'Código de clasificación TIM registrado en el listado original.';
comment on column public.kids_servidores.telefono_acudiente is
  'Número de contacto del acudiente del Timoteo.';
comment on column public.kids_servidores.telefono_propio is
  'Número personal del Timoteo, cuando está disponible.';

insert into public.kids_servidores (
  cedula,
  codigo_timoteo,
  apellido,
  nombre,
  cumpleanos,
  edad,
  telefono,
  telefono_acudiente,
  telefono_propio,
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
  -- Grupo 2
  ('TIM-G2-001', 'TIM23', 'Alvarez Mina',        'Yerson Adrián',   '06-17', 13, '3128292696', '3128292696', null,         array['TIMOTEOS']::text[], 'Grupo 2', false, true,  false, false, false, true),
  ('TIM-G2-002', 'TIM25', 'Amezquita Saenz',     'Ana Sofia',       '10-09', 12, '3233511914', '3117540369', '3233511914', array['TIMOTEOS']::text[], 'Grupo 2', true,  true,  false, false, false, true),
  ('TIM-G2-003', 'TIM23', 'Arenas Arango',       'Juan José',       '10-27', 6,  '3116367935', '3116367935', null,         array['TIMOTEOS']::text[], 'Grupo 2', true,  true,  false, false, false, true),
  ('TIM-G2-004', 'TIM23', 'Betancourt Pineda',   'Mariana',         '10-01', 12, '3164525025', '3164525025', null,         array['TIMOTEOS']::text[], 'Grupo 2', false, true,  false, false, false, true),
  ('TIM-G2-005', 'TIM23', 'Castro Cubides',      'Susana',          '08-07', 12, '3158795417', '3158795417', null,         array['TIMOTEOS']::text[], 'Grupo 2', false, true,  false, false, false, true),
  ('TIM-G2-006', 'TIM24', 'Chavez Zapata',       'María Lucciana',  '03-01', 13, '3174186054', '3174186054', null,         array['TIMOTEOS']::text[], 'Grupo 2', false, true,  false, false, false, true),
  ('TIM-G2-007', 'TIM24', 'Contreras Laguado',   'Eilyn Taliana',   '04-16', 13, '3015941108', '3015941108', '3015941108', array['TIMOTEOS']::text[], 'Grupo 2', true,  true,  false, false, false, true),
  ('TIM-G2-008', 'TIM23', 'Erazo Bemal',         'Saray',           '11-11', 12, '3147195593', '3147195593', null,         array['TIMOTEOS']::text[], 'Grupo 2', false, false, true,  false, false, true),
  ('TIM-G2-009', 'TIM24', 'Hernández García',    'Mariam',          '08-05', 12, '3167684840', '3175720826', '3167684840', array['TIMOTEOS']::text[], 'Grupo 2', false, true,  true,  false, false, true),
  ('TIM-G2-010', 'TIM25', 'Mamián Fernandez',    'Carol Vanesa',    '05-10', 13, '3235933913', '3235933913', null,         array['TIMOTEOS']::text[], 'Grupo 2', true,  true,  false, false, false, true),
  ('TIM-G2-011', 'TIM21', 'Medina Colina',       'Naomi Gabriela',  '07-28', 12, '3019688355', '3019688355', null,         array['TIMOTEOS']::text[], 'Grupo 2', false, true,  true,  false, false, true),
  ('TIM-G2-012', 'TIM25', 'Muñoz Cuellar',       'Jhorlan Esnel',   '11-15', 13, '3127969830', '3127969830', '3127969830', array['TIMOTEOS']::text[], 'Grupo 2', true,  false, false, false, false, true),
  ('TIM-G2-013', 'TIMCA', 'Parra Betancourt',    'Sarah Sofia',     '01-22', 13, '3146440070', '3146440070', null,         array['TIMOTEOS']::text[], 'Grupo 2', false, true,  true,  false, false, true),
  ('TIM-G2-014', 'TIM24', 'Ruales Mamian',       'Elenn Michel',    '11-15', 13, '3004369160', '3234767746', '3004369160', array['TIMOTEOS']::text[], 'Grupo 2', true,  true,  false, false, false, true),
  ('TIM-G2-015', 'TIM24', 'Ruales Mamian',       'Maylen',          '07-10', 11, '3234767746', '3234767746', null,         array['TIMOTEOS']::text[], 'Grupo 2', true,  true,  false, false, false, true),

  -- Grupo 3
  ('TIM-G3-001', 'TIM24', 'Mejía Varón',         'Samuel',          '08-29', 12, '3203372488', '3204772678', '3203372488', array['TIMOTEOS']::text[], 'Grupo 3', true,  true,  false, false, false, true),
  ('TIM-G3-002', 'TIM24', 'Morcillo Cendales',   'Luz Ángela',      '08-13', 13, '3242973775', '3172493676', '3242973775', array['TIMOTEOS']::text[], 'Grupo 3', true,  false, false, false, false, true),
  ('TIM-G3-003', 'TIM23', 'Moreno Amariles',     'Eliam David',     '11-13', 13, '3148111929', '3148111929', null,         array['TIMOTEOS']::text[], 'Grupo 3', false, true,  false, false, false, true),
  ('TIM-G3-004', 'TIM23', 'Ortiz Lopez',         'Melany Andrea',   '01-28', 13, '3166619193', '3028495132', '3166619193', array['TIMOTEOS']::text[], 'Grupo 3', true,  true,  false, false, false, true),
  ('TIM-G3-005', 'TIM22', 'Pantoja Soto',        'Samuel',          '01-20', 13, '3146629704', '3113519620', '3146629704', array['TIMOTEOS']::text[], 'Grupo 3', false, true,  true,  false, false, true),
  ('TIM-G3-006', 'TIM22', 'Peña Valencia',       'Juan Diego',      '01-18', 13, '3218408529', '3218408529', null,         array['TIMOTEOS']::text[], 'Grupo 3', false, true,  false, false, false, true),
  ('TIM-G3-007', 'TIM23', 'Perea Hurtado',       'Isabel Cristina', '05-06', 13, '3225178122', '3225178122', null,         array['TIMOTEOS']::text[], 'Grupo 3', false, false, true,  false, false, true),
  ('TIM-G3-008', 'TIM23', 'Ramos Quiñonez',      'Eider',           '05-30', 13, '3234264983', '3234264983', null,         array['TIMOTEOS']::text[], 'Grupo 3', false, true,  false, false, false, true),
  ('TIM-G3-009', 'TIM24', 'Rentería Torres',     'Emanuel',         '05-17', 13, '3226388341', '3122739498', '3226388341', array['TIMOTEOS']::text[], 'Grupo 3', true,  true,  false, false, false, true),
  ('TIM-G3-010', 'TIM24', 'Riascos Arango',      'Esteban',         '08-05', 12, '3004402771', '3004402771', null,         array['TIMOTEOS']::text[], 'Grupo 3', false, true,  false, false, false, true),
  ('TIM-G3-011', 'TIM25', 'Rincon Angulo',       'Mariana',         '08-06', 12, '3215964723', '3215964723', null,         array['TIMOTEOS']::text[], 'Grupo 3', true,  true,  false, false, false, true),
  ('TIM-G3-012', 'TIM24', 'Saenz Bravo',         'Alejandro',       '07-27', 13, '3186347850', '3186347850', null,         array['TIMOTEOS']::text[], 'Grupo 3', true,  true,  false, false, false, true),
  ('TIM-G3-013', 'TIM25', 'Sarmiento',           'Rosa Maria',      '01-10', 13, '3215429916', '3007107623', '3215429916', array['TIMOTEOS']::text[], 'Grupo 3', true,  true,  false, false, false, true),
  ('TIM-G3-014', 'TIM22', 'Torres Mena',         'Emily Dayan',     '02-26', 13, '3234471457', '3234471457', null,         array['TIMOTEOS']::text[], 'Grupo 3', false, false, true,  false, false, true),
  ('TIM-G3-015', 'TIMCA', 'Velez Lopez',         'Melanin Dayana',  '07-17', 13, '3236594917', '3104248246', '3236594917', array['TIMOTEOS']::text[], 'Grupo 3', true,  false, false, false, false, true)
on conflict (cedula) do update set
  codigo_timoteo = excluded.codigo_timoteo,
  apellido = excluded.apellido,
  nombre = excluded.nombre,
  cumpleanos = excluded.cumpleanos,
  edad = excluded.edad,
  telefono = excluded.telefono,
  telefono_acudiente = excluded.telefono_acudiente,
  telefono_propio = excluded.telefono_propio,
  roles = excluded.roles,
  grupo_timoteos_asignado = excluded.grupo_timoteos_asignado,
  disponibilidad_domingo_7 = excluded.disponibilidad_domingo_7,
  disponibilidad_domingo_9 = excluded.disponibilidad_domingo_9,
  disponibilidad_domingo_11 = excluded.disponibilidad_domingo_11,
  activo = true;

commit;
