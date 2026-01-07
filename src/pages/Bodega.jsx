import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { 
    Package, Plus, ArrowUpCircle, ArrowDownCircle, Search, AlertTriangle, 
    History, Pencil, Trash2, Filter, Shovel, FileText 
} from 'lucide-react'
import Modal from '../components/Modal'
import NuevoProducto from './NuevoProducto'
import NuevoMovimientoBodega from './NuevoMovimientoBodega'
import NuevaLabor from './NuevaLabor'

function Bodega() {
  const [productos, setProductos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  
  // TABS Y FILTROS
  const [activeTab, setActiveTab] = useState('inventario')
  const [filtroGlobal, setFiltroGlobal] = useState('')
  const [filtrosHistorial, setFiltrosHistorial] = useState({ tipo: 'Todos' })
  
  // MODALES
  const [modalProductoOpen, setModalProductoOpen] = useState(false)
  const [modalMovimientoOpen, setModalMovimientoOpen] = useState(false)
  const [modalLaborOpen, setModalLaborOpen] = useState(false)
  
  const [productoEditar, setProductoEditar] = useState(null) 
  const [movimientoConfig, setMovimientoConfig] = useState(null) // { tipo, producto }
  const [movimientoAEditar, setMovimientoAEditar] = useState(null) // El movimiento histórico a editar
  
  const [laborEditarId, setLaborEditarId] = useState(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    
    const [resProductos, resMovimientos] = await Promise.allSettled([
        supabase.from('bodega_insumos').select('*').eq('activo', true).order('nombre'),
        supabase.from('bodega_movimientos')
            .select(`
                *,
                bodega_insumos:bodega_insumos!fk_movimiento_insumo ( id, nombre, unidad_medida, stock_actual, costo_promedio ),
                labores:labores!fk_movimiento_labor ( id, tipo_labor, descripcion )
            `)
            .order('fecha', { ascending: false })
            .limit(200)
    ])

    if (resProductos.status === 'fulfilled' && resProductos.value.data) {
        const rawData = resProductos.value.data
        const unicos = [...new Map(rawData.map(item => [item['id'], item])).values()]
        setProductos(unicos)
    }

    if (resMovimientos.status === 'fulfilled' && resMovimientos.value.data) {
        setMovimientos(resMovimientos.value.data)
    }
    
    setLoading(false)
  }

  const parseOrigen = (mov) => {
      if (mov.labor_id && mov.labores) {
          return {
              esSistema: true,
              origenId: mov.labor_id,
              tipo: 'Labor',
              label: `Labor: ${mov.labores.tipo_labor}`,
              icono: <Shovel size={14} color="#d97706"/>,
              detalle: mov.labores.descripcion || 'Sin detalle'
          }
      }
      return {
          esSistema: false,
          origenId: null,
          tipo: 'Manual',
          label: 'Directo Bodega',
          icono: <Package size={14} color="#4b5563"/>,
          detalle: mov.referencia || '-'
      }
  }

  const abrirNuevoProducto = () => { setProductoEditar(null); setModalProductoOpen(true) }
  const abrirEditarProducto = (prod) => { setProductoEditar(prod); setModalProductoOpen(true) }
  
  // Nuevo movimiento (desde cero)
  const abrirMovimiento = (tipo, prod) => { 
      setMovimientoConfig({ tipo, producto: prod })
      setMovimientoAEditar(null) 
      setModalMovimientoOpen(true) 
  }

  const archivarProducto = async (id) => {
      if(confirm("¿Archivar producto? Desaparecerá de la lista pero se mantendrá el historial.")) {
          await supabase.from('bodega_insumos').update({ activo: false }).eq('id', id)
          cargarDatos()
      }
  }

  // --- CORRECCIÓN CLAVE: PERMITIR EDICIÓN ---
  const handleEditarMovimiento = (mov) => {
      const info = parseOrigen(mov)
      if (info.esSistema) {
          setLaborEditarId(info.origenId)
          setModalLaborOpen(true)
      } else {
          // AHORA SÍ PERMITIMOS EDITAR
          // Preparamos la configuración como si fuera uno nuevo, pero pasamos el objeto a editar
          setMovimientoConfig({ 
              tipo: mov.tipo_movimiento, 
              producto: mov.bodega_insumos // Pasamos el producto relacionado
          })
          setMovimientoAEditar(mov) // Guardamos el registro completo para llenar el form
          setModalMovimientoOpen(true)
      }
  }

  const handleEliminarMovimiento = async (mov) => {
      const info = parseOrigen(mov)
      if (info.esSistema) return alert("⛔ Movimiento protegido por Labor.")
      
      if(confirm("¿Eliminar este movimiento? Se revertirá el stock.")) {
          const { error } = await supabase.from('bodega_movimientos').delete().eq('id', mov.id)
          if (error) alert("Error: " + error.message)
          else cargarDatos()
      }
  }

  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(filtroGlobal.toLowerCase()) || 
    p.categoria?.toLowerCase().includes(filtroGlobal.toLowerCase())
  )

  const movimientosFiltrados = movimientos.filter(m => {
      if (filtrosHistorial.tipo !== 'Todos' && m.tipo_movimiento !== filtrosHistorial.tipo) return false
      const nombreInsumo = m.bodega_insumos?.nombre || ''
      if (filtroGlobal && !nombreInsumo.toLowerCase().includes(filtroGlobal.toLowerCase())) return false
      return true
  })

  const fmtMoney = (n) => '$ ' + Math.round(n || 0).toLocaleString('es-CL')

  const styles = {
    container: { padding: '20px', maxWidth: '1400px', margin: '0 auto', width: '90%' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap:'wrap', gap:'15px' },
    title: { fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937', display:'flex', alignItems:'center', gap:'10px' },
    tabs: { display: 'flex', gap: 5, backgroundColor: '#e5e7eb', padding: 4, borderRadius: 8, width: 'fit-content' },
    tab: (active) => ({
        padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
        backgroundColor: active ? 'white' : 'transparent', color: active ? '#111827' : '#6b7280',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', display:'flex', alignItems:'center', gap:6
    }),
    searchBar: { display:'flex', alignItems:'center', backgroundColor:'white', padding:'8px 15px', borderRadius:'8px', border:'1px solid #d1d5db', width:'300px' },
    searchInput: { border:'none', outline:'none', marginLeft:'10px', width:'100%', fontSize:'0.95rem' },
    btnNew: { backgroundColor: '#1f2937', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', display:'flex', alignItems:'center', gap:'8px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: 20 },
    card: { backgroundColor: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display:'flex', flexDirection:'column', justifyContent:'space-between' },
    cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' },
    prodName: { fontSize: '1.1rem', fontWeight: 'bold', color: '#1f2937' },
    prodCat: { fontSize: '0.75rem', color: '#6b7280', backgroundColor:'#f3f4f6', padding:'2px 8px', borderRadius:'12px', marginTop:'4px', display:'inline-block', fontWeight:'600' },
    stockBlock: { margin: '15px 0' },
    stockBig: { fontSize: '2rem', fontWeight: '800', color: '#1f2937' },
    stockUnit: { fontSize: '1rem', color: '#6b7280', fontWeight:'normal', marginLeft:'5px' },
    pmpLabel: { fontSize: '0.8rem', color: '#6b7280', marginTop: 2 },
    actionsRow: { display:'flex', gap:'10px', marginTop:'15px', borderTop:'1px solid #f3f4f6', paddingTop:'15px' },
    btnAction: (color, bg) => ({ flex:1, padding:'10px', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:'bold', fontSize:'0.85rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', backgroundColor: bg, color: color }),
    tableContainer: { backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', marginTop: 20 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
    th: { backgroundColor: '#f9fafb', padding: '12px 15px', textAlign: 'left', fontSize: '0.75rem', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', borderBottom:'1px solid #e5e7eb' },
    td: { padding: '12px 15px', borderBottom: '1px solid #f3f4f6', color: '#374151' },
    badge: (tipo) => ({
        padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', display:'inline-flex', alignItems:'center', gap:4,
        backgroundColor: tipo === 'Entrada' ? '#dcfce7' : '#fee2e2', color: tipo === 'Entrada' ? '#166534' : '#991b1b'
    }),
    origenBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '0.75rem', color: '#4b5563', border: '1px solid #e5e7eb' },
    btnIcon: { border: 'none', background: 'none', cursor: 'pointer', padding: 4 }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
            <h1 style={styles.title}><Package color="#2563eb"/> Bodega</h1>
            <div style={styles.tabs}>
                <button onClick={() => setActiveTab('inventario')} style={styles.tab(activeTab === 'inventario')}>
                    <Package size={16}/> Inventario
                </button>
                <button onClick={() => setActiveTab('historial')} style={styles.tab(activeTab === 'historial')}>
                    <History size={16}/> Historial
                </button>
            </div>
        </div>
        
        <div style={{display:'flex', gap:10, alignItems:'center'}}>
            <div style={styles.searchBar}>
                <Search size={18} color="#9ca3af"/>
                <input 
                    type="text" 
                    placeholder={activeTab === 'inventario' ? "Buscar insumo..." : "Buscar movimiento..."}
                    style={styles.searchInput}
                    value={filtroGlobal}
                    onChange={e => setFiltroGlobal(e.target.value)}
                />
            </div>
            {activeTab === 'inventario' && (
                <button onClick={abrirNuevoProducto} style={styles.btnNew}><Plus size={18}/> Nuevo</button>
            )}
        </div>
      </div>

      {loading && <div style={{padding:20, color:'#6b7280'}}>Cargando datos...</div>}

      {!loading && activeTab === 'inventario' && (
          <div style={styles.grid}>
            {productosFiltrados.map(p => (
                <div key={p.id} style={styles.card}>
                    <div>
                        <div style={styles.cardHeader}>
                            <div>
                                <div style={styles.prodName}>{p.nombre}</div>
                                <span style={styles.prodCat}>{p.categoria}</span>
                            </div>
                            <div style={{display:'flex', gap:5}}>
                                <button onClick={() => abrirEditarProducto(p)} style={styles.btnIcon} title="Editar"><Pencil size={16} color="#9ca3af"/></button>
                                <button onClick={() => archivarProducto(p.id)} style={styles.btnIcon} title="Archivar"><Trash2 size={16} color="#ef4444"/></button>
                            </div>
                        </div>
                        <div style={styles.stockBlock}>
                            <div style={styles.stockBig}>
                                {parseFloat(p.stock_actual).toLocaleString('es-CL')} 
                                <span style={styles.stockUnit}>{p.unidad_medida}</span>
                            </div>
                            <div style={styles.pmpLabel}>
                                PMP: <strong>{fmtMoney(p.costo_promedio)}</strong> / {p.unidad_medida}
                            </div>
                            {p.stock_actual <= p.stock_minimo && (
                                <div style={{display:'flex', alignItems:'center', gap:5, color:'#ef4444', fontSize:'0.8rem', fontWeight:'bold', marginTop:8, backgroundColor:'#fef2f2', padding:6, borderRadius:6}}>
                                    <AlertTriangle size={14}/> Stock Crítico (Min: {p.stock_minimo})
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={styles.actionsRow}>
                        <button onClick={() => abrirMovimiento('Entrada', p)} style={styles.btnAction('#166534', '#dcfce7')}>
                            <ArrowUpCircle size={18}/> Entrada
                        </button>
                        <button onClick={() => abrirMovimiento('Salida', p)} style={styles.btnAction('#991b1b', '#fee2e2')}>
                            <ArrowDownCircle size={18}/> Salida
                        </button>
                    </div>
                </div>
            ))}
          </div>
      )}

      {!loading && activeTab === 'historial' && (
          <div style={styles.tableContainer}>
              <table style={styles.table}>
                  <thead>
                      <tr>
                          <th style={styles.th}>Fecha</th>
                          <th style={styles.th}>Insumo</th>
                          <th style={styles.th}>Tipo</th>
                          <th style={styles.th}>Origen / Ref</th>
                          <th style={styles.th}>Detalle</th>
                          <th style={{...styles.th, textAlign:'right'}}>Cantidad</th>
                          <th style={{...styles.th, width:80}}>Acciones</th>
                      </tr>
                  </thead>
                  <tbody>
                      {movimientosFiltrados.map(mov => {
                          const info = parseOrigen(mov)
                          const colorCantidad = mov.tipo_movimiento === 'Entrada' ? '#166534' : '#991b1b'
                          return (
                              <tr key={mov.id}>
                                  <td style={styles.td}>{mov.fecha ? mov.fecha.split('-').reverse().join('/') : '-'}</td>
                                  <td style={{...styles.td, fontWeight:'bold'}}>{mov.bodega_insumos?.nombre || 'Desconocido'}</td>
                                  <td style={styles.td}>
                                      <span style={styles.badge(mov.tipo_movimiento)}>
                                          {mov.tipo_movimiento === 'Entrada' ? <ArrowUpCircle size={12}/> : <ArrowDownCircle size={12}/>}
                                          {mov.tipo_movimiento}
                                      </span>
                                  </td>
                                  <td style={styles.td}>
                                      <div style={styles.origenBadge}>{info.icono} {info.label}</div>
                                  </td>
                                  <td style={{...styles.td, fontSize:'0.8rem', color:'#6b7280'}}>{info.detalle}</td>
                                  <td style={{...styles.td, textAlign:'right', fontFamily:'monospace', fontWeight:'bold', color: colorCantidad}}>
                                      {mov.tipo_movimiento === 'Entrada' ? '+' : '-'}{parseFloat(mov.cantidad).toLocaleString('es-CL')} {mov.bodega_insumos?.unidad_medida}
                                  </td>
                                  <td style={styles.td}>
                                      <div style={{display:'flex', justifyContent:'flex-end', gap:5}}>
                                          <button 
                                              onClick={() => handleEditarMovimiento(mov)}
                                              title="Editar Movimiento"
                                              style={{...styles.btnIcon, color: info.esSistema ? '#2563eb' : '#4b5563', backgroundColor: info.esSistema ? '#eff6ff' : 'transparent', borderRadius:4}}
                                          >
                                              {info.esSistema ? <FileText size={16}/> : <Pencil size={16}/>}
                                          </button>
                                          <button 
                                              onClick={() => handleEliminarMovimiento(mov)}
                                              style={{...styles.btnIcon, color: info.esSistema ? '#d1d5db' : '#ef4444', cursor: info.esSistema ? 'not-allowed' : 'pointer'}}
                                          >
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
      
      {/* MODAL REGISTRO / EDICIÓN MOVIMIENTO */}
      <Modal isOpen={modalMovimientoOpen} onClose={() => setModalMovimientoOpen(false)} title={`${movimientoAEditar ? 'Editar' : 'Registrar'} ${movimientoConfig?.tipo || 'Movimiento'}`}>
          {modalMovimientoOpen && (
            <NuevoMovimientoBodega 
                config={movimientoConfig}
                movimientoEditar={movimientoAEditar} // PASAMOS EL OBJETO DE EDICION
                cerrar={() => setModalMovimientoOpen(false)}
                alGuardar={() => { setModalMovimientoOpen(false); cargarDatos() }}
            />
          )}
      </Modal>

      <Modal isOpen={modalLaborOpen} onClose={() => setModalLaborOpen(false)} title="Editar Labor (Origen)">
          {modalLaborOpen && <NuevaLabor idLabor={laborEditarId} cerrarModal={() => setModalLaborOpen(false)} alGuardar={() => { setModalLaborOpen(false); cargarDatos() }} />}
      </Modal>
      <Modal isOpen={modalProductoOpen} onClose={() => setModalProductoOpen(false)} title={productoEditar ? "Editar Producto" : "Nuevo Producto"}>
          {modalProductoOpen && <NuevoProducto producto={productoEditar} cerrar={() => setModalProductoOpen(false)} alGuardar={() => { setModalProductoOpen(false); cargarDatos() }} />}
      </Modal>
    </div>
  )
}

export default Bodega