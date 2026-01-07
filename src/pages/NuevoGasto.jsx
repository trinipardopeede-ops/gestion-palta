import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { 
    Save, CheckSquare, Square, Map, Calendar, FileText, 
    CreditCard, User, Package, Plus, Trash2, ShoppingCart, Layout 
} from 'lucide-react'

// Input de dinero visual
const SmartMoneyInput = ({ value, onChange, readOnly = false }) => {
    const [display, setDisplay] = useState('')

    useEffect(() => {
        if (value || value === 0) setDisplay('$ ' + parseInt(value).toLocaleString('es-CL'))
        else setDisplay('')
    }, [value])

    const handleChange = (e) => {
        if (readOnly) return
        const raw = e.target.value.replace(/\D/g, '')
        setDisplay(raw)
        onChange(raw)
    }

    return (
        <div style={{position: 'relative', width: '100%', opacity: readOnly ? 0.7 : 1}}>
            <span style={{
                position:'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                fontSize: '1rem', fontWeight: 'bold', color: '#9ca3af'
            }}>$</span>
            <input 
                type="text" 
                value={display} 
                onChange={handleChange} 
                readOnly={readOnly}
                placeholder="0" 
                // CORRECCIÓN: Padding shorthand completo
                style={{ 
                    width: '100%', 
                    padding: '6px 10px 6px 25px', 
                    borderRadius: 8, 
                    border: readOnly ? '1px dashed #d1d5db' : '1px solid #d1d5db', 
                    backgroundColor: readOnly ? '#f9fafb' : 'white',
                    fontSize: '1.1rem', fontWeight: '800', color: '#111827', textAlign: 'right',
                    boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s'
                }}
            />
        </div>
    )
}

