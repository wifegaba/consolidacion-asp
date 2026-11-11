-- Return the course history and the next course without changing identity matching.
create or replace function public.fn_historial_ingreso(p_nombre text, p_telefono text,
  p_cedula text default null, p_email text default null) returns jsonb
language sql stable security definer set search_path = public as $$
with perfiles as (
  select 'persona'::text fuente, p.id, p.nombre, p.telefono, null::text cedula, null::text email
  from persona p
  union all
  select 'entrevista', e.id, e.nombre, e.telefono, e.cedula, e.email from entrevistas e
), coincidencias as (
  select *,
    ingreso_nombre(nombre)=ingreso_nombre(p_nombre) and ingreso_nombre(p_nombre)<>'' nombre_igual,
    ingreso_telefono(telefono)=ingreso_telefono(p_telefono) and length(ingreso_telefono(p_telefono))>=7 telefono_igual,
    regexp_replace(coalesce(cedula,''),'[^0-9a-zA-Z]','','g')=regexp_replace(coalesce(p_cedula,''),'[^0-9a-zA-Z]','','g') and regexp_replace(coalesce(p_cedula,''),'[^0-9a-zA-Z]','','g')<>'' documento_igual,
    lower(trim(email))=lower(trim(p_email)) and coalesce(trim(p_email),'')<>'' email_igual,
    coalesce(cedula,'')<>'' and coalesce(p_cedula,'')<>'' and
      regexp_replace(cedula,'[^0-9a-zA-Z]','','g')<>regexp_replace(p_cedula,'[^0-9a-zA-Z]','','g') documento_conflicto
  from perfiles
), candidatos as (
  select c.*, case when not documento_conflicto and
    (documento_igual or (nombre_igual and (telefono_igual or email_igual)))
    then 'segura' else 'probable' end confianza,
    case when documento_igual then 'Documento coincidente'
      when telefono_igual and nombre_igual then 'Nombre y teléfono coincidentes'
      when email_igual and nombre_igual then 'Nombre y correo coincidentes'
      when telefono_igual then 'Teléfono compartido o coincidente'
      when email_igual then 'Correo coincidente' else 'Nombre coincidente' end motivo
  from coincidencias c where nombre_igual or telefono_igual or documento_igual or email_igual
), historiales as (
  select c.*, h.*, case when c.fuente = 'entrevista' then siguiente_academia.curso
    when siguiente_progreso.etapa is not null then jsonb_build_object(
      'nivel', case siguiente_progreso.etapa when 'Semillas' then 'Semilla'
        when 'Restauracion' then 'Restauración' else siguiente_progreso.etapa end || ' ' || siguiente_progreso.modulo,
      'etapa', siguiente_progreso.etapa, 'modulo', siguiente_progreso.modulo, 'cursoId', null)
    end siguiente
  from candidatos c left join lateral (
    with cursos_historial as (
      select case when p.etapa::text='Semillas' then 'Semilla '||p.modulo
        when p.etapa::text='Devocionales' then 'Devocionales '||p.modulo
        when p.etapa::text='Restauracion' then 'Restauración '||p.modulo
        else null end nivel,
        p.etapa::text etapa, p.modulo, null::integer curso_id,
        greatest(p.creado_en,p.reactivado_at)::timestamptz fecha, p.activo, p.estado::text estado
      from progreso p where c.fuente='persona' and p.persona_id=c.id
      union all
      select cu.nombre, null, null, i.curso_id,
        greatest(i.created_at,i.updated_at)::timestamptz, i.estado='activo', i.estado::text
      from inscripciones i join cursos cu on cu.id=i.curso_id
      where c.fuente='entrevista' and i.entrevista_id=c.id
    ), ultimos_por_curso as (
      select distinct on (etapa, modulo, curso_id) * from cursos_historial where nivel is not null
      order by etapa, modulo, curso_id, fecha desc nulls last, estado
    )
    select ultimo.*, (select jsonb_agg(jsonb_build_object('nivel', nivel, 'etapa', etapa,
      'modulo', modulo, 'cursoId', curso_id, 'estado', estado) order by fecha desc nulls last, nivel)
      from ultimos_por_curso) cursos
    from (select * from cursos_historial order by fecha desc nulls last, nivel limit 1) ultimo
  ) h on true
  left join lateral (
    select jsonb_build_object('nivel', destino.nombre, 'etapa', null, 'modulo', null, 'cursoId', destino.id) curso
    from cursos origen join cursos destino on destino.orden > origen.orden
    where origen.id = h.curso_id order by destino.orden, destino.id limit 1
  ) siguiente_academia on c.fuente = 'entrevista'
  left join lateral (
    select case when h.modulo between 1 and 3 then h.etapa
      when h.modulo = 4 and h.etapa = 'Semillas' then 'Devocionales'
      when h.modulo = 4 and h.etapa = 'Devocionales' then 'Restauracion' end etapa,
      case when h.modulo between 1 and 3 then h.modulo + 1 else 1 end modulo
    where h.etapa in ('Semillas', 'Devocionales', 'Restauracion')
  ) siguiente_progreso on c.fuente = 'persona'
)
select coalesce(jsonb_agg(jsonb_build_object('id',id,'fuente',fuente,'nombre',nombre,
  'telefono',telefono,'cedula',cedula,'email',email,'confianza',confianza,'motivo',motivo,
  'nivel',nivel,'etapa',etapa,'modulo',modulo,'cursoId',curso_id,'fecha',fecha,'estado',estado,
  'cursos',coalesce(cursos,'[]'::jsonb),'siguiente',siguiente,
  'activo',case when fuente='persona' then exists(select 1 from progreso where persona_id=historiales.id and activo)
    else exists(select 1 from inscripciones where entrevista_id=historiales.id and estado='activo') end)
  order by confianza desc, fecha desc nulls last, fuente, id),'[]'::jsonb) from historiales;
$$;
