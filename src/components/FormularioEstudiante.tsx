'use client';

import { User, IdCard, Phone } from 'lucide-react';
import './FormularioEstudiante.css';

import React, { useState, useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { supabase } from '@/lib/supabase';

type Serie = {
  id: number;
  titulo: string;
  profesor: string;
  sesiones: number;
  semestre_id: number;
};

export default function FormularioEstudiante() {
  useEffect(() => {
    AOS.init({ duration: 300, once: true, offset: 80 });
  }, []);

  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    cedula: '',
    semestre: '1',
    serie: '',
    serie_id: null as number | null,
    clase: '' as string | number,
    nota: '' as string | number
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
          (data || []).map((n) => {
            const clase = Array.isArray(n.clases) ? n.clases[0] : n.clases;
            const serie = Array.isArray(clase?.series) ? clase.series[0] : clase?.series;

            return {
              clase: clase?.numero ?? '—',
              profesor: serie?.profesor ?? '—',
              serieTitulo: serie?.titulo ?? '—',
              semestreId: serie?.semestre_id ?? 0,
              valor: n.nota
            };
          })
      );
    };

    obtenerNotas();
  }, [estudianteSeleccionado, form.serie_id, semestreSeleccionado]);

  const cargarSeriesDesdeSupabase = async (semestreId: number) => {
    const { data, error } = await supabase.from('series').select('*').eq('semestre_id', semestreId);
    if (error) {
      console.error('Error cargando series:', error);
      setSeriesDisponibles([]);
      return;
    }
    setSeriesDisponibles(data || []);
  };

  const mostrarMensajeTemporal = (mensaje: string): void => {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const seleccionarSerie = (serie: Serie) => {
    if (!serie) return;

    setForm(prev => ({ ...prev, serie: serie.titulo, serie_id: serie.id }));
    setNombreSerie(serie.titulo);
    setProfesor(serie.profesor);
    setSesiones(serie.sesiones);
    setMostrarLista(false);

    const cargarClasesDeSerie = async (serieId: number) => {
      const { data, error } = await supabase.from('clases').select('*').eq('serie_id', serieId);
      if (!error) setClasesDisponibles(data || []);
    };

    cargarClasesDeSerie(serie.id);
  };

  const totalSesiones = Number(sesiones || 0);
  const clasesPorNumero = Array.from({ length: totalSesiones }, (_, i) => i + 1);

  const clasesFiltradas = clasesPorNumero.filter(
      (numeroClase) =>
          !notas.some(
              (n) => parseInt(n.clase) === numeroClase && n.serieTitulo === nombreSerie
          )
  );

  const getNotaColor = (nota: number): string => {
    if (nota >= 9) return '#22c55e';
    if (nota >= 6) return '#eab308';
    return '#ef4444';
  };

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
      setCoincidencias(res.ok && data.estudiantes ? data.estudiantes : []);
    } catch (err) {
      console.error('Error al buscar estudiante:', err);
      setCoincidencias([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.serie_id || !form.clase || !form.nota || !estudianteSeleccionado?.id) {
      mostrarMensajeTemporal('Completa serie, clase, nota y estudiante.');
      return;
    }

    const claseSeleccionada = clasesDisponibles.find(
        (c) => c.numero === parseInt(String(form.clase)) && c.serie_id === form.serie_id
    );

    if (!claseSeleccionada) {
      mostrarMensajeTemporal('❌ Clase no encontrada para esta serie.');
      return;
    }

    const res = await fetch('/api/notas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estudiante_id: estudianteSeleccionado.id,
        clase_id: claseSeleccionada.id,
        nota: parseFloat(String(form.nota))
      })
    });

    const data = await res.json();
    if (!res.ok) {
      mostrarMensajeTemporal('❌ ' + (data.error || 'Error al guardar'));
      return;
    }

    setNotas(prev => [
      ...prev,
      { clase: form.clase, valor: form.nota, profesor, serieTitulo: nombreSerie }
    ]);

    mostrarMensajeTemporal('✅ Nota guardada correctamente');

    setForm(prev => ({ ...prev, clase: '', nota: '' }));
  };

  return (
      <div className="contenedor-dos-columnas">
        {/* Panel izquierdo: Formulario */}
        <div className="panel-formulario">
          <form className="formulario" onSubmit={handleSubmit}>
            <div className="registro-header">
              <div className="registro-header__title">Asignar Notas</div>
            </div>

            <div className="buscador-estudiante" >
              <input
                  type="text"
                  className="input-busqueda"
                  placeholder="Buscar estudiante"
                  value={terminoBusqueda}
                  onChange={(e) => { buscarEstudiantesLive(e.target.value); setIndiceSugerido(0); }}
                  onKeyDown={async (e) => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceSugerido(prev => Math.min(prev + 1, coincidencias.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceSugerido(prev => Math.max(prev - 1, 0)); }
                    else if (e.key === 'Enter' && coincidencias.length > 0) {
                      e.preventDefault();
                      const est = coincidencias[indiceSugerido];

                      const { data: series, error } = await supabase
                          .from('series').select('*').eq('semestre_id', 1);

                      if (error || !series?.length) { mostrarMensajeTemporal('❌ No se pudieron cargar las series del semestre 1'); return; }

                      const primeraSerie = series[0];

                      setForm(prev => ({
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
                              const { data: series, error } = await supabase
                                  .from('series').select('*').eq('semestre_id', 1);

                              if (error || !series?.length) { mostrarMensajeTemporal('❌ No se pudieron cargar las series del semestre 1'); return; }

                              const primeraSerie = series[0];

                              setForm(prev => ({
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
                <div className="grupo-campo" >
                  <label htmlFor="nombre" className="label-campo"></label>
                  <div className="campo-con-icono">
                    <User className="icono-campo" />
                    <input
                        type="text"
                        id="nombre"
                        name="nombre"
                        placeholder="Nombre completo"
                        className="campo-input"
                        value={form.nombre}
                        onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="grupo-campo" >
                  <label htmlFor="telefono" className="label-campo"></label>
                  <div className="campo-con-icono">
                    <Phone className="icono-campo" />
                    <input
                        type="text"
                        id="telefono"
                        name="telefono"
                        placeholder="Teléfono"
                        className="campo-input"
                        value={form.telefono}
                        onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="grupo-campo" >
                  <label htmlFor="cedula" className="label-campo"></label>
                  <div className="campo-con-icono">
                    <IdCard className="icono-campo" />
                    <input
                        type="text"
                        id="cedula"
                        name="cedula"
                        placeholder="Cédula"
                        className="campo-input"
                        value={form.cedula}
                        onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="grupo-campo" >
                  <label htmlFor="semestre" className="label-campo"></label>
                  <select
                      id="semestre"
                      className="select-input-neumo"
                      value={form.semestre}
                      onChange={async (e) => {
                        const semestre = parseInt(e.target.value);
                        setSemestreSeleccionado(semestre);
                        await cargarSeriesDesdeSupabase(semestre);

                        setForm(prev => ({ ...prev, semestre: semestre.toString(), serie: '', serie_id: null }));
                        setNombreSerie(''); setProfesor(''); setSesiones('');
                      }}
                  >
                    <option value="">Selecciona semestre</option>
                    {[1, 2, 3, 4, 5].map((num) => (
                        <option key={num} value={num}>Semestre {num}</option>
                    ))}
                  </select>

                  <div className="grupo-campo" >
                    <label className="label-campo">Serie</label>
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
                  <div className="grupo-campo" >
                    <label className="label-campo">Nombre de la Serie</label>
                    <div className="nombre-serie-box">
                      <div className="nombre-serie-valor">{nombreSerie || '—'}</div>
                    </div>
                  </div>

                  <div className="grupo-campo" >
                    <label className="label-campo">Profesor</label>
                    <div className="nombre-serie-box">
                      <div className="nombre-serie-valor">{profesor || '—'}</div>
                    </div>
                  </div>

                  <div className="grupo-campo" >
                    <label className="label-campo">Sesiones</label>
                    <div className="nombre-serie-box">
                      <div className="nombre-serie-valor">{sesiones || '—'}</div>
                    </div>
                  </div>
                </div>

                <div className="grupo-campo" >
                  <select
                      id="clase"
                      className="select-input"
                      value={form.clase || ''}
                      onChange={(e) => setForm(prev => ({ ...prev, clase: e.target.value }))}
                  >
                    <option value="">Selecciona clase</option>
                    {clasesFiltradas.map((numero) => (
                        <option key={numero} value={numero}>Clase {numero}</option>
                    ))}
                  </select>
                </div>

                <div className="grupo-campo" >
                  <label htmlFor="nota" className="label-campo">Nota</label>
                  <div className="campo-con-icono">
                    <input
                        id="nota"
                        type="number"
                        step="0.1" min="0" max="10"
                        className="campo-input"
                        value={form.nota || ''}
                        onChange={(e) => setForm(prev => ({
                          ...prev,
                          nota: e.target.value === '' ? '' : Number(e.target.value)
                        }))}
                    />
                  </div>

                </div>

                  <div className="acciones-form" >
                      <button type="submit" className="boton-principal">Guardar Nota</button>
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
                <span className="campo-horizontal"><strong>Nombre:</strong> {estudianteSeleccionado.nombre}</span>
                <span className="campo-horizontal"><strong>Teléfono:</strong> {estudianteSeleccionado.telefono}</span>
                <span className="campo-horizontal">Número de clases Pendientes: <strong>{clasesFiltradas.length}</strong></span>
              </div>
          )}

          <div className="lista-notas">
            {notas.length === 0 && <p style={{ color: '#7a8598', padding: '1rem' }}>No hay notas registradas.</p>}
            {notas
                .filter((n) => n.serieTitulo === nombreSerie)
                .map((n, i) => (
                    <div key={i} className="tarjeta-nota" style={{ borderLeft: `6px solid ${getNotaColor(n.valor)}` }}>
                      <h4>Clase {n.clase}</h4>
                      <p>Nota: <strong>{n.valor}</strong></p>
                      <p>{n.serieTitulo}</p>
                    </div>
                ))}
          </div>
        </div>
      </div>
  );
}
