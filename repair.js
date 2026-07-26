const fs = require('fs');
const file = 'C:/Users/WFSYSTEM/Documents/Consolidacion-asp/src/app/kids/admin/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix NAV_ITEMS
content = content.replace(/const NAV_ITEMS = \[[\s\S]*?\] as const/, `const NAV_ITEMS = [
  { num: '01', label: 'Niños',           section: 'ninos'           },
  { num: '02', label: 'Asistencias',     section: 'asistencias'     },
  { num: '03', label: 'Seguimientos',    section: 'seguimientos'    },
  { num: '04', label: 'Servidores',      section: 'servidores'      },
  { num: '05', label: 'Agenda',          section: 'agenda'          },
] as const`);

content = content.replace(/const NAV_SECTIONS = \[[\s\S]*?\] as const/, '');

// 2. States
content = content.replace(/\/\/ ── Administradores ──[\s\S]*?\/\/ ── Shared ──/, `// ── Servidores ───────────────────────────────────────────────────────────
  const [servidores,     setServidores]     = useState<KidsServidor[]>([])
  const [loadingServidores, setLoadingServidores] = useState(true)
  const [servidorFilter, setServidorFilter] = useState<FilterTab>('todos')
  const [servidorSearch, setServidorSearch] = useState('')
  const [servidorModal,  setServidorModal]  = useState(false)
  const [editServidor,   setEditServidor]   = useState<KidsServidor | null>(null)
  const [deletingServidorId, setDeletingServidorId] = useState<string | null>(null)

  // ── Shared ──`);

// 3. Aliases
content = content.replace(/const loading\s+= displayNav === 'maestros'[\s\S]*?const setSearch\s+= displayNav === 'maestros'[\s\S]*?setAdminSearch/, `const loading   = loadingServidores
  const filter    = servidorFilter
  const setFilter = setServidorFilter
  const search    = servidorSearch
  const setSearch = setServidorSearch`);

// 4. Fetch
content = content.replace(/\/\* ── Fetch admins ──[\s\S]*?useEffect\(\(\) => \{ fetchCoordinadores\(\) \}, \[fetchCoordinadores\]\)/, `/* ── Fetch servidores ─────────────────────────────────────────────────── */
  const fetchServidores = useCallback(async () => {
    setLoadingServidores(true)
    try {
      const res  = await fetch('/api/kids/servidores')
      const json = await res.json()
      if (json.ok) setServidores(json.data ?? [])
    } catch { /* silently ignore */ }
    finally { setLoadingServidores(false) }
  }, [])

  useEffect(() => { fetchServidores() }, [fetchServidores])`);

// 5. Derived
content = content.replace(/const isMaestrosView\s+= displayNav === 'maestros'[\s\S]*?const activeList\s+= isMaestrosView[\s\S]*?admins/, `const isMaestrosView      = false
  const isCoordinadoresView = false
  const activeList          = servidores`);

