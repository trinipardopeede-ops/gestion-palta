import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { MapPin, Map, Plus, Pencil, Archive, TreeDeciduous, Ruler, Droplets, Activity, Clock } from 'lucide-react'
import Modal from '../components/Modal'
import NuevaParcela from './NuevaParcela'
import NuevoSector from './NuevoSector'

function ConfiguracionCampo() {
  const [arbol, setArbol] = useState([]) // Estructura completa (Parcelas -> Sectores)
  const [loading, setLoading] = useState(true)

  // ESTADOS MODALES
  const [modalParcelaOpen, setModalParcelaOpen] = useState(false)
  const [modalSectorOpen, setModalSectorOpen] = useState(false)
  
  const [editParcelaId, setEditParcelaId] = useState(null)
  const [editSectorId, setEditSectorId] = useState(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      // 1. CARGAMOS SOLO LOS ACTIVOS
      const { data: parcelas } = await supabase
        .from('parcelas')
        .select('*')
        .eq('activo', true)
        .order('nombre')

      const { data: sectores } = await supabase
        .from('sectores')
        .select('*')
        .eq('activo', true)
        .order('nombre')

      if (parcelas && sectores) {
        // Armamos la estructura y calculamos totales
        const estructura = parcelas.map(p => {
            const misSectores = sectores.filter(s => s.parcela_id === p.id)
            
            // Cálculos acumulados
            const totalArboles = misSectores.reduce((acc, s) => acc + (s.cantidad_arboles || 0), 0)
            const totalHa = misSectores.reduce((acc, s) => acc + (s.superficie_ha || 0), 0)
            const totalAspersores = misSectores.reduce((acc, s) => acc + (s.cantidad_aspersores || 0), 0)
            
            // Calculamos caudal total en m3/h (L/h * cantidad / 1000)
            const totalCaudalLPH = misSectores.reduce((acc, s) => acc + ((s.cantidad_aspersores || 0) * (s.caudal_lph || 0)), 0)
            const totalCaudalM3 = totalCaudalLPH / 1000

            return {
                ...p,
                sectores: misSectores,
                stats: { 
                    arboles: totalArboles, 
                    has: totalHa,
                    aspersores: totalAspersores,
                    caudalM3: totalCaudalM3
                }
            }
        })
        setArbol(estructura)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = (setModal) => setModal(false)

  const abrirEditarParcela = (id) => { setEditParcelaId(id); setModalParcelaOpen(true) }
  const abrirEditarSector = (id) => { setEditSectorId(id); setModalSectorOpen(true) }

  // SOFT DELETE
  const archivarParcela = async (id) => {
      if(confirm("¿Archivar esta parcela? Desaparecerá de la lista principal pero se mantendrá en el historial.")) {
          const { error } = await supabase.from('parcelas').update({ activo: false }).eq('id', id)
          if (error) alert('Error al archivar: ' + error.message)
          else cargarDatos()
      }
  }

  const archivarSector = async (id) => {
      if(confirm("¿Archivar este sector?")) {
          const { error } = await supabase.from('sectores').update({ activo: false }).eq('id', id)
          if (error) alert('Error al archivar: ' + error.message)
          else cargarDatos()
      }
  }

  // Helper para calcular estado/edad del huerto
  const getEstadoHuerto = (anoPlantacion) => {
      if (!anoPlantacion) return { label: 'Sin info', color: '#9ca3af' }
      const antiguedad = new Date().getFullYear() - anoPlantacion
      
      if (antiguedad < 2) return { label: '🌱 Nuevo', color: '#10b981' } // Verde esmeralda
      if (antiguedad < 5) return { label: '🌿 Crecimiento', color: '#84cc16' } // Verde lima
      return { label: '🌳 Adulto', color: '#15803d' } // Verde oscuro
  }

  const styles = {
    container: { padding: '20px', maxWidth: '1200px', margin: '0 auto' },
    header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:30 },
    title: { fontSize:'1.5rem', fontWeight:'bold', color:'#1f2937', display:'flex', alignItems:'center', gap:10 },
    btnNew: { padding:'10px 20px', backgroundColor:'#1f2937', color:'white', borderRadius:'8px', border:'none', fontWeight:'bold', display:'flex', alignItems:'center', gap:8, cursor:'pointer' },
    
    parcelaContainer: { backgroundColor:'white', borderRadius:12, padding:20, marginBottom:30, border:'1px solid #e5e7eb', boxShadow:'0 2px 4px rgba(0,0,0,0.05)' },
    parcelaHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'2px solid #f3f4f6', paddingBottom:15, marginBottom:15, flexWrap: 'wrap', gap: 10 },
    parcelaTitle: { fontSize:'1.2rem', fontWeight:'bold', color:'#374151', display:'flex', alignItems:'center', gap:10, minWidth: '200px' },
    
    // Stats mejorados
    statsContainer: { display:'flex', gap:10, flexWrap:'wrap', flex: 1, justifyContent: 'flex-end', marginRight: 15 },
    statBadge: { display:'flex', alignItems:'center', gap:6, backgroundColor:'#f8fafc', padding:'6px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:'0.85rem', color:'#475569', fontWeight:500 },
    
    gridSectores: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:15 },
    sectorCard: { backgroundColor:'#f9fafb', padding:15, borderRadius:8, border:'1px solid #e5e7eb', position:'relative', display:'flex', flexDirection:'column', gap:8 },
    sectorHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start' },
    sectorName: { fontWeight:'bold', color:'#111827', fontSize:'1rem' },
    
    // Detalles del sector densos
    detailRow: { display:'flex', justifyContent:'space-between', fontSize:'0.85rem', color:'#4b5563', borderBottom:'1px dashed #e5e7eb', paddingBottom:4 },
    
    actions: { display:'flex', justifyContent:'flex-end', gap:8, marginTop:'auto', paddingTop:10 },
    btnIcon: { background:'none', border:'none', cursor:'pointer', color:'#6b7280' }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}><MapPin size={28}/> Configuración de Campo</h1>
        <div style={{display:'flex', gap:10}}>
             <button onClick={() => { setEditParcelaId(null); setModalParcelaOpen(true) }} style={{...styles.btnNew, backgroundColor:'white', color:'#374151', border:'1px solid #d1d5db'}}>
                <Map size={18}/> Nueva Parcela
             </button>
             <button onClick={() => { setEditSectorId(null); setModalSectorOpen(true) }} style={styles.btnNew}>
                <Plus size={18}/> Nuevo Sector
             </button>
        </div>
      </div>

      {arbol.map(p => (
        <div key={p.id} style={styles.parcelaContainer}>
            <div style={styles.parcelaHeader}>
                <div style={styles.parcelaTitle}>
                    <Map size={20} color="#4b5563"/> {p.nombre}
                </div>
                
                <div style={styles.statsContainer}>
                    <div style={styles.statBadge} title="Superficie Total">
                        <Ruler size={14}/> {p.stats.has.toFixed(1)} Ha
                    </div>
                    <div style={styles.statBadge} title="Total Árboles">
                        <TreeDeciduous size={14}/> {p.stats.arboles}
                    </div>
                    <div style={styles.statBadge} title="Total Aspersores">
                        <Droplets size={14}/> {p.stats.aspersores} asp
                    </div>
                    <div style={{...styles.statBadge, backgroundColor:'#eff6ff', borderColor:'#bfdbfe', color:'#1e40af'}} title="Capacidad de Riego Total">
                        <Activity size={14}/> {p.stats.caudalM3.toFixed(1)} m³/h
                    </div>
                </div>

                <div style={{display:'flex', gap:5}}>
                    <button onClick={() => abrirEditarParcela(p.id)} style={styles.btnIcon}><Pencil size={18}/></button>
                    <button onClick={() => archivarParcela(p.id)} style={{...styles.btnIcon, color:'#d97706'}} title="Archivar Parcela">
                        <Archive size={18}/>
                    </button>
                </div>
            </div>

            <div style={styles.gridSectores}>
                {p.sectores.length === 0 ? (
                    <div style={{color:'#9ca3af', fontStyle:'italic', padding:10}}>Sin sectores registrados.</div>
                ) : (
                    p.sectores.map(s => {
                        const ratio = s.cantidad_arboles > 0 ? (s.cantidad_aspersores / s.cantidad_arboles).toFixed(1) : '0'
                        const estado = getEstadoHuerto(s.ano_plantacion)

                        return (
                            <div key={s.id} style={styles.sectorCard}>
                                <div style={styles.sectorHeader}>
                                    <div>
                                        <div style={styles.sectorName}>{s.nombre}</div>
                                        <span style={{fontSize:'0.75rem', fontWeight:'bold', color: estado.color, backgroundColor:'#f0fdf4', padding:'2px 6px', borderRadius:4}}>
                                            {estado.label}
                                        </span>
                                    </div>
                                </div>
                                
                                <div>
                                    <div style={styles.detailRow}>
                                        <span><Ruler size={12} style={{marginRight:4, verticalAlign:'text-bottom'}}/> Superficie:</span>
                                        <strong>{s.superficie_ha} Ha</strong>
                                    </div>
                                    <div style={styles.detailRow}>
                                        <span><TreeDeciduous size={12} style={{marginRight:4, verticalAlign:'text-bottom'}}/> Plantas:</span>
                                        <strong>{s.cantidad_arboles} ({s.variedad})</strong>
                                    </div>
                                    <div style={styles.detailRow}>
                                        <span><Droplets size={12} style={{marginRight:4, verticalAlign:'text-bottom'}}/> Riego:</span>
                                        <strong>{ratio} asp/planta</strong>
                                    </div>
                                    <div style={{...styles.detailRow, borderBottom:'none', color:'#2563eb'}}>
                                        <span><Activity size={12} style={{marginRight:4, verticalAlign:'text-bottom'}}/> Caudal:</span>
                                        <strong>{s.caudal_lph} L/h</strong>
                                    </div>
                                </div>

                                <div style={styles.actions}>
                                    <button onClick={() => abrirEditarSector(s.id)} style={styles.btnIcon}><Pencil size={16}/></button>
                                    <button onClick={() => archivarSector(s.id)} style={{...styles.btnIcon, color:'#d97706'}} title="Archivar Sector">
                                        <Archive size={16}/>
                                    </button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
      ))}
      
      {arbol.length === 0 && !loading && <div style={{textAlign:'center', padding:'40px', color:'#6b7280'}}>No hay parcelas activas. Comienza creando una.</div>}

      <Modal isOpen={modalParcelaOpen} onClose={() => handleClose(setModalParcelaOpen)} title={editParcelaId ? "Editar Parcela" : "Nueva Parcela"}>
          {modalParcelaOpen && <NuevaParcela idParcela={editParcelaId} cerrarModal={() => setModalParcelaOpen(false)} alGuardar={() => { setModalParcelaOpen(false); cargarDatos(); }} />}
      </Modal>

      <Modal isOpen={modalSectorOpen} onClose={() => handleClose(setModalSectorOpen)} title={editSectorId ? "Editar Sector" : "Nuevo Sector"}>
          {modalSectorOpen && <NuevoSector idSector={editSectorId} cerrarModal={() => setModalSectorOpen(false)} alGuardar={() => { setModalSectorOpen(false); cargarDatos(); }} />}
      </Modal>

    </div>
  )
}
export default ConfiguracionCampo