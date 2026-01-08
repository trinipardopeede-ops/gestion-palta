import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { 
  Droplets, MapPin, ArrowRight, Map, 
  Scissors, Sprout, Hammer, Leaf, ClipboardList, TestTube,
  TreeDeciduous, Ruler, Activity
} from 'lucide-react'

// Iconografía Labores
const ICONOS_LABOR = {
  'Riego': <Droplets size={14} color="#3b82f6"/>,
  'Fertilización': <TestTube size={14} color="#8b5cf6"/>,
  'Poda': <Scissors size={14} color="#f59e0b"/>,
  'Cosecha': <Sprout size={14} color="#16a34a"/>,
  'Fitosanitario': <Leaf size={14} color="#ef4444"/>,
  'Mantenimiento': <Hammer size={14} color="#6b7280"/>,
  'Limpieza': <Leaf size={14} color="#d97706"/>,
  'Plantación': <Sprout size={14} color="#15803d"/>,
  'Otros': <ClipboardList size={14} color="#9ca3af"/>
}

const fmtInt = (n) => Math.round(n || 0).toLocaleString('es-CL')
const fmtDec = (n) => (n || 0).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function DashboardSectores() {
  const [dataParcelas, setDataParcelas] = useState([]) 
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate() 
  
  // Filtros
  const [filtroParcela, setFiltroParcela] = useState('Todas')
  const [filtroVariedad, setFiltroVariedad] = useState('Todas')
  
  // Switch Global
  const [unidadGlobal, setUnidadGlobal] = useState('L') // 'L' o 'm3'

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
        // 1. Cargar Base
        const { data: parcelas } = await supabase.from('parcelas').select('*').eq('activo', true).order('nombre')
        const { data: sectores } = await supabase.from('sectores').select('*').eq('activo', true).order('nombre')
        const { data: riegosActivos } = await supabase.from('programas_riego').select('*').neq('estado', 'Finalizado')
        const { data: ultimasLabores } = await supabase.from('labores_campo').select('*').order('fecha', { ascending: false }).limit(200)

        if (parcelas && sectores) {
            // 2. Construir Estructura Jerárquica
            const estructura = parcelas.map(p => {
                // Filtrar sectores de esta parcela
                const misSectores = sectores.filter(s => s.parcela_id === p.id).map(sector => {
                    // --- CÁLCULOS DINÁMICOS POR SECTOR ---
                    
                    // A. Riego Activo y Estimado
                    const programa = riegosActivos?.find(r => {
                        const sId = Number(sector.id)
                        if (r.sectores_ids && Array.isArray(r.sectores_ids)) return r.sectores_ids.map(Number).includes(sId)
                        return Number(r.sector_id) === sId
                    })

                    let aguaSemanal = 0
                    if (programa) {
                        const minutosDia = (programa.turnos || []).reduce((acc, t) => acc + (parseInt(t.duracion)||0), 0)
                        const diasSemana = (programa.dias || []).length
                        const caudalSector = ((parseFloat(sector.cantidad_aspersores)||0) * (parseFloat(sector.caudal_lph)||0))
                        aguaSemanal = (minutosDia / 60) * diasSemana * caudalSector
                    }

                    // B. Labores Recientes
                    const misLabores = ultimasLabores?.filter(l => {
                        const sId = Number(sector.id)
                        if (l.sectores_ids && Array.isArray(l.sectores_ids)) return l.sectores_ids.map(Number).includes(sId)
                        return Number(l.sector_id) === sId
                    }).slice(0, 3)

                    // C. Ratios Estáticos
                    const ratio = sector.cantidad_arboles > 0 ? (sector.cantidad_aspersores / sector.cantidad_arboles).toFixed(1) : '0'

                    return {
                        ...sector,
                        riegoActivo: !!programa,
                        aguaSemanal,
                        misLabores: misLabores || [],
                        ratioAspersores: ratio
                    }
                })

                // --- TOTALES DE LA PARCELA ---
                const totalArboles = misSectores.reduce((acc, s) => acc + (s.cantidad_arboles || 0), 0)
                const totalHa = misSectores.reduce((acc, s) => acc + (s.superficie_ha || 0), 0)
                const totalAspersores = misSectores.reduce((acc, s) => acc + (s.cantidad_aspersores || 0), 0)
                
                // Caudal Total (L/h de todos los sectores sumados) -> Convertido a m3/h
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
            setDataParcelas(estructura)
        }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  // Listas para filtros
  const parcelasOptions = useMemo(() => dataParcelas.map(p => p.nombre).sort(), [dataParcelas])
  
  // Filtrado final para visualización
  const parcelasFiltradas = dataParcelas.filter(p => {
      if (filtroParcela !== 'Todas' && p.nombre !== filtroParcela) return false
      // Si filtramos por variedad, verificamos si la parcela tiene al menos un sector con esa variedad
      if (filtroVariedad !== 'Todas') {
          const tieneVariedad = p.sectores.some(s => s.variedad === filtroVariedad)
          if (!tieneVariedad) return false
      }
      return true
  }).map(p => ({
      ...p,
      // Filtramos también los sectores internos si hay filtro de variedad
      sectores: filtroVariedad !== 'Todas' ? p.sectores.filter(s => s.variedad === filtroVariedad) : p.sectores
  }))

  const variedadesUnicas = useMemo(() => {
      const v = new Set()
      dataParcelas.forEach(p => p.sectores.forEach(s => { if(s.variedad) v.add(s.variedad) }))
      return Array.from(v).sort()
  }, [dataParcelas])

  const irADetalle = (id) => navigate(`/sector/${id}`)
  
  const getIconoLabor = (tipo) => {
      const key = Object.keys(ICONOS_LABOR).find(k => tipo?.includes(k)) || 'Otros'
      return ICONOS_LABOR[key]
  }

  // Estado del Huerto (Misma lógica que Configuración)
  const getEstadoHuerto = (anoPlantacion) => {
      if (!anoPlantacion) return { label: 'Sin info', color: '#9ca3af', bg: '#f3f4f6' }
      const antiguedad = new Date().getFullYear() - anoPlantacion
      if (antiguedad < 2) return { label: 'Nuevo', color: '#10b981', bg: '#ecfccb' } 
      if (antiguedad < 5) return { label: 'Crecimiento', color: '#84cc16', bg: '#ecfccb' } 
      return { label: 'Adulto', color: '#15803d', bg: '#dcfce7' } 
  }

  const renderAgua = (litros) => {
      if (unidadGlobal === 'm3') return `${fmtDec(litros / 1000)} m³`
      return `${fmtInt(litros)} L`
  }

  const styles = {
    toolbar: { display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap', alignItems:'center', backgroundColor:'white', padding:15, borderRadius:12, border:'1px solid #e5e7eb' },
    headerTool: { display:'flex', alignItems:'center', gap:10, marginRight:'auto', minWidth:200 },
    iconBox: { backgroundColor:'#fefce8', padding:8, borderRadius:8 },
    titleTool: { margin:0, color:'#1f2937', fontSize:'1.1rem' },
    subTitleTool: { fontSize:'0.8rem', color:'#6b7280' },
    selectGroup: { display:'flex', flexDirection:'column', gap:4 },
    labelSelect: { fontSize:'0.7rem', fontWeight:'bold', color:'#6b7280', textTransform:'uppercase' },
    select: { padding:'8px 10px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'0.85rem', minWidth:130, cursor:'pointer' },
    
    switchContainer: { display:'flex', backgroundColor:'#f3f4f6', borderRadius:6, padding:2, alignSelf:'center', marginLeft:10 },
    switchBtn: (active) => ({
        padding:'6px 10px', fontSize:'0.75rem', fontWeight:'bold', cursor:'pointer', borderRadius:4, border:'none',
        backgroundColor: active ? 'white' : 'transparent', color: active ? '#1e40af' : '#6b7280',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
    }),

    // CONTENEDOR PARCELA (Estilo Configuración)
    parcelaContainer: { backgroundColor:'white', borderRadius:12, padding:20, marginBottom:30, border:'1px solid #e5e7eb', boxShadow:'0 2px 4px rgba(0,0,0,0.05)' },
    parcelaHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'2px solid #f3f4f6', paddingBottom:15, marginBottom:15, flexWrap: 'wrap', gap: 10 },
    parcelaTitle: { fontSize:'1.2rem', fontWeight:'bold', color:'#374151', display:'flex', alignItems:'center', gap:10, minWidth: '200px' },
    
    // Stats Parcela
    statsContainer: { display:'flex', gap:10, flexWrap:'wrap', flex: 1, justifyContent: 'flex-end' },
    statBadge: { display:'flex', alignItems:'center', gap:6, backgroundColor:'#f8fafc', padding:'6px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:'0.85rem', color:'#475569', fontWeight:500 },

    // Grid Sectores
    gridSectores: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:15 },
    
    // TARJETA SECTOR (Estilo Configuración + Datos Operativos)
    sectorCard: { 
        backgroundColor:'#f9fafb', padding:15, borderRadius:8, border:'1px solid #e5e7eb', 
        position:'relative', display:'flex', flexDirection:'column', gap:8, 
        transition: 'all 0.2s', cursor:'pointer' 
    },
    sectorHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start' },
    sectorName: { fontWeight:'bold', color:'#111827', fontSize:'1rem' },
    
    // Filas de detalle (Estilo denso)
    detailRow: { display:'flex', justifyContent:'space-between', fontSize:'0.85rem', color:'#4b5563', borderBottom:'1px dashed #e5e7eb', paddingBottom:4 },
    labelRow: { display:'flex', alignItems:'center', gap:4 },
    
    // Footer Labores
    footerCard: { marginTop: 'auto', paddingTop:10 },
    laborRow: { display:'flex', gap:'5px', flexWrap:'wrap' },
    laborBadge: { 
        fontSize: '0.7rem', backgroundColor:'white', padding:'3px 6px', 
        borderRadius:'4px', border: '1px solid #d1d5db', 
        display:'flex', alignItems:'center', gap:4, color:'#4b5563' 
    },
    btnLink: { fontSize:'0.75rem', color:'#2563eb', fontWeight:'bold', display:'flex', alignItems:'center', gap:3, marginTop:8, justifyContent:'flex-end' }
  }

  return (
    <div>
        <div style={styles.toolbar}>
            <div style={styles.headerTool}>
                <div style={styles.iconBox}><Map color="#ca8a04" size={20}/></div>
                <div>
                    <h3 style={styles.titleTool}>Campo</h3>
                    <span style={styles.subTitleTool}>Estado de sectores</span>
                </div>
            </div>

            <div style={styles.switchContainer}>
                 <button onClick={() => setUnidadGlobal('L')} style={styles.switchBtn(unidadGlobal==='L')}>Litros</button>
                 <button onClick={() => setUnidadGlobal('m3')} style={styles.switchBtn(unidadGlobal==='m3')}>m³</button>
            </div>

            <div style={styles.selectGroup}>
                <span style={styles.labelSelect}>Parcela</span>
                <select value={filtroParcela} onChange={e => setFiltroParcela(e.target.value)} style={styles.select}>
                    <option value="Todas">Todas</option>
                    {parcelasOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
            <div style={styles.selectGroup}>
                <span style={styles.labelSelect}>Variedad</span>
                <select value={filtroVariedad} onChange={e => setFiltroVariedad(e.target.value)} style={styles.select}>
                    <option value="Todas">Todas</option>
                    {variedadesUnicas.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
            </div>
        </div>

        {loading ? <div style={{padding:40, textAlign:'center', color:'#6b7280'}}>Cargando...</div> : (
            parcelasFiltradas.map(p => (
                <div key={p.id} style={styles.parcelaContainer}>
                    {/* ENCABEZADO PARCELA (Estilo Configuración) */}
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
                    </div>

                    {/* GRID SECTORES */}
                    <div style={styles.gridSectores}>
                        {p.sectores.length === 0 ? (
                            <div style={{color:'#9ca3af', fontStyle:'italic', padding:10}}>Sin sectores registrados.</div>
                        ) : (
                            p.sectores.map(s => {
                                const estado = getEstadoHuerto(s.ano_plantacion)
                                return (
                                    <div key={s.id} style={styles.sectorCard} onClick={() => irADetalle(s.id)}>
                                        <div style={styles.sectorHeader}>
                                            <div>
                                                <div style={styles.sectorName}>{s.nombre}</div>
                                                <span style={{fontSize:'0.7rem', fontWeight:'bold', color: estado.color, backgroundColor: estado.bg, padding:'1px 5px', borderRadius:4}}>
                                                    {estado.label}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div>
                                            {/* Datos Estáticos (Configuración) */}
                                            <div style={styles.detailRow}>
                                                <span style={styles.labelRow}><Ruler size={12}/> Superficie:</span>
                                                <strong>{s.superficie_ha} Ha</strong>
                                            </div>
                                            <div style={styles.detailRow}>
                                                <span style={styles.labelRow}><TreeDeciduous size={12}/> Plantas:</span>
                                                <strong>{s.cantidad_arboles} ({s.variedad})</strong>
                                            </div>
                                            <div style={styles.detailRow}>
                                                <span style={styles.labelRow}><Droplets size={12}/> Riego:</span>
                                                <strong>{s.ratioAspersores} asp/planta</strong>
                                            </div>
                                            <div style={styles.detailRow}>
                                                <span style={styles.labelRow}><Activity size={12}/> Caudal:</span>
                                                <strong>{s.caudal_lph} L/h</strong>
                                            </div>

                                            {/* Dato Operativo (Dashboard) */}
                                            <div style={{...styles.detailRow, borderBottom:'none', color: s.riegoActivo ? '#2563eb' : '#9ca3af', marginTop:5}}>
                                                <span style={styles.labelRow}><Droplets size={12} color={s.riegoActivo ? '#3b82f6' : '#9ca3af'}/> Riego (Sem):</span>
                                                <strong style={{fontSize:'0.9rem'}}>{s.riegoActivo ? renderAgua(s.aguaSemanal) : 'Inactivo'}</strong>
                                            </div>
                                        </div>

                                        {/* Labores (Pie de tarjeta) */}
                                        <div style={styles.footerCard}>
                                            <div style={{fontSize:'0.65rem', fontWeight:'bold', color:'#9ca3af', textTransform:'uppercase', marginBottom:4}}>
                                                Última Actividad
                                            </div>
                                            <div style={styles.laborRow}>
                                                {s.misLabores.length > 0 ? (
                                                    s.misLabores.map(l => (
                                                        <div key={l.id} style={styles.laborBadge}>
                                                            {getIconoLabor(l.tipo_labor)} {l.tipo_labor}
                                                        </div>
                                                    ))
                                                ) : <span style={{fontSize:'0.7rem', fontStyle:'italic', color:'#d1d5db'}}>Sin actividad</span>}
                                            </div>
                                            <div style={styles.btnLink}>
                                                Ver Detalle <ArrowRight size={12}/>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            ))
        )}
    </div>
  )
}
export default DashboardSectores