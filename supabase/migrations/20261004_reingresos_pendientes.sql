-- Reingresos: lectura sin fusiones y asignación explícita, atómica y auditable.
begin;
alter table public.pendientes add column if not exists cedula text;
alter table public.pendientes add column if not exists email text;

create or replace function public.ingreso_nombre(v text) returns text
language sql immutable set search_path = public as $$
  select trim(regexp_replace(translate(lower(coalesce(v,'')),
    'áéíóúüñ','aeiouun'), '\s+', ' ', 'g'));
$$;
create or replace function public.ingreso_telefono(v text) returns text
language sql immutable set search_path = public as $$
  select case when length(d)=12 and left(d,2)='57' then substr(d,3) else d end
  from (select regexp_replace(coalesce(v,''),'[^0-9]','','g') d) s;
$$;

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
  select c.*, h.nivel, h.etapa, h.modulo, h.curso_id, h.fecha, h.activo
  from candidatos c left join lateral (
    select * from (
      select case when p.etapa::text='Semillas' then 'Semilla '||p.modulo
        when p.etapa::text='Devocionales' then 'Devocionales '||p.modulo
        when p.etapa::text='Restauracion' then 'Restauración '||p.modulo
        else null end nivel,
        p.etapa::text etapa, p.modulo, null::integer curso_id,
        greatest(p.creado_en,p.reactivado_at)::timestamptz fecha, p.activo
      from progreso p where c.fuente='persona' and p.persona_id=c.id
      union all
      select cu.nombre, null, null, i.curso_id,
        greatest(i.created_at,i.updated_at)::timestamptz, i.estado='activo'
      from inscripciones i join cursos cu on cu.id=i.curso_id
      where c.fuente='entrevista' and i.entrevista_id=c.id
    ) h order by fecha desc nulls last, nivel limit 1
  ) h on true
)
select coalesce(jsonb_agg(jsonb_build_object('id',id,'fuente',fuente,'nombre',nombre,
  'telefono',telefono,'cedula',cedula,'email',email,'confianza',confianza,'motivo',motivo,
  'nivel',nivel,'etapa',etapa,'modulo',modulo,'cursoId',curso_id,'fecha',fecha,
  'activo',case when fuente='persona' then exists(select 1 from progreso where persona_id=historiales.id and activo)
    else exists(select 1 from inscripciones where entrevista_id=historiales.id and estado='activo') end)
  order by confianza desc, fecha desc nulls last, fuente, id),'[]'::jsonb) from historiales;
$$;

create or replace function public.fn_pendientes_ingreso() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('history',
    fn_historial_ingreso(p.nombre,p.telefono,p.cedula,p.email),
    'creado_por_nombre',coalesce(s.nombre,'Sistema')) order by p.creado_en desc),'[]'::jsonb)
  from pendientes p left join servidores s on s.id=p.creado_por;
$$;

create or replace function public.fn_encolar_ingreso(p_nombre text,p_telefono text,
  p_culto text,p_observaciones text,p_creado_por uuid,p_cedula text default null,
  p_email text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(ingreso_telefono(p_telefono)||':'||ingreso_nombre(p_nombre),0));
  select id into v_id from pendientes where ingreso_telefono(telefono)=ingreso_telefono(p_telefono)
    and ingreso_nombre(nombre)=ingreso_nombre(p_nombre)
    and coalesce(cedula,'')=coalesce(nullif(trim(p_cedula),''),'')
    and coalesce(lower(email),'')=coalesce(lower(nullif(trim(p_email),'')),'') limit 1;
  if v_id is not null then return v_id; end if;
  insert into pendientes(nombre,telefono,destino,culto_seleccionado,observaciones,creado_por,cedula,email)
    values(trim(p_nombre),regexp_replace(p_telefono,'[^0-9]','','g'),'Pendientes',p_culto,p_observaciones,
      p_creado_por,nullif(trim(p_cedula),''),nullif(trim(p_email),'')) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.fn_grupos_ingreso() returns jsonb
