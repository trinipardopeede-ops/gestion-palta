import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { 
  Sprout, Calendar, User, Plus, Trash2, Pencil, MapPin, 
  ChevronDown, ChevronUp, Scale, ArrowRight, Layers, List, 
  ArrowDown, ArrowUp, ArrowUpDown 
} from 'lucide-react'
import Modal from '../components/Modal'
import NuevaCosecha from './NuevaCosecha'

// Helpers
const formatearDinero = (monto) => '$ ' + Math.round(monto || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")

function Cosechas() {
  const [dataOriginal, setDataOriginal] = useState([]) 
  const [dataProcesada, setDataProcesada] = useState([]) 
  const [gruposCosechas, setGruposCosechas] = useState({}) 
  const [loading, setLoading] = useState(true)
  const [tarjetasExpandidas, setTarjetasExpandidas] = useState({})

  // Filtros y Controles
  const [anioSeleccionado, setAnioSeleccionado] = useState('')
  const [aniosDisponibles, setAniosDisponibles] = useState([])
  
  // ESTADOS DE VISTA
  const [vistaAgrupada, setVistaAgrupada] = useState(true) 
  const [orden, setOrden] = useState('fecha_desc') // fecha_desc | fecha_asc | sector

  const [modalOpen, setModalOpen] = useState(false)
  const [editarId, setEditarId] = useState(null)

  useEffect(() => { leerCosechas() }, [])
  
  useEffect(() => { 
      procesarDatos()
  }, [dataOriginal, anioSeleccionado, orden, vistaAgrupada])

  async function leerCosechas() {
    setLoading(true)
    try {
        const { data, error } = await supabase
          .from('cosechas')
          .select(`
            *,
            clientes:clientes!fk_cosechas_cliente ( nombre ),
            sectores:sectores!fk_cosechas_sector ( 
                nombre, 
                parcelas:parcelas!fk_sectores_parcela ( nombre ) 
            ),
            detalle_cosechas ( calibre, kilos, precio_kilo )
          `)
          .order('fecha', { ascending: false })
        
        if (error) throw error

        if (data) {
            const anios = [...new Set(data.map(item => item.fecha ? new Date(item.fecha).getFullYear() : null))].filter(a => a)
            const aniosOrdenados = anios.sort((a,b) => b - a)
            setAniosDisponibles(aniosOrdenados)
            setDataOriginal(data)
        }
    } catch (err) {
        console.error("Error al leer cosechas:", err.message)
    } finally {
        setLoading(false)
    }
  }

  // Lógica de Ordenamiento y Agrupación
  const procesarDatos = () => {
      if (dataOriginal.length === 0) return

      // 1. Filtrar por Año
      let filtrados = [...dataOriginal]
      if (anioSeleccionado) {
          filtrados = filtrados.filter(c => c.fecha && new Date(c.fecha).getFullYear() === parseInt(anioSeleccionado))
      }

      // 2. Ordenar
      filtrados.sort((a, b) => {
          if (orden === 'fecha_desc') return new Date(b.fecha) - new Date(a.fecha)
          if (orden === 'fecha_asc') return new Date(a.fecha) - new Date(b.fecha)
          if (orden === 'sector') {
              const nombreA = a.sectores?.nombre || ''
              const nombreB = b.sectores?.nombre || ''
              return nombreA.localeCompare(nombreB)
          }
          return 0
      })

      // 3. Agrupar
      if (vistaAgrupada) {
          const agrupado = filtrados.reduce((acc, item) => {
              const nombreParcela = item.sectores?.parcelas?.nombre || 'Sin Parcela Asignada'
              if (!acc[nombreParcela]) acc[nombreParcela] = []
              acc[nombreParcela].push(item)
              return acc
          }, {})
          setGruposCosechas(agrupado)
      } else {
          setDataProcesada(filtrados)
      }
  }

  // Manejador inteligente del botón Fecha
  const toggleOrdenFecha = () => {
      if (orden === 'fecha_desc') setOrden('fecha_asc')
      else setOrden('fecha_desc')
  }

  const toggleExpansion = (id) => {
      setTarjetasExpandidas(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const abrirCrear = () => { setEditarId(null); setModalOpen(true) }
  const abrirEditar = (id) => { setEditarId(id); setModalOpen(true) }
  const handleGuardado = () => { setModalOpen(false); leerCosechas() }

  const eliminar = async (id) => {
    if (confirm("¿Eliminar este registro de cosecha y sus detalles?")) {
      await supabase.from('cosechas').delete().eq('id', id)
      leerCosechas()
    }
  }

  const getFechaParts = (fechaString) => {
      if (!fechaString) return { dia: '-', mes: '-', ano: '-' }
      const date = new Date(fechaString)
      const userTimezoneOffset = date.getTimezoneOffset() * 60000
      const fechaCorrecta = new Date(date.getTime() + userTimezoneOffset)
      
      const dia = fechaCorrecta.getDate()
      const mes = fechaCorrecta.toLocaleString('es-ES', { month: 'short' }).toUpperCase().replace('.', '')
      const ano = fechaCorrecta.getFullYear()
      return { dia, mes, ano }
  }

  const renderBadge = (destino) => {
    const stylesBadge = {
        'Venta': { bg: '#dcfce7', color: '#166534', border: '#86efac' },
        'Consumo Interno': { bg: '#ffedd5', color: '#9a3412', border: '#fdba74' },
        'Mermas': { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' }
    }
    const config = stylesBadge[destino] || stylesBadge['Venta']
    return (
        <span style={{ 
            backgroundColor: config.bg, color: config.color, border: `1px solid ${config.border}`,
            padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', 
            textTransform: 'uppercase', letterSpacing: '0.5px'
        }}>
            {destino}
        </span>
    )
  }

  // Componente Tarjeta
  const CosechaCard = ({ c }) => {
      const totalDinero = (c.kilos || 0) * (c.precio_kilo || 0)
      const isExpanded = tarjetasExpandidas[c.id]
      const fechaObj = getFechaParts(c.fecha)

      return (
          <div style={styles.card}>
               <div style={styles.cardHeader}>
                  {/* CAJA FECHA AUMENTADA */}
                  <div style={styles.dateBox}>
                      <span style={styles.dayText}>{fechaObj.dia}</span>
                      <span style={styles.monthText}>{fechaObj.mes}</span>
                      <span style={styles.yearText}>{fechaObj.ano}</span>
                  </div>

                  <div style={styles.infoBox}>
                      <div style={styles.kilosRow}>
                          <Scale size={20} color="#374151"/>
                          <span style={styles.kilosBig}>{c.kilos ? c.kilos.toLocaleString('es-CL') : '0'}</span>
                          <span style={styles.unitText}>Kg</span>
                      </div>
                      <div style={styles.sectorRow}>
                          {c.sectores?.nombre || 'Sector Borrado'}
                          {!vistaAgrupada && <span style={{fontSize:'0.75rem', color:'#9ca3af', fontWeight:'normal', marginLeft:5}}>({c.sectores?.parcelas?.nombre})</span>}
                      </div>
                      {c.destino === 'Venta' && (
                          <div style={styles.clientRow}><User size={14}/> {c.clientes?.nombre || 'Sin Cliente'}</div>
                       )}
                  </div>

                  <div style={styles.actionBox}>
                      {renderBadge(c.destino)}
                      <div style={styles.actionButtons}>
                          <button onClick={() => abrirEditar(c.id)} style={styles.btnIcon} title="Editar"><Pencil size={18}/></button>
                          <button onClick={() => eliminar(c.id)} style={{...styles.btnIcon, color:'#ef4444'}} title="Eliminar"><Trash2 size={18}/></button>
                          <button onClick={() => toggleExpansion(c.id)} style={{...styles.btnIcon, color: isExpanded ? '#2563eb' : '#9ca3af', backgroundColor: isExpanded ? '#eff6ff' : 'transparent', borderRadius:'50%'}}>
                              {isExpanded ? <ChevronUp size={22}/> : <ChevronDown size={22}/>}
                          </button>
                      </div>
                  </div>
              </div>

              {isExpanded && (
                  <div style={styles.detailsContainer}>
                      {c.detalle_cosechas && c.detalle_cosechas.length > 0 ? (
                          <table style={styles.miniTable}>
                              <thead>
                                  <tr>
                                      <th style={styles.th}>Calibre</th>
                                      <th style={{...styles.th, textAlign:'right'}}>Cantidad</th>
                                      {c.destino === 'Venta' && <th style={{...styles.th, textAlign:'right'}}>Precio ($)</th>}
                                  </tr>
                              </thead>
                              <tbody>
                                  {c.detalle_cosechas.map((d, idx) => (
                                      <tr key={idx}>
                                          <td style={styles.td}>
                                              <div style={{display:'flex', alignItems:'center', gap:6}}>
                                                  <div style={{width:6, height:6, borderRadius:'50%', backgroundColor:'#16a34a'}}></div>
                                                  {d.calibre}
                                              </div>
                                          </td>
                                          <td style={{...styles.td, textAlign:'right', fontWeight:'500'}}>{d.kilos} Kg</td>
                                          {c.destino === 'Venta' && <td style={{...styles.td, textAlign:'right', color:'#16a34a'}}>{formatearDinero(d.precio_kilo)}</td>}
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : (
                          <div style={{fontSize:'0.8rem', fontStyle:'italic', color:'#9ca3af', padding:'15px 0', textAlign:'center'}}>
                              Sin detalle de calibres registrado.
                          </div>
                      )}
                      
                      {c.comentarios && (
                          <div style={{fontSize:'0.85rem', color:'#4b5563', marginTop:'15px', padding:'10px', backgroundColor:'#fff', borderRadius:'6px', border:'1px solid #e5e7eb', display:'flex', gap:8}}>
                              <span style={{fontWeight:'bold'}}>Nota:</span> {c.comentarios}
                          </div>
                      )}

                      {c.destino === 'Venta' && (
                          <div style={styles.moneyBlock}>
                                <span style={{fontSize:'0.9rem', color:'#6b7280', display:'flex', alignItems:'center', gap:5}}>
                                    Total Venta <ArrowRight size={14}/>
                                </span>
                              <span style={{fontWeight:'800', color:'#15803d', fontSize:'1.2rem'}}>{formatearDinero(totalDinero)}</span>
                          </div>
                      )}
                  </div>
              )}
          </div>
      )
  }

  const styles = {
    container: { width: '90%', maxWidth: '1400px', margin: '0 auto', padding: '10px 20px' },
    header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px', flexWrap:'wrap', gap:15 },
    title: { fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', display:'flex', alignItems:'center', gap:10, margin:0 },
    
    // BARRA DE CONTROLES
    controlsBar: { display: 'flex', gap: '15px', alignItems: 'center' },
    
    // Grupo de Botones (Toggle Group)
    controlGroup: { display:'flex', gap:1, backgroundColor:'white', border:'1px solid #d1d5db', borderRadius:8, overflow:'hidden' },
    
    // Estilo Botón Toggle
    btnToggle: (active) => ({
        padding:'8px 12px', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:'0.85rem',
        backgroundColor: active ? '#eff6ff' : 'white', color: active ? '#2563eb' : '#6b7280', fontWeight: active ? 'bold' : 'normal',
        transition: 'background-color 0.1s'
    }),

    // Etiqueta pequeña para los grupos de botones
    groupLabel: { fontSize: '0.75rem', fontWeight:'bold', color:'#9ca3af', marginBottom:4, display:'block', textTransform:'uppercase' },

    selectControl: { padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', cursor: 'pointer', fontSize:'0.9rem' },
    btnNew: { border: 'none', cursor: 'pointer', backgroundColor: '#16a34a', color: 'white', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '0.9rem' },
    
    parcelaSection: { marginBottom: '30px' },
    parcelaTitle: { fontSize: '1.1rem', fontWeight: 'bold', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', marginBottom: '15px', display:'flex', alignItems:'center', gap:'8px' },
    
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' },
    card: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', overflow:'hidden', display:'flex', flexDirection:'column' },
    cardHeader: { padding: '0', backgroundColor: '#fff', display:'grid', gridTemplateColumns: '85px 1fr auto', minHeight: '90px' },
    
    // FECHA GRANDE
    dateBox: { 
        backgroundColor: '#f3f4f6', 
        borderRight: '1px solid #e5e7eb', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: '10px 5px',
        minWidth: '85px'
    },
    dayText: { fontSize: '1.8rem', fontWeight: '800', color: '#1f2937', lineHeight: 1 },
    monthText: { fontSize: '0.75rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', marginTop: 2 },
    yearText: { fontSize: '1.1rem', fontWeight: '800', color: '#9ca3af', marginTop: '4px' }, // AÑO AUMENTADO

    infoBox: { padding: '15px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 },
    kilosRow: { display: 'flex', alignItems: 'baseline', gap: 8 },
    kilosBig: { fontSize: '1.6rem', fontWeight: '800', color: '#111827' },
    unitText: { fontSize: '0.9rem', color: '#6b7280', fontWeight: '500' },
    sectorRow: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.95rem', fontWeight: '600', color: '#16a34a' },
    clientRow: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#4b5563', marginTop: 4 },

    actionBox: { padding: '15px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end' },
    actionButtons: { display: 'flex', gap: 8 },
    btnIcon: { background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:'4px', display:'flex', alignItems:'center' },
    
    detailsContainer: { padding: '0 20px 20px 20px', backgroundColor: '#fafafa', borderTop:'1px dashed #e5e7eb' },
    miniTable: { width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', marginTop:15 },
    td: { padding: '8px 0', borderBottom: '1px solid #e5e7eb', color: '#374151' },
    th: { padding: '8px 0', textAlign: 'left', fontWeight: 'bold', color: '#9ca3af', borderBottom: '1px solid #d1d5db', fontSize:'0.75rem', textTransform:'uppercase' },
    moneyBlock: { marginTop: '15px', paddingTop: '10px', display:'flex', justifyContent:'space-between', alignItems:'center', borderTop: '2px solid #e5e7eb' },
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}><Sprout color="#16a34a" size={28} /> Cosechas</h1>

        <div style={styles.controlsBar}>
            {/* GRUPO 1: VISTA */}
            <div>
                <span style={styles.groupLabel}>Vista</span>
                <div style={styles.controlGroup}>
                    <button onClick={() => setVistaAgrupada(true)} style={styles.btnToggle(vistaAgrupada)} title="Agrupar por Parcela">
                        <Layers size={16}/> Agrupado
                    </button>
                    <button onClick={() => setVistaAgrupada(false)} style={styles.btnToggle(!vistaAgrupada)} title="Lista Cronológica">
                        <List size={16}/> Lista
                    </button>
                </div>
            </div>

            {/* GRUPO 2: ORDENAMIENTO (NUEVO DISEÑO CON BOTONES) */}
            <div>
                <span style={styles.groupLabel}>Ordenar por</span>
                <div style={styles.controlGroup}>
                    {/* BOTÓN FECHA (ALTERNABLE) */}
                    <button 
                        onClick={toggleOrdenFecha} 
                        style={styles.btnToggle(orden.includes('fecha'))} 
                        title={orden === 'fecha_asc' ? "Más antiguos primero" : "Más recientes primero"}
                    >
                        <Calendar size={16}/> 
                        {orden === 'fecha_asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>}
                        Fecha
                    </button>

                    {/* BOTÓN SECTOR */}
                    <button 
                        onClick={() => setOrden('sector')} 
                        style={styles.btnToggle(orden === 'sector')} 
                        title="Ordenar alfabéticamente por Sector"
                    >
                        <ArrowUpDown size={16}/> Sector
                    </button>
                </div>
            </div>

            {/* FILTRO AÑO */}
            <div>
                <span style={styles.groupLabel}>Filtro</span>
                <select 
                    style={styles.selectControl} 
                    value={anioSeleccionado} 
                    onChange={(e) => setAnioSeleccionado(e.target.value)}
                >
                    <option value="">Año: Todos</option>
                    {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>
            
            <div style={{marginTop: 15}}> {/* Alineación con botones */}
                <button onClick={abrirCrear} style={styles.btnNew}>
                    <Plus size={18} /> Nueva
                </button>
            </div>
        </div>
      </div>

      {loading && <div style={{padding:'20px', color:'#9ca3af'}}>Cargando registros...</div>}

      {!loading && dataProcesada.length === 0 && Object.keys(gruposCosechas).length === 0 && (
          <div style={{textAlign:'center', padding:'40px', color:'#9ca3af', border:'2px dashed #e5e7eb', borderRadius:'12px', backgroundColor:'#f9fafb'}}>
              No hay cosechas registradas con estos filtros.
          </div>
      )}

      {/* VISTA 1: AGRUPADA POR PARCELA */}
      {!loading && vistaAgrupada && Object.keys(gruposCosechas).sort().map(parcela => (
          <div key={parcela} style={styles.parcelaSection}>
              <h3 style={styles.parcelaTitle}><MapPin size={18} color="#16a34a"/> {parcela}</h3>
              <div style={styles.grid}>
                 {gruposCosechas[parcela].map(c => <CosechaCard key={c.id} c={c} />)}
              </div>
          </div>
      ))}

      {/* VISTA 2: LISTA PLANA (CRONOLÓGICA) */}
      {!loading && !vistaAgrupada && (
          <div style={styles.grid}>
              {dataProcesada.map(c => <CosechaCard key={c.id} c={c} />)}
          </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editarId ? "Editar Cosecha" : "Registrar Nueva Cosecha"}>
        {modalOpen && <NuevaCosecha idCosecha={editarId} cerrarModal={() => setModalOpen(false)} alGuardar={handleGuardado} />}
      </Modal>
    </div>
  )
}
export default Cosechas