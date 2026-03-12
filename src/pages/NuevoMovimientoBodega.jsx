import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Save, Plus, Trash2, FileText, Package } from 'lucide-react'

const formatMoney = (amount) => '$ ' + Math.round(amount || 0).toLocaleString('es-CL')

// Tipos de entrada permitidos (compras ya no se registran desde aquí)
const TIPOS_ENTRADA = [
    { value: 'Ajuste de inventario', label: '📋 Ajuste de inventario', desc: 'Corrección de stock sin transacción económica' },
    { value: 'Donación / Regalo',    label: '🎁 Donación / Regalo',    desc: 'Insumo recibido sin costo' },
    { value: 'Devolución proveedor', label: '↩️ Devolución proveedor', desc: 'Mercadería devuelta que regresa al stock' },
    { value: 'Traspaso bodega',      label: '🔄 Traspaso entre bodegas', desc: 'Movimiento interno entre ubicaciones' },
]

function NuevoMovimientoBodega({ config, movimientoEditar, cerrar, alGuardar }) {
    const [loading, setLoading] = useState(false)
    const [loadingData, setLoadingData] = useState(false)

    const [insumos, setInsumos] = useState([])

    const [header, setHeader] = useState({
        fecha: new Date().toISOString().split('T')[0],
        motivo_entrada: '',   // solo para Entradas manuales
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
            const { data } = await supabase.from('bodega_insumos').select('*').eq('activo', true).order('nombre')
            setInsumos(data || [])
            if (!movimientoEditar && config?.producto) {
                setItemTemp(prev => ({ ...prev, insumo_id: config.producto.id }))
            }
        }
        fetchMaestros()
    }, [])

    useEffect(() => {
        const cargarMovimiento = async () => {
            if (!movimientoEditar) return
            setLoadingData(true)
            setHeader(prev => ({ ...prev, fecha: movimientoEditar.fecha, referencia: movimientoEditar.referencia || '', motivo_entrada: movimientoEditar.motivo_entrada || '' }))
            const insumoData = insumos.find(i => i.id === movimientoEditar.insumo_id)
            setItemsCarrito([{
                uniqueId: movimientoEditar.id,
                insumo_id: movimientoEditar.insumo_id,
                nombre: insumoData ? insumoData.nombre : '...',
                unidad: insumoData ? insumoData.unidad_medida : 'Ud',
                cantidadFinal: movimientoEditar.cantidad,
                costoUnitario: movimientoEditar.costo_unitario,
                costoTotal: movimientoEditar.cantidad * movimientoEditar.costo_unitario
            }])
            setLoadingData(false)
        }
        if (insumos.length > 0) cargarMovimiento()
    }, [movimientoEditar, insumos])

    const getCalculosItem = () => {
        const insumo = insumos.find(i => i.id.toString() === itemTemp.insumo_id.toString())
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
        setItemsCarrito([...itemsCarrito, { uniqueId: Date.now(), insumo_id: itemTemp.insumo_id, ...calculos }])
        setItemTemp({ ...itemTemp, insumo_id: '', cantidad_bultos: '', precio_por_bulto: '', cantidad_total: '', precio_total: '' })
    }

    const handleEditRow = (id, field, value) => {
        setItemsCarrito(itemsCarrito.map(item => {
            if (item.uniqueId !== id) return item
            const val = parseFloat(value) || 0
            const updated = { ...item, [field]: val }
            if (field === 'cantidadFinal' || field === 'costoUnitario') updated.costoTotal = updated.cantidadFinal * updated.costoUnitario
            return updated
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (itemsCarrito.length === 0) return alert("Agrega al menos un ítem.")
        if (isEntrada && !header.motivo_entrada) return alert("Selecciona el motivo de entrada.")

        setLoading(true)
        try {
            const referencia = isEntrada
                ? `${header.motivo_entrada}${header.referencia ? ' - ' + header.referencia : ''}`
                : (header.referencia || '')

            const movs = itemsCarrito.map(item => ({
                insumo_id: item.insumo_id,
                tipo_movimiento: tipoMovimiento,
                cantidad: item.cantidadFinal,
                costo_unitario: item.costoUnitario || 0,
                fecha: header.fecha,
                referencia
            }))

            if (movimientoEditar) {
                // Edición: actualizar solo el primer movimiento (movimientos manuales son de 1 ítem)
                const { error } = await supabase.from('bodega_movimientos').update({
                    cantidad: movs[0].cantidad,
                    costo_unitario: movs[0].costo_unitario,
                    fecha: movs[0].fecha,
                    referencia: movs[0].referencia
                }).eq('id', movimientoEditar.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('bodega_movimientos').insert(movs)
                if (error) throw error
            }

            alGuardar()
        } catch (err) {
            alert("Error: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    const styles = {
        container: { width: '85vw', maxWidth:'1400px', height: '80vh', display:'flex', flexDirection:'column' },
        layout: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start', flex:1, overflow:'hidden' },
        leftPanel: { display:'flex', flexDirection:'column', gap:15, overflowY:'auto', maxHeight:'100%', paddingRight:5 },
        rightPanel: { display:'flex', flexDirection:'column', height:'100%', gap:15 },
        card: { backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 },
        label: { fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: 5, display: 'block' },
        input: { width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' },
        sectionTitle: { fontSize:'1rem', fontWeight:'bold', color:'#111827', marginBottom:15, display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid #f3f4f6', paddingBottom:10 },
        toggleContainer: { display:'flex', backgroundColor:'#f3f4f6', padding:4, borderRadius:8, marginBottom:15 },
        toggleBtn: (active) => ({ flex:1, padding:'8px', borderRadius:6, border:'none', cursor:'pointer', fontSize:'0.8rem', fontWeight:'600', backgroundColor: active ? 'white' : 'transparent', color: active ? '#2563eb' : '#6b7280', boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }),
        tableHeader: { display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 40px', gap:15, fontSize:'0.75rem', fontWeight:'bold', color:'#6b7280', marginBottom:8, padding:'0 5px' },
        tableRow: { display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 40px', gap:15, alignItems:'center', marginBottom:8, paddingBottom:8, borderBottom:'1px solid #f3f4f6' },
        inputTable: { width:'100%', padding:'8px', borderRadius:6, border:'1px solid #d1d5db', fontSize:'0.9rem', textAlign:'right', fontWeight:'500' },
        motivoCard: { backgroundColor:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:14, marginBottom:10 },
        motivoOption: (active) => ({ padding:'8px 12px', borderRadius:7, border: active ? '2px solid #2563eb' : '1px solid #e5e7eb', backgroundColor: active ? '#eff6ff' : 'white', cursor:'pointer', marginBottom:6 }),
    }

    const calcUI = getCalculosItem()
    const totalDoc = itemsCarrito.reduce((acc, i) => acc + i.costoTotal, 0)

    if (loadingData) return <div style={{padding:40, textAlign:'center'}}>Cargando datos...</div>

    return (
        <form onSubmit={handleSubmit} style={styles.container}>
            <div style={styles.layout}>
                {/* IZQUIERDA */}
                <div style={styles.leftPanel}>
                    <div style={styles.card}>
                        <div style={styles.sectionTitle}><FileText size={18}/> Datos del Movimiento</div>

                        <div style={{marginBottom:15}}>
                            <label style={styles.label}>Fecha</label>
                            <input type="date" value={header.fecha} onChange={e => setHeader({...header, fecha: e.target.value})} style={styles.input} required/>
                        </div>

                        {/* Motivo de entrada — solo para Entradas */}
                        {isEntrada && (
                            <div style={{marginBottom:15}}>
                                <label style={styles.label}>Motivo de entrada *</label>
                                <div style={{backgroundColor:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:10}}>
                                    {TIPOS_ENTRADA.map(t => (
                                        <div key={t.value} onClick={() => setHeader({...header, motivo_entrada: t.value})} style={styles.motivoOption(header.motivo_entrada === t.value)}>
                                            <div style={{fontWeight:'600', fontSize:'0.85rem', color: header.motivo_entrada === t.value ? '#1e40af' : '#374151'}}>{t.label}</div>
                                            <div style={{fontSize:'0.75rem', color:'#6b7280', marginTop:1}}>{t.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{marginBottom:15}}>
                            <label style={styles.label}>{isEntrada ? 'Nota adicional (opcional)' : 'Referencia / Motivo'}</label>
                            <input type="text" placeholder={isEntrada ? 'Ej: Inventario anual 2025...' : 'Ej: Labor poda sector A...'} value={header.referencia} onChange={e => setHeader({...header, referencia: e.target.value})} style={styles.input}/>
                        </div>
                    </div>

                    {/* Selector de insumo */}
                    <div style={styles.card}>
                        <div style={styles.sectionTitle}><Package size={18}/> Agregar Ítem</div>

                        <div style={{marginBottom:12}}>
                            <label style={styles.label}>Insumo</label>
                            <select value={itemTemp.insumo_id} onChange={e => setItemTemp({...itemTemp, insumo_id: e.target.value})} style={styles.input}>
                                <option value="">-- Seleccionar --</option>
                                {insumos.map(i => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_medida})</option>)}
                            </select>
                        </div>

                        {isEntrada && (
                            <>
                                <div style={styles.toggleContainer}>
                                    <button type="button" style={styles.toggleBtn(itemTemp.modo_entrada === 'Formato')} onClick={() => setItemTemp({...itemTemp, modo_entrada:'Formato'})}>📦 Por Paquetes</button>
                                    <button type="button" style={styles.toggleBtn(itemTemp.modo_entrada === 'Total')} onClick={() => setItemTemp({...itemTemp, modo_entrada:'Total'})}>🧮 Total Directo</button>
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
                            </>
                        )}

                        {!isEntrada && (
                            <div>
                                <label style={styles.label}>Cantidad a retirar</label>
                                <input type="number" placeholder="0" style={styles.input} value={itemTemp.cantidad_total} onChange={e => setItemTemp({...itemTemp, cantidad_total: e.target.value})}/>
                            </div>
                        )}

                        {isEntrada && (
                            <div style={{marginTop:12, padding:10, backgroundColor:'white', borderRadius:8, border:'1px dashed #cbd5e1', fontSize:'0.85rem'}}>
                                <div style={{display:'flex', justifyContent:'space-between'}}><span>Entrará:</span><strong>{calcUI.cantidadFinal} {calcUI.unidad}</strong></div>
                                <div style={{display:'flex', justifyContent:'space-between'}}><span>Total $:</span><strong style={{color:'#166534'}}>{formatMoney(calcUI.costoTotal)}</strong></div>
                            </div>
                        )}

                        <button type="button" onClick={handleAgregarItem} style={{width:'100%', marginTop:15, backgroundColor:'#2563eb', color:'white', border:'none', padding:10, borderRadius:8, fontWeight:'bold', cursor:'pointer', display:'flex', justifyContent:'center', gap:8}}>
                            <Plus size={18}/> Agregar
                        </button>
                    </div>
                </div>

                {/* DERECHA */}
                <div style={styles.rightPanel}>
                    <div style={styles.card}>
                        <div style={{fontSize:'0.8rem', color:'#6b7280', textTransform:'uppercase', letterSpacing:1}}>Total</div>
                        <div style={{fontSize:'2.5rem', fontWeight:'800', color:'#1f2937'}}>{formatMoney(totalDoc)}</div>
                        {isEntrada && header.motivo_entrada && (
                            <div style={{marginTop:6, display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:6, backgroundColor:'#eff6ff', color:'#1e40af', fontSize:'0.8rem', fontWeight:'600'}}>
                                {header.motivo_entrada}
                            </div>
                        )}
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
                            {itemsCarrito.length === 0 && <div style={{padding:40, textAlign:'center', color:'#9ca3af', fontStyle:'italic'}}>No hay ítems agregados.</div>}
                            {itemsCarrito.map(item => (
                                <div key={item.uniqueId} style={styles.tableRow}>
                                    <div>
                                        <div style={{fontWeight:'bold', color:'#374151', fontSize:'0.9rem'}}>{item.nombre}</div>
                                        <div style={{fontSize:'0.7rem', color:'#6b7280'}}>{item.unidad}</div>
                                    </div>
                                    <input type="number" step="0.01" value={item.cantidadFinal} onChange={e => handleEditRow(item.uniqueId, 'cantidadFinal', e.target.value)} style={styles.inputTable}/>
                                    <input type="number" value={Math.round(item.costoUnitario)} onChange={e => handleEditRow(item.uniqueId, 'costoUnitario', e.target.value)} style={styles.inputTable}/>
                                    <div style={{textAlign:'right', fontWeight:'bold', color:'#111827', fontSize:'0.9rem'}}>{formatMoney(item.costoTotal)}</div>
                                    <button onClick={() => setItemsCarrito(itemsCarrito.filter(i => i.uniqueId !== item.uniqueId))} style={{border:'none', background:'transparent', color:'#ef4444', cursor:'pointer', display:'flex', justifyContent:'center'}}>
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div style={{marginTop:20, paddingTop:20, borderTop:'1px solid #e5e7eb'}}>
                            <div style={{display:'flex', gap:10}}>
                                <button type="button" onClick={cerrar} style={{flex:1, padding:12, background:'white', border:'1px solid #d1d5db', borderRadius:8, fontWeight:'bold', color:'#374151', cursor:'pointer'}}>Cancelar</button>
                                <button type="submit" disabled={loading} style={{flex:2, padding:12, backgroundColor:'#111827', border:'none', borderRadius:8, fontWeight:'bold', color:'white', cursor:'pointer', display:'flex', justifyContent:'center', gap:8}}>
                                    <Save size={18}/> {loading ? 'Guardando...' : (movimientoEditar ? 'Actualizar' : 'Guardar Movimiento')}
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