language sql stable security definer set search_path = public as $$
with grupos as (
  select distinct 'persona'::text fuente,
    split_part(a.etapa::text,' ',1) etapa,
    split_part(a.etapa::text,' ',2)::integer modulo, a.dia::text dia,
    null::integer curso_id, null::uuid maestro_id, null::text maestro,
    replace(a.etapa::text,'Semillas','Semilla') nivel
  from asignaciones_maestro a join servidores s on s.id=a.servidor_id
  where a.vigente and s.activo and a.etapa::text ~ '^(Semillas|Devocionales|Restauracion) [1-4]$'
  union
  select distinct 'entrevista', null::text, null::integer, a.dia::text, ac.curso_id, s.id, s.nombre, c.nombre
  from asignaciones_academia ac join cursos c on c.id=ac.curso_id
  join servidores s on s.id=ac.servidor_id
  join asignaciones_maestro_ptm a on a.servidor_id=s.id
  where a.vigente and s.activo
)
select coalesce(jsonb_agg(jsonb_build_object('key',concat_ws(':',fuente,etapa,modulo,dia,curso_id,maestro_id),
  'fuente',fuente,'etapa',etapa,'modulo',modulo,'dia',dia,'cursoId',curso_id,
  'maestroId',maestro_id,'label',nivel||' – '||dia||coalesce(' · '||maestro,''))
  order by fuente,nivel,dia,maestro),'[]'::jsonb) from grupos;
$$;

create table if not exists public.reingresos_decisiones (
  id uuid primary key default gen_random_uuid(), pendiente_id uuid not null unique,
  usuario_id uuid not null references servidores(id),
  identidad_fuente text, identidad_id uuid, destino jsonb not null,
  coincidencia jsonb not null, registro_ingreso jsonb not null,
  creado_en timestamptz not null default now()
);
alter table public.reingresos_decisiones enable row level security;

