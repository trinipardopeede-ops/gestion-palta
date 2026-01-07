import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { 
  Shovel, Plus, Trash2, Pencil, ArrowUpDown, Filter, Map, User,
  Droplets, TestTube, Scissors, Leaf, Hammer, ClipboardList, Package, CircleDot, LayoutGrid, Calendar
} from 'lucide-react'
import Modal from '../components/Modal'
import NuevaLabor from './NuevaLabor'

// Iconos visuales
const ICONOS_VISUALES = {
  'Riego': <Droplets size={18} color="#3b82f6"/>,
  'Fertilización': <TestTube size={18} color="#8b5cf6"/>,
  'Poda': <Scissors size={18} color="#f59e0b"/>,
  'Anillado': <CircleDot size={18} color="#d97706"/>,
  'Fitosanitario': <Leaf size={18} color="#ef4444"/>,
  'Mantenimiento': <Hammer size={18} color="#6b7280"/>,
  'Limpieza': <Leaf size={18} color="#10b981"/>,
  'Otros': <ClipboardList size={18} color="#9ca3af"/>
}

// Diccionario Texto
const EMOJIS_TIPO = {
  'Riego': '💧 Riego',
  'Fertilización': '🧪 Fertilización',
  'Poda': '✂️ Poda',
  'Anillado': '⭕ Anillado',
  'Fitosanitario': '💊 Fitosanitario',
  'Mantenimiento': '🛠️ Mantenimiento',
  'Limpieza': '🧹 Limpieza',
  'Otros': '📋 Otros'
}

