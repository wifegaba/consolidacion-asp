-- Ejecutar tras la migración; no deja personas, matrículas ni pendientes de prueba.
begin;
do $$
declare
  v_actor uuid; v_group jsonb; v_first uuid; v_second uuid; v_third uuid;
  v_pending uuid; v_progress uuid; v_failed boolean;
  v_phone text := '999'||lpad((floor(random()*10000000))::bigint::text,7,'0');
  v_name text := 'Prueba familiar '||gen_random_uuid();
begin
  select id into v_actor from servidores where activo limit 1;
  select g into v_group from jsonb_array_elements(fn_grupos_ingreso()) g
    where g->>'fuente'='persona' and g->>'etapa'='Semillas' and g->>'modulo'='1' limit 1;
  assert v_actor is not null and v_group is not null, 'Se requiere cuenta y grupo activos';
  insert into persona(nombre,telefono) values(v_name||' Primero',v_phone) returning id into v_first;
  insert into progreso(persona_id,etapa,modulo,semana,dia,estado,activo)
    values(v_first,'Semillas',1,1,(v_group->>'dia')::app_dia,'pendiente_llamar',true);
  v_pending := fn_encolar_ingreso(v_name||' Segundo',v_phone,null,null,v_actor);
  assert fn_historial_ingreso(v_name||' Segundo','+57 '||v_phone)->0->>'confianza'='probable',
    'Compartir número no confirma identidad';
  v_failed := false;
  begin
    perform fn_asignar_ingreso(v_pending,v_actor,null,null,v_group->>'key',false,false);
  exception when raise_exception then v_failed := true;
  end;
  assert v_failed, 'Se exige elegir explícitamente otra persona';
  v_failed := false;
  begin
    perform fn_asignar_ingreso(v_pending,v_actor,'persona',v_first,v_group->>'key',true,false);
  exception when raise_exception then v_failed := true;
  end;
  assert v_failed, 'No se duplica el proceso activo del titular original';
  v_progress := fn_asignar_ingreso(v_pending,v_actor,null,null,v_group->>'key',false,true);
  select persona_id into v_second from progreso where id=v_progress;
  assert v_second<>v_first, 'Los familiares deben tener identidades distintas';
  assert exists(select 1 from persona where id=v_second and nombre=v_name||' Segundo'
    and telefono=v_phone and telefono_compartido), 'Se guarda el mismo teléfono con confirmación';
  assert exists(select 1 from persona where id=v_first and nombre=v_name||' Primero'), 'Se conserva el nombre original';
  assert (select count(*) from progreso where persona_id in(v_first,v_second) and activo)=2,
    'Cada familiar conserva su matrícula activa';
  assert exists(select 1 from reingresos_decisiones where pendiente_id=v_pending and usuario_id=v_actor
    and identidad_id is null), 'Se audita la creación independiente';
  assert not exists(select 1 from pendientes where id=v_pending), 'Solo se consume el pendiente asignado';
  -- También acepta el prefijo de Colombia sin confundir al tercer familiar.
  v_pending := fn_encolar_ingreso(v_name||' Tercero','57'||v_phone,null,null,v_actor);
  v_progress := fn_asignar_ingreso(v_pending,v_actor,null,null,v_group->>'key',false,true);
  select persona_id into v_third from progreso where id=v_progress;
  assert v_third not in(v_first,v_second), 'Un tercer familiar recibe su propio registro';
  assert exists(select 1 from persona where id=v_third and telefono_compartido), 'Se reconoce el prefijo 57';
  v_failed := false;
  begin
    insert into persona(nombre,telefono) values(v_name||' Sin confirmar',v_phone);
  exception when unique_violation then v_failed := true;
  end;
  assert v_failed, 'La ruta habitual aún bloquea números duplicados sin confirmación';
end;
$$;
rollback;
