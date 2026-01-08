import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Map, Droplets, Shovel, ArrowLeft, TrendingUp, Settings, 
  ShowerHead, Calendar, ChevronLeft, ChevronRight, Activity, Clock 
} from 'lucide-react'

// ... Utils ... (Mismos de antes)
const ORDEN_CALIBRES = ["Extra", "Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Descarte", "Desecho"]
const fmtInt = (n) => Math.round(n || 0).toLocaleString('es-CL')
const fmtMoney = (n) => '$ ' + Math.round(n || 0).toLocaleString('es-CL')
const fmtDec = (n) => (n || 0).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const formatearFecha = (f) => f ? f.split('-').reverse().join('/') : '-'

function DetalleSector() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [sector, setSector] = useState(null)
  const [programaRiego, setProgramaRiego] = useState(null)
  const [labores, setLabores] = useState([])
  const [cosechaRows, setCosechaRows] = useState([]) 
  const [totalHistoricoKilos, setTotalHistoricoKilos] = useState(0)
  const [totalHistoricoPlata, setTotalHistoricoPlata] = useState(0)
  const [loading, setLoading] = useState(true)
  const [allSectoresIds, setAllSectoresIds] = useState([])
  const [unidadRiego, setUnidadRiego] = useState('L') 

  // ... (Effect Hooks: cargarDatos, calcularHidraulica se mantienen igual) ...
  useEffect(() => {
    async function cargarDatos() {
      if (!id) return
      setLoading(true)
      try {
        const { data: idsData } = await supabase.from('sectores').select('id').order('nombre')
        if (idsData) setAllSectoresIds(idsData.map(x => x.id))

        const { data: sec } = await supabase.from('sectores').select('*, parcelas(nombre)').eq('id', id).single()
        setSector(sec)

        const { data: progs } = await supabase.from('programas_riego').select('*').neq('estado', 'Finalizado')
        const miPrograma = progs?.find(p => {
            const sId = Number(id)
            if (p.sectores_ids && Array.isArray(p.sectores_ids)) return p.sectores_ids.map(Number).includes(sId)
            return Number(p.sector_id) === sId
        })
        setProgramaRiego(miPrograma)

        const { data: allLabores } = await supabase.from('labores_campo').select('*').order('fecha', { ascending: false }).limit(200)
        const misLabores = allLabores?.filter(l => {
            const sId = Number(id)
            if (l.sectores_ids && Array.isArray(l.sectores_ids)) return l.sectores_ids.map(Number).includes(sId)
            return Number(l.sector_id) === sId
        }).slice(0, 20)
        setLabores(misLabores || [])

        const { data: cos } = await supabase.from('cosechas').select(`fecha, destino, detalle_cosechas ( calibre, kilos, precio_kilo )`).eq('sector_id', id).eq('destino', 'Venta')
        
        let sumaKilos = 0
        let sumaPlata = 0
        const agrupado = {}

        if (cos) {
            cos.forEach(c => {
                const anio = c.fecha ? c.fecha.substring(0, 4) : '-'
                if (c.detalle_cosechas) {
                    c.detalle_cosechas.forEach(d => {
                        const key = `${anio}-${d.calibre}`
                        if (!agrupado[key]) agrupado[key] = { anio, calibre: d.calibre, kilos: 0, total: 0 }
                        const monto = (d.kilos || 0) * (d.precio_kilo || 0)
                        agrupado[key].kilos += (d.kilos || 0)
                        agrupado[key].total += monto
                        sumaKilos += (d.kilos || 0)
                        sumaPlata += monto
                    })
                }
            })
        }
        const filas = Object.values(agrupado).sort((a, b) => b.anio - a.anio || ORDEN_CALIBRES.indexOf(a.calibre) - ORDEN_CALIBRES.indexOf(b.calibre))
        setCosechaRows(filas)
        setTotalHistoricoKilos(sumaKilos)
        setTotalHistoricoPlata(sumaPlata)
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    cargarDatos()
  }, [id])

  const navegarSector = (direction) => {
      const currentIndex = allSectoresIds.indexOf(Number(id))
      if (currentIndex === -1) return
      let nextIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1
      if (nextIndex >= 0 && nextIndex < allSectoresIds.length) navigate(`/sector/${allSectoresIds[nextIndex]}`)
  }

  const calcularHidraulica = () => {
      if (!sector) return { caudalTotal: 0, consumoSemanal: 0, consumoDiario: 0 }
      const caudalTotalLPH = (sector.cantidad_aspersores || 0) * (sector.caudal_lph || 0)
      let consumoSemanalL = 0
      let consumoDiarioL = 0 
      if (programaRiego) {
          const minutosDia = (programaRiego.turnos || []).reduce((acc, t) => acc + (parseInt(t.duracion)||0), 0)
          const diasSemana = (programaRiego.dias || []).length
          consumoDiarioL = (minutosDia / 60) * caudalTotalLPH
          consumoSemanalL = consumoDiarioL * diasSemana
      }
      return { caudalTotal: caudalTotalLPH, consumoSemanal: consumoSemanalL, consumoDiario: consumoDiarioL }
  }

  const hidro = calcularHidraulica()
  const Val = ({ litros, isRate = false }) => {
      let val = litros
      let unit = 'L'
      if (unidadRiego === 'm3') { val = litros / 1000; unit = 'm³' }
      return <span>{unidadRiego === 'L' ? fmtInt(val) : fmtDec(val)} <small style={{color:'#6b7280'}}>{unit}{isRate?'/h':''}</small></span>
  }

  const styles = {
    container: { padding: '20px', maxWidth: '1200px', margin: '0 auto' },
    
    // NAV SUPERIOR (SOLO VOLVER)
    topBar: { marginBottom:15 },
    btnBack: { display: 'flex', alignItems: 'center', gap: '5px', border: 'none', background: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.9rem', padding:0 },
    
    // HERO CARD
    hero: { backgroundColor: 'white', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)', border: '1px solid #e5e7eb', marginBottom: '30px' },
    heroHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }, // <-- Flex para Titulo y Botones
    
    title: { fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', margin: 0, display:'flex', alignItems:'center', gap:12 },
    
    // Botones Nav integrados
    navButtons: { display:'flex', gap:8 },
    btnNav: { display:'flex', alignItems:'center', gap:5, padding:'6px 12px', backgroundColor:'white', border:'1px solid #d1d5db', borderRadius:6, cursor:'pointer', fontSize:'0.85rem', color:'#374151', transition:'background 0.2s' },
    
    tags: { display:'flex', gap:15, marginTop:0, flexWrap:'wrap' },
    tag: { padding:'6px 12px', borderRadius:'8px', backgroundColor:'#f3f4f6', fontSize:'0.9rem', color:'#4b5563', fontWeight:'500' },

    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '25px' },
    card: { backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
    cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', paddingBottom:'10px', borderBottom:'1px solid #f3f4f6' },
    cardTitle: { fontSize: '1.1rem', fontWeight: 'bold', color: '#374151', display:'flex', alignItems:'center', gap:8 },
    
    switchContainer: { display:'flex', backgroundColor:'#f3f4f6', borderRadius:6, padding:2 },
    switchBtn: (active) => ({ padding:'4px 8px', fontSize:'0.75rem', fontWeight:'bold', cursor:'pointer', borderRadius:4, border:'none', backgroundColor: active ? 'white' : 'transparent', color: active ? '#1e40af' : '#6b7280', boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }),
    
    panelRow: { display:'flex', justifyContent:'space-between', marginBottom:12, alignItems:'center' },
    panelLabel: { color:'#6b7280', fontSize:'0.9rem', display:'flex', gap:6, alignItems:'center' },
    panelValue: { fontSize:'1.1rem', fontWeight:'bold', color:'#111827', fontFamily:'monospace' },
    bigStat: { flex:1, backgroundColor:'#eff6ff', borderRadius:12, padding:15, border:'1px solid #dbeafe', textAlign:'center' },
    bigStatLabel: { color:'#1e40af', fontSize:'0.8rem', fontWeight:'bold', textTransform:'uppercase', marginBottom:5 },
    bigStatValue: { color:'#1e3a8a', fontSize:'1.4rem', fontWeight:'800' },
    table: { width:'100%', borderCollapse:'collapse', fontSize:'0.9rem' },
    th: { textAlign:'left', padding:'8px', color:'#9ca3af', fontWeight:'600', borderBottom:'1px solid #e5e7eb', fontSize:'0.8rem' },
    td: { padding:'10px 8px', borderBottom:'1px dashed #f3f4f6', color:'#374151', verticalAlign:'middle' },
  }

  if (loading) return <div style={{padding:40, textAlign:'center', color:'#6b7280'}}>Cargando ficha...</div>
  if (!sector) return <div style={{padding:40, textAlign:'center'}}>Sector no encontrado.</div>

  const currentIndex = allSectoresIds.indexOf(Number(id))

  return (
    <div style={styles.container}>
      {/* 1. Barra Superior Simple */}
      <div style={styles.topBar}>
          <button onClick={() => navigate('/')} style={styles.btnBack}><ArrowLeft size={18}/> Volver al Dashboard</button>
      </div>

      {/* 2. HERO CARD CON NAVEGACION INTEGRADA */}
      <div style={styles.hero}>
          <div style={styles.heroHeader}>
              <h1 style={styles.title}><Map color="#2563eb" size={32}/> {sector.nombre}</h1>
              
              {/* BOTONES DENTRO DEL HEADER */}
              <div style={styles.navButtons}>
                  <button onClick={() => navegarSector('prev')} disabled={currentIndex <= 0} style={{...styles.btnNav, opacity: currentIndex <= 0 ? 0.5:1}}>
                      <ChevronLeft size={16}/> Anterior
                  </button>
                  <button onClick={() => navegarSector('next')} disabled={currentIndex >= allSectoresIds.length-1} style={{...styles.btnNav, opacity: currentIndex >= allSectoresIds.length-1 ? 0.5:1}}>
                      Siguiente <ChevronRight size={16}/>
                  </button>
              </div>
          </div>

          <div style={styles.tags}>
              <span style={styles.tag}>Parcela: <strong>{sector.parcelas?.nombre}</strong></span>
              <span style={styles.tag}>Árboles: <strong>{sector.cantidad_arboles}</strong></span>
              <span style={styles.tag}>Sup: <strong>{sector.superficie_ha} Ha</strong></span>
              <span style={styles.tag}><ShowerHead size={14}/> Aspersores: <strong>{sector.cantidad_aspersores || 0}</strong></span>
          </div>
      </div>

      {/* RESTO DE LA VISTA (IGUAL QUE ANTES) */}
      <div style={styles.grid}>
          <div style={{display:'flex', flexDirection:'column', gap:25}}>
              
              <div style={styles.card}>
                  <div style={styles.cardHeader}>
                      <div style={styles.cardTitle}><Droplets size={20} color="#3b82f6"/> Gestión Hídrica</div>
                      <div style={styles.switchContainer}>
                          <button onClick={() => setUnidadRiego('L')} style={styles.switchBtn(unidadRiego==='L')}>L</button>
                          <button onClick={() => setUnidadRiego('m3')} style={styles.switchBtn(unidadRiego==='m3')}>m³</button>
                      </div>
                  </div>
                  <div style={{display:'flex', gap:10, marginBottom:20}}>
                       <div style={styles.bigStat}>
                           <div style={styles.bigStatLabel}>Capacidad Total</div>
                           <div style={styles.bigStatValue}><Val litros={hidro.caudalTotal} isRate={true}/></div>
                       </div>
                       <div style={{...styles.bigStat, backgroundColor: programaRiego ? '#f0fdf4' : '#f3f4f6', borderColor: programaRiego ? '#bbf7d0' : '#e5e7eb'}}>
                           <div style={{...styles.bigStatLabel, color: programaRiego ? '#166534' : '#6b7280'}}>Estimado Semanal</div>
                           <div style={{...styles.bigStatValue, color: programaRiego ? '#14532d' : '#9ca3af'}}>
                               {programaRiego ? <Val litros={hidro.consumoSemanal}/> : '-'}
                           </div>
                       </div>
                  </div>
                  <div style={{backgroundColor:'#f9fafb', padding:15, borderRadius:12, border:'1px solid #f3f4f6'}}>
                      <div style={styles.panelRow}>
                          <span style={styles.panelLabel}><Activity size={14}/> Caudal x Emisor</span>
                          <span style={styles.panelValue}>{sector.caudal_lph} <small style={{color:'#6b7280', fontSize:'0.8rem'}}>L/h</small></span>
                      </div>
                      <div style={{...styles.panelRow, marginBottom:0}}>
                          <span style={styles.panelLabel}><ShowerHead size={14}/> N° Emisores</span>
                          <span style={styles.panelValue}>{sector.cantidad_aspersores}</span>
                      </div>
                  </div>
                  <div style={{marginTop:20}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                           <span style={{fontWeight:'bold', color:'#374151', fontSize:'0.95rem'}}>Programa Actual</span>
                           <button onClick={() => navigate('/riego')} style={{fontSize:'0.8rem', color:'#2563eb', border:'none', background:'none', cursor:'pointer', fontWeight:'bold'}}>Configurar</button>
                      </div>
                      {programaRiego ? (
                          <div style={{border:'1px solid #bfdbfe', borderRadius:8, overflow:'hidden'}}>
                              <div style={{backgroundColor:'#eff6ff', padding:'8px 12px', color:'#1e3a8a', fontWeight:'bold', fontSize:'0.85rem', display:'flex', justifyContent:'space-between'}}>
                                  <span>{programaRiego.nombre}</span>
                                  <span>{programaRiego.dias?.length} días/sem</span>
                              </div>
                              <div style={{padding:10}}>
                                  {programaRiego.turnos?.filter(t => t.sector_id === Number(id)).map((t, i) => (
                                      <div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:'0.9rem', marginBottom:4, color:'#4b5563'}}>
                                          <span style={{display:'flex', alignItems:'center', gap:5}}><Clock size={14}/> Turno {i+1} ({t.hora})</span>
                                          <strong>{t.duracion} min</strong>
                                      </div>
                                  ))}
                                  <div style={{marginTop:8, paddingTop:8, borderTop:'1px dashed #e5e7eb', fontSize:'0.8rem', color:'#6b7280', textAlign:'right'}}>
                                      Consumo por día de riego: <strong><Val litros={hidro.consumoDiario}/></strong>
                                  </div>
                              </div>
                          </div>
                      ) : <div style={{padding:15, textAlign:'center', backgroundColor:'#f9fafb', borderRadius:8, color:'#9ca3af', fontStyle:'italic', border:'1px dashed #d1d5db'}}>Sin programa activo</div>}
                  </div>
              </div>

              <div style={styles.card}>
                  <div style={styles.cardHeader}><div style={styles.cardTitle}><Shovel size={20} color="#f59e0b"/> Historial Labores</div></div>
                  <table style={styles.table}>
                      <thead><tr><th style={styles.th}>Fecha</th><th style={styles.th}>Labor</th><th style={{...styles.th, textAlign:'right'}}>Costo</th></tr></thead>
                      <tbody>
                        {labores.map(l => (
                          <tr key={l.id}>
                              <td style={{...styles.td, fontSize:'0.85rem', color:'#6b7280'}}>{formatearFecha(l.fecha)}</td>
                              <td style={{...styles.td, fontWeight:'bold'}}>{l.tipo_labor}</td>
                              <td style={{...styles.td, textAlign:'right', fontFamily:'monospace', color: l.costo_total>0?'#16a34a':'#9ca3af'}}>
                                  {l.costo_total > 0 ? fmtMoney(l.costo_total) : '-'}
                              </td>
                          </tr>
                        ))}
                      </tbody>
                  </table>
              </div>
          </div>

          <div style={styles.card}>
              <div style={styles.cardHeader}>
                  <div style={styles.cardTitle}><TrendingUp size={20} color="#16a34a"/> Cosecha Histórica</div>
                  <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
                      <div style={{fontSize:'0.85rem', color:'#6b7280'}}>Total Kg: <strong style={{color:'#111827'}}>{fmtInt(totalHistoricoKilos)}</strong></div>
                      <div style={{fontSize:'0.85rem', color:'#6b7280'}}>Total $: <strong style={{color:'#16a34a'}}>{fmtMoney(totalHistoricoPlata)}</strong></div>
                  </div>
              </div>
              <table style={styles.table}>
                  <thead><tr><th style={styles.th}>Año</th><th style={styles.th}>Calibre</th><th style={{...styles.th, textAlign:'right'}}>Kilos</th><th style={{...styles.th, textAlign:'right'}}>Ingreso ($)</th></tr></thead>
                  <tbody>
                      {cosechaRows.map((row, index) => {
                          const mostrarAnio = index === 0 || cosechaRows[index-1].anio !== row.anio
                          return (
                              <tr key={`${row.anio}-${row.calibre}`} style={{backgroundColor: mostrarAnio ? '#fafafa' : 'white'}}>
                                  <td style={styles.td}>
                                      {mostrarAnio && <span style={{fontWeight:'bold', color:'#374151'}}>{row.anio}</span>}
                                  </td>
                                  <td style={styles.td}><span style={{fontSize:'0.85rem'}}>{row.calibre}</span></td>
                                  <td style={{...styles.td, textAlign:'right'}}><strong>{fmtInt(row.kilos)}</strong></td>
                                  <td style={{...styles.td, textAlign:'right', color:'#16a34a', fontFamily:'monospace', fontWeight:'bold'}}>
                                      {fmtMoney(row.total)}
                                  </td>
                              </tr>
                          )
                      })}
                  </tbody>
              </table>
          </div>

      </div>
    </div>
  )
}
export default DetalleSector