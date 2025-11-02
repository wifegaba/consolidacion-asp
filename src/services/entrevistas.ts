import { supabase } from "../lib/supabaseClient";

/** Subir la foto al bucket y devolver la ruta */
export async function uploadEntrevistaFoto(file: File, cedula: string, userId = "admin") {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  // Usamos la CÉDULA como identificador único y estable para la foto
  const path = `user/${userId}/entrevistas/${cedula}.${ext}`;

  const { error } = await supabase.storage
    .from("entrevistas-fotos")
    .upload(path, file, { upsert: true, cacheControl: "3600" });

  if (error) throw error;
  return path;
}

/** Guardar (Insertar o Actualizar) entrevista en la tabla */
export async function guardarEntrevista(values: any, file?: File) {
  let fotoPath: string | null = null;

  // 1. Subir la foto (si existe) usando la CÉDULA
  if (file) {
    if (!values.cedula) {
      throw new Error("No se puede subir la foto sin una cédula.");
    }
    fotoPath = await uploadEntrevistaFoto(file, values.cedula);
  }

  // created_by debe ser un UUID válido de usuario autenticado
  // Si tienes auth, usa el id del usuario logueado. Si no, pon un UUID dummy válido SOLO para pruebas locales:
  const createdBy = values.created_by || "00000000-0000-0000-0000-000000000000";

  // 2. Construir el PAYLOAD COMPLETO (Campos viejos + 17 nuevos)
  //    Nota: Se elimina el 'id' aleatorio, ya que 'upsert' lo manejará.
  const payload = {
    created_by: createdBy,
    foto_path: fotoPath,

    // --- Campos Personales (Existentes) ---
    nombre: values.nombre,
    cedula: values.cedula,
    telefono: values.telefono || null,
    email: values.email || null,
    fecha_nac: values.fechaNac ? values.fechaNac : null,
    lugar_nac: values.lugarNac || null,
    direccion: values.direccion || null,
    estado_civil: values.estadoCivil || null,
    ocupacion: values.ocupacion || null,
    escolaridad: values.escolaridad || null,

    // --- Campos Iglesia (Existentes) ---
    se_congrega: values.seCongrega || 'no',
    dia_congrega: values.diaCongrega || null,
    tiempo_iglesia: values.tiempoIglesia || null,
    invito: values.invito || null,
    pastor: values.pastor || null,

    // --- Campos Espirituales (Existentes) ---
    nacimiento_espiritu: values.nacimientoEspiritu || null,
    bautizo_agua: values.bautizoAgua || null,
    bautismo_espiritu: values.bautismoEspiritu || null,
    tiene_biblia: typeof values.tieneBiblia === 'boolean' ? values.tieneBiblia : false,
    ayuna: values.ayuna || null,

    // --- Campos Evaluación (Existentes) ---
    aspecto_feliz: typeof values.aspectoFeliz === 'boolean' ? values.aspectoFeliz : false,
    muy_interesado: typeof values.muyInteresado === 'boolean' ? values.muyInteresado : false,
    interviene: typeof values.interviene === 'boolean' ? values.interviene : false,
    cambios_fisicos: values.cambiosFisicos || null,
    notas: values.notas || null,
    promovido: values.promovido || null,

    // --- ¡AQUÍ COMIENZAN LOS 17 CAMPOS NUEVOS! ---
    
    // (Nuevos - Personales)
    labora_actualmente: values.laboraActualmente || null,
    
    // (Nuevos - Iglesia)
    viene_otra_iglesia: values.vieneOtraIglesia || null,
    otra_iglesia_nombre: values.otraIglesiaNombre || null,
    
    // (Nuevos - Espirituales)
    tiempo_oracion: values.tiempoOracion || null,
    frecuencia_lectura_biblia: values.frecuenciaLecturaBiblia || null,
    motivo_ayuno: values.motivoAyuno || null,
    
    // (Nuevos - Salud y Personal)
    meta_personal: values.metaPersonal || null,
    enfermedad: values.enfermedad || null,
    tratamiento_clinico: values.tratamientoClinico || null,
    motivo_tratamiento: values.motivoTratamiento || null,
    retiros_asistidos: values.retirosAsistidos || null,
    convivencia: values.convivencia || null,
    recibe_consejeria: values.recibeConsejeria || null,
    motivo_consejeria: values.motivoConsejeria || null,
    
    // (Nuevos - Evaluación)
    cambios_emocionales: values.cambiosEmocionales || null,
    desempeno_clase: values.desempenoClase || null,
    maestro_encargado: values.maestroEncargado || null
  };

  // 3. Ejecutar UPSERT en lugar de INSERT
  const { data, error } = await supabase
    .from("entrevistas")
    .upsert(payload, { onConflict: 'cedula' }) // <-- La clave: actualiza si la cédula ya existe
    .select('id') // Pedimos que nos devuelva el 'id' del registro (sea nuevo o existente)
    .single();

  if (error) {
    console.error("Error en Supabase:", error);
    throw error;
  }

  // Devolvemos el ID (sea nuevo o actualizado) y la ruta de la foto
  return { entrevistaId: data.id, fotoPath };
}

/** Generar Signed URL para mostrar la foto */
export async function getFotoURL(fotoPath: string) {
  const { data, error } = await supabase
    .storage
    .from("entrevistas-fotos")
    .createSignedUrl(fotoPath, 60 * 15); // 15 min
  if (error) throw error;
  return data.signedUrl;
}