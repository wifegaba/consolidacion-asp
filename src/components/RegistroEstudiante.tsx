import React, { useState } from "react";
import { User, Phone, IdCard } from "lucide-react";
import './registro-estudiante.css';

export default function RegistroEstudiante() {
  const [form, setForm] = useState({ nombre: '', telefono: '', cedula: '' });

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
      setForm({ nombre: '', telefono: '', cedula: '' });
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


    </form>
  );
}
