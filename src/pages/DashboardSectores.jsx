import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { 
  Droplets, Shovel, TrendingUp, MapPin, ArrowRight, ShowerHead,
  Scissors, Sprout, Hammer, Leaf, ClipboardList, TestTube, Map
} from 'lucide-react'

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

function DashboardSectores() {
  const [datosPorParcela, setDatosPorParcela] = useState({}) 
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate() 

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
        const { data: sectores } = await supabase.from('sectores').select('*, parcelas(nombre)').order('nombre')
        if (!sectores) { setDatosPorParcela({}); return }

        const { data: riegosActivos } = await supabase.from('programas_riego').select('*').neq('estado', 'Finalizado')
        const { data: ultimasLabores } = await supabase.from('labores_campo').select('*').order('fecha', { ascending: false }).limit(100)

        // Procesar datos y Agrupar por Parcela
        const agrupado = sectores.reduce((acc, sector) => {
            const tieneRiego = riegosActivos?.some(r => {
                const sId = Number(sector.id)
                if (r.sectores_ids && Array.isArray(r.sectores_ids)) return r.sectores_ids.map(Number).includes(sId)
                return Number(r.sector_id) === sId
            })

            const misLabores = ultimasLabores?.filter(l => {
                const sId = Number(sector.id)
                if (l.sectores_ids && Array.isArray(l.sectores_ids)) return l.sectores_ids.map(Number).includes(sId)
                return Number(l.sector_id) === sId
            }).slice(0, 3)

            const numAspersores = sector.cantidad_aspersores || 0
            const numArboles = sector.cantidad_arboles || 1 
            const ratioAspersores = numArboles > 0 ? (numAspersores / numArboles).toFixed(2) : '0'

            const nombreParcela = sector.parcelas?.nombre || 'Sin Parcela'
            
            if (!acc[nombreParcela]) acc[nombreParcela] = []
            
            acc[nombreParcela].push({
                ...sector,
                riegoActivo: tieneRiego,
                misLabores: misLabores || [],
                ratioAspersores
            })
            return acc
        }, {})

        setDatosPorParcela(agrupado)
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  const irADetalle = (id) => navigate(`/sector/${id}`)
  const formatearFechaCorta = (f) => f ? f.split('-').reverse().slice(0,2).join('/') : ''
  const getIcono = (tipo) => {
      const key = Object.keys(ICONOS_LABOR).find(k => tipo?.includes(k)) || 'Otros'
      return ICONOS_LABOR[key]
  }

  const styles = {
    contenedorParcela: { marginBottom: '40px' },
    tituloParcela: { fontSize: '1.2rem', fontWeight: 'bold', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', marginBottom: '20px', display:'flex', alignItems:'center', gap:'10px' },
    
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' },
    
    card: { 
        backgroundColor: 'white', borderRadius: '16px', padding: '15px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6',
        display: 'flex', flexDirection: 'column', gap: '12px', position:'relative', height: '100%', justifyContent: 'space-between'
    },
    
    // Header Tarjeta
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    title: { fontSize: '1.1rem', fontWeight: 'bold', color: '#1f2937', margin: 0 },
    
    // Estadísticas
    statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' },
    statItem: { display: 'flex', flexDirection: 'column', color: '#6b7280' },
    statValue: { fontWeight: 'bold', color: '#374151', fontSize: '0.95rem' },

    // Fila Riego (Segunda fila solicitada)
    riegoRow: { 
        backgroundColor: '#f0f9ff', padding: '8px', borderRadius: '8px', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: '0.85rem', color: '#0369a1', border: '1px solid #e0f2fe'
    },

    // Labores Recientes
    laboresContainer: { 
        backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '10px', 
        border:'1px solid #dcfce7', flex: 1 
    },
    laborRow: { display:'flex', gap:'5px', flexWrap:'wrap' },
    laborBadge: { 
        fontSize: '0.7rem', backgroundColor:'white', padding:'4px 6px', borderRadius:'6px',
        border: '1px solid #bbf7d0', display:'flex', alignItems:'center', gap:4, color:'#15803d' 
    },
    
    btnDetalle: { 
        marginTop: '10px', width:'100%', padding:'8px', backgroundColor:'#f9fafb', 
        color:'#374151', border:'1px solid #e5e7eb', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', 
        display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all 0.2s'
    }
  }

  return (
    <div>
        {loading ? <div style={{padding:20, color:'#6b7280'}}>Cargando sectores...</div> : (
            Object.keys(datosPorParcela).sort().map(parcela => (
                <div key={parcela} style={styles.contenedorParcela}>
                    <h3 style={styles.tituloParcela}>
                        <Map size={20} color="#4b5563"/> {parcela}
                    </h3>
                    
                    <div style={styles.grid}>
                        {datosPorParcela[parcela].map(sector => (
                            <div key={sector.id} style={styles.card}>
                                {/* 1. Encabezado */}
                                <div style={styles.header}>
                                    <h4 style={styles.title}>{sector.nombre}</h4>
                                    <span style={{fontSize:'0.8rem', color:'#9ca3af'}}>{sector.superficie_ha} ha</span>
                                </div>

                                {/* 2. Riego (Segunda Fila Explicita) */}
                                <div style={styles.riegoRow}>
                                    <div style={{display:'flex', alignItems:'center', gap:5}}>
                                        <Droplets size={14}/> Riego
                                    </div>
                                    <span style={{fontWeight:'bold'}}>
                                        {sector.riegoActivo ? 'EN CURSO' : 'Inactivo'}
                                    </span>
                                </div>

                                {/* 3. Datos Técnicos */}
                                <div style={styles.statsGrid}>
                                    <div style={styles.statItem}>
                                        <span>Árboles</span>
                                        <span style={styles.statValue}>{sector.cantidad_arboles}</span>
                                    </div>
                                    <div style={styles.statItem}>
                                        <span>Aspersor/Planta</span>
                                        <span style={styles.statValue}>{sector.ratioAspersores}</span>
                                    </div>
                                </div>

                                {/* 4. Labores (Alineadas) */}
                                <div style={styles.laboresContainer}>
                                    <div style={{fontSize:'0.7rem', fontWeight:'bold', color:'#15803d', marginBottom:5, textTransform:'uppercase'}}>
                                        Últimas Labores
                                    </div>
                                    <div style={styles.laborRow}>
                                        {sector.misLabores.length > 0 ? (
                                            sector.misLabores.map(l => (
                                                <div key={l.id} style={styles.laborBadge} title={l.fecha}>
                                                    {getIcono(l.tipo_labor)} {l.tipo_labor}
                                                </div>
                                            ))
                                        ) : <span style={{fontSize:'0.75rem', fontStyle:'italic', color:'#86efac'}}>Sin actividad reciente</span>}
                                    </div>
                                </div>
                                
                                <button onClick={() => irADetalle(sector.id)} style={styles.btnDetalle}>
                                    Detalle <ArrowRight size={14}/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))
        )}
    </div>
  )
}
export default DashboardSectores