import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { 
    Save, Plus, Trash2, FileText, Wallet, 
    ShoppingCart, Map, CheckCircle2, AlertCircle
} from 'lucide-react'

// Componente: Input Moneda Grande (Panel Derecho)
const BigMoneyInput = ({ value, onChange, readOnly = false, autoFocus = false }) => {
    const [display, setDisplay] = useState('')
    useEffect(() => {
        if (value || value === 0) setDisplay('$ ' + parseInt(value).toLocaleString('es-CL'))
        else setDisplay('')
    }, [value])
    const handleChange = (e) => {
        if (readOnly) return
        const raw = e.target.value.replace(/\D/g, '')
        setDisplay(raw); onChange(raw)
    }
    return (
        <div style={{position: 'relative', width: '100%'}}>
            <input 
                type="text" 
                value={display} 
                onChange={handleChange} 
                readOnly={readOnly} 
                autoFocus={autoFocus}
                placeholder="$ 0"
                style={{ 
                    width: '100%', padding: '15px', borderRadius: 12, 
                    border: '1px solid #d1d5db', fontSize: '1.8rem', fontWeight: '800', 
                    textAlign: 'center', boxSizing: 'border-box', outline: 'none', 
                    backgroundColor: readOnly ? '#f9fafb' : 'white', color: '#111827' 
                }} 
            />
            <div style={{textAlign:'center', fontSize:'0.75rem', color:'#6b7280', marginTop:4, textTransform:'uppercase', letterSpacing:1}}>Monto Total Documento</div>
        </div>
    )
}

// Componente: Input Moneda Pequeño (Para Tabla Cuotas)
const TableMoneyInput = ({ value, onChange }) => {
    const [display, setDisplay] = useState('')
    
    useEffect(() => {
        if (value || value === 0) setDisplay('$ ' + parseInt(value).toLocaleString('es-CL'))
        else setDisplay('')
    }, [value])

    const handleChange = (e) => {
        const raw = e.target.value.replace(/\D/g, '')
        setDisplay(raw)
        onChange(raw)
    }

    return (
        <input 
            type="text" 
            placeholder="$ 0" 
            value={display} 
            onChange={handleChange} 
            style={{
                width: '100%', padding: '6px', borderRadius: 6, 
                border: '1px solid #d1d5db', fontSize: '0.85rem', fontWeight: 'bold', 
                color: '#111827', boxSizing: 'border-box', outline: 'none'
            }}
        />
    )
}

