'use client'

const admins = [
  { code:'MG', grad:'linear-gradient(135deg,#0d9488,#0891b2)', name:'María González',  role:'Administradora Kids', cedula:'12.345.678', tel:'300 123 4567', active:true,  since:'10 May 2026' },
  { code:'JP', grad:'linear-gradient(135deg,#7c3aed,#a855f7)', name:'Jorge Pérez',     role:'Administrador Kids',  cedula:'87.654.321', tel:'311 987 6543', active:true,  since:'08 May 2026' },
  { code:'LR', grad:'linear-gradient(135deg,#f43f5e,#fb7185)', name:'Laura Ríos',     role:'Administradora Kids', cedula:'55.512.345', tel:'320 555 1234', active:false, since:'01 May 2026' },
  { code:'CA', grad:'linear-gradient(135deg,#f59e0b,#fbbf24)', name:'Carlos Andrade', role:'Administrador Kids',  cedula:'33.221.100', tel:'315 432 9876', active:true,  since:'25 Abr 2026' },
]

const navItems = [
  { num:'01', label:'Dashboard',        active:false },
  { num:'02', label:'Administradores',  active:true  },
  { num:'03', label:'Coordinadores',    active:false },
  { num:'04', label:'Maestros',         active:false },
  { num:'05', label:'Auxiliares',       active:false },
  { num:'06', label:'Rotaciones',       active:false },
  { num:'07', label:'Niños',            active:false },
  { num:'08', label:'Asistencias',      active:false },
  { num:'09', label:'Seguimientos',     active:false, alert:3 },
]

