import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { FileText, Plus, Pencil, Trash2, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import Modal from '../components/Modal'
import NuevaOferta from '../pages/NuevaOferta'

function OfertasComerciales() {
  const [ofertas, setOfertas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  
  // Estado para manejar expansiones de acordeón (Set de IDs expandidos)
  const [expandedIds, setExpandedIds] = useState(new Set())

  useEffect(() => { cargarOfertas() }, [])

  async function cargarOfertas() {
    setLoading(true)
    const { data, error } = await supabase
      .from('ofertas_comerciales')
      .select('*, clientes(nombre)')
      .order('activa', { ascending: false }) // Activas primero
      .order('created_at', { ascending: false })
    
    if (error) {
        console.error(error)
    } else {
        setOfertas(data || [])
        
        // --- CAMBIO: Expandir todos por defecto ---
        const allIds = new Set((data || []).map(offer => offer.id))
        setExpandedIds(allIds)
    }
    setLoading(false)
  }

  const toggleExpand = (id) => {
    const newSet = new Set(expandedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setExpandedIds(newSet)
  }

  const eliminarOferta = async (id, e) => {
      e.stopPropagation() // Evitar abrir acordeón
      if(confirm("¿Eliminar esta cotización?")) {
          await supabase.from('ofertas_comerciales').delete().eq('id', id)
          cargarOfertas()
      }
  }

  const handleEdit = (id, e) => {
      e.stopPropagation()
      setEditId(id)
      setModalOpen(true)
  }

  const styles = {
    // REGLA: Contenedor 90% ancho max 1400px
    container: { width: '90%', maxWidth: '1400px', margin: '0 auto', padding: '20px 0' },
    
    // REGLA: Encabezado Compacto
    header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, borderBottom:'1px solid #e5e7eb', paddingBottom:15 },
    titleSection: { display: 'flex', alignItems: 'center', gap: 12 },
    title: { fontSize:'1.5rem', fontWeight:'bold', color:'#111827', margin: 0 },
    subtitle: { fontSize:'0.9rem', color:'#6b7280' },
    
    btnNew: { padding:'8px 16px', backgroundColor:'#111827', color:'white', borderRadius:'6px', border:'none', fontWeight:'600', display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:'0.9rem' },
    
    // Grid de Tarjetas
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(350px, 1fr))', gap:20 },
    
    // Tarjeta
    card: { backgroundColor:'white', borderRadius:10, border:'1px solid #e5e7eb', boxShadow:'0 1px 3px rgba(0,0,0,0.05)', overflow:'hidden', transition: 'box-shadow 0.2s' },
    
    // Cabecera Tarjeta (Siempre visible)
    cardHeader: { padding: '15px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor: 'pointer', backgroundColor: '#fff' },
    cardTitleInfo: { display: 'flex', flexDirection: 'column' },
    clientName: { fontSize:'1rem', fontWeight:'bold', color:'#111827' },
    offerMeta: { fontSize:'0.8rem', color:'#6b7280', display: 'flex', gap: '8px', alignItems:'center', marginTop: '4px' },
    
    statusBadge: (active) => ({
        padding:'2px 8px', borderRadius:12, fontSize:'0.7rem', fontWeight:'bold', textTransform:'uppercase',
        backgroundColor: active ? '#dcfce7' : '#f3f4f6',
        color: active ? '#166534' : '#6b7280', border: active ? '1px solid #bbf7d0' : '1px solid #e5e7eb'
    }),

    // Contenido Expandible (Acordeón)
    expandableContent: { borderTop: '1px solid #f3f4f6', backgroundColor: '#f9fafb', padding: '15px' },
    
    // Tabla interna compacta
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
    th: { textAlign: 'left', padding: '8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' },
    td: { padding: '8px', borderBottom: '1px solid #e5e7eb', fontWeight: '500', color: '#374151' },
    tdPrice: { textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' },

    actions: { display:'flex', gap:8, alignItems:'center' }
  }

  return (
    <div style={styles.container}>
        <div style={styles.header}>
            <div style={styles.titleSection}>
                <h1 style={styles.title}>Ofertas & Precios</h1>
                <span style={styles.subtitle}>| Gestión Comercial</span>
            </div>
            <button onClick={() => { setEditId(null); setModalOpen(true) }} style={styles.btnNew}>
                <Plus size={16}/> Nueva Oferta
            </button>
        </div>

        {loading ? <div style={{textAlign:'center', padding:40, color:'#6b7280'}}>Cargando ofertas...</div> : (
            <div style={styles.grid}>
                {ofertas.map(of => {
                    const isOpen = expandedIds.has(of.id)
                    const precios = of.precios_json || []

                    return (
                        <div key={of.id} style={styles.card}>
                            {/* Cabecera Clickeable */}
                            <div style={styles.cardHeader} onClick={() => toggleExpand(of.id)}>
                                <div style={styles.cardTitleInfo}>
                                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                                        <span style={styles.clientName}>{of.clientes?.nombre || 'Sin Cliente'}</span>
                                        <span style={styles.statusBadge(of.activa)}>{of.activa ? 'Activa' : 'Inactiva'}</span>
                                    </div>
                                    <div style={styles.offerMeta}>
                                        <FileText size={12}/> {of.nombre || 'Cotización estándar'} 
                                        <span>•</span> 
                                        {new Date(of.fecha).toLocaleDateString('es-CL')}
                                    </div>
                                </div>
                                <div style={styles.actions}>
                                    <button onClick={(e) => handleEdit(of.id, e)} style={{border:'none', background:'none', cursor:'pointer', color:'#2563eb'}}>
                                        <Pencil size={16}/>
                                    </button>
                                    <button onClick={(e) => eliminarOferta(of.id, e)} style={{border:'none', background:'none', cursor:'pointer', color:'#ef4444'}}>
                                        <Trash2 size={16}/>
                                    </button>
                                    <div style={{color:'#9ca3af', marginLeft:5}}>
                                        {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                                    </div>
                                </div>
                            </div>

                            {/* Detalle Acordeón */}
                            {isOpen && (
                                <div style={styles.expandableContent}>
                                    {precios.length > 0 ? (
                                        <table style={styles.table}>
                                            <thead>
                                                <tr>
                                                    <th style={styles.th}>Calibre</th>
                                                    <th style={{...styles.th, textAlign:'right'}}>Precio Kilo</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {precios.map((p, idx) => (
                                                    <tr key={idx}>
                                                        <td style={styles.td}>{p.calibre}</td>
                                                        <td style={{...styles.td, ...styles.tdPrice}}>
                                                            $ {p.precio.toLocaleString('es-CL')}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p style={{fontStyle:'italic', color:'#9ca3af', fontSize:'0.85rem', textAlign:'center'}}>
                                            Sin precios definidos.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        )}

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? "Editar Cotización" : "Nueva Cotización"}>
            {modalOpen && (
                <NuevaOferta 
                    idOferta={editId}
                    cerrarModal={() => setModalOpen(false)}
                    alGuardar={() => { setModalOpen(false); cargarOfertas(); }}
                />
            )}
        </Modal>
    </div>
  )
}

export default OfertasComerciales