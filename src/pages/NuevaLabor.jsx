import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { 
    Save, Plus, Trash2, Calendar, User, 
    Package, CheckSquare, Square, ChevronDown, ChevronRight,
    Droplets, TestTube, Scissors, CircleDot, Leaf, Hammer, ClipboardList, Map
} from 'lucide-react'

// Iconos visuales
const ICONOS_LABOR = {
  'Riego': <Droplets size={18} color="#3b82f6"/>,
  'Fertilización': <TestTube size={18} color="#8b5cf6"/>,
  'Poda': <Scissors size={18} color="#f59e0b"/>,
  'Anillado': <CircleDot size={18} color="#d97706"/>,
  'Fitosanitario': <Leaf size={18} color="#ef4444"/>,
  'Mantenimiento': <Hammer size={18} color="#6b7280"/>,
  'Limpieza': <Leaf size={18} color="#10b981"/>,
  'Otros': <ClipboardList size={18} color="#9ca3af"/>
}

const SmartInputSimple = ({ value, onChange, placeholder, autoFocus }) => {
    const [display, setDisplay] = useState('')
    useEffect(() => {
        if(value !== '' && value !== null && !isNaN(value)) {
            setDisplay(parseInt(value).toLocaleString('es-CL'))
        } else {
            setDisplay('')
        }
    }, [value])
    const handleChange = (e) => {
        const raw = e.target.value.replace(/\D/g, '')
        setDisplay(raw)
        onChange(raw === '' ? 0 : parseInt(raw)) 
    }
    return (
        <input 
            type="text" value={display} onChange={handleChange} placeholder={placeholder || "0"} autoFocus={autoFocus}
            style={{ width: '100%', border: 'none', outline: 'none', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', color: '#111827', padding: '0 5px', boxSizing: 'border-box' }}
        />
    )
}

function NuevaLabor({ idLabor, cerrarModal, alGuardar }) {
  const [loading, setLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false) 
  
  // Maestros
  const [proveedores, setProveedores] = useState([])
  const [parcelas, setParcelas] = useState([]) 
  const [insumosBodega, setInsumosBodega] = useState([])
  const [categorias, setCategorias] = useState([])
  const [subcategorias, setSubcategorias] = useState([])
  const [subcategoriasFiltradas, setSubcategoriasFiltradas] = useState([])

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo_labor: 'Riego',
    proveedor_id: '',
    descripcion: '',
    modo_calculo: 'Global', 
    valor_unitario_mo: 0, 
    pasar_a_gastos: false,
    categoria_id: '',
    subcategoria_id: ''
  })

  // Selección
  const [sectoresSeleccionados, setSectoresSeleccionados] = useState([]) 
  const [parcelasExpandidas, setParcelasExpandidas] = useState({})
  const [insumosSeleccionados, setInsumosSeleccionados] = useState([])
  const [insumoTemp, setInsumoTemp] = useState({ id: '', cantidad: '' })

  // Totales Calculados
  const [stats, setStats] = useState({ arboles: 0, has: 0, sectores: 0 })
  const [costoMO, setCostoMO] = useState(0)
  const [totalGeneral, setTotalGeneral] = useState(0)

  const updateForm = (key, value) => {
      setFormData(prev => ({ ...prev, [key]: value }))
      setHasChanges(true)
  }

  useEffect(() => { cargarMaestros() }, [])

  useEffect(() => {
      if (idLabor) cargarDatosEdicion()
  }, [idLabor])

  // Filtrar subcategorías
  useEffect(() => {
      if(formData.categoria_id) {
          setSubcategoriasFiltradas(subcategorias.filter(s => s.categoria_id.toString() === formData.categoria_id.toString()))
      } else {
          setSubcategoriasFiltradas([])
      }
  }, [formData.categoria_id, subcategorias])

  async function cargarMaestros() {
      const [prov, par, bod, cat, sub] = await Promise.all([
          supabase.from('proveedores').select('id, nombre').order('nombre'),
          supabase.from('parcelas').select('id, nombre, sectores(id, nombre, cantidad_arboles, superficie_ha)').order('nombre'),
          supabase.from('bodega_insumos').select('id, nombre, unidad_medida, costo_promedio, stock_actual').eq('activo', true).order('nombre'),
          supabase.from('categorias_gastos').select('id, nombre').order('nombre'),
          supabase.from('subcategorias_gastos').select('id, nombre, categoria_id').order('nombre')
      ])
      
      setProveedores(prov.data || [])
      setParcelas(par.data || [])
      setInsumosBodega(bod.data || [])
      setCategorias(cat.data || [])
      setSubcategorias(sub.data || [])

      if (par.data) {
          const expand = {}
          par.data.forEach(p => expand[p.id] = true)
          setParcelasExpandidas(expand)
      }
  }

  async function cargarDatosEdicion() {
      const { data, error } = await supabase.from('labores').select('*').eq('id', idLabor).single()
      if (data && !error) {
          let modo = 'Global'
          if (data.metodo_distribucion === 'arboles') modo = 'Por Arbol'
          if (data.metodo_distribucion === 'superficie') modo = 'Por Ha'

          setFormData({
              fecha: data.fecha,
              tipo_labor: data.tipo_labor,
              proveedor_id: data.proveedor_id || '',
              descripcion: data.descripcion || '',
              modo_calculo: modo,
              valor_unitario_mo: 0, 
              pasar_a_gastos: false,
              categoria_id: '',
              subcategoria_id: ''
          })
          
          setCostoMO(data.costo_mano_obra || 0) 
          if (data.sectores_ids && Array.isArray(data.sectores_ids)) setSectoresSeleccionados(data.sectores_ids)
          else if (data.sector_id) setSectoresSeleccionados([data.sector_id])

          setInsumosSeleccionados(data.detalles_insumos || [])
          setHasChanges(false)
      }
  }

  // Cálculos
  useEffect(() => {
      let tArboles = 0, tHas = 0
      parcelas.forEach(p => {
          if (p.sectores) {
              p.sectores.forEach(s => {
                  if (sectoresSeleccionados.includes(s.id)) {
                      tArboles += (s.cantidad_arboles || 0)
                      tHas += (parseFloat(s.superficie_ha) || 0)
                  }
              })
          }
      })
      setStats({ arboles: tArboles, has: tHas, sectores: sectoresSeleccionados.length })
  }, [sectoresSeleccionados, parcelas])

  useEffect(() => {
      if (hasChanges || !idLabor) {
          const val = parseFloat(formData.valor_unitario_mo) || 0
          let total = 0
          if (formData.modo_calculo === 'Global') total = val
          else if (formData.modo_calculo === 'Por Arbol') total = val * stats.arboles
          else if (formData.modo_calculo === 'Por Ha') total = val * stats.has
          setCostoMO(total)
      }
  }, [formData.valor_unitario_mo, formData.modo_calculo, stats, hasChanges, idLabor])

  useEffect(() => {
      const totalInsumos = insumosSeleccionados.reduce((acc, i) => acc + (parseFloat(i.subtotal) || 0), 0)
      setTotalGeneral(costoMO + totalInsumos)
  }, [costoMO, insumosSeleccionados])

  // Handlers UI
  const toggleSector = (id) => {
      const nuevo = sectoresSeleccionados.includes(id) ? sectoresSeleccionados.filter(x => x !== id) : [...sectoresSeleccionados, id]
      setSectoresSeleccionados(nuevo); setHasChanges(true)
  }

  const toggleTodaParcela = (parcelaId) => {
      const p = parcelas.find(x => x.id === parcelaId)
      if(!p?.sectores) return
      const ids = p.sectores.map(s => s.id)
      const todos = ids.every(id => sectoresSeleccionados.includes(id))
      const nuevo = todos ? sectoresSeleccionados.filter(id => !ids.includes(id)) : [...new Set([...sectoresSeleccionados, ...ids])]
      setSectoresSeleccionados(nuevo); setHasChanges(true)
  }

  const agregarInsumo = () => {
      if (!insumoTemp.id || !insumoTemp.cantidad) return
      const item = insumosBodega.find(i => i.id.toString() === insumoTemp.id.toString())
      const costo = parseFloat(item.costo_promedio || 0)
      const cant = parseFloat(insumoTemp.cantidad)
      setInsumosSeleccionados([...insumosSeleccionados, {
          uniqueId: Date.now(), insumo_id: item.id, nombre: item.nombre, unidad: item.unidad_medida,
          cantidad: cant, costo_unitario: costo, subtotal: cant * costo
      }])
      setInsumoTemp({ id: '', cantidad: '' }); setHasChanges(true)
  }

  const handleSubmit = async (e) => {
      e.preventDefault()
      if (sectoresSeleccionados.length === 0) return alert("Selecciona al menos un sector")
      setLoading(true)
      try {
          const totalInsumos = insumosSeleccionados.reduce((acc, i) => acc + i.subtotal, 0)
          let metodoDist = 'superficie'
          if (formData.modo_calculo === 'Por Arbol') metodoDist = 'arboles'
          if (formData.modo_calculo === 'Por Ha') metodoDist = 'superficie'

          const nuevaLabor = {
              fecha: formData.fecha,
              tipo_labor: formData.tipo_labor,
              proveedor_id: formData.proveedor_id || null,
              descripcion: formData.descripcion,
              sectores_ids: sectoresSeleccionados,
              metodo_distribucion: metodoDist,
              costo_mano_obra: costoMO,
              costo_insumos: totalInsumos,
              costo_total: totalGeneral,
              detalles_insumos: insumosSeleccionados
          }

          let laborIdInserted = null
          if (idLabor) {
              await supabase.from('labores').update(nuevaLabor).eq('id', idLabor)
              laborIdInserted = idLabor
          } else {
              const { data, error } = await supabase.from('labores').insert([nuevaLabor]).select()
              if(error) throw error
              laborIdInserted = data[0].id
          }

          if (insumosSeleccionados.length > 0 && !idLabor) {
              const movs = insumosSeleccionados.map(i => ({
                  insumo_id: i.insumo_id, tipo_movimiento: 'Salida', cantidad: i.cantidad,
                  fecha: formData.fecha, referencia: `Labor #${laborIdInserted}`, labor_id: laborIdInserted, costo_unitario: i.costo_unitario
              }))
              await supabase.from('bodega_movimientos').insert(movs)
          }

          // PERMITIR INSERTAR GASTO EN CUALQUIER MOMENTO
          if (formData.pasar_a_gastos) {
               await supabase.from('gastos').insert([{
                  fecha: formData.fecha, 
                  monto: totalGeneral, 
                  proveedor_id: formData.proveedor_id || null,
                  descripcion: `Labor: ${formData.tipo_labor}`, 
                  tipo_documento: 'Interno', 
                  estado_pago: 'Pendiente',
                  categoria_id: formData.categoria_id, 
                  subcategoria_id: formData.subcategoria_id || null, 
                  sectores_ids: sectoresSeleccionados,
                  labor_origen_id: laborIdInserted // <--- CORRECCION CLAVE AQUI
               }])
          }
          alGuardar()
      } catch (err) { alert("Error: " + err.message) } finally { setLoading(false) }
  }

  const handleCerrarSeguro = () => {
      if (hasChanges && (sectoresSeleccionados.length > 0 || formData.descripcion)) {
          if (confirm("¿Cerrar sin guardar?")) cerrarModal()
      } else { cerrarModal() }
  }

  const styles = {
    container: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 },
    card: { backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 15 },
    totalBig: { fontSize: '2rem', fontWeight: '800', color: '#111827', textAlign: 'right', marginTop: 10 },
    label: { fontSize: '0.8rem', fontWeight: 'bold', color: '#374151', marginBottom: 5, display: 'block' },
    chip: (active) => ({ 
        padding:'8px', textAlign:'center', border: active?'2px solid #2563eb':'1px solid #e5e7eb', 
        borderRadius:8, cursor:'pointer', backgroundColor: active?'#eff6ff':'white', color: active?'#1e40af':'#4b5563' 
    }),
    inputStd: { width:'100%', padding:8, borderRadius:6, border:'1px solid #d1d5db', boxSizing: 'border-box' } 
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={styles.container}>
        <div style={{display:'flex', flexDirection:'column', gap:15}}>
             <div>
                <label style={styles.label}>Tipo de Labor</label>
                <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8}}>
                    {Object.keys(ICONOS_LABOR).map(k => (
                        <div key={k} style={styles.chip(formData.tipo_labor === k)} onClick={() => updateForm('tipo_labor', k)}>
                            {ICONOS_LABOR[k]}
                            <div style={{fontSize:'0.7rem', marginTop:4}}>{k}</div>
                        </div>
                    ))}
                </div>
             </div>
             
             {/* GRID FECHA Y EJECUTOR */}
             <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
                <div>
                    <label style={styles.label}>Fecha</label>
                    <input type="date" value={formData.fecha} onChange={e => updateForm('fecha', e.target.value)} required style={styles.inputStd}/>
                </div>
                <div>
                    <label style={styles.label}>Ejecutor</label>
                    <select value={formData.proveedor_id} onChange={e => updateForm('proveedor_id', e.target.value)} style={styles.inputStd}>
                        <option value="">Personal Interno</option>
                        {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </div>
             </div>

             <div style={{...styles.card, backgroundColor:'white', maxHeight:300, overflowY:'auto'}}>
                <label style={styles.label}>Sectores ({stats.sectores})</label>
                {parcelas.map(p => (
                    <div key={p.id} style={{marginBottom:8}}>
                        <div 
                            style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px', backgroundColor:'#f3f4f6', borderRadius:6, cursor:'pointer'}}
                            onClick={() => toggleTodaParcela(p.id)}
                        >
                            <span style={{fontWeight:'bold', fontSize:'0.85rem'}}>{p.nombre}</span>
                            {p.sectores?.every(s => sectoresSeleccionados.includes(s.id)) ? <CheckSquare size={16} color="#2563eb"/> : <Square size={16} color="#9ca3af"/>}
                        </div>
                        {parcelasExpandidas[p.id] && (
                            <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:5, padding:5}}>
                                {p.sectores?.map(s => (
                                    <div 
                                        key={s.id} 
                                        onClick={() => toggleSector(s.id)}
                                        style={{
                                            padding:'4px 8px', fontSize:'0.75rem', borderRadius:4, cursor:'pointer', textAlign:'center',
                                            backgroundColor: sectoresSeleccionados.includes(s.id) ? '#1f2937' : 'white',
                                            color: sectoresSeleccionados.includes(s.id) ? 'white' : '#4b5563',
                                            border: '1px solid #d1d5db'
                                        }}
                                    >
                                        {s.nombre}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
             </div>
             
             <div>
                 <label style={styles.label}>Descripción</label>
                 <input type="text" value={formData.descripcion} onChange={e => updateForm('descripcion', e.target.value)} style={styles.inputStd} />
             </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:15}}>
             <div style={styles.card}>
                <label style={{...styles.label, color:'#2563eb'}}>1. Mano de Obra</label>
                <div style={{display:'flex', backgroundColor:'#e5e7eb', borderRadius:6, padding:2, marginBottom:10}}>
                    {['Global', 'Por Arbol', 'Por Ha'].map(m => (
                        <div 
                            key={m} 
                            onClick={() => updateForm('modo_calculo', m)}
                            style={{
                                flex:1, textAlign:'center', padding:'4px', fontSize:'0.75rem', cursor:'pointer', borderRadius:4,
                                backgroundColor: formData.modo_calculo === m ? 'white' : 'transparent',
                                fontWeight: formData.modo_calculo === m ? 'bold' : 'normal'
                            }}
                        >
                            {m}
                        </div>
                    ))}
                </div>
                
                <div style={{display:'flex', alignItems:'center', border:'1px solid #d1d5db', borderRadius:6, backgroundColor:'white', padding:'5px 10px'}}>
                    <span style={{fontSize:'1.2rem', color:'#9ca3af', marginRight:5}}>$</span>
                    <SmartInputSimple value={formData.valor_unitario_mo} onChange={v => updateForm('valor_unitario_mo', v)} />
                    <span style={{fontSize:'0.7rem', backgroundColor:'#f3f4f6', padding:'2px 5px', borderRadius:4}}>
                        / {formData.modo_calculo === 'Global' ? 'Total' : formData.modo_calculo === 'Por Arbol' ? 'Arbol' : 'Ha'}
                    </span>
                </div>

                <div style={{display:'flex', justifyContent:'space-between', marginTop:5, color:'#1e40af', fontWeight:'bold', fontSize:'0.9rem'}}>
                    <span>Subtotal MO:</span>
                    <span>$ {Math.round(costoMO).toLocaleString('es-CL')}</span>
                </div>
             </div>

             <div style={{...styles.card, border:'1px solid #fcd34d'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                    <label style={{...styles.label, color:'#d97706', margin:0}}>2. Insumos</label>
                    <span style={{fontSize:'0.8rem', fontWeight:'bold'}}>$ {Math.round(insumosSeleccionados.reduce((a,b)=>a+b.subtotal,0)).toLocaleString('es-CL')}</span>
                </div>
                <div style={{display:'flex', gap:5, marginBottom:10}}>
                    <select 
                        style={{flex:2, padding:6, borderRadius:6, border:'1px solid #d1d5db', fontSize:'0.8rem'}}
                        value={insumoTemp.id} onChange={e => setInsumoTemp({...insumoTemp, id: e.target.value})}
                    >
                        <option value="">Seleccionar Insumo...</option>
                        {insumosBodega.map(i => <option key={i.id} value={i.id}>{i.nombre} ({i.stock_actual} {i.unidad_medida})</option>)}
                    </select>
                    <input 
                        type="number" placeholder="Cant" style={{flex:1, width:50, padding:6, borderRadius:6, border:'1px solid #d1d5db'}}
                        value={insumoTemp.cantidad} onChange={e => setInsumoTemp({...insumoTemp, cantidad: e.target.value})}
                    />
                    <button type="button" onClick={agregarInsumo} style={{backgroundColor:'#1f2937', color:'white', border:'none', borderRadius:6, cursor:'pointer', padding:'0 8px'}}><Plus size={16}/></button>
                </div>
                <div style={{backgroundColor:'white', borderRadius:6, maxHeight:100, overflowY:'auto', padding:5}}>
                    {insumosSeleccionados.map(i => (
                        <div key={i.uniqueId} style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', borderBottom:'1px solid #f3f4f6', padding:'4px 0'}}>
                            <div>{i.nombre} ({i.cantidad} {i.unidad})</div>
                            <div style={{display:'flex', gap:8}}>
                                <strong>$ {Math.round(i.subtotal).toLocaleString('es-CL')}</strong>
                                <Trash2 size={12} color="#ef4444" style={{cursor:'pointer'}} onClick={() => {
                                    setInsumosSeleccionados(prev => prev.filter(x => x.uniqueId !== i.uniqueId)); setHasChanges(true)
                                }}/>
                            </div>
                        </div>
                    ))}
                    {insumosSeleccionados.length === 0 && <div style={{textAlign:'center', color:'#9ca3af', fontSize:'0.7rem'}}>Sin insumos</div>}
                </div>
             </div>

             <div style={{marginTop:'auto'}}>
                 <div style={{textAlign:'right', fontSize:'0.9rem', color:'#6b7280'}}>Costo Total Estimado</div>
                 <div style={styles.totalBig}>$ {Math.round(totalGeneral).toLocaleString('es-CL')}</div>
                 
                 {/* SECCIÓN GASTOS: RESTAURADA CON CORRECCIÓN */}
                 <div style={{marginTop:10, paddingTop:10, borderTop:'1px dashed #d1d5db'}}>
                     <div style={{display:'flex', gap:5, alignItems:'center', justifyContent:'flex-end', marginBottom:8}}>
                         <input type="checkbox" id="chkGasto" checked={formData.pasar_a_gastos} onChange={e => updateForm('pasar_a_gastos', e.target.checked)} style={{cursor:'pointer'}}/>
                         <label htmlFor="chkGasto" style={{fontSize:'0.9rem', cursor:'pointer', fontWeight:'bold', color:'#374151'}}>Registrar como Gasto</label>
                     </div>
                     {formData.pasar_a_gastos && (
                         <div style={{display:'flex', flexDirection:'column', gap:8, backgroundColor:'#f3f4f6', padding:10, borderRadius:8}}>
                             <select 
                                value={formData.categoria_id} 
                                onChange={e => updateForm('categoria_id', e.target.value)}
                                style={{width:'100%', padding:6, borderRadius:6, border:'1px solid #d1d5db', fontSize:'0.85rem'}}
                             >
                                 <option value="">Seleccionar Categoría...</option>
                                 {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                             </select>
                             <select 
                                value={formData.subcategoria_id} 
                                onChange={e => updateForm('subcategoria_id', e.target.value)}
                                style={{width:'100%', padding:6, borderRadius:6, border:'1px solid #d1d5db', fontSize:'0.85rem'}}
                                disabled={!formData.categoria_id}
                             >
                                 <option value="">Seleccionar Subcategoría...</option>
                                 {subcategoriasFiltradas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                             </select>
                         </div>
                     )}
                </div>
             </div>
        </div>
      </div>

      <div style={{display:'flex', justifyContent:'flex-end', gap:10, marginTop:20, paddingTop:10, borderTop:'1px solid #e5e7eb'}}>
          <button type="button" onClick={handleCerrarSeguro} style={{padding:'10px 20px', border:'1px solid #d1d5db', background:'transparent', borderRadius:6, cursor:'pointer'}}>Cancelar</button>
          <button type="submit" disabled={loading} style={{padding:'10px 20px', backgroundColor:'#111827', color:'white', border:'none', borderRadius:6, fontWeight:'bold', cursor:'pointer', display:'flex', alignItems:'center', gap:8}}>
              <Save size={18}/> {loading ? 'Guardando...' : 'Guardar Labor'}
          </button>
      </div>
    </form>
  )
}

export default NuevaLabor