// 6. Actions
content = content.replace(/function openCreate\(\) \{[\s\S]*?async function handleLogout\(\) \{/, `function openCreate() {
    setEditServidor(null); setServidorModal(true)
  }
  function openEdit(a: KidsServidor) {
    setEditServidor(a); setServidorModal(true)
  }

  async function handleServidorSaved() {
    setServidorModal(false)
    await fetchServidores()
  }

  async function handleDelete(a: KidsServidor) {
    if (!window.confirm(\`¿Desactivar a \${a.nombre} \${a.apellido}?\\n\\nEl registro no se eliminará, solo quedará inactivo.\`)) return
    setDeletingServidorId(a.id)
    try {
      const res = await fetch(\`/api/kids/servidores/\${a.id}\`, { method: 'DELETE' })
      if (res.ok) await fetchServidores()
    } finally { setDeletingServidorId(null) }
  }

  async function handleLogout() {`);

// 7. Replace Modals & Sections
content = content.replace(/\{adminModal && \([\s\S]*?<SeguimientosSection \/>\s*\)}/, `{servidorModal && (
        <ServidorModal
          servidor={editServidor}
          onClose={() => setServidorModal(false)}
          onSaved={handleServidorSaved}
        />
      )}

      {displayNav === 'ninos'        && <NinosSection />}
      {displayNav === 'asistencias'  && <AsistenciasSection />}
      {displayNav === 'seguimientos' && <SeguimientosSection />}
      {displayNav === 'agenda'       && <AgendaSection />}`);

// 8. In JSX, update loading conditions
content = content.replace(/isMaestrosView \? 'Cargando maestros\.\.\.' : isCoordinadoresView \? 'Cargando coordinadores\.\.\.' : 'Cargando administradores\.\.\.'/, `'Cargando servidores...'`);
content = content.replace(/isMaestrosView \? 'No hay maestros en este filtro\.'[\s\S]*?: 'No hay administradores en este filtro\.'/, `'No hay servidores en este filtro.'`);

// 9. Remove old Grid & Replace with ServidorCard grid
content = content.replace(/\{\/\* ── Grid de tarjetas — Coordinadores ── \*\/\}([\s\S]*?)\{\/\* ── Strips — solo Maestros ── \*\/\}/, `{/* ── Grid de tarjetas — Servidores ── */}
                {!loading && displayNav === 'servidores' && filtered.length > 0 && (
                  <div style={{
                    display:             'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, minmax(0, 230px))',
                    gap:                 isMobile ? 10 : 16,
                    justifyContent:      'start',
                    margin:              '0 auto',
                    width:               '100%',
                    alignContent:        'start',
                  }}>
                    {filtered.map((s, idx) => (
                      <ServidorCard
                        key={s.id}
                        s={s}
                        idx={idx}
                        isDeleting={deletingServidorId === s.id}
                        onEdit={() => openEdit(s)}
                        onDelete={() => handleDelete(s)}
                        compact={isMobile}
                      />
                    ))}
                  </div>
                )}
                
                {/* ── Strips — solo Maestros ── */}`);

content = content.replace(/\{\/\* ── Strips — solo Maestros ── \*\/\}([\s\S]*?)<\/div>\n\s*\}\)\}\n\s*<\/div>\n\s*\{\/\* ── Scroll area ── \*\/\}/, `</div>
              {/* ── Scroll area ── */}`);

// 10. Append ServidorCard function at the end
content = content.replace(/\/\* ══════════════════════════════════════════════════════════════════════════\n\s*AdminCard[\s\S]*$/, `/* ══════════════════════════════════════════════════════════════════════════
   ServidorCard
══════════════════════════════════════════════════════════════════════════ */
function ServidorCard({
  s, idx, isDeleting, onEdit, onDelete,
}: {
  s: KidsServidor
  idx: number
  isDeleting: boolean
  onEdit: () => void
  onDelete: () => void
  compact?: boolean
}) {
  const [flipped, setFlipped] = useState(false)
  const [broken, setBroken] = useState(false)
  const showImg = s.foto_url && !broken
  const ini = \`\${s.nombre.charAt(0)}\${s.apellido.charAt(0)}\`.toUpperCase()
  return (
    <div style={{ height: 312, borderRadius: 20, background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,.08)', padding: 16, display: 'flex', flexDirection: 'column', opacity: isDeleting ? 0.5 : 1 }}>
       <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f3f4f6', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 'bold', color: '#9ca3af', overflow: 'hidden' }}>
         {showImg ? <img src={s.foto_url!} style={{width:'100%', height:'100%', objectFit:'cover'}} onError={()=>setBroken(true)}/> : ini}
       </div>
       <div style={{ textAlign: 'center', marginTop: 12, fontWeight: 'bold', fontSize: 16, color: '#111827' }}>
         {s.nombre} {s.apellido}
       </div>
       <div style={{ textAlign: 'center', marginTop: 4, fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>
         {s.rol}
       </div>
       <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
         <button onClick={onEdit} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: '#0d9488', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Editar</button>
         <button onClick={onDelete} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: '#fff', color: '#ef4444', border: '1px solid #ef4444', cursor: 'pointer', fontWeight: 'bold' }}>Desactivar</button>
       </div>
    </div>
  )
}
`);

fs.writeFileSync(file, content);
