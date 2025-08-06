'use client';

import { User, IdCard, Phone } from 'lucide-react';

import './FormularioEstudiante.css';
import React, { useState, useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import Select from 'react-select';
import { supabase } from '@/lib/supabase';








export default function FormularioEstudiante() {
  useEffect(() => {
    AOS.init({
      duration: 300,
      once: true,
      offset: 80,
    });
  }, []);

  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    cedula: '',
    semestre: '1',
    serie: 'Serie 1',
    serie_id: null, // 🟢 AGREGADO AQUÍ
    clase: '',
    nota: ''
  });




  const [clasesDisponibles, setClasesDisponibles] = useState<any[]>([]);

  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [coincidencias, setCoincidencias] = useState<any[]>([]);
  const [indiceSugerido, setIndiceSugerido] = useState(0);
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<any | null>(null);

  const [mostrarLista, setMostrarLista] = useState(false);
  const [nombreSerie, setNombreSerie] = useState('');
  const [profesor, setProfesor] = useState('');
  const [sesiones, setSesiones] = useState<number | string>('');
  const [semestreSeleccionado, setSemestreSeleccionado] = useState<number | null>(null);
  const [seriesDisponibles, setSeriesDisponibles] = useState<Serie[]>([]);

  const [notas, setNotas] = useState<any[]>([]);

  // ✅ Cargar notas reales al seleccionar estudiante
useEffect(() => {
  if (!estudianteSeleccionado?.id || !form.serie_id || !semestreSeleccionado) return;

  const obtenerNotas = async () => {
    const { data, error } = await supabase
      .from('notas')
      .select(`
        nota,
        clase_id,
        clases (
          numero,
          series (
            id,
            titulo,
            profesor,
            semestre_id
          )
        )
      `)
      .eq('estudiante_id', estudianteSeleccionado.id)
      .eq('clases.series.id', form.serie_id)
      .eq('clases.series.semestre_id', semestreSeleccionado);

    if (error) {
      console.error('❌ Error al obtener notas:', error);
      return;
    }

   setNotas(
     (data || []).map(n => ({
       clase: n.clases?.numero ?? '—',
       profesor: n.clases?.series?.profesor ?? '—',
       serieTitulo: n.clases?.series?.titulo ?? '—', // 🟢 nuevo
       semestreId: n.clases?.series?.semestre_id ?? 0, // 🟢 nuevo
       valor: n.nota
     }))
   );

  };

  obtenerNotas();
}, [estudianteSeleccionado, form.serie_id, semestreSeleccionado]);


const cargarSeriesDesdeSupabase = async (semestreId: number) => {
  const { data, error } = await supabase
    .from('series')
    .select('*')
    .eq('semestre_id', semestreId);

  if (error) {
    console.error('Error cargando series:', error);
    setSeriesDisponibles([]);
    return;
  }

  setSeriesDisponibles(data || []);
};





const seleccionarSerie = (serie: any) => {
  if (!serie) return;

  setForm(prev => ({
    ...prev,
    serie: serie.titulo,
    serie_id: serie.id
  }));

  setNombreSerie(serie.titulo);
  setProfesor(serie.profesor);
  setSesiones(serie.sesiones);
  setMostrarLista(false);

  const cargarClasesDeSerie = async (serieId: number) => {
    const { data, error } = await supabase
      .from('clases')
      .select('*')
      .eq('serie_id', serieId);

    if (!error) {
      setClasesDisponibles(data || []);
    }
  };

  cargarClasesDeSerie(serie.id); // ✅ llama esto al seleccionar la serie

};

const totalSesiones = Number(sesiones || 0);

// Array de números: [1, 2, 3, ..., sesiones]
const clasesPorNumero = Array.from({ length: totalSesiones }, (_, i) => i + 1);

// Filtrar solo las clases que aún no tienen nota registrada
const clasesFiltradas = clasesPorNumero.filter(
  (numeroClase) =>
    !notas.some(
      (n) =>
        parseInt(n.clase) === numeroClase &&
        n.serieTitulo === nombreSerie
    )
);





  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };






  const buscarEstudiantesLive = async (texto: string) => {
    setTerminoBusqueda(texto);

    if (texto.trim().length < 2) {
      setCoincidencias([]);
      return;
    }

    try {
      const res = await fetch(`/api/estudiantes/buscar?q=${encodeURIComponent(texto)}`);
      const data = await res.json();

      if (res.ok && data.estudiantes) {
        setCoincidencias(data.estudiantes);
      } else {
        setCoincidencias([]);
      }
    } catch (err) {
      console.error('Error al buscar estudiante:', err);
      setCoincidencias([]);
    }
  };





