import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Droplets, Clock, Settings, PlayCircle, History, TreeDeciduous, ShowerHead } from 'lucide-react'
import Modal from '../components/Modal'
import NuevoPrograma from './NuevoPrograma'

// Helper para moneda (por si se usa en el futuro o en otras partes)
const formatMoney = (amount) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount)
}

// Helper para números con miles (Chile)
const formatNumber = (num) => {
    if (num === undefined || num === null) return '--'
    return new Intl.NumberFormat('es-CL').format(Math.round(num))
}

function Riego() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('activos')

  // DATA
  const [sectoresAgrupados, setSectoresAgrupados] = useState({})
  const [historialProgramas, setHistorialProgramas] = useState([])
  
  // FILTROS HISTORIAL
  const [anioFiltro, setAnioFiltro] = useState('') 
  const [orden, setOrden] = useState({ campo: 'fecha_creacion', asc: false })

  // MODAL
  const [modalOpen, setModalOpen] = useState(false)
  const [sectorIdParaEditar, setSectorIdParaEditar] = useState(null)

  useEffect(() => { cargarDatos() }, [])
  useEffect(() => { if (activeTab === 'historial') cargarHistorial() }, [activeTab, anioFiltro])

  async function cargarDatos() {
    setLoading(true)
    try {
        const { data: sectoresBD } = await supabase
            .from('sectores')
            .select(`*, parcelas ( nombre )`)
            .order('nombre')
        
        const { data: programasActivos } = await supabase
            .from('programas_riego')
            .select('*')
            .neq('estado', 'Finalizado')

        const sectoresProcesados = sectoresBD.map(s => {
            const miPrograma = programasActivos?.find(p => {
                 if (p.sector_id && Number(p.sector_id) === Number(s.id)) return true;
                 if (p.sectores_ids && Array.isArray(p.sectores_ids) && p.sectores_ids.includes(s.id)) return true;
                 return false;
            })

            const caudalAspersor = s.caudal_lph || 0
            const numAspersores = s.cantidad_aspersores || 0
            const caudalTotalLph = caudalAspersor * numAspersores
            
            let litrosSemana = 0
            if (miPrograma && miPrograma.turnos && caudalTotalLph > 0) {
                let minutosSemana = 0
                const dias = miPrograma.dias?.length || 0
                const misTurnos = miPrograma.turnos.filter(t => !t.sector_id || Number(t.sector_id) === Number(s.id))
                misTurnos.forEach(t => { minutosSemana += (parseInt(t.duracion) || 0) * dias })
                litrosSemana = (caudalTotalLph / 60) * minutosSemana
            }

            return { ...s, programa: miPrograma, caudalTotalLph, litrosSemana }
        })

        const agrupados = sectoresProcesados.reduce((acc, sector) => {
            const nombreParcela = sector.parcelas?.nombre || 'Sin Parcela Asignada'
            if (!acc[nombreParcela]) acc[nombreParcela] = []
            acc[nombreParcela].push(sector)
            return acc
        }, {})

        setSectoresAgrupados(agrupados)
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  async function cargarHistorial() {
      let query = supabase
          .from('programas_riego')
          .select(`*, sectores ( nombre, caudal_lph, cantidad_aspersores, parcelas (nombre) )`)
          .eq('estado', 'Finalizado')
      
      if (anioFiltro) {
          const inicioAnio = `${anioFiltro}-01-01`
          const finAnio = `${anioFiltro}-12-31`
          query = query.gte('fecha_creacion', inicioAnio).lte('fecha_creacion', finAnio)
      }

      const { data, error } = await query
      if (error) console.error(error)
      else setHistorialProgramas(data)
  }

  const handleSort = (campo) => {
      const isAsc = orden.campo === campo ? !orden.asc : true
      setOrden({ campo, asc: isAsc })
      const sorted = [...historialProgramas].sort((a, b) => {
          let valA = a[campo]; let valB = b[campo];
          if (campo === 'sector_id') { valA = a.sectores?.nombre; valB = b.sectores?.nombre }
          
          if (valA < valB) return isAsc ? -1 : 1
          if (valA > valB) return isAsc ? 1 : -1
          return 0
      })
      setHistorialProgramas(sorted)
  }

  const configurarSector = (idSector) => {
      setSectorIdParaEditar(idSector)
      setModalOpen(true)
  }

  const calcularVolumenTurno = (duracionMin, caudalTotalLph) => {
      if (!duracionMin || !caudalTotalLph) return '--'
      const m3 = (caudalTotalLph / 60 * duracionMin) / 1000
      return `${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(m3)} m³`
  }

  const styles = {
    container: { width: '90%', maxWidth: '1400px', margin: '0 auto', padding: '10px 20px' },
    
    header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px', height: '50px' },
    title: { fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', display:'flex', alignItems:'center', gap:10, margin:0 },
    
    tabsContainer: { display:'flex', gap:5, backgroundColor:'#f3f4f6', padding:4, borderRadius:8 },
    tab: (active) => ({
        padding:'6px 16px', cursor:'pointer', borderRadius:6,
        backgroundColor: active ? 'white' : 'transparent',
        color: active ? '#2563eb' : '#6b7280', 
        fontWeight: active ? 'bold' : 'normal', display:'flex', gap:6, alignItems:'center',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
        fontSize: '0.9rem', transition: 'all 0.2s'
    }),

    // CARDS
    parcelaSection: { marginBottom: 30 },
    parcelaTitle: { fontSize:'1.1rem', fontWeight:'bold', color:'#4b5563', marginBottom:10, borderLeft:'4px solid #10b981', paddingLeft:10 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '15px' },
    
    card: { backgroundColor: 'white', borderRadius: '12px', padding: '15px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
    cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 },
    sectorName: { fontSize:'1.1rem', fontWeight:'bold', color:'#374151' },
    activeBadge: { backgroundColor:'#dcfce7', color:'#166534', padding:'2px 8px', borderRadius:'12px', fontSize:'0.7rem', fontWeight:'bold', display:'flex', alignItems:'center', gap:4 },
    inactiveBadge: { backgroundColor:'#f3f4f6', color:'#6b7280', padding:'2px 8px', borderRadius:'12px', fontSize:'0.7rem', fontWeight:'bold' },
    
    metaInfo: { display:'flex', gap:15, fontSize:'0.8rem', color:'#64748b', marginBottom:10 },
    metrics: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, backgroundColor:'#f8fafc', padding:8, borderRadius:6, margin:'10px 0' },
    metricItem: { display:'flex', flexDirection:'column' },
    metricLabel: { fontSize:'0.7rem', color:'#64748b' },
    metricValue: { fontSize:'0.85rem', fontWeight:'bold', color:'#334155' },

    schedule: { marginTop:10, borderTop:'1px dashed #e2e8f0', paddingTop:8 },
    turnRow: { display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.85rem', marginBottom:6, color:'#475569', backgroundColor:'#f9fafb', padding:'4px 8px', borderRadius:4 },
    btnConfig: { width:'100%', marginTop:10, padding:'8px', backgroundColor:'#2563eb', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'500', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:'0.9rem' },

    // HISTORIAL TABLE (Compacta y Reordenada)
    // Orden: Fecha | Parcela | Sector | Días | Caudal Req | Riego Est. | Vigencia | Turnos
    tableContainer: { backgroundColor:'white', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden', marginTop:10 },
    tableHeader: { backgroundColor:'#f9fafb', padding:'10px', fontWeight:'bold', display:'grid', gridTemplateColumns:'0.9fr 0.8fr 0.8fr 1.2fr 0.7fr 0.7fr 1.1fr 1fr', cursor:'pointer', fontSize:'0.8rem', color:'#4b5563', gap:'10px' },
    tableRow: { padding:'10px', display:'grid', gridTemplateColumns:'0.9fr 0.8fr 0.8fr 1.2fr 0.7fr 0.7fr 1.1fr 1fr', borderTop:'1px solid #f3f4f6', fontSize:'0.8rem', color:'#374151', alignItems:'center', gap:'10px' },
    filters: { display:'flex', gap:10, marginBottom:15, alignItems:'center', justifyContent:'flex-end' },
    select: { padding:'6px', borderRadius:6, border:'1px solid #d1d5db' }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}><Droplets color="#3b82f6" size={28}/> Control de Riego</h1>
        
        <div style={styles.tabsContainer}>
            <div style={styles.tab(activeTab === 'activos')} onClick={() => setActiveTab('activos')}>
                <PlayCircle size={16}/> Programación Activa
            </div>
            <div style={styles.tab(activeTab === 'historial')} onClick={() => setActiveTab('historial')}>
                <History size={16}/> Historial
            </div>
        </div>
      </div>

      {activeTab === 'activos' && (
          loading ? <div>Cargando...</div> : (
            <div>
                {Object.keys(sectoresAgrupados).length === 0 && <div style={{color:'#6b7280'}}>No hay sectores configurados.</div>}
                
                {Object.entries(sectoresAgrupados).map(([parcela, sectoresParcela]) => (
                    <div key={parcela} style={styles.parcelaSection}>
                        <div style={styles.parcelaTitle}>{parcela}</div>
                        
                        <div style={styles.grid}>
                            {sectoresParcela.map(s => (
                                <div key={s.id} style={styles.card}>
                                    <div style={styles.cardHeader}>
                                        <div style={styles.sectorName}>{s.nombre}</div>
                                        {s.programa ? (
                                            <span style={styles.activeBadge}><PlayCircle size={10}/> ACTIVO</span>
                                        ) : (
                                            <span style={styles.inactiveBadge}>DETENIDO</span>
                                        )}
                                    </div>

                                    <div style={styles.metaInfo}>
                                        <span title="Cantidad de Árboles"><TreeDeciduous size={14}/> {formatNumber(s.cantidad_arboles)}</span>
                                        <span title="Total Aspersores"><ShowerHead size={14}/> {formatNumber(s.cantidad_aspersores)}</span>
                                    </div>

                                    <div style={styles.metrics}>
                                        <div style={styles.metricItem}>
                                            <span style={styles.metricLabel}>Caudal Sector</span>
                                            <span style={styles.metricValue}>
                                                {s.caudalTotalLph > 0 ? `${formatNumber(s.caudalTotalLph/1000)} m³/h` : '--'}
                                            </span>
                                        </div>
                                        <div style={styles.metricItem}>
                                            <span style={styles.metricLabel}>Semanal (Est.)</span>
                                            <span style={styles.metricValue}>
                                                {s.litrosSemana > 0 ? `${formatNumber(s.litrosSemana/1000)} m³` : '--'}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={styles.schedule}>
                                        {s.programa ? (
                                            <>
                                                <div style={{fontSize:'0.8rem', fontWeight:'bold', marginBottom:8, color:'#3b82f6'}}>
                                                    {s.programa.dias?.map(d => d.slice(0,3)).join(', ')}
                                                </div>
                                                {s.programa.turnos?.map((t, i) => (
                                                    <div key={i} style={styles.turnRow}>
                                                        <span style={{flex:1}}><Clock size={12} style={{marginRight:4}}/> Turno {i+1}</span>
                                                        <span style={{flex:1, textAlign:'center', fontWeight:'bold', color:'#059669', fontSize:'0.8rem'}}>
                                                            {calcularVolumenTurno(t.duracion, s.caudalTotalLph)}
                                                        </span>
                                                        <span style={{flex:1, textAlign:'right', fontWeight:'bold'}}>
                                                            {t.hora} ({t.duracion}')
                                                        </span>
                                                    </div>
                                                ))}
                                            </>
                                        ) : (
                                            <div style={{textAlign:'center', padding:5, color:'#9ca3af', fontSize:'0.8rem', fontStyle:'italic'}}>
                                                Sin programación
                                            </div>
                                        )}
                                    </div>

                                    <button onClick={() => configurarSector(s.id)} style={styles.btnConfig}>
                                        <Settings size={14}/> Configurar
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
          )
      )}

      {activeTab === 'historial' && (
          <div>
            <div style={styles.filters}>
                <label style={{fontSize:'0.85rem', color:'#4b5563'}}>Filtrar Año:</label>
                <select 
                    value={anioFiltro} 
                    onChange={(e) => setAnioFiltro(e.target.value)}
                    style={styles.select}
                >
                    <option value="">Todos</option>
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            <div style={styles.tableContainer}>
                <div style={styles.tableHeader}>
                    <div onClick={() => handleSort('fecha_creacion')}>Fecha</div>
                    <div onClick={() => handleSort('parcela_id')}>Parcela</div>
                    <div onClick={() => handleSort('sector_id')}>Sector</div>
                    <div>Días</div>
                    <div>Caudal Req.</div>
                    <div>Riego Est.</div>
                    <div>Vigencia</div>
                    <div>Turnos</div>
                </div>
                {historialProgramas.length === 0 ? (
                     <div style={{padding:20, textAlign:'center', color:'#6b7280'}}>No hay registros históricos.</div>
                ) : (
                    historialProgramas.map(prog => {
                        const caudalSectorLph = (prog.sectores?.caudal_lph || 0) * (prog.sectores?.cantidad_aspersores || 0);
                        const caudalSectorM3 = caudalSectorLph / 1000;
                        
                        // Calculo promedio de riego por turno (asumiendo duracion similar o promedio para la tabla)
                        const duracionPromedio = prog.turnos?.length > 0 
                            ? prog.turnos.reduce((acc, t) => acc + parseInt(t.duracion||0), 0) / prog.turnos.length 
                            : 0;
                        const riegoEstTurnoM3 = (caudalSectorLph / 60 * duracionPromedio) / 1000;

                        return (
                        <div key={prog.id} style={styles.tableRow}>
                            <div>
                                <strong>{new Date(prog.fecha_creacion).toLocaleDateString()}</strong>
                                <div style={{fontSize:'0.7rem', color:'#9ca3af'}}>
                                    {new Date(prog.fecha_creacion).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}
                                </div>
                            </div>
                            <div>{prog.sectores?.parcelas?.nombre}</div>
                            <div><strong>{prog.sectores?.nombre}</strong></div>
                            
                            {/* Días al centro y compactos */}
                            <div style={{fontSize:'0.75rem', lineHeight:'1.2'}}>
                                {prog.dias?.map(d => d.slice(0,3)).join(', ')}
                            </div>

                            <div>{caudalSectorM3 > 0 ? `${formatNumber(caudalSectorM3)} m³/h` : '-'}</div>
                            
                            {/* Nueva Columna Estimación */}
                            <div style={{color:'#059669', fontWeight:'bold'}}>
                                {riegoEstTurnoM3 > 0 ? `~${formatNumber(riegoEstTurnoM3)} m³` : '-'}
                            </div>

                            <div>
                                <span style={{fontSize:'0.75rem', display:'block'}}>In: {new Date(prog.fecha_inicio).toLocaleDateString()}</span>
                                <span style={{fontSize:'0.75rem', display:'block'}}>Out: {new Date(prog.fecha_fin).toLocaleDateString()}</span>
                            </div>
                            
                            <div>
                                {prog.turnos?.map((t, i) => (
                                    <div key={i} style={{fontSize:'0.75rem', whiteSpace:'nowrap'}}>
                                        {t.hora} ({t.duracion}')
                                    </div>
                                ))}
                            </div>
                        </div>
                    )})
                )}
            </div>
          </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Configurar Programa de Riego">
        {modalOpen && (
            <NuevoPrograma 
                idSector={sectorIdParaEditar} 
                cerrarModal={() => setModalOpen(false)} 
                alGuardar={() => { setModalOpen(false); cargarDatos(); }} 
            />
        )}
      </Modal>

    </div>
  )
}

export default Riego