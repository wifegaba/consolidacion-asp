-- Run after the migration. All fixtures and decisions are rolled back.
begin;
do $$
declare
  v_persona uuid; v_pending uuid; v_result uuid; v_actor uuid; v_group jsonb;
  v_name text := 'Prueba Reingreso '||gen_random_uuid();
  v_phone text := '999'||substr(replace(gen_random_uuid()::text,'-',''),1,7);
  v_history jsonb; v_before bigint; v_failed boolean;
  v_interview uuid; v_enrollment uuid; v_academic jsonb; v_document text;
begin
  -- Digits only, unique enough for a rolled-back fixture.
  v_phone := '999'||lpad((floor(random()*10000000))::bigint::text,7,'0');
  select s.id into v_actor from servidores s join servidores_roles r on r.servidor_id=s.id
    where s.activo and r.vigente and r.rol::text='Contactos' limit 1;
  assert v_actor is not null, 'A Contactos user is required to verify the requested permissions';
  select g into v_group from jsonb_array_elements(fn_grupos_ingreso()) g
    where g->>'fuente'='persona' and g->>'etapa'='Semillas' and g->>'modulo'='2' limit 1;
  assert v_group is not null, 'An active Semilla 2 assignment is required';

  insert into persona(nombre,telefono) values(v_name,v_phone) returning id into v_persona;
  insert into progreso(persona_id,etapa,modulo,semana,dia,estado,activo,creado_en)
    values(v_persona,'Semillas',4,2,'Domingo','archivado',false,'2020-01-01'),
          (v_persona,'Semillas',2,3,'Domingo','archivado',false,'2025-01-01');
  v_history:=fn_historial_ingreso(upper(v_name),'+57 '||v_phone);
  assert jsonb_array_length(v_history)=1, 'Formatted phone and name should match a single person';
  assert v_history->0->>'confianza'='segura', 'Name and phone provide a reliable match';
  assert v_history->0->>'nivel'='Semilla 2', 'Last process must win over the highest level';
  assert fn_historial_ingreso('Otra persona distinta',v_phone)->0->>'confianza'='probable', 'Shared phone alone must remain probable';
  assert jsonb_array_length(fn_historial_ingreso(v_name,'888888888888'))=1, 'Name-only matches must be reviewable';
  assert fn_historial_ingreso(v_name,'888888888888')->0->>'confianza'='probable', 'Name alone never confirms identity';

  v_pending:=fn_encolar_ingreso(v_name,v_phone,'Domingo - 9:00 AM','Prueba',v_actor);
  assert fn_encolar_ingreso(v_name,'+57 '||v_phone,'Domingo - 9:00 AM','Prueba',v_actor)=v_pending, 'Double submission must not duplicate a pending';
  assert exists(select 1 from jsonb_array_elements(fn_pendientes_ingreso()) p where p->>'id'=v_pending::text and p->'history'->0->>'nivel'='Semilla 2');

  v_failed:=false;
  begin
    perform fn_asignar_ingreso(v_pending,v_actor,'persona',v_persona,v_group->>'key',false,false);
  exception when others then v_failed:=true; end;
  assert v_failed, 'Identity requires explicit review';
  assert exists(select 1 from pendientes where id=v_pending), 'Failed review keeps the pending';

  v_failed:=false;
  begin
    perform fn_asignar_ingreso(v_pending,v_actor,'persona',v_persona,'inactive-group',true,false);
  exception when others then v_failed:=true; end;
  assert v_failed, 'Inactive groups must be rejected';
  select count(*) into v_before from progreso where persona_id=v_persona;
  v_result:=fn_asignar_ingreso(v_pending,v_actor,'persona',v_persona,v_group->>'key',true,false);
  assert not exists(select 1 from pendientes where id=v_pending), 'Only success consumes the pending';
  assert (select count(*) from progreso where persona_id=v_persona)=v_before+1, 'History must be retained';
  assert (select count(*) from progreso where persona_id=v_persona and activo)=1, 'Only one new active process';
  assert exists(select 1 from progreso where id=v_result and modulo=2 and dia::text=v_group->>'dia'), 'Chosen group must be used';
  assert exists(select 1 from reingresos_decisiones where pendiente_id=v_pending and usuario_id=v_actor), 'Record who made the decision';
  v_failed:=false;
  begin
    perform fn_asignar_ingreso(v_pending,v_actor,'persona',v_persona,v_group->>'key',true,false);
  exception when others then v_failed:=true; end;
  assert v_failed, 'A consumed pending cannot be processed twice';

  -- Documents, email, conflicts and academic attendance preservation.
  select g into v_academic from jsonb_array_elements(fn_grupos_ingreso()) g where g->>'fuente'='entrevista' limit 1;
  assert v_academic is not null, 'An active academic assignment is required';
  v_document:=replace(gen_random_uuid()::text,'-','');
  insert into entrevistas(nombre,cedula,telefono,email) values(v_name||' Academia',v_document,'888'||substr(v_phone,4),v_document||'@example.test') returning id into v_interview;
  insert into inscripciones(entrevista_id,curso_id,servidor_id,estado)
    values(v_interview,(v_academic->>'cursoId')::integer,(v_academic->>'maestroId')::uuid,'inactivo') returning id into v_enrollment;
  insert into asistencias_academia(inscripcion_id,asistencias) values(v_enrollment,'{"1":{"1":"si"}}');
  v_history:=fn_historial_ingreso('Otra Identidad '||gen_random_uuid(),v_phone||'99',v_document);
  assert jsonb_array_length(v_history)=1 and v_history->0->>'confianza'='segura', 'Document is the strongest identifier';
  v_history:=fn_historial_ingreso(v_name||' Academia','888'||substr(v_phone,4),'OTRO-DOCUMENTO');
  assert v_history->0->>'confianza'='probable', 'Conflicting documents prevent a safe match';
  v_history:=fn_historial_ingreso(v_name||' Academia',v_phone||'99',null,v_document||'@example.test');
  assert v_history->0->>'confianza'='segura', 'Name and email can confirm a match';
  v_pending:=fn_encolar_ingreso('Nombre diferente','777'||substr(v_phone,4),null,'Prueba academia',v_actor,v_document);
  perform fn_asignar_ingreso(v_pending,v_actor,'entrevista',v_interview,v_academic->>'key',true,false);
  assert (select asistencias::jsonb from asistencias_academia where inscripcion_id=v_enrollment)='{"1":{"1":"si"}}'::jsonb, 'Reactivation must keep attendance';
  assert (select estado from inscripciones where id=v_enrollment)='activo', 'Academic assignment should reactivate the chosen enrollment';

  -- A new person can be assigned to any explicitly chosen active level.
  v_pending:=fn_encolar_ingreso(v_name||' Nueva','666'||substr(v_phone,4),null,'Sin historial',v_actor);
  v_result:=fn_asignar_ingreso(v_pending,v_actor,null,null,v_group->>'key',false,false);
  assert exists(select 1 from progreso where id=v_result and modulo=2 and activo), 'The user can choose a level without an automatic level 1 default';
  assert exists(select 1 from persona_registro pr join progreso p on p.persona_id=pr.persona_id where p.id=v_result), 'Legacy pending records without a worship day remain assignable';
end;
$$;
rollback;
