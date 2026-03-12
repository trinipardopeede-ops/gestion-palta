import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { 
    Package, Plus, ArrowUpCircle, ArrowDownCircle, Search, AlertTriangle, 
    History, Pencil, Trash2, Shovel, FileText, DollarSign, ArrowUpDown
} from 'lucide-react'
import Modal from '../components/Modal'
import NuevoProducto from './NuevoProducto'
import NuevoMovimientoBodega from './NuevoMovimientoBodega'
import NuevaLabor from './NuevaLabor'

// Grupos de categorías de bodega — deben coincidir con NuevoProducto.jsx
const GRUPOS_CATEGORIA = {
  'Insumos Agrícolas':        ['Fertilizante','Pesticida / Fungicida','Herbicida','Corrector de suelo','Estimulante / Bioestimulante'],
  'Materiales de Riego':      ['Tubería / Manguera','Aspersor / Gotero','Fitting / Conector','Filtro','Válvula'],
  'Materiales de Soporte':    ['Tutor / Poste','Malla / Red','Alambre / Amarre','Plástico / Cobertura'],
  'Herramientas y Equipos':   ['Herramienta manual','Equipo menor','Repuesto / Pieza','Equipamiento seguridad'],
  'Combustibles y Lubricantes': ['Combustible','Lubricante / Aceite'],
  'Otro':                     ['Otro']
}

const FILTROS_CATEGORIA = ['Todos', ...Object.keys(GRUPOS_CATEGORIA)]