const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!form.serie_id || !form.clase || !form.nota || !estudianteSeleccionado?.id) {
    alert('Por favor completa todos los campos antes de guardar.');
    return;
  }

  // 🟢 Buscar clase real según número y serie seleccionada
  const claseSeleccionada = clasesDisponibles.find(
    (c) => c.numero === parseInt(form.clase) && c.serie_id === form.serie_id
  );

  if (!claseSeleccionada) {
    alert('❌ Clase no encontrada para esta serie.');
    return;
  }

  // 📝 Insertar la nota en Supabase
  const { error } = await supabase.from('notas').insert([
    {
      estudiante_id: estudianteSeleccionado.id,
      clase_id: claseSeleccionada.id,
      nota: parseFloat(form.nota),
      fecha_registro: new Date().toISOString()
    }
  ]);

  if (error) {
    console.error('❌ Error al guardar nota:', error);
    alert('Error al guardar la nota.');
    return;
  }

  alert('✅ Nota guardada correctamente.');

  // 🔄 Opcional: recargar las notas después de guardar
  if (form.serie_id) {
    obtenerNotas(estudianteSeleccionado.id, form.serie_id);
  }

  // 🔁 Limpiar campo nota opcionalmente
  setForm(prev => ({ ...prev, nota: '' }));
};


  return (
     <div className="contenedor-dos-columnas">
         {/* Panel izquierdo: Formulario */}
         <div className="panel-formulario">
            <form className="formulario" onSubmit={handleSubmit}>
                  <div className="encabezado-formulario" data-aos="fade-down">
                    <h2 className="titulo-formulario">Asignacion de Notas</h2>
                  </div>


              <div className="buscador-estudiante" data-aos="fade-up" data-aos-delay="100">
                <input
                  type="text"
                  className="input-busqueda"
                  placeholder="Buscar estudiante"
                  value={terminoBusqueda}
                  onChange={(e) => {
                    buscarEstudiantesLive(e.target.value);
                    setIndiceSugerido(0);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setIndiceSugerido((prev) => Math.min(prev + 1, coincidencias.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setIndiceSugerido((prev) => Math.max(prev - 1, 0));
                    } else if (e.key === 'Enter' && coincidencias.length > 0) {
                      e.preventDefault();
                      const est = coincidencias[indiceSugerido];

                      // 🟢 Cargar series reales desde Supabase para el semestre 1
                      const { data: series, error } = await supabase
                        .from('series')
                        .select('*')
                        .eq('semestre_id', 1);

                      if (error || !series?.length) {
                        alert('❌ No se pudieron cargar las series del semestre 1');
                        return;
                      }

                      const primeraSerie = series[0];

                      setForm((prev) => ({
                        ...prev,
                        nombre: est.nombre,
                        telefono: est.telefono,
                        cedula: est.cedula,
                        semestre: '1',
                        serie: `Serie ${primeraSerie.numero}`,
                        serie_id: primeraSerie.id
                      }));

                      setNombreSerie(primeraSerie.titulo);
                      setProfesor(primeraSerie.profesor);
                      setSesiones(primeraSerie.sesiones);
                      setSemestreSeleccionado(1);
                      setEstudianteSeleccionado(est);
                      setSeriesDisponibles(series);

                      setTerminoBusqueda('');
                      setCoincidencias([]);
                    } else if (e.key === 'Escape') {
                      setCoincidencias([]);
                    }
                  }}
                  autoComplete="off"
                />


                {coincidencias.length > 0 && (
                  <ul className="lista-autocompletado">
                    {coincidencias.map((est, i) => (
                     <li
                       key={est.id}
                       className={i === indiceSugerido ? 'activo' : ''}
                       onMouseEnter={() => setIndiceSugerido(i)}
                       onClick={async () => {
                         // 🟢 Cargar series reales desde Supabase para el semestre 1
                         const { data: series, error } = await supabase
                           .from('series')
                           .select('*')
                           .eq('semestre_id', 1);

                         if (error || !series?.length) {
                           alert('❌ No se pudieron cargar las series del semestre 1');
                           return;
                         }

                         const primeraSerie = series[0];

                         setForm((prev) => ({
                           ...prev,
                           nombre: est.nombre,
                           telefono: est.telefono,
                           cedula: est.cedula,
                           semestre: '1',
                           serie: `Serie ${primeraSerie.numero}`,
                           serie_id: primeraSerie.id
                         }));

                         setNombreSerie(primeraSerie.titulo);
                         setProfesor(primeraSerie.profesor);
                         setSesiones(primeraSerie.sesiones);
                         setSemestreSeleccionado(1);
                         setEstudianteSeleccionado(est);
                         setSeriesDisponibles(series);

                         setTerminoBusqueda('');
                         setCoincidencias([]);
                       }}
                     >
                       {est.nombre}
                     </li>

                    ))}
                  </ul>
                )}
              </div>






                  <div className="fila-formulario">
                    {/* Columna izquierda */}
                    <div className="columna-formulario">
                      {/* Nombre */}
                      <div className="grupo-campo" data-aos="fade-up" data-aos-delay="100">
                        <label htmlFor="nombre" className="label-campo"></label>
                        <div className="campo-con-icono">
                          <User className="icono-campo" />
                          <input type="text" id="nombre" name="nombre" placeholder="Nombre completo"
                            className="campo-input" value={form.nombre} onChange={handleChange} />
                        </div>
                      </div>

                      {/* Teléfono */}
                      <div className="grupo-campo" data-aos="fade-up" data-aos-delay="200">
                        <label htmlFor="telefono" className="label-campo"></label>
                        <div className="campo-con-icono">
                          <Phone className="icono-campo" />
                          <input type="text" id="telefono" name="telefono" placeholder="Teléfono"
                            className="campo-input" value={form.telefono} onChange={handleChange} />
                        </div>
                      </div>

                      {/* Cédula */}
                      <div className="grupo-campo" data-aos="fade-up" data-aos-delay="300">
                        <label htmlFor="cedula" className="label-campo"></label>
                        <div className="campo-con-icono">
                          <IdCard className="icono-campo" />
                          <input type="text" id="cedula" name="cedula" placeholder="Cédula"
                            className="campo-input" value={form.cedula} onChange={handleChange} />
                        </div>
                      </div>

                    {/* Semestre */}
                    <div className="grupo-campo" data-aos="fade-up" data-aos-delay="400">
                      <label htmlFor="semestre" className="label-campo"></label>
                      <select
                        id="semestre"
                        className="select-input-neumo"
                        value={form.semestre}
                        onChange={async (e) => {
                          const semestre = parseInt(e.target.value);
                          setSemestreSeleccionado(semestre);

                          await cargarSeriesDesdeSupabase(semestre); // ✅ llama la función correcta

                          setForm(prev => ({
                            ...prev,
                            semestre: semestre.toString(),
                            serie: '',
                            serie_id: null
                          }));

                          setNombreSerie('');
                          setProfesor('');
                          setSesiones('');
                        }}

                      >
                        <option value="">Selecciona semestre</option>
                        {[1, 2, 3, 4, 5].map((num) => (
                          <option key={num} value={num}>
                            Semestre {num}
                          </option>
                        ))}
                      </select>



                      {/* Serie */}
                                            <div className="grupo-campo" data-aos="fade-up" data-aos-delay="100">
                                              <label className="label-campo"></label>
                                              <div className="dropdown-serie">
                                               <button type="button" className="dropdown-btn" onClick={() => setMostrarLista(!mostrarLista)}>
                                                 {form.serie || 'Selecciona una serie'}
                                               </button>

                                                {mostrarLista && (
                                                  <ul className="dropdown-lista">
                                                  {seriesDisponibles.map((serie) => (
                                               <li key={serie.id} onClick={() => seleccionarSerie(serie)}>
                                                 📘 {serie.titulo}
                                               </li>



                                                  ))}

                                                  </ul>
                                                )}
                                              </div>

                                            </div>


                    </div>
                      </div>


                    {/* Columna derecha */}
                    <div className="columna-formulario">



                     <div className="bloque-detalle-serie">
                       {/* Nombre de la Serie */}
                       <div className="grupo-campo" data-aos="fade-up" data-aos-delay="200">
                         <label className="label-campo">Nombre de la Serie</label>
                         <div className="nombre-serie-box">
                           <div className="nombre-serie-valor">{nombreSerie || '—'}</div>
                         </div>
                       </div>





                       {/* Profesor */}
                       <div className="grupo-campo" data-aos="fade-up" data-aos-delay="300">
                         <label className="label-campo">Profesor</label>
                         <div className="nombre-serie-box">
                           <div className="nombre-serie-valor">{profesor || '—'}</div>
                         </div>
                       </div>

                       {/* Sesiones */}
                       <div className="grupo-campo" data-aos="fade-up" data-aos-delay="400">
                         <label className="label-campo">Sesiones</label>
                         <div className="nombre-serie-box">
                           <div className="nombre-serie-valor">{sesiones || '—'}</div>
                         </div>
                       </div>
                     </div>


                      {/* Clase */}
                      <div className="grupo-campo" data-aos="fade-up" data-aos-delay="500">

                     <select
                       id="clase"
                       className="select-input"
                       value={form.clase || ''}
                       onChange={(e) =>
                         setForm((prev) => ({
                           ...prev,
                           clase: parseInt(e.target.value)
                         }))
                       }
                     >
                       <option value="">Selecciona clase</option>
                       {clasesFiltradas.map((numero) => (
                         <option key={numero} value={numero}>
                           Clase {numero}
                         </option>
                       ))}
                     </select>

                      </div>

                      {/* Nota */}
                      <div className="grupo-campo" data-aos="fade-up" data-aos-delay="600">
                        <label htmlFor="nota" className="label-campo">Nota</label>
                        <div className="campo-con-icono">
                          <input id="nota" type="number" step="0.1" min="0" max="10"
                            className="campo-input" value={form.nota || ''}
                            onChange={(e) =>
                              setForm(prev => ({
                                ...prev,
                                nota: e.target.value ? parseFloat(e.target.value) : ''
                              }))
                            }
                          />
                        </div>
                      </div>



                      {/* Botón guardar */}
                      <div data-aos="zoom-in-up" data-aos-delay="700">
                      <button
                        type="button"
                        className="boton-principal"
                        onClick={async () => {
                          try {
                            // 🛑 Validación
                            if (!form.clase || !form.nota) {
                              alert('⚠️ Debes seleccionar una clase y escribir una nota');
                              return;
                            }

                            if (!estudianteSeleccionado || !estudianteSeleccionado.id) {
                              alert('❌ No se ha seleccionado un estudiante válido');
                              return;
                            }

                            if (!form.serie_id) {
                              alert('⚠️ No se ha seleccionado una serie válida');
                              return;
                            }

                            // ✅ Buscar la clase real por número y serie_id
                            const claseSeleccionada = clasesDisponibles.find(
                              (c) => c.numero === parseInt(form.clase) && c.serie_id === form.serie_id
                            );

                            if (!claseSeleccionada) {
                              alert('❌ Clase no encontrada. Verifica la serie y la clase.');
                              return;
                            }

                            // ✅ Guardar en Supabase con el ID real de la clase
                            const res = await fetch('/api/notas', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                estudiante_id: estudianteSeleccionado.id,
                                clase_id: claseSeleccionada.id, // 🎯 El ID real
                                nota: form.nota
                              })
                            });

                            const data = await res.json();

                            if (!res.ok) {
                              throw new Error(data.error || 'Error desconocido');
                            }

                            // ✅ Mostrar visualmente en el panel de notas
                            setNotas((prev) => [
                              ...prev,
                              {
                                clase: form.clase,
                                valor: form.nota,
                                profesor: profesor,
                                serieTitulo: nombreSerie // para mostrar en la tarjeta
                              }
                            ]);

                            alert('✅ Nota guardada correctamente');

                            // 🧹 Limpiar campos
                            setForm((prev) => ({
                              ...prev,
                              clase: '',
                              nota: ''
                            }));
                          } catch (err: any) {
                            alert('❌ Error al guardar nota: ' + err.message);
                          }
                        }}
                      >
                        Guardar Nota
                      </button>


                      </div>
                    </div>
                  </div>


                </form>
         </div>

      {/* Panel derecho: Notas registradas */}
      <div className="panel-notas">
        <h3 className="titulo-notas-neumo">Informe de Notas</h3>

        {estudianteSeleccionado && (
          <div className="tarjeta-estudiante-horizontal">
            <span className="campo-horizontal">
              <strong>Nombre:</strong> {estudianteSeleccionado.nombre}
            </span>
            <span className="campo-horizontal">
              <strong>Teléfono:</strong> {estudianteSeleccionado.telefono}
            </span>
          </div>
        )}

    {clasesFiltradas.length > 0 && nombreSerie && (
      <div className="tarjeta-pendiente-notas">
        <h4 className="titulo-pendiente">Notas pendientes</h4>
        <hr />
        <p className="serie-pendiente">{nombreSerie}</p>
        <p className="clases-pendientes">
          Número de clases: <strong>{clasesFiltradas.length}</strong>
        </p>
      </div>
    )}


       <div className="lista-notas">
         {notas.length === 0 && (
           <p style={{ color: '#ccc', padding: '1rem' }}>No hay notas registradas.</p>
         )}

       {notas
         .filter((n) => n.serieTitulo === nombreSerie) // ✅ solo muestra la serie actual
         .map((n, i) => (
           <div key={i} className="tarjeta-nota">
             <h4>Clase {n.clase}</h4>
             <p>Nota: <strong>{n.valor}</strong></p>
             <p>Serie: {n.serieTitulo}</p>
           </div>
       ))}

       </div>

      </div>

       </div>
  );
}