create or replace function public.fn_asignar_ingreso(p_pendiente uuid, p_usuario uuid,
  p_identidad_fuente text, p_identidad uuid, p_grupo_key text, p_confirmada boolean,
  p_descartar_historial boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_p pendientes%rowtype; v_g jsonb; v_c jsonb; v_candidatos jsonb;
  v_persona uuid; v_entrevista uuid; v_destino uuid; v_inscripcion uuid; v_culto app_dia;
begin
  if not exists(select 1 from servidores_roles r join servidores s on s.id=r.servidor_id
    where r.servidor_id=p_usuario and r.vigente and s.activo
      and r.rol::text in ('Director','Administrador','Contactos','Maestros','Maestro Ptm')) then
    raise exception 'El usuario no tiene acceso al panel de Pendientes';
  end if;
  select * into v_p from pendientes where id=p_pendiente for update;
  if not found then raise exception 'Este pendiente ya fue procesado'; end if;
  select g into v_g from jsonb_array_elements(fn_grupos_ingreso()) g where g->>'key'=p_grupo_key;
  if v_g is null then raise exception 'El grupo ya no está activo'; end if;
  v_candidatos := fn_historial_ingreso(v_p.nombre,v_p.telefono,v_p.cedula,v_p.email);
  if p_identidad is not null then
    select c into v_c from jsonb_array_elements(v_candidatos) c
      where c->>'id'=p_identidad::text and c->>'fuente'=p_identidad_fuente;
    if v_c is null or not coalesce(p_confirmada,false) then
      raise exception 'Revise y confirme la identidad antes de asignar';
    end if;
    if v_g->>'fuente'<>p_identidad_fuente then
      raise exception 'Seleccione un grupo del proceso correspondiente al historial confirmado';
    end if;
    if (v_c->>'activo')::boolean then raise exception 'La persona ya tiene un proceso activo'; end if;
  elsif jsonb_array_length(v_candidatos)>0 and not coalesce(p_descartar_historial,false) then
    raise exception 'Confirme la identidad o indique que es una persona distinta';
  end if;

  if v_g->>'fuente'='persona' then
    if p_identidad_fuente='persona' and p_identidad is not null then
      v_persona:=p_identidad;
      perform 1 from persona where id=v_persona for update;
    else
      -- Nunca reutilizar un teléfono compartido sin confirmar su dueño.
      if exists(select 1 from persona where ingreso_telefono(telefono)=ingreso_telefono(v_p.telefono)) then
        raise exception 'El teléfono pertenece a otro registro. Revise la identidad o corrija el teléfono';
      end if;
      insert into persona(nombre,telefono) values(v_p.nombre,v_p.telefono) returning id into v_persona;
    end if;
    if exists(select 1 from progreso where persona_id=v_persona and activo) then
      raise exception 'La persona ya tiene un proceso activo';
    end if;
    select enumlabel::app_dia into v_culto from pg_enum
      where enumtypid='public.app_dia'::regtype
        and ingreso_nombre(enumlabel)=ingreso_nombre(split_part(v_p.culto_seleccionado,' - ',1)) limit 1;
    insert into persona_registro(persona_id,culto_dia,estudio_dia,notas)
      values(v_persona,coalesce(v_culto,(v_g->>'dia')::app_dia),(v_g->>'dia')::app_dia,
        concat_ws(' | ','Culto de ingreso: '||v_p.culto_seleccionado,v_p.observaciones));
    insert into progreso(persona_id,etapa,modulo,semana,dia,estado,activo)
      values(v_persona,(v_g->>'etapa')::app_etapa,(v_g->>'modulo')::integer,1,
        (v_g->>'dia')::app_dia,'pendiente_llamar',true) returning id into v_destino;
  else
    if p_identidad_fuente='entrevista' and p_identidad is not null then
      v_entrevista:=p_identidad;
      perform 1 from entrevistas where id=v_entrevista for update;
    else
      raise exception 'Para este grupo debe seleccionar y confirmar una entrevista existente';
    end if;
    if exists(select 1 from inscripciones where entrevista_id=v_entrevista and estado='activo') then
      raise exception 'La persona ya tiene matrícula activa';
    end if;
    insert into inscripciones(entrevista_id,curso_id,servidor_id,estado)
      values(v_entrevista,(v_g->>'cursoId')::integer,(v_g->>'maestroId')::uuid,'activo')
      on conflict (entrevista_id,curso_id) do update set servidor_id=excluded.servidor_id,
        estado='activo',updated_at=now() returning id into v_inscripcion;
    insert into asistencias_academia(inscripcion_id,asistencias) values(v_inscripcion,'{}')
      on conflict(inscripcion_id) do nothing;
    v_destino:=v_entrevista;
  end if;
  insert into reingresos_decisiones(pendiente_id,usuario_id,identidad_fuente,identidad_id,destino,coincidencia,registro_ingreso)
    values(p_pendiente,p_usuario,p_identidad_fuente,p_identidad,v_g,coalesce(v_c,'{}'),to_jsonb(v_p));
  delete from pendientes where id=p_pendiente;
  return v_destino;
end;
$$;

revoke all on function public.fn_historial_ingreso(text,text,text,text) from public,anon,authenticated;
revoke all on function public.fn_grupos_ingreso() from public,anon,authenticated;
revoke all on function public.fn_pendientes_ingreso() from public,anon,authenticated;
revoke all on function public.fn_encolar_ingreso(text,text,text,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.fn_asignar_ingreso(uuid,uuid,text,uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.fn_historial_ingreso(text,text,text,text) to service_role;
grant execute on function public.fn_grupos_ingreso() to service_role;
grant execute on function public.fn_pendientes_ingreso() to service_role;
grant execute on function public.fn_encolar_ingreso(text,text,text,text,uuid,text,text) to service_role;
grant execute on function public.fn_asignar_ingreso(uuid,uuid,text,uuid,text,boolean,boolean) to service_role;
notify pgrst, 'reload schema';
commit;
