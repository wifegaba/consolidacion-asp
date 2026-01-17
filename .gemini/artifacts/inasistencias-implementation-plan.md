# Plan de Implementación: Sistema de Inasistencias Premium

## Objetivo
Implementar un sistema completo de gestión de inasistencias con indicadores visuales en tiempo real y modal de recuperación de clases.

## Fase 1: Base de Datos (SQL)

### 1.1 Tabla de Inasistencias Pendientes
```sql
-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS public.inasistencias_pendientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inscripcion_id UUID NOT NULL REFERENCES public.inscripciones(id) ON DELETE CASCADE,
    curso_id INTEGER NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
    clase_numero INTEGER NOT NULL,
    fecha_inasistencia TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    nivelado BOOLEAN DEFAULT FALSE,
    nivelado_por UUID REFERENCES public.servidores(id),
    fecha_nivelado TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(inscripcion_id, curso_id, clase_numero)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_inasistencias_inscripcion 
    ON public.inasistencias_pendientes(inscripcion_id);
    
CREATE INDEX IF NOT EXISTS idx_inasistencias_curso 
    ON public.inasistencias_pendientes(curso_id);
    
CREATE INDEX IF NOT EXISTS idx_inasistencias_nivelado 
    ON public.inasistencias_pendientes(nivelado) WHERE nivelado = FALSE;

-- Habilitar RLS
ALTER TABLE public.inasistencias_pendientes ENABLE ROW LEVEL SECURITY;

-- Política: Gestores PTDM pueden ver y modificar
CREATE POLICY "Gestores PTDM acceso completo inasistencias"
    ON public.inasistencias_pendientes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.servidores_roles sr
            WHERE sr.servidor_id = auth.uid()
            AND sr.rol = 'Gestor PTDM'
            AND sr.activo = TRUE
        )
    );
```

### 1.2 Función: Registrar Inasistencia
```sql
CREATE OR REPLACE FUNCTION public.fn_registrar_inasistencia(
    p_inscripcion_id UUID,
    p_curso_id INTEGER,
    p_clase_numero INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insertar inasistencia (ignora si ya existe por UNIQUE constraint)
    INSERT INTO public.inasistencias_pendientes (
        inscripcion_id,
        curso_id,
        clase_numero,
        nivelado
    )
    VALUES (
        p_inscripcion_id,
        p_curso_id,
        p_clase_numero,
        FALSE
    )
    ON CONFLICT (inscripcion_id, curso_id, clase_numero) 
    DO UPDATE SET
        nivelado = FALSE,
        nivelado_por = NULL,
        fecha_nivelado = NULL,
        updated_at = NOW();
END;
$$;
```

### 1.3 Función: Nivelar Inasistencia
```sql
CREATE OR REPLACE FUNCTION public.fn_nivelar_inasistencia(
    p_inscripcion_id UUID,
    p_curso_id INTEGER,
    p_clase_numero INTEGER,
    p_nivelado_por UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.inasistencias_pendientes
    SET 
        nivelado = TRUE,
        nivelado_por = p_nivelado_por,
        fecha_nivelado = NOW(),
        updated_at = NOW()
    WHERE 
        inscripcion_id = p_inscripcion_id
        AND curso_id = p_curso_id
        AND clase_numero = p_clase_numero;
END;
$$;
```

### 1.4 Función: Obtener Clases Perdidas por Estudiante
```sql
CREATE OR REPLACE FUNCTION public.fn_obtener_clases_perdidas(
    p_inscripcion_id UUID
)
RETURNS TABLE (
    clase_numero INTEGER,
    fecha_inasistencia TIMESTAMP WITH TIME ZONE,
    nivelado BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ip.clase_numero,
        ip.fecha_inasistencia,
        ip.nivelado
    FROM public.inasistencias_pendientes ip
    WHERE ip.inscripcion_id = p_inscripcion_id
        AND ip.nivelado = FALSE
    ORDER BY ip.clase_numero ASC;
END;
$$;
```

## Fase 2: Frontend - Modificaciones al Sidebar

### 2.1 Tipo de Datos Extendido
```typescript
type EstudianteInscrito = Entrevista & {
  inscripcion_id: string;
  estado_inscripcion: string;
  progress?: number;
  missedClasses?: number[]; // [1, 3, 5] - números de clase
  missedCount?: number; // Total de inasistencias
};
```