function Labores() {
  const [labores, setLabores] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Listas filtros y Maestros
  const [listaParcelas, setListaParcelas] = useState([])
  const [listaSectores, setListaSectores] = useState([]) 
  const [listaProveedores, setListaProveedores] = useState([])
  const [aniosDisponibles, setAniosDisponibles] = useState([])
  
  // Mapas
  const [mapaSectores, setMapaSectores] = useState({})
  const [mapaParcelas, setMapaParcelas] = useState({})

  // Estado Filtros
  const [filtros, setFiltros] = useState({
      anio: new Date().getFullYear().toString(),
      tipo: 'Todos',
      parcela: 'Todos',
      sector: 'Todos',
      proveedor: 'Todos',
      mes: 'Todos'
  })

  const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'desc' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)

  const fmtMoney = (m) => '$ ' + Math.round(m).toLocaleString('es-CL')
  const fmtFecha = (f) => f ? f.split('-').reverse().join('/') : ''

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    
    // 1. Cargar Maestros
    const { data: parc } = await supabase.from('parcelas').select('id, nombre').eq('activo', true).order('nombre')
    const { data: sect } = await supabase.from('sectores').select('id, nombre, parcela_id').eq('activo', true).order('nombre')
    const { data: prov } = await supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre')
    
    setListaParcelas(parc || [])
    setListaSectores(sect || [])
    setListaProveedores(prov || [])

    // Mapas
    const mapSec = {}; (sect || []).forEach(s => mapSec[s.id] = s)
    setMapaSectores(mapSec)
    const mapPar = {}; (parc || []).forEach(p => mapPar[p.id] = p.nombre)
    setMapaParcelas(mapPar)

    // 2. Cargar Labores
    const { data, error } = await supabase
        .from('labores')
        .select(`*, proveedores ( nombre )`)
        .order('fecha', { ascending: false })
    
    if (error) console.error("Error al cargar:", error)
    else {
        setLabores(data || [])
        // Extraer años únicos para el filtro
        const years = [...new Set((data || []).map(l => l.fecha.substring(0, 4)))].sort((a,b) => b - a)
        setAniosDisponibles(years)
    }

    setLoading(false)
  }

  const eliminar = async (id) => {
      if(confirm("¿Eliminar esta labor?")) {
          await supabase.from('labores').delete().eq('id', id)
          cargarDatos()
      }
  }

  const handleSort = (key) => {
      setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
  }

  const getDataProcesada = () => {
      let data = labores.filter(l => {
          if (filtros.anio !== 'Todos') {
              const anioLabor = l.fecha.substring(0, 4)
              if (anioLabor !== filtros.anio) return false
          }
          if (filtros.tipo !== 'Todos' && l.tipo_labor !== filtros.tipo) return false
          
          if (filtros.parcela !== 'Todos') {
              const ids = l.sectores_ids || []
              const pertenece = ids.some(id => mapaSectores[id]?.parcela_id.toString() === filtros.parcela)
              if (!pertenece) return false
          }

          if (filtros.sector !== 'Todos') {
               const ids = l.sectores_ids || []
               if (!ids.includes(parseInt(filtros.sector))) return false
          }

          if (filtros.proveedor !== 'Todos') {
              if (filtros.proveedor === 'Interno') {
                  if (l.proveedor_id) return false 
              } else {
                  if (!l.proveedor_id || l.proveedor_id.toString() !== filtros.proveedor) return false
              }
          }

          if (filtros.mes !== 'Todos') {
              const mesLabor = new Date(l.fecha).getMonth() + 1
              if (mesLabor.toString() !== filtros.mes) return false
          }
          return true
      })

      return data.sort((a, b) => {
          let valA = a[sortConfig.key]
          let valB = b[sortConfig.key]
          
          if (sortConfig.key === 'costo_total') {
             valA = Number(valA); valB = Number(valB);
          }

          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
          return 0
      })
  }

  const dataFinal = getDataProcesada()

  const styles = {
    container: { width: '95%', maxWidth: '1600px', margin: '0 auto', padding: '20px 0' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', display:'flex', alignItems:'center', gap:10 },
    
    filterBar: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap:'wrap', backgroundColor: '#f9fafb', padding: '15px', borderRadius: '12px', border: '1px solid #e5e7eb' },
    labelFilter: { fontSize: '0.85rem', fontWeight: 'bold', color: '#4b5563', marginRight: 5, display:'flex', alignItems:'center', gap:5 },
    selectControl: { padding: '8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', color: '#374151', minWidth: 120 },

    tableContainer: { backgroundColor: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', tableLayout: 'fixed' }, 
    
    th: { textAlign: 'left', padding: '12px 15px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, cursor:'pointer' },
    thRight: { textAlign: 'right', padding: '12px 15px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, cursor:'pointer' },
    
    td: { padding: '10px 15px', borderBottom: '1px solid #f3f4f6', color: '#374151', verticalAlign:'middle', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
    tdRight: { padding: '10px 15px', borderBottom: '1px solid #f3f4f6', color: '#374151', verticalAlign:'middle', textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
    
    insumoChip: { fontSize:'0.8rem', color:'#4b5563', display:'block', marginBottom: 2 }, 
    sectorsCell: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', display: 'block' }
  }

  const ThSort = ({ k, label, align = 'left', width }) => (
      <th style={{...(align === 'right' ? styles.thRight : styles.th), width}} onClick={() => handleSort(k)}>
          <div style={{display:'flex', alignItems:'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', gap:5}}>
              {label} {sortConfig.key === k && <ArrowUpDown size={14}/>}
          </div>
      </th>
  )

  return (
    <div style={styles.container}>
      <div style={styles.header}>
         <h1 style={styles.title}><Shovel size={28}/> Registro de Labores</h1>
         <button onClick={() => { setEditId(null); setModalOpen(true) }} style={{ backgroundColor:'#1f2937', color:'white', border:'none', padding:'10px 20px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
            <Plus size={18} /> Registrar Labor
         </button>
      </div>

      <div style={styles.filterBar}>
          <div>
              <span style={styles.labelFilter}><Calendar size={14}/> Año:</span>
              <select value={filtros.anio} onChange={e => setFiltros({...filtros, anio: e.target.value})} style={styles.selectControl}>
                  <option value="Todos">Todos</option>
                  {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
          </div>
          <div>
              <span style={styles.labelFilter}>Mes:</span>
              <select value={filtros.mes} onChange={e => setFiltros({...filtros, mes: e.target.value})} style={styles.selectControl}>
                  <option value="Todos">Todos</option>
                  {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((mes, i) => (
                      <option key={i} value={(i+1).toString()}>{i+1} - {mes}</option>
                  ))}
              </select>
          </div>
          <div>
              <span style={styles.labelFilter}><Filter size={14}/> Tipo:</span>
              <select value={filtros.tipo} onChange={e => setFiltros({...filtros, tipo: e.target.value})} style={styles.selectControl}>
                  <option value="Todos">Todos</option>
                  {Object.keys(EMOJIS_TIPO).map(key => <option key={key} value={key}>{EMOJIS_TIPO[key]}</option>)}
              </select>
          </div>
          <div>
              <span style={styles.labelFilter}><Map size={14}/> Parcela:</span>
              <select value={filtros.parcela} onChange={e => setFiltros({...filtros, parcela: e.target.value})} style={styles.selectControl}>
                  <option value="Todos">Todas</option>
                  {listaParcelas.map(p => <option key={p.id} value={p.id.toString()}>{p.nombre}</option>)}
              </select>
          </div>
          <div>
              <span style={styles.labelFilter}><LayoutGrid size={14}/> Sector:</span>
              <select value={filtros.sector} onChange={e => setFiltros({...filtros, sector: e.target.value})} style={styles.selectControl}>
                  <option value="Todos">Todos</option>
                  {listaSectores.filter(s => filtros.parcela === 'Todos' || s.parcela_id.toString() === filtros.parcela).map(s => (
                      <option key={s.id} value={s.id.toString()}>{s.nombre}</option>
                  ))}
              </select>
          </div>
          <div>
              <span style={styles.labelFilter}><User size={14}/> Proveedor:</span>
              <select value={filtros.proveedor} onChange={e => setFiltros({...filtros, proveedor: e.target.value})} style={styles.selectControl}>
                  <option value="Todos">Todos</option>
                  <option value="Interno">Interno</option>
                  {listaProveedores.map(p => <option key={p.id} value={p.id.toString()}>{p.nombre}</option>)}
              </select>
          </div>
          <div style={{marginLeft:'auto', fontSize:'0.85rem', color:'#6b7280'}}>
              Registros: <strong>{dataFinal.length}</strong>
          </div>
      </div>

      <div style={styles.tableContainer}>
          <table style={styles.table}>
              <colgroup>
                  <col style={{width: '110px'}} />
                  <col style={{width: '14%'}} />
                  <col style={{width: '14%'}} />
                  <col style={{width: '20%'}} />
                  <col style={{width: '130px'}} />
                  <col style={{width: '22%'}} />
                  <col style={{width: '140px'}} />
                  <col style={{width: '80px'}} />
              </colgroup>
              <thead>
                  <tr>
                      <ThSort label="Fecha" k="fecha"/>
                      <ThSort label="Labor" k="tipo_labor"/>
                      <th style={styles.th}>Parcela</th>
                      <th style={styles.th}>Sectores</th>
                      <ThSort label="Proveedor" k="proveedor"/>
                      <th style={styles.th}>Insumos Usados</th>
                      <ThSort label="Total" k="costo_total" align="right"/>
                      <th style={styles.th}></th>
                  </tr>
              </thead>
              <tbody>
                  {dataFinal.map(l => {
                      const ids = l.sectores_ids || []
                      const listaSectoresTxt = ids.map(id => mapaSectores[id]?.nombre || 'S?').join(', ')
                      const parcelasIds = [...new Set(ids.map(id => mapaSectores[id]?.parcela_id).filter(Boolean))]
                      let textoParcela = '-'
                      if (parcelasIds.length === 1) textoParcela = mapaParcelas[parcelasIds[0]] || '?'
                      else if (parcelasIds.length > 1) textoParcela = 'Varias / Mix'

                      return (
                          <tr key={l.id}>
                              <td style={styles.td}>{fmtFecha(l.fecha)}</td>
                              <td style={styles.td}>
                                  <div style={{display:'flex', alignItems:'center', gap:8, fontWeight:'600'}}>
                                      {ICONOS_VISUALES[l.tipo_labor]} {l.tipo_labor}
                                  </div>
                              </td>
                              <td style={styles.td}><span style={{fontWeight:'bold', color:'#4b5563'}}>{textoParcela}</span></td>
                              <td style={styles.td} title={listaSectoresTxt}><span style={styles.sectorsCell}>{listaSectoresTxt}</span></td>
                              <td style={styles.td}>
                                  {l.proveedores ? (
                                     <span style={{display:'flex', alignItems:'center', gap:5}}><User size={14} color="#6b7280"/> {l.proveedores.nombre}</span>
                                  ) : <span style={{color:'#9ca3af'}}>Interno</span>}
                              </td>
                              <td style={styles.td}>
                                  {l.detalles_insumos?.length > 0 ? (
                                      l.detalles_insumos.slice(0,3).map((i, idx) => (
                                          <span key={idx} style={styles.insumoChip}>
                                              <Package size={10} style={{display:'inline', marginRight:4}}/> 
                                              {i.nombre} <strong>({i.cantidad} {i.unidad})</strong>
                                          </span>
                                      ))
                                  ) : <span style={{color:'#d1d5db'}}>-</span>}
                              </td>
                              <td style={{...styles.tdRight, fontWeight:'bold', fontFamily:'monospace', fontSize:'1rem'}}>
                                  {fmtMoney(l.costo_total)}
                              </td>
                              <td style={styles.td}>
                                  <div style={{display:'flex', gap:5, justifyContent:'flex-end'}}>
                                      <button onClick={() => { setEditId(l.id); setModalOpen(true) }} style={{border:'none', background:'none', color:'#2563eb', cursor:'pointer'}}><Pencil size={16}/></button>
                                      <button onClick={() => eliminar(l.id)} style={{border:'none', background:'none', color:'#ef4444', cursor:'pointer'}}><Trash2 size={16}/></button>
                                  </div>
                              </td>
                          </tr>
                      )
                  })}
              </tbody>
          </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? "Editar Labor" : "Registrar Labor"}>
         {modalOpen && <NuevaLabor idLabor={editId} cerrarModal={() => setModalOpen(false)} alGuardar={() => { setModalOpen(false); cargarDatos() }} />}
      </Modal>
    </div>
  )
}

export default Labores