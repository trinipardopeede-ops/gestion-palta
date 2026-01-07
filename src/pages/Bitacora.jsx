import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { 
    StickyNote, Plus, Trash2, Calendar, Pencil, AlertTriangle, 
    Paperclip, CheckCircle2, Clock, ChevronDown, ChevronUp, 
    CheckSquare, Square, Save 
} from 'lucide-react'
import Modal from '../components/Modal'
import NuevaNota from './NuevaNota'

function Bitacora() {
  const [notas, setNotas] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Control de acordeón
  const [expandedIds, setExpandedIds] = useState(new Set())

  // Estado para inputs de "Nueva Tarea Rápida" (Mapa: ID Nota -> Texto Input)
  const [inputStates, setInputStates] = useState({})

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('Todos') 

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [notaEditar, setNotaEditar] = useState(null)

  useEffect(() => { cargarNotas() }, [])

  async function cargarNotas() {
    setLoading(true)
    const { data } = await supabase.from('bitacora').select('*').order('created_at', { ascending: false })
    setNotas(data || [])
    setLoading(false)
  }

  const borrarNota = async (id, e) => {
      e.stopPropagation()
      if(confirm("¿Eliminar esta nota permanentemente?")) {
          await supabase.from('bitacora').delete().eq('id', id)
          cargarNotas()
      }
  }

  const toggleExpand = (id, e) => {
      e.stopPropagation()
      const newSet = new Set(expandedIds)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      setExpandedIds(newSet)
  }

  // --- LÓGICA TAREAS ---

  // 1. Marcar completado
  const toggleTarea = async (nota, tareaId, e) => {
      e.stopPropagation() 

      const nuevoChecklist = nota.checklist.map(item => 
          item.id === tareaId ? { ...item, hecho: !item.hecho } : item
      )

      // Optimista
      setNotas(prev => prev.map(n => n.id === nota.id ? { ...n, checklist: nuevoChecklist } : n))

      await supabase.from('bitacora').update({ checklist: nuevoChecklist }).eq('id', nota.id)
  }

  // 2. Manejar Input de Nueva Tarea
  const handleInputChange = (id, valor) => {
      setInputStates(prev => ({ ...prev, [id]: valor }))
  }

  // 3. Agregar Tarea Directamente
  const addTareaDirecta = async (nota, e) => {
      e.preventDefault()
      e.stopPropagation()

      const texto = inputStates[nota.id]
      if (!texto || !texto.trim()) return

      const nuevaTarea = {
          id: Date.now(),
          texto: texto,
          hecho: false
      }

      const nuevoChecklist = [...(nota.checklist || []), nuevaTarea]

      // Optimista
      setNotas(prev => prev.map(n => n.id === nota.id ? { ...n, checklist: nuevoChecklist } : n))
      
      // Limpiar input
      setInputStates(prev => ({ ...prev, [nota.id]: '' }))

      // Guardar BD
      const { error } = await supabase.from('bitacora').update({ checklist: nuevoChecklist }).eq('id', nota.id)
      
      if (error) {
          console.error(error)
          cargarNotas() // Revertir si falla
      }
  }

  // --- FILTROS Y UI ---

  const getNotasFiltradas = () => {
      if (filtroTipo === 'Todos') return notas
      if (filtroTipo === 'Importante') return notas.filter(n => n.importante)
      return notas.filter(n => n.tipo === filtroTipo)
  }

  const formatDate = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
  }

  const styles = {
    container: { width: '90%', maxWidth: '1000px', margin: '0 auto', padding: '20px 0' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    title: { fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', display:'flex', alignItems:'center', gap:10 },
    tabs: { display: 'flex', gap: 8, marginBottom: 30, flexWrap:'wrap' },
    tab: (active, isAlert) => ({
        padding: '6px 14px', borderRadius: '20px', border: active ? '1px solid transparent' : '1px solid #e5e7eb',
        cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
        backgroundColor: active ? (isAlert ? '#fee2e2' : '#1f2937') : 'white',
        color: active ? (isAlert ? '#991b1b' : 'white') : '#4b5563',
        transition: 'all 0.2s', display:'flex', alignItems:'center', gap:6
    }),
    timeline: { position: 'relative', borderLeft: '2px solid #e5e7eb', marginLeft: '20px', paddingLeft: '30px' },
    itemWrapper: { marginBottom: '30px', position: 'relative' },
    dot: (tipo) => ({
        position: 'absolute', left: '-39px', top: '15px', width: '16px', height: '16px', borderRadius: '50%',
        backgroundColor: tipo === 'Incidente' ? '#ef4444' : (tipo === 'Hito' ? '#3b82f6' : '#10b981'),
        border: '4px solid #f3f4f6'
    }),
    card: (importante) => ({
        backgroundColor: 'white', borderRadius: '12px', 
        border: importante ? '1px solid #fecaca' : '1px solid #e5e7eb',
        boxShadow: importante ? '0 4px 6px -1px rgba(220, 38, 38, 0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
        overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s'
    }),
    cardHeader: { padding: '15px', borderBottom: '1px solid #f9fafb', display:'flex', justifyContent:'space-between', alignItems:'start' },
    cardBody: { padding: '15px', color: '#374151', fontSize: '0.95rem', whiteSpace: 'pre-line' },
    badge: { fontSize:'0.7rem', textTransform:'uppercase', fontWeight:'bold', padding:'2px 8px', borderRadius:'10px', backgroundColor:'#f3f4f6', color:'#4b5563' },
    dateTag: { fontSize:'0.8rem', color:'#6b7280', display:'flex', alignItems:'center', gap:5 },
    cardFooter: { 
        padding: '10px 15px', backgroundColor: '#f9fafb', display:'flex', justifyContent:'space-between', alignItems:'center', 
        fontSize:'0.8rem', color:'#6b7280', borderTop: '1px solid #f3f4f6' 
    },
    expandedArea: { padding: '15px', backgroundColor: '#fff', borderTop: '1px solid #f3f4f6' },
    
    checkRow: { 
        display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8, fontSize: '0.9rem',
        cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: 'background 0.1s'
    },
    adjuntoLink: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', backgroundColor: '#f3f4f6', borderRadius: '4px', fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none', marginRight: 10, marginBottom: 5 },
    
    // Input rápido
    quickAddRow: { display: 'flex', gap: 8, marginTop: 15, paddingTop: 10, borderTop: '1px dashed #e5e7eb' },
    quickInput: { flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' },
    quickBtn: { padding: '6px 12px', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }
  }

  const notasFiltradas = getNotasFiltradas()

  return (
    <div style={styles.container}>
        <div style={styles.header}>
            <h1 style={styles.title}><StickyNote size={28}/> Bitácora de Campo</h1>
            <button 
                onClick={() => { setNotaEditar(null); setModalOpen(true) }}
                style={{ backgroundColor:'#1f2937', color:'white', border:'none', padding:'10px 20px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}
            >
                <Plus size={18}/> Nueva Nota
            </button>
        </div>

        <div style={styles.tabs}>
            <button onClick={() => setFiltroTipo('Todos')} style={styles.tab(filtroTipo === 'Todos')}>Todas</button>
            <button onClick={() => setFiltroTipo('Importante')} style={styles.tab(filtroTipo === 'Importante', true)}>
                <AlertTriangle size={14}/> Importantes
            </button>
            <button onClick={() => setFiltroTipo('Incidente')} style={styles.tab(filtroTipo === 'Incidente')}>Incidentes</button>
            <button onClick={() => setFiltroTipo('Tarea')} style={styles.tab(filtroTipo === 'Tarea')}>Tareas</button>
        </div>

        <div style={styles.timeline}>
            {loading ? <div style={{color:'#6b7280'}}>Cargando bitácora...</div> : notasFiltradas.map(nota => {
                const isExpanded = expandedIds.has(nota.id)
                const totalCheck = nota.checklist ? nota.checklist.length : 0
                const doneCheck = nota.checklist ? nota.checklist.filter(c => c.hecho).length : 0
                const totalAdjuntos = nota.adjuntos ? nota.adjuntos.length : 0
                const tieneExtras = totalCheck > 0 || totalAdjuntos > 0

                return (
                    <div key={nota.id} style={styles.itemWrapper}>
                        <div style={styles.dot(nota.tipo)}></div>
                        
                        <div style={styles.card(nota.importante)} onClick={() => { setNotaEditar(nota); setModalOpen(true) }}>
                            {/* HEADER */}
                            <div style={styles.cardHeader}>
                                <div>
                                    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:5}}>
                                        {nota.importante && <AlertTriangle size={16} color="#dc2626"/>}
                                        <h3 style={{margin:0, fontSize:'1.1rem', color:'#111827'}}>{nota.titulo}</h3>
                                    </div>
                                    <div style={{display:'flex', gap:8}}>
                                        <span style={styles.badge}>{nota.tipo}</span>
                                        <span style={styles.dateTag}><Calendar size={12}/> {formatDate(nota.fecha || nota.created_at)}</span>
                                        {nota.fecha_alerta && (
                                            <span style={{...styles.dateTag, color:'#d97706'}}><Clock size={12}/> Vence: {formatDate(nota.fecha_alerta)}</span>
                                        )}
                                    </div>
                                </div>
                                <div style={{display:'flex', gap:5}}>
                                    <button onClick={(e) => { e.stopPropagation(); setNotaEditar(nota); setModalOpen(true) }} style={{border:'none', background:'none', color:'#2563eb', cursor:'pointer'}}><Pencil size={16}/></button>
                                    <button onClick={(e) => borrarNota(nota.id, e)} style={{border:'none', background:'none', color:'#ef4444', cursor:'pointer'}}><Trash2 size={16}/></button>
                                </div>
                            </div>
                            
                            {/* BODY */}
                            {nota.contenido && (
                                <div style={styles.cardBody}>
                                    {nota.contenido.length > 150 && !isExpanded ? nota.contenido.substring(0, 150) + '...' : nota.contenido}
                                </div>
                            )}

                            {/* EXPANDED AREA */}
                            {isExpanded && (
                                <div style={styles.expandedArea} onClick={(e) => e.stopPropagation()}>
                                    
                                    {/* LISTA DE TAREAS */}
                                    {(totalCheck > 0 || true) && ( // Siempre visible para poder agregar tareas nuevas
                                        <div style={{marginBottom: 15}}>
                                            {totalCheck > 0 && (
                                                <div style={{fontSize:'0.75rem', fontWeight:'bold', color:'#9ca3af', marginBottom:8, textTransform:'uppercase'}}>Lista de Tareas</div>
                                            )}
                                            
                                            {nota.checklist && nota.checklist.map(item => (
                                                <div 
                                                    key={item.id} 
                                                    style={styles.checkRow}
                                                    onClick={(e) => toggleTarea(nota, item.id, e)}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    {item.hecho ? <CheckSquare size={18} color="#10b981"/> : <Square size={18} color="#d1d5db"/>}
                                                    <span style={{textDecoration: item.hecho ? 'line-through' : 'none', color: item.hecho ? '#9ca3af' : '#374151'}}>
                                                        {item.texto}
                                                    </span>
                                                </div>
                                            ))}

                                            {/* INPUT RÁPIDO PARA NUEVA TAREA */}
                                            <div style={styles.quickAddRow}>
                                                <input 
                                                    type="text" 
                                                    placeholder="Agregar tarea rápida..." 
                                                    value={inputStates[nota.id] || ''}
                                                    onChange={(e) => handleInputChange(nota.id, e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && addTareaDirecta(nota, e)}
                                                    onClick={(e) => e.stopPropagation()} 
                                                    style={styles.quickInput}
                                                />
                                                <button onClick={(e) => addTareaDirecta(nota, e)} style={styles.quickBtn}>
                                                    <Plus size={16} color="#4b5563"/>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* LISTA ADJUNTOS */}
                                    {totalAdjuntos > 0 && (
                                        <div>
                                            <div style={{fontSize:'0.75rem', fontWeight:'bold', color:'#9ca3af', marginBottom:8, textTransform:'uppercase'}}>Archivos Adjuntos</div>
                                            <div style={{display:'flex', flexWrap:'wrap'}}>
                                                {nota.adjuntos.map((file, idx) => (
                                                    <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer" style={styles.adjuntoLink}>
                                                        <Paperclip size={14}/> {file.nombre}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* FOOTER */}
                            <div style={styles.cardFooter} onClick={(e) => toggleExpand(nota.id, e)}>
                                <div style={{display:'flex', gap:15}}>
                                    {(totalCheck > 0) ? (
                                        <div style={{display:'flex', alignItems:'center', gap:5, color: doneCheck === totalCheck ? '#059669' : '#6b7280'}}>
                                            <CheckCircle2 size={14}/> {doneCheck}/{totalCheck} Tareas
                                        </div>
                                    ) : (
                                        <div style={{color:'#9ca3af'}}>Sin tareas</div>
                                    )}
                                    {totalAdjuntos > 0 && (
                                        <div style={{display:'flex', alignItems:'center', gap:5}}>
                                            <Paperclip size={14}/> {totalAdjuntos}
                                        </div>
                                    )}
                                </div>
                                
                                <div style={{display:'flex', alignItems:'center', gap:5, cursor:'pointer', fontWeight:'bold', color:'#374151'}}>
                                    {isExpanded ? 'Contraer' : 'Ver / Añadir'}
                                    {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                </div>
                            </div>

                        </div>
                    </div>
                )
            })}
            
            {notasFiltradas.length === 0 && !loading && (
                <div style={{padding:'20px', color:'#9ca3af', fontStyle:'italic'}}>No se encontraron registros.</div>
            )}
        </div>

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={notaEditar ? "Editar Nota" : "Nueva Entrada"}>
            {modalOpen && (
                <NuevaNota 
                    notaEditar={notaEditar} 
                    cerrarModal={() => setModalOpen(false)} 
                    alGuardar={() => { setModalOpen(false); cargarNotas(); }}
                />
            )}
        </Modal>
    </div>
  )
}

export default Bitacora