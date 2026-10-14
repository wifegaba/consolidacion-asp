-- Pendientes no exige roles adicionales: basta una cuenta activa con sesión válida.
-- La API verifica la sesión; la función vuelve a comprobar la cuenta al asignar.
begin;
do $migration$
declare
  v_definition text;
  v_old text := $old$if not exists(select 1 from servidores_roles r join servidores s on s.id=r.servidor_id
    where r.servidor_id=p_usuario and r.vigente and s.activo
      and r.rol::text in ('Director','Administrador','Contactos','Maestros','Maestro Ptm')) then$old$;
  v_new text := $new$if not exists(select 1 from servidores s
    where s.id=p_usuario and s.activo) then$new$;
begin
  v_definition := pg_get_functiondef(
    'public.fn_asignar_ingreso(uuid,uuid,text,uuid,text,boolean,boolean)'::regprocedure);
  if position(v_old in v_definition) > 0 then
    -- Conservar la lógica de asignación y las correcciones ya instaladas.
    execute replace(v_definition, v_old, v_new);
  elsif position(v_new in v_definition) = 0 then
    raise exception 'No se reconoce la validación de acceso de fn_asignar_ingreso';
  end if;
end;
$migration$;
notify pgrst, 'reload schema';
commit;
