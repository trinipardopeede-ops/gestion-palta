import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { 
    Save, Plus, Trash2, Calendar, User, 
    Package, CheckSquare, Square, ChevronDown, ChevronRight,
    Droplets, TestTube, Scissors, CircleDot, Leaf, Hammer, ClipboardList, Map
} from 'lucide-react'

// --- HELPER: ALGORITMO DE DISTRIBUCIÓN EXACTA ("RESTO AL ÚLTIMO") ---
const calcularDistribucionExacta = (montoTotal, idsSeleccionados, listaParcelas, metodo) => {
    // Aplanar todos los sectores disponibles para buscarlos por ID
    const todosSectores = listaParcelas.flatMap(p => p.sectores || []);
    const sectoresTarget = todosSectores.filter(s => idsSeleccionados.includes(s.id));
    
    if (sectoresTarget.length === 0 || montoTotal <= 0) return [];

    let distribucion = [];
    let montoAcumulado = 0;
    const totalItems = sectoresTarget.length;

    // Calcular el denominador según el método
    let denominadorTotal = 0;
    if (metodo === 'Equitativo') {
        denominadorTotal = totalItems;
    } else if (metodo === 'Superficie') {
        denominadorTotal = sectoresTarget.reduce((acc, s) => acc + (parseFloat(s.superficie_ha) || 0), 0);
    } else if (metodo === 'Arboles') {
        denominadorTotal = sectoresTarget.reduce((acc, s) => acc + (parseInt(s.cantidad_arboles) || 0), 0);
    }

    // Fallback si denominador es 0
    if (denominadorTotal === 0 && metodo !== 'Equitativo') {
        denominadorTotal = totalItems;
        metodo = 'Equitativo';
    }

    // Iterar hasta el penúltimo elemento
    for (let i = 0; i < totalItems - 1; i++) {
        const sector = sectoresTarget[i];
        let factor = 0;
        
        if (metodo === 'Equitativo') factor = 1;
        else if (metodo === 'Superficie') factor = parseFloat(sector.superficie_ha) || 0;
        else if (metodo === 'Arboles') factor = parseInt(sector.cantidad_arboles) || 0;

        const porcentaje = (factor / denominadorTotal);
        const montoCuota = Math.round(montoTotal * porcentaje);
        
        distribucion.push({
            sector_id: sector.id,
            monto: montoCuota,
            porcentaje: (porcentaje * 100).toFixed(2)
        });
        montoAcumulado += montoCuota;
    }

    // Asignar el resto exacto al último elemento
    const ultimoSector = sectoresTarget[totalItems - 1];
    const montoRestante = montoTotal - montoAcumulado;
    const porcentajeRestante = montoTotal > 0 ? (montoRestante / montoTotal) : 0;

    distribucion.push({
        sector_id: ultimoSector.id,
        monto: montoRestante,
        porcentaje: (porcentajeRestante * 100).toFixed(2)
    });

    return distribucion;
};

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

  const [gastoVinculadoId, setGastoVinculadoId] = useState(null)

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
  const [insumoTemp, setInsumoTemp] = useState({ id: '', cantidad: '', precio: '' })

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
          // Restaurar valor unitario y modo de cálculo desde BD
          const valorUnitarioGuardado = data.valor_unitario_mo || 0
          let modoCalculo = 'Global'
          if (data.metodo_distribucion === 'arboles') modoCalculo = 'Por Arbol'
          if (data.metodo_distribucion === 'superficie' && valorUnitarioGuardado > 0 && (data.costo_mano_obra || 0) !== valorUnitarioGuardado) modoCalculo = 'Por Ha'

          // Buscar gasto vinculado a esta labor
          const { data: gastoVinculado } = await supabase
              .from('gastos')
              .select('id, categoria_id, subcategoria_id')
              .eq('labor_origen_id', idLabor)
              .single()

          setGastoVinculadoId(gastoVinculado?.id || null)

          setFormData({
              fecha: data.fecha,
              tipo_labor: data.tipo_labor,
              proveedor_id: data.proveedor_id || '',
              descripcion: data.descripcion || '',
              modo_calculo: modoCalculo,
              valor_unitario_mo: valorUnitarioGuardado,
              pasar_a_gastos: !!gastoVinculado,
              categoria_id: gastoVinculado?.categoria_id?.toString() || '',
              subcategoria_id: gastoVinculado?.subcategoria_id?.toString() || ''
          })

          setCostoMO(data.costo_mano_obra || 0)
          if (data.sectores_ids && Array.isArray(data.sectores_ids)) setSectoresSeleccionados(data.sectores_ids)
          else if (data.sector_id) setSectoresSeleccionados([data.sector_id])

          setInsumosSeleccionados((data.detalles_insumos || []).map((i, idx) => ({
              ...i,
              uniqueId: i.uniqueId || `loaded-${idx}-${i.insumo_id}`
          })))
          setHasChanges(false)
      }
  }

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
      const costo = parseFloat(insumoTemp.precio || item.costo_promedio || 0)
      const cant = parseFloat(insumoTemp.cantidad)
      setInsumosSeleccionados([...insumosSeleccionados, {
          uniqueId: Date.now(), insumo_id: item.id, nombre: item.nombre, unidad: item.unidad_medida,
          cantidad: cant, costo_unitario: costo, subtotal: cant * costo
      }])
      setInsumoTemp({ id: '', cantidad: '', precio: '' }); setHasChanges(true)
  }

