'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LiquidGlassSweepTransition } from '@kids/liquid-glass-ui'

const EASE_SMOOTH = [0.16, 1, 0.3, 1] as const
const EASE_EXIT = [0.7, 0, 0.84, 0] as const

const LEFT_PANEL_VARIANTS = {
  initial: { opacity: 0, x: 160, scale: 0.96 },
  animate: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.6, ease: EASE_SMOOTH } },
  exit: { opacity: 0, x: -110, scale: 0.97, transition: { duration: 0.45, ease: EASE_EXIT } },
}

const DETAIL_PANEL_VARIANTS = {
  initial: { opacity: 0, y: 48, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: EASE_SMOOTH } },
  exit: { opacity: 0, y: -32, scale: 0.97, transition: { duration: 0.22, ease: EASE_EXIT } },
}

const LIST_WRAPPER_VARIANTS = {
  initial: { transition: { staggerChildren: 0.035, staggerDirection: -1 } },
  animate: { transition: { staggerChildren: 0.055 } },
}

const LIST_ITEM_VARIANTS = {
  initial: { opacity: 0, x: 28, y: 14, scale: 0.97 },
  animate: { opacity: 1, x: 0, y: 0, scale: 1, transition: { duration: 0.5, ease: EASE_SMOOTH } },
}

type Coordinator = {
  id: string
  nombre: string
  apellido: string
  foto_url: string | null
  grupo_asignado: string | null
}

type Timoteo = {
  id: string
  nombre: string
  apellido: string
  telefono: string | null
  foto_url: string | null
  roles: string[]
  grupo_asignado: string | null
  grupo_timoteos_asignado: string | null
  grupo?: string | null
  activo: boolean
}

type Observation = {
  id: string
  maestro_id: string
  titulo: string
  descripcion: string | null
  fecha: string
  creado_en: string
}

const CALL_LOG_TITLE = 'Llamada realizada'

function hasTimoteosRole(member: Timoteo) {
  return member.activo !== false && member.roles?.some(role =>
    role.replace(/_/g, ' ').trim().toUpperCase() === 'TIMOTEOS',
  )
}

function groupOf(member: Timoteo) {
  return member.grupo_timoteos_asignado ?? member.grupo_asignado ?? member.grupo ?? 'Sin grupo'
}

function nameOf(member: Timoteo) {
  return `${member.nombre} ${member.apellido}`.trim()
}

function initialsOf(member: Timoteo) {
  return nameOf(member).split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'T'
}

function whatsappNumber(phone: string | null) {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('57')) return digits
  return `57${digits.replace(/^0+/, '')}`
}