function NuevoGasto({ idGasto, cerrarModal, alGuardar }) {
  const [loading, setLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Maestros
  const [categorias, setCategorias] = useState([])
  const [subcategorias, setSubcategorias] = useState([]) 
  const [subcategoriasFiltradas, setSubcategoriasFiltradas] = useState([])

  const [proveedores, setProveedores] = useState([])
  const [socios, setSocios] = useState([])
  const [parcelas, setParcelas] = useState([]) 
  const [insumosBodega, setInsumosBodega] = useState([]) 

  // Estados UI
  const [modoInventario, setModoInventario] = useState(false)
  const [modoSectores, setModoSectores] = useState(false) 
  
  // Items de compra
  const [itemsCompra, setItemsCompra] = useState([]) 
  const [itemTemp, setItemTemp] = useState({ insumo_id: '', cantidad: '', precio_unitario: '' })

  // Formulario
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    descripcion: '',
    monto: '',
    categoria_id: '',
    subcategoria_id: '', 
    proveedor_id: '',
    tipo_documento: 'Factura',
    nro_documento: '',
    estado_pago: 'Pendiente', 
    sectores_ids: [],
    labor_origen_id: null // Mantener referencia si existe
  })

  // Cuotas
  const [cuotas, setCuotas] = useState([])

  useEffect(() => { cargarMaestros() }, [])

  // Filtrar Subcategorías cuando cambia Categoría
  useEffect(() => {
      if(form.categoria_id) {
          const filtradas = subcategorias.filter(s => s.categoria_id.toString() === form.categoria_id.toString())
          setSubcategoriasFiltradas(filtradas)
      } else {
          setSubcategoriasFiltradas([])
      }
  }, [form.categoria_id, subcategorias])

  // Auto-cálculo de total si es inventario
  useEffect(() => {
    if (modoInventario) {
        const total = itemsCompra.reduce((acc, item) => acc + (item.subtotal || 0), 0)
        setForm(prev => ({ ...prev, monto: total }))
    }
  }, [itemsCompra, modoInventario])

  async function cargarMaestros() {
    const [cat, sub, prov, soc, parc, bod] = await Promise.all([
        supabase.from('categorias_gastos').select('*').order('nombre'),
        supabase.from('subcategorias_gastos').select('*').order('nombre'), 
        supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
        supabase.from('socios').select('*').eq('activo', true).order('nombre'),
        supabase.from('parcelas').select('*, sectores(*)').eq('activo', true).order('nombre'),
        supabase.from('bodega_insumos').select('id, nombre, unidad_medida').eq('activo', true).order('nombre')
    ])
    setCategorias(cat.data || [])
    setSubcategorias(sub.data || [])
    setProveedores(prov.data || [])
    setSocios(soc.data || [])
    setParcelas(parc.data || [])
    setInsumosBodega(bod.data || [])

    if (idGasto) {
        const { data } = await supabase.from('gastos').select('*, pagos_gastos(*)').eq('id', idGasto).single()
        if (data) {
            setForm({
                ...data,
                subcategoria_id: data.subcategoria_id || '',
                proveedor_id: data.proveedor_id || '',
                labor_origen_id: data.labor_origen_id // Importante cargar esto
            })
            setCuotas(data.pagos_gastos || [])
            if (data.sectores_ids?.length > 0) setModoSectores(true)
            if (data.descripcion && data.descripcion.includes('Compra Gasto')) setModoInventario(false) 
        }
    } else {
        setCuotas([{ 
            fecha_vencimiento: new Date().toISOString().split('T')[0], 
            monto: '', 
            forma_pago: 'Transferencia', 
            pagado_por_socio_id: '', 
            estado: 'Pendiente' 
        }])
    }
  }

  const handleCerrar = () => {
      if (hasChanges && !confirm("Tienes cambios sin guardar. ¿Cerrar de todas formas?")) return
      cerrarModal()
  }

  const updateCuota = (idx, field, val) => {
      const newC = [...cuotas]
      newC[idx][field] = val === "" && field === 'pagado_por_socio_id' ? null : val
      setCuotas(newC)
      setHasChanges(true)
  }

  const agregarCuota = () => {
      setCuotas([...cuotas, {
          fecha_vencimiento: form.fecha, 
          monto: '', 
          forma_pago: 'Transferencia', 
          pagado_por_socio_id: '', 
          estado: 'Pendiente'
      }])
  }

  const guardar = async (e) => {
    e.preventDefault()
    const totalGasto = parseFloat(form.monto || 0)
    const totalCuotas = cuotas.reduce((acc, c) => acc + parseFloat(c.monto || 0), 0)
    
    if (Math.abs(totalCuotas - totalGasto) > 10) {
        return alert(`Los montos no coinciden.\nTotal Gasto: $${totalGasto}\nSuma Cuotas: $${totalCuotas}`)
    }
    
    setLoading(true)
    try {
        // --- 1. CONSTRUCCIÓN LIMPIA DEL PAYLOAD ---
        // En lugar de copiar 'form' y borrar, creamos uno nuevo solo con lo que existe en DB.
        const todasPagadas = cuotas.every(c => c.estado === 'Pagado')
        const ningunaPagada = cuotas.every(c => c.estado === 'Pendiente')
        
        const cleanPayload = {
            fecha: form.fecha,
            descripcion: form.descripcion,
            monto: form.monto,
            categoria_id: form.categoria_id,
            // Convertir strings vacíos a null para llaves foráneas
            subcategoria_id: form.subcategoria_id || null,
            proveedor_id: form.proveedor_id || null,
            labor_origen_id: form.labor_origen_id || null, // Mantiene el link si viene de labor
            
            tipo_documento: form.tipo_documento,
            nro_documento: form.nro_documento,
            sectores_ids: modoSectores ? form.sectores_ids : [],
            
            estado_pago: todasPagadas ? 'Pagado' : (ningunaPagada ? 'Pendiente' : 'Parcial')
        }

        // Si es edición, agregamos el ID, si no dejamos que Supabase lo genere
        if (idGasto) cleanPayload.id = idGasto

        const { data, error } = await supabase.from('gastos').upsert([cleanPayload]).select()
        if (error) throw error
        const gId = data[0].id

        // Guardar Cuotas
        await supabase.from('pagos_gastos').delete().eq('gasto_id', gId)
        
        const cuotasPayload = cuotas.map(c => ({
            gasto_id: gId,
            fecha_vencimiento: c.fecha_vencimiento,
            monto: c.monto,
            forma_pago: c.forma_pago,
            pagado_por_socio_id: c.pagado_por_socio_id || null, 
            estado: c.estado
        }))
        
        await supabase.from('pagos_gastos').insert(cuotasPayload)

        // Movimientos Bodega (Solo al crear)
        if (!idGasto && modoInventario) {
            const movs = itemsCompra.map(i => ({ 
                insumo_id: i.insumo_id, 
                tipo_movimiento: 'Entrada', 
                cantidad: i.cantidad, 
                costo_unitario: i.precio_unitario, 
                fecha: form.fecha, 
                referencia: `Compra Gasto #${gId}` 
            }))
            await supabase.from('bodega_movimientos').insert(movs)
        }
        alGuardar()
    } catch (err) { alert(err.message) }
    setLoading(false)
  }

  const styles = {
    layout: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }, 
    leftPanel: { display: 'flex', flexDirection: 'column', gap: 15 },
    card: { backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 15 },
    label: { fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: 4, display: 'block' },
    input: { width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' },
    chip: (active) => ({ 
        padding: '6px 12px', borderRadius: 20, fontSize: '0.8rem', cursor: 'pointer', 
        border: active ? '1px solid #2563eb' : '1px solid #e5e7eb', 
        backgroundColor: active ? '#eff6ff' : 'white', color: active ? '#1e40af' : '#6b7280',
        transition: 'all 0.2s' 
    }),
    rightPanel: { display: 'flex', flexDirection: 'column', gap: 15, height: '100%' },
    paymentCard: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 15, flex: 1, display: 'flex', flexDirection: 'column' },
    cuotaItem: { backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    cuotaRowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    cuotaRowBottom: { display: 'flex', gap: 10, alignItems: 'center' },
    inputCuota: { padding: '6px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' },
    btnTrash: { border: 'none', background: '#fee2e2', color: '#ef4444', padding: 6, borderRadius: 6, cursor: 'pointer' }
  }

  return (
    <form onSubmit={guardar} style={{display:'flex', flexDirection:'column', height: '100%'}}>
        <div style={styles.layout}>
            {/* Panel Izquierdo */}
            <div style={styles.leftPanel}>
                <div style={styles.card}>
                    <div style={{fontWeight:'bold', marginBottom:12, display:'flex', alignItems:'center', gap:8, fontSize:'1rem', color:'#111827'}}>
                        <FileText size={18}/> Detalle del Gasto
                    </div>
                    
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
                        <div>
                            <label style={styles.label}>Fecha</label>
                            <input type="date" value={form.fecha} onChange={e => {setForm({...form, fecha: e.target.value}); setHasChanges(true)}} style={styles.input} required/>
                        </div>
                        <div>
                             <label style={styles.label}>N° Documento</label>
                             <div style={{display:'flex', gap:5}}>
                                <select style={{...styles.input, width: '90px'}} value={form.tipo_documento} onChange={e => {setForm({...form, tipo_documento: e.target.value}); setHasChanges(true)}}>
                                    <option>Factura</option><option>Boleta</option><option>Guía</option><option>Interno</option>
                                </select>
                                <input type="text" placeholder="12345" value={form.nro_documento} onChange={e => {setForm({...form, nro_documento: e.target.value}); setHasChanges(true)}} style={{...styles.input, flex:1}}/>
                             </div>
                        </div>
                    </div>

                    <div style={{marginBottom:12}}>
                        <label style={styles.label}>Proveedor</label>
                        <select value={form.proveedor_id || ''} onChange={e => {setForm({...form, proveedor_id: e.target.value}); setHasChanges(true)}} style={styles.input}>
                            <option value="">-- Seleccionar --</option>
                            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                    </div>

                    {/* GRID CATEGORÍA Y SUBCATEGORÍA */}
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
                         <div>
                            <label style={styles.label}>Categoría</label>
                            <select 
                                value={form.categoria_id} 
                                onChange={e => {
                                    setForm({...form, categoria_id: e.target.value, subcategoria_id: ''}); 
                                    setHasChanges(true)
                                }} 
                                style={styles.input} 
                                required
                            >
                                <option value="">-- Seleccionar --</option>
                                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                         </div>
                         <div>
                             <label style={styles.label}>Subcategoría</label>
                             <select 
                                value={form.subcategoria_id || ''} 
                                onChange={e => {setForm({...form, subcategoria_id: e.target.value}); setHasChanges(true)}} 
                                style={{...styles.input, backgroundColor: form.categoria_id ? 'white' : '#f3f4f6'}}
                                disabled={!form.categoria_id}
                             >
                                 <option value="">-- Opcional --</option>
                                 {subcategoriasFiltradas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                             </select>
                         </div>
                    </div>

                    <div style={{marginBottom:12}}>
                         <label style={styles.label}>Descripción</label>
                         <input type="text" placeholder="Ej: Compra fertilizantes..." value={form.descripcion} onChange={e => {setForm({...form, descripcion: e.target.value}); setHasChanges(true)}} style={styles.input} required/>
                    </div>

                    {!idGasto && (
                        <div style={{marginTop: 5, paddingTop:10, borderTop:'1px solid #f3f4f6'}}>
                            <div style={{display:'flex', alignItems:'center', gap:8}}>
                                <input type="checkbox" id="chkInv" checked={modoInventario} onChange={e => setModoInventario(e.target.checked)} style={{width:16, height:16, cursor:'pointer'}}/>
                                <label htmlFor="chkInv" style={{fontSize:'0.9rem', fontWeight:'600', color:'#0369a1', cursor:'pointer', display:'flex', alignItems:'center', gap:6}}>
                                    <ShoppingCart size={16}/> Ingresar items a Bodega
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {modoInventario && (
                    <div style={{...styles.card, backgroundColor:'#f0f9ff', border:'1px solid #bae6fd'}}>
                         <div style={{display:'flex', gap:8, marginBottom:8}}>
                            <select style={{...styles.input, flex:2}} value={itemTemp.insumo_id} onChange={e => setItemTemp({...itemTemp, insumo_id: e.target.value})}>
                                <option value="">Insumo...</option>
                                {insumosBodega.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                            </select>
                            <input type="number" placeholder="Cant" style={{...styles.input, flex:0.8}} value={itemTemp.cantidad} onChange={e => setItemTemp({...itemTemp, cantidad: e.target.value})}/>
                            <input type="number" placeholder="$ Unit" style={{...styles.input, flex:1}} value={itemTemp.precio_unitario} onChange={e => setItemTemp({...itemTemp, precio_unitario: e.target.value})}/>
                            <button type="button" onClick={() => {if(itemTemp.insumo_id){setItemsCompra([...itemsCompra, {...itemTemp, subtotal: itemTemp.cantidad * itemTemp.precio_unitario, nombre: insumosBodega.find(i=>i.id==itemTemp.insumo_id).nombre}]); setItemTemp({insumo_id:'', cantidad:'', precio_unitario:''})}}} style={{backgroundColor:'#0284c7', color:'white', border:'none', borderRadius:6, padding:'0 10px'}}><Plus size={18}/></button>
                        </div>
                        <div style={{maxHeight:120, overflowY:'auto'}}>
                            {itemsCompra.map((it, i) => (
                                <div key={i} style={{fontSize:'0.8rem', display:'flex', justifyContent:'space-between', borderBottom:'1px solid #e0f2fe', padding:'4px 0', color:'#0c4a6e'}}>
                                    <span>{it.nombre} x {it.cantidad}</span>
                                    <strong>$ {parseInt(it.subtotal).toLocaleString()}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div style={styles.card}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                        <div style={{fontWeight:'bold', fontSize:'0.9rem', display:'flex', alignItems:'center', gap:6}}>
                            <Map size={18}/> Imputar a Sectores
                        </div>
                        <div style={{display:'flex', alignItems:'center', gap:5}}>
                            <span style={{fontSize:'0.75rem', color:'#6b7280'}}>¿Aplica a campo?</span>
                            <input type="checkbox" checked={modoSectores} onChange={e => setModoSectores(e.target.checked)} style={{width:16, height:16, cursor:'pointer'}}/>
                        </div>
                    </div>
                    {modoSectores && (
                        <div style={{maxHeight:150, overflowY:'auto', borderTop:'1px solid #f3f4f6', paddingTop:10}}>
                            {parcelas.map(p => (
                                <div key={p.id} style={{marginBottom:8}}>
                                    <div style={{fontSize:'0.75rem', fontWeight:'bold', color:'#9ca3af', marginBottom:4, textTransform:'uppercase'}}>{p.nombre}</div>
                                    <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                                        {p.sectores?.map(s => (
                                            <div 
                                                key={s.id} 
                                                onClick={() => {setForm({...form, sectores_ids: form.sectores_ids.includes(s.id)?form.sectores_ids.filter(x=>x!==s.id):[...form.sectores_ids, s.id]}); setHasChanges(true)}} 
                                                style={styles.chip(form.sectores_ids.includes(s.id))}
                                            >
                                                {s.nombre}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Panel Derecho */}
            <div style={styles.rightPanel}>
                <BigMoneyInput value={form.monto} readOnly={modoInventario} onChange={v => {setForm({...form, monto: v}); setHasChanges(true)}} autoFocus={!modoInventario}/>

                <div style={styles.paymentCard}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:15, paddingBottom:10, borderBottom:'1px solid #e2e8f0'}}>
                        <div style={{fontWeight:'bold', fontSize:'1rem', color:'#0f172a', display:'flex', alignItems:'center', gap:8}}>
                            <Wallet size={18}/> Plan de Pagos
                        </div>
                        <button type="button" onClick={agregarCuota} style={{backgroundColor:'#166534', color:'white', border:'none', borderRadius:6, padding:'6px 12px', fontSize:'0.8rem', fontWeight:'bold', cursor:'pointer', display:'flex', alignItems:'center', gap:5}}>
                            <Plus size={14}/> Agregar Cuota
                        </button>
                    </div>

                    <div style={{flex:1, overflowY:'auto', paddingRight:5}}>
                        {cuotas.map((c, i) => (
                            <div key={i} style={styles.cuotaItem}>
                                <div style={styles.cuotaRowTop}>
                                    <div style={{flex:1, marginRight:10}}>
                                        <label style={{fontSize:'0.7rem', color:'#6b7280', display:'block', marginBottom:2}}>Vencimiento</label>
                                        <input type="date" value={c.fecha_vencimiento} onChange={e => updateCuota(i, 'fecha_vencimiento', e.target.value)} style={styles.inputCuota}/>
                                    </div>
                                    <div style={{flex:1}}>
                                        <label style={{fontSize:'0.7rem', color:'#6b7280', display:'block', marginBottom:2}}>Monto Cuota</label>
                                        <TableMoneyInput value={c.monto} onChange={val => updateCuota(i, 'monto', val)} />
                                    </div>
                                </div>
                                
                                <div style={styles.cuotaRowBottom}>
                                    <select value={c.forma_pago} onChange={e => updateCuota(i, 'forma_pago', e.target.value)} style={{...styles.inputCuota, flex:1}}>
                                        <option value="Transferencia">Transf.</option>
                                        <option value="Efectivo">Efectivo</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="Tarjeta">Tarjeta</option>
                                    </select>
                                    
                                    <select value={c.pagado_por_socio_id || ""} onChange={e => updateCuota(i, 'pagado_por_socio_id', e.target.value)} style={{...styles.inputCuota, flex:1}}>
                                        <option value="">Empresa</option>
                                        {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                    </select>

                                    <select value={c.estado} onChange={e => updateCuota(i, 'estado', e.target.value)} style={{...styles.inputCuota, width:'auto', color: c.estado==='Pagado'?'#166534':'#991b1b', fontWeight:'bold'}}>
                                        <option value="Pagado">Pagado</option>
                                        <option value="Pendiente">Pendiente</option>
                                    </select>

                                    <button type="button" onClick={() => setCuotas(cuotas.filter((_, idx)=>idx!==i))} style={styles.btnTrash}>
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{marginTop:10, paddingTop:10, borderTop:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div style={{fontSize:'0.85rem', color:'#475569'}}>Suma Pagos: <strong style={{color:'#0f172a'}}>$ {cuotas.reduce((a,b)=>a+parseFloat(b.monto||0),0).toLocaleString()}</strong></div>
                        {Math.abs(cuotas.reduce((a,b)=>a+parseFloat(b.monto||0),0)-parseFloat(form.monto||0)) < 10 
                            ? <div style={{display:'flex', alignItems:'center', gap:5, color:'#166534', fontWeight:'bold', fontSize:'0.8rem', backgroundColor:'#dcfce7', padding:'4px 8px', borderRadius:6}}><CheckCircle2 size={14}/> Cuadra</div>
                            : <div style={{display:'flex', alignItems:'center', gap:5, color:'#991b1b', fontWeight:'bold', fontSize:'0.8rem', backgroundColor:'#fee2e2', padding:'4px 8px', borderRadius:6}}><AlertCircle size={14}/> Diferencia</div>
                        }
                    </div>
                </div>
            </div>
        </div>

        <div style={{display:'flex', justifyContent:'flex-end', gap:12, marginTop:20, paddingTop:15, borderTop:'1px solid #e5e7eb'}}>
            <button type="button" onClick={handleCerrar} style={{padding:'10px 20px', borderRadius:8, border:'1px solid #d1d5db', background:'white', cursor:'pointer', fontWeight:'500', color:'#374151'}}>Cancelar</button>
            <button type="submit" disabled={loading} style={{padding:'10px 20px', borderRadius:8, border:'none', backgroundColor:'#111827', color:'white', fontWeight:'bold', display:'flex', alignItems:'center', gap:8, cursor:'pointer', boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}}>
                <Save size={18}/> {loading ? 'Guardando...' : 'Guardar Gasto'}
            </button>
        </div>
    </form>
  )
}

export default NuevoGasto