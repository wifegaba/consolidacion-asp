'use client';

import React, { useState } from 'react';
import './registro-estudiante.css';
import {
  User,
  Phone,
  IdCard,
  Globe2,
  MapPin,
  Home,
  Church,
} from 'lucide-react';
import { useToast } from '@/components/ToastProvider';

type FormData = {
  nombre: string;
  telefono: string;
  cedula: string;
  pais: string;
  ciudad: string;
  direccion: string;
  congregacion: string;
};

export default function RegistroEstudiante() {
  const toast = useToast();

  const [form, setForm] = useState<FormData>({
    nombre: '',
    telefono: '',
    cedula: '',
    pais: '',
    ciudad: '',
    direccion: '',
    congregacion: '',
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    // Validación simple
    const faltantes = Object.entries(form).filter(([, v]) => String(v).trim() === '');
    if (faltantes.length) {
      const text = 'Completa todos los campos.';
      setMsg({ type: 'err', text });
      toast.error(text);
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch('/api/estudiantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error al registrar.');

      setMsg({ type: 'ok', text: '✅ Estudiante registrado correctamente.' });
      toast.success('Estudiante registrado correctamente ✅');

      setForm({
        nombre: '',
        telefono: '',
        cedula: '',
        pais: '',
        ciudad: '',
        direccion: '',
        congregacion: '',
      });
    } catch (err: any) {
      const text = `❌ ${err.message || 'Error al registrar.'}`;
      setMsg({ type: 'err', text });
      toast.error(err.message || 'No se pudo registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
      <form className="registro-formulario" onSubmit={handleSubmit}>



        {/* Header premium */}
        <div className="registro-header">
          <div className="registro-header__title">Crear Estudiante</div>
          <div className="registro-header__sub">Datos básicos del perfil</div>
        </div>



        {/* Fila 1 */}
        <div className="registro-fila-doble">
          <div className="registro-grupo-campo">
            <label className="registro-label" htmlFor="nombre">Nombre</label>
            <div className="registro-campo-con-icono">
              <User aria-hidden className="registro-icono-svg" />
              <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  placeholder="Nombre completo"
                  className="registro-campo-input"
                  value={form.nombre}
                  onChange={handleChange}
                  autoComplete="off"
              />
            </div>
          </div>

          <div className="registro-grupo-campo">
            <label className="registro-label" htmlFor="telefono">Teléfono</label>
            <div className="registro-campo-con-icono">
              <Phone aria-hidden className="registro-icono-svg" />
              <input
                  id="telefono"
                  name="telefono"
                  type="text"
                  placeholder="Número de teléfono"
                  className="registro-campo-input"
                  value={form.telefono}
                  onChange={handleChange}
                  autoComplete="off"
              />
            </div>
          </div>
        </div>

        {/* Fila 2 */}
        <div className="registro-fila-doble">
          <div className="registro-grupo-campo">
            <label className="registro-label" htmlFor="cedula">Cédula</label>
            <div className="registro-campo-con-icono">
              <IdCard aria-hidden className="registro-icono-svg" />
              <input
                  id="cedula"
                  name="cedula"
                  type="text"
                  placeholder="Cédula"
                  className="registro-campo-input"
                  value={form.cedula}
                  onChange={handleChange}
                  autoComplete="off"
              />
            </div>
          </div>

          <div className="registro-grupo-campo">
            <label className="registro-label" htmlFor="pais">País</label>
            <div className="registro-campo-con-icono">
              <Globe2 aria-hidden className="registro-icono-svg" />
              <input
                  id="pais"
                  name="pais"
                  type="text"
                  placeholder="País"
                  className="registro-campo-input"
                  value={form.pais}
                  onChange={handleChange}
                  autoComplete="off"
              />
            </div>
          </div>
        </div>

        {/* Fila 3 */}
        <div className="registro-fila-doble">
          <div className="registro-grupo-campo">
            <label className="registro-label" htmlFor="ciudad">Ciudad</label>
            <div className="registro-campo-con-icono">
              <MapPin aria-hidden className="registro-icono-svg" />
              <input
                  id="ciudad"
                  name="ciudad"
                  type="text"
                  placeholder="Ciudad"
                  className="registro-campo-input"
                  value={form.ciudad}
                  onChange={handleChange}
                  autoComplete="off"
              />
            </div>
          </div>

          <div className="registro-grupo-campo">
            <label className="registro-label" htmlFor="direccion">Dirección</label>
            <div className="registro-campo-con-icono">
              <Home aria-hidden className="registro-icono-svg" />
              <input
                  id="direccion"
                  name="direccion"
                  type="text"
                  placeholder="Dirección"
                  className="registro-campo-input"
                  value={form.direccion}
                  onChange={handleChange}
                  autoComplete="off"
              />
            </div>
          </div>
        </div>

        {/* Fila 4 */}
        <div className="registro-fila-doble">
          <div className="registro-grupo-campo" style={{ flex: '1 1 100%' }}>
            <label className="registro-label" htmlFor="congregacion">Congregación</label>
            <div className="registro-campo-con-icono">
              <Church aria-hidden className="registro-icono-svg" />
              <input
                  id="congregacion"
                  name="congregacion"
                  type="text"
                  placeholder="Nombre de la congregación"
                  className="registro-campo-input"
                  value={form.congregacion}
                  onChange={handleChange}
                  autoComplete="off"
              />
            </div>
          </div>
        </div>

        <div className="registro-acciones">
          <button className="registro-btn-guardar" type="submit" disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
          <button className="registro-btn-salir" type="button" onClick={() => history.back()}>
            Salir
          </button>
        </div>
      </form>
  );
}