function NuevoGasto({ idGasto, cerrarModal, alGuardar }) {
  const [loading, setLoading] = useState(false)
  
  // Maestros
  const [categorias, setCategorias] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [socios, setSocios] = useState([])
  const [parcelas, setParcelas] = useState([]) 
  const [insumosBodega, setInsumosBodega] = useState([]) 

  // Estados Lógicos
  const [modoInventario, setModoInventario] = useState(false)
  const [modoSectores, setModoSectores] = useState(false) 
  
  const [itemsCompra, setItemsCompra] = useState([]) 
  const [itemTemp, setItemTemp] = useState({ insumo_id: '', cantidad: '', precio_unitario: '' })

  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    descripcion: '',
    monto: '',
    categoria_id: '',
    proveedor_id: '',
    parcela_id: null,
    sectores_ids: [], 
    nro_documento: '',
    tipo_documento: 'Factura',
    estado_pago: 'Pagado',
    forma_pago: 'Transferencia',
    pagado_por_socio_id: ''
  })

  useEffect(() => { cargarMaestros() }, [])

  useEffect(() => {
      if (modoInventario) {
          const totalCalculado = itemsCompra.reduce((acc, item) => acc + (item.subtotal || 0), 0)
          setForm(prev => ({ ...prev, monto: totalCalculado }))
      }
  }, [itemsCompra, modoInventario])

  async function cargarMaestros() {
    const [cat, prov, soc, parc, bod] = await Promise.all([
        supabase.from('categorias_gastos').select('*').order('nombre'),
        supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
        supabase.from('socios').select('*').eq('activo', true).order('nombre'),
        supabase.from('parcelas').select('*, sectores(*)').eq('activo', true).order('nombre'),
        supabase.from('bodega_insumos').select('id, nombre, unidad_medida').eq('activo', true).order('nombre')
    ])

    setCategorias(cat.data || [])
    setProveedores(prov.data || [])
    setSocios(soc.data || [])
    setParcelas(parc.data || [])
    setInsumosBodega(bod.data || [])

    if (idGasto) {
        const { data } = await supabase.from('gastos').select('*').eq('id', idGasto).single()
        if (data) {
            setForm({ ...data, sectores_ids: data.sectores_ids || [] })
            if (data.sectores_ids && data.sectores_ids.length > 0) {
                setModoSectores(true)
            }
        }
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // --- LÓGICA INVENTARIO ---
  const agregarItem = () => {
      if (!itemTemp.insumo_id || !itemTemp.cantidad || !itemTemp.precio_unitario) return
      const insumoInfo = insumosBodega.find(i => i.id.toString() === itemTemp.insumo_id.toString())
      const cant = parseFloat(itemTemp.cantidad)
      const precio = parseFloat(itemTemp.precio_unitario)
      
      const nuevoItem = {
          uniqueId: Date.now(),
          insumo_id: parseInt(itemTemp.insumo_id),
          nombre: insumoInfo.nombre,
          unidad: insumoInfo.unidad_medida,
          cantidad: cant,
          precio_unitario: precio,
          subtotal: cant * precio
      }
      setItemsCompra([...itemsCompra, nuevoItem])
      setItemTemp({ insumo_id: '', cantidad: '', precio_unitario: '' }) 
  }

  const eliminarItem = (uniqueId) => {
      setItemsCompra(itemsCompra.filter(i => i.uniqueId !== uniqueId))
  }

  // --- LÓGICA SECTORES ---
  const toggleSector = (sectorId) => {
      const current = form.sectores_ids || []
      const updated = current.includes(sectorId) ? current.filter(id => id !== sectorId) : [...current, sectorId]
      setForm(prev => ({ ...prev, sectores_ids: updated }))
  }

  const toggleTodaParcela = (parcelaId) => {
      const p = parcelas.find(x => x.id === parcelaId)
      if(!p?.sectores) return
      const ids = p.sectores.map(s => s.id)
      const todos = ids.every(id => form.sectores_ids.includes(id))
      const updated = todos ? form.sectores_ids.filter(id => !ids.includes(id)) : [...new Set([...form.sectores_ids, ...ids])]
      setForm(prev => ({ ...prev, sectores_ids: updated }))
  }

  const guardar = async (e) => {
    e.preventDefault()
    if(!form.monto || form.monto <= 0) return alert("El monto debe ser mayor a 0")
    if(modoInventario && itemsCompra.length === 0) return alert("Debes agregar al menos un ítem al detalle de compra")

    setLoading(true)

    const payload = { ...form }
    
    // Limpieza de datos
    if (payload.estado_pago === 'Pendiente') payload.pagado_por_socio_id = null
    if (!payload.proveedor_id) payload.proveedor_id = null
    if (!payload.categoria_id) payload.categoria_id = null

    if (!modoSectores) {
        payload.sectores_ids = []
        payload.parcela_id = null
    } else {
        if (payload.sectores_ids.length > 0) {
            const sectorId = payload.sectores_ids[0]
            const p = parcelas.find(p => p.sectores.find(s => s.id === sectorId))
            if(p) payload.parcela_id = p.id
        } else {
            payload.parcela_id = null
        }
    }

    try {
        let gastoIdGuardado = idGasto

        if (idGasto) {
            await supabase.from('gastos').update(payload).eq('id', idGasto)
        } else {
            const { data, error } = await supabase.from('gastos').insert([payload]).select()
            if (error) throw error
            gastoIdGuardado = data[0].id
        }

        if (!idGasto && modoInventario && itemsCompra.length > 0) {
            const movimientos = itemsCompra.map(item => ({
                insumo_id: item.insumo_id,
                tipo_movimiento: 'Entrada',
                cantidad: item.cantidad,
                costo_unitario: item.precio_unitario, 
                fecha: form.fecha,
                referencia: `Compra Gasto #${gastoIdGuardado}`,
                labor_id: null 
            }))
            const { error: errorMovs } = await supabase.from('bodega_movimientos').insert(movimientos)
            if (errorMovs) throw errorMovs
        }
        alGuardar()
    } catch (err) {
        alert("Error: " + err.message)
    } finally {
        setLoading(false)
    }
  }

  const styles = {
    layout: { display: 'flex', gap: '15px', height: '100%', alignItems: 'flex-start' },
    colLeft: { flex: '1.2', display: 'flex', flexDirection: 'column', gap: '12px' },
    colRight: { flex: '1', display: 'flex', flexDirection: 'column', gap: '12px' },
    
    card: { backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 15, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    cardHeader: { fontSize: '0.9rem', fontWeight: 'bold', color: '#374151', borderBottom: '1px solid #f3f4f6', paddingBottom: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 },
    
    inputGroup: { marginBottom: 10 },
    label: { display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#4b5563', marginBottom: 4 },
    input: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box', outline:'none' },
    select: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.85rem', backgroundColor: 'white', outline:'none' },
    
    switchContainer: (color, bg, border) => ({
        display:'flex', alignItems:'center', justifyContent:'space-between', 
        backgroundColor: bg, padding:'6px 10px', borderRadius:8, border: `1px solid ${border}`, marginTop: 8
    }),
    
    tableItems: { width:'100%', borderCollapse:'collapse', fontSize:'0.8rem' },
    thItem: { textAlign:'left', padding:'6px', color:'#6b7280', borderBottom:'1px solid #e5e7eb' },
    tdItem: { padding:'6px', borderBottom:'1px solid #f3f4f6' },
    
    sectoresBox: { maxHeight: 180, overflowY: 'auto', paddingRight: 5 },
    parcelaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', backgroundColor: '#f9fafb', borderRadius: 6, cursor: 'pointer', marginBottom: 4, border: '1px solid #f3f4f6' },
    chipsGrid: { display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 8, marginBottom: 8 },
    chip: (active) => ({
        padding: '3px 8px', borderRadius: 12, fontSize: '0.7rem', cursor: 'pointer', border: active ? '1px solid #2563eb' : '1px solid #e5e7eb',
        backgroundColor: active ? '#eff6ff' : 'white', color: active ? '#1e40af' : '#6b7280', transition: 'all 0.1s', fontWeight: active ? '600' : 'normal'
    }),

    montoCard: { backgroundColor: '#fefce8', border: '1px solid #fde047', borderRadius: 12, padding: '10px 12px' },
    paymentCard: { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 12px' },
    radioBtn: (active, color) => ({
        flex: 1, padding: '6px', borderRadius: 6, cursor: 'pointer', textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem',
        backgroundColor: active ? 'white' : 'rgba(255,255,255,0.5)', border: active ? `2px solid ${color}` : '1px solid transparent',
        color: active ? color : '#6b7280', boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
    }),

    footer: { borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: 10 },
    btnCancel: { padding: '8px 16px', border: '1px solid #d1d5db', backgroundColor: 'white', borderRadius: 8, fontWeight: '600', cursor: 'pointer', color: '#374151', fontSize:'0.9rem' },
    btnSave: { padding: '8px 16px', border: 'none', backgroundColor: '#111827', color: 'white', borderRadius: 8, fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize:'0.9rem' }
  }

  return (
    <form onSubmit={guardar} style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
        <div style={styles.layout}>
            <div style={styles.colLeft}>
                <div style={styles.card}>
                    <div style={styles.cardHeader}><FileText size={16}/> Información General</div>
                    
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Fecha</label>
                            <div style={{position:'relative'}}>
                                <Calendar size={14} color="#9ca3af" style={{position:'absolute', left:10, top:9}}/>
                                <input 
                                    type="date" name="fecha" value={form.fecha} onChange={handleChange} 
                                    // CORRECCIÓN: Padding explícito en el estilo
                                    style={{...styles.input, padding: '8px 10px 8px 30px'}} 
                                    required 
                                />
                            </div>
                        </div>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Nº Documento</label>
                            <input type="text" name="nro_documento" value={form.nro_documento} onChange={handleChange} style={styles.input} placeholder="Opcional" />
                        </div>
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Descripción</label>
                        <input type="text" name="descripcion" value={form.descripcion} onChange={handleChange} style={styles.input} required placeholder="Ej: Compra mensual..." />
                    </div>

                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Categoría</label>
                            <select name="categoria_id" value={form.categoria_id} onChange={handleChange} style={styles.select} required>
                                <option value="">-- Seleccionar --</option>
                                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Proveedor</label>
                            <select name="proveedor_id" value={form.proveedor_id} onChange={handleChange} style={styles.select}>
                                <option value="">-- Sin Proveedor --</option>
                                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    {!idGasto && (
                        <div style={styles.switchContainer('#0ea5e9', '#f0f9ff', '#bae6fd')}>
                            <div style={{display:'flex', alignItems:'center', gap:8}}>
                                <Package size={16} color="#0284c7"/>
                                <div>
                                    <div style={{fontWeight:'bold', color:'#0369a1', fontSize:'0.8rem'}}>Incluir Entrada de Inventario</div>
                                    <div style={{fontSize:'0.7rem', color:'#0ea5e9'}}>Registrar productos en bodega</div>
                                </div>
                            </div>
                            <input type="checkbox" checked={modoInventario} onChange={(e) => setModoInventario(e.target.checked)} style={{transform:'scale(1.2)', cursor:'pointer', accentColor:'#0284c7'}} />
                        </div>
                    )}
                </div>

                {modoInventario && (
                    <div style={{...styles.card, border:'1px solid #bae6fd', backgroundColor:'#f0f9ff', padding: 12}}>
                        <div style={{...styles.cardHeader, color:'#0369a1', borderBottom:'1px dashed #bae6fd'}}>
                            <ShoppingCart size={16}/> Detalle de Compra (Bodega)
                        </div>

                        <div style={{display:'flex', gap:8, alignItems:'flex-end', marginBottom:12}}>
                            <div style={{flex:2}}>
                                <label style={styles.label}>Producto</label>
                                <select value={itemTemp.insumo_id} onChange={e => setItemTemp({...itemTemp, insumo_id: e.target.value})} style={styles.select}>
                                    <option value="">-- Elegir --</option>
                                    {insumosBodega.map(i => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_medida})</option>)}
                                </select>
                            </div>
                            <div style={{flex:1}}>
                                <label style={styles.label}>Cant.</label>
                                <input type="number" placeholder="0" value={itemTemp.cantidad} onChange={e => setItemTemp({...itemTemp, cantidad: e.target.value})} style={styles.input} />
                            </div>
                            <div style={{flex:1}}>
                                <label style={styles.label}>$ Unit.</label>
                                <input type="number" placeholder="$" value={itemTemp.precio_unitario} onChange={e => setItemTemp({...itemTemp, precio_unitario: e.target.value})} style={styles.input} />
                            </div>
                            <button type="button" onClick={agregarItem} style={{backgroundColor:'#0284c7', color:'white', border:'none', borderRadius:8, padding:6, cursor:'pointer'}}><Plus size={16}/></button>
                        </div>

                        <div style={{backgroundColor:'white', borderRadius:8, border:'1px solid #bae6fd', overflow:'hidden'}}>
                            <table style={styles.tableItems}>
                                <thead>
                                    <tr>
                                        <th style={styles.thItem}>Producto</th>
                                        <th style={{...styles.thItem, textAlign:'center'}}>Cant</th>
                                        <th style={{...styles.thItem, textAlign:'right'}}>Total</th>
                                        <th style={{...styles.thItem, width:30}}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itemsCompra.map(item => (
                                        <tr key={item.uniqueId}>
                                            <td style={styles.tdItem}>{item.nombre}</td>
                                            <td style={{...styles.tdItem, textAlign:'center'}}>{item.cantidad} {item.unidad}</td>
                                            <td style={{...styles.tdItem, textAlign:'right', fontWeight:'bold'}}>$ {item.subtotal.toLocaleString('es-CL')}</td>
                                            <td style={styles.tdItem}><Trash2 size={14} color="#ef4444" style={{cursor:'pointer'}} onClick={() => eliminarItem(item.uniqueId)}/></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <div style={styles.colRight}>
                <div style={styles.montoCard}>
                    <label style={{...styles.label, color:'#854d0e', marginBottom: 4, fontSize: '0.8rem'}}>
                        {modoInventario ? 'Monto Total (Calculado)' : 'Monto Total'}
                    </label>
                    <SmartMoneyInput value={form.monto} onChange={(val) => setForm({...form, monto: val})} readOnly={modoInventario} />
                </div>

                <div style={styles.paymentCard}>
                    <div style={{...styles.cardHeader, borderBottom:'1px dashed #bbf7d0', color:'#166534', paddingBottom: 4, marginBottom: 8}}>
                        <CreditCard size={16}/> Estado del Pago
                    </div>
                    
                    <div style={{display:'flex', gap:10, marginBottom:10}}>
                        <div onClick={() => setForm({...form, estado_pago: 'Pagado'})} style={styles.radioBtn(form.estado_pago === 'Pagado', '#15803d')}>Pagado</div>
                        <div onClick={() => setForm({...form, estado_pago: 'Pendiente'})} style={styles.radioBtn(form.estado_pago === 'Pendiente', '#b91c1c')}>Pendiente</div>
                    </div>

                    {form.estado_pago === 'Pagado' && (
                        <div style={{animation: 'fadeIn 0.2s'}}>
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>¿Quién pagó? (Cuenta Socio)</label>
                                <div style={{position:'relative'}}>
                                    <User size={14} color="#6b7280" style={{position:'absolute', left:10, top:9}}/>
                                    <select 
                                        name="pagado_por_socio_id" value={form.pagado_por_socio_id} onChange={handleChange} 
                                        style={{...styles.select, padding: '8px 10px 8px 30px'}} 
                                        required
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style={{marginBottom:0}}>
                                <label style={styles.label}>Método</label>
                                <select name="forma_pago" value={form.forma_pago} onChange={handleChange} style={styles.select}>
                                    <option value="Transferencia">Transferencia</option>
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Tarjeta">Tarjeta</option>
                                    <option value="Cheque">Cheque</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                <div style={styles.switchContainer('#4b5563', 'white', '#e5e7eb')}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <Map size={16} color="#4b5563"/>
                        <div>
                            <div style={{fontWeight:'bold', color:'#374151', fontSize:'0.8rem'}}>Asignar a Sectores</div>
                            <div style={{fontSize:'0.7rem', color:'#6b7280'}}>Gasto específico (No Global)</div>
                        </div>
                    </div>
                    <input type="checkbox" checked={modoSectores} onChange={(e) => setModoSectores(e.target.checked)} style={{transform:'scale(1.2)', cursor:'pointer', accentColor:'#4b5563'}} />
                </div>

                {modoSectores && (
                    <div style={{...styles.card, flex: 1, display: 'flex', flexDirection: 'column'}}>
                        <div style={styles.cardHeader}>
                            <div style={{display:'flex', alignItems:'center', gap:8}}><Layout size={16}/> Selección</div>
                            <span style={{fontSize:'0.7rem', backgroundColor:'#f3f4f6', padding:'2px 6px', borderRadius:10}}>{form.sectores_ids.length} selec.</span>
                        </div>
                        <div style={styles.sectoresBox}>
                            {parcelas.map(p => (
                                <div key={p.id} style={styles.parcelaItem}>
                                    <div style={styles.parcelaHeader} onClick={() => toggleTodaParcela(p.id)}>
                                        <span style={{fontWeight:'bold', fontSize:'0.8rem', color:'#374151'}}>{p.nombre}</span>
                                        {p.sectores?.every(s => form.sectores_ids.includes(s.id)) ? <CheckSquare size={14} color="#2563eb"/> : <Square size={14} color="#d1d5db"/>}
                                    </div>
                                    <div style={styles.chipsGrid}>
                                        {p.sectores?.map(s => (
                                            <div key={s.id} onClick={() => toggleSector(s.id)} style={styles.chip(form.sectores_ids.includes(s.id))}>{s.nombre}</div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div style={styles.footer}>
            <button type="button" onClick={cerrarModal} style={styles.btnCancel}>Cancelar</button>
            <button type="submit" style={styles.btnSave}>
                {loading ? 'Guardando...' : <><Save size={16}/> Guardar Gasto</>}
            </button>
        </div>
    </form>
  )
}

export default NuevoGasto