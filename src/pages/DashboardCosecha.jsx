import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { Sprout, DollarSign, Scale, TrendingUp, PieChart, Users, Calendar, Filter } from 'lucide-react'

// ORDEN EXACTO SOLICITADO
const ORDEN_CALIBRES = [
  "Extra",
  "Primera",
  "Segunda",
  "Tercera",
  "Cuarta",
  "Quinta",
  "Descarte",
  "Desecho"
]

function DashboardCosecha() {
  const [loading, setLoading] = useState(true)
  const [rawCosechas, setRawCosechas] = useState([]) 
  const [listaSectores, setListaSectores] = useState([])
  const [anioSeleccionado, setAnioSeleccionado] = useState('Todos')
  const [sectorSeleccionado, setSectorSeleccionado] = useState('Todos')
  
  const [stats, setStats] = useState({
    totalKilos: 0,
    ingresoTotal: 0,
    precioPromedio: 0,
    porCalibre: {},
    porCliente: {}
  })

  useEffect(() => { cargarDatosIniciales() }, [])
  useEffect(() => { calcularEstadisticas() }, [rawCosechas, anioSeleccionado, sectorSeleccionado])

  async function cargarDatosIniciales() {
    setLoading(true)
    const { data: sectores } = await supabase.from('sectores').select('id, nombre').order('nombre')
    if (sectores) setListaSectores(sectores)

    const { data, error } = await supabase
      .from('cosechas')
      .select(`
        id, fecha, destino, sector_id,
        sectores ( nombre ),
        clientes ( nombre ),
        detalle_cosechas ( calibre, kilos, precio_kilo )
      `)
      .eq('destino', 'Venta')

    if (!error) setRawCosechas(data || [])
    setLoading(false)
  }

  function calcularEstadisticas() {
    let filtradas = rawCosechas

    if (anioSeleccionado !== 'Todos') {
      filtradas = filtradas.filter(c => c.fecha && c.fecha.startsWith(anioSeleccionado))
    }
    if (sectorSeleccionado !== 'Todos') {
        filtradas = filtradas.filter(c => c.sector_id === parseInt(sectorSeleccionado))
    }

    let kTotal = 0
    let dineroTotal = 0
    const calibresMap = {}
    const clientesMap = {}

    filtradas.forEach(c => {
      const cliente = c.clientes?.nombre || 'Desconocido'
      
      c.detalle_cosechas.forEach(d => {
        const k = parseFloat(d.kilos) || 0
        const p = parseFloat(d.precio_kilo) || 0
        
        kTotal += k
        dineroTotal += (k * p)

        const cal = d.calibre || 'Sin Calibre'
        calibresMap[cal] = (calibresMap[cal] || 0) + k
        clientesMap[cliente] = (clientesMap[cliente] || 0) + k
      })
    })

    setStats({
      totalKilos: kTotal,
      ingresoTotal: dineroTotal,
      precioPromedio: kTotal > 0 ? (dineroTotal / kTotal) : 0,
      porCalibre: calibresMap,
      porCliente: clientesMap
    })
  }

  const fmtDinero = (v) => '$ ' + Math.round(v).toLocaleString('es-CL')
  const fmtKilos = (v) => Math.round(v).toLocaleString('es-CL') + ' kg'

  const aniosDisponibles = useMemo(() => {
      const years = new Set(rawCosechas.map(c => c.fecha ? c.fecha.substring(0,4) : null).filter(y => y))
      return Array.from(years).sort().reverse()
  }, [rawCosechas])

  const ordenarCalibres = (entries) => {
    return entries.sort((a, b) => {
       let indexA = ORDEN_CALIBRES.indexOf(a[0])
       let indexB = ORDEN_CALIBRES.indexOf(b[0])
       
       // Si no está en la lista, lo mandamos al final
       if (indexA === -1) indexA = 999
       if (indexB === -1) indexB = 999

       return indexA - indexB
    })
  }

  const styles = {
    container: { display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' },
    toolbar: { display: 'flex', gap: '15px', padding: '15px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', flexWrap: 'wrap', alignItems:'center' },
    select: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', color: '#374151', fontWeight: '500' },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' },
    kpiCard: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    kpiLabel: { fontSize: '0.85rem', color: '#6b7280', marginBottom: '5px' },
    kpiValue: { fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' },
    chartGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' },
    chartCard: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' },
    chartTitle: { fontSize: '1rem', fontWeight: 'bold', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' },
    track: { flex: 1, height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', margin: '0 10px', overflow: 'hidden' },
    fill: (pct, color) => ({ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '4px' }),
    clientRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f9fafb' }
  }

  if (loading) return <div style={{padding:20, color:'#6b7280'}}>Cargando resumen...</div>

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
          <div style={{display:'flex', alignItems:'center', gap:5, color:'#6b7280', marginRight:10}}>
              <Filter size={18}/> <span style={{fontWeight:'bold', fontSize:'0.9rem'}}>FILTROS:</span>
          </div>
          <select value={anioSeleccionado} onChange={e => setAnioSeleccionado(e.target.value)} style={styles.select}>
              <option value="Todos">Todos los Años</option>
              {aniosDisponibles.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={sectorSeleccionado} onChange={e => setSectorSeleccionado(e.target.value)} style={styles.select}>
              <option value="Todos">Todos los Sectores</option>
              {listaSectores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
      </div>

      <div style={styles.kpiGrid}>
          <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Kilos Cosechados</div>
              <div style={{...styles.kpiValue, color:'#16a34a'}}>{fmtKilos(stats.totalKilos)}</div>
              <Scale size={24} style={{float:'right', marginTop:'-30px', opacity:0.2}}/>
          </div>
          <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Ingreso Total (Ventas)</div>
              <div style={{...styles.kpiValue, color:'#2563eb'}}>{fmtDinero(stats.ingresoTotal)}</div>
              <DollarSign size={24} style={{float:'right', marginTop:'-30px', opacity:0.2}}/>
          </div>
          <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Precio Promedio</div>
              <div style={{...styles.kpiValue, color:'#d97706'}}>{fmtDinero(stats.precioPromedio)} / kg</div>
              <TrendingUp size={24} style={{float:'right', marginTop:'-30px', opacity:0.2}}/>
          </div>
      </div>

      <div style={styles.chartGrid}>
          <div style={styles.chartCard}>
              <div style={styles.chartTitle}><PieChart size={20}/> Distribución por Calibre</div>
              {Object.keys(stats.porCalibre).length === 0 && <div style={{fontStyle:'italic', color:'#9ca3af', padding:'20px'}}>No hay registros.</div>}
              
              {ordenarCalibres(Object.entries(stats.porCalibre)).map(([calibre, val]) => {
                  const porcentaje = stats.totalKilos > 0 ? ((val / stats.totalKilos) * 100).toFixed(1) : 0
                  // Color gris para descarte/desecho, verde para el resto
                  const esDescarte = calibre.toLowerCase().includes('descarte') || calibre.toLowerCase().includes('desecho')
                  const colorBarra = esDescarte ? '#9ca3af' : '#16a34a'
                  
                  return (
                      <div key={calibre} style={{marginBottom:12}}>
                          <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.85rem', marginBottom:2}}>
                              <span style={{fontWeight:'bold'}}>{calibre}</span>
                              <span>{fmtKilos(val)} ({porcentaje}%)</span>
                          </div>
                          <div style={styles.track}>
                              <div style={styles.fill(porcentaje, colorBarra)}></div>
                          </div>
                      </div>
                  )
              })}
          </div>

          <div style={styles.chartCard}>
              <div style={styles.chartTitle}><Users size={20}/> Top Clientes ({anioSeleccionado})</div>
              {Object.entries(stats.porCliente)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 8) 
                .map(([cliente, kilos]) => (
                  <div key={cliente} style={styles.clientRow}>
                      <span style={{color:'#374151', fontWeight:'500'}}>{cliente}</span>
                      <span style={{fontWeight:'bold', color:'#1f2937'}}>{fmtKilos(kilos)}</span>
                  </div>
              ))}
          </div>
      </div>
    </div>
  )
}

export default DashboardCosecha