function Bodega() {
  const [productos, setProductos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [labores, setLabores] = useState([])

  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState('inventario')
  const [filtroGlobal, setFiltroGlobal] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('Todos')
  const [filtrosHistorial, setFiltrosHistorial] = useState({ tipo: 'Todos' })
  const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'desc' })

  const [modalProductoOpen, setModalProductoOpen] = useState(false)
  const [modalMovimientoOpen, setModalMovimientoOpen] = useState(false)
  const [modalLaborOpen, setModalLaborOpen] = useState(false)

  const [productoEditar, setProductoEditar] = useState(null)
  const [movimientoConfig, setMovimientoConfig] = useState(null)
  const [movimientoAEditar, setMovimientoAEditar] = useState(null)
  const [laborEditarId, setLaborEditarId] = useState(null)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [resProd, resMov, resLab] = await Promise.all([
        supabase.from('bodega_insumos').select('*').eq('activo', true).order('nombre'),
        supabase.from('bodega_movimientos').select('*').order('fecha', { ascending: false }).limit(300),
        supabase.from('labores').select('id, tipo_labor, descripcion'),
      ])
      if (resProd.data) setProductos(resProd.data)
      if (resMov.data) setMovimientos(resMov.data)
      if (resLab.data) setLabores(resLab.data)
    } catch (error) {
      console.error("Error cargando bodega:", error)
      alert("Error de conexión. Revisa la consola.")
    } finally {
      setLoading(false)
    }
  }

  const getMovimientoEnriquecido = (mov) => {
    const insumo = productos.find(p => p.id === mov.insumo_id)

    if (mov.labor_id) {
      const labor = labores.find(l => l.id === mov.labor_id)
      return {
        ...mov,
        nombreInsumo: insumo ? insumo.nombre : 'Item Borrado',
        unidad: insumo ? insumo.unidad_medida : '-',
        esSistema: true, origenId: mov.labor_id, tipo: 'Labor',
        label: labor ? `Labor: ${labor.tipo_labor}` : 'Labor',
        icono: <Shovel size={14} color="#d97706"/>,
        detalle: labor ? labor.descripcion : 'Labor eliminada',
        nroDoc: '-'
      }
    }

    return {
      ...mov,
      nombreInsumo: insumo ? insumo.nombre : 'Item Borrado',
      unidad: insumo ? insumo.unidad_medida : '-',
      esSistema: false, origenId: null, tipo: 'Manual',
      label: mov.referencia?.split(' - ')[0] || (mov.tipo_movimiento === 'Entrada' ? 'Entrada manual' : 'Salida'),
      icono: <Package size={14} color="#4b5563"/>,
      detalle: mov.referencia?.includes(' - ') ? mov.referencia.split(' - ').slice(1).join(' - ') : (mov.referencia || '-'),
      nroDoc: '-'
    }
  }

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
  }

  const getMovimientosProcesados = () => {
    let data = movimientos.map(m => getMovimientoEnriquecido(m))
    data = data.filter(m => {
      if (filtrosHistorial.tipo !== 'Todos' && m.tipo_movimiento !== filtrosHistorial.tipo) return false
      if (filtroGlobal && !m.nombreInsumo.toLowerCase().includes(filtroGlobal.toLowerCase())) return false
      return true
    })
    return data.sort((a, b) => {
      let valA = a[sortConfig.key], valB = b[sortConfig.key]
      if (sortConfig.key === 'insumo') { valA = a.nombreInsumo; valB = b.nombreInsumo }
      if (sortConfig.key === 'origen') { valA = a.label; valB = b.label }
      if (sortConfig.key === 'cantidad') { valA = parseFloat(a.cantidad); valB = parseFloat(b.cantidad) }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }

  const abrirNuevoProducto = () => { setProductoEditar(null); setModalProductoOpen(true) }
  const abrirEditarProducto = (prod) => { setProductoEditar(prod); setModalProductoOpen(true) }

  const abrirMovimientoDesdeTarjeta = (tipo, prod) => {
    setMovimientoConfig({ tipo, producto: prod })
    setMovimientoAEditar(null)
    setModalMovimientoOpen(true)
  }

  const archivarProducto = async (id) => {
    if (confirm("¿Archivar este producto? Ya no aparecerá en el inventario.")) {
      await supabase.from('bodega_insumos').update({ activo: false }).eq('id', id)
      cargarDatos()
    }
  }

  const handleEditarMovimiento = (movEnriquecido) => {
    const movRaw = movimientos.find(m => m.id === movEnriquecido.id) || movEnriquecido
    if (movEnriquecido.tipo === 'Labor') {
      setLaborEditarId(movEnriquecido.origenId)
      setModalLaborOpen(true)
    } else {
      const prod = productos.find(p => p.id === movRaw.insumo_id)
      setMovimientoConfig({ tipo: movEnriquecido.tipo_movimiento, producto: prod })
      setMovimientoAEditar(movRaw)
      setModalMovimientoOpen(true)
    }
  }

  const handleEliminarMovimiento = async (mov) => {
    if (mov.tipo === 'Labor') return alert("⛔ Movimiento protegido por Labor. Edita la labor para modificarlo.")
    if (confirm("¿Eliminar este movimiento? Se revertirá el stock.")) {
      const { error } = await supabase.from('bodega_movimientos').delete().eq('id', mov.id)
      if (error) alert(error.message)
      else cargarDatos()
    }
  }

  // Filtro de productos con soporte de categoría
  const productosFiltrados = productos.filter(p => {
    if (filtroGlobal && !p.nombre.toLowerCase().includes(filtroGlobal.toLowerCase())) return false
    if (filtroCategoria !== 'Todos') {
      const subcats = GRUPOS_CATEGORIA[filtroCategoria] || []
      if (!subcats.includes(p.categoria) && p.categoria !== filtroCategoria) return false
    }
    return true
  })

  const movsProcesados = getMovimientosProcesados()
  const fmtMoney = (n) => '$ ' + Math.round(n || 0).toLocaleString('es-CL')

  const ThSort = ({ label, sortKey, width, align = 'left' }) => (
    <th style={{ ...styles.th, width, textAlign: align }} onClick={() => handleSort(sortKey)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', gap: 5, cursor: 'pointer' }}>
        {label}
        {sortConfig.key === sortKey && <ArrowUpDown size={12} color="#2563eb" />}
      </div>
    </th>
  )

  const styles = {
    container: { padding: '20px', width: '100%', boxSizing: 'border-box', maxWidth: '1600px', margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' },
    title: { fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '10px' },
    tabs: { display: 'flex', gap: 5, backgroundColor: '#e5e7eb', padding: 4, borderRadius: 8 },
    tab: (active) => ({ padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', backgroundColor: active ? 'white' : 'transparent', color: active ? '#111827' : '#6b7280', boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', display: 'flex', alignItems: 'center', gap: 6 }),
    searchBar: { display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '8px 15px', borderRadius: '8px', border: '1px solid #d1d5db', minWidth: '260px' },
    searchInput: { border: 'none', outline: 'none', marginLeft: '10px', width: '100%', fontSize: '0.95rem' },
    btnNew: { backgroundColor: '#1f2937', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: 12 },
    card: { backgroundColor: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' },
    prodName: { fontSize: '1.1rem', fontWeight: 'bold', color: '#1f2937' },
    prodCat: { fontSize: '0.72rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '12px', marginTop: '4px', display: 'inline-block', fontWeight: '600' },
    stockBig: { fontSize: '2rem', fontWeight: '800', color: '#1f2937' },
    stockUnit: { fontSize: '1rem', color: '#6b7280', fontWeight: 'normal', marginLeft: '5px' },
    valorTotal: { fontSize: '0.85rem', color: '#059669', fontWeight: 'bold', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4, backgroundColor: '#ecfdf5', padding: '4px 8px', borderRadius: 6, width: 'fit-content' },
    actionsRow: { display: 'flex', gap: '10px', marginTop: '15px', borderTop: '1px solid #f3f4f6', paddingTop: '15px' },
    btnAction: (bg, col) => ({ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: bg, color: col }),
    tableContainer: { backgroundColor: 'white', borderRadius: '12px', overflowX: 'auto', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', marginTop: 16 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '900px' },
    th: { backgroundColor: '#f9fafb', padding: '12px 15px', textAlign: 'left', fontSize: '0.75rem', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' },
    td: { padding: '10px 15px', color: '#374151', verticalAlign: 'middle' },
    badge: (tipo) => ({ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: tipo === 'Entrada' ? '#dcfce7' : '#fee2e2', color: tipo === 'Entrada' ? '#166534' : '#991b1b' }),
    origenBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '0.75rem', color: '#4b5563', border: '1px solid #e5e7eb' },
    btnIcon: { border: 'none', background: 'none', cursor: 'pointer', padding: 4 },
    chipCat: (active) => ({ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', backgroundColor: active ? '#1f2937' : '#f3f4f6', color: active ? 'white' : '#4b5563', whiteSpace: 'nowrap' })
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h1 style={styles.title}><Package color="#2563eb" /> Bodega</h1>
          <div style={styles.tabs}>
            <button onClick={() => setActiveTab('inventario')} style={styles.tab(activeTab === 'inventario')}><Package size={16} /> Inventario</button>
            <button onClick={() => setActiveTab('historial')} style={styles.tab(activeTab === 'historial')}><History size={16} /> Historial</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={styles.searchBar}>
            <Search size={18} color="#9ca3af" />
            <input type="text" placeholder="Buscar producto..." style={styles.searchInput} value={filtroGlobal} onChange={e => setFiltroGlobal(e.target.value)} />
          </div>
          {/* Botón Nueva Compra eliminado — las compras se registran desde Gastos */}
          {activeTab === 'inventario' && (
            <button onClick={abrirNuevoProducto} style={styles.btnNew}><Plus size={18} /> Nuevo Producto</button>
          )}
        </div>
      </div>

      {loading && <div style={{ padding: 20, color: '#6b7280' }}>Cargando datos...</div>}

      {/* ===== TAB INVENTARIO ===== */}
      {!loading && activeTab === 'inventario' && (
        <>
          {/* Chips de filtro por categoría */}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
            {FILTROS_CATEGORIA.map(cat => (
              <button key={cat} onClick={() => setFiltroCategoria(cat)} style={styles.chipCat(filtroCategoria === cat)}>
                {cat === 'Todos' ? '📦 Todos' :
                 cat === 'Insumos Agrícolas' ? '🌱 ' + cat :
                 cat === 'Materiales de Riego' ? '💧 ' + cat :
                 cat === 'Materiales de Soporte' ? '🪵 ' + cat :
                 cat === 'Herramientas y Equipos' ? '🔧 ' + cat :
                 cat === 'Combustibles y Lubricantes' ? '⛽ ' + cat :
                 '📦 ' + cat}
              </button>
            ))}
          </div>

          {/* Contador */}
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: 4 }}>
            {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''}
            {filtroCategoria !== 'Todos' ? ` en ${filtroCategoria}` : ''}
          </div>

          <div style={styles.grid}>
            {productosFiltrados.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#9ca3af', fontStyle: 'italic' }}>
                No hay productos en esta categoría.
              </div>
            )}
            {productosFiltrados.map(p => (
              <div key={p.id} style={styles.card}>
                <div>
                  <div style={styles.cardHeader}>
                    <div>
                      <div style={styles.prodName}>{p.nombre}</div>
                      <span style={styles.prodCat}>{p.categoria}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => abrirEditarProducto(p)} style={styles.btnIcon} title="Editar"><Pencil size={16} color="#9ca3af" /></button>
                      <button onClick={() => archivarProducto(p.id)} style={styles.btnIcon} title="Archivar"><Trash2 size={16} color="#ef4444" /></button>
                    </div>
                  </div>
                  <div style={{ margin: '15px 0' }}>
                    <div style={styles.stockBig}>
                      {parseFloat(p.stock_actual).toLocaleString('es-CL')}
                      <span style={styles.stockUnit}>{p.unidad_medida}</span>
                    </div>
                    <div style={styles.valorTotal}>
                      <DollarSign size={12} />
                      Valor: {fmtMoney(p.stock_actual * p.costo_promedio)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>
                      PMP: <strong>{fmtMoney(p.costo_promedio)}</strong> / {p.unidad_medida}
                    </div>
                    {p.stock_actual <= p.stock_minimo && p.stock_minimo > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#ef4444', fontSize: '0.8rem', fontWeight: 'bold', marginTop: 8, backgroundColor: '#fef2f2', padding: 6, borderRadius: 6 }}>
                        <AlertTriangle size={14} /> Stock Crítico (Mín: {p.stock_minimo})
                      </div>
                    )}
                  </div>
                </div>
                <div style={styles.actionsRow}>
                  <button onClick={() => abrirMovimientoDesdeTarjeta('Entrada', p)} style={styles.btnAction('#dcfce7', '#166534')}><ArrowUpCircle size={18} /> Entrada</button>
                  <button onClick={() => abrirMovimientoDesdeTarjeta('Salida', p)} style={styles.btnAction('#fee2e2', '#991b1b')}><ArrowDownCircle size={18} /> Salida</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== TAB HISTORIAL ===== */}
      {!loading && activeTab === 'historial' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['Todos', 'Entrada', 'Salida'].map(t => (
              <button key={t} onClick={() => setFiltrosHistorial({ tipo: t })} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', backgroundColor: filtrosHistorial.tipo === t ? '#1f2937' : '#f3f4f6', color: filtrosHistorial.tipo === t ? 'white' : '#4b5563' }}>
                {t}
              </button>
            ))}
          </div>

          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <ThSort label="Fecha" sortKey="fecha" width={100} />
                  <ThSort label="Insumo" sortKey="insumo" />
                  <ThSort label="Tipo" sortKey="tipo_movimiento" width={100} />
                  <ThSort label="Origen / Motivo" sortKey="origen" />
                  <th style={styles.th}>Detalle</th>
                  <ThSort label="Cantidad" sortKey="cantidad" width={130} align="right" />
                  <th style={{ ...styles.th, width: 80 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movsProcesados.map((mov, index) => {
                  const colorCantidad = mov.tipo_movimiento === 'Entrada' ? '#166534' : '#991b1b'
                  const prevMov = movsProcesados[index - 1]
                  let isNewGroup = true
                  if (mov.esSistema && mov.tipo === 'Compra' && mov.origenId) {
                    if (prevMov && prevMov.origenId === mov.origenId) isNewGroup = false
                  }
                  return (
                    <tr key={mov.id} style={{ borderTop: isNewGroup ? '2px solid #64748b' : '1px solid #f1f5f9', backgroundColor: mov.tipo === 'Compra' ? '#f8fafc' : 'white' }}>
                      <td style={styles.td}>{(isNewGroup || mov.tipo !== 'Compra') ? (mov.fecha ? mov.fecha.split('-').reverse().join('/') : '-') : ''}</td>
                      <td style={{ ...styles.td, fontWeight: 'bold' }}>{mov.nombreInsumo}</td>
                      <td style={styles.td}>
                        <span style={styles.badge(mov.tipo_movimiento)}>
                          {mov.tipo_movimiento === 'Entrada' ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
                          {mov.tipo_movimiento}
                        </span>
                      </td>
                      <td style={styles.td}>{(isNewGroup || mov.tipo !== 'Compra') && <div style={styles.origenBadge}>{mov.icono} {mov.label}</div>}</td>
                      <td style={{ ...styles.td, fontSize: '0.8rem', color: '#6b7280' }}>{mov.detalle}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: colorCantidad }}>
                        {mov.tipo_movimiento === 'Entrada' ? '+' : '-'}{parseFloat(mov.cantidad).toLocaleString('es-CL')} {mov.unidad}
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 5 }}>
                          <button
                            onClick={() => handleEditarMovimiento(mov)}
                            title={mov.tipo === 'Compra' ? "Ver en Gastos" : "Editar"}
                            style={{ ...styles.btnIcon, color: mov.esSistema ? '#2563eb' : '#4b5563', backgroundColor: mov.esSistema ? '#eff6ff' : 'transparent', borderRadius: 4 }}>
                            {mov.esSistema ? <FileText size={16} /> : <Pencil size={16} />}
                          </button>
                          <button
                            onClick={() => handleEliminarMovimiento(mov)}
                            style={{ ...styles.btnIcon, color: mov.esSistema ? '#d1d5db' : '#ef4444', cursor: mov.esSistema ? 'not-allowed' : 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {movsProcesados.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontStyle: 'italic' }}>
                      No hay movimientos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MODALES */}
      <Modal isOpen={modalMovimientoOpen} onClose={() => setModalMovimientoOpen(false)} title={`${movimientoAEditar ? 'Editar' : 'Registrar'} ${movimientoConfig?.tipo || 'Movimiento'}`}>
        {modalMovimientoOpen && (
          <NuevoMovimientoBodega
            config={movimientoConfig}
            movimientoEditar={movimientoAEditar}
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