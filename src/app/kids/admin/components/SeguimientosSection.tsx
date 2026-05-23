'use client'

import { useState, useEffect, useCallback } from 'react'

/* ── Types ─────────────────────────────────────────────────────────────── */
interface NinoSnap {
  id:       string
  nombre:   string
  apellido: string | null
  grupo:    string | null
  foto_url: string | null
}
interface AsistenciaRaw {
  id:             string
  nino_id:        string
  fecha:          string
  hora:           string
  metodo:         string
  registrado_por: string | null
  nino:           NinoSnap
}

/** Reporte de UN maestro/coordinador en UN día */
interface ClaseReport {
  maestro:  string          // nombre completo (3 palabras)
  ninos:    NinoSnap[]
  grupos:   string[]
  total:    number
  metodos:  string[]
}

/** Agrupación por día */
interface DiaResumen {
  fecha:      string
  label:      string        // "Lunes 19 de mayo de 2025"
  labelCorto: string        // "19 may."
  diaSemana:  string        // "Lunes"
  clases:     ClaseReport[] // un reporte por maestro/coordinador
  totalNinos: number
}

/* ── Helpers Colombia ───────────────────────────────────────────────────── */
function formatFechaLarga(fechaStr: string) {
  const d = new Date(fechaStr + 'T12:00:00')
  const opts = { timeZone: 'America/Bogota' } as const
  const label = new Intl.DateTimeFormat('es-CO', {
    weekday:'long', day:'numeric', month:'long', year:'numeric', ...opts,
  }).format(d)
  const labelCorto = new Intl.DateTimeFormat('es-CO', {
    day:'numeric', month:'short', ...opts,
  }).format(d)
  const diaSemana = new Intl.DateTimeFormat('es-CO', {
    weekday:'long', ...opts,
  }).format(d)
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return { label: cap(label), labelCorto: cap(labelCorto), diaSemana: cap(diaSemana) }
}

function getColombiaTodayDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'America/Bogota' }).format(new Date())
}

function shortName(raw: string) {
  return raw.trim().split(/\s+/).slice(0, 3).join(' ')
}

/* ── Colores ─────────────────────────────────────────────────────────────── */
const GRUPO_COLORS: Record<string, { bg:string; color:string; border:string }> = {
  'Semillitas':   { bg:'#fffbeb', color:'#d97706', border:'#fde68a' },
  'Exploradores': { bg:'#eff6ff', color:'#2563eb', border:'#bfdbfe' },
  'Junior':       { bg:'#faf5ff', color:'#7c3aed', border:'#ddd6fe' },
  'Constructores':{ bg:'#f0fdf4', color:'#16a34a', border:'#bbf7d0' },
  'Pequeños Luz': { bg:'#fdf2f8', color:'#db2777', border:'#fbcfe8' },
  'Promesas':     { bg:'#faf5ff', color:'#7c3aed', border:'#ddd6fe' },
}

const MAESTRO_GRADS = [
  ['#7c3aed','#6366f1'],
  ['#0d9488','#0891b2'],
  ['#f59e0b','#ef4444'],
  ['#ec4899','#8b5cf6'],
  ['#10b981','#0d9488'],
  ['#3b82f6','#8b5cf6'],
  ['#f43f5e','#f59e0b'],
]

const DAY_GRADS = [
  'linear-gradient(135deg,#3b82f6,#8b5cf6)',
  'linear-gradient(135deg,#10b981,#0891b2)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
  'linear-gradient(135deg,#0d9488,#3b82f6)',
  'linear-gradient(135deg,#7c3aed,#ec4899)',
  'linear-gradient(135deg,#059669,#0d9488)',
]

const NINO_GRADS = [
  'linear-gradient(135deg,#60a5fa,#818cf8)',
  'linear-gradient(135deg,#f472b6,#fb923c)',
  'linear-gradient(135deg,#34d399,#0891b2)',
  'linear-gradient(135deg,#a78bfa,#ec4899)',
  'linear-gradient(135deg,#fbbf24,#f87171)',
  'linear-gradient(135deg,#38bdf8,#818cf8)',
]

