            {/* ── Admin list card ── */}
            <div style={{
              background:   '#fff',
              borderRadius: isMobile ? 18 : 24,
              boxShadow:    '0 4px 16px rgba(0,0,0,.08)',
              padding:      isMobile ? '8px 8px 12px' : '10px 14px 12px',
              flex:         1,
              minHeight:    0,
              display:      'flex',
              flexDirection:'column',
            }}>
            
              {/* Section header */}
              <div style={{
                display:        'flex',
                alignItems:     isMobile ? 'flex-start' : 'center',
                flexDirection:  isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                padding:        isMobile ? '16px 18px 0' : '20px 24px 0',
                gap:            isMobile ? 12 : 0,
                flexShrink:     0,
              }}>
                <div>
                  <div style={{ fontSize: isMobile ? 14 : 15, fontWeight:700, color:'#111827' }}>
                    Equipo de Servidores
                  </div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
                    {filtered.length} de {servidores.length} perfiles
                  </div>
                </div>
                {/* Filter tabs */}
                <div style={{ display:'flex', gap:6 }}>
                  {(['todos','activos','inactivos'] as FilterTab[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setFilter(t)}
                      style={{
                        padding:     isMobile ? '5px 12px' : '5px 14px',
                        borderRadius: 50,
                        fontSize:    11,
                        fontWeight:  600,
                        border:      '1px solid',
                        cursor:      'pointer',
                        background:  filter === t ? '#0d9488' : 'transparent',
                        color:       filter === t ? '#fff'    : '#9ca3af',
                        borderColor: filter === t ? '#0d9488' : '#e5e7eb',
                        transition:  'all .15s',
                      }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
                {/* Filter tabs */}
                <div style={{ display:'flex', gap:6 }}>
                  {(['todos','activos','inactivos'] as FilterTab[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setFilter(t)}
                      style={{
                        padding:     isMobile ? '5px 12px' : '5px 14px',
                        borderRadius: 50,
                        fontSize:    11,
                        fontWeight:  600,
                        border:      '1px solid',
                        cursor:      'pointer',
                        background:  filter === t ? '#0d9488' : 'transparent',
                        color:       filter === t ? '#fff'    : '#9ca3af',
                        borderColor: filter === t ? '#0d9488' : '#e5e7eb',
                        transition:  'all .15s',
                      }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Strips */}
              <div style={{
                padding: isMobile ? '14px 14px 50px' : '16px 24px 65px',
                display:'flex', flexDirection:'column',
                gap: isMobile ? 10 : 10,
                flex:1, minHeight:0, overflowY:'auto',
                animation: animPhase === 'enter'
                  ? 'aspSlideInRight 0.32s cubic-bezier(0.25,0.46,0.45,0.94) both'
                  : animPhase === 'exit'
                  ? 'aspSlideOutLeft 0.22s cubic-bezier(0.55,0,1,0.45) both'
                  : 'none',
                pointerEvents: animPhase === 'exit' ? 'none' : 'auto',
              }}>

                {loading && (
                  <div style={{ textAlign:'center', padding:'40px 0', fontSize:13, color:'#9ca3af' }}>
                    {'Cargando servidores...'}
                  </div>
                )}

                {!loading && filtered.length === 0 && (
                  <div style={{ textAlign:'center', padding:'40px 0' }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>🔍</div>
                    <div style={{ fontSize:13, color:'#9ca3af', fontWeight:500 }}>
                      {search
                        ? 'Sin resultados para esa búsqueda.'
                        : 'No hay servidores en este filtro.'}
                    </div>
                  </div>
                )}

                {/* ── Grid de tarjetas — Servidores ── */}
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
                
                {/* ── Strips — solo Maestros ── */}
                {!loading && isMaestrosView && filtered.map((a, idx) => {
                  const isDeleting = deletingMaestroId === a.id

                  /* ── Mobile card ── */
                  if (isMobile) {
                    return (
                      <div
                        key={a.id}
                        style={{
                          padding:    '14px 14px',
                          borderRadius: 16,
                          background: a.activo
                            ? 'linear-gradient(135deg,#f8fffe,#f5f8ff)'
                            : '#fafafa',
                          border: `1px solid ${a.activo ? 'rgba(13,148,136,.12)' : 'rgba(0,0,0,.06)'}`,
                          opacity:    isDeleting ? .5 : 1,
                          transition: 'all .2s',
                        }}
                      >
                        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                          <div style={{
                            flexShrink:0,
                            boxShadow:`0 4px 10px ${a.activo ? 'rgba(13,148,136,.2)' : 'rgba(0,0,0,.08)'}`,
                            borderRadius:12, overflow:'hidden',
                          }}>
                            <AvatarImg src={a.foto_url} nombre={a.nombre} apellido={a.apellido} grad={gradient(idx)} size={40} />
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {a.nombre} {a.apellido}
                            </div>
                            <div style={{ fontSize:10, color:'#9ca3af', marginTop:1 }}>
                              {isMaestrosView ? ((a as KidsMaestro).grupo ?? 'Maestro Kids') : 'Administrador Kids'}
                            </div>
                          </div>
                          <div style={{
                            padding:'4px 10px', borderRadius:50, fontSize:10, fontWeight:700, flexShrink:0,
                            background: a.activo ? 'linear-gradient(135deg,rgba(13,148,136,.12),rgba(8,145,178,.08))' : '#fef2f2',
                            color: a.activo ? '#0d9488' : '#f43f5e',
                            border: `1px solid ${a.activo ? 'rgba(13,148,136,.3)' : '#fecdd3'}`,
                            display:'flex', alignItems:'center', gap:4,
                          }}>
                            <div style={{ width:5, height:5, borderRadius:'50%', background:a.activo ? '#0d9488' : '#f43f5e' }} />
                            {a.activo ? 'Activo' : 'Inactivo'}
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                          <div style={{ fontSize:11, color:'#6b7280', display:'flex', flexWrap:'wrap' as const, gap:'4px 10px', flex:1, minWidth:0 }}>
                            <span style={{ fontWeight:600, color:'#374151' }}>CC {a.cedula}</span>
                            {a.telefono && <span>{a.telefono}</span>}
                            {isMaestrosView && (a as KidsMaestro).horario_servicio && (
                              <span style={{ color:'#3b82f6' }}>{(a as KidsMaestro).horario_servicio}</span>
                            )}
                            <span style={{ color:'#9ca3af' }}>Desde {formatDate(a.creado_en)}</span>
                          </div>
                          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                            {isMaestrosView && (
                              <IconButton title="Observaciones" onClick={() => setObsModal({ maestro: a as KidsMaestro, coordinador: null })} borderColor="#e0e7ff" bg="#f5f3ff">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.2" strokeLinecap="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                  <polyline points="14 2 14 8 20 8"/>
                                  <line x1="16" y1="13" x2="8" y2="13"/>
                                  <line x1="16" y1="17" x2="8" y2="17"/>
                                </svg>
                              </IconButton>
                            )}
                            <IconButton title="Editar" onClick={() => openEdit(a)} borderColor="#e0f2fe" bg="#f0fdfa">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </IconButton>
                            <IconButton title={a.activo ? 'Desactivar' : 'Ya inactivo'} onClick={() => !isDeleting && handleDelete(a)} borderColor="#fecdd3" bg="#fff5f5" disabled={isDeleting}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.2">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                                <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                            </IconButton>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  /* ── Desktop strip ── */
                  return (
                    <div
                      key={a.id}
                      style={{
                        display:'flex', alignItems:'center', gap:16, padding:'14px 18px',
                        borderRadius:16,
                        background: a.activo ? 'linear-gradient(135deg,#f8fffe,#f5f8ff)' : '#fafafa',
                        border: `1px solid ${a.activo ? 'rgba(13,148,136,.12)' : 'rgba(0,0,0,.06)'}`,
                        opacity: isDeleting ? .5 : 1, transition:'all .2s',
                      }}
                    >
                      <div style={{ flexShrink:0, boxShadow:`0 4px 12px ${a.activo ? 'rgba(13,148,136,.25)' : 'rgba(0,0,0,.1)'}`, borderRadius:14, overflow:'hidden' }}>
                        <AvatarImg src={a.foto_url} nombre={a.nombre} apellido={a.apellido} grad={gradient(idx)} size={44} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'#111827', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {a.nombre} {a.apellido}
                        </div>
                        <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>
                          {isMaestrosView ? ((a as KidsMaestro).grupo ?? 'Maestro Kids') : 'Administrador Kids'}
                        </div>
                      </div>
                      <Divider />
                      <InfoBlock label="Cédula" value={a.cedula} width={100} />
                      <Divider />
                      {isMaestrosView
                        ? <InfoBlock label="Horario"  value={(a as KidsMaestro).horario_servicio ?? '—'} width={130} />
                        : <InfoBlock label="Teléfono" value={a.telefono ?? '—'} width={110} />
                      }
                      <Divider />
                      <div style={{ minWidth:80, display:'flex', justifyContent:'center' }}>
                        <div style={{
                          padding:'5px 14px', borderRadius:50, fontSize:11, fontWeight:700,
                          background: a.activo ? 'linear-gradient(135deg,rgba(13,148,136,.12),rgba(8,145,178,.08))' : '#fef2f2',
                          color: a.activo ? '#0d9488' : '#f43f5e',
                          border: `1px solid ${a.activo ? 'rgba(13,148,136,.3)' : '#fecdd3'}`,
                          display:'flex', alignItems:'center', gap:5,
                        }}>
                          <div style={{ width:5, height:5, borderRadius:'50%', background:a.activo ? '#0d9488' : '#f43f5e' }} />
                          {a.activo ? 'Activo' : 'Inactivo'}
                        </div>
                      </div>
                      <div style={{ textAlign:'center', minWidth:80 }}>
                        <div style={{ fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:'1px' }}>Desde</div>
                        <div style={{ fontSize:11, color:'#6b7280', fontWeight:500, marginTop:2 }}>{formatDate(a.creado_en)}</div>
                      </div>
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        {/* Observaciones — solo en vista maestros */}
                        {isMaestrosView && (
                          <IconButton
                            title="Ver observaciones"
                            onClick={() => setObsModal({ maestro: a as KidsMaestro, coordinador: null })}
                            borderColor="#e0e7ff"
                            bg="#f5f3ff"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.2" strokeLinecap="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <line x1="16" y1="13" x2="8" y2="13"/>
                              <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                          </IconButton>
                        )}
                        <IconButton title="Editar" onClick={() => openEdit(a)} borderColor="#e0f2fe" bg="#f0fdfa">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </IconButton>
                        <IconButton title={a.activo ? 'Desactivar' : 'Ya inactivo'} onClick={() => !isDeleting && handleDelete(a)} borderColor="#fecdd3" bg="#fff5f5" disabled={isDeleting}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </IconButton>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>