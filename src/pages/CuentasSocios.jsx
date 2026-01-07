import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { 
    Users, TrendingUp, TrendingDown, Plus, Minus, Wallet, 
    ArrowUpDown, Filter, ShoppingBag, User, 
    Pencil, Trash2, Lock, FileText, Calendar, Search, LayoutGrid, List
} from 'lucide-react'
import Modal from '../components/Modal'
import NuevoGasto from './NuevoGasto'

// --- COMPONENTES INTERNOS ---

const SmartMoneyInput = ({ value, onChange, placeholder, autoFocus }) => {
    const [display, setDisplay] = useState('')
    useEffect(() => {
        if(value) setDisplay('$ ' + parseInt(value).toLocaleString('es-CL'))
        else setDisplay('')
    }, [value])
    const handleChange = (e) => {
        const raw = e.target.value.replace(/\D/g, '')
        setDisplay(raw)
        onChange(raw)
    }
    return (
        <input 
            type="text" value={display} onChange={handleChange} placeholder={placeholder || "$ 0"} autoFocus={autoFocus}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1.2rem', fontWeight: 'bold', color: '#111827', textAlign: 'center', boxSizing: 'border-box' }}
        />
    )
}

function FormularioMovimiento({ socioId, tipoInicial, initialData, cerrar, alGuardar }) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        socio_id: socioId || '', 
        tipo: tipoInicial || 'Aporte', 
        monto: '',
        fecha: new Date().toISOString().split('T')[0], 
        descripcion: ''
    })
    const [socios, setSocios] = useState([])

    useEffect(() => {
        supabase.from('socios').select('id, nombre').order('nombre').then(({ data }) => setSocios(data || []))
        if (initialData) {
            setFormData({
                socio_id: initialData.socio_id || '',
                tipo: initialData.tipo || 'Aporte',
                monto: initialData.monto || '',
                fecha: initialData.fecha || '',
                descripcion: initialData.descripcion || ''
            })
        }
    }, [initialData])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if(!formData.monto || parseInt(formData.monto) <= 0) return alert("Ingresa un monto válido")
        setLoading(true)
        
        let error = null
        if (initialData) {
            const { error: err } = await supabase.from('movimientos_billetera').update(formData).eq('id', initialData.id)
            error = err
        } else {
            const { error: err } = await supabase.from('movimientos_billetera').insert([formData])
            error = err
        }

        setLoading(false)
        if(error) alert("Error: " + error.message)
        else alGuardar()
    }

    const estilos = {
        form: { display: 'flex', flexDirection: 'column', gap: 20, width: '100%', boxSizing: 'border-box' },
        selectorTipo: { display: 'flex', gap: 10, marginBottom: 10 },
        btnTipo: (activo, esAporte) => ({
            flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: activo ? (esAporte ? '#dcfce7' : '#fee2e2') : 'white',
            borderColor: activo ? (esAporte ? '#166534' : '#991b1b') : '#e5e7eb',
            color: activo ? (esAporte ? '#166534' : '#991b1b') : '#6b7280'
        }),
        input: { padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', width: '100%', boxSizing: 'border-box' },
        btnSave: { padding: '12px', backgroundColor: '#111827', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }
    }

    return (
        <form onSubmit={handleSubmit} style={estilos.form}>
            <div style={estilos.selectorTipo}>
                <div onClick={() => setFormData({...formData, tipo: 'Aporte'})} style={estilos.btnTipo(formData.tipo === 'Aporte', true)}>
                    <TrendingUp size={18}/> Aporte
                </div>
                <div onClick={() => setFormData({...formData, tipo: 'Retiro'})} style={estilos.btnTipo(formData.tipo === 'Retiro', false)}>
                    <TrendingDown size={18}/> Retiro
                </div>
            </div>
            <div>
                <label style={{display:'block', marginBottom:5, fontWeight:'bold', fontSize:'0.9rem'}}>Socio</label>
                <select value={formData.socio_id} onChange={e => setFormData({...formData, socio_id: e.target.value})} style={estilos.input} disabled={!!socioId || !!initialData} required>
                    <option value="">-- Seleccionar Socio --</option>
                    {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
            </div>
            <div>
                 <label style={{display:'block', marginBottom:5, fontWeight:'bold', fontSize:'0.9rem'}}>Monto</label>
                 <SmartMoneyInput value={formData.monto} onChange={v => setFormData({...formData, monto: v})} autoFocus/>
            </div>
            <div>
                <label style={{display:'block', marginBottom:5, fontWeight:'bold', fontSize:'0.9rem'}}>Fecha</label>
                <input type="date" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} style={estilos.input} required/>
            </div>
            <div>
                <label style={{display:'block', marginBottom:5, fontWeight:'bold', fontSize:'0.9rem'}}>Descripción (Opcional)</label>
                <input type="text" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} style={estilos.input} placeholder="Ej: Aporte inicial..." />
            </div>
            <button type="submit" style={estilos.btnSave} disabled={loading}>
                {loading ? 'Guardando...' : (initialData ? 'Actualizar Movimiento' : 'Confirmar Movimiento')}
            </button>
        </form>
    )
}