export default function KidsPreview() {
  return (
    <div style={{
      fontFamily:"'Segoe UI',system-ui,sans-serif",
      background:'linear-gradient(145deg,#d6efeb 0%,#ede9fb 45%,#cce9f5 100%)',
      minHeight:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', padding:28,
    }}>
      <div style={{
        width:'100%', maxWidth:1220, height:700,
        display:'flex', borderRadius:28, overflow:'hidden',
        boxShadow:'0 32px 72px rgba(0,0,0,.13), 0 0 0 1px rgba(255,255,255,.7)',
      }}>

        {/* ══════════════════════════════
            SIDEBAR — editorial style
        ══════════════════════════════ */}
        <aside style={{
          width:230, minWidth:230,
          background:'#fff',
          display:'flex', flexDirection:'column',
          padding:'32px 0',
          borderRight:'1px solid rgba(0,0,0,.06)',
          position:'relative',
        }}>
          {/* Logo */}
          <div style={{ padding:'0 28px 36px' }}>
            <div style={{ fontSize:22, fontWeight:800, color:'#111827', letterSpacing:'-0.5px' }}>
              Kids<span style={{ color:'#0d9488' }}>.</span>
            </div>
            <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', letterSpacing:'2px', textTransform:'uppercase', marginTop:2 }}>Ministry Hub</div>
          </div>

          {/* Nav */}
          <nav style={{ flex:1, display:'flex', flexDirection:'column', gap:2, padding:'0 16px' }}>
            {navItems.map(n => (
              <div key={n.num} style={{
                display:'flex', alignItems:'center', gap:14,
                padding:'10px 12px', borderRadius:12, cursor:'pointer',
                background: n.active ? 'linear-gradient(135deg,#0d948812,#0891b20a)' : 'transparent',
                borderLeft: n.active ? '3px solid #0d9488' : '3px solid transparent',
                transition:'all .2s',
              }}>
                <span style={{
                  fontSize:10, fontWeight:700, color: n.active ? '#0d9488' : '#d1d5db',
                  letterSpacing:'0.5px', minWidth:18,
                }}>{n.num}</span>
                <span style={{
                  fontSize:13, fontWeight: n.active ? 700 : 500,
                  color: n.active ? '#111827' : '#6b7280',
                }}>{n.label}</span>
                {n.alert && (
                  <span style={{ marginLeft:'auto', background:'#f43f5e', color:'#fff', fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:20 }}>{n.alert}</span>
                )}
              </div>
            ))}
          </nav>

          {/* User strip */}
          <div style={{ margin:'0 16px', padding:'14px 12px', borderRadius:14, background:'linear-gradient(135deg,#f0fdfa,#eff6ff)', border:'1px solid #e0f2fe' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#0d9488,#0891b2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff' }}>WG</div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#111827' }}>Wilmer Gallo</div>
                <div style={{ fontSize:10, color:'#0d9488', fontWeight:600 }}>Super Admin</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ══════════════════════════════
            MAIN CONTENT
        ══════════════════════════════ */}
        <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'transparent' }}>

          {/* Top bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'28px 36px 0' }}>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:'#0d9488', letterSpacing:'2px', textTransform:'uppercase', marginBottom:4 }}>Módulo Kids</div>
              <div style={{ fontSize:28, fontWeight:800, color:'#111827', letterSpacing:'-0.8px', lineHeight:1 }}>Administradores</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              {/* Search pill */}
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.8)', border:'1px solid rgba(0,0,0,.08)', borderRadius:50, padding:'9px 18px', fontSize:12, color:'#9ca3af' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                Buscar...
              </div>
              {/* CTA */}
              <button style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 22px', borderRadius:50, fontSize:13, fontWeight:700, background:'linear-gradient(135deg,#0d9488,#0891b2)', color:'#fff', border:'none', cursor:'pointer', boxShadow:'0 8px 20px rgba(13,148,136,.35)', letterSpacing:'0.2px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Nuevo Admin
              </button>
            </div>
          </div>

          {/* Content scroll area */}
          <div style={{ flex:1, overflowY:'auto', padding:'24px 36px 28px', display:'flex', flexDirection:'column', gap:20 }}>

            {/* ── STATS BENTO ── */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
              {[
                { label:'Total registrados', val:'4', sub:'Administradores',   accent:'#0d9488', bg:'linear-gradient(135deg,#f0fdfa,#e0f7f4)', bar:'linear-gradient(90deg,#0d9488,#0891b2)' },
                { label:'Activos ahora',     val:'3', sub:'En servicio',       accent:'#7c3aed', bg:'linear-gradient(135deg,#faf5ff,#ede9fe)', bar:'linear-gradient(90deg,#7c3aed,#a855f7)' },
                { label:'Último ingreso',    val:'Hoy', sub:'10 de Mayo 2026', accent:'#f59e0b', bg:'linear-gradient(135deg,#fffbeb,#fef3c7)', bar:'linear-gradient(90deg,#f59e0b,#fbbf24)' },
              ].map(s => (
                <div key={s.label} style={{ background:'#fff', borderRadius:20, padding:0, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,.07)', border:'1px solid rgba(0,0,0,.04)' }}>
                  {/* Top accent bar */}
                  <div style={{ height:4, background:s.bar }} />
                  <div style={{ padding:'18px 20px' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:8 }}>{s.label}</div>
                    <div style={{ fontSize:34, fontWeight:800, color:'#111827', letterSpacing:'-1px', lineHeight:1, marginBottom:4 }}>{s.val}</div>
                    <div style={{ fontSize:11, color:s.accent, fontWeight:600 }}>{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── ADMIN CARDS — innovative horizontal strips ── */}
            <div style={{ background:'#fff', borderRadius:24, overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,.07)', border:'1px solid rgba(0,0,0,.04)', flex:1 }}>

              {/* Section header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px 0' }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:'#111827' }}>Equipo de Administración</div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{admins.length} perfiles registrados</div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  {['Todos','Activos','Inactivos'].map((t,i) => (
                    <button key={t} style={{ padding:'5px 14px', borderRadius:50, fontSize:11, fontWeight:600, border:'1px solid', cursor:'pointer',
                      background: i===0 ? '#0d9488' : 'transparent',
                      color:      i===0 ? '#fff'    : '#9ca3af',
                      borderColor:i===0 ? '#0d9488' : '#e5e7eb',
                    }}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Admin strips */}
              <div style={{ padding:'16px 24px', display:'flex', flexDirection:'column', gap:10 }}>
                {admins.map((a, i) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:16,
                    padding:'14px 18px', borderRadius:16,
                    background: a.active ? 'linear-gradient(135deg,#f8fffe,#f5f8ff)' : '#fafafa',
                    border:`1px solid ${a.active ? 'rgba(13,148,136,.12)' : 'rgba(0,0,0,.06)'}`,
                    transition:'all .2s',
                  }}>
                    {/* Avatar */}
                    <div style={{ width:44, height:44, borderRadius:14, background:a.grad, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:'#fff', flexShrink:0, boxShadow:`0 4px 12px ${a.active ? 'rgba(13,148,136,.25)' : 'rgba(0,0,0,.1)'}` }}>{a.code}</div>

                    {/* Name + role */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'#111827', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.name}</div>
                      <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>{a.role}</div>
                    </div>

                    {/* Divider */}
                    <div style={{ width:1, height:32, background:'#f3f4f6', flexShrink:0 }} />

                    {/* Cedula */}
                    <div style={{ textAlign:'center', minWidth:90 }}>
                      <div style={{ fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:'1px' }}>Cédula</div>
                      <div style={{ fontSize:12, color:'#374151', fontWeight:600, marginTop:2 }}>{a.cedula}</div>
                    </div>

                    <div style={{ width:1, height:32, background:'#f3f4f6', flexShrink:0 }} />

                    {/* Phone */}
                    <div style={{ textAlign:'center', minWidth:100 }}>
                      <div style={{ fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:'1px' }}>Teléfono</div>
                      <div style={{ fontSize:12, color:'#374151', fontWeight:600, marginTop:2 }}>{a.tel}</div>
                    </div>

                    <div style={{ width:1, height:32, background:'#f3f4f6', flexShrink:0 }} />

                    {/* Status pill — innovative */}
                    <div style={{ minWidth:80, display:'flex', justifyContent:'center' }}>
                      <div style={{
                        padding:'5px 14px', borderRadius:50, fontSize:11, fontWeight:700,
                        background: a.active ? 'linear-gradient(135deg,#0d948820,#0891b215)' : '#fef2f2',
                        color:      a.active ? '#0d9488' : '#f43f5e',
                        border:    `1px solid ${a.active ? '#0d948840' : '#fecdd3'}`,
                        display:'flex', alignItems:'center', gap:5,
                      }}>
                        <div style={{ width:5, height:5, borderRadius:'50%', background: a.active ? '#0d9488' : '#f43f5e' }} />
                        {a.active ? 'Activo' : 'Inactivo'}
                      </div>
                    </div>

                    {/* Date */}
                    <div style={{ textAlign:'center', minWidth:80 }}>
                      <div style={{ fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:'1px' }}>Desde</div>
                      <div style={{ fontSize:11, color:'#6b7280', fontWeight:500, marginTop:2 }}>{a.since}</div>
                    </div>

                    {/* Actions */}
                    <div style={{ display:'flex', gap:6 }}>
                      <button style={{ width:34, height:34, borderRadius:10, border:'1px solid #e0f2fe', background:'#f0fdfa', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button style={{ width:34, height:34, borderRadius:10, border:'1px solid #fecdd3', background:'#fff5f5', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
