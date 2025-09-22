import { supabase } from "../lib/supabaseClient";

/** Subir la foto al bucket y devolver la ruta */
export async function uploadEntrevistaFoto(file: File, entrevistaId: string, userId = "admin") {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `user/${userId}/entrevistas/${entrevistaId}.${ext}`;

  const { error } = await supabase.storage
    .from("entrevistas-fotos")
    .upload(path, file, { upsert: true, cacheControl: "3600" });

  if (error) throw error;
  return path;
}

/** Guardar entrevista en la tabla junto con la ruta de la foto */
export async function guardarEntrevista(values: any, file?: File) {
  const entrevistaId = crypto.randomUUID();
  let fotoPath: string | null = null;

  if (file) {
    fotoPath = await uploadEntrevistaFoto(file, entrevistaId);
  }

  // created_by debe ser un UUID válido de usuario autenticado
  // Si tienes auth, usa el id del usuario logueado. Si no, pon un UUID dummy válido SOLO para pruebas locales:
  const createdBy = values.created_by || "00000000-0000-0000-0000-000000000000";

  const payload = {
    id: entrevistaId,
    created_by: createdBy,
    foto_path: fotoPath,
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
    se_congrega: values.seCongrega || 'no',
    dia_congrega: values.diaCongrega || null,
    tiempo_iglesia: values.tiempoIglesia || null,
    invito: values.invito || null,
    pastor: values.pastor || null,
    nacimiento_espiritu: values.nacimientoEspiritu || null,
    bautizo_agua: values.bautizoAgua || null,
    bautismo_espiritu: values.bautismoEspiritu || null,
    tiene_biblia: typeof values.tieneBiblia === 'boolean' ? values.tieneBiblia : false,
    ayuna: values.ayuna || null,
    aspecto_feliz: typeof values.aspectoFeliz === 'boolean' ? values.aspectoFeliz : false,
    muy_interesado: typeof values.muyInteresado === 'boolean' ? values.muyInteresado : false,
    interviene: typeof values.interviene === 'boolean' ? values.interviene : false,
    cambios_fisicos: values.cambiosFisicos || null,
    notas: values.notas || null,
    promovido: values.promovido || null,
  };

  // Asegura que fecha_nac sea tipo Date o string YYYY-MM-DD
  if (payload.fecha_nac && typeof payload.fecha_nac === 'string') {
    // Si ya es YYYY-MM-DD, ok. Si no, intenta convertir.
    const d = new Date(payload.fecha_nac);
    if (!isNaN(d.getTime())) {
      payload.fecha_nac = d.toISOString().slice(0, 10);
    }
  }

  const { error } = await supabase.from("entrevistas").insert(payload);
  if (error) throw error;

  return { entrevistaId, fotoPath };
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