/* ════════════════════════════════════════════════════════════════════════
   SeguimientosSection
════════════════════════════════════════════════════════════════════════ */
/** Mapa nombre (3 palabras) → foto_url */
type FotoMap = Map<string, string | null>

export default function SeguimientosSection() {
  const [dias,        setDias]        = useState<DiaResumen[]>([])
  const [loading,     setLoading]     = useState(true)
  const [isMobile,    setIsMobile]    = useState(false)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [filterGrupo, setFilterGrupo] = useState('')
  const [filterMes,   setFilterMes]   = useState('')
  const [filterMaestro, setFilterMaestro] = useState('')
  const [fotoMap,     setFotoMap]     = useState<FotoMap>(new Map())

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/kids/asistencias?latest=500')
      const json = await res.json()
      if (!json.ok) return
      const raw: AsistenciaRaw[] = json.data ?? []

      /* Agrupar: fecha → maestro → niños */
      const diaMap  = new Map<string, Map<string, ClaseReport>>()

      for (const r of raw) {
        if (!r.nino) continue
        const maestro = r.registrado_por ? shortName(r.registrado_por) : 'Sin registrar'

        if (!diaMap.has(r.fecha)) diaMap.set(r.fecha, new Map())
        const maestroMap = diaMap.get(r.fecha)!

        if (!maestroMap.has(maestro)) {
          maestroMap.set(maestro, { maestro, ninos:[], grupos:[], total:0, metodos:[] })
        }
        const clase = maestroMap.get(maestro)!

        /* Niño único */
        if (!clase.ninos.find(n => n.id === r.nino.id)) {
          clase.ninos.push(r.nino)
          clase.total++
          if (r.nino.grupo && !clase.grupos.includes(r.nino.grupo))
            clase.grupos.push(r.nino.grupo)
        }
        /* Método único */
        const met = r.metodo?.includes('facial') ? 'facial' : 'manual'
        if (!clase.metodos.includes(met)) clase.metodos.push(met)
      }

      /* Construir array de DiaResumen */
      const result: DiaResumen[] = []
      for (const [fecha, maestroMap] of diaMap) {
        const { label, labelCorto, diaSemana } = formatFechaLarga(fecha)
        const clases = Array.from(maestroMap.values())
        result.push({
          fecha, label, labelCorto, diaSemana,
          clases,
          totalNinos: new Set(clases.flatMap(c => c.ninos.map(n => n.id))).size,
        })
      }

      result.sort((a, b) => b.fecha.localeCompare(a.fecha))
      setDias(result)
      if (result.length > 0 && !expandedDay) setExpandedDay(result[0].fecha)
    } catch { /* silently */ }
    setLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => { load() }, [load])

  /* Cargar fotos de coordinadores y maestros */
  useEffect(() => {
    async function loadFotos() {
      try {
        const [resC, resM] = await Promise.all([
          fetch('/api/kids/coordinadores'),
          fetch('/api/kids/maestros'),
        ])
        const [jsonC, jsonM] = await Promise.all([resC.json(), resM.json()])
        const map: FotoMap = new Map()
        const addPersonas = (arr: { nombre:string; apellido:string; foto_url:string|null }[]) => {
          for (const p of arr) {
            const key = shortName(`${p.nombre} ${p.apellido}`)
            map.set(key, p.foto_url ?? null)
          }
        }
        if (jsonC.ok) addPersonas(jsonC.data ?? [])
        if (jsonM.ok) addPersonas(jsonM.data ?? [])
        setFotoMap(map)
      } catch { /* silently */ }
    }
    loadFotos()
  }, [])

  const hoy = getColombiaTodayDate()

  /* Colecciones para filtros */
  const mesesSet    = new Set(dias.map(d => d.fecha.slice(0,7)))
  const meses       = Array.from(mesesSet).sort((a,b) => b.localeCompare(a))
  const maestrosSet = new Set(dias.flatMap(d => d.clases.map(c => c.maestro)))
  const maestros    = Array.from(maestrosSet).sort()
  const gruposSet   = new Set(dias.flatMap(d => d.clases.flatMap(c => c.grupos)))
  const grupos      = Array.from(gruposSet).sort()

  /* Filtrado */
  const diasFiltrados = dias
    .map(d => {
      if (filterMes && !d.fecha.startsWith(filterMes)) return null
      const clasesFilt = d.clases.filter(c => {
        if (filterGrupo  && !c.grupos.includes(filterGrupo)) return false
        if (filterMaestro && c.maestro !== filterMaestro)    return false
        return true
      })
      if (clasesFilt.length === 0) return null
      return { ...d, clases: clasesFilt }
    })
    .filter(Boolean) as DiaResumen[]

  const totalClases    = diasFiltrados.reduce((s,d) => s + d.clases.length, 0)
  const totalAsist     = diasFiltrados.reduce((s,d) => s + d.clases.reduce((ss,c) => ss+c.total,0), 0)
  const maestrosUnicos = new Set(diasFiltrados.flatMap(d => d.clases.map(c => c.maestro))).size

  return (
    <>
    <style>{`
      @keyframes segFadeIn    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
      @keyframes segSlideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
      @keyframes segPulse     { 0%,100%{opacity:1} 50%{opacity:.45} }
    `}</style>

    <div style={{
      flex:1, minHeight:0, display:'flex', flexDirection:'column',
      background:'linear-gradient(145deg,#f8f6ff 0%,#ede9fe 60%,#e0f2fe 100%)',
      overflow:'hidden',
    }}>

      {/* ══ HEADER ══ */}
      <div style={{
        padding: isMobile ? '18px 16px 0' : '24px 32px 0',
        flexShrink:0,
        background:'rgba(255,255,255,.65)',
        backdropFilter:'blur(24px)',
        borderBottom:'1px solid rgba(124,58,237,.08)',
      }}>
        {/* Título + stats */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:14, flexWrap:'wrap', paddingBottom:14 }}>
          <div>
            <div style={{
              fontSize:9, fontWeight:800, letterSpacing:'2.5px', textTransform:'uppercase',
              background:'linear-gradient(90deg,#7c3aed,#6366f1)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:4,
            }}>Panel Kids</div>
            <h1 style={{
              fontSize: isMobile ? 22 : 28, fontWeight:900, margin:0, lineHeight:1,
              letterSpacing:'-0.6px',
              background:'linear-gradient(135deg,#1e1b4b,#4c1d95,#1e40af)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            }}>Seguimientos</h1>
            <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>
              Reporte individual por maestro · zona horaria Colombia
            </div>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <StatChip grad="linear-gradient(135deg,#7c3aed,#6366f1)"
              icon={<CalIcon/>} value={diasFiltrados.length} label="Días" />
            <StatChip grad="linear-gradient(135deg,#ec4899,#8b5cf6)"
              icon={<MaestroIcon/>} value={maestrosUnicos} label="Maestros" />
            <StatChip grad="linear-gradient(135deg,#0d9488,#0891b2)"
              icon={<NinosIcon/>} value={totalAsist} label="Asistencias" />
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', paddingBottom:14 }}>
          <FilterSelect value={filterMes} onChange={setFilterMes} placeholder="Todos los meses">
            {meses.map(m => {
              const [y, mo] = m.split('-')
              const lbl = new Intl.DateTimeFormat('es-CO',{ month:'long', year:'numeric' })
                .format(new Date(parseInt(y), parseInt(mo)-1, 1))
              return <option key={m} value={m}>{lbl.charAt(0).toUpperCase()+lbl.slice(1)}</option>
            })}
          </FilterSelect>

          <FilterSelect value={filterMaestro} onChange={setFilterMaestro} placeholder="Todos los maestros">
            {maestros.map(m => <option key={m} value={m}>{m}</option>)}
          </FilterSelect>

          <FilterSelect value={filterGrupo} onChange={setFilterGrupo} placeholder="Todos los grupos">
            {grupos.map(g => <option key={g} value={g}>{g}</option>)}
          </FilterSelect>

          {(filterMes || filterMaestro || filterGrupo) && (
            <button onClick={() => { setFilterMes(''); setFilterMaestro(''); setFilterGrupo('') }}
              style={{
                padding:'7px 14px', borderRadius:50, border:'1.5px solid rgba(0,0,0,.08)',
                background:'rgba(255,255,255,.85)', fontSize:11, fontWeight:600,
                color:'#9ca3af', cursor:'pointer',
              }}>
              ✕ Limpiar
            </button>
          )}
          {(filterMes || filterMaestro || filterGrupo) && (
            <div style={{
              padding:'7px 14px', borderRadius:50,
              background:'rgba(124,58,237,.08)', border:'1px solid rgba(124,58,237,.2)',
              fontSize:11, fontWeight:700, color:'#7c3aed',
            }}>
              {totalClases} clase{totalClases!==1?'s':''}  ·  {totalAsist} asistencias
            </div>
          )}
        </div>
      </div>

      {/* ══ LISTA ══ */}
      <div style={{
        flex:1, minHeight:0, overflowY:'auto',
        padding: isMobile ? '16px 14px 40px' : '22px 30px 48px',
        display:'flex', flexDirection:'column', gap:20,
      }}>
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[...Array(3)].map((_,i) => (
              <div key={i} style={{
                height:120, borderRadius:22,
                background:`rgba(124,58,237,${0.07-i*0.01})`,
                animation:'segPulse 1.4s ease-in-out infinite',
                animationDelay:`${i*0.15}s`,
              }}/>
            ))}
          </div>
        ) : diasFiltrados.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 0' }}>
            <div style={{ fontSize:54, marginBottom:14 }}>📅</div>
            <div style={{ fontSize:15, fontWeight:800, color:'#374151' }}>Sin clases registradas</div>
            <div style={{ fontSize:12, color:'#9ca3af', marginTop:6 }}>
              {filterMes||filterMaestro||filterGrupo ? 'Prueba cambiando los filtros' : 'Registra asistencias para ver el historial aquí'}
            </div>
          </div>
        ) : (
          diasFiltrados.map((dia, idx) => (
            <DiaBlock
              key={dia.fecha}
              dia={dia}
              idx={idx}
              isHoy={dia.fecha === hoy}
              isExpanded={expandedDay === dia.fecha}
              onToggle={() => setExpandedDay(p => p === dia.fecha ? null : dia.fecha)}
              isMobile={isMobile}
              fotoMap={fotoMap}
            />
          ))
        )}
      </div>
    </div>
    </>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   DiaBlock — separador de día + tarjetas de maestros
