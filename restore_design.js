const fs = require('fs');
const file = 'C:/Users/WFSYSTEM/Documents/Consolidacion-asp/src/app/kids/admin/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Redesign the ServidorCard to match the image
const newServidorCard = `function ServidorCard({
  s, idx, isDeleting, onEdit, onDelete,
}: {
  s: KidsServidor
  idx: number
  isDeleting: boolean
  onEdit: () => void
  onDelete: () => void
  compact?: boolean
}) {
  const [broken, setBroken] = useState(false)
  const showImg = s.foto_url && !broken
  const ini = \`\${s.nombre.charAt(0)}\${s.apellido.charAt(0)}\`.toUpperCase()
  
  return (
    <div 
      onClick={onEdit}
      style={{ 
        height: 280, 
        borderRadius: 24, 
        background: '#fff', 
        boxShadow: '0 8px 30px rgba(0,0,0,0.06)', 
        padding: '24px 16px 16px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        opacity: isDeleting ? 0.5 : 1,
        cursor: 'pointer',
        transition: 'transform 0.2s',
      }}
    >
       <div style={{ width: 88, height: 88, borderRadius: '50%', background: gradient(idx), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 'bold', color: '#fff', overflow: 'hidden', marginBottom: 16 }}>
         {showImg ? <img src={s.foto_url!} style={{width:'100%', height:'100%', objectFit:'cover'}} onError={()=>setBroken(true)}/> : ini}
       </div>
       
       <div style={{ textAlign: 'center', fontWeight: '800', fontSize: 15, color: '#111827', marginBottom: 6, lineHeight: 1.2 }}>
         {s.nombre} {s.apellido}
       </div>
       
       <div style={{ background: '#f0f9ff', color: '#0284c7', padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 'auto' }}>
         {s.rol || 'SERVIDOR'}
       </div>
       
       <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 20 }}>
         <button onClick={(e) => { e.stopPropagation(); /* whatsapp logic */ }} style={{ flex: 1, padding: '10px 0', borderRadius: 20, background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}>
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
         </button>
         <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ flex: 1, padding: '10px 0', borderRadius: 20, background: '#e5e7eb', color: '#4b5563', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
         </button>
       </div>
    </div>
  )`;
content = content.replace(/function ServidorCard\(\{[\s\S]*?\}\s*\)\s*\{[\s\S]*?return \([\s\S]*?<\/div>\r?\n\s*\)/m, newServidorCard);


// 2. Add the custom Header and remove old Section header
const newHeader = `{/* ── Admin list card ── */}
            <div style={{
              background:   'transparent',
              flex:         1,
              minHeight:    0,
              display:      'flex',
              flexDirection:'column',
            }}>
            
              {/* Custom Dark Blue Header */}
              <div style={{
                background: 'linear-gradient(90deg, #1e293b, #0f172a, #38bdf8)',
                borderRadius: isMobile ? '20px' : '24px 24px 100px 24px',
                padding: isMobile ? '16px' : '20px 32px',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center',
                justifyContent: 'space-between',
                gap: 16,
                boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.4)',
                marginBottom: 20,
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                   <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Equipo de Servidores</div>
                   <div style={{ color: '#bae6fd', fontSize: 13, fontWeight: 500 }}>{filtered.length} de {servidores.length} perfiles</div>
                </div>
                
                {/* Search Bar */}
                <div style={{ flex: 1, maxWidth: 400, position: 'relative' }}>
                  <svg style={{ position: 'absolute', left: 14, top: 10, color: '#64748b' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <input 
                    type="text" 
                    placeholder="Buscar servidor..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '10px 16px 10px 40px', borderRadius: 50, border: 'none', background: 'rgba(255,255,255,0.9)', outline: 'none', fontSize: 14, fontWeight: 600, color: '#333' }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Roles Dropdown Placeholder */}
                  <button style={{ padding: '8px 16px', borderRadius: 50, background: 'rgba(255,255,255,0.8)', border: 'none', fontSize: 13, fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>Todos los Roles ⌄</button>
                  
                  {/* Filters */}
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.2)', borderRadius: 50, padding: 4 }}>
                    <button onClick={() => setFilter('todos')} style={{ padding: '6px 16px', borderRadius: 50, background: filter === 'todos' ? '#fff' : 'transparent', color: filter === 'todos' ? '#0f172a' : '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}>Todos</button>
                    <button onClick={() => setFilter('activos')} style={{ padding: '6px 16px', borderRadius: 50, background: filter === 'activos' ? '#fff' : 'transparent', color: filter === 'activos' ? '#0f172a' : '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}>Activos</button>
                  </div>
                  
                  {/* Nuevo Servidor */}
                  <button onClick={openCreate} style={{ padding: '8px 20px', borderRadius: 50, background: 'linear-gradient(90deg, #e0f2fe, #bae6fd)', border: 'none', fontSize: 14, fontWeight: 800, color: '#0284c7', cursor: 'pointer', boxShadow: '0 4px 12px rgba(224,242,254,0.5)' }}>+ Nuevo Servidor</button>
                </div>
              </div>`;

content = content.replace(/\{\/\* ── Admin list card ── \*\/\}[\s\S]*?\{\/\* Section header \*\/\}[\s\S]*?<\/div>\s*<\/div>/, newHeader);

// 3. Remove the border/background from the Strips container since we removed the Admin List Card wrapper background
content = content.replace(/padding:\s*isMobile \? '14px 14px 60px' : '16px 24px 75px',/g, "padding: isMobile ? '0px 14px 60px' : '0px 24px 75px',");

fs.writeFileSync(file, content);
console.log('Successfully applied exact design.');
