import React, { useState } from "react";
import { User, Phone, IdCard } from "lucide-react";
import './registro-estudiante.css';

export default function RegistroEstudiante() {
  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    cedula: '',
    pais: '',
    ciudad: '',
    direccion: '',
    congregacion: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/estudiantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("✅ Estudiante guardado correctamente");

      // Resetear formulario
      setForm({
        nombre: '',
        telefono: '',
        cedula: '',
        pais: '',
        ciudad: '',
        direccion: '',
        congregacion: ''
      });
    } catch (error: any) {
      alert("❌ Error al guardar estudiante: " + error.message);
    }
  };

  return (
      <form className="registro-formulario" onSubmit={handleSubmit}>
        <img
            src="/images/logo-n2ncu.png"
            alt="Logo N2NCU"
            className="registro-logo"
        />

        {/* NOMBRE + TELÉFONO */}
        <div className="registro-fila-doble">
          <div className="registro-grupo-campo">
            <label htmlFor="nombre"></label>
            <div className="registro-campo-con-icono">
              <User className="registro-icono-campo" />
              <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  placeholder="Nombre completo"
                  className="registro-campo-input"
                  required
                  value={form.nombre}
                  onChange={handleChange}
              />
            </div>
          </div>

          <div className="registro-grupo-campo">
            <label htmlFor="telefono"></label>
            <div className="registro-campo-con-icono">
              <Phone className="registro-icono-campo" />
              <input
                  type="text"
                  id="telefono"
                  name="telefono"
                  placeholder="Teléfono"
                  className="registro-campo-input"
                  required
                  value={form.telefono}
                  onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* CÉDULA + PAÍS */}
        <div className="registro-fila-doble">
          <div className="registro-grupo-campo">
            <label htmlFor="cedula"></label>
            <div className="registro-campo-con-icono">
              <IdCard className="registro-icono-campo" />
              <input
                  type="text"
                  id="cedula"
                  name="cedula"
                  placeholder="Cédula"
                  className="registro-campo-input"
                  required
                  value={form.cedula}
                  onChange={handleChange}
              />
            </div>
          </div>

          <div className="registro-grupo-campo">
            <label htmlFor="pais"></label>
            <div className="registro-campo-con-icono">
              <input
                  type="text"
                  id="pais"
                  name="pais"
                  placeholder="País"
                  className="registro-campo-input"
                  required
                  value={form.pais}
                  onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* CIUDAD + DIRECCIÓN */}
        <div className="registro-fila-doble">
          <div className="registro-grupo-campo">
            <label htmlFor="ciudad"></label>
            <div className="registro-campo-con-icono">
              <input
                  type="text"
                  id="ciudad"
                  name="ciudad"
                  placeholder="Ciudad"
                  className="registro-campo-input"
                  required
                  value={form.ciudad}
                  onChange={handleChange}
              />
            </div>
          </div>

          <div className="registro-grupo-campo">
            <label htmlFor="direccion"></label>
            <div className="registro-campo-con-icono">
              <input
                  type="text"
                  id="direccion"
                  name="direccion"
                  placeholder="Dirección"
                  className="registro-campo-input"
                  required
                  value={form.direccion}
                  onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* CONGREGACIÓN */}
        <div className="registro-fila-doble">
          <div className="registro-grupo-campo" style={{ flex: '1 1 100%' }}>
            <label htmlFor="congregacion"></label>
            <div className="registro-campo-con-icono">
              <input
                  type="text"
                  id="congregacion"
                  name="congregacion"
                  placeholder="Congregación"
                  className="registro-campo-input"
                  required
                  value={form.congregacion}
                  onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* BOTONES */}
        <div className="registro-fila-doble">
          <div className="registro-grupo-campo">
            <button type="submit" className="registro-btn-guardar">
              Guardar Estudiante
            </button>
          </div>
          <div className="registro-grupo-campo">
            <button
                type="button"
                className="registro-btn-salir"
                onClick={() => window.location.href = "/"}
            >
              Salir
            </button>
          </div>
        </div>
      </form>
  );
}