export default function TimoteosCoordinatorClient({ coordinator, onBack }: { coordinator: Coordinator; onBack: () => void }) {
  const [members, setMembers] = useState<Timoteo[]>([])
  const [assignedGroup, setAssignedGroup] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [observations, setObservations] = useState<Observation[]>([])
  const [callCounts, setCallCounts] = useState<Record<string, number>>({})
  const [loadingObservations, setLoadingObservations] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    fetch('/api/kids/servidores', { credentials: 'include' })
      .then(response => response.json())
      .then(json => {
        if (!active || !json.ok) return
        const allServers = (json.data ?? []) as Timoteo[]
        const coordinatorRecord = allServers.find(server => server.id === coordinator.id)
        const coordinatorGroup = coordinatorRecord?.grupo_timoteos_asignado?.trim() || null
        const nextMembers = allServers
          .filter(hasTimoteosRole)
          .filter(member => !coordinatorGroup || groupOf(member) === coordinatorGroup)
        setAssignedGroup(coordinatorGroup)
        setMembers(nextMembers)
        setSelectedId(current => current && nextMembers.some(member => member.id === current) ? current : null)
        void fetch('/api/kids/observaciones', { credentials: 'include' })
          .then(response => response.json())
          .then(observationsJson => {
            if (!active || !observationsJson.ok) return
            const counts = (observationsJson.data as Observation[] ?? []).reduce<Record<string, number>>((result, observation) => {
              if (observation.titulo === CALL_LOG_TITLE) result[observation.maestro_id] = (result[observation.maestro_id] ?? 0) + 1
              return result
            }, {})
            setCallCounts(counts)
          })
      })
      .catch(() => active && setMessage('No fue posible cargar los Timoteos.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [coordinator.id])

  const filteredMembers = useMemo(() => {
    const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    if (!normalized) return members
    return members.filter(member => `${nameOf(member)} ${member.telefono ?? ''} ${groupOf(member)}`
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalized))
  }, [members, query])

  const selected = members.find(member => member.id === selectedId) ?? null

  async function loadObservations(memberId: string) {
    setLoadingObservations(true)
    try {
      const response = await fetch(`/api/kids/observaciones?maestro_id=${encodeURIComponent(memberId)}`, { credentials: 'include' })
      const json = await response.json()
      const nextObservations = json.ok ? json.data ?? [] : []
      setObservations(nextObservations)
      if (json.ok) setCallCounts(previous => ({
        ...previous,
        [memberId]: nextObservations.filter((observation: Observation) => observation.titulo === CALL_LOG_TITLE).length,
      }))
    } catch {
      setObservations([])
    } finally {
      setLoadingObservations(false)
    }
  }

  useEffect(() => {
    setNote('')
    setMessage(null)
    if (selected?.id) void loadObservations(selected.id)
    else setObservations([])
  }, [selected?.id])

  async function saveObservation() {
    if (!selected || !note.trim()) return
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/kids/observaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maestro_id: selected.id,
          coordinador_id: coordinator.id,
          grupo: groupOf(selected),
          tipo: 'general',
          titulo: 'Seguimiento de Timoteos',
          descripcion: note.trim(),
          fecha: new Date().toISOString().slice(0, 10),
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'No se pudo guardar la observación.')
      setObservations(previous => [json.data, ...previous])
      setNote('')
      setMessage('Observación guardada correctamente.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar la observación.')
    } finally {
      setSaving(false)
    }
  }

  async function registerCall() {
    if (!selected?.telefono) return
    try {
      const response = await fetch('/api/kids/observaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maestro_id: selected.id,
          coordinador_id: coordinator.id,
          grupo: groupOf(selected),
          tipo: 'general',
          titulo: CALL_LOG_TITLE,
          descripcion: `Marcación al número ${selected.telefono}.`,
          fecha: new Date().toISOString().slice(0, 10),
        }),
      })
      const json = await response.json()
      if (response.ok) {
        setObservations(previous => [json.data, ...previous])
        setCallCounts(previous => ({ ...previous, [selected.id]: (previous[selected.id] ?? 0) + 1 }))
      }
    } catch {
      // La llamada nativa sigue funcionando aunque el historial no esté disponible.
    }
  }

  const phoneHref = selected?.telefono ? `tel:${selected.telefono.replace(/[^\d+]/g, '')}` : null
  const waNumber = whatsappNumber(selected?.telefono ?? null)
  const whatsappHref = selected && waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Hola ${selected.nombre}, te escribimos desde la coordinación de Timoteos ASP Kids.`)}`
    : null
  const callCount = selected ? callCounts[selected.id] ?? observations.filter(observation => observation.titulo === CALL_LOG_TITLE).length : 0

  return (
    <main className="timoteos-call-shell">
      <div className="timoteos-call-orb timoteos-call-orb-a" />
      <div className="timoteos-call-orb timoteos-call-orb-b" />
      <section className="timoteos-call-layout">
        <div className="timoteos-call-intro">
          <div>
            <span className="timoteos-call-kicker"><i /> Seguimiento activo</span>
            <h2>Contacta y acompaña a tu equipo</h2>
          </div>
          <strong><b>{members.length}</b> Timoteos</strong>
        </div>

        <section className={`timoteos-call-workspace ${selected ? 'has-selection' : ''}`} aria-label="Seguimiento de Timoteos">
          <motion.aside
            className="timoteos-call-list-panel"
            variants={LEFT_PANEL_VARIANTS}
            initial="initial"
            animate="animate"
          >
            <div className="timoteos-call-list-heading">
              <div>
                <h2>Equipo de Timoteos</h2>
                <p>{loading ? 'Cargando registros…' : `${filteredMembers.length} registros disponibles${assignedGroup ? ` · ${assignedGroup}` : ''}`}</p>
              </div>
              <span>{members.length}</span>
            </div>
            <label className="timoteos-call-search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2" /></svg>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nombre o grupo…" />
            </label>
            <motion.div
              key={`timoteos-${filteredMembers.length}-${query}`}
              className="timoteos-call-list"
              aria-live="polite"
              variants={LIST_WRAPPER_VARIANTS}
              initial="initial"
              animate="animate"
            >
              {loading ? <div className="timoteos-call-empty">Cargando el equipo…</div> : filteredMembers.length === 0 ? (
                <div className="timoteos-call-empty">No hay Timoteos que coincidan con la búsqueda.</div>
              ) : filteredMembers.map(member => (
                <motion.button
                  type="button"
                  key={member.id}
                  className={`timoteos-call-member ${selected?.id === member.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedId(member.id)}
                  variants={LIST_ITEM_VARIANTS}
                >
                  <span className="timoteos-call-member-avatar">
                    {member.foto_url ? <img src={member.foto_url} alt="" /> : initialsOf(member)}
                  </span>
                  <span className="timoteos-call-member-copy">
                    <strong>{nameOf(member)}</strong>
                  </span>
                  <span className="timoteos-call-member-report" title="Intentos de llamada registrados">
                    <i aria-hidden="true">☎</i>{callCounts[member.id] ?? 0}
                  </span>
                  <span className="timoteos-call-member-arrow" aria-hidden="true">→</span>
                </motion.button>
              ))}
            </motion.div>
          </motion.aside>

          <section className="timoteos-call-detail-panel">
            <LiquidGlassSweepTransition
              key={selected?.id ?? 'empty'}
              className="timoteos-call-glass-handoff"
              state={selected ? 'active' : 'idle'}
              outgoing={<span className="timoteos-call-glass-handoff-layer" />}
              incoming={<span className="timoteos-call-glass-handoff-layer is-incoming" />}
              outgoingDistance={76}
              incomingDistance={46}
              outgoingDuration={420}
              incomingDuration={560}
              incomingDelay={90}
            />
            <AnimatePresence initial={false} mode="wait">
            {selected ? (
              <motion.div
                className="timoteos-call-detail"
                key={selected.id}
                variants={DETAIL_PANEL_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <div className="timoteos-call-mobile-back">
                  <button type="button" onClick={() => setSelectedId(null)}>← Volver al equipo</button>
                </div>
                <header className="timoteos-call-person">
                  <div className="timoteos-call-person-avatar">
                    {selected.foto_url ? <img src={selected.foto_url} alt={nameOf(selected)} /> : initialsOf(selected)}
                  </div>
                  <div>
                    <span>Timoteo · {groupOf(selected)}</span>
                    <h2>{nameOf(selected)}</h2>
                    <p>{selected.telefono || 'Aún no tiene teléfono registrado'}</p>
                    {selected.telefono && (
                      <span className="timoteos-call-count" title="Intentos de llamada registrados">
                        <i aria-hidden="true">☎</i>
                        {callCount === 0 ? 'Aún sin llamadas' : `${callCount} ${callCount === 1 ? 'llamada' : 'llamadas'}`}
                      </span>
                    )}
                  </div>
                  <div className="timoteos-call-actions">
                    {phoneHref ? <a href={phoneHref} onClick={() => { void registerCall() }} title={`Llamar a ${selected.telefono}`}>☎ <span>Llamar</span></a> : <button type="button" disabled>☎ <span>Sin teléfono</span></button>}
                    {whatsappHref ? <a className="is-whatsapp" href={whatsappHref} target="_blank" rel="noopener noreferrer">◔ <span>WhatsApp</span></a> : <button type="button" disabled>◔ <span>WhatsApp</span></button>}
                  </div>
                </header>

                <div className="timoteos-call-observations">
                  <div className="timoteos-call-observation-heading">
                    <div><span>Seguimiento</span><h3>Observaciones</h3></div>
                    <b>{observations.length}</b>
                  </div>
                  <textarea value={note} onChange={event => setNote(event.target.value)} placeholder={`Escribe aquí las observaciones para ${selected.nombre}…`} />
                  <div className="timoteos-call-save-row">
                    <small>{message ?? 'La observación quedará asociada a este Timoteo.'}</small>
                    <button type="button" disabled={!note.trim() || saving} onClick={saveObservation}>{saving ? 'Guardando…' : 'Guardar observación'}</button>
                  </div>
                  <div className="timoteos-call-observation-list">
                    {loadingObservations ? <p>Cargando observaciones…</p> : observations.length === 0 ? <p>Aún no hay observaciones registradas.</p> : observations.map(observation => (
                      <article key={observation.id}>
                        <div><strong>{observation.titulo}</strong><time>{new Date(observation.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}</time></div>
                        <p>{observation.descripcion || 'Sin detalle adicional.'}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : <motion.div className="timoteos-call-empty timoteos-call-empty-detail" key="empty" variants={DETAIL_PANEL_VARIANTS} initial="initial" animate="animate" exit="exit">Selecciona un Timoteo para ver su información de contacto.</motion.div>}
            </AnimatePresence>
          </section>
        </section>
      </section>
      <button type="button" className="timoteos-call-fixed-back" onClick={onBack}>
        <span aria-hidden="true">←</span> Mis paneles
      </button>
      <style>{styles}</style>
    </main>
  )
}

const styles = `
  * { box-sizing: border-box; }
  .timoteos-call-shell { min-height:100dvh; position:relative; overflow:hidden; padding:clamp(12px,2vw,30px); color:#172554; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:linear-gradient(142deg,#dbfbf3 0%,#e9edff 48%,#d9efff 100%); }
  .timoteos-call-orb { position:fixed; pointer-events:none; border-radius:50%; filter:blur(42px); }
  .timoteos-call-orb-a { width:34rem; height:34rem; top:-15rem; left:-10rem; background:rgba(20,184,166,.3); }
  .timoteos-call-orb-b { width:31rem; height:31rem; right:-12rem; bottom:-16rem; background:rgba(124,58,237,.24); }
  .timoteos-call-layout { position:relative; z-index:1; width:min(100%,1380px); margin:0 auto; }
  .timoteos-call-header { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:16px; min-height:66px; margin-bottom:18px; }
  .timoteos-call-header > div:nth-child(2) { text-align:center; }
  .timoteos-call-header p, .timoteos-call-header h1 { margin:0; }
  .timoteos-call-header p { color:#0f766e; font-size:10px; font-weight:900; letter-spacing:.17em; text-transform:uppercase; }
  .timoteos-call-header h1 { margin-top:3px; font-size:clamp(24px,3vw,34px); letter-spacing:-.055em; line-height:1; }
  .timoteos-call-back { justify-self:start; min-height:40px; padding:0 14px; border:1px solid rgba(15,118,110,.16); border-radius:999px; background:rgba(255,255,255,.65); color:#0f766e; box-shadow:inset 0 1px #fff,0 8px 22px rgba(40,67,98,.08); cursor:pointer; font:inherit; font-size:12px; font-weight:800; transition:transform .25s ease,background .25s ease; }
  .timoteos-call-back:hover { transform:translateX(-3px); background:rgba(255,255,255,.92); }
  .timoteos-call-back span { margin-right:6px; font-size:17px; vertical-align:-1px; }
  .timoteos-call-fixed-back { position:fixed; z-index:10; bottom:20px; left:20px; min-height:40px; padding:0 14px; border:1px solid rgba(15,118,110,.16); border-radius:999px; background:rgba(255,255,255,.76); color:#0f766e; box-shadow:inset 0 1px #fff,0 10px 26px rgba(40,67,98,.13); backdrop-filter:blur(16px) saturate(150%); cursor:pointer; font:inherit; font-size:12px; font-weight:800; transition:transform .25s ease,background .25s ease; }.timoteos-call-fixed-back:hover { transform:translateX(-3px); background:rgba(255,255,255,.96); }.timoteos-call-fixed-back span { margin-right:6px; font-size:17px; vertical-align:-1px; }
  .timoteos-call-coordinator { justify-self:end; display:flex; align-items:center; gap:8px; color:#61718c; font-size:11px; font-weight:750; }
  .timoteos-call-coordinator > span { width:34px; height:34px; display:grid; place-items:center; overflow:hidden; border:2px solid #fff; border-radius:50%; background:linear-gradient(135deg,#0f9b8e,#6757e8); color:#fff; font-size:11px; box-shadow:0 6px 16px rgba(38,62,96,.15); }
  .timoteos-call-coordinator img { width:100%; height:100%; object-fit:cover; }
  .timoteos-call-intro { position:relative; display:flex; align-items:center; justify-content:space-between; gap:18px; padding:clamp(13px,1.7vw,18px) clamp(17px,2.2vw,26px); margin-bottom:14px; overflow:hidden; border:1px solid rgba(255,255,255,.94); border-radius:23px; background:linear-gradient(118deg,rgba(255,255,255,.7),rgba(235,248,255,.35) 54%,rgba(222,234,255,.52)); box-shadow:inset 1px 1px 1px rgba(255,255,255,.98),inset -1px -1px 1px rgba(255,255,255,.24),0 16px 42px rgba(45,59,94,.1); backdrop-filter:blur(30px) saturate(160%); -webkit-backdrop-filter:blur(30px) saturate(160%); animation:timoteosCallEnter .55s cubic-bezier(.16,1,.3,1) both; }
  .timoteos-call-intro::after { content:''; position:absolute; inset:0; pointer-events:none; background:linear-gradient(112deg,rgba(255,255,255,.42),transparent 28%,transparent 67%,rgba(178,238,255,.2)); opacity:.72; }
  .timoteos-call-intro > * { position:relative; z-index:1; }
  .timoteos-call-kicker { display:flex; align-items:center; gap:7px; color:#0f766e; font-size:10px; font-weight:900; letter-spacing:.15em; text-transform:uppercase; }
  .timoteos-call-kicker i { width:8px; height:8px; border-radius:50%; background:#10b981; box-shadow:0 0 0 5px rgba(16,185,129,.13); }
  .timoteos-call-intro h2 { margin:6px 0 0; font-size:clamp(19px,2.1vw,26px); letter-spacing:-.045em; }
  .timoteos-call-intro p { margin:0; color:#61718c; font-size:13px; }
  .timoteos-call-intro > strong { display:flex; align-items:baseline; gap:7px; padding:9px 13px; border:1px solid rgba(15,118,110,.13); border-radius:17px; background:rgba(255,255,255,.56); color:#52708a; font-size:10px; text-transform:uppercase; letter-spacing:.06em; }
  .timoteos-call-intro > strong b { color:#0f766e; font-size:24px; letter-spacing:-.06em; }
  .timoteos-call-workspace { position:relative; isolation:isolate; display:grid; grid-template-columns:minmax(290px,.72fr) minmax(0,1.52fr); height:calc(100dvh - 150px); min-height:0; overflow:hidden; border:1px solid rgba(255,255,255,.94); border-radius:30px; background:radial-gradient(ellipse 76% 90% at 2% 0%,rgba(255,255,255,.73),transparent 62%),radial-gradient(ellipse 70% 88% at 103% 100%,rgba(203,194,255,.3),transparent 66%),linear-gradient(132deg,rgba(246,255,253,.52),rgba(229,241,255,.43) 49%,rgba(237,234,255,.5)); box-shadow:inset 1px 1px 2px rgba(255,255,255,.98),inset -1px -1px 2px rgba(255,255,255,.22),0 26px 68px rgba(40,55,93,.14); backdrop-filter:blur(34px) saturate(165%); -webkit-backdrop-filter:blur(34px) saturate(165%); animation:timoteosCallEnter .62s .07s cubic-bezier(.16,1,.3,1) both; }
  .timoteos-call-workspace::before { content:''; position:absolute; z-index:-1; inset:1px; border-radius:inherit; pointer-events:none; background:linear-gradient(118deg,rgba(255,255,255,.48),transparent 24%,transparent 68%,rgba(170,235,255,.2)); }.timoteos-call-workspace::after { content:''; position:absolute; z-index:-1; width:42%; height:74%; right:-18%; top:-33%; border-radius:50%; pointer-events:none; background:rgba(255,255,255,.26); filter:blur(28px); }
  .timoteos-call-list-panel { position:relative; z-index:1; display:flex; flex-direction:column; min-height:0; padding:18px 12px 12px; border-right:1px solid rgba(255,255,255,.56); background:linear-gradient(145deg,rgba(255,255,255,.44),rgba(237,252,250,.25) 51%,rgba(227,235,255,.29)); box-shadow:inset -1px 0 rgba(104,132,170,.07); will-change:transform,opacity; }
  .timoteos-call-list-heading { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:0 7px 12px; }
  .timoteos-call-list-heading h2 { margin:0; font-size:16px; letter-spacing:-.025em; }
  .timoteos-call-list-heading p { margin:3px 0 0; color:#718096; font-size:11px; }
  .timoteos-call-list-heading > span { width:30px; height:30px; display:grid; place-items:center; border-radius:10px; background:rgba(15,118,110,.1); color:#0f766e; font-size:12px; font-weight:900; }
  .timoteos-call-search { display:flex; align-items:center; gap:8px; height:40px; padding:0 11px; margin:0 4px 9px; border:1px solid rgba(255,255,255,.88); border-radius:14px; background:rgba(255,255,255,.74); box-shadow:inset 0 1px #fff,0 7px 18px rgba(42,59,90,.06); color:#7690a7; }
  .timoteos-call-search svg { width:16px; height:16px; flex:0 0 auto; fill:none; stroke:currentColor; stroke-width:2; }
  .timoteos-call-search input { width:100%; min-width:0; border:0; outline:0; background:transparent; color:#172554; font:inherit; font-size:12px; font-weight:650; }
  .timoteos-call-list { min-height:0; overflow:auto; padding:2px 2px 12px; scrollbar-width:thin; scrollbar-color:rgba(78,98,131,.3) transparent; }
  .timoteos-call-member { width:100%; display:grid; grid-template-columns:40px minmax(0,1fr) auto 20px; align-items:center; gap:10px; padding:10px; border:1px solid transparent; outline:none; border-radius:16px; background:transparent; color:inherit; text-align:left; cursor:pointer; transition:transform .28s cubic-bezier(.16,1,.3,1),background .28s ease,box-shadow .28s ease; will-change:transform,opacity; contain:layout paint; }.timoteos-call-member:focus-visible { outline:2px solid rgba(14,165,233,.72); outline-offset:2px; }
  .timoteos-call-member:hover { transform:translateX(3px); background:rgba(255,255,255,.45); }
  .timoteos-call-member.is-selected { border-color:rgba(56,189,248,.7); background:linear-gradient(90deg,rgba(207,250,254,.95),rgba(224,242,254,.9),rgba(224,231,255,.9)); box-shadow:0 10px 24px -12px rgba(14,165,233,.75),inset 0 1px #fff; }
  .timoteos-call-member-avatar { width:40px; height:40px; display:grid; place-items:center; overflow:hidden; border:2px solid rgba(255,255,255,.95); border-radius:50%; background:linear-gradient(135deg,#0f9b8e,#6757e8); box-shadow:0 5px 14px rgba(37,62,95,.14); color:#fff; font-size:11px; font-weight:900; }
  .timoteos-call-member-avatar img { width:100%; height:100%; object-fit:cover; }
  .timoteos-call-member-copy { min-width:0; display:flex; flex-direction:column; }
  .timoteos-call-member-copy strong { overflow:hidden; color:#172554; font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
  .timoteos-call-member-copy small { margin-top:2px; overflow:hidden; color:#718096; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
  .timoteos-call-member-copy em { width:max-content; max-width:100%; margin-top:4px; overflow:hidden; padding:2px 6px; border-radius:999px; background:rgba(103,87,232,.1); color:#6757e8; font-size:9px; font-style:normal; font-weight:800; text-overflow:ellipsis; white-space:nowrap; }
  .timoteos-call-member-report { min-width:31px; display:inline-flex; align-items:center; justify-content:center; gap:3px; padding:4px 5px; border:1px solid rgba(14,116,144,.12); border-radius:999px; background:linear-gradient(135deg,rgba(239,249,255,.94),rgba(224,231,255,.72)); box-shadow:inset 0 1px rgba(255,255,255,.9); color:#426b87; font-size:9px; font-weight:900; }.timoteos-call-member-report i { color:#1688d4; font-size:9px; font-style:normal; }
  .timoteos-call-member-arrow { color:#8aa0b9; font-size:17px; transition:transform .25s ease; }.timoteos-call-member.is-selected .timoteos-call-member-arrow { color:#0f9b8e; transform:translateX(2px); }
  .timoteos-call-detail-panel { position:relative; z-index:1; min-width:0; min-height:0; padding:clamp(14px,2vw,24px); overflow-y:auto; overflow-x:hidden; background:linear-gradient(125deg,rgba(247,253,255,.16),rgba(255,255,255,.06)); scrollbar-width:thin; scrollbar-color:rgba(73,98,135,.32) transparent; }
  .timoteos-call-glass-handoff { position:absolute; inset:0; z-index:0; display:grid; overflow:hidden; pointer-events:none; }.timoteos-call-glass-handoff > .lgx-sweep-transition__outgoing,.timoteos-call-glass-handoff > .lgx-sweep-transition__incoming { grid-area:1 / 1; min-width:0; min-height:0; }.timoteos-call-glass-handoff-layer { display:block; width:100%; height:100%; background:linear-gradient(112deg,rgba(255,255,255,.03) 0%,rgba(255,255,255,.17) 37%,rgba(180,235,255,.24) 54%,rgba(255,255,255,.03) 78%); }.timoteos-call-glass-handoff-layer.is-incoming { background:linear-gradient(112deg,rgba(209,250,244,.06),rgba(255,255,255,.22) 46%,rgba(220,231,255,.08) 82%); }
  .timoteos-call-detail-panel > :not(.timoteos-call-glass-handoff) { position:relative; z-index:1; }
  .timoteos-call-detail { position:relative; min-height:100%; overflow:hidden; will-change:transform,opacity,filter; }.timoteos-call-detail::before { content:''; position:absolute; z-index:0; top:-30%; bottom:-30%; left:-46%; width:31%; pointer-events:none; background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),rgba(189,238,255,.17),transparent); transform:rotate(18deg); animation:timoteosLiquidSheen 1.1s .16s cubic-bezier(.16,1,.3,1) both; }.timoteos-call-detail > * { position:relative; z-index:1; }
  .timoteos-call-mobile-back { display:none; }
  .timoteos-call-person { display:grid; grid-template-columns:64px minmax(0,1fr) auto; align-items:center; gap:13px; padding:15px; border:1px solid rgba(255,255,255,.86); border-radius:22px; background:linear-gradient(115deg,rgba(255,255,255,.77),rgba(231,243,252,.52)); box-shadow:inset 0 1px #fff,0 13px 32px rgba(40,57,88,.09); }
  .timoteos-call-person-avatar { width:64px; height:64px; display:grid; place-items:center; overflow:hidden; border:3px solid #fff; border-radius:20px; background:linear-gradient(135deg,#0f9b8e,#6757e8); box-shadow:0 10px 22px rgba(43,65,103,.19); color:#fff; font-size:18px; font-weight:900; }
  .timoteos-call-person-avatar img { width:100%; height:100%; object-fit:cover; }
  .timoteos-call-person > div:nth-child(2) > span { color:#0f766e; font-size:10px; font-weight:900; letter-spacing:.11em; text-transform:uppercase; }
  .timoteos-call-person h2 { margin:3px 0; color:#172554; font-size:clamp(19px,2.2vw,27px); letter-spacing:-.05em; }.timoteos-call-person p { margin:0; color:#718096; font-size:12px; }
  .timoteos-call-person .timoteos-call-count { width:max-content; display:inline-flex; align-items:center; gap:5px; margin-top:8px; padding:4px 8px; border:1px solid rgba(14,116,144,.15); border-radius:999px; background:linear-gradient(135deg,rgba(239,249,255,.92),rgba(224,231,255,.74)); box-shadow:inset 0 1px rgba(255,255,255,.92); color:#376782; font-size:9px; font-weight:850; letter-spacing:.02em; text-transform:none; }.timoteos-call-count i { width:15px; height:15px; display:grid; place-items:center; border-radius:50%; background:linear-gradient(135deg,#38bdf8,#4f46e5); color:#fff; font-size:8px; font-style:normal; box-shadow:0 3px 7px rgba(59,130,246,.22); }
  .timoteos-call-actions { display:flex; flex-direction:column; gap:7px; }.timoteos-call-actions a,.timoteos-call-actions button { min-height:35px; display:flex; align-items:center; justify-content:center; gap:6px; padding:0 12px; border:1px solid rgba(14,116,144,.18); border-radius:999px; background:linear-gradient(135deg,rgba(239,249,255,.96),rgba(219,238,255,.78)); color:#087a88; box-shadow:inset 0 1px rgba(255,255,255,.96),0 6px 15px rgba(14,116,144,.08); font:inherit; font-size:11px; font-weight:850; text-decoration:none; cursor:pointer; transition:transform .22s ease,box-shadow .22s ease,filter .22s ease; }.timoteos-call-actions a:hover { transform:translateY(-2px); box-shadow:inset 0 1px #fff,0 10px 20px rgba(14,116,144,.16); filter:saturate(1.08); }.timoteos-call-actions .is-whatsapp { border-color:rgba(16,185,129,.23); background:linear-gradient(135deg,rgba(237,253,245,.98),rgba(207,250,231,.76)); color:#087f5b; box-shadow:inset 0 1px rgba(255,255,255,.96),0 6px 15px rgba(16,185,129,.09); }.timoteos-call-actions button:disabled { opacity:.52; cursor:not-allowed; }
  .timoteos-call-observations { display:flex; flex-direction:column; min-height:300px; padding:20px 5px 0; }.timoteos-call-observation-heading { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }.timoteos-call-observation-heading span { color:#0f766e; font-size:10px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; }.timoteos-call-observation-heading h3 { margin:3px 0 0; font-size:18px; letter-spacing:-.035em; }.timoteos-call-observation-heading b { min-width:29px; height:29px; display:grid; place-items:center; border-radius:10px; background:rgba(103,87,232,.1); color:#6757e8; font-size:12px; }.timoteos-call-observations textarea { width:100%; min-height:98px; resize:vertical; padding:13px; border:1px solid rgba(255,255,255,.86); border-radius:16px; outline:0; background:rgba(255,255,255,.66); box-shadow:inset 0 1px #fff,0 7px 18px rgba(42,59,90,.06); color:#172554; font:inherit; font-size:13px; line-height:1.5; transition:border-color .22s ease,box-shadow .22s ease; }.timoteos-call-observations textarea:focus { border-color:rgba(15,118,110,.35); box-shadow:inset 0 1px #fff,0 0 0 3px rgba(20,184,166,.1); }.timoteos-call-save-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:9px 1px 13px; }.timoteos-call-save-row small { color:#718096; font-size:10px; }.timoteos-call-save-row button { min-height:36px; padding:0 13px; border:0; border-radius:12px; background:linear-gradient(135deg,#0f9b8e,#1688d4); box-shadow:0 9px 18px rgba(15,118,110,.22); color:#fff; font:inherit; font-size:11px; font-weight:850; cursor:pointer; transition:transform .2s ease,opacity .2s ease; }.timoteos-call-save-row button:hover:not(:disabled) { transform:translateY(-2px); }.timoteos-call-save-row button:disabled { opacity:.5; cursor:not-allowed; }
  .timoteos-call-observation-list { min-height:0; flex:1; overflow:auto; padding-right:3px; }.timoteos-call-observation-list > p { margin:20px 0; color:#8190a7; font-size:12px; text-align:center; }.timoteos-call-observation-list article { padding:11px 12px; margin-bottom:8px; border:1px solid rgba(255,255,255,.7); border-radius:14px; background:rgba(255,255,255,.46); box-shadow:inset 0 1px rgba(255,255,255,.85); animation:timoteosNoteIn .35s ease both; }.timoteos-call-observation-list article > div { display:flex; align-items:center; justify-content:space-between; gap:12px; }.timoteos-call-observation-list strong { color:#28405e; font-size:11px; }.timoteos-call-observation-list time { color:#8090a6; font-size:10px; }.timoteos-call-observation-list article p { margin:6px 0 0; color:#566880; font-size:12px; line-height:1.45; white-space:pre-wrap; }
  .timoteos-call-empty { display:grid; min-height:120px; place-items:center; padding:20px; color:#7a8aa2; font-size:12px; text-align:center; }.timoteos-call-empty-detail { height:100%; min-height:300px; border:1px dashed rgba(93,115,148,.26); border-radius:22px; background:rgba(255,255,255,.32); }
  @keyframes timoteosCallEnter { from { opacity:0; transform:translateY(18px) scale(.985); } to { opacity:1; transform:translateY(0) scale(1); } } @keyframes timoteosDetailSlide { from { opacity:0; transform:translateX(22px); } to { opacity:1; transform:translateX(0); } } @keyframes timoteosNoteIn { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } } @keyframes timoteosLiquidSheen { from { opacity:0; transform:translate3d(-120%,0,0) rotate(18deg); } 22% { opacity:.9; } to { opacity:0; transform:translate3d(460%,0,0) rotate(18deg); } }
  @media (max-width:760px) { .timoteos-call-shell { padding:12px 12px 66px; overflow:auto; }.timoteos-call-fixed-back { bottom:14px; left:14px; min-height:38px; font-size:11px; }.timoteos-call-intro { align-items:flex-start; flex-direction:column; }.timoteos-call-workspace { grid-template-columns:1fr; height:auto; min-height:auto; overflow:visible; }.timoteos-call-list-panel { max-height:calc(100dvh - 180px); border-right:0; border-bottom:1px solid rgba(113,128,162,.15); }.timoteos-call-workspace.has-selection .timoteos-call-list-panel { display:none; }.timoteos-call-detail-panel { min-height:calc(100dvh - 130px); padding:0; overflow:visible; }.timoteos-call-workspace:not(.has-selection) .timoteos-call-detail-panel { display:none; }.timoteos-call-detail { padding:0; }.timoteos-call-mobile-back { display:block; margin-bottom:10px; }.timoteos-call-mobile-back button { min-height:35px; padding:0 12px; border:1px solid rgba(15,118,110,.15); border-radius:12px; background:rgba(255,255,255,.76); color:#0f766e; font:inherit; font-size:11px; font-weight:850; box-shadow:inset 0 1px #fff,0 7px 16px rgba(40,57,88,.08); }.timoteos-call-person { grid-template-columns:55px minmax(0,1fr); }.timoteos-call-person-avatar { width:55px; height:55px; border-radius:18px; }.timoteos-call-actions { grid-column:1 / -1; display:grid; grid-template-columns:1fr 1fr; }.timoteos-call-actions a,.timoteos-call-actions button { width:100%; }.timoteos-call-observations { height:auto; min-height:430px; }.timoteos-call-observation-list { max-height:250px; } }
`