### 2.2 Cargar Inasistencias desde BD
Al cargar estudiantes, también consultar `inasistencias_pendientes`:
```typescript
const inasistenciasResult = await supabase
  .from('inasistencias_pendientes')
  .select('inscripcion_id, clase_numero')
  .in('inscripcion_id', inscripcionIds)
  .eq('nivelado', false);
```

### 2.3 Componente StudentSidebarItem - Cambios Visuales

**Elementos a agregar:**
1. **Barra roja de inasistencias** debajo de la barra de progreso verde
2. **Contador de inasistencias** al lado de la barra roja
3. **Botón "Recuperar" compacto** debajo de los iconos de llamada/WhatsApp

**Diseño:**
```
┌─────────────────────────────────────┐
│ [Avatar] Nombre Estudiante          │
│          ▓▓▓▓▓▓▓░░░░ 60%   [📞][💬]│
│          ▓▓░░░░░░░░ 2❌    [🔄]     │
└─────────────────────────────────────┘
```

### 2.4 Modal de Recuperación Premium

**Características:**
- Backdrop blur con gradiente
- Grid de botones por clase perdida
- Animaciones Framer Motion
- Confirmación visual al seleccionar

**Estructura:**
```tsx
<AnimatePresence>
  {showRecoveryModal && (
    <RecoveryModal
      studentName="Nombre del Estudiante"
      missedClasses={[1, 3, 5, 8]}
      onSelectClass={(claseNum) => handleRecuperarClase(claseNum)}
      onClose={() => setShowRecoveryModal(false)}
    />
  )}
</AnimatePresence>
```

## Fase 3: Flujo de Datos en Tiempo Real

### 3.1 Al marcar asistencia "NO" (X)
1. Actualizar `asistencias_academia` → valor = 'no'
2. Llamar a `fn_registrar_inasistencia(inscripcion_id, curso_id, clase_numero)`
3. Actualizar estado local: agregar clase al array `missedClasses`
4. Re-renderizar barra roja con nuevo contador

### 3.2 Al marcar asistencia "SÍ" (✓) sobre una clase marcada como "NO"
1. Actualizar `asistencias_academia` → valor = 'si'
2. Llamar a `fn_nivelar_inasistencia(inscripcion_id, curso_id, clase_numero, servidor_id)`
3. Actualizar estado local: remover clase del array `missedClasses`
4. Re-renderizar barras (verde sube, roja baja)

### 3.3 Al usar botón "Recuperar Clase"
1. Abrir modal con clases perdidas
2. Al seleccionar una clase:
   - Llamar a `fn_nivelar_inasistencia(...)`
   - Actualizar `asistencias_academia` para esa clase → 'si'
   - Actualizar estado local
   - Mostrar toast de confirmación

## Fase 4: Estilos Premium

### 4.1 Barra Roja de Inasistencias
```tsx
<div className="flex-1 h-2 bg-red-900/20 rounded-full overflow-hidden">
  <motion.div
    animate={{ width: `${(missedCount / 12) * 100}%` }}
    className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-red-600 
               shadow-[0_0_12px_rgba(239,68,68,0.6)]"
  />
</div>
<span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
  {missedCount}❌
</span>
```

### 4.2 Botón "Recuperar"
```tsx
<button
  className="w-full mt-2 px-2 py-1.5 rounded-lg text-[10px] font-semibold
             bg-gradient-to-r from-amber-500/20 to-orange-500/20 
             border border-amber-500/30 text-amber-200
             hover:from-amber-500/30 hover:to-orange-500/30
             active:scale-95 transition-all
             shadow-[0_0_10px_rgba(245,158,11,0.3)]"
>
  🔄 Recuperar
</button>
```

## Cronograma

1. ✅ **SQL Database Setup** - Ejecutar scripts SQL
2. ⏳ **Backend Integration** - Modificar loadStudents y handleGradeChange
3. ⏳ **UI Components** - Agregar barras, contador y botón
4. ⏳ **Modal Premium** - Crear componente RecoveryModal
5. ⏳ **Testing** - Validar flujo completo

## Notas Técnicas

- Usar `useMemo` para calcular `missedCount` dinámicamente
- Implementar animaciones con `framer-motion`
- Mantener sincronización bidireccional: BD ↔ Estado Local
- Optimizar con debounce en actualizaciones masivas
