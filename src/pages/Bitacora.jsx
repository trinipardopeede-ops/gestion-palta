import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { 
    StickyNote, Plus, Trash2, Calendar, Pencil, AlertTriangle, 
    Paperclip, CheckCircle2, Clock, ChevronDown, ChevronUp, 
    CheckSquare, Square, Archive, RotateCcw
} from 'lucide-react'
import Modal from '../components/Modal'
import NuevaNota from './NuevaNota'

function Bitacora() {
  const [notas, setNotas] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [filtroTipo, setFiltroTipo] = useState('Activas') 
  const [modalOpen, setModalOpen] = useState(false)
  const [notaEditar, setNotaEditar] = useState(null)

  useEffect(() => { cargarNotas() }, [])

  async function cargarNotas() {
    setLoading(true)
    const { data } = await supabase
        .from('bitacora')
        .select('*')
        .eq('activo', true)
        .order('created_at', { ascending: false })
    setNotas(data || [])
    setLoading(false)
  }

  const toggleArchivar = async (id, estadoActual, e) => {
      e.stopPropagation()
      const { error } = await supabase
          .from('bitacora')
          .update({ archivado: !estadoActual })
          .eq('id', id)
      if (!error) cargarNotas()
  }

  const borrarNota = async (id, e) => {
      e.stopPropagation()
      if(confirm("¿Eliminar permanentemente?")) {
          await supabase.from('bitacora').update({ activo: false }).eq('id', id)
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

  const toggleTarea = async (nota, tareaId, e) => {
      e.stopPropagation() 
      const nuevoChecklist = nota.checklist.map(item => 
          item.id === tareaId ? { ...item, hecho: !item.hecho } : item
      )
      setNotas(prev => prev.map(n => n.id === nota.id ? { ...n, checklist: nuevoChecklist } : n))
      await supabase.from('bitacora').update({ checklist: nuevoChecklist }).eq('id', nota.id)
  }

  const formatDate = (dateString) => {
      if (!dateString) return '-'
      const [year, month, day] = dateString.split('T')[0].split('-')
      return `${day}/${month}/${year}`
  }

  const getNotasFiltradas = () => {
      let base = (filtroTipo === 'Archivados') 
          ? notas.filter(n => n.archivado) 
          : notas.filter(n => !n.archivado)

      if (filtroTipo === 'Activas' || filtroTipo === 'Archivados') return base
      if (filtroTipo === 'Importante') return base.filter(n => n.importante)
      return base.filter(n => n.tipo === filtroTipo)
  }

  const styles = {
    container: { width: '90%', maxWidth: '1000px', margin: '0 auto', padding: '20px 0' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    title: { fontSize: '1.5rem', fontWeight: 'bold', display:'flex', alignItems:'center', gap:10 },
    tabs: { display: 'flex', gap: 8, marginBottom: 25 },
    tab: (active, color) => ({
        padding: '8px 16px', borderRadius: '20px', border: active ? 'none' : '1px solid #e5e7eb',
        cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
        backgroundColor: active ? color : 'white', color: active ? 'white' : '#6b7280',
        display:'flex', alignItems:'center', gap:6
    }),
    card: (imp, arc) => ({
        backgroundColor: arc ? '#f9fafb' : 'white', borderRadius: '12px', marginBottom: 20,
        border: imp ? '1px solid #fecaca' : '1px solid #e5e7eb', opacity: arc ? 0.7 : 1
    }),
    badge: { fontSize:'0.7rem', fontWeight:'bold', padding:'2px 8px', borderRadius:'10px', backgroundColor:'#f3f4f6', color:'#4b5563' }
  }

  return (
    <div style={styles.container}>
        <div style={styles.header}>
            <h1 style={styles.title}><StickyNote size={28}/> Bitácora</h1>
            <button onClick={() => { setNotaEditar(null); setModalOpen(true) }} style={{ backgroundColor:'#111827', color:'white', border:'none', padding:'10px 20px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer' }}>
                + Nueva Nota
            </button>
        </div>

        <div style={styles.tabs}>
            <button onClick={() => setFiltroTipo('Activas')} style={styles.tab(filtroTipo === 'Activas', '#111827')}>Activas</button>
            <button onClick={() => setFiltroTipo('Importante')} style={styles.tab(filtroTipo === 'Importante', '#dc2626')}><AlertTriangle size={14}/> Importantes</button>
            <button onClick={() => setFiltroTipo('Archivados')} style={styles.tab(filtroTipo === 'Archivados', '#6b7280')}><Archive size={14}/> Archivados</button>
        </div>

        {loading ? <p>Cargando...</p> : getNotasFiltradas().map(nota => (
            <div key={nota.id} style={styles.card(nota.importante, nota.archivado)}>
                <div style={{padding:15, display:'flex', justifyContent:'space-between', borderBottom:'1px solid #f9fafb'}}>
                    <div>
                        <h3 style={{margin:0, fontSize:'1.1rem'}}>{nota.titulo}</h3>
                        <div style={{display:'flex', gap:10, marginTop:5}}>
                            <span style={styles.badge}>{nota.tipo}</span>
                            <span style={{fontSize:'0.8rem', color:'#6b7280'}}>{formatDate(nota.fecha)}</span>
                        </div>
                    </div>
                    <div style={{display:'flex', gap:10}}>
                        <button onClick={(e) => toggleArchivar(nota.id, nota.archivado, e)} title="Archivar/Restaurar" style={{background:'none', border:'none', cursor:'pointer', color:'#6b7280'}}>
                            {nota.archivado ? <RotateCcw size={18}/> : <Archive size={18}/>}
                        </button>
                        <button onClick={() => { setNotaEditar(nota); setModalOpen(true) }} style={{background:'none', border:'none', cursor:'pointer', color:'#2563eb'}}><Pencil size={18}/></button>
                        <button onClick={(e) => borrarNota(nota.id, e)} style={{background:'none', border:'none', cursor:'pointer', color:'#ef4444'}}><Trash2 size={18}/></button>
                    </div>
                </div>

                <div style={{padding:15, cursor:'pointer'}} onClick={(e) => toggleExpand(nota.id, e)}>
                    <p style={{margin:0, color:'#374151', whiteSpace:'pre-line'}}>{nota.contenido}</p>
                    
                    {expandedIds.has(nota.id) && (
                        <div style={{marginTop:15, borderTop:'1px dashed #e5e7eb', paddingTop:15}}>
                            {nota.checklist?.map(item => (
                                <div key={item.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, padding:8, backgroundColor:'#f9fafb', borderRadius:6}} onClick={(e) => toggleTarea(nota, item.id, e)}>
                                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                                        {item.hecho ? <CheckSquare size={18} color="#059669"/> : <Square size={18} color="#d1d5db"/>}
                                        <span style={{textDecoration: item.hecho ? 'line-through' : 'none', fontWeight:'bold'}}>{item.texto}</span>
                                    </div>
                                    {item.fecha_vencimiento && (
                                        <span style={{fontSize:'0.75rem', color:'#d97706', display:'flex', alignItems:'center', gap:4}}>
                                            <Clock size={12}/> {formatDate(item.fecha_vencimiento)}
                                        </span>
                                    )}
                                </div>
                            ))}
                            {nota.adjuntos?.map((f, i) => (
                                <a key={i} href={f.url} target="_blank" rel="noreferrer" style={{display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', backgroundColor:'#eff6ff', borderRadius:15, fontSize:'0.75rem', color:'#1d4ed8', textDecoration:'none', marginRight:8, marginTop:10}}>
                                    <Paperclip size={12}/> {f.nombre}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        ))}

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={notaEditar ? "Editar Nota" : "Nueva Nota"}>
            {modalOpen && <NuevaNota notaEditar={notaEditar} cerrarModal={() => setModalOpen(false)} alGuardar={() => {setModalOpen(false); cargarNotas();}} />}
        </Modal>
    </div>
  )
}

export default Bitacora