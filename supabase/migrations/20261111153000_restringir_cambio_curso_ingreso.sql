-- Changing the course of an existing student from Pendientes requires an authorized account.
create or replace function public.fn_puede_cambiar_curso_ingreso(p_usuario uuid) returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from servidores
    where activo and id = p_usuario and id in (
      'd2cb971f-c57f-4a16-bef4-663da6ceefc2', -- Lady Hidalgo
      'bd3f4f06-f92a-40fa-922f-f85cea3f4364', -- Sirley Morales (Shirley)
      'b1b8fde2-a9c1-407b-8ed9-e4739c4969ae'  -- Diana Ramirez
    ));
$$;

revoke all on function public.fn_puede_cambiar_curso_ingreso(uuid) from public, anon, authenticated;
grant execute on function public.fn_puede_cambiar_curso_ingreso(uuid) to service_role;

do $migration$
declare
  definition text := pg_get_functiondef('public.fn_asignar_ingreso(uuid,uuid,text,uuid,text,boolean,boolean)'::regprocedure);
  anchor text := $anchor$    if (v_c->>'activo')::boolean then raise exception 'La persona ya tiene un proceso activo'; end if;$anchor$;
  restriction text := $restriction$
    if v_c->>'nivel' is not null and not fn_puede_cambiar_curso_ingreso(p_usuario) and (
      case when p_identidad_fuente = 'entrevista' then (v_c->>'cursoId') is distinct from (v_g->>'cursoId')
      else (v_c->>'etapa') is distinct from (v_g->>'etapa') or (v_c->>'modulo') is distinct from (v_g->>'modulo') end
    ) then
      raise exception using errcode = 'PT403', message = 'CAMBIO_CURSO_RESTRINGIDO';
    end if;
$restriction$;
begin
  if position(restriction in definition) = 0 then
    if position(anchor in definition) = 0 then
      raise exception 'No se encontró la validación de historial en fn_asignar_ingreso';
    end if;
    execute replace(definition, anchor, anchor || restriction);
  end if;
end;
$migration$;
