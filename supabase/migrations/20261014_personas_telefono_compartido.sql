-- Un teléfono de contacto puede compartirse cuando se confirma otra identidad.
begin;
alter table public.persona add column if not exists telefono_compartido boolean not null default false;
alter table public.persona drop constraint if exists persona_telefono_key;
-- Conservar la protección habitual; solo los registros confirmados la exceptúan.
create unique index if not exists persona_telefono_key on public.persona(telefono)
  where not telefono_compartido;

do $migration$
declare
  v_definition text;
  v_old text := $old$if exists(select 1 from persona where ingreso_telefono(telefono)=ingreso_telefono(v_p.telefono)) then$old$;
  v_new text := $new$if exists(select 1 from persona where ingreso_telefono(telefono)=ingreso_telefono(v_p.telefono))
        and not coalesce(p_descartar_historial,false) then$new$;
  v_insert_old text := 'insert into persona(nombre,telefono) values(v_p.nombre,v_p.telefono) returning id into v_persona;';
  v_insert_new text := $new$insert into persona(nombre,telefono,telefono_compartido)
        values(v_p.nombre,v_p.telefono,coalesce(p_descartar_historial,false) and exists(
          select 1 from persona where ingreso_telefono(telefono)=ingreso_telefono(v_p.telefono)))
        returning id into v_persona;$new$;
begin
  v_definition := pg_get_functiondef(
    'public.fn_asignar_ingreso(uuid,uuid,text,uuid,text,boolean,boolean)'::regprocedure);
  if position(v_old in v_definition)>0 and position(v_insert_old in v_definition)>0 then
    execute replace(replace(v_definition,v_old,v_new),v_insert_old,v_insert_new);
  elsif position(v_insert_new in v_definition)=0 then
    raise exception 'No se reconoce el registro de persona en fn_asignar_ingreso';
  end if;

  -- La ruta heredada no debe sobrescribir al titular del número compartido.
  if to_regprocedure('public.fn_mover_pendiente(uuid,text,text,text)') is not null then
    v_definition := pg_get_functiondef('public.fn_mover_pendiente(uuid,text,text,text)'::regprocedure);
    execute regexp_replace(v_definition,
      'ON CONFLICT \(telefono\) DO UPDATE[[:space:]]+SET nombre = EXCLUDED.nombre',
      '', 'i');
  end if;
end;
$migration$;
notify pgrst, 'reload schema';
commit;
