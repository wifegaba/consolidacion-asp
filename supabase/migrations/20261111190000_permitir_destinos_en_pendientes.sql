-- Keep assignment access and identity checks while allowing any active destination.
do $migration$
declare
  definition text := pg_get_functiondef('public.fn_asignar_ingreso(uuid,uuid,text,uuid,text,boolean,boolean)'::regprocedure);
  restriction text := $restriction$
    if v_c->>'nivel' is not null and not fn_puede_cambiar_curso_ingreso(p_usuario) and (
      case when p_identidad_fuente = 'entrevista' then (v_c->>'cursoId') is distinct from (v_g->>'cursoId')
      else (v_c->>'etapa') is distinct from (v_g->>'etapa') or (v_c->>'modulo') is distinct from (v_g->>'modulo') end
    ) then
      raise exception using errcode = 'PT403', message = 'CAMBIO_CURSO_RESTRINGIDO';
    end if;
$restriction$;
begin
  if position(restriction in definition) > 0 then
    execute replace(definition, restriction, '');
  elsif position('CAMBIO_CURSO_RESTRINGIDO' in definition) > 0 then
    raise exception 'No se reconoce la restricción de curso en fn_asignar_ingreso';
  end if;
end;
$migration$;