// --- VISTA PRINCIPAL ---

function CuentasSocios() {
  const [socios, setSocios] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  
  // ESTADOS DE UI
  const [activeTab, setActiveTab] = useState('resumen')
  
  // Modales
  const [modalOpen, setModalOpen] = useState(false)
  const [modalConfig, setModalConfig] = useState({ socioId: null, tipo: 'Aporte', data: null })
  const [modalGastoOpen, setModalGastoOpen] = useState(false)
  const [gastoEditarId, setGastoEditarId] = useState(null)

  // --- FILTROS Y ORDENAMIENTO ---
  const [sortSocios, setSortSocios] = useState('nombre') 
  
  // Filtros de Historial
  const [filtros, setFiltros] = useState({
      tipo: 'Todos',    
      socio: 'Todos',   
      year: 'Todos',    
      month: 'Todos'    
  })
  
  const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'desc' })

  const formatMoney = (val) => '$ ' + Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  const formatDate = (f) => f ? f.split('-').reverse().join('/') : '-'

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
        // 1. Cargar Socios (Vista de saldos)
        const { data: dataSocios, error: errSocios } = await supabase.from('vista_saldo_socios').select('*')
        if (errSocios) throw errSocios

        // 2. Cargar Movimientos
        const { data: dataMovs, error: errMovs } = await supabase
            .from('movimientos_billetera')
            .select('*')
            .order('fecha', { ascending: false })
            .limit(500)
        
        if (errMovs) throw errMovs

        // 3. Cruzar datos manualmente
        const movimientosEnriquecidos = (dataMovs || []).map(m => {
            const socioInfo = (dataSocios || []).find(s => s.socio_id === m.socio_id)
            return {
                ...m,
                socios: { nombre: socioInfo ? socioInfo.socio_nombre : 'Socio Desconocido' }
            }
        })

        setSocios(dataSocios || [])
        setMovimientos(movimientosEnriquecidos)

    } catch (error) {
        console.error("Error al cargar datos:", error)
        alert("Error cargando datos: " + error.message)
    } finally {
        setLoading(false)
    }
  }

  // Detectar Origen
  const parseOrigen = (descripcion) => {
      const desc = descripcion || ''
      const matchGasto = desc.match(/\[GID:(\d+)\]/)
      const gastoId = matchGasto ? matchGasto[1] : null

      if (gastoId || desc.includes('Pago Gasto')) {
          return { 
              esSistema: true,
              gastoId: gastoId,
              tipo: 'Gasto', 
              label: 'Pago Gasto', 
              icono: <ShoppingBag size={14} color="#4b5563"/>,
              detalle: desc.replace(/\[GID:.*?\]/, '').replace('Pago Gasto:', '').trim() 
          }
      }
      return { 
          esSistema: false,
          gastoId: null,
          tipo: 'Manual', 
          label: 'Directo', 
          icono: <User size={14} color="#4b5563"/>,
          detalle: desc || 'Sin descripción'
      }
  }

  const handleEditar = (mov) => {
      const info = parseOrigen(mov.descripcion)
      if (info.esSistema && info.gastoId) {
          setGastoEditarId(info.gastoId)
          setModalGastoOpen(true)
      } else if (info.esSistema && !info.gastoId) {
          alert("Este movimiento es de sistema pero no encuentro el ID del gasto original para editarlo.")
      } else {
          setModalConfig({ socioId: null, tipo: mov.tipo, data: mov })
          setModalOpen(true)
      }
  }

  const handleEliminar = async (mov) => {
      const info = parseOrigen(mov.descripcion)
      
      // LOGICA DE BORRADO SEGURA PERO PERMISIVA
      if (info.esSistema) {
           // Permitimos borrar pero con advertencia fuerte para limpiar registros huérfanos
           if(!confirm("⚠️ ADVERTENCIA: Este registro está vinculado a un Gasto.\n\nSi el gasto original ya no existe, este registro es un residuo y puedes borrarlo.\n\n¿Estás seguro de que deseas FORZAR el borrado?")) {
               return;
           }
      } else {
           if (!confirm("¿Eliminar movimiento permanentemente?")) return;
      }

      const { error } = await supabase.from('movimientos_billetera').delete().eq('id', mov.id)
      if (error) alert("Error al eliminar: " + error.message)
      else cargarDatos()
  }

  // --- LÓGICA DE DATOS ---

  const getSociosOrdenados = () => {
      const lista = [...socios]
      if (sortSocios === 'nombre') return lista.sort((a, b) => a.socio_nombre.localeCompare(b.socio_nombre))
      if (sortSocios === 'saldo_desc') return lista.sort((a, b) => b.saldo_actual - a.saldo_actual)
      if (sortSocios === 'saldo_asc') return lista.sort((a, b) => a.saldo_actual - b.saldo_actual)
      return lista
  }

  const handleSort = (key) => {
      setSortConfig(prev => ({
          key,
          direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      }))
  }

  const getMovimientosProcesados = () => {
      let data = movimientos.filter(m => {
          if (filtros.tipo !== 'Todos' && m.tipo !== filtros.tipo) return false
          if (filtros.socio !== 'Todos' && m.socio_id.toString() !== filtros.socio) return false
          const [anio, mes] = m.fecha.split('-') 
          if (filtros.year !== 'Todos' && anio !== filtros.year) return false
          if (filtros.month !== 'Todos' && parseInt(mes).toString() !== filtros.month) return false
          return true
      })

      data.sort((a, b) => {
          let valA = a[sortConfig.key]
          let valB = b[sortConfig.key]
          if (sortConfig.key === 'socio') {
              valA = a.socios?.nombre || ''
              valB = b.socios?.nombre || ''
          }
          if (sortConfig.key === 'monto') {
              valA = parseFloat(valA)
              valB = parseFloat(valB)
          }
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
          return 0
      })
      return data
  }

  const styles = {
    container: { width: '90%', maxWidth: '1400px', margin: '0 auto', padding: '20px 0' },
    
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', display:'flex', alignItems:'center', gap:10 },
    
    tabsContainer: { display:'flex', gap:5, backgroundColor:'#e5e7eb', padding:4, borderRadius:8 },
    tabBtn: (active) => ({
        padding:'8px 16px', borderRadius:6, border:'none', cursor:'pointer', fontWeight:'bold', fontSize:'0.9rem',
        backgroundColor: active ? 'white' : 'transparent', color: active ? '#111827' : '#6b7280', display:'flex', gap:8, alignItems:'center',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
    }),
    
    filterBar: { 
        display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap:'wrap', 
        backgroundColor: '#f9fafb', padding: '15px', borderRadius: '12px', border: '1px solid #e5e7eb'
    },
    labelFilter: { fontSize: '0.85rem', fontWeight: 'bold', color: '#4b5563', marginRight: 5 },
    selectControl: { padding: '8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', color: '#374151', minWidth: 120 },
    
    btnNew: { backgroundColor: '#1f2937', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, marginLeft:'auto' },

    gridSocios: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' },
    cardSocio: { backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflow: 'hidden' },
    cardHeader: { padding: '15px 20px', borderBottom: '1px solid #f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' },
    socioName: { fontSize: '1.1rem', fontWeight: 'bold', color: '#1f2937' },
    cardBody: { padding: '20px', textAlign: 'center' },
    saldoMain: { fontSize: '2.2rem', fontWeight: '800', color: '#111827', margin: '10px 0' },
    statsRow: { display: 'flex', justifyContent: 'space-around', marginTop: 15, padding: '10px', backgroundColor: '#f9fafb', borderRadius: 8 },
    statVal: { fontWeight: 'bold', fontSize: '0.9rem', color: '#374151' },
    statLabel: { fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase' },
    cardActions: { padding: '15px', display: 'flex', gap: '10px', borderTop: '1px solid #f3f4f6' },
    btnAction: (tipo) => ({
        flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        backgroundColor: tipo === 'Aporte' ? '#f0fdf4' : '#fef2f2',
        color: tipo === 'Aporte' ? '#166534' : '#991b1b',
        border: `1px solid ${tipo === 'Aporte' ? '#bbf7d0' : '#fecaca'}`
    }),

    tableContainer: { backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
    th: { textAlign: 'left', padding: '12px 15px', backgroundColor: '#f9fafb', color: '#6b7280', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', cursor: 'pointer', userSelect: 'none' },
    td: { padding: '12px 15px', borderBottom: '1px solid #f3f4f6', color: '#374151', verticalAlign:'middle' },
    badge: (tipo) => ({
        padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
        backgroundColor: tipo === 'Aporte' ? '#dcfce7' : '#fee2e2', color: tipo === 'Aporte' ? '#166534' : '#991b1b'
    }),
    origenBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '0.75rem', color: '#4b5563', border: '1px solid #e5e7eb' },
    btnIcon: { border: 'none', background: 'none', cursor: 'pointer', padding: 4 }
  }

  // --- MODIFICADO: ACEPTA ALIGN Y CENTRADO POR DEFECTO PARA MONTO ---
  const ThSort = ({ k, label, align = 'left' }) => (
      <th style={{...styles.th, textAlign: align}} onClick={() => handleSort(k)}>
          <div style={{display:'flex', alignItems:'center', gap:5, justifyContent: align === 'right' ? 'flex-end' : (align === 'center' ? 'center' : 'flex-start')}}>
              {label}
              {sortConfig.key === k && (
                  <ArrowUpDown size={14} color={sortConfig.direction === 'asc' ? '#2563eb' : '#9ca3af'} />
              )}
          </div>
      </th>
  )

  const movsFiltrados = getMovimientosProcesados()

  return (
    <div style={styles.container}>
        <div style={styles.headerRow}>
            <h1 style={styles.title}><Users size={28}/> Socios & Capital</h1>
            
            <div style={styles.tabsContainer}>
                <button onClick={() => setActiveTab('resumen')} style={styles.tabBtn(activeTab === 'resumen')}>
                    <LayoutGrid size={16}/> Resumen
                </button>
                <button onClick={() => setActiveTab('historial')} style={styles.tabBtn(activeTab === 'historial')}>
                    <List size={16}/> Historial
                </button>
            </div>
        </div>

        {activeTab === 'resumen' && (
            <div>
                <div style={{...styles.filterBar, justifyContent:'flex-end'}}>
                    <div style={{display:'flex', alignItems:'center', gap:8, fontSize:'0.9rem', color:'#6b7280'}}>
                        <ArrowUpDown size={16}/> Ordenar por:
                    </div>
                    <select value={sortSocios} onChange={e => setSortSocios(e.target.value)} style={styles.selectControl}>
                        <option value="nombre">Alfabético (A-Z)</option>
                        <option value="saldo_desc">Mayor Saldo</option>
                        <option value="saldo_asc">Menor Saldo</option>
                    </select>
                    
                    <button 
                        onClick={() => { setModalConfig({ socioId: null, tipo: 'Aporte', data: null }); setModalOpen(true) }}
                        style={styles.btnNew}
                    >
                        <Wallet size={18}/> Registrar Movimiento
                    </button>
                </div>

                <div style={styles.gridSocios}>
                    {getSociosOrdenados().map(socio => (
                        <div key={socio.socio_id || socio.id} style={styles.cardSocio}>
                            <div style={styles.cardHeader}>
                                <span style={styles.socioName}>{socio.socio_nombre}</span>
                                <div style={{backgroundColor:(socio.saldo_actual||0)>=0?'#d1fae5':'#fee2e2', borderRadius:'50%', padding:5}}>
                                    {(socio.saldo_actual||0)>=0 ? <TrendingUp size={16} color="#059669"/> : <TrendingDown size={16} color="#dc2626"/>}
                                </div>
                            </div>
                            <div style={styles.cardBody}>
                                <div style={{fontSize:'0.8rem', color:'#6b7280'}}>Saldo Disponible</div>
                                <div style={{...styles.saldoMain, color: (socio.saldo_actual || 0) >= 0 ? '#111827' : '#dc2626'}}>
                                    {formatMoney(socio.saldo_actual || 0)}
                                </div>
                                <div style={styles.statsRow}>
                                    <div>
                                        <div style={{...styles.statVal, color:'#059669'}}>+ {formatMoney(socio.total_invertido || 0)}</div>
                                        <div style={styles.statLabel}>Aportado</div>
                                    </div>
                                    <div style={{width:1, backgroundColor:'#e5e7eb'}}></div>
                                    <div>
                                        <div style={{...styles.statVal, color:'#d97706'}}>- {formatMoney(socio.total_recuperado || 0)}</div>
                                        <div style={styles.statLabel}>Retirado</div>
                                    </div>
                                </div>
                            </div>
                            <div style={styles.cardActions}>
                                <button style={styles.btnAction('Aporte')} onClick={() => { setModalConfig({ socioId: socio.socio_id, tipo: 'Aporte', data: null }); setModalOpen(true) }}>
                                    <Plus size={14}/> Aportar
                                </button>
                                <button style={styles.btnAction('Retiro')} onClick={() => { setModalConfig({ socioId: socio.socio_id, tipo: 'Retiro', data: null }); setModalOpen(true) }}>
                                    <Minus size={14}/> Retirar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'historial' && (
            <div>
                <div style={styles.filterBar}>
                    <div style={{display:'flex', alignItems:'center'}}>
                        <span style={styles.labelFilter}>Año:</span>
                        <select value={filtros.year} onChange={e => setFiltros({...filtros, year: e.target.value})} style={styles.selectControl}>
                            <option value="Todos">Todos</option>
                            <option value="2026">2026</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                        </select>
                    </div>

                    <div style={{display:'flex', alignItems:'center'}}>
                        <span style={styles.labelFilter}>Mes:</span>
                        <select value={filtros.month} onChange={e => setFiltros({...filtros, month: e.target.value})} style={styles.selectControl}>
                            <option value="Todos">Todos</option>
                            {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => (
                                <option key={i} value={(i+1).toString()}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{display:'flex', alignItems:'center'}}>
                        <span style={styles.labelFilter}>Socio:</span>
                        <select value={filtros.socio} onChange={e => setFiltros({...filtros, socio: e.target.value})} style={styles.selectControl}>
                            <option value="Todos">Todos</option>
                            {socios.map(s => (
                                <option key={s.socio_id} value={s.socio_id.toString()}>{s.socio_nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{display:'flex', alignItems:'center'}}>
                        <span style={styles.labelFilter}>Tipo:</span>
                        <select value={filtros.tipo} onChange={e => setFiltros({...filtros, tipo: e.target.value})} style={styles.selectControl}>
                            <option value="Todos">Todos</option>
                            <option value="Aporte">Aportes</option>
                            <option value="Retiro">Retiros</option>
                        </select>
                    </div>
                    
                    <button 
                        onClick={() => { setModalConfig({ socioId: null, tipo: 'Aporte', data: null }); setModalOpen(true) }}
                        style={styles.btnNew}
                    >
                        <Wallet size={18}/> Registrar
                    </button>
                </div>
                
                <div style={{marginBottom:10, textAlign:'right', fontSize:'0.85rem', color:'#6b7280'}}>
                    <strong>{movsFiltrados.length}</strong> movimientos encontrados
                </div>

                <div style={styles.tableContainer}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <ThSort k="fecha" label="Fecha" />
                                <ThSort k="socio" label="Socio" />
                                <ThSort k="tipo" label="Tipo" />
                                <th style={styles.th}>Origen</th>
                                <th style={styles.th}>Detalle</th>
                                {/* CENTRADO */}
                                <ThSort k="monto" label="Monto" align="center"/>
                                <th style={{...styles.th, width: 80}}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movsFiltrados.length === 0 ? (
                                <tr><td colSpan="7" style={{padding:40, textAlign:'center', color:'#9ca3af', fontStyle:'italic'}}>No hay movimientos con estos filtros.</td></tr>
                            ) : movsFiltrados.map(mov => {
                                const infoOrigen = parseOrigen(mov.descripcion)
                                return (
                                    <tr key={mov.id}>
                                        <td style={styles.td}>{formatDate(mov.fecha)}</td>
                                        <td style={{...styles.td, fontWeight:'bold'}}>{mov.socios?.nombre || 'Desconocido'}</td>
                                        <td style={styles.td}>
                                            <span style={styles.badge(mov.tipo)}>{mov.tipo}</span>
                                        </td>
                                        <td style={styles.td}>
                                            <div style={styles.origenBadge}>
                                                {infoOrigen.icono} 
                                                <span>{infoOrigen.label}</span>
                                            </div>
                                        </td>
                                        <td style={styles.td}>{infoOrigen.detalle}</td>
                                        {/* CENTRADO */}
                                        <td style={{...styles.td, textAlign:'center', fontWeight:'bold', fontFamily:'monospace'}}>
                                            {formatMoney(mov.monto)}
                                        </td>
                                        <td style={styles.td}>
                                            <div style={{display:'flex', justifyContent:'flex-end', gap:5}}>
                                                <button 
                                                    onClick={() => handleEditar(mov)} 
                                                    title={infoOrigen.esSistema ? "Editar Documento Original" : "Editar Movimiento"}
                                                    style={{...styles.btnIcon, color: infoOrigen.esSistema ? '#2563eb' : '#4b5563', backgroundColor: infoOrigen.esSistema ? '#eff6ff' : 'transparent', borderRadius:'4px'}}
                                                >
                                                    {infoOrigen.esSistema ? <FileText size={16}/> : <Pencil size={16}/>}
                                                </button>

                                                <button 
                                                    onClick={() => handleEliminar(mov)} 
                                                    style={{...styles.btnIcon, color: infoOrigen.esSistema ? '#d1d5db' : '#ef4444', cursor: 'pointer'}} 
                                                    title="Eliminar registro"
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
            </div>
        )}

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalConfig.data ? "Editar Movimiento" : "Registrar Movimiento"}>
            {modalOpen && (
                <FormularioMovimiento 
                    socioId={modalConfig.socioId}
                    tipoInicial={modalConfig.tipo}
                    initialData={modalConfig.data}
                    cerrar={() => setModalOpen(false)}
                    alGuardar={() => { setModalOpen(false); cargarDatos(); }}
                />
            )}
        </Modal>

        <Modal isOpen={modalGastoOpen} onClose={() => setModalGastoOpen(false)} title="Editar Documento / Gasto">
            {modalGastoOpen && (
                <NuevoGasto 
                    idGasto={gastoEditarId} 
                    cerrarModal={() => setModalGastoOpen(false)} 
                    alGuardar={() => { setModalGastoOpen(false); cargarDatos(); }} 
                />
            )}
        </Modal>

    </div>
  )
}

export default CuentasSocios