import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { 
  DollarSign, Plus, Search, 
  FileText, Trash2, ArrowUpRight, Shovel, Package, CreditCard,
  LayoutGrid, List, CalendarClock, Tag, User, TrendingUp, AlertCircle, 
  Layers, ChevronDown, ChevronUp, Filter, X, MapPin, Receipt, ChevronRight, Pencil
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

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function Gastos() {
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)

  // Maestros para filtros
  const [maestroProveedores, setMaestroProveedores] = useState([])
  const [maestroCategorias, setMaestroCategorias] = useState([])
  const [maestroSubcategorias, setMaestroSubcategorias] = useState([])
  const [maestroParcelas, setMaestroParcelas] = useState([])
  
  // UI
  const [activeTab, setActiveTab] = useState('resumen')
  const [filtrosVisible, setFiltrosVisible] = useState(true)

  // Filtros — todos en "Todos" por defecto
  const [filtroAnio, setFiltroAnio] = useState('Todos')
  const [filtroMes, setFiltroMes] = useState('Todos')
  const [filtroProveedor, setFiltroProveedor] = useState('Todos')
  const [filtroCategoria, setFiltroCategoria] = useState('Todos')
  const [filtroSubcategoria, setFiltroSubcategoria] = useState('Todos')
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [filtroTipoGasto, setFiltroTipoGasto] = useState('Todos')
  const [filtroTipoDoc, setFiltroTipoDoc] = useState('Todos')
  const [filtroParcela, setFiltroParcela] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')

  // Agrupación
  const [agruparPor, setAgruparPor] = useState('Mes')

  // Modales
  const [modalOpen, setModalOpen] = useState(false)
  const [editarId, setEditarId] = useState(null)
  const [modalLaborOpen, setModalLaborOpen] = useState(false)
  const [laborIdVer, setLaborIdVer] = useState(null)

  // Edición inline N° Factura en tab IVA
  const [editandoNro, setEditandoNro] = useState(null)
  const [nroTemp, setNroTemp] = useState('')

  useEffect(() => { 
    cargarMaestros()
    cargarGastos() 
  }, [])

  // Recargar cuando cambian filtros de fecha (se aplican en BD)
  useEffect(() => { cargarGastos() }, [filtroAnio, filtroMes])

  async function cargarMaestros() {
    try {
      const [provRes, catRes, subRes, parRes] = await Promise.all([
        supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('categorias_gastos').select('id, nombre').order('nombre'),
        supabase.from('subcategorias_gastos').select('id, nombre, categoria_id').order('nombre'),
        supabase.from('parcelas').select('id, nombre').eq('activo', true).order('nombre'),
      ])
      setMaestroProveedores(provRes.data || [])
      setMaestroCategorias(catRes.data || [])
      setMaestroSubcategorias(subRes.data || [])
      setMaestroParcelas(parRes.data || [])
    } catch (err) {
      console.error('Error cargando maestros:', err)
    }
  }

  async function cargarGastos() {
    setLoading(true)
    try {
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
      if (error) throw error
      setGastos(data || [])
    } catch (err) {
      console.error('Error cargando gastos:', err)
      alert('No se pudieron cargar los gastos.')
    } finally {
      setLoading(false)
    }
  }

  // Subcategorías filtradas según categoría seleccionada
  const subcategoriasFiltradas = useMemo(() => {
    if (filtroCategoria === 'Todos') return maestroSubcategorias
    const catObj = maestroCategorias.find(c => c.nombre === filtroCategoria)
    if (!catObj) return []
    return maestroSubcategorias.filter(s => s.categoria_id === catObj.id)
  }, [filtroCategoria, maestroCategorias, maestroSubcategorias])

  // Años disponibles desde los datos
  const aniosDisponibles = useMemo(() => {
    const years = [...new Set(gastos.map(g => g.fecha?.split('-')[0]).filter(Boolean))].sort((a,b) => b-a)
    return years
  }, [gastos])

  // Filtrado en frontend (todos los filtros excepto año/mes que van en BD)
  const filtrados = useMemo(() => {
    return gastos.filter(g => {
      if (filtroProveedor !== 'Todos' && g.proveedores?.nombre !== filtroProveedor) return false
      if (filtroCategoria !== 'Todos' && g.categorias_gastos?.nombre !== filtroCategoria) return false
      if (filtroSubcategoria !== 'Todos' && g.subcategorias_gastos?.nombre !== filtroSubcategoria) return false
      if (filtroEstado !== 'Todos' && g.estado_pago !== filtroEstado) return false
      if (filtroTipoGasto !== 'Todos' && g.clase_contable !== filtroTipoGasto) return false
      if (filtroTipoDoc !== 'Todos' && g.tipo_documento !== filtroTipoDoc) return false
      if (filtroParcela !== 'Todos') {
        const parcelaObj = maestroParcelas.find(p => p.nombre === filtroParcela)
        if (!parcelaObj) return false
        if (g.parcela_id !== parcelaObj.id) return false
      }
      if (busqueda) {
        const txt = busqueda.toLowerCase()
        if (
          !g.descripcion?.toLowerCase().includes(txt) &&
          !g.proveedores?.nombre?.toLowerCase().includes(txt) &&
          !g.nro_documento?.includes(txt)
        ) return false
      }
      return true
    })
  }, [gastos, filtroProveedor, filtroCategoria, filtroSubcategoria, filtroEstado, filtroTipoGasto, filtroTipoDoc, filtroParcela, busqueda, maestroParcelas])

  // Agrupación
  const dataAgrupada = useMemo(() => {
    if (agruparPor === 'Ninguno') return { 'Todos los gastos': filtrados }

    return filtrados.reduce((acc, g) => {
      let key = 'Sin asignar'
      if (agruparPor === 'Proveedor') key = g.proveedores?.nombre || 'Sin Proveedor'
      else if (agruparPor === 'Categoría') key = g.categorias_gastos?.nombre || 'Sin Categoría'
      else if (agruparPor === 'Tipo') key = g.clase_contable === 'CAPEX' ? '🏗️ Inversión (CAPEX)' : '📉 Operacional (OPEX)'
      else if (agruparPor === 'Estado') key = g.estado_pago || 'Sin Estado'
      else if (agruparPor === 'Mes') {
        if (g.fecha) {
          const [y, m] = g.fecha.split('-')
          key = `${MESES[parseInt(m)-1]} ${y}`
        }
      }
      else if (agruparPor === 'Documento') key = g.tipo_documento || 'Sin Documento'
      else if (agruparPor === 'Parcela') {
        const parcela = maestroParcelas.find(p => p.id === g.parcela_id)
        key = parcela?.nombre || 'Sin Parcela'
      }
      if (!acc[key]) acc[key] = []
      acc[key].push(g)
      return acc
    }, {})
  }, [filtrados, agruparPor, maestroParcelas])

  // Conteo de filtros activos
  const filtrosActivos = [filtroProveedor, filtroCategoria, filtroSubcategoria, filtroEstado, filtroTipoGasto, filtroTipoDoc, filtroParcela, filtroAnio, filtroMes]
    .filter(f => f !== 'Todos').length + (busqueda ? 1 : 0)

  const limpiarFiltros = () => {
    setFiltroAnio('Todos'); setFiltroMes('Todos'); setFiltroProveedor('Todos')
    setFiltroCategoria('Todos'); setFiltroSubcategoria('Todos'); setFiltroEstado('Todos')
    setFiltroTipoGasto('Todos'); setFiltroTipoDoc('Todos'); setFiltroParcela('Todos')
    setBusqueda('')
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

  // KPIs — todos sobre `filtrados`, reactivos a cualquier filtro activo
  const kpiTotal     = filtrados.reduce((a, g) => a + (parseFloat(g.monto) || 0), 0)
  const kpiOPEX      = filtrados.filter(g => g.clase_contable === 'OPEX').reduce((a, g) => a + (parseFloat(g.monto) || 0), 0)
  const kpiCAPEX     = filtrados.filter(g => g.clase_contable === 'CAPEX').reduce((a, g) => a + (parseFloat(g.monto) || 0), 0)
  const kpiPagado    = filtrados.filter(g => g.estado_pago === 'Pagado').reduce((a, g) => a + (parseFloat(g.monto) || 0), 0)
  const kpiPendiente = filtrados.filter(g => g.estado_pago === 'Pendiente').reduce((a, g) => a + (parseFloat(g.monto) || 0), 0)
  const kpiParcial   = filtrados.filter(g => g.estado_pago === 'Parcial').reduce((a, g) => a + (parseFloat(g.monto) || 0), 0)
  const kpiDocs      = filtrados.length
  const pctPagado    = kpiTotal > 0 ? Math.round((kpiPagado / kpiTotal) * 100) : 0

  const styles = {
    container: { width: '95%', maxWidth: '1600px', margin: '0 auto', padding: '20px 0' },
    header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20 },
    tabs: { display:'flex', gap:5, backgroundColor:'#e5e7eb', padding:4, borderRadius:8 },
    tabBtn: (active) => ({ padding:'8px 16px', borderRadius:6, border:'none', cursor:'pointer', fontWeight:'bold', backgroundColor: active ? 'white' : 'transparent', color: active ? '#111827' : '#6b7280', display:'flex', gap:8, alignItems:'center', transition:'all 0.2s' }),
    
    // Barra de controles principal
    controlBar: { display:'flex', gap:10, alignItems:'center', marginBottom: 12, flexWrap:'wrap' },
    
    // Panel de filtros expandible
    filterPanel: { backgroundColor:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:15, marginBottom:20 },
    filterGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:10, marginTop:12 },
    filterLabel: { fontSize:'0.7rem', fontWeight:'bold', color:'#6b7280', textTransform:'uppercase', display:'block', marginBottom:4 },
    select: { width:'100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.85rem', color:'#374151', backgroundColor:'white' },
    searchWrapper: { position:'relative', flex:1, minWidth:200 },
    
    btnNew: { backgroundColor: '#111827', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace:'nowrap' },
    btnFilter: (active) => ({ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border: active ? '1px solid #2563eb' : '1px solid #d1d5db', backgroundColor: active ? '#eff6ff' : 'white', color: active ? '#2563eb' : '#6b7280', cursor:'pointer', fontWeight:'bold', fontSize:'0.85rem', whiteSpace:'nowrap' }),
    btnClear: { display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:'1px solid #fca5a5', backgroundColor:'#fef2f2', color:'#ef4444', cursor:'pointer', fontSize:'0.8rem', fontWeight:'bold' },
    
    // Agrupación header
    groupHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, paddingBottom:10, borderBottom:'2px solid #f3f4f6' },
    groupTitle: { fontSize:'1rem', fontWeight:'bold', color:'#374151', display:'flex', alignItems:'center', gap:8 },
    groupStats: { fontSize:'0.8rem', color:'#6b7280', fontWeight:'500' },
    groupSection: { marginBottom:30 },

    // Grid Cards — multi-columna con tarjetas de ancho fijo
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 10 },
    card: { backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 15, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
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

  // Componente tarjeta reutilizable con desplegable — layout horizontal
  const GastoCard = ({ g }) => {
    const [expandida, setExpandida] = useState(false)
    const origen = getOrigen(g)
    const venc = getProximoVencimiento(g.pagos_gastos, g.estado_pago)
    const esCapex = g.clase_contable === 'CAPEX'
    const tienePagos = g.pagos_gastos?.length > 0
    const parcela = g.parcela_id ? maestroParcelas.find(p => p.id === g.parcela_id) : null
    const sinNumero = !g.nro_documento && g.tipo_documento === 'Factura'

    return (
      <div style={{backgroundColor:'white', borderLeft:`4px solid ${origen.color}`, borderRadius:10, border:'1px solid #e5e7eb', borderLeftWidth:4, boxShadow:'0 1px 3px rgba(0,0,0,0.05)', overflow:'hidden'}}>

        {/* ENCABEZADO — una sola línea con toda la metadata */}
        <div style={{padding:'5px 12px', display:'flex', alignItems:'center', gap:8, backgroundColor:'#fafafa', borderBottom:'1px solid #f3f4f6', flexWrap:'wrap'}}>
          <span style={{fontSize:'0.72rem', fontWeight:'700', color:'#9ca3af'}}>{formatDate(g.fecha)}</span>
          <span style={{color:'#e5e7eb'}}>·</span>
          <span style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:'0.72rem', fontWeight:'700', color: origen.color}}>
            {origen.icon} {origen.label}
          </span>
          <span style={{color:'#e5e7eb'}}>·</span>
          {/* Documento */}
          <span style={{fontSize:'0.72rem', fontWeight:'600', color: sinNumero ? '#d97706' : '#6b7280',
            backgroundColor: sinNumero ? '#fef3c7' : 'transparent', padding: sinNumero ? '1px 6px' : 0, borderRadius:4}}>
            {g.tipo_documento}{g.nro_documento ? ` #${g.nro_documento}` : sinNumero ? ' — sin número' : ''}
          </span>
          {/* Badges derecha */}
          <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:6}}>
            <span style={{fontSize:'0.68rem', fontWeight:'700', color: esCapex ? '#7c3aed' : '#059669',
              backgroundColor: esCapex ? '#ede9fe' : '#dcfce7', padding:'2px 7px', borderRadius:5}}>
              {g.clase_contable || 'OPEX'}
            </span>
            <StatusBadge status={g.estado_pago}/>
          </div>
        </div>

        {/* CUERPO — dos columnas */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 160px', gap:0}}>

          {/* Columna izquierda — info descriptiva */}
          <div style={{padding:'8px 12px', display:'flex', flexDirection:'column', gap:4, borderRight:'1px solid #f3f4f6'}}>
            <div style={{fontWeight:'700', color:'#111827', fontSize:'0.95rem', lineHeight:1.3}}>{g.descripcion}</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:'4px 14px', marginTop:2}}>
              <span style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:'0.78rem', color:'#4b5563'}}>
                <User size={11} color="#9ca3af"/>
                <span style={{fontWeight:'600'}}>{g.proveedores?.nombre || <span style={{color:'#d1d5db', fontStyle:'italic'}}>Sin proveedor</span>}</span>
              </span>
              <span style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:'0.75rem', color:'#6b7280'}}>
                <Tag size={11} color="#9ca3af"/>
                {g.categorias_gastos?.nombre || '—'}
                {g.subcategorias_gastos?.nombre && <span style={{color:'#9ca3af'}}>› {g.subcategorias_gastos.nombre}</span>}
              </span>
              {parcela && (
                <span style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:'0.75rem', color:'#6b7280'}}>
                  <MapPin size={11} color="#9ca3af"/> {parcela.nombre}
                </span>
              )}
            </div>
          </div>

          {/* Columna derecha — monto + vencimiento + acciones */}
          <div style={{padding:'8px 12px', display:'flex', flexDirection:'column', alignItems:'flex-end', justifyContent:'space-between', minWidth:0}}>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:'1.05rem', fontWeight:'900', color:'#111827', lineHeight:1}}>{formatMoney(g.monto)}</div>
              {g.tipo_documento === 'Factura' && (
                <div style={{fontSize:'0.67rem', color:'#9ca3af', marginTop:1}}>
                  Neto {formatMoney(Math.round(parseFloat(g.monto)/1.19))}
                </div>
              )}
              {venc && (
                <div style={{fontSize:'0.68rem', color: venc.color, fontWeight:'600', marginTop:2, display:'flex', alignItems:'center', gap:3, justifyContent:'flex-end'}}>
                  <CalendarClock size={10}/> {venc.texto ? `${venc.texto} ` : 'Vence '}{venc.fecha}
                </div>
              )}
            </div>
            {/* Acciones */}
            <div style={{display:'flex', gap:5, marginTop:8, alignItems:'center'}}>
              {tienePagos && (
                <button type="button" onClick={() => setExpandida(!expandida)}
                  style={{display:'flex', alignItems:'center', gap:3, fontSize:'0.7rem', fontWeight:'600', color:'#6b7280', background:'none', border:'1px solid #e5e7eb', borderRadius:5, cursor:'pointer', padding:'3px 7px'}}>
                  {expandida ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                  {g.pagos_gastos.length} cuota{g.pagos_gastos.length !== 1 ? 's' : ''}
                </button>
              )}
              {g.labor_origen_id && (
                <button title="Ver Labor original" onClick={() => { setLaborIdVer(g.labor_origen_id); setModalLaborOpen(true) }}
                  style={{...styles.btnIcon, backgroundColor:'#fffbeb', color:'#d97706', border:'1px solid #fde68a', borderRadius:5, padding:4}}><Shovel size={13}/></button>
              )}
              <button title="Editar" onClick={() => { setEditarId(g.id); setModalOpen(true) }}
                style={{...styles.btnIcon, backgroundColor:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:5, padding:4}}><FileText size={13}/></button>
              <button title="Eliminar" onClick={() => eliminarGasto(g.id)}
                style={{...styles.btnIcon, backgroundColor:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:5, padding:4}}><Trash2 size={13}/></button>
            </div>
          </div>
        </div>

        {/* Desplegable — Plan de pagos */}
        {expandida && tienePagos && (
          <div style={{borderTop:'2px solid #f3f4f6', padding:'10px 14px', backgroundColor:'#f9fafb'}}>
            <div style={{fontSize:'0.7rem', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:7}}>Plan de Pagos</div>
            <div style={{display:'flex', flexDirection:'column', gap:5}}>
              {g.pagos_gastos
                .slice().sort((a,b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))
                .map((p, i) => {
                  const vencido = p.estado === 'Pendiente' && new Date(p.fecha_vencimiento) < new Date()
                  return (
                    <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', backgroundColor:'white', borderRadius:7,
                      border:`1px solid ${p.estado === 'Pagado' ? '#bbf7d0' : vencido ? '#fca5a5' : '#e5e7eb'}`}}>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <div style={{width:7, height:7, borderRadius:'50%', flexShrink:0,
                          backgroundColor: p.estado === 'Pagado' ? '#10b981' : vencido ? '#ef4444' : '#f59e0b'}}/>
                        <div>
                          <div style={{fontSize:'0.78rem', fontWeight:'600', color:'#374151'}}>Cuota {i+1} · {formatDate(p.fecha_vencimiento)}</div>
                          {vencido && <div style={{fontSize:'0.66rem', color:'#ef4444', fontWeight:'700'}}>⚠ Vencida</div>}
                        </div>
                      </div>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <span style={{fontSize:'0.85rem', fontWeight:'800', color:'#111827'}}>{formatMoney(p.monto)}</span>
                        <span style={{fontSize:'0.68rem', fontWeight:'700', padding:'2px 7px', borderRadius:10,
                          backgroundColor: p.estado === 'Pagado' ? '#dcfce7' : vencido ? '#fee2e2' : '#fef3c7',
                          color: p.estado === 'Pagado' ? '#166534' : vencido ? '#991b1b' : '#92400e'}}>
                          {p.estado}
                        </span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={styles.container}>

      {/* HEADER */}
      <div style={styles.header}>
        <h1 style={{fontSize:'1.5rem', fontWeight:'bold', display:'flex', alignItems:'center', gap:10, margin:0}}>
          <DollarSign size={28}/> Gastos
        </h1>
        <div style={styles.tabs}>
          <button onClick={() => setActiveTab('resumen')} style={styles.tabBtn(activeTab === 'resumen')}><LayoutGrid size={18}/> Resumen</button>
          <button onClick={() => setActiveTab('historial')} style={styles.tabBtn(activeTab === 'historial')}><List size={18}/> Historial</button>
          <button onClick={() => setActiveTab('iva')} style={styles.tabBtn(activeTab === 'iva')}><Receipt size={18}/> IVA</button>
        </div>
      </div>

      {/* BARRA DE CONTROLES */}
      <div style={styles.controlBar}>
        {/* Búsqueda */}
        <div style={styles.searchWrapper}>
          <Search size={16} color="#9ca3af" style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)'}}/>
          <input 
            type="text" placeholder="Buscar descripción, proveedor, documento..." 
            value={busqueda} onChange={e => setBusqueda(e.target.value)} 
            style={{...styles.select, paddingLeft:34, width:'100%', boxSizing:'border-box'}}
          />
        </div>

        {/* Botón mostrar/ocultar filtros */}
        <button onClick={() => setFiltrosVisible(!filtrosVisible)} style={styles.btnFilter(filtrosActivos > 0)}>
          <Filter size={15}/>
          Filtros {filtrosActivos > 0 && <span style={{backgroundColor:'#2563eb', color:'white', borderRadius:'50%', width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem'}}>{filtrosActivos}</span>}
          {filtrosVisible ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>

        {/* Agrupar por */}
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <Layers size={15} color="#6b7280"/>
          <select value={agruparPor} onChange={e => setAgruparPor(e.target.value)} style={{...styles.select, width:'auto'}}>
            <option value="Ninguno">Sin agrupar</option>
            <option value="Proveedor">Agrupar por Proveedor</option>
            <option value="Categoría">Agrupar por Categoría</option>
            <option value="Tipo">Agrupar por Tipo (OPEX/CAPEX)</option>
            <option value="Estado">Agrupar por Estado</option>
            <option value="Mes">Agrupar por Mes</option>
            <option value="Documento">Agrupar por Tipo Documento</option>
            <option value="Parcela">Agrupar por Parcela</option>
          </select>
        </div>

        {filtrosActivos > 0 && (
          <button onClick={limpiarFiltros} style={styles.btnClear}><X size={14}/> Limpiar</button>
        )}

        <button onClick={() => { setEditarId(null); setModalOpen(true) }} style={styles.btnNew}>
          <Plus size={18}/> Nuevo Gasto
        </button>
      </div>

      {/* PANEL DE FILTROS */}
      {filtrosVisible && (
        <div style={styles.filterPanel}>
          <div style={{fontSize:'0.8rem', fontWeight:'bold', color:'#374151', display:'flex', alignItems:'center', gap:6}}>
            <Filter size={14}/> Filtros
          </div>
          <div style={styles.filterGrid}>

            <div>
              <span style={styles.filterLabel}>Año</span>
              <select value={filtroAnio} onChange={e => { setFiltroAnio(e.target.value) }} style={styles.select}>
                <option value="Todos">Todos</option>
                {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div>
              <span style={styles.filterLabel}>Mes</span>
              <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={styles.select}>
                <option value="Todos">Todos</option>
                {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>

            <div>
              <span style={styles.filterLabel}>Proveedor</span>
              <select value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)} style={styles.select}>
                <option value="Todos">Todos</option>
                {maestroProveedores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
              </select>
            </div>

            <div>
              <span style={styles.filterLabel}>Categoría</span>
              <select value={filtroCategoria} onChange={e => { setFiltroCategoria(e.target.value); setFiltroSubcategoria('Todos') }} style={styles.select}>
                <option value="Todos">Todas</option>
                {maestroCategorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
            </div>

            <div>
              <span style={styles.filterLabel}>Subcategoría</span>
              <select value={filtroSubcategoria} onChange={e => setFiltroSubcategoria(e.target.value)} style={{...styles.select, backgroundColor: filtroCategoria === 'Todos' ? '#f9fafb' : 'white'}} disabled={filtroCategoria === 'Todos'}>
                <option value="Todos">Todas</option>
                {subcategoriasFiltradas.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
              </select>
            </div>

            <div>
              <span style={styles.filterLabel}>Estado Pago</span>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={styles.select}>
                <option value="Todos">Todos</option>
                <option value="Pagado">Pagado</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Parcial">Parcial</option>
              </select>
            </div>

            <div>
              <span style={styles.filterLabel}>Tipo Gasto</span>
              <select value={filtroTipoGasto} onChange={e => setFiltroTipoGasto(e.target.value)} style={styles.select}>
                <option value="Todos">Todos</option>
                <option value="OPEX">📉 Operacional (OPEX)</option>
                <option value="CAPEX">🏗️ Inversión (CAPEX)</option>
              </select>
            </div>

            <div>
              <span style={styles.filterLabel}>Tipo Documento</span>
              <select value={filtroTipoDoc} onChange={e => setFiltroTipoDoc(e.target.value)} style={styles.select}>
                <option value="Todos">Todos</option>
                <option value="Factura">Factura</option>
                <option value="Boleta">Boleta</option>
                <option value="Guía">Guía</option>
                <option value="Interno">Interno</option>
              </select>
            </div>

            <div>
              <span style={styles.filterLabel}>Parcela</span>
              <select value={filtroParcela} onChange={e => setFiltroParcela(e.target.value)} style={styles.select}>
                <option value="Todos">Todas</option>
                {maestroParcelas.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
              </select>
            </div>

          </div>
        </div>
      )}

      {/* KPIs — reactivos a filtros */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(210px, 1fr))', gap:12, marginBottom:20}}>

        {/* Total */}
        <div style={{backgroundColor:'white', borderRadius:12, padding:'14px 18px', border:'1px solid #e5e7eb', borderLeft:'4px solid #111827'}}>
          <div style={{fontSize:'0.75rem', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4}}>Total Selección</div>
          <div style={{fontSize:'1.6rem', fontWeight:'900', color:'#111827', lineHeight:1}}>{formatMoney(kpiTotal)}</div>
          <div style={{fontSize:'0.75rem', color:'#9ca3af', marginTop:4}}>{kpiDocs} documento{kpiDocs !== 1 ? 's' : ''}</div>
        </div>

        {/* OPEX */}
        <div style={{backgroundColor:'white', borderRadius:12, padding:'14px 18px', border:'1px solid #e5e7eb', borderLeft:'4px solid #059669'}}>
          <div style={{fontSize:'0.75rem', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4}}>📉 OPEX</div>
          <div style={{fontSize:'1.6rem', fontWeight:'900', color:'#059669', lineHeight:1}}>{formatMoney(kpiOPEX)}</div>
          <div style={{fontSize:'0.75rem', color:'#9ca3af', marginTop:4}}>
            {kpiTotal > 0 ? Math.round((kpiOPEX/kpiTotal)*100) : 0}% del total
          </div>
        </div>

        {/* CAPEX */}
        <div style={{backgroundColor:'white', borderRadius:12, padding:'14px 18px', border:'1px solid #e5e7eb', borderLeft:'4px solid #7c3aed'}}>
          <div style={{fontSize:'0.75rem', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4}}>🏗️ CAPEX</div>
          <div style={{fontSize:'1.6rem', fontWeight:'900', color:'#7c3aed', lineHeight:1}}>{formatMoney(kpiCAPEX)}</div>
          <div style={{fontSize:'0.75rem', color:'#9ca3af', marginTop:4}}>
            {kpiTotal > 0 ? Math.round((kpiCAPEX/kpiTotal)*100) : 0}% del total
          </div>
        </div>

        {/* Estado de pago */}
        <div style={{backgroundColor:'white', borderRadius:12, padding:'14px 18px', border:'1px solid #e5e7eb', borderLeft:`4px solid ${kpiPendiente > 0 ? '#ef4444' : '#10b981'}`}}>
          <div style={{fontSize:'0.75rem', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6}}>Estado de Pago</div>
          <div style={{display:'flex', flexDirection:'column', gap:3}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontSize:'0.78rem', color:'#166534', fontWeight:'600'}}>✓ Pagado</span>
              <span style={{fontSize:'0.85rem', fontWeight:'800', color:'#166534'}}>{formatMoney(kpiPagado)}</span>
            </div>
            {kpiParcial > 0 && (
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontSize:'0.78rem', color:'#d97706', fontWeight:'600'}}>◑ Parcial</span>
                <span style={{fontSize:'0.85rem', fontWeight:'800', color:'#d97706'}}>{formatMoney(kpiParcial)}</span>
              </div>
            )}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontSize:'0.78rem', color:'#ef4444', fontWeight:'600'}}>○ Pendiente</span>
              <span style={{fontSize:'0.85rem', fontWeight:'800', color:'#ef4444'}}>{formatMoney(kpiPendiente)}</span>
            </div>
          </div>
          {/* Barra de progreso */}
          {kpiTotal > 0 && (
            <div style={{marginTop:8, height:5, backgroundColor:'#f3f4f6', borderRadius:3, overflow:'hidden'}}>
              <div style={{height:'100%', width:`${pctPagado}%`, backgroundColor:'#10b981', borderRadius:3, transition:'width 0.4s ease'}}/>
            </div>
          )}
          <div style={{fontSize:'0.7rem', color:'#9ca3af', marginTop:3}}>{pctPagado}% cobrado</div>
        </div>

      </div>

      {loading && <div style={{textAlign:'center', padding:40, color:'#9ca3af'}}>Cargando gastos...</div>}

      {/* VISTA RESUMEN — CARDS AGRUPADAS */}
      {!loading && activeTab === 'resumen' && (
        <div>
          {filtrados.length === 0 ? (
            <div style={{textAlign:'center', padding:40, color:'#9ca3af', border:'2px dashed #e5e7eb', borderRadius:12}}>
              No hay gastos que mostrar con estos filtros.
            </div>
          ) : (
            Object.entries(dataAgrupada).map(([grupo, items]) => (
              <div key={grupo} style={styles.groupSection}>
                {agruparPor !== 'Ninguno' && (
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, paddingBottom:10, borderBottom:'2px solid #e5e7eb'}}>
                    <span style={{fontSize:'1rem', fontWeight:'800', color:'#111827', display:'flex', alignItems:'center', gap:8}}>
                      <TrendingUp size={16} color="#6b7280"/> {grupo}
                    </span>
                    <span style={{fontSize:'0.85rem', color:'#6b7280', fontWeight:'500', display:'flex', alignItems:'center', gap:10}}>
                      <span style={{fontWeight:'800', color:'#111827', fontSize:'1rem'}}>{formatMoney(items.reduce((a,g)=>a+(parseFloat(g.monto)||0),0))}</span>
                      <span style={{color:'#d1d5db'}}>·</span>
                      {items.length} doc
                    </span>
                  </div>
                )}
                <div style={styles.grid}>
                  {items.map(g => <GastoCard key={g.id} g={g}/>)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* VISTA HISTORIAL — TABLA */}
      {!loading && activeTab === 'historial' && (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{...styles.th, width:'90px'}}>Fecha</th>
                <th style={{...styles.th, width:'80px'}}>Origen</th>
                <th style={{...styles.th, width:'80px'}}>Tipo</th>
                <th style={{...styles.th, width:'110px'}}>Documento</th>
                <th style={styles.th}>Descripción</th>
                <th style={{...styles.th, width:'130px'}}>Proveedor</th>
                <th style={{...styles.th, width:'120px'}}>Categoría</th>
                <th style={{...styles.th, width:'120px'}}>Subcategoría</th>
                <th style={{...styles.th, width:'100px'}}>Próx. Venc.</th>
                <th style={{...styles.th, width:'90px'}}>Estado</th>
                <th style={{...styles.th, textAlign:'right', width:'110px'}}>Monto</th>
                <th style={{...styles.th, textAlign:'center', width:'110px'}}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan="12" style={{padding:20, textAlign:'center', color:'#9ca3af'}}>No se encontraron registros.</td></tr>
              ) : filtrados.map(g => {
                const origen = getOrigen(g)
                const proxVenc = getProximoVencimiento(g.pagos_gastos, g.estado_pago)
                return (
                  <tr key={g.id}>
                    <td style={styles.td}>{formatDate(g.fecha)}</td>
                    <td style={styles.td}><span style={styles.badgeOrigen(origen)}>{origen.icon} {origen.label}</span></td>
                    <td style={styles.td}>
                      <span style={{fontSize:'0.7rem', fontWeight:'bold', padding:'2px 6px', borderRadius:6, backgroundColor: g.clase_contable==='CAPEX' ? '#ede9fe' : '#dcfce7', color: g.clase_contable==='CAPEX' ? '#7c3aed' : '#166534'}}>
                        {g.clase_contable}
                      </span>
                    </td>
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

      {/* VISTA IVA */}
      {!loading && activeTab === 'iva' && (() => {
        const facturas = filtrados.filter(g => g.tipo_documento === 'Factura' && parseFloat(g.monto) > 0)
        const totalBruto = facturas.reduce((a, g) => a + parseFloat(g.monto), 0)
        const totalNeto  = Math.round(totalBruto / 1.19)
        const totalIva   = totalBruto - totalNeto

        const guardarNroFactura = async (id) => {
          const { error } = await supabase.from('gastos').update({ nro_documento: nroTemp.trim() || null }).eq('id', id)
          if (error) { alert('Error al guardar: ' + error.message); return }
          setGastos(prev => prev.map(g => g.id === id ? { ...g, nro_documento: nroTemp.trim() || null } : g))
          setEditandoNro(null)
        }

        const abrirEdicion = (g) => { setEditandoNro(g.id); setNroTemp(g.nro_documento || '') }

        return (
          <div>
            {/* KPIs IVA */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20}}>
              {[
                { label:'Total Neto (s/IVA)', val: totalNeto, color:'#111827', border:'#111827' },
                { label:'IVA 19% (Crédito Fiscal)', val: totalIva, color:'#0369a1', border:'#0369a1' },
                { label:'Total Bruto (c/IVA)', val: totalBruto, color:'#166534', border:'#166534' },
              ].map(k => (
                <div key={k.label} style={{backgroundColor:'white', borderRadius:12, padding:'14px 18px', border:'1px solid #e5e7eb', borderLeft:`4px solid ${k.border}`}}>
                  <div style={{fontSize:'0.75rem', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4}}>{k.label}</div>
                  <div style={{fontSize:'1.6rem', fontWeight:'900', color: k.color, lineHeight:1}}>{formatMoney(k.val)}</div>
                  <div style={{fontSize:'0.72rem', color:'#9ca3af', marginTop:4}}>{facturas.length} factura{facturas.length !== 1 ? 's' : ''}</div>
                </div>
              ))}
            </div>

            {facturas.length === 0 ? (
              <div style={{textAlign:'center', padding:40, color:'#9ca3af', border:'2px dashed #e5e7eb', borderRadius:12}}>
                No hay facturas con los filtros seleccionados.
              </div>
            ) : (
              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{...styles.th, width:90}}>Fecha</th>
                      <th style={{...styles.th, width:110}}>N° Factura</th>
                      <th style={styles.th}>Descripción</th>
                      <th style={{...styles.th, width:140}}>Proveedor</th>
                      <th style={{...styles.th, textAlign:'right', width:120}}>Neto</th>
                      <th style={{...styles.th, textAlign:'right', width:110, color:'#0369a1'}}>IVA 19%</th>
                      <th style={{...styles.th, textAlign:'right', width:120}}>Total Bruto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map(g => {
                      const bruto = parseFloat(g.monto)
                      const neto  = Math.round(bruto / 1.19)
                      const iva   = bruto - neto
                      const sinNumero = !g.nro_documento
                      return (
                        <tr key={g.id} style={{borderTop:'1px solid #f3f4f6', backgroundColor: sinNumero ? '#fffbeb' : 'white'}}>
                          <td style={styles.td}>{formatDate(g.fecha)}</td>
                          <td style={styles.td}>
                            {editandoNro === g.id ? (
                              <div style={{display:'flex', gap:5, alignItems:'center'}}>
                                <input
                                  autoFocus
                                  type="text"
                                  value={nroTemp}
                                  onChange={e => setNroTemp(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') guardarNroFactura(g.id); if (e.key === 'Escape') setEditandoNro(null) }}
                                  placeholder="N° factura"
                                  style={{width:90, padding:'4px 8px', borderRadius:6, border:'2px solid #2563eb', fontSize:'0.85rem', outline:'none'}}
                                />
                                <button onClick={() => guardarNroFactura(g.id)} style={{border:'none', backgroundColor:'#166534', color:'white', borderRadius:5, padding:'4px 8px', cursor:'pointer', fontSize:'0.75rem', fontWeight:'bold'}}>✓</button>
                                <button onClick={() => setEditandoNro(null)} style={{border:'1px solid #d1d5db', backgroundColor:'white', color:'#6b7280', borderRadius:5, padding:'4px 6px', cursor:'pointer', fontSize:'0.75rem'}}>✕</button>
                              </div>
                            ) : (
                              <div style={{display:'flex', alignItems:'center', gap:6}}>
                                {sinNumero
                                  ? <span style={{fontSize:'0.75rem', color:'#d97706', fontWeight:'600', backgroundColor:'#fef3c7', padding:'2px 7px', borderRadius:6}}>Sin número</span>
                                  : <span style={{fontWeight:'600', color:'#374151'}}>#{g.nro_documento}</span>
                                }
                                <button onClick={() => abrirEdicion(g)} title="Editar N° Factura"
                                  style={{border:'none', background:'none', cursor:'pointer', color:'#9ca3af', padding:2, display:'flex', alignItems:'center', lineHeight:1}}>
                                  <Pencil size={12}/>
                                </button>
                              </div>
                            )}
                          </td>
                          <td style={styles.td}><span style={{color:'#111827', fontWeight:'500'}}>{g.descripcion}</span></td>
                          <td style={styles.td}>{g.proveedores?.nombre || <span style={{color:'#9ca3af'}}>-</span>}</td>
                          <td style={{...styles.td, textAlign:'right', fontFamily:'monospace', fontWeight:'600'}}>{formatMoney(neto)}</td>
                          <td style={{...styles.td, textAlign:'right', fontFamily:'monospace', fontWeight:'600', color:'#0369a1'}}>{formatMoney(iva)}</td>
                          <td style={{...styles.td, textAlign:'right', fontFamily:'monospace', fontWeight:'800'}}>{formatMoney(bruto)}</td>
                        </tr>
                      )
                    })}
                    {/* Fila de totales */}
                    <tr style={{borderTop:'2px solid #e5e7eb', backgroundColor:'#f9fafb'}}>
                      <td colSpan={4} style={{...styles.td, fontWeight:'700', color:'#374151', fontSize:'0.85rem'}}>TOTAL ({facturas.length} facturas)</td>
                      <td style={{...styles.td, textAlign:'right', fontFamily:'monospace', fontWeight:'900', fontSize:'0.95rem'}}>{formatMoney(totalNeto)}</td>
                      <td style={{...styles.td, textAlign:'right', fontFamily:'monospace', fontWeight:'900', fontSize:'0.95rem', color:'#0369a1'}}>{formatMoney(totalIva)}</td>
                      <td style={{...styles.td, textAlign:'right', fontFamily:'monospace', fontWeight:'900', fontSize:'0.95rem', color:'#166534'}}>{formatMoney(totalBruto)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

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