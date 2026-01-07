import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useParams, useNavigate } from 'react-router-dom'
import { Map, Droplets, Shovel, ArrowLeft, TrendingUp, Settings, ShowerHead, Calendar } from 'lucide-react'

const ORDEN_CALIBRES = ["Extra", "Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Descarte", "Desecho"]

function DetalleSector() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [sector, setSector] = useState(null)
  const [programaRiego, setProgramaRiego] = useState(null)
  const [labores, setLabores] = useState([])
  const [cosechaRows, setCosechaRows] = useState([]) 
  const [totalHistorico, setTotalHistorico] = useState(0)
  const [loading, setLoading] = useState(true)

  const formatearFecha = (f) => f ? f.split('-').reverse().join('/') : '-'
  const fmtNum = (n) => n ? Math.round(n).toLocaleString('es-CL') : '0'
  const fmtMoney = (n) => Math.round(n).toLocaleString('es-CL')

  useEffect(() => {
    async function cargarDatos() {
      if (!id) return
      try {
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

        // --- LÓGICA COSECHA AGRUPADA ---
        const { data: cos } = await supabase
            .from('cosechas')
            .select(`fecha, destino, detalle_cosechas ( calibre, kilos, precio_kilo )`)
            .eq('sector_id', id)
            .eq('destino', 'Venta')
        
        let sumaTotal = 0
        const agrupado = {} // Clave: "AÑO-CALIBRE"

        if (cos) {
            cos.forEach(c => {
                const anio = c.fecha ? c.fecha.substring(0, 4) : '-'
                if (c.detalle_cosechas) {
                    c.detalle_cosechas.forEach(d => {
                        const key = `${anio}-${d.calibre}`
                        if (!agrupado[key]) {
                            agrupado[key] = { 
                                anio, 
                                calibre: d.calibre, 
                                kilos: 0, 
                                total: 0 
                            }
                        }
                        const monto = (d.kilos || 0) * (d.precio_kilo || 0)
                        agrupado[key].kilos += (d.kilos || 0)
                        agrupado[key].total += monto
                        sumaTotal += (d.kilos || 0)
                    })
                }
            })
        }

        // Convertir a array y ordenar
        const filas = Object.values(agrupado).sort((a, b) => {
            if (b.anio !== a.anio) return b.anio - a.anio
            let idxA = ORDEN_CALIBRES.indexOf(a.calibre)
            let idxB = ORDEN_CALIBRES.indexOf(b.calibre)
            if (idxA === -1) idxA = 999
            if (idxB === -1) idxB = 999
            return idxA - idxB
        })

        setCosechaRows(filas)
        setTotalHistorico(sumaTotal)

      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    cargarDatos()
  }, [id])

  const styles = {
    container: { padding: '20px', maxWidth: '1200px', margin: '0 auto' },
    btnBack: { display: 'flex', alignItems: 'center', gap: '5px', border: 'none', background: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '15px', padding:0 },
    
    hero: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)', border: '1px solid #e5e7eb', marginBottom: '30px' },
    title: { fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', margin: 0, display:'flex', alignItems:'center', gap:12 },
    tags: { display:'flex', gap:15, marginTop:15 },
    tag: { padding:'6px 12px', borderRadius:'8px', backgroundColor:'#f3f4f6', fontSize:'0.9rem', color:'#4b5563', fontWeight:'500' },

    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '25px' },
    card: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
    cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px', paddingBottom:'10px', borderBottom:'1px solid #f3f4f6' },
    cardTitle: { fontSize: '1.1rem', fontWeight: 'bold', color: '#374151', display:'flex', alignItems:'center', gap:8 },
    btnConfig: { fontSize:'0.8rem', color:'#2563eb', background:'none', border:'none', cursor:'pointer', fontWeight:'bold', display:'flex', alignItems:'center', gap:4 },

    // Tabla Labores
    tableLabores: { width:'100%', borderCollapse:'collapse' },
    tdLaborFecha: { padding:'10px 0', width:'100px', fontSize:'0.85rem', color:'#6b7280', borderBottom:'1px dashed #f3f4f6' },
    tdLaborInfo: { padding:'10px 0', borderBottom:'1px dashed #f3f4f6' },

    table: { width:'100%', borderCollapse:'collapse', fontSize:'0.9rem' },
    th: { textAlign:'left', padding:'8px', color:'#9ca3af', fontWeight:'600', borderBottom:'1px solid #e5e7eb', fontSize:'0.8rem' },
    td: { padding:'8px', borderBottom:'1px solid #f9fafb', color:'#374151' }
  }

  if (loading) return <div style={{padding:40, textAlign:'center', color:'#6b7280'}}>Cargando ficha...</div>
  if (!sector) return <div style={{padding:40, textAlign:'center'}}>Sector no encontrado.</div>

  return (
    <div style={styles.container}>
      <button onClick={() => navigate('/')} style={styles.btnBack}><ArrowLeft size={18}/> Volver al Dashboard</button>

      <div style={styles.hero}>
          <h1 style={styles.title}><Map color="#2563eb" size={32}/> {sector.nombre}</h1>
          <div style={styles.tags}>
              <span style={styles.tag}>Parcela: <strong>{sector.parcelas?.nombre}</strong></span>
              <span style={styles.tag}>Árboles: <strong>{sector.cantidad_arboles}</strong></span>
              <span style={styles.tag}>Sup: <strong>{sector.superficie_ha} Ha</strong></span>
              <span style={styles.tag}><ShowerHead size={14}/> Aspersores: <strong>{sector.cantidad_aspersores || 0}</strong></span>
          </div>
      </div>

      <div style={styles.grid}>
          
          <div style={{display:'flex', flexDirection:'column', gap:25}}>
              {/* RIEGO */}
              <div style={styles.card}>
                  <div style={styles.cardHeader}>
                      <div style={styles.cardTitle}><Droplets size={20} color="#3b82f6"/> Riego Actual</div>
                      <button onClick={() => navigate('/riego')} style={styles.btnConfig}><Settings size={14}/> Configurar</button>
                  </div>
                  {programaRiego ? (
                      <div>
                          <div style={{fontWeight:'bold', color:'#1e40af'}}>{programaRiego.nombre}</div>
                          <div style={{fontSize:'0.9rem', color:'#6b7280', margin:'5px 0'}}>Días: {programaRiego.dias?.join(', ')}</div>
                          {programaRiego.turnos?.filter(t => t.sector_id === Number(id)).map((t, i) => (
                              <div key={i} style={{backgroundColor:'#eff6ff', padding:'5px 10px', borderRadius:'6px', display:'flex', justifyContent:'space-between', marginTop:5}}>
                                  <span style={{fontWeight:'500'}}>Turno {i+1}</span>
                                  <span>{t.hora} ({t.duracion}m)</span>
                              </div>
                          ))}
                      </div>
                  ) : <div style={{textAlign:'center', color:'#9ca3af', fontStyle:'italic'}}>Inactivo</div>}
              </div>

              {/* LABORES (NUEVO DISEÑO CON COLUMNA FECHA) */}
              <div style={styles.card}>
                  <div style={styles.cardHeader}><div style={styles.cardTitle}><Shovel size={20} color="#f59e0b"/> Historial Labores</div></div>
                  <table style={styles.tableLabores}>
                      <tbody>
                        {labores.map(l => (
                          <tr key={l.id}>
                              <td style={styles.tdLaborFecha}>
                                  <div style={{display:'flex', alignItems:'center', gap:5}}>
                                    <Calendar size={12}/> {formatearFecha(l.fecha)}
                                  </div>
                              </td>
                              <td style={styles.tdLaborInfo}>
                                  <div style={{fontWeight:'bold', color:'#374151'}}>{l.tipo_labor}</div>
                                  {l.costo_total > 0 && <div style={{fontSize:'0.8rem', color:'#16a34a'}}>${fmtMoney(l.costo_total)}</div>}
                              </td>
                          </tr>
                        ))}
                      </tbody>
                  </table>
                  {labores.length === 0 && <div style={{textAlign:'center', color:'#d1d5db', fontStyle:'italic', marginTop:10}}>Sin registros.</div>}
              </div>
          </div>

          {/* HISTORIAL COSECHA AGRUPADO */}
          <div style={styles.card}>
              <div style={styles.cardHeader}>
                  <div style={styles.cardTitle}><TrendingUp size={20} color="#16a34a"/> Cosecha Histórica</div>
                  <div style={{fontSize:'0.9rem', color:'#16a34a', fontWeight:'bold'}}>Total: {fmtNum(totalHistorico)} Kg</div>
              </div>
              <table style={styles.table}>
                  <thead><tr><th style={styles.th}>Año</th><th style={styles.th}>Calibre</th><th style={styles.th}>Kilos</th><th style={styles.th}>Ingreso ($)</th></tr></thead>
                  <tbody>
                      {cosechaRows.map((row, index) => {
                          const mostrarAnio = index === 0 || cosechaRows[index-1].anio !== row.anio
                          return (
                              <tr key={`${row.anio}-${row.calibre}`} style={{backgroundColor: mostrarAnio ? '#fafafa' : 'white'}}>
                                  <td style={styles.td}>
                                      {mostrarAnio && <span style={{fontWeight:'bold', color:'#374151'}}>{row.anio}</span>}
                                  </td>
                                  <td style={styles.td}><span style={{fontSize:'0.85rem'}}>{row.calibre}</span></td>
                                  <td style={styles.td}><strong>{fmtNum(row.kilos)}</strong></td>
                                  <td style={styles.td}>
                                      <div style={{display:'flex', gap:5, justifyContent:'flex-end'}}>
                                          <span style={{color:'#9ca3af', fontSize:'0.8rem'}}>$</span>
                                          <span style={{color:'#16a34a', fontWeight:'bold'}}>{fmtMoney(row.total)}</span>
                                      </div>
                                  </td>
                              </tr>
                          )
                      })}
                      {cosechaRows.length === 0 && <tr><td colSpan="4" style={{textAlign:'center', padding:20, color:'#9ca3af'}}>Sin registros.</td></tr>}
                  </tbody>
              </table>
          </div>

      </div>
    </div>
  )
}
export default DetalleSector