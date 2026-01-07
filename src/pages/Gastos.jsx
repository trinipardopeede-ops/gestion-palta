import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { 
  DollarSign, Plus, Calendar, Filter, Search, 
  Tag, User, FileText, Trash2, TrendingUp, TrendingDown,
  LayoutGrid, List, MapPin, Globe, CreditCard, ArrowUpDown
} from 'lucide-react'
import Modal from '../components/Modal'
import NuevoGasto from './NuevoGasto'

const formatMoney = (amount) => '$ ' + Math.round(amount || 0).toLocaleString('es-CL')
const formatDate = (dateStr) => {
    if(!dateStr) return '-'
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
}

function Gastos() {
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Maestros para filtros
  const [categorias, setCategorias] = useState([])
  const [proveedores, setProveedores] = useState([])
  
  // Vista Activa
  const [activeTab, setActiveTab] = useState('resumen') // 'resumen' (Tarjetas) | 'historial' (Tabla)

  // Filtros
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear().toString())
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [busqueda, setBusqueda] = useState('')
  
  // Ordenamiento (NUEVO)
  const [orden, setOrden] = useState('fecha_desc') // fecha_desc | fecha_asc | monto_desc | monto_asc

  const [modalOpen, setModalOpen] = useState(false)
  const [editarId, setEditarId] = useState(null)

  useEffect(() => { cargarMaestros() }, [])
  useEffect(() => { cargarGastos() }, [filtroMes, filtroAnio])

  async function cargarMaestros() {
    const [cat, prov] = await Promise.all([
        supabase.from('categorias_gastos').select('id, nombre').order('nombre'),
        supabase.from('proveedores').select('id, nombre').order('nombre')
    ])
    setCategorias(cat.data || [])
    setProveedores(prov.data || [])
  }

  async function cargarGastos() {
    setLoading(true)
    let query = supabase
      .from('gastos')
      .select(`
        *,
        categorias_gastos!gastos_categoria_id_fkey ( nombre ),
        proveedores ( nombre ),
        socios:pagado_por_socio_id ( nombre )
      `)
      .order('fecha', { ascending: false })

    if (filtroAnio && filtroAnio !== 'Todos') {
        const anio = parseInt(filtroAnio)
        if (filtroMes && filtroMes !== 'Todos') {
            const mes = parseInt(filtroMes)
            const fechaInicio = new Date(anio, mes - 1, 1).toISOString().split('T')[0]
            const fechaFin = new Date(anio, mes, 0).toISOString().split('T')[0]
            query = query.gte('fecha', fechaInicio).lte('fecha', fechaFin)
        } else {
            const fechaInicio = `${anio}-01-01`
            const fechaFin = `${anio}-12-31`
            query = query.gte('fecha', fechaInicio).lte('fecha', fechaFin)
        }
    }

    const { data, error } = await query
    if (error) console.error("Error cargando gastos:", error)
    else setGastos(data || [])
    
    setLoading(false)
  }

  const eliminarGasto = async (id) => {
    if (confirm("¿Eliminar este registro de gasto?")) {
      const { error } = await supabase.from('gastos').delete().eq('id', id)
      if (!error) cargarGastos()
    }
  }

  // 1. Filtrado
  const gastosFiltrados = gastos.filter(g => {
    if (filtroCategoria && filtroCategoria !== 'Todos' && g.categoria_id?.toString() !== filtroCategoria) return false
    if (filtroProveedor && filtroProveedor !== 'Todos' && g.proveedor_id?.toString() !== filtroProveedor) return false
    
    const texto = busqueda.toLowerCase()
    return !busqueda || 
           g.descripcion?.toLowerCase().includes(texto) || 
           g.proveedores?.nombre?.toLowerCase().includes(texto) ||
           g.nro_documento?.toLowerCase().includes(texto) ||
           g.monto?.toString().includes(texto)
  })

  // 2. Ordenamiento (NUEVO)
  const gastosOrdenados = [...gastosFiltrados].sort((a, b) => {
      if (orden === 'fecha_desc') return new Date(b.fecha) - new Date(a.fecha)
      if (orden === 'fecha_asc') return new Date(a.fecha) - new Date(b.fecha)
      if (orden === 'monto_desc') return (b.monto || 0) - (a.monto || 0)
      if (orden === 'monto_asc') return (a.monto || 0) - (b.monto || 0)
      return 0
  })

  // Cálculos KPIs
  const totalPeriodo = gastosFiltrados.reduce((acc, g) => acc + (g.monto || 0), 0)
  const totalPagado = gastosFiltrados.filter(g => g.estado_pago === 'Pagado').reduce((acc, g) => acc + (g.monto || 0), 0)
  const totalPendiente = totalPeriodo - totalPagado

  const StatusBadge = ({ status }) => {
      const isPaid = status === 'Pagado'
      return (
          <span style={{
              padding:'4px 10px', borderRadius:12, fontSize:'0.75rem', fontWeight:'bold',
              backgroundColor: isPaid ? '#dcfce7' : '#fee2e2', color: isPaid ? '#166534' : '#991b1b',
              border: isPaid ? '1px solid #86efac' : '1px solid #fca5a5', display:'inline-block'
          }}>
              {status?.toUpperCase()}
          </span>
      )
  }

  const styles = {
    container: { width: '95%', maxWidth: '1400px', margin: '0 auto', padding: '20px 0' },
    header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20 },
    title: { fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', display: 'flex', alignItems: 'center', gap: 10 },
    
    tabsContainer: { display:'flex', gap:5, backgroundColor:'#e5e7eb', padding:4, borderRadius:8 },
    tabBtn: (active) => ({
        padding:'8px 16px', borderRadius:6, border:'none', cursor:'pointer', fontWeight:'bold', fontSize:'0.9rem',
        backgroundColor: active ? 'white' : 'transparent', color: active ? '#111827' : '#6b7280', display:'flex', gap:8, alignItems:'center',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
    }),

    // KPIs
    kpiBar: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 20 },
    kpiCard: (bg, border) => ({ backgroundColor: bg, padding: 20, borderRadius: 16, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 5 }),
    kpiLabel: { fontSize: '0.8rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' },
    kpiValue: { fontSize: '2rem', fontWeight: '800', color: '#111827' },

    // Filtros
    controls: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 20 },
    filterGroup: { display:'flex', alignItems:'center', gap:5 },
    labelFilter: { fontSize:'0.85rem', fontWeight:'bold', color:'#6b7280' },
    select: { padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem', minWidth: 140, cursor:'pointer' },
    inputSearch: { padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem', width: 200, paddingLeft:32 },
    btnNew: { backgroundColor: '#1f2937', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 },

    // VISTA TARJETAS
    gridCards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 },
    card: { backgroundColor: 'white', borderRadius: 12, padding: 0, border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow:'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    cardHeader: { padding:15, display:'flex', gap:15, alignItems:'center', borderBottom:'1px solid #f3f4f6' },
    dateBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60, paddingRight: 15, borderRight: '1px solid #f3f4f6' },
    day: { fontSize: '1.5rem', fontWeight: 'bold', color: '#374151', lineHeight: 1 },
    month: { fontSize: '0.75rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 'bold' },
    year: { fontSize: '0.7rem', color: '#9ca3af' },
    cardBody: { padding:15, flex:1 },
    cardFooter: { padding: '10px 15px', backgroundColor:'#f9fafb', borderTop:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' },
    
    // VISTA TABLA
    tableContainer: { backgroundColor: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
    th: { textAlign: 'left', padding: '12px 15px', backgroundColor: '#f9fafb', color: '#6b7280', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' },
    td: { padding: '12px 15px', borderBottom: '1px solid #f3f4f6', color: '#374151', verticalAlign:'middle' },
    badge: { display:'inline-flex', alignItems:'center', gap:4, backgroundColor:'#f3f4f6', padding:'2px 8px', borderRadius:6, border:'1px solid #e5e7eb', fontSize:'0.75rem', color:'#4b5563' },
    
    btnIcon: { border:'none', background:'transparent', cursor:'pointer', padding:5, borderRadius:4, color:'#6b7280' }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}><DollarSign size={28} /> Gestión de Gastos</h1>
        <div style={styles.tabsContainer}>
            <button onClick={() => setActiveTab('resumen')} style={styles.tabBtn(activeTab === 'resumen')}>
                <LayoutGrid size={16}/> Resumen
            </button>
            <button onClick={() => setActiveTab('historial')} style={styles.tabBtn(activeTab === 'historial')}>
                <List size={16}/> Historial
            </button>
        </div>
      </div>

      <div style={styles.kpiBar}>
            <div style={styles.kpiCard('white', '#d1d5db')}>
                <span style={styles.kpiLabel}>Gasto Total (Periodo)</span>
                <span style={styles.kpiValue}>{formatMoney(totalPeriodo)}</span>
            </div>
            <div style={styles.kpiCard('#f0fdf4', '#bbf7d0')}>
                <div style={{display:'flex', justifyContent:'space-between'}}><span style={{...styles.kpiLabel, color:'#166534'}}>Pagado</span><TrendingUp size={20} color="#16a34a"/></div>
                <span style={{...styles.kpiValue, color:'#166534'}}>{formatMoney(totalPagado)}</span>
            </div>
            <div style={styles.kpiCard('#fef2f2', '#fecaca')}>
                <div style={{display:'flex', justifyContent:'space-between'}}><span style={{...styles.kpiLabel, color:'#991b1b'}}>Deuda Pendiente</span><TrendingDown size={20} color="#ef4444"/></div>
                <span style={{...styles.kpiValue, color:'#991b1b'}}>{formatMoney(totalPendiente)}</span>
            </div>
      </div>

      <div style={styles.controls}>
        {/* Filtros Izquierda */}
        <div style={styles.filterGroup}>
            <span style={styles.labelFilter}>Año:</span>
            <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)} style={styles.select}>
                <option value="Todos">Todos</option>
                {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
        </div>

        <div style={styles.filterGroup}>
            <span style={styles.labelFilter}>Mes:</span>
            <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={styles.select}>
                <option value="Todos">Todos</option>
                {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m,i) => (
                    <option key={i} value={i+1}>{m}</option>
                ))}
            </select>
        </div>

        <div style={styles.filterGroup}>
            <span style={styles.labelFilter}>Categoría:</span>
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={styles.select}>
                <option value="Todos">Todas</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
        </div>

        <div style={styles.filterGroup}>
            <span style={styles.labelFilter}>Proveedor:</span>
            <select value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)} style={styles.select}>
                <option value="Todos">Todos</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
        </div>

        {/* Grupo Derecha: Ordenar, Buscar, Nuevo */}
        <div style={{display:'flex', alignItems:'center', gap:10, marginLeft:'auto'}}>
            
            {/* CONTROL ORDENAR */}
            <div style={styles.filterGroup}>
                <ArrowUpDown size={16} color="#6b7280"/>
                <select value={orden} onChange={e => setOrden(e.target.value)} style={styles.select}>
                    <option value="fecha_desc">Más Recientes</option>
                    <option value="fecha_asc">Más Antiguos</option>
                    <option value="monto_desc">Mayor Monto</option>
                    <option value="monto_asc">Menor Monto</option>
                </select>
            </div>

            <div style={{position:'relative'}}>
                <Search size={16} color="#9ca3af" style={{position:'absolute', left:10, top:10}}/>
                <input 
                    type="text" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    style={styles.inputSearch}
                />
            </div>

            <button onClick={() => { setEditarId(null); setModalOpen(true) }} style={styles.btnNew}>
                <Plus size={18}/> Nuevo
            </button>
        </div>
      </div>

      {loading && <div style={{padding:40, textAlign:'center', color:'#9ca3af'}}>Cargando registros...</div>}

      {/* VISTA 1: RESUMEN (TARJETAS) */}
      {!loading && activeTab === 'resumen' && (
          <div style={styles.gridCards}>
              {gastosOrdenados.map(g => {
                  const fecha = new Date(g.fecha)
                  const dia = fecha.getDate()
                  const mes = fecha.toLocaleString('es-ES', { month: 'short' }).toUpperCase()
                  const anio = fecha.getFullYear()
                  const isGlobal = !g.sectores_ids || g.sectores_ids.length === 0

                  return (
                      <div key={g.id} style={styles.card}>
                          <div style={styles.cardHeader}>
                              <div style={styles.dateBox}>
                                  <span style={styles.day}>{dia}</span>
                                  <span style={styles.month}>{mes}</span>
                                  <span style={styles.year}>{anio}</span>
                              </div>
                              <div style={{flex:1}}>
                                  <div style={{fontSize:'1rem', fontWeight:'bold', color:'#1f2937', marginBottom:5}}>{g.descripcion}</div>
                                  <div style={{display:'flex', gap:5, flexWrap:'wrap'}}>
                                      <span style={styles.badge}><Tag size={12}/> {g.categorias_gastos?.nombre || 'General'}</span>
                                      {g.proveedores && <span style={styles.badge}><User size={12}/> {g.proveedores.nombre}</span>}
                                  </div>
                              </div>
                          </div>
                          
                          <div style={styles.cardBody}>
                              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:10}}>
                                  <div>
                                      <div style={{fontSize:'0.75rem', color:'#6b7280', marginBottom:2}}>Monto Total</div>
                                      <div style={{fontSize:'1.5rem', fontWeight:'800', color:'#111827'}}>{formatMoney(g.monto)}</div>
                                  </div>
                                  <StatusBadge status={g.estado_pago} />
                              </div>
                              
                              <div style={{fontSize:'0.8rem', color:'#6b7280', display:'flex', flexDirection:'column', gap:4}}>
                                  {g.nro_documento && <div style={{display:'flex', gap:6}}><FileText size={14}/> Doc: {g.nro_documento}</div>}
                                  <div style={{display:'flex', gap:6, alignItems:'center'}}>
                                      {isGlobal ? <Globe size={14}/> : <MapPin size={14}/>}
                                      {isGlobal ? 'Gasto Global (Todo el campo)' : `Asignado a ${g.sectores_ids.length} sectores`}
                                  </div>
                                  {g.estado_pago === 'Pagado' && g.socios && (
                                      <div style={{display:'flex', gap:6, color:'#166534'}}>
                                          <CreditCard size={14}/> Pagado por: {g.socios.nombre}
                                      </div>
                                  )}
                              </div>
                          </div>

                          <div style={styles.cardFooter}>
                              <span style={{fontSize:'0.75rem', color:'#9ca3af'}}>ID: {g.id}</span>
                              <div style={{display:'flex', gap:10}}>
                                  <button onClick={() => { setEditarId(g.id); setModalOpen(true) }} style={{...styles.btnIcon, color:'#4b5563', fontWeight:'bold'}}>Editar</button>
                                  <button onClick={() => eliminarGasto(g.id)} style={{...styles.btnIcon, color:'#ef4444'}}>Eliminar</button>
                              </div>
                          </div>
                      </div>
                  )
              })}
          </div>
      )}

      {/* VISTA 2: HISTORIAL (TABLA) */}
      {!loading && activeTab === 'historial' && (
          <div style={styles.tableContainer}>
              <table style={styles.table}>
                  <thead>
                      <tr>
                          <th style={styles.th}>Fecha</th>
                          <th style={styles.th}>Categoría</th>
                          <th style={styles.th}>Proveedor</th>
                          <th style={styles.th}>Descripción</th>
                          <th style={styles.th}>Sectores</th>
                          <th style={styles.th}>Estado</th>
                          <th style={{...styles.th, textAlign:'right'}}>Monto</th>
                          <th style={{...styles.th, textAlign:'center'}}>Acciones</th>
                      </tr>
                  </thead>
                  <tbody>
                      {gastosOrdenados.map(g => {
                          const isGlobal = !g.sectores_ids || g.sectores_ids.length === 0
                          return (
                              <tr key={g.id}>
                                  <td style={styles.td}>{formatDate(g.fecha)}</td>
                                  <td style={{...styles.td, fontWeight:'bold'}}>{g.categorias_gastos?.nombre}</td>
                                  <td style={styles.td}>{g.proveedores?.nombre || '-'}</td>
                                  <td style={styles.td}>
                                      <div>{g.descripcion}</div>
                                      {g.nro_documento && <div style={{fontSize:'0.75rem', color:'#9ca3af'}}>#{g.nro_documento}</div>}
                                  </td>
                                  <td style={styles.td}>
                                       {isGlobal ? (
                                           <span style={styles.badge}><Globe size={10}/> Global</span>
                                       ) : (
                                           <span style={{...styles.badge, backgroundColor:'#eff6ff', color:'#1e40af', border:'1px solid #bfdbfe'}}>
                                               <MapPin size={10}/> {g.sectores_ids.length}
                                           </span>
                                       )}
                                  </td>
                                  <td style={styles.td}><StatusBadge status={g.estado_pago}/></td>
                                  <td style={{...styles.td, textAlign:'right', fontWeight:'bold', fontFamily:'monospace', fontSize:'1rem'}}>
                                      {formatMoney(g.monto)}
                                  </td>
                                  <td style={styles.td}>
                                      <div style={{display:'flex', justifyContent:'center', gap:5}}>
                                          <button onClick={() => { setEditarId(g.id); setModalOpen(true) }} style={{...styles.btnIcon, backgroundColor:'#f3f4f6'}}>
                                              <FileText size={16}/>
                                          </button>
                                          <button onClick={() => eliminarGasto(g.id)} style={{...styles.btnIcon, color:'#ef4444', backgroundColor:'#fef2f2'}}>
                                              <Trash2 size={16}/>
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                          )
                      })}
                  </tbody>
              </table>
          </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editarId ? "Editar Gasto" : "Registrar Nuevo Gasto"}>
         {modalOpen && (
            <NuevoGasto 
                idGasto={editarId}
                cerrarModal={() => setModalOpen(false)}
                alGuardar={() => { setModalOpen(false); cargarGastos() }}
            />
         )}
      </Modal>
    </div>
  )
}

export default Gastos