// --- FUNCIÓN DE GUARDADO REFACTORIZADA (NUEVALABOR.JSX) ---
  const handleSubmit = async (e) => {
      e.preventDefault()
      if (sectoresSeleccionados.length === 0) return alert("Selecciona al menos un sector")
      if (formData.pasar_a_gastos && !formData.categoria_id) return alert("Selecciona una categoría contable para registrar el gasto.")
      setLoading(true)
      try {
          const totalInsumos = insumosSeleccionados.reduce((acc, i) => acc + i.subtotal, 0)
          
          // Inferencia de lógica para BD
          let metodoDistBD = 'superficie' 
          if (formData.modo_calculo === 'Por Arbol') metodoDistBD = 'arboles'
          
          // Inferencia para Gasto
          let metodoParaGasto = 'Superficie' 
          if (formData.modo_calculo === 'Por Arbol') metodoParaGasto = 'Arboles'
          if (formData.modo_calculo === 'Por Ha') metodoParaGasto = 'Superficie'

          const nuevaLabor = {
              fecha: formData.fecha,
              tipo_labor: formData.tipo_labor,
              proveedor_id: formData.proveedor_id || null,
              descripcion: formData.descripcion,
              sectores_ids: sectoresSeleccionados,
              metodo_distribucion: metodoDistBD,
              valor_unitario_mo: parseFloat(formData.valor_unitario_mo) || 0,
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
          } else if (idLabor) {
              // Edición: borrar movimientos anteriores de esta labor y recrear
              await supabase.from('bodega_movimientos').delete().eq('labor_id', idLabor)
              if (insumosSeleccionados.length > 0) {
                  const movs = insumosSeleccionados.map(i => ({
                      insumo_id: i.insumo_id, tipo_movimiento: 'Salida', cantidad: i.cantidad,
                      fecha: formData.fecha, referencia: `Labor #${laborIdInserted}`, labor_id: laborIdInserted, costo_unitario: i.costo_unitario
                  }))
                  await supabase.from('bodega_movimientos').insert(movs)
              }
          }

          // --- GASTO VINCULADO: crear si es nuevo, actualizar si ya existe ---
          if (formData.pasar_a_gastos) {
              const payloadGasto = {
                  fecha: formData.fecha,
                  monto: totalGeneral,
                  proveedor_id: formData.proveedor_id || null,
                  descripcion: formData.descripcion || `Labor: ${formData.tipo_labor}`,
                  tipo_documento: 'Interno',
                  categoria_id: formData.categoria_id,
                  subcategoria_id: formData.subcategoria_id || null,
                  clase_contable: 'OPEX',
                  sectores_ids: sectoresSeleccionados,
                  labor_origen_id: laborIdInserted,
                  metodo_distribucion: metodoParaGasto
              }

              if (gastoVinculadoId) {
                  // ACTUALIZAR gasto existente
                  const { error: errUpd } = await supabase
                      .from('gastos')
                      .update({ ...payloadGasto, estado_pago: 'Pendiente' })
                      .eq('id', gastoVinculadoId)
                  if (errUpd) throw errUpd

                  // Recalcular distribución
                  await supabase.from('gasto_distribucion').delete().eq('gasto_id', gastoVinculadoId)
                  const dist = calcularDistribucionExacta(totalGeneral, sectoresSeleccionados, parcelas, metodoParaGasto)
                      .map(i => ({ ...i, gasto_id: gastoVinculadoId }))
                  if (dist.length > 0) await supabase.from('gasto_distribucion').insert(dist)

                  // Actualizar cuota pendiente si existe, o crear si no
                  const { data: cuotasExistentes } = await supabase
                      .from('pagos_gastos').select('id, estado').eq('gasto_id', gastoVinculadoId)
                  const cuotaPendiente = cuotasExistentes?.find(c => c.estado === 'Pendiente')
                  if (cuotaPendiente) {
                      await supabase.from('pagos_gastos')
                          .update({ monto: totalGeneral, fecha_vencimiento: formData.fecha })
                          .eq('id', cuotaPendiente.id)
                  } else if (!cuotasExistentes?.length) {
                      await supabase.from('pagos_gastos').insert([{
                          gasto_id: gastoVinculadoId, fecha_vencimiento: formData.fecha,
                          monto: totalGeneral, forma_pago: 'Transferencia',
                          estado: 'Pendiente', pagado_por_socio_id: null
                      }])
                  }
              } else {
                  // CREAR gasto nuevo
                  const { data: gastoData, error: gastoError } = await supabase
                      .from('gastos')
                      .insert([{ ...payloadGasto, estado_pago: 'Pendiente' }])
                      .select()
                  if (gastoError) throw gastoError
                  const gastoId = gastoData[0].id

                  const dist = calcularDistribucionExacta(totalGeneral, sectoresSeleccionados, parcelas, metodoParaGasto)
                      .map(i => ({ ...i, gasto_id: gastoId }))
                  if (dist.length > 0) await supabase.from('gasto_distribucion').insert(dist)

                  await supabase.from('pagos_gastos').insert([{
                      gasto_id: gastoId, fecha_vencimiento: formData.fecha,
                      monto: totalGeneral, forma_pago: 'Transferencia',
                      estado: 'Pendiente', pagado_por_socio_id: null
                  }])
              }
          }
          alGuardar()
      } catch (err) { alert("Error: " + err.message) } finally { setLoading(false) }
  }

  const handleCerrarSeguro = () => {
      if (hasChanges && (sectoresSeleccionados.length > 0 || formData.descripcion)) {
          if (confirm("¿Cerrar sin guardar?")) cerrarModal()
      } else { cerrarModal() }
  }

  // Registrar handler de cierre seguro para que ESC y clic fuera del modal lo usen
  useEffect(() => {
      window.intentarCerrarModal = handleCerrarSeguro
      return () => { delete window.intentarCerrarModal }
  }, [hasChanges, sectoresSeleccionados, formData.descripcion])

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
      {/* Banner gasto vinculado */}
      {gastoVinculadoId && (
          <div style={{backgroundColor:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'10px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:10}}>
              <span style={{fontSize:'1rem'}}>📋</span>
              <div>
                  <div style={{fontSize:'0.85rem', fontWeight:'700', color:'#1e40af'}}>Esta labor tiene un gasto asociado (#{gastoVinculadoId})</div>
                  <div style={{fontSize:'0.75rem', color:'#3b82f6', marginTop:1}}>Al guardar se actualizará automáticamente el monto, distribución y cuota pendiente del gasto.</div>
              </div>
          </div>
      )}
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
                        <div key={m} onClick={() => updateForm('modo_calculo', m)}
                            style={{flex:1, textAlign:'center', padding:'4px', fontSize:'0.75rem', cursor:'pointer', borderRadius:4,
                                backgroundColor: formData.modo_calculo === m ? 'white' : 'transparent',
                                fontWeight: formData.modo_calculo === m ? 'bold' : 'normal'}}>
                            {m}
                        </div>
                    ))}
                </div>

                {/* Stats contextuales según modo */}
                {formData.modo_calculo !== 'Global' && (
                    <div style={{display:'flex', gap:8, marginBottom:8}}>
                        {formData.modo_calculo === 'Por Arbol' && (
                            <div style={{flex:1, backgroundColor:'#eff6ff', borderRadius:6, padding:'4px 8px', textAlign:'center'}}>
                                <div style={{fontSize:'0.65rem', color:'#6b7280'}}>Árboles selec.</div>
                                <div style={{fontWeight:'bold', color:'#1e40af', fontSize:'0.9rem'}}>{stats.arboles.toLocaleString('es-CL')}</div>
                            </div>
                        )}
                        {formData.modo_calculo === 'Por Ha' && (
                            <div style={{flex:1, backgroundColor:'#eff6ff', borderRadius:6, padding:'4px 8px', textAlign:'center'}}>
                                <div style={{fontSize:'0.65rem', color:'#6b7280'}}>Hectáreas selec.</div>
                                <div style={{fontWeight:'bold', color:'#1e40af', fontSize:'0.9rem'}}>{stats.has.toFixed(2)} ha</div>
                            </div>
                        )}
                        <div style={{flex:1, backgroundColor:'#f0fdf4', borderRadius:6, padding:'4px 8px', textAlign:'center'}}>
                            <div style={{fontSize:'0.65rem', color:'#6b7280'}}>Sectores</div>
                            <div style={{fontWeight:'bold', color:'#166534', fontSize:'0.9rem'}}>{stats.sectores}</div>
                        </div>
                    </div>
                )}
                
                <div style={{display:'flex', alignItems:'center', border:'1px solid #d1d5db', borderRadius:6, backgroundColor:'white', padding:'5px 10px'}}>
                    <span style={{fontSize:'1.2rem', color:'#9ca3af', marginRight:5}}>$</span>
                    <SmartInputSimple value={formData.valor_unitario_mo} onChange={v => updateForm('valor_unitario_mo', v)} />
                    <span style={{fontSize:'0.7rem', backgroundColor:'#f3f4f6', padding:'2px 5px', borderRadius:4}}>
                        / {formData.modo_calculo === 'Global' ? 'Total' : formData.modo_calculo === 'Por Arbol' ? 'Árbol' : 'Ha'}
                    </span>
                </div>

                <div style={{display:'flex', justifyContent:'space-between', marginTop:5, color:'#1e40af', fontWeight:'bold', fontSize:'0.9rem'}}>
                    <span>Subtotal MO:</span>
                    <span>$ {Math.round(costoMO).toLocaleString('es-CL')}</span>
                </div>
             </div>

             <div style={{...styles.card, border:'1px solid #fcd34d'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                    <label style={{...styles.label, color:'#d97706', margin:0}}>2. Insumos</label>
                    <span style={{fontSize:'0.8rem', fontWeight:'bold'}}>$ {Math.round(insumosSeleccionados.reduce((a,b)=>a+b.subtotal,0)).toLocaleString('es-CL')}</span>
                </div>
                {/* Fila agregar insumo: selector + cantidad + precio editable */}
                <div style={{display:'grid', gridTemplateColumns:'1fr 60px 80px auto', gap:5, marginBottom:8, alignItems:'center'}}>
                    <select style={{padding:6, borderRadius:6, border:'1px solid #d1d5db', fontSize:'0.8rem'}}
                        value={insumoTemp.id}
                        onChange={e => {
                            const item = insumosBodega.find(i => i.id.toString() === e.target.value)
                            setInsumoTemp({...insumoTemp, id: e.target.value, precio: item ? Math.round(item.costo_promedio || 0).toString() : ''})
                        }}>
                        <option value="">Seleccionar Insumo...</option>
                        {insumosBodega.map(i => <option key={i.id} value={i.id}>{i.nombre} ({i.stock_actual} {i.unidad_medida})</option>)}
                    </select>
                    <input type="number" placeholder="Cant" style={{padding:6, borderRadius:6, border:'1px solid #d1d5db', width:'100%'}}
                        value={insumoTemp.cantidad} onChange={e => setInsumoTemp({...insumoTemp, cantidad: e.target.value})}/>
                    <input type="number" placeholder="$ Precio" style={{padding:6, borderRadius:6, border:'1px solid #fcd34d', width:'100%', fontSize:'0.8rem'}}
                        value={insumoTemp.precio} onChange={e => setInsumoTemp({...insumoTemp, precio: e.target.value})}
                        title="Precio unitario (se precarga desde bodega, editable)"/>
                    <button type="button" onClick={agregarInsumo} style={{backgroundColor:'#1f2937', color:'white', border:'none', borderRadius:6, cursor:'pointer', padding:'6px 8px'}}><Plus size={16}/></button>
                </div>
                <div style={{backgroundColor:'white', borderRadius:6, maxHeight:120, overflowY:'auto', padding:5}}>
                    {insumosSeleccionados.map(i => (
                        <div key={i.uniqueId} style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', borderBottom:'1px solid #f3f4f6', padding:'4px 0', alignItems:'center'}}>
                            <div style={{flex:1}}>{i.nombre}</div>
                            <div style={{color:'#6b7280', margin:'0 8px'}}>{i.cantidad} {i.unidad} × ${Math.round(i.costo_unitario).toLocaleString('es-CL')}</div>
                            <div style={{display:'flex', gap:8, alignItems:'center'}}>
                                <strong>$ {Math.round(i.subtotal).toLocaleString('es-CL')}</strong>
                                <Trash2 size={12} color="#ef4444" style={{cursor:'pointer'}} onClick={() => {
                                    setInsumosSeleccionados(prev => prev.filter(x => x.uniqueId !== i.uniqueId)); setHasChanges(true)
                                }}/>
                            </div>
                        </div>
                    ))}
                    {insumosSeleccionados.length === 0 && <div style={{textAlign:'center', color:'#9ca3af', fontSize:'0.7rem', padding:'8px 0'}}>Sin insumos</div>}
                </div>
             </div>

             <div style={{marginTop:'auto'}}>
                 <div style={{textAlign:'right', fontSize:'0.9rem', color:'#6b7280'}}>Costo Total Estimado</div>
                 <div style={styles.totalBig}>$ {Math.round(totalGeneral).toLocaleString('es-CL')}</div>

                 {/* Desglose de distribución por sector */}
                 {sectoresSeleccionados.length > 0 && totalGeneral > 0 && (() => {
                     const metodoVista = formData.modo_calculo === 'Por Arbol' ? 'Arboles' : formData.modo_calculo === 'Global' ? 'Equitativo' : 'Superficie'
                     const dist = calcularDistribucionExacta(totalGeneral, sectoresSeleccionados, parcelas, metodoVista)
                     if (dist.length === 0) return null
                     const todosSectores = parcelas.flatMap(p => p.sectores || [])
                     return (
                         <div style={{marginTop:10, backgroundColor:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:10}}>
                             <div style={{fontSize:'0.75rem', fontWeight:'700', color:'#374151', marginBottom:6}}>
                                 Distribución por sector ({formData.modo_calculo === 'Global' ? 'Equitativo' : formData.modo_calculo === 'Por Arbol' ? 'Por árboles' : 'Por superficie'})
                             </div>
                             <div style={{maxHeight:100, overflowY:'auto', display:'flex', flexDirection:'column', gap:3}}>
                                 {dist.map(d => {
                                     const sec = todosSectores.find(s => s.id === d.sector_id)
                                     return (
                                         <div key={d.sector_id} style={{display:'flex', justifyContent:'space-between', fontSize:'0.72rem'}}>
                                             <span style={{color:'#6b7280'}}>{sec?.nombre || `Sector ${d.sector_id}`}</span>
                                             <span style={{fontWeight:'600', color:'#111827'}}>$ {Math.round(d.monto).toLocaleString('es-CL')} <span style={{color:'#9ca3af', fontWeight:'normal'}}>({d.porcentaje}%)</span></span>
                                         </div>
                                     )
                                 })}
                             </div>
                         </div>
                     )
                 })()}
                 
                 {/* SECCIÓN GASTOS: RESTAURADA CON LÓGICA DE DISTRIBUCIÓN AUTOMÁTICA */}
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