════════════════════════════════════════════════════════════════════════ */
function DiaBlock({ dia, idx, isHoy, isExpanded, onToggle, isMobile, fotoMap }: {
  dia:DiaResumen; idx:number; isHoy:boolean
  isExpanded:boolean; onToggle:()=>void; isMobile:boolean; fotoMap:FotoMap
}) {
  const grad = DAY_GRADS[idx % DAY_GRADS.length]

  return (
    <div style={{ animation:`segFadeIn .38s ${Math.min(idx,5)*0.07}s both` }}>

      {/* ── Cabecera del día ── */}
      <div
        onClick={onToggle}
        style={{
          display:'flex', alignItems:'center', gap:14,
          marginBottom: isExpanded ? 14 : 0,
          cursor:'pointer', userSelect:'none',
          padding:'14px 18px',
          borderRadius: isExpanded ? '20px 20px 0 0' : 20,
          background:'rgba(255,255,255,.90)',
          backdropFilter:'blur(20px)',
          border:'1.5px solid rgba(255,255,255,.9)',
          boxShadow: isHoy
            ? '0 6px 24px rgba(124,58,237,.16), inset 0 1px 0 #fff'
            : '0 3px 14px rgba(0,0,0,.07), inset 0 1px 0 #fff',
          borderBottom: isExpanded ? '1px solid rgba(0,0,0,.06)' : undefined,
          transition:'border-radius .25s',
        }}
      >
        {/* Bloque fecha */}
        <div style={{
          width:isMobile?48:54, height:isMobile?48:54, borderRadius:16, flexShrink:0,
          background:grad,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          boxShadow:'0 4px 14px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.25)',
          position:'relative',
        }}>
          {isHoy && (
            <div style={{
              position:'absolute', top:-4, right:-4, width:13, height:13,
              borderRadius:'50%', background:'#f43f5e', border:'2px solid #fff',
              boxShadow:'0 2px 6px rgba(244,63,94,.5)',
            }}/>
          )}
          <span style={{ fontSize:isMobile?17:19, fontWeight:900, color:'#fff', lineHeight:1 }}>
            {dia.labelCorto.split(' ')[0]}
          </span>
          <span style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,.8)', textTransform:'uppercase', letterSpacing:'0.4px' }}>
            {dia.labelCorto.split(' ').slice(1).join(' ')}
          </span>
        </div>

        {/* Texto */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
            <span style={{ fontSize:isMobile?13:15, fontWeight:800, color:'#0f172a' }}>{dia.diaSemana}</span>
            {isHoy && (
              <span style={{
                fontSize:8, fontWeight:800, padding:'2px 8px', borderRadius:50,
                background:'linear-gradient(135deg,#f43f5e,#e11d48)', color:'#fff', letterSpacing:'0.5px',
              }}>HOY</span>
            )}
          </div>
          <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>
            {dia.label.split(',').slice(1).join(',').trim()}
          </div>
          {/* Mini-avatares maestros */}
          {!isMobile && (
            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:5, flexWrap:'wrap' }}>
              {dia.clases.map((c,i) => {
                const [a,b] = MAESTRO_GRADS[i % MAESTRO_GRADS.length]
                return (
                  <div key={c.maestro} style={{
                    display:'flex', alignItems:'center', gap:4,
                    padding:'2px 9px 2px 4px', borderRadius:50,
                    background:`linear-gradient(135deg,${a}18,${b}10)`,
                    border:`1px solid ${a}33`,
                  }}>
                    <div style={{
                      width:16, height:16, borderRadius:'50%', flexShrink:0,
                      background:`linear-gradient(135deg,${a},${b})`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:7, fontWeight:800, color:'#fff',
                    }}>
                      {c.maestro.charAt(0)}
                    </div>
                    <span style={{ fontSize:9, fontWeight:700, color:a, whiteSpace:'nowrap' }}>{c.maestro}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Derecha: stats + chevron */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
          <div style={{
            display:'flex', alignItems:'center', gap:5,
            background:'rgba(13,148,136,.08)', border:'1px solid rgba(13,148,136,.18)',
            borderRadius:10, padding:'4px 10px',
          }}>
            <span style={{ fontSize:13, fontWeight:900, color:'#0d9488' }}>{dia.totalNinos}</span>
            <span style={{ fontSize:9, fontWeight:600, color:'#6b7280' }}>niños</span>
          </div>
          <div style={{
            display:'flex', alignItems:'center', gap:5,
            background:'rgba(124,58,237,.07)', border:'1px solid rgba(124,58,237,.15)',
            borderRadius:10, padding:'3px 9px',
          }}>
            <span style={{ fontSize:11, fontWeight:800, color:'#7c3aed' }}>{dia.clases.length}</span>
            <span style={{ fontSize:9, fontWeight:600, color:'#9ca3af' }}>
              {dia.clases.length === 1 ? 'maestro' : 'maestros'}
            </span>
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"
            style={{ transform:isExpanded?'rotate(180deg)':'none', transition:'transform .25s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* ── Tarjetas de maestros (expandido) ── */}
      {isExpanded && (
        <div style={{
          background:'rgba(255,255,255,.55)',
          backdropFilter:'blur(16px)',
          border:'1.5px solid rgba(255,255,255,.9)',
          borderTop:'none',
          borderRadius:'0 0 20px 20px',
          boxShadow:'0 8px 28px rgba(0,0,0,.08)',
          padding: isMobile ? '14px 12px 18px' : '16px 18px 20px',
          display:'flex', flexDirection:'column', gap:14,
          animation:'segSlideDown .26s ease both',
        }}>
          {dia.clases.map((clase, ci) => (
            <MaestroCard
              key={clase.maestro}
              clase={clase}
              colorIdx={ci}
              isMobile={isMobile}
              fotoUrl={fotoMap.get(clase.maestro) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   MaestroCard — reporte individual de UN maestro
════════════════════════════════════════════════════════════════════════ */
function MaestroCard({ clase, colorIdx, isMobile, fotoUrl }: {
  clase:ClaseReport; colorIdx:number; isMobile:boolean; fotoUrl:string|null
}) {
  const [a, b] = MAESTRO_GRADS[colorIdx % MAESTRO_GRADS.length]
  const [fotoBroken, setFotoBroken] = useState(false)
  const showFoto = fotoUrl && !fotoBroken

  return (
    <div style={{
      borderRadius:18,
      background:'rgba(255,255,255,.92)',
      border:`1.5px solid ${a}22`,
      boxShadow:`0 3px 16px ${a}14, 0 1px 4px rgba(0,0,0,.05), inset 0 1px 0 rgba(255,255,255,1)`,
      overflow:'hidden',
    }}>

      {/* Banda de color superior */}
      <div style={{ height:4, background:`linear-gradient(90deg,${a},${b},${a}66)` }}/>

      <div style={{ padding: isMobile ? '14px 14px 16px' : '16px 20px 18px' }}>

        {/* ── Header maestro ── */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
          {/* Avatar maestro — foto o iniciales con aro premium */}
          <div style={{
            flexShrink:0, position:'relative',
            /* Aro exterior degradado */
            padding:2.5,
            borderRadius:18,
            background:`linear-gradient(135deg,${a},${b},${a}88)`,
            boxShadow:`0 6px 20px ${a}55, 0 2px 6px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.4)`,
          }}>
            {/* Separador blanco */}
            <div style={{
              padding:2, borderRadius:15,
              background:'rgba(255,255,255,.95)',
            }}>
              <div style={{
                width:50, height:50, borderRadius:13,
                background: showFoto ? 'transparent' : `linear-gradient(135deg,${a},${b})`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:17, fontWeight:900, color:'#fff',
                overflow:'hidden',
                letterSpacing:'-0.5px',
                boxShadow: showFoto ? 'none' : `inset 0 2px 8px rgba(0,0,0,.18), inset 0 -1px 0 rgba(255,255,255,.15)`,
              }}>
                {showFoto
                  ? <img
                      src={fotoUrl!}
                      alt={clase.maestro}
                      style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:13 }}
                      onError={() => setFotoBroken(true)}
                    />
                  : clase.maestro.split(' ').slice(0,2).map(p=>p.charAt(0)).join('')
                }
              </div>
            </div>
            {/* Punto verde "activo" */}
            <div style={{
              position:'absolute', bottom:2, right:2,
              width:11, height:11, borderRadius:'50%',
              background:'linear-gradient(135deg,#22c55e,#16a34a)',
              border:'2px solid #fff',
              boxShadow:'0 1px 4px rgba(34,197,94,.5)',
            }}/>
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#0f172a' }}>{clase.maestro}</div>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3, flexWrap:'wrap' }}>
              {/* Grupos */}
              {clase.grupos.map(g => {
                const gc = GRUPO_COLORS[g] ?? { bg:'#f3f4f6', color:'#6b7280', border:'#e5e7eb' }
                return (
                  <span key={g} style={{
                    fontSize:8, fontWeight:800, padding:'1px 7px', borderRadius:50,
                    background:gc.bg, border:`1px solid ${gc.border}`, color:gc.color,
                  }}>{g}</span>
                )
              })}
            </div>
          </div>

          {/* Counter */}
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center',
            background:`linear-gradient(135deg,${a}14,${b}0a)`,
            border:`1.5px solid ${a}28`,
            borderRadius:12, padding:'6px 12px', flexShrink:0,
          }}>
            <span style={{ fontSize:20, fontWeight:900, color:a, lineHeight:1 }}>{clase.total}</span>
            <span style={{ fontSize:8, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px', marginTop:2 }}>
              {clase.total===1?'niño':'niños'}
            </span>
          </div>
        </div>

        {/* Divisor */}
        <div style={{
          height:1,
          background:`linear-gradient(90deg,${a}30,${b}20,transparent)`,
          marginBottom:14,
        }}/>

        {/* ── Grid de niños ── */}
        <div style={{ display:'flex', flexWrap:'wrap', gap: isMobile ? 10 : 12 }}>
          {clase.ninos.map((nino, ni) => (
            <NinoAvatar key={nino.id} nino={nino} idx={ni} accentColor={a} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── NinoAvatar ─────────────────────────────────────────────────────────── */
function NinoAvatar({ nino, idx, accentColor }: { nino:NinoSnap; idx:number; accentColor:string }) {
  const [broken, setBroken] = useState(false)
  const ini  = `${nino.nombre.charAt(0)}${(nino.apellido ?? 'X').charAt(0)}`.toUpperCase()
  const grad = NINO_GRADS[idx % NINO_GRADS.length]
  const gc   = nino.grupo ? (GRUPO_COLORS[nino.grupo] ?? null) : null

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, width:58 }}>
      {/* Aro + foto */}
      <div style={{
        padding:2.5, borderRadius:'50%', background:grad,
        boxShadow:`0 3px 10px rgba(0,0,0,.12)`,
      }}>
        <div style={{ padding:2, borderRadius:'50%', background:'#fff' }}>
          <div style={{
            width:44, height:44, borderRadius:'50%', overflow:'hidden',
            background:grad, display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:13, fontWeight:800, color:'#fff',
          }}>
            {nino.foto_url && !broken
              ? <img src={nino.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                  onError={() => setBroken(true)}/>
              : ini
            }
          </div>
        </div>
      </div>
      {/* Nombre */}
      <div style={{
        fontSize:8.5, fontWeight:700, color:'#374151', textAlign:'center',
        lineHeight:1.3, width:'100%',
        overflow:'hidden', display:'-webkit-box',
        WebkitLineClamp:2, WebkitBoxOrient:'vertical',
      } as React.CSSProperties}>
        {nino.nombre}{nino.apellido ? ` ${nino.apellido.split(' ')[0]}` : ''}
      </div>
      {gc && (
        <div style={{
          fontSize:7, fontWeight:800, padding:'1px 5px', borderRadius:50,
          background:gc.bg, border:`1px solid ${gc.border}`, color:gc.color,
          whiteSpace:'nowrap', marginTop:-2,
        }}>{nino.grupo}</div>
      )}
    </div>
  )
}

/* ── Helpers UI ─────────────────────────────────────────────────────────── */
function StatChip({ grad, icon, value, label }: { grad:string; icon:React.ReactNode; value:number; label:string }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8,
      background:'rgba(255,255,255,.88)', border:'1px solid rgba(124,58,237,.1)',
      borderRadius:14, padding:'8px 14px',
      boxShadow:'0 2px 10px rgba(0,0,0,.06)',
    }}>
      <div style={{
        width:28, height:28, borderRadius:9, flexShrink:0, background:grad,
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 2px 8px rgba(0,0,0,.18)',
      }}>{icon}</div>
      <div>
        <div style={{ fontSize:16, fontWeight:900, color:'#0f172a', lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.7px' }}>{label}</div>
      </div>
    </div>
  )
}

function FilterSelect({ value, onChange, placeholder, children }: {
  value:string; onChange:(v:string)=>void; placeholder:string; children:React.ReactNode
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      padding:'7px 12px', borderRadius:50,
      border:`1.5px solid ${value ? 'rgba(124,58,237,.4)' : 'rgba(124,58,237,.15)'}`,
      background: value ? 'rgba(124,58,237,.06)' : 'rgba(255,255,255,.9)',
      fontSize:11, fontWeight:600, color: value ? '#7c3aed' : '#374151',
      outline:'none', cursor:'pointer', backdropFilter:'blur(8px)',
      boxShadow:'0 1px 4px rgba(0,0,0,.05)',
    }}>
      <option value="">{placeholder}</option>
      {children}
    </select>
  )
}

/* ── SVG icons ── */
const CalIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const MaestroIcon= () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const NinosIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
