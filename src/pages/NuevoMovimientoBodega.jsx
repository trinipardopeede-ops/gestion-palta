import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { 
    Save, Plus, Trash2, FileText, ShoppingCart, 
    Package, Calculator, AlertCircle 
} from 'lucide-react'

const formatMoney = (amount) => '$ ' + Math.round(amount || 0).toLocaleString('es-CL')

function NuevoMovimientoBodega({ config, movimientoEditar, cerrar, alGuardar }) {
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  
  const [proveedores, setProveedores] = useState([])
  const [insumos, setInsumos] = useState([])

  const [header, setHeader] = useState({
      idGasto: null, 
      fecha: new Date().toISOString().split('T')[0],
      proveedor_id: '',
      tipo_documento: 'Factura',
      nro_documento: '',
      referencia: ''
  })

  const [itemsCarrito, setItemsCarrito] = useState([])

  const [itemTemp, setItemTemp] = useState({
      insumo_id: '',
      modo_entrada: 'Formato', 
      cantidad_bultos: '',   
      tamano_bulto: '',      
      precio_por_bulto: '',  
      cantidad_total: '',
      precio_total: ''
  })

  const tipoMovimiento = movimientoEditar ? movimientoEditar.tipo_movimiento : config?.tipo
  const isEntrada = tipoMovimiento === 'Entrada'

  useEffect(() => {
      const fetchMaestros = async () => {
          const [prov, ins] = await Promise.all([
              supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
              supabase.from('bodega_insumos').select('*').eq('activo', true).order('nombre')
          ])
          setProveedores(prov.data || [])
          setInsumos(ins.data || [])

          if (!movimientoEditar && config?.producto) {
              setItemTemp(prev => ({ ...prev, insumo_id: config.producto.id }))
          }
      }
      fetchMaestros()
  }, [])

  useEffect(() => {
      const cargarDocumentoCompleto = async () => {
          if (!movimientoEditar) return;
          setLoadingData(true)
          
          const matchGasto = movimientoEditar.referencia?.match(/Compra Gasto #(\d+)/)
          
          if (matchGasto && isEntrada) {
              const gastoId = matchGasto[1]
              const { data: gasto } = await supabase.from('gastos').select('*').eq('id', gastoId).single()
              
              if (gasto) {
                  setHeader({
                      idGasto: gasto.id,
                      fecha: gasto.fecha,
                      proveedor_id: gasto.proveedor_id || '',
                      tipo_documento: gasto.tipo_documento,
                      nro_documento: gasto.nro_documento || '',
                      referencia: gasto.descripcion
                  })

                  const { data: movsHermanos } = await supabase
                    .from('bodega_movimientos')
                    .select('*')
                    .ilike('referencia', `%Compra Gasto #${gastoId}%`)
                  
                  if (movsHermanos) {
                      const itemsRecuperados = movsHermanos.map(m => {
                          const insumoData = (insumos.length > 0) ? insumos.find(i => i.id === m.insumo_id) : null
                          return {
                              uniqueId: m.id, 
                              insumo_id: m.insumo_id,
                              nombre: insumoData ? insumoData.nombre : 'Cargando...',
                              unidad: insumoData ? insumoData.unidad_medida : 'Ud',
                              cantidadFinal: m.cantidad,
                              costoUnitario: m.costo_unitario,
                              costoTotal: m.cantidad * m.costo_unitario
                          }
                      })
                      setItemsCarrito(itemsRecuperados)
                  }
              }
          } else {
              setHeader(prev => ({ ...prev, fecha: movimientoEditar.fecha, referencia: movimientoEditar.referencia }))
              const insumoData = insumos.find(i => i.id === movimientoEditar.insumo_id)
              setItemsCarrito([{
                  uniqueId: movimientoEditar.id,
                  insumo_id: movimientoEditar.insumo_id,
                  nombre: insumoData ? insumoData.nombre : '...',
                  unidad: insumoData ? insumoData.unidad_medida : 'Ud',
                  cantidadFinal: movimientoEditar.cantidad,
                  costoUnitario: movimientoEditar.costo_unitario,
                  costoTotal: isEntrada ? (movimientoEditar.cantidad * movimientoEditar.costo_unitario) : 0
              }])
          }
          setLoadingData(false)
      }

      if (insumos.length > 0) cargarDocumentoCompleto()
  }, [movimientoEditar, insumos])

  const getCalculosItem = () => {
      const insumo = insumos.find(i => i.id == itemTemp.insumo_id)
      const unidad = insumo?.unidad_medida || 'Unid'
      let cantidadFinal = 0, costoTotal = 0, costoUnitario = 0

      if (itemTemp.modo_entrada === 'Formato') {
          const bultos = parseFloat(itemTemp.cantidad_bultos) || 0
          const tamano = parseFloat(itemTemp.tamano_bulto) || 0
          const precioBulto = parseFloat(itemTemp.precio_por_bulto) || 0
          cantidadFinal = bultos * tamano
          costoTotal = bultos * precioBulto
      } else {
          cantidadFinal = parseFloat(itemTemp.cantidad_total) || 0
          costoTotal = parseFloat(itemTemp.precio_total) || 0
      }
      if (cantidadFinal > 0) costoUnitario = costoTotal / cantidadFinal
      return { cantidadFinal, costoTotal, costoUnitario, unidad, nombre: insumo?.nombre }
  }

  const handleAgregarItem = () => {
      if (!itemTemp.insumo_id) return alert("Selecciona un insumo")
      const calculos = getCalculosItem()
      
      if (calculos.cantidadFinal <= 0) return alert("Cantidad inválida")
      if (isEntrada && calculos.costoTotal <= 0) return alert("Costo inválido")

      const nuevoItem = {
          uniqueId: Date.now(),
          insumo_id: itemTemp.insumo_id,
          ...calculos
      }
      setItemsCarrito([...itemsCarrito, nuevoItem])
      setItemTemp({ ...itemTemp, insumo_id: '', cantidad_bultos: '', precio_por_bulto: '', cantidad_total: '', precio_total: '' })
  }

  const handleEditRow = (id, field, value) => {
      const newItems = itemsCarrito.map(item => {
          if (item.uniqueId === id) {
              const val = parseFloat(value) || 0
              const updatedItem = { ...item, [field]: val }
              // Recalcular subtotal
              if (field === 'cantidadFinal' || field === 'costoUnitario') {
                  updatedItem.costoTotal = updatedItem.cantidadFinal * updatedItem.costoUnitario
              }
              return updatedItem
          }
          return item
      })
      setItemsCarrito(newItems)
  }

  const handleEliminarDelCarrito = (id) => {
      if(confirm("¿Quitar línea?")) setItemsCarrito(itemsCarrito.filter(i => i.uniqueId !== id))
  }

  const handleSubmit = async (e) => {
      e.preventDefault()
      if (itemsCarrito.length === 0) return alert("Agrega items")
      if (isEntrada && !header.proveedor_id) return alert("Falta proveedor")

      setLoading(true)
      try {
          const montoTotal = itemsCarrito.reduce((acc, it) => acc + it.costoTotal, 0)
          let referenciaFinal = header.referencia
          let gastoId = header.idGasto

          if (isEntrada) {
              const descGasto = itemsCarrito.length === 1 ? `Compra: ${itemsCarrito[0].nombre}` : `Compra Bodega: ${itemsCarrito.length} items`
              
              const payloadGasto = {
                  fecha: header.fecha,
                  monto: montoTotal,
                  descripcion: descGasto,
                  proveedor_id: header.proveedor_id,
                  tipo_documento: header.tipo_documento,
                  nro_documento: header.nro_documento,
                  clase_contable: 'OPEX',
                  estado_pago: 'Pendiente', 
                  categoria_id: null,
                  metodo_distribucion: null 
              }

              if (gastoId) {
                  await supabase.from('gastos').update(payloadGasto).eq('id', gastoId)
                  await supabase.from('pagos_gastos').update({ monto: montoTotal, fecha_vencimiento: header.fecha }).eq('gasto_id', gastoId).eq('estado', 'Pendiente')
              } else {
                  const { data: g } = await supabase.from('gastos').insert([payloadGasto]).select()
                  gastoId = g[0].id
                  await supabase.from('pagos_gastos').insert([{ gasto_id: gastoId, fecha_vencimiento: header.fecha, monto: montoTotal, forma_pago: 'Transferencia', estado: 'Pendiente' }])
              }
              
              referenciaFinal = `Compra Gasto #${gastoId} - ${header.referencia || ''}`
              if (gastoId) await supabase.from('bodega_movimientos').delete().ilike('referencia', `%Compra Gasto #${gastoId}%`)
          }

          const movs = itemsCarrito.map(item => ({
              insumo_id: item.insumo_id,
              tipo_movimiento: tipoMovimiento,
              cantidad: item.cantidadFinal,
              costo_unitario: item.costoUnitario, 
              fecha: header.fecha,
              referencia: referenciaFinal
          }))

          if (movs.length > 0) await supabase.from('bodega_movimientos').insert(movs)
          alGuardar()
      } catch (err) { alert("Error: " + err.message) } 
      finally { setLoading(false) }
  }

  // --- ESTILOS AJUSTADOS: ANCHO Y PROPORCIONES ---
  const styles = {
    // Forzamos un ancho considerable para que se vea como en la imagen
    container: { width: '85vw', maxWidth:'1400px', height: '80vh', display:'flex', flexDirection:'column' },
    layout: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start', flex:1, overflow:'hidden' }, 
    
    // Panel Izq (Scroll si es necesario)
    leftPanel: { display:'flex', flexDirection:'column', gap:15, overflowY:'auto', maxHeight:'100%', paddingRight:5 },
    
    // Panel Der (Flex para ocupar el resto)
    rightPanel: { display:'flex', flexDirection:'column', height:'100%', gap:15 },

    card: { backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 },
    label: { fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' },
    sectionTitle: { fontSize:'1rem', fontWeight:'bold', color:'#111827', marginBottom:15, display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid #f3f4f6', paddingBottom:10 },
    
    toggleContainer: { display:'flex', backgroundColor:'#f3f4f6', padding:4, borderRadius:8, marginBottom:15 },
    toggleBtn: (active) => ({ flex:1, padding:'8px', borderRadius:6, border:'none', cursor:'pointer', fontSize:'0.8rem', fontWeight:'600', backgroundColor: active ? 'white' : 'transparent', color: active ? '#2563eb' : '#6b7280', boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }),

    // Tabla Estilo Pro Amplia
    tableHeader: { display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 40px', gap:15, fontSize:'0.75rem', fontWeight:'bold', color:'#6b7280', marginBottom:8, padding:'0 5px' },
    tableRow: { display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 40px', gap:15, alignItems:'center', marginBottom:8, paddingBottom:8, borderBottom:'1px solid #f3f4f6' },
    inputTable: { width:'100%', padding:'8px', borderRadius:6, border:'1px solid #d1d5db', fontSize:'0.9rem', textAlign:'right', fontWeight:'500' }
  }

  const calcUI = getCalculosItem()
  const totalDoc = itemsCarrito.reduce((acc, i) => acc + i.costoTotal, 0)

  if(loadingData) return <div style={{padding:40, textAlign:'center'}}>Cargando datos del documento...</div>

  return (
    <form onSubmit={handleSubmit} style={styles.container}>
        <div style={styles.layout}>
            {/* IZQUIERDA: CONFIGURACIÓN */}
            <div style={styles.leftPanel}>
                <div style={styles.card}>
                    <div style={styles.sectionTitle}><FileText size={18}/> {header.idGasto ? `Editando Compra #${header.idGasto}` : 'Datos'}</div>
                    <div style={{marginBottom:15}}>
                        <label style={styles.label}>Fecha</label>
                        <input type="date" value={header.fecha} onChange={e => setHeader({...header, fecha: e.target.value})} style={styles.input} required/>
                    </div>
                    {isEntrada && (
                        <>
                            <div style={{marginBottom:15}}>
                                <label style={styles.label}>Proveedor</label>
                                <select value={header.proveedor_id} onChange={e => setHeader({...header, proveedor_id: e.target.value})} style={styles.input}>
                                    <option value="">-- Seleccionar --</option>
                                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                </select>
                            </div>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                                 <div>
                                    <label style={styles.label}>Tipo Doc</label>
                                    <select value={header.tipo_documento} onChange={e => setHeader({...header, tipo_documento: e.target.value})} style={styles.input}>
                                        <option>Factura</option><option>Boleta</option><option>Guía</option>
                                    </select>
                                 </div>
                                 <div>
                                    <label style={styles.label}>N° Doc</label>
                                    <input type="text" placeholder="123456" value={header.nro_documento} onChange={e => setHeader({...header, nro_documento: e.target.value})} style={styles.input}/>
                                 </div>
                            </div>
                        </>
                    )}
                </div>

                <div style={{...styles.card, backgroundColor:'#f8fafc', border:'1px solid #bfdbfe', flex:1}}>
                    <div style={{...styles.sectionTitle, color:'#1e40af', borderColor:'#dbeafe'}}>
                        <ShoppingCart size={18}/> Agregar Item
                    </div>
                    <div style={{marginBottom:15}}>
                        <label style={styles.label}>Producto</label>
                        <select value={itemTemp.insumo_id} onChange={e => setItemTemp({...itemTemp, insumo_id: e.target.value})} style={styles.input}>
                            <option value="">-- Seleccionar Insumo --</option>
                            {insumos.map(i => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_medida})</option>)}
                        </select>
                    </div>

                    {itemTemp.insumo_id && (
                        <>
                            <div style={styles.toggleContainer}>
                                <button type="button" onClick={() => setItemTemp({...itemTemp, modo_entrada: 'Formato'})} style={styles.toggleBtn(itemTemp.modo_entrada === 'Formato')}>📦 Paquete</button>
                                <button type="button" onClick={() => setItemTemp({...itemTemp, modo_entrada: 'Unidad'})} style={styles.toggleBtn(itemTemp.modo_entrada === 'Unidad')}>💧 Unidad</button>
                            </div>

                            {itemTemp.modo_entrada === 'Formato' ? (
                                <div style={{display:'flex', flexDirection:'column', gap:10}}>
                                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                                        <div><label style={styles.label}>Cant. Paquetes</label><input type="number" placeholder="3" style={styles.input} value={itemTemp.cantidad_bultos} onChange={e => setItemTemp({...itemTemp, cantidad_bultos: e.target.value})}/></div>
                                        <div><label style={styles.label}>Contenido ({calcUI.unidad})</label><input type="number" placeholder="25" style={styles.input} value={itemTemp.tamano_bulto} onChange={e => setItemTemp({...itemTemp, tamano_bulto: e.target.value})}/></div>
                                    </div>
                                    <div>
                                        <label style={styles.label}>Precio POR PAQUETE ($)</label>
                                        <input type="number" placeholder="$$$" style={{...styles.input, fontWeight:'bold', color:'#166534'}} value={itemTemp.precio_por_bulto} onChange={e => setItemTemp({...itemTemp, precio_por_bulto: e.target.value})}/>
                                    </div>
                                </div>
                            ) : (
                                <div style={{display:'flex', flexDirection:'column', gap:10}}>
                                    <div><label style={styles.label}>Total ({calcUI.unidad})</label><input type="number" placeholder="100" style={styles.input} value={itemTemp.cantidad_total} onChange={e => setItemTemp({...itemTemp, cantidad_total: e.target.value})}/></div>
                                    <div><label style={styles.label}>Precio Total ($)</label><input type="number" placeholder="$$$" style={styles.input} value={itemTemp.precio_total} onChange={e => setItemTemp({...itemTemp, precio_total: e.target.value})}/></div>
                                </div>
                            )}

                            <div style={{marginTop:15, padding:10, backgroundColor:'white', borderRadius:8, border:'1px dashed #cbd5e1', fontSize:'0.85rem'}}>
                                <div style={{display:'flex', justifyContent:'space-between'}}><span>Entrará:</span><strong>{calcUI.cantidadFinal} {calcUI.unidad}</strong></div>
                                <div style={{display:'flex', justifyContent:'space-between'}}><span>Total $:</span><strong style={{color:'#166534'}}>{formatMoney(calcUI.costoTotal)}</strong></div>
                            </div>

                            <button type="button" onClick={handleAgregarItem} style={{width:'100%', marginTop:15, backgroundColor:'#2563eb', color:'white', border:'none', padding:10, borderRadius:8, fontWeight:'bold', cursor:'pointer', display:'flex', justifyContent:'center', gap:8}}>
                                <Plus size={18}/> Agregar
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* DERECHA: TABLA EDITABLE GRANDE */}
            <div style={styles.rightPanel}>
                <div style={styles.card}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div>
                            <div style={{fontSize:'0.8rem', color:'#6b7280', textTransform:'uppercase', letterSpacing:1}}>Total Documento</div>
                            <div style={{fontSize:'2.5rem', fontWeight:'800', color:'#1f2937'}}>{formatMoney(totalDoc)}</div>
                        </div>
                        {isEntrada && (
                            <div style={{textAlign:'right', padding:'8px 15px', borderRadius:8, backgroundColor:'#fffbeb', border:'1px solid #fef3c7'}}>
                                <div style={{fontSize:'0.75rem', color:'#d97706', fontWeight:'bold', marginBottom:2}}>ESTADO PAGO</div>
                                <div style={{display:'flex', alignItems:'center', gap:5, color:'#d97706', fontWeight:'800'}}>
                                    <AlertCircle size={16}/> PENDIENTE
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{...styles.card, flex:1, display:'flex', flexDirection:'column'}}>
                    <div style={styles.sectionTitle}>Detalle ({itemsCarrito.length})</div>
                    
                    <div style={styles.tableHeader}>
                        <div>Insumo</div>
                        <div style={{textAlign:'right'}}>Cant</div>
                        <div style={{textAlign:'right'}}>Unitario</div>
                        <div style={{textAlign:'right'}}>Subtotal</div>
                        <div></div>
                    </div>

                    <div style={{flex:1, overflowY:'auto'}}>
                        {itemsCarrito.length === 0 && <div style={{padding:40, textAlign:'center', color:'#9ca3af', fontStyle:'italic'}}>No hay items agregados.</div>}
                        
                        {itemsCarrito.map(item => (
                            <div key={item.uniqueId} style={styles.tableRow}>
                                <div>
                                    <div style={{fontWeight:'bold', color:'#374151', fontSize:'0.9rem'}}>{item.nombre}</div>
                                    <div style={{fontSize:'0.7rem', color:'#6b7280'}}>{item.unidad}</div>
                                </div>
                                
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={item.cantidadFinal} 
                                    onChange={e => handleEditRow(item.uniqueId, 'cantidadFinal', e.target.value)} 
                                    style={styles.inputTable}
                                />

                                <input 
                                    type="number" 
                                    value={Math.round(item.costoUnitario)} 
                                    onChange={e => handleEditRow(item.uniqueId, 'costoUnitario', e.target.value)} 
                                    style={styles.inputTable}
                                />

                                <div style={{textAlign:'right', fontWeight:'bold', color:'#111827', fontSize:'0.9rem'}}>
                                    {formatMoney(item.costoTotal)}
                                </div>

                                <button onClick={() => handleEliminarDelCarrito(item.uniqueId)} style={{border:'none', background:'transparent', color:'#ef4444', cursor:'pointer', display:'flex', justifyContent:'center'}}>
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        ))}
                    </div>

                    <div style={{marginTop:20, paddingTop:20, borderTop:'1px solid #e5e7eb'}}>
                        <div style={{marginBottom:10}}>
                            <label style={styles.label}>Nota General</label>
                            <input type="text" placeholder="Opcional..." value={header.referencia} onChange={e => setHeader({...header, referencia: e.target.value})} style={styles.input}/>
                        </div>
                        <div style={{display:'flex', gap:10}}>
                            <button type="button" onClick={cerrar} style={{flex:1, padding:12, background:'white', border:'1px solid #d1d5db', borderRadius:8, fontWeight:'bold', color:'#374151', cursor:'pointer'}}>Cancelar</button>
                            <button type="submit" disabled={loading} style={{flex:2, padding:12, backgroundColor:'#111827', border:'none', borderRadius:8, fontWeight:'bold', color:'white', cursor:'pointer', display:'flex', justifyContent:'center', gap:8}}>
                                <Save size={18}/> {loading ? 'Procesando...' : (header.idGasto ? 'Actualizar Factura' : 'Guardar Todo')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </form>
  )
}

export default NuevoMovimientoBodega