import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { 
  DollarSign, Plus, Search, 
  FileText, Trash2, ArrowUpRight, Shovel, Package, CreditCard,
  LayoutGrid, List, CalendarClock, Tag, User, TrendingUp, AlertCircle, Layers
} from 'lucide-react'
import Modal from '../components/Modal'
import NuevoGasto from './NuevoGasto'
import NuevaLabor from './NuevaLabor'

const formatMoney = (amount) => '$ ' + Math.round(amount || 0).toLocaleString('es-CL')
const formatDate = (dateStr) => {
    if(!dateStr) return '-'
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
}

function Gastos() {
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [activeTab, setActiveTab] = useState('resumen') // Comenzamos en Resumen para ver las tarjetas
  const [filtroMes, setFiltroMes] = useState('Todos')
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear().toString())
  const [busqueda, setBusqueda] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editarId, setEditarId] = useState(null)
  
  const [modalLaborOpen, setModalLaborOpen] = useState(false)
  const [laborIdVer, setLaborIdVer] = useState(null)

  useEffect(() => { cargarGastos() }, [filtroMes, filtroAnio])

  async function cargarGastos() {
    setLoading(true)
    
    // Consulta Explícita
    let query = supabase.from('gastos').select(`
        *,
        labor_origen_id, 
        categorias_gastos!gastos_categoria_id_fkey ( nombre ),
        subcategorias_gastos!gastos_subcategoria_id_fkey ( nombre ),
        proveedores!gastos_proveedor_id_fkey ( nombre ),
        pagos_gastos ( fecha_vencimiento, estado )
    `)

    if (filtroAnio !== 'Todos') {
        const anio = parseInt(filtroAnio)
        if (filtroMes !== 'Todos') {
            const mes = parseInt(filtroMes)
            const fInicio = new Date(anio, mes - 1, 1).toISOString().split('T')[0]
            const fFin = new Date(anio, mes, 0).toISOString().split('T')[0]
            query = query.gte('fecha', fInicio).lte('fecha', fFin)
        } else {
            query = query.gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`)
        }
    }

    const { data, error } = await query.order('fecha', { ascending: false })
    
    if (error) {
        console.error("Error cargando gastos:", error)
        alert("Error cargando tabla: " + error.message)
    }
    setGastos(data || [])
    setLoading(false)
  }

  const getOrigen = (g) => {
      if (g.labor_origen_id) return { label: 'Labor', icon: <Shovel size={14}/>, color: '#f59e0b', bg: '#fffbeb', border:'#fcd34d' }
      if (g.descripcion?.toLowerCase().includes('compra gasto') || g.descripcion?.toLowerCase().includes('bodega')) 
          return { label: 'Bodega', icon: <Package size={14}/>, color: '#0ea5e9', bg: '#e0f2fe', border:'#bae6fd' }
      return { label: 'Directo', icon: <CreditCard size={14}/>, color: '#10b981', bg: '#dcfce7', border:'#86efac' }
  }

  const getProximoVencimiento = (pagos, estadoGeneral) => {
      if (estadoGeneral === 'Pagado') return null
      if (!pagos || pagos.length === 0) return null
      
      const pendientes = pagos
          .filter(p => p.estado === 'Pendiente')
          .sort((a,b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))
      
      if (pendientes.length === 0) return null
      
      const fecha = pendientes[0].fecha_vencimiento
      const diasRestantes = Math.ceil((new Date(fecha) - new Date()) / (1000 * 60 * 60 * 24))
      
      let color = '#374151'
      if (diasRestantes < 0) color = '#ef4444' 
      else if (diasRestantes <= 5) color = '#f59e0b' 

      return { fecha: formatDate(fecha), color, texto: diasRestantes < 0 ? 'Vencido' : (diasRestantes === 0 ? 'Hoy' : '') }
  }

  const StatusBadge = ({ status }) => {
      const colors = {
          'Pagado': { bg: '#dcfce7', text: '#166534', border: '#86efac' },
          'Parcial': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
          'Pendiente': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' }
      }
      const s = colors[status] || colors['Pendiente']
      return (
          <span style={{ padding:'3px 10px', borderRadius:12, fontSize:'0.7rem', fontWeight:'bold', backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
              {status?.toUpperCase()}
          </span>
      )
  }

  const eliminarGasto = async (id) => {
    if (confirm("¿Eliminar este registro de gasto? Esto borrará también sus pagos asociados.")) {
      const { error } = await supabase.from('gastos').delete().eq('id', id)
      if (error) alert("Error: " + error.message)
      else cargarGastos()
    }
  }

  const filtrados = gastos.filter(g => {
    const txt = busqueda.toLowerCase()
    return !busqueda || 
           g.descripcion?.toLowerCase().includes(txt) || 
           g.proveedores?.nombre?.toLowerCase().includes(txt) || 
           g.nro_documento?.includes(txt)
  })

  // --- CÁLCULO DE KPIS ---
  const kpiTotal = filtrados.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0)
  const kpiPendiente = filtrados
    .filter(g => g.estado_pago !== 'Pagado')
    .reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0) // (Simplificado: suma total de docs pendientes)

  const styles = {
    container: { width: '95%', maxWidth: '1600px', margin: '0 auto', padding: '20px 0' },
    header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20 },
    tabs: { display:'flex', gap:5, backgroundColor:'#e5e7eb', padding:4, borderRadius:8 },
    tabBtn: (active) => ({ padding:'8px 16px', borderRadius:6, border:'none', cursor:'pointer', fontWeight:'bold', backgroundColor: active ? 'white' : 'transparent', color: active ? '#111827' : '#6b7280', display:'flex', gap:8, alignItems:'center', transition:'all 0.2s' }),
    
    filterBar: { display:'flex', gap:10, flexWrap:'wrap', backgroundColor:'#fff', padding:15, borderRadius:12, border:'1px solid #e5e7eb', marginBottom:20, alignItems:'center' },
    select: { padding: '8px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem' },
    btnNew: { backgroundColor: '#111827', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, marginLeft:'auto' },
    
    // Grid Cards
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 },
    card: { backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 15, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', position:'relative', transition:'transform 0.2s' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardTitle: { fontWeight: 'bold', color: '#111827', fontSize: '0.95rem', marginBottom: 4 },
    cardSub: { fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 },
    cardFooter: { marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    
    kpiContainer: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:15, marginBottom:20 },
    kpiCard: { backgroundColor:'white', borderRadius:12, padding:15, border:'1px solid #e5e7eb', display:'flex', flexDirection:'column' },
    
    // Tabla
    tableContainer: { borderRadius: 12, border: '1px solid #e5e7eb', overflow:'hidden', backgroundColor: 'white' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
    th: { textAlign: 'left', padding: '12px 10px', backgroundColor: '#f9fafb', color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', fontWeight:'bold' },
    td: { padding: '10px', borderBottom: '1px solid #f3f4f6', verticalAlign:'middle' },
    badgeOrigen: (o) => ({ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, backgroundColor: o.bg, color: o.color, fontSize:'0.75rem', fontWeight:'bold', border:`1px solid ${o.border}` }),
    btnIcon: { border:'none', background:'transparent', cursor:'pointer', padding:6, borderRadius:4, color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center' }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={{fontSize:'1.5rem', fontWeight:'bold', display:'flex', alignItems:'center', gap:10}}><DollarSign size={28}/> Gastos</h1>
        <div style={styles.tabs}>
            <button onClick={() => setActiveTab('resumen')} style={styles.tabBtn(activeTab === 'resumen')}><LayoutGrid size={18}/> Resumen</button>
            <button onClick={() => setActiveTab('historial')} style={styles.tabBtn(activeTab === 'historial')}><List size={18}/> Historial</button>
        </div>
      </div>

      <div style={styles.filterBar}>
        <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)} style={styles.select}>
            <option value="Todos">Año: Todos</option>
            {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={styles.select}>
            <option value="Todos">Mes: Todos</option>
            {['1','2','3','4','5','6','7','8','9','10','11','12'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{position:'relative'}}>
            <Search size={16} color="#9ca3af" style={{position:'absolute', left:10, top:10}}/>
            <input type="text" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{...styles.select, paddingLeft:32}}/>
        </div>
        <button onClick={() => { setEditarId(null); setModalOpen(true) }} style={styles.btnNew}><Plus size={18}/> Nuevo Gasto</button>
      </div>

      {/* --- KPIS SUPERIORES (Siempre visibles o solo en resumen) --- */}
      <div style={styles.kpiContainer}>
           <div style={styles.kpiCard}>
               <span style={{fontSize:'0.8rem', color:'#6b7280', marginBottom:5, fontWeight:'600'}}>Total Gasto</span>
               <span style={{fontSize:'1.5rem', fontWeight:'800', color:'#111827'}}>{formatMoney(kpiTotal)}</span>
           </div>
           <div style={styles.kpiCard}>
               <span style={{fontSize:'0.8rem', color:'#6b7280', marginBottom:5, fontWeight:'600'}}>Pendiente de Pago (Est.)</span>
               <span style={{fontSize:'1.5rem', fontWeight:'800', color:'#ef4444'}}>{formatMoney(kpiPendiente)}</span>
           </div>
           <div style={styles.kpiCard}>
               <span style={{fontSize:'0.8rem', color:'#6b7280', marginBottom:5, fontWeight:'600'}}>Documentos</span>
               <span style={{fontSize:'1.5rem', fontWeight:'800', color:'#2563eb'}}>{filtrados.length}</span>
           </div>
      </div>

      {activeTab === 'resumen' && (
        <div style={styles.grid}>
            {filtrados.length === 0 ? (
                <div style={{gridColumn:'1/-1', textAlign:'center', padding:40, color:'#9ca3af'}}>No hay gastos que mostrar con estos filtros.</div>
            ) : filtrados.map(g => {
                const origen = getOrigen(g)
                return (
                    <div key={g.id} style={styles.card}>
                        {/* Cabecera Tarjeta: Origen y Fecha */}
                        <div style={styles.cardHeader}>
                            <span style={styles.badgeOrigen(origen)}>
                                {origen.icon} {origen.label}
                            </span>
                            <span style={{fontSize:'0.8rem', color:'#9ca3af', fontWeight:'500'}}>{formatDate(g.fecha)}</span>
                        </div>
                        
                        {/* Cuerpo Tarjeta */}
                        <div>
                            <div style={styles.cardTitle}>{g.descripcion}</div>
                            <div style={{...styles.cardSub, marginBottom:4}}>
                                <User size={12}/> {g.proveedores?.nombre || 'Sin Proveedor'}
                            </div>
                            <div style={styles.cardSub}>
                                <Tag size={12}/> {g.categorias_gastos?.nombre} 
                                {g.subcategorias_gastos && <span style={{marginLeft:4}}>• {g.subcategorias_gastos.nombre}</span>}
                            </div>
                        </div>

                        {/* Footer Tarjeta: Monto y Estado */}
                        <div style={styles.cardFooter}>
                            <div style={{display:'flex', flexDirection:'column'}}>
                                <span style={{fontSize:'1.2rem', fontWeight:'800', color:'#111827'}}>{formatMoney(g.monto)}</span>
                                <span style={{fontSize:'0.7rem', color:'#6b7280'}}>{g.tipo_documento} {g.nro_documento ? `#${g.nro_documento}` : ''}</span>
                            </div>
                            <StatusBadge status={g.estado_pago}/>
                        </div>

                        {/* Botones de acción flotantes/integrados */}
                        <div style={{display:'flex', gap:5, marginTop:10, paddingTop:10, borderTop:'1px dashed #f3f4f6', justifyContent:'flex-end'}}>
                             {g.labor_origen_id && (
                                <button title="Ver Labor" onClick={() => { setLaborIdVer(g.labor_origen_id); setModalLaborOpen(true) }} style={{...styles.btnIcon, backgroundColor:'#fffbeb', color:'#d97706'}}>
                                    <ArrowUpRight size={16}/>
                                </button>
                             )}
                             <button onClick={() => { setEditarId(g.id); setModalOpen(true) }} style={{...styles.btnIcon, backgroundColor:'#eff6ff', color:'#2563eb'}}>
                                <FileText size={16}/>
                             </button>
                             <button onClick={() => eliminarGasto(g.id)} style={{...styles.btnIcon, backgroundColor:'#fef2f2', color:'#ef4444'}}>
                                <Trash2 size={16}/>
                             </button>
                        </div>
                    </div>
                )
            })}
        </div>
      )}

      {activeTab === 'historial' && (
        <div style={styles.tableContainer}>
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={{...styles.th, width:'90px'}}>Fecha</th>
                        <th style={{...styles.th, width:'80px'}}>Origen</th>
                        <th style={{...styles.th, width:'110px'}}>Documento</th>
                        <th style={styles.th}>Descripción</th>
                        <th style={{...styles.th, width:'130px'}}>Proveedor</th>
                        <th style={{...styles.th, width:'120px'}}>Categoría</th>
                        <th style={{...styles.th, width:'120px'}}>Subcategoría</th>
                        <th style={{...styles.th, width:'100px'}}>Próx. Venc.</th>
                        <th style={{...styles.th, width:'90px'}}>Estado</th>
                        <th style={{...styles.th, textAlign:'right', width:'100px'}}>Monto</th>
                        <th style={{...styles.th, textAlign:'center', width:'110px'}}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {filtrados.length === 0 ? (
                        <tr><td colSpan="11" style={{padding:20, textAlign:'center', color:'#9ca3af'}}>No se encontraron registros.</td></tr>
                    ) : filtrados.map(g => {
                        const origen = getOrigen(g)
                        const proxVenc = getProximoVencimiento(g.pagos_gastos, g.estado_pago)
                        return (
                            <tr key={g.id}>
                                <td style={styles.td}>{formatDate(g.fecha)}</td>
                                <td style={styles.td}><span style={styles.badgeOrigen(origen)}>{origen.icon} {origen.label}</span></td>
                                <td style={styles.td}>
                                    <div style={{fontWeight:'bold', color:'#374151', fontSize:'0.8rem'}}>{g.tipo_documento}</div>
                                    {g.nro_documento && <div style={{fontSize:'0.75rem', color:'#6b7280'}}>#{g.nro_documento}</div>}
                                </td>
                                <td style={styles.td}><div style={{fontWeight:'500', color:'#111827'}}>{g.descripcion}</div></td>
                                <td style={styles.td}>
                                     {g.proveedores ? <div style={{display:'flex', alignItems:'center', gap:5, color:'#4b5563'}}><User size={12}/> {g.proveedores.nombre}</div> : <span style={{color:'#9ca3af'}}>-</span>}
                                </td>
                                <td style={styles.td}>{g.categorias_gastos ? <span style={{display:'inline-flex', alignItems:'center', gap:4, color:'#4b5563', fontSize:'0.75rem', fontWeight:'600'}}><Tag size={10}/> {g.categorias_gastos.nombre}</span> : '-'}</td>
                                <td style={styles.td}>{g.subcategorias_gastos ? <span style={{fontSize:'0.75rem', color:'#6b7280'}}>{g.subcategorias_gastos.nombre}</span> : <span style={{color:'#d1d5db', fontSize:'0.7rem'}}>N/A</span>}</td>
                                <td style={styles.td}>
                                    {proxVenc ? (
                                        <div style={{display:'flex', alignItems:'center', gap:5, color: proxVenc.color, fontWeight:'bold', fontSize:'0.8rem'}}>
                                            <CalendarClock size={14}/> 
                                            <div>
                                                <div>{proxVenc.fecha}</div>
                                                {proxVenc.texto && <div style={{fontSize:'0.65rem', color:'#ef4444', textTransform:'uppercase'}}>{proxVenc.texto}</div>}
                                            </div>
                                        </div>
                                    ) : <span style={{color:'#d1d5db', fontSize:'0.7rem'}}>-</span>}
                                </td>
                                <td style={styles.td}><StatusBadge status={g.estado_pago}/></td>
                                <td style={{...styles.td, textAlign:'right', fontWeight:'bold', fontFamily:'monospace', fontSize:'0.9rem'}}>{formatMoney(g.monto)}</td>
                                <td style={styles.td}>
                                    <div style={{display:'flex', justifyContent:'center', gap:4}}>
                                        {g.labor_origen_id && (
                                            <button title="Ver Labor Original" onClick={() => { setLaborIdVer(g.labor_origen_id); setModalLaborOpen(true) }} style={{...styles.btnIcon, backgroundColor:'#fffbeb', color:'#d97706', border:'1px solid #fcd34d'}}><ArrowUpRight size={16}/></button>
                                        )}
                                        <button title="Editar Gasto" onClick={() => { setEditarId(g.id); setModalOpen(true) }} style={{...styles.btnIcon, backgroundColor:'#eff6ff', color:'#2563eb'}}><FileText size={16}/></button>
                                        <button title="Eliminar" onClick={() => eliminarGasto(g.id)} style={{...styles.btnIcon, backgroundColor:'#fef2f2', color:'#ef4444'}}><Trash2 size={16}/></button>
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
         {modalOpen && <NuevoGasto idGasto={editarId} cerrarModal={() => setModalOpen(false)} alGuardar={() => { setModalOpen(false); cargarGastos() }} />}
      </Modal>

      <Modal isOpen={modalLaborOpen} onClose={() => setModalLaborOpen(false)} title="Detalle de Labor Original">
         {modalLaborOpen && <NuevaLabor idLabor={laborIdVer} cerrarModal={() => setModalLaborOpen(false)} alGuardar={() => { setModalLaborOpen(false); cargarGastos() }} />}
      </Modal>
    </div>
  )
}

export default Gastos