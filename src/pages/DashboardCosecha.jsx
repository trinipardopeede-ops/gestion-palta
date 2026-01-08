import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { Sprout, DollarSign, Scale, TrendingUp, BarChart as BarChartIcon, Users } from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList 
} from 'recharts'

const ORDEN_CALIBRES = ["Extra", "Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Descarte", "Desecho"]
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function DashboardCosecha() {
  const [loading, setLoading] = useState(true)
  const [rawCosechas, setRawCosechas] = useState([]) 
  
  // Maestros
  const [listaSectores, setListaSectores] = useState([])
  const [listaClientes, setListaClientes] = useState([])
  
  // Filtros
  const [filtroAnio, setFiltroAnio] = useState('Todos')
  const [filtroMes, setFiltroMes] = useState('Todos')
  const [filtroCliente, setFiltroCliente] = useState('Todos')
  const [filtroSector, setFiltroSector] = useState('Todos')
  
  const [stats, setStats] = useState({
    totalKilos: 0,
    ingresoTotal: 0,
    precioPromedio: 0,
    porCalibre: {}, 
    porCliente: {}  
  })

  useEffect(() => { cargarDatos() }, [])
  useEffect(() => { calcularEstadisticas() }, [rawCosechas, filtroAnio, filtroMes, filtroCliente, filtroSector])

  async function cargarDatos() {
    setLoading(true)
    try {
        const { data: sectores } = await supabase.from('sectores').select('id, nombre').order('nombre')
        if (sectores) setListaSectores(sectores)
        
        const { data: clientes } = await supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre')
        if (clientes) setListaClientes(clientes)

        const { data, error } = await supabase
          .from('cosechas')
          .select(`
            id, fecha, destino, sector_id, cliente_id,
            detalle_cosechas ( calibre, kilos, precio_kilo )
          `)
          .eq('destino', 'Venta')

        if (error) throw error
        
        if (data && data.length > 0) {
            const anios = [...new Set(data.map(c => c.fecha?.split('-')[0]))].sort().reverse()
            if(anios.length > 0) setFiltroAnio(anios[0])
        }

        setRawCosechas(data || [])
    } catch (err) {
        console.error("Error cargando cosechas:", err)
    } finally {
        setLoading(false)
    }
  }

  function calcularEstadisticas() {
    let filtradas = rawCosechas

    // 1. Filtros
    if (filtroAnio !== 'Todos') {
      filtradas = filtradas.filter(c => c.fecha && c.fecha.startsWith(filtroAnio))
    }
    if (filtroMes !== 'Todos') {
       const mesIndex = parseInt(filtroMes)
       filtradas = filtradas.filter(c => {
           if(!c.fecha) return false
           const m = parseInt(c.fecha.split('-')[1])
           return m === mesIndex
       })
    }
    if (filtroSector !== 'Todos') {
        filtradas = filtradas.filter(c => c.sector_id?.toString() === filtroSector)
    }
    if (filtroCliente !== 'Todos') {
        filtradas = filtradas.filter(c => c.cliente_id?.toString() === filtroCliente)
    }

    // 2. Cálculos
    let kTotal = 0
    let dineroTotal = 0
    
    // NOTA: Ahora porCalibre guardará un objeto { kilos, dinero }
    const calibresMap = {}
    const clientesMap = {}

    filtradas.forEach(c => {
      const clienteObj = listaClientes.find(cli => cli.id === c.cliente_id)
      const clienteNombre = clienteObj ? clienteObj.nombre : 'Desconocido'
      
      const detalles = c.detalle_cosechas || []
      
      detalles.forEach(d => {
        const k = parseFloat(d.kilos) || 0
        const p = parseFloat(d.precio_kilo) || 0
        
        kTotal += k
        dineroTotal += (k * p)

        const cal = d.calibre || 'Sin Calibre'
        
        // Inicializamos si no existe
        if (!calibresMap[cal]) calibresMap[cal] = { kilos: 0, dinero: 0 }
        
        // Acumulamos
        calibresMap[cal].kilos += k
        calibresMap[cal].dinero += (k * p)

        clientesMap[clienteNombre] = (clientesMap[clienteNombre] || 0) + k
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

  const dataClientes = Object.entries(stats.porCliente)
     .map(([name, kilos]) => ({ name, kilos }))
     .sort((a,b) => b.kilos - a.kilos)
     .slice(0, 10)

  // Preparación de datos Calibres (Ahora calculamos precio promedio unitario)
  const dataCalibres = Object.entries(stats.porCalibre)
     .sort((a,b) => {
        let idxA = ORDEN_CALIBRES.indexOf(a[0]); if(idxA===-1) idxA=999
        let idxB = ORDEN_CALIBRES.indexOf(b[0]); if(idxB===-1) idxB=999
        return idxA - idxB
     })
     .map(([name, obj]) => ({ 
        name, 
        value: obj.kilos,
        // Precio Promedio = Total Dinero de ese calibre / Total Kilos de ese calibre
        precioPromedio: obj.kilos > 0 ? (obj.dinero / obj.kilos) : 0,
        percentage: stats.totalKilos > 0 ? (obj.kilos / stats.totalKilos) * 100 : 0 
     }))

  // --- ETIQUETAS PERSONALIZADAS: KILOS (ARRIBA), % (CENTRO-ARRIBA), PRECIO (ABAJO) ---
  const renderCustomLabel = (props) => {
    const { x, y, width, height, value, index } = props;
    const item = dataCalibres[index];
    const percent = item?.percentage || 0;
    const precio = item?.precioPromedio || 0;
    
    // Solo mostrar info interna si la barra tiene altura suficiente (>40px)
    const mostrarInfoInterna = height > 40; 

    return (
      <g>
        {/* 1. Kilos: Arriba de la barra */}
        <text 
            x={x + width / 2} 
            y={y - 5} 
            fill="#374151" 
            textAnchor="middle" 
            dominantBaseline="bottom"
            style={{fontSize: '0.9rem', fontWeight: '800'}} 
        >
            {value.toLocaleString('es-CL')}
        </text>
        
        {mostrarInfoInterna && (
            <>
                {/* 2. Porcentaje: DENTRO (Arriba) */}
                <text 
                    x={x + width / 2} 
                    y={y + 18} 
                    fill="#ffffff" 
                    textAnchor="middle" 
                    dominantBaseline="middle"
                    style={{
                        fontSize: '0.75rem', 
                        fontWeight: '600',
                        textShadow: '0px 1px 2px rgba(0,0,0,0.5)' 
                    }}
                >
                    {percent.toFixed(1)}%
                </text>

                {/* 3. Precio Unitario: DENTRO (Abajo - Parte Inferior de la barra) */}
                <text 
                    x={x + width / 2} 
                    y={y + height - 12} // Posición calculada desde abajo hacia arriba
                    fill="#ffffff" 
                    textAnchor="middle" 
                    dominantBaseline="middle"
                    style={{
                        fontSize: '0.75rem', 
                        fontWeight: '400',
                        fontStyle: 'italic',
                        textShadow: '0px 1px 2px rgba(0,0,0,0.5)'
                    }}
                >
                    {fmtDinero(precio)}
                </text>
            </>
        )}
      </g>
    );
  };

  const styles = {
    toolbar: { display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap', alignItems:'center', backgroundColor:'white', padding:15, borderRadius:12, border:'1px solid #e5e7eb' },
    headerTool: { display:'flex', alignItems:'center', gap:10, marginRight:'auto', minWidth:200 },
    iconBox: { backgroundColor:'#f0fdf4', padding:8, borderRadius:8 },
    titleTool: { margin:0, color:'#1f2937', fontSize:'1.1rem' },
    subTitleTool: { fontSize:'0.8rem', color:'#6b7280' },
    selectGroup: { display:'flex', flexDirection:'column', gap:4 },
    labelSelect: { fontSize:'0.7rem', fontWeight:'bold', color:'#6b7280', textTransform:'uppercase' },
    select: { padding:'8px 10px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'0.85rem', minWidth:130, cursor:'pointer' },

    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom:30 },
    kpiCard: (bg, color) => ({ 
        backgroundColor: bg, padding: '20px', borderRadius: '16px', border: `1px solid ${bg}`, 
        boxShadow: '0 2px 5px rgba(0,0,0,0.03)', display:'flex', flexDirection:'column', gap:5
    }),
    kpiLabel: { fontSize: '0.85rem', fontWeight:'bold', color: '#6b7280', textTransform: 'uppercase' },
    kpiValue: { fontSize: '2rem', fontWeight: '800', color: '#1f2937' },
    
    chartGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' },
    chartCard: { 
        backgroundColor: 'white', padding: '20px', borderRadius: '16px', 
        border: '1px solid #e5e7eb', boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
        minWidth: 0, 
    },
    chartContainer: { width: '100%', height: 350, marginTop: 20 },
    chartTitle: { fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color:'#374151' },
  }

  if (loading) return <div style={{padding:40, textAlign:'center', color:'#6b7280'}}>Cargando producción...</div>

  return (
    <div>
      <div style={styles.toolbar}>
          <div style={styles.headerTool}>
            <div style={styles.iconBox}><Sprout color="#16a34a" size={20}/></div>
            <div>
                <h3 style={styles.titleTool}>Producción</h3>
                <span style={styles.subTitleTool}>Kilos y ventas</span>
            </div>
          </div>
          
          <div style={styles.selectGroup}>
            <span style={styles.labelSelect}>Año</span>
            <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)} style={styles.select}>
                <option value="Todos">Todos</option>
                {aniosDisponibles.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div style={styles.selectGroup}>
            <span style={styles.labelSelect}>Mes</span>
            <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={styles.select}>
                <option value="Todos">Todos</option>
                {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>

          <div style={styles.selectGroup}>
            <span style={styles.labelSelect}>Cliente</span>
            <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={styles.select}>
                <option value="Todos">Todos</option>
                {listaClientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div style={styles.selectGroup}>
            <span style={styles.labelSelect}>Sector</span>
            <select value={filtroSector} onChange={e => setFiltroSector(e.target.value)} style={styles.select}>
                <option value="Todos">Todos</option>
                {listaSectores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
      </div>

      <div style={styles.kpiGrid}>
          <div style={styles.kpiCard('#f0fdf4', '#166534')}>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={styles.kpiLabel}>Total Cosechado</span>
                  <Scale size={20} color="#16a34a"/>
              </div>
              <span style={{...styles.kpiValue, color:'#166534'}}>{fmtKilos(stats.totalKilos)}</span>
          </div>

          <div style={styles.kpiCard('#eff6ff', '#1e40af')}>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={styles.kpiLabel}>Ingreso Total</span>
                  <DollarSign size={20} color="#2563eb"/>
              </div>
              <span style={{...styles.kpiValue, color:'#1e40af'}}>{fmtDinero(stats.ingresoTotal)}</span>
          </div>

          <div style={styles.kpiCard('#fff7ed', '#9a3412')}>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={styles.kpiLabel}>Precio Promedio</span>
                  <TrendingUp size={20} color="#ea580c"/>
              </div>
              <span style={{...styles.kpiValue, color:'#c2410c'}}>{fmtDinero(stats.precioPromedio)} <span style={{fontSize:'1rem'}}>/ kg</span></span>
          </div>
      </div>

      <div style={styles.chartGrid}>
          {/* GRÁFICO 1: DISTRIBUCIÓN CALIBRES */}
          <div style={styles.chartCard}>
              <div style={styles.chartTitle}><BarChartIcon size={20}/> Distribución por Calibre</div>
              
              {dataCalibres.length === 0 ? (
                  <div style={{height: 350, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontStyle:'italic'}}>
                      No hay datos para mostrar.
                  </div> 
              ) : (
                  <div style={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dataCalibres} margin={{top:30, right:30, left:0, bottom:0}}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb"/>
                            <XAxis dataKey="name" tick={{fontSize:11, fill:'#6b7280'}} axisLine={false} tickLine={false} interval={0} />
                            <YAxis hide/>
                            <Tooltip cursor={{fill: '#f9fafb'}} formatter={(val) => fmtKilos(val)}/>
                            <Bar dataKey="value" radius={[6,6,0,0]}>
                                {dataCalibres.map((entry, index) => {
                                    const esMalo = ['Descarte', 'Desecho'].includes(entry.name)
                                    return <Cell key={`cell-${index}`} fill={esMalo ? '#9ca3af' : '#16a34a'} />
                                })}
                                <LabelList dataKey="value" content={renderCustomLabel} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                  </div>
              )}
          </div>

          {/* GRÁFICO 2: TOP CLIENTES */}
          <div style={styles.chartCard}>
              <div style={styles.chartTitle}><Users size={20}/> Top Clientes</div>
              {dataClientes.length === 0 ? (
                  <div style={{height: 350, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontStyle:'italic'}}>
                      No hay ventas registradas.
                  </div>
              ) : (
                  <div style={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dataClientes} layout="vertical" margin={{top:5, right:30, left:20, bottom:5}}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb"/>
                            <XAxis type="number" hide/>
                            <YAxis type="category" dataKey="name" width={90} tick={{fontSize:11, fill:'#4b5563', fontWeight:500}} axisLine={false} tickLine={false}/>
                            <Tooltip 
                                formatter={(val) => fmtKilos(val)} 
                                cursor={{fill: '#f9fafb'}}
                                contentStyle={{borderRadius:8, border:'none', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}
                            />
                            <Bar dataKey="kilos" fill="#3b82f6" radius={[0,4,4,0]} barSize={25} />
                        </BarChart>
                    </ResponsiveContainer>
                  </div>
              )}
          </div>
      </div>
    </div>
  )
}

export default DashboardCosecha