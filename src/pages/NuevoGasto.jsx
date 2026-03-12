import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { 
    Save, Plus, Trash2, FileText, Wallet, 
    Map, CheckCircle2, AlertCircle, Package, X
} from 'lucide-react'

// --- HELPER: DISTRIBUCIÓN EXACTA ---
const calcularDistribucionExacta = (montoTotal, idsSeleccionados, listaParcelas, metodo) => {
    const todosSectores = listaParcelas.flatMap(p => p.sectores || [])
    const sectoresTarget = todosSectores.filter(s => idsSeleccionados.includes(s.id))
    if (sectoresTarget.length === 0 || montoTotal <= 0) return []
    let distribucion = [], montoAcumulado = 0
    const totalItems = sectoresTarget.length
    let denominadorTotal = metodo === 'Equitativo' ? totalItems
        : metodo === 'Superficie' ? sectoresTarget.reduce((a, s) => a + (parseFloat(s.superficie_ha) || 0), 0)
        : sectoresTarget.reduce((a, s) => a + (parseInt(s.cantidad_arboles) || 0), 0)
    if (denominadorTotal === 0) { denominadorTotal = totalItems; metodo = 'Equitativo' }
    for (let i = 0; i < totalItems - 1; i++) {
        const s = sectoresTarget[i]
        const factor = metodo === 'Equitativo' ? 1 : metodo === 'Superficie' ? (parseFloat(s.superficie_ha) || 0) : (parseInt(s.cantidad_arboles) || 0)
        const montoCuota = Math.round(montoTotal * (factor / denominadorTotal))
        distribucion.push({ sector_id: s.id, monto: montoCuota, porcentaje: ((factor / denominadorTotal) * 100).toFixed(2) })
        montoAcumulado += montoCuota
    }
    const ultimo = sectoresTarget[totalItems - 1]
    const resto = montoTotal - montoAcumulado
    distribucion.push({ sector_id: ultimo.id, monto: resto, porcentaje: ((resto / montoTotal) * 100).toFixed(2) })
    return distribucion
}

// --- POPUP DETALLE INSUMOS ---
// Modo Paquete: N paquetes × contenido por paquete × precio por paquete
// Modo Unidad: cantidad directa × precio unitario
function PopupInsumosBodega({ gastoFecha, onCerrar, onConfirmar }) {
    const [insumos, setInsumos] = useState([])
    const [lineas, setLineas] = useState([{
        uid: Date.now(), insumo_id: '',
        modo: 'Paquete',           // 'Paquete' | 'Unidad'
        // Modo Paquete
        cant_paquetes: '', contenido_paquete: '', precio_paquete: '',
        // Modo Unidad
        cantidad_total: '', precio_total: ''
    }])
    const [loadingInsumos, setLoadingInsumos] = useState(true)

    useEffect(() => {
        supabase.from('bodega_insumos').select('*').eq('activo', true).order('nombre')
            .then(({ data }) => { setInsumos(data || []); setLoadingInsumos(false) })
    }, [])

    const update = (uid, field, value) => setLineas(p => p.map(l => l.uid === uid ? { ...l, [field]: value } : l))
    const agregar = () => setLineas(p => [...p, { uid: Date.now(), insumo_id: '', modo: 'Paquete', cant_paquetes: '', contenido_paquete: '', precio_paquete: '', cantidad_total: '', precio_total: '' }])
    const eliminar = (uid) => { if (lineas.length === 1) return alert('Debe haber al menos una línea.'); setLineas(p => p.filter(l => l.uid !== uid)) }

    const calcLinea = (l) => {
        if (l.modo === 'Paquete') {
            const paquetes = parseFloat(l.cant_paquetes) || 0
            const contenido = parseFloat(l.contenido_paquete) || 0
            const precioPaquete = parseFloat(l.precio_paquete) || 0
            const cantidadFinal = paquetes * contenido
            const costoTotal = paquetes * precioPaquete
            return { cantidadFinal, costoTotal, costoUnitario: cantidadFinal > 0 ? costoTotal / cantidadFinal : 0 }
        } else {
            const cantidadFinal = parseFloat(l.cantidad_total) || 0
            const costoTotal = parseFloat(l.precio_total) || 0
            return { cantidadFinal, costoTotal, costoUnitario: cantidadFinal > 0 ? costoTotal / cantidadFinal : 0 }
        }
    }

    const totalGeneral = lineas.reduce((a, l) => a + calcLinea(l).costoTotal, 0)
    const fmt = (v) => '$ ' + Math.round(v || 0).toLocaleString('es-CL')

    const confirmar = () => {
        for (const l of lineas) {
            if (!l.insumo_id) return alert('Selecciona un insumo en todas las líneas.')
            const { cantidadFinal, costoTotal } = calcLinea(l)
            if (cantidadFinal <= 0) return alert('Ingresa una cantidad válida en todas las líneas.')
            if (costoTotal <= 0) return alert('Ingresa un precio válido en todas las líneas.')
        }
        onConfirmar(lineas.map(l => {
            const { cantidadFinal, costoUnitario } = calcLinea(l)
            return { insumo_id: parseInt(l.insumo_id), cantidad: cantidadFinal, costo_unitario: costoUnitario, fecha: gastoFecha }
        }))
    }

    const s = {
        overlay: { position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.65)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:2000, backdropFilter:'blur(3px)' },
        box: { backgroundColor:'white', borderRadius:16, width:'95%', maxWidth:760, maxHeight:'88vh', display:'flex', flexDirection:'column', boxShadow:'0 25px 50px rgba(0,0,0,0.25)' },
        header: { padding:'18px 22px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 },
        body: { padding:'18px 22px', overflowY:'auto', flex:1 },
        footer: { padding:'14px 22px', borderTop:'1px solid #e5e7eb', display:'flex', gap:10, justifyContent:'space-between', alignItems:'center', flexShrink:0 },
        linea: { border:'1px solid #e5e7eb', borderRadius:10, padding:14, marginBottom:10, backgroundColor:'#fafafa' },
        lineaHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
        toggle: { display:'flex', backgroundColor:'#f3f4f6', padding:3, borderRadius:7, gap:2 },
        toggleBtn: (active) => ({ padding:'5px 12px', borderRadius:5, border:'none', cursor:'pointer', fontSize:'0.78rem', fontWeight:'600', backgroundColor: active ? 'white' : 'transparent', color: active ? '#2563eb' : '#6b7280', boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }),
        inp: { width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid #d1d5db', fontSize:'0.85rem', boxSizing:'border-box' },
        inpR: { width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid #d1d5db', fontSize:'0.85rem', textAlign:'right', boxSizing:'border-box' },
        lbl: { fontSize:'0.72rem', fontWeight:'600', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.3px', display:'block', marginBottom:3 },
        resumen: { marginTop:10, padding:'8px 12px', backgroundColor:'white', borderRadius:7, border:'1px dashed #cbd5e1', fontSize:'0.82rem', display:'flex', justifyContent:'space-between' },
        btnAdd: { display:'flex', alignItems:'center', gap:5, padding:'8px 14px', borderRadius:8, border:'1px dashed #9ca3af', background:'white', color:'#6b7280', cursor:'pointer', fontSize:'0.82rem', fontWeight:'600' },
        btnOk: { padding:'10px 22px', borderRadius:8, border:'none', backgroundColor:'#166534', color:'white', fontWeight:'bold', cursor:'pointer', display:'flex', alignItems:'center', gap:7 },
        btnCancel: { padding:'10px 18px', borderRadius:8, border:'1px solid #d1d5db', background:'white', color:'#374151', fontWeight:'500', cursor:'pointer' }
    }

    return (
        <div style={s.overlay} onClick={e => e.stopPropagation()}>
            <div style={s.box}>
                <div style={s.header}>
                    <div>
                        <div style={{fontWeight:'bold', fontSize:'1.05rem', color:'#111827', display:'flex', alignItems:'center', gap:8}}>
                            <Package size={18} color="#2563eb"/> Detalle de Insumos en Bodega
                        </div>
                        <div style={{fontSize:'0.78rem', color:'#6b7280', marginTop:2}}>El gasto no se guardará hasta que confirmes este detalle.</div>
                    </div>
                    <button onClick={onCerrar} style={{background:'none', border:'none', cursor:'pointer', color:'#9ca3af'}}><X size={20}/></button>
                </div>

                <div style={s.body}>
                    {loadingInsumos ? (
                        <div style={{textAlign:'center', padding:24, color:'#9ca3af'}}>Cargando insumos...</div>
                    ) : insumos.length === 0 ? (
                        <div style={{textAlign:'center', padding:20, color:'#ef4444', backgroundColor:'#fef2f2', borderRadius:8}}>
                            No hay productos activos en Bodega. Crea al menos uno primero.
                        </div>
                    ) : (
                        <>
                            {lineas.map((l, idx) => {
                                const ins = insumos.find(i => i.id == l.insumo_id)
                                const unidad = ins?.unidad_medida || 'unid'
                                const { cantidadFinal, costoTotal, costoUnitario } = calcLinea(l)
                                return (
                                    <div key={l.uid} style={s.linea}>
                                        <div style={s.lineaHeader}>
                                            <span style={{fontSize:'0.8rem', fontWeight:'700', color:'#6b7280'}}>Ítem {idx + 1}</span>
                                            <div style={{display:'flex', alignItems:'center', gap:8}}>
                                                {/* Toggle Paquete / Unidad */}
                                                <div style={s.toggle}>
                                                    <button type="button" onClick={() => update(l.uid, 'modo', 'Paquete')} style={s.toggleBtn(l.modo === 'Paquete')}>📦 Paquete</button>
                                                    <button type="button" onClick={() => update(l.uid, 'modo', 'Unidad')} style={s.toggleBtn(l.modo === 'Unidad')}>🔢 Unidad</button>
                                                </div>
                                                <button type="button" onClick={() => eliminar(l.uid)} style={{border:'none', background:'#fef2f2', color:'#ef4444', cursor:'pointer', borderRadius:6, padding:'4px 6px', display:'flex', alignItems:'center'}}><Trash2 size={13}/></button>
                                            </div>
                                        </div>

                                        {/* Selector insumo */}
                                        <div style={{marginBottom:10}}>
                                            <label style={s.lbl}>Producto / Insumo</label>
                                            <select value={l.insumo_id} onChange={e => update(l.uid, 'insumo_id', e.target.value)} style={s.inp}>
                                                <option value="">-- Seleccionar --</option>
                                                {insumos.map(i => <option key={i.id} value={i.id}>{i.nombre} · {i.unidad_medida} · {i.categoria}</option>)}
                                            </select>
                                        </div>

                                        {/* Campos según modo */}
                                        {l.modo === 'Paquete' ? (
                                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10}}>
                                                <div>
                                                    <label style={s.lbl}>N° Paquetes</label>
                                                    <input type="number" min="0" step="1" placeholder="3" value={l.cant_paquetes} onChange={e => update(l.uid, 'cant_paquetes', e.target.value)} style={s.inpR}/>
                                                </div>
                                                <div>
                                                    <label style={s.lbl}>Contenido / paquete ({unidad})</label>
                                                    <input type="number" min="0" step="0.01" placeholder="25" value={l.contenido_paquete} onChange={e => update(l.uid, 'contenido_paquete', e.target.value)} style={s.inpR}/>
                                                </div>
                                                <div>
                                                    <label style={s.lbl}>Precio / paquete ($)</label>
                                                    <input type="number" min="0" placeholder="$$$" value={l.precio_paquete} onChange={e => update(l.uid, 'precio_paquete', e.target.value)} style={{...s.inpR, color:'#166534', fontWeight:'bold'}}/>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                                                <div>
                                                    <label style={s.lbl}>Cantidad total ({unidad})</label>
                                                    <input type="number" min="0" step="0.01" placeholder="100" value={l.cantidad_total} onChange={e => update(l.uid, 'cantidad_total', e.target.value)} style={s.inpR}/>
                                                </div>
                                                <div>
                                                    <label style={s.lbl}>Precio total ($)</label>
                                                    <input type="number" min="0" placeholder="$$$" value={l.precio_total} onChange={e => update(l.uid, 'precio_total', e.target.value)} style={{...s.inpR, color:'#166534', fontWeight:'bold'}}/>
                                                </div>
                                            </div>
                                        )}

                                        {/* Resumen calculado */}
                                        {cantidadFinal > 0 && (
                                            <div style={s.resumen}>
                                                <span>Entrará: <strong>{cantidadFinal.toLocaleString('es-CL')} {unidad}</strong></span>
                                                <span>P. unitario: <strong>{fmt(costoUnitario)}/{unidad}</strong></span>
                                                <span style={{color:'#166534'}}>Total: <strong>{fmt(costoTotal)}</strong></span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}

                            <button type="button" onClick={agregar} style={s.btnAdd}>
                                <Plus size={14}/> Agregar otro producto
                            </button>
                        </>
                    )}
                </div>

                <div style={s.footer}>
                    <div style={{fontSize:'0.9rem', color:'#6b7280'}}>
                        Total: <strong style={{color:'#111827', fontSize:'1.1rem'}}>{fmt(totalGeneral)}</strong>
                    </div>
                    <div style={{display:'flex', gap:8}}>
                        <button type="button" onClick={onCerrar} style={s.btnCancel}>Volver</button>
                        <button type="button" onClick={confirmar} disabled={insumos.length === 0} style={s.btnOk}>
                            <CheckCircle2 size={15}/> Confirmar detalle
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Exportar categorías para uso en Bodega
export const CATEGORIAS_BODEGA_GRUPOS = ['Insumos Agrícolas', 'Materiales de Riego', 'Materiales de Soporte', 'Herramientas y Equipos', 'Combustibles y Lubricantes', 'Otro']

// --- HELPERS UI ---
const BigMoneyInput = ({ value, onChange, autoFocus = false, label = 'Monto Total Documento' }) => {
    const [display, setDisplay] = useState('')
    useEffect(() => { if (value || value === 0) setDisplay('$ ' + parseInt(value).toLocaleString('es-CL')); else setDisplay('') }, [value])
    const handleChange = (e) => { const raw = e.target.value.replace(/\D/g, ''); setDisplay(raw); onChange(raw) }
    return (
        <div>
            <input type="text" value={display} onChange={handleChange} autoFocus={autoFocus} placeholder="$ 0"
                style={{width:'100%', padding:'15px', borderRadius:12, border:'1px solid #d1d5db', fontSize:'1.8rem', fontWeight:'800', textAlign:'center', boxSizing:'border-box', outline:'none', color:'#111827'}}/>
            <div style={{textAlign:'center', fontSize:'0.75rem', color:'#6b7280', marginTop:4, textTransform:'uppercase', letterSpacing:1}}>{label}</div>
        </div>
    )
}

const TableMoneyInput = ({ value, onChange }) => {
    const [display, setDisplay] = useState('')
    useEffect(() => { if (value || value === 0) setDisplay('$ ' + parseInt(value).toLocaleString('es-CL')); else setDisplay('') }, [value])
    const handleChange = (e) => { const raw = e.target.value.replace(/\D/g, ''); setDisplay(raw); onChange(raw) }
    return <input type="text" placeholder="$ 0" value={display} onChange={handleChange} style={{width:'100%', padding:'6px', borderRadius:6, border:'1px solid #d1d5db', fontSize:'0.85rem', fontWeight:'bold', color:'#111827', boxSizing:'border-box', outline:'none'}}/>
}

// --- COMPONENTE PRINCIPAL ---
function NuevoGasto({ idGasto, cerrarModal, alGuardar }) {
    const [loading, setLoading] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    const [categorias, setCategorias] = useState([])
    const [subcategorias, setSubcategorias] = useState([])
    const [subcategoriasFiltradas, setSubcategoriasFiltradas] = useState([])
    const [proveedores, setProveedores] = useState([])
    const [socios, setSocios] = useState([])
    const [parcelas, setParcelas] = useState([])

    const [modoSectores, setModoSectores] = useState(false)
    // IVA — solo aplica a facturas
    const [modoIngreso, setModoIngreso] = useState('bruto') // 'bruto' | 'neto'
    // Advertencia socios — confirmación explícita al editar pagos con socios
    const [confirmacionSocios, setConfirmacionSocios] = useState(false)
    // Checkbox explícito — usuario decide si registrar en bodega
    const [registrarEnBodega, setRegistrarEnBodega] = useState(false)
    const [popupInsumos, setPopupInsumos] = useState(false)
    const [lineasInsumos, setLineasInsumos] = useState(null) // null = no completado

    // Inline nuevo proveedor
    const [modoNuevoProv, setModoNuevoProv] = useState(false)
    const [nuevoProvNombre, setNuevoProvNombre] = useState('')
    const [nuevoProvRut, setNuevoProvRut] = useState('')
    const [nuevoProvTelefono, setNuevoProvTelefono] = useState('')
    const [nuevoProvEmail, setNuevoProvEmail] = useState('')
    const [guardandoProv, setGuardandoProv] = useState(false)

    // Inline nueva categoría
    const [modoNuevaCat, setModoNuevaCat] = useState(false)
    const [nuevaCatNombre, setNuevaCatNombre] = useState('')
    const [nuevaCatTipo, setNuevaCatTipo] = useState('Gasto Operacional')
    const [guardandoCat, setGuardandoCat] = useState(false)

    // Inline nueva subcategoría
    const [modoNuevaSub, setModoNuevaSub] = useState(false)
    const [nuevoSubNombre, setNuevoSubNombre] = useState('')
    const [guardandoSub, setGuardandoSub] = useState(false)

    const [form, setForm] = useState({
        fecha: new Date().toISOString().split('T')[0],
        clase_contable: 'OPEX',
        descripcion: '',
        monto: '',
        categoria_id: '',
        subcategoria_id: '',
        proveedor_id: '',
        tipo_documento: 'Factura',
        nro_documento: '',
        estado_pago: 'Pendiente',
        sectores_ids: [],
        labor_origen_id: null
    })
    const [metodoDistribucion, setMetodoDistribucion] = useState('Superficie')
    const [cuotas, setCuotas] = useState([])

    useEffect(() => { cargarMaestros() }, [])

    useEffect(() => {
        if (form.categoria_id) {
            setSubcategoriasFiltradas(subcategorias.filter(s => s.categoria_id.toString() === form.categoria_id.toString()))
        } else {
            setSubcategoriasFiltradas([])
        }
    }, [form.categoria_id, subcategorias])

    // Limpiar líneas si desmarca el checkbox
    useEffect(() => {
        if (!registrarEnBodega) setLineasInsumos(null)
    }, [registrarEnBodega])

    useEffect(() => {
        if (cuotas.length === 1) {
            const raw = parseFloat(form.monto || 0)
            const bruto = (form.tipo_documento === 'Factura' && modoIngreso === 'neto')
                ? Math.round(raw * 1.19)
                : raw
            const brutoStr = bruto > 0 ? bruto.toString() : ''
            if (cuotas[0].monto !== brutoStr) {
                const c = [...cuotas]; c[0].monto = brutoStr; setCuotas(c)
            }
        }
    }, [form.monto, form.tipo_documento, modoIngreso])

    async function cargarMaestros() {
        try {
            const [cat, sub, prov, soc, parc] = await Promise.all([
                supabase.from('categorias_gastos').select('*').order('nombre'),
                supabase.from('subcategorias_gastos').select('*').order('nombre'),
                supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
                supabase.from('socios').select('*').eq('activo', true).order('nombre'),
                supabase.from('parcelas').select('*, sectores(*)').eq('activo', true).order('nombre')
            ])
            setCategorias(cat.data || [])
            setSubcategorias(sub.data || [])
            setProveedores(prov.data || [])
            setSocios(soc.data || [])
            setParcelas(parc.data || [])

            if (idGasto) {
                const { data } = await supabase.from('gastos').select('*, pagos_gastos(*)').eq('id', idGasto).single()
                if (data) {
                    setForm({ ...data, subcategoria_id: data.subcategoria_id || '', proveedor_id: data.proveedor_id || '', nro_documento: data.nro_documento || '', labor_origen_id: data.labor_origen_id })
                    setCuotas(data.pagos_gastos || [])
                    if (data.sectores_ids?.length > 0) setModoSectores(true)
                    if (data.metodo_distribucion) setMetodoDistribucion(data.metodo_distribucion)
                }
            } else {
                setCuotas([{ fecha_vencimiento: new Date().toISOString().split('T')[0], monto: '', forma_pago: 'Transferencia', pagado_por_socio_id: '', estado: 'Pendiente' }])
            }
        } catch (err) {
            alert('Error cargando el formulario. Ciérralo e intenta de nuevo.')
        }
    }

    const handleCerrar = () => {
        if (hasChanges && !confirm("Tienes cambios sin guardar. ¿Cerrar de todas formas?")) return
        cerrarModal()
    }

    // Registrar en el Modal para interceptar ESC y click fuera
    useEffect(() => {
        window.intentarCerrarModal = handleCerrar
        return () => { delete window.intentarCerrarModal }
    }, [hasChanges])

    const updateCuota = (idx, field, val) => {
        const c = [...cuotas]; c[idx][field] = val === "" && field === 'pagado_por_socio_id' ? null : val; setCuotas(c); setHasChanges(true)
    }

    const guardarNuevoProveedor = async () => {
        if (!nuevoProvNombre.trim()) return
        setGuardandoProv(true)
        const payload = {
            nombre: nuevoProvNombre.trim(),
            activo: true,
            rut: nuevoProvRut.trim() || null,
            telefono: nuevoProvTelefono.trim() || null,
            email: nuevoProvEmail.trim() || null,
        }
        const { data, error } = await supabase.from('proveedores').insert([payload]).select().single()
        if (error) alert('Error: ' + error.message)
        else {
            setProveedores(p => [...p, data].sort((a,b) => a.nombre.localeCompare(b.nombre)))
            setForm(f => ({...f, proveedor_id: data.id.toString()}))
            setNuevoProvNombre(''); setNuevoProvRut(''); setNuevoProvTelefono(''); setNuevoProvEmail('')
            setModoNuevoProv(false); setHasChanges(true)
        }
        setGuardandoProv(false)
    }

    const guardarNuevaCategoria = async () => {
        if (!nuevaCatNombre.trim()) return
        setGuardandoCat(true)
        const { data, error } = await supabase.from('categorias_gastos').insert([{ nombre: nuevaCatNombre.trim(), tipo: nuevaCatTipo }]).select().single()
        if (error) alert('Error: ' + error.message)
        else {
            setCategorias(p => [...p, data].sort((a,b) => a.nombre.localeCompare(b.nombre)))
            setForm(f => ({...f, categoria_id: data.id.toString(), subcategoria_id: ''}))
            setNuevaCatNombre(''); setNuevaCatTipo('Gasto Operacional'); setModoNuevaCat(false); setHasChanges(true)
        }
        setGuardandoCat(false)
    }

    const guardarNuevaSubcategoria = async () => {
        if (!nuevoSubNombre.trim() || !form.categoria_id) return
        setGuardandoSub(true)
        const { data, error } = await supabase.from('subcategorias_gastos').insert([{ nombre: nuevoSubNombre.trim(), categoria_id: parseInt(form.categoria_id) }]).select().single()
        if (error) alert('Error: ' + error.message)
        else { setSubcategorias(p => [...p, data].sort((a,b) => a.nombre.localeCompare(b.nombre))); setForm(f => ({...f, subcategoria_id: data.id.toString()})); setNuevoSubNombre(''); setModoNuevaSub(false); setHasChanges(true) }
        setGuardandoSub(false)
    }

    const handlePopupConfirmar = (lineas) => {
        setLineasInsumos(lineas)
        setPopupInsumos(false)
    }

    const guardar = async (e) => {
        e.preventDefault()

        // Validar que si marcó registrar en bodega, haya completado el detalle
        if (registrarEnBodega && !idGasto && !lineasInsumos) {
            return alert('⚠️ Marcaste "Registrar en Bodega" pero no completaste el detalle de insumos.\nHaz clic en "+ Detalle de Productos" antes de guardar.')
        }

        const totalGasto = (() => {
            const raw = parseFloat(form.monto || 0)
            if (form.tipo_documento === 'Factura' && modoIngreso === 'neto') return Math.round(raw * 1.19)
            return raw
        })()
        const totalCuotas = cuotas.reduce((a, c) => a + parseFloat(c.monto || 0), 0)
        if (Math.abs(totalCuotas - totalGasto) > 10) {
            return alert(`Los montos no coinciden.\nTotal Gasto: $${totalGasto.toLocaleString()}\nSuma Cuotas: $${totalCuotas.toLocaleString()}`)
        }

        // Si es edición y hay cuotas con pagos de socios, pedir confirmación explícita
        if (idGasto && !confirmacionSocios) {
            const pagosSocios = cuotas.filter(c => c.estado === 'Pagado' && c.pagado_por_socio_id)
            if (pagosSocios.length > 0) {
                setConfirmacionSocios(true)
                return
            }
        }

        setLoading(true)
        try {
            const todasPagadas = cuotas.every(c => c.estado === 'Pagado')
            const ningunaPagada = cuotas.every(c => c.estado === 'Pendiente')

            // Si es gasto de Labor, solo actualizamos campos de documento y proveedor
            const esDeLabor = !!form.labor_origen_id
            const cleanPayload = {
                fecha: form.fecha,
                tipo_documento: form.tipo_documento,
                nro_documento: form.nro_documento || null,
                proveedor_id: form.proveedor_id || null,
                labor_origen_id: form.labor_origen_id || null,
                // Campos solo editables si NO viene de Labor
                ...(!esDeLabor && {
                    clase_contable: form.clase_contable,
                    descripcion: form.descripcion,
                    monto: totalGasto,
                    categoria_id: form.categoria_id,
                    subcategoria_id: form.subcategoria_id || null,
                    sectores_ids: modoSectores ? form.sectores_ids : [],
                    metodo_distribucion: modoSectores ? metodoDistribucion : null,
                    parcela_id: modoSectores ? (form.parcela_id || null) : null,
                }),
                estado_pago: todasPagadas ? 'Pagado' : (ningunaPagada ? 'Pendiente' : 'Parcial')
            }
            if (idGasto) cleanPayload.id = idGasto

            const { data, error } = await supabase.from('gastos').upsert([cleanPayload]).select()
            if (error) throw error
            const gId = data[0].id

            await supabase.from('pagos_gastos').delete().eq('gasto_id', gId)
            await supabase.from('pagos_gastos').insert(cuotas.map(c => ({
                gasto_id: gId, fecha_vencimiento: c.fecha_vencimiento, monto: c.monto,
                forma_pago: c.forma_pago, pagado_por_socio_id: c.pagado_por_socio_id || null, estado: c.estado
            })))

            await supabase.from('gasto_distribucion').delete().eq('gasto_id', gId)
            if (modoSectores && form.sectores_ids.length > 0) {
                const dist = calcularDistribucionExacta(totalGasto, form.sectores_ids, parcelas, metodoDistribucion).map(i => ({ ...i, gasto_id: gId }))
                if (dist.length > 0) await supabase.from('gasto_distribucion').insert(dist)
            }

            await supabase.from('movimientos_billetera').delete().eq('gasto_id', gId)
            const pagosSocios = cuotas.filter(c => c.estado === 'Pagado' && c.pagado_por_socio_id)
            if (pagosSocios.length > 0) {
                await supabase.from('movimientos_billetera').insert(pagosSocios.map(c => ({
                    socio_id: c.pagado_por_socio_id, tipo: 'Aporte', monto: c.monto,
                    fecha: c.fecha_vencimiento, descripcion: `Pago Gasto: ${form.descripcion}`, gasto_id: gId
                })))
            }

            // Bodega — solo si el usuario marcó el checkbox y hay líneas confirmadas
            if (lineasInsumos && lineasInsumos.length > 0) {
                const movs = lineasInsumos.map(l => ({
                    insumo_id: l.insumo_id, tipo_movimiento: 'Entrada',
                    cantidad: l.cantidad, costo_unitario: l.costo_unitario,
                    fecha: l.fecha, referencia: `Compra Gasto #${gId}`
                }))
                const { error: errBodega } = await supabase.from('bodega_movimientos').insert(movs)
                if (errBodega) throw errBodega
            }

            alGuardar()
        } catch (err) {
            alert(err.message)
        } finally {
            setLoading(false)
        }
    }

    // El botón guardar se bloquea solo cuando marcó registrar pero aún no completó el detalle
    const bodegaPendiente = registrarEnBodega && !idGasto && !lineasInsumos

    const styles = {
        layout: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'start' },
        leftPanel: { display:'flex', flexDirection:'column', gap:15 },
        card: { backgroundColor:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:15 },
        label: { fontSize:'0.8rem', fontWeight:'600', color:'#374151', marginBottom:4, display:'block' },
        input: { width:'100%', padding:'10px', borderRadius:8, border:'1px solid #d1d5db', fontSize:'0.9rem', boxSizing:'border-box' },
        chip: (active) => ({ padding:'6px 12px', borderRadius:20, fontSize:'0.8rem', cursor:'pointer', border: active ? '1px solid #2563eb' : '1px solid #e5e7eb', backgroundColor: active ? '#eff6ff' : 'white', color: active ? '#1e40af' : '#6b7280', transition:'all 0.2s' }),
        rightPanel: { display:'flex', flexDirection:'column', gap:15 },
        paymentCard: { backgroundColor:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:15, display:'flex', flexDirection:'column' },
        cuotaItem: { backgroundColor:'white', border:'1px solid #e5e7eb', borderRadius:8, padding:10, marginBottom:8, display:'flex', flexDirection:'column', gap:8 },
        inputCuota: { padding:'6px', borderRadius:6, border:'1px solid #d1d5db', fontSize:'0.85rem', width:'100%', boxSizing:'border-box' },
        btnTrash: { border:'none', background:'#fee2e2', color:'#ef4444', padding:6, borderRadius:6, cursor:'pointer' },
        inlineLbl: { fontSize:'0.75rem', color:'#2563eb', background:'none', border:'none', cursor:'pointer', fontWeight:'bold' },
        inlineRow: { display:'flex', gap:6 },
        btnInlineOk: { padding:'8px 14px', borderRadius:8, border:'none', backgroundColor:'#166534', color:'white', fontWeight:'bold', cursor:'pointer', whiteSpace:'nowrap' }
    }

    return (
        <>
            {popupInsumos && (
                <PopupInsumosBodega
                    gastoFecha={form.fecha}
                    onCerrar={() => setPopupInsumos(false)}
                    onConfirmar={handlePopupConfirmar}
                />
            )}

            <form onSubmit={guardar} style={{display:'flex', flexDirection:'column'}}>

                {/* BANNER — gasto originado desde Labor */}
                {form.labor_origen_id && (
                    <div style={{backgroundColor:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'10px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:10}}>
                        <span style={{fontSize:'1.1rem'}}>⚠️</span>
                        <div style={{flex:1}}>
                            <div style={{fontSize:'0.85rem', fontWeight:'700', color:'#92400e'}}>Gasto generado desde una Labor</div>
                            <div style={{fontSize:'0.75rem', color:'#b45309', marginTop:1}}>Monto, categoría, descripción y sectores se editan desde la Labor original. Aquí solo puedes modificar el documento y proveedor.</div>
                        </div>
                        <button type="button" onClick={() => { cerrarModal(); /* navegar a labor si se implementa */ }}
                            style={{fontSize:'0.75rem', fontWeight:'700', color:'#d97706', background:'none', border:'1px solid #fcd34d', borderRadius:6, padding:'4px 10px', cursor:'pointer', whiteSpace:'nowrap'}}>
                            Ver Labor →
                        </button>
                    </div>
                )}

                <div style={styles.layout}>
                    {/* PANEL IZQUIERDO */}
                    <div style={styles.leftPanel}>
                        <div style={styles.card}>
                            <div style={{fontWeight:'bold', marginBottom:12, display:'flex', alignItems:'center', gap:8, fontSize:'1rem', color:'#111827'}}>
                                <FileText size={18}/> Detalle del Gasto
                            </div>

                            {/* OPEX / CAPEX */}
                            <div style={{marginBottom:12, opacity: form.labor_origen_id ? 0.5 : 1, pointerEvents: form.labor_origen_id ? 'none' : 'auto'}}>
                                <label style={styles.label}>Clase Contable {form.labor_origen_id && <span style={{color:'#d97706', fontSize:'0.7rem'}}>(bloqueado)</span>}</label>
                                <div style={{display:'flex', gap:10}}>
                                    {['OPEX','CAPEX'].map(t => (
                                        <div key={t} onClick={() => { if (!form.labor_origen_id) { setForm({...form, clase_contable: t}); setHasChanges(true) } }}
                                            style={{padding:'8px 16px', borderRadius:8, cursor: form.labor_origen_id ? 'default' : 'pointer', fontWeight:'bold', fontSize:'0.85rem',
                                                border: form.clase_contable===t ? '2px solid #2563eb' : '1px solid #d1d5db',
                                                backgroundColor: form.clase_contable===t ? '#eff6ff' : 'white',
                                                color: form.clase_contable===t ? '#1e40af' : '#6b7280'}}>
                                            {t === 'OPEX' ? '📉 Gasto Operacional' : '🏗️ Inversión (Activo)'}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Fecha y Documento */}
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
                                <div>
                                    <label style={styles.label}>Fecha</label>
                                    <input type="date" value={form.fecha} onChange={e => {setForm({...form, fecha: e.target.value}); setHasChanges(true)}} style={styles.input} required/>
                                </div>
                                <div>
                                    <label style={styles.label}>N° Documento</label>
                                    <div style={{display:'flex', gap:5}}>
                                        <select style={{...styles.input, width:'90px'}} value={form.tipo_documento} onChange={e => {setForm({...form, tipo_documento: e.target.value}); setHasChanges(true)}}>
                                            <option>Factura</option><option>Boleta</option><option>Guía</option><option>Interno</option>
                                        </select>
                                        <input type="text" placeholder="12345" value={form.nro_documento || ''} onChange={e => {setForm({...form, nro_documento: e.target.value}); setHasChanges(true)}} style={{...styles.input, flex:1}}/>
                                    </div>
                                </div>
                            </div>

                            {/* Proveedor inline */}
                            <div style={{marginBottom:12}}>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
                                    <label style={styles.label}>Proveedor</label>
                                    <button type="button" onClick={() => setModoNuevoProv(!modoNuevoProv)} style={styles.inlineLbl}>{modoNuevoProv ? '✕ Cancelar' : '+ Nuevo'}</button>
                                </div>
                                {modoNuevoProv ? (
                                    <div style={{backgroundColor:'#f0fdf4', border:'1px solid #86efac', borderRadius:10, padding:12, display:'flex', flexDirection:'column', gap:8}}>
                                        <div style={{fontSize:'0.75rem', fontWeight:'700', color:'#166534', marginBottom:2}}>✦ Nuevo Proveedor</div>
                                        <input autoFocus type="text" placeholder="Nombre *" value={nuevoProvNombre} onChange={e => setNuevoProvNombre(e.target.value)} style={styles.input}/>
                                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                                            <input type="text" placeholder="RUT (ej: 76.123.456-7)" value={nuevoProvRut} onChange={e => setNuevoProvRut(e.target.value)} style={styles.input}/>
                                            <input type="text" placeholder="Teléfono" value={nuevoProvTelefono} onChange={e => setNuevoProvTelefono(e.target.value)} style={styles.input}/>
                                        </div>
                                        <input type="email" placeholder="Email de contacto" value={nuevoProvEmail} onChange={e => setNuevoProvEmail(e.target.value)} style={styles.input}/>
                                        <button type="button" onClick={guardarNuevoProveedor} disabled={guardandoProv || !nuevoProvNombre.trim()} style={{...styles.btnInlineOk, alignSelf:'flex-end'}}>
                                            {guardandoProv ? 'Guardando...' : '✓ Guardar Proveedor'}
                                        </button>
                                    </div>
                                ) : (
                                    <select value={form.proveedor_id || ''} onChange={e => {setForm({...form, proveedor_id: e.target.value}); setHasChanges(true)}} style={styles.input}>
                                        <option value="">-- Seleccionar --</option>
                                        {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                    </select>
                                )}
                            </div>

                            {/* Categoría y Subcategoría inline */}
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12, opacity: form.labor_origen_id ? 0.5 : 1, pointerEvents: form.labor_origen_id ? 'none' : 'auto'}}>
                                <div>
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
                                        <label style={styles.label}>Categoría Contable {form.labor_origen_id && <span style={{color:'#d97706', fontSize:'0.7rem'}}>(bloqueado)</span>}</label>
                                        {!form.labor_origen_id && <button type="button" onClick={() => setModoNuevaCat(!modoNuevaCat)} style={styles.inlineLbl}>{modoNuevaCat ? '✕ Cancelar' : '+ Nueva'}</button>}
                                    </div>
                                    {modoNuevaCat ? (
                                        <div style={{backgroundColor:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:12, display:'flex', flexDirection:'column', gap:8}}>
                                            <div style={{fontSize:'0.75rem', fontWeight:'700', color:'#1e40af', marginBottom:2}}>✦ Nueva Categoría</div>
                                            <input autoFocus type="text" placeholder="Nombre *" value={nuevaCatNombre} onChange={e => setNuevaCatNombre(e.target.value)} style={styles.input}/>
                                            <select value={nuevaCatTipo} onChange={e => setNuevaCatTipo(e.target.value)} style={styles.input}>
                                                <option value="Gasto Operacional">📉 Gasto Operacional (OPEX)</option>
                                                <option value="Inversión">🏗️ Inversión (CAPEX)</option>
                                            </select>
                                            <button type="button" onClick={guardarNuevaCategoria} disabled={guardandoCat || !nuevaCatNombre.trim()} style={{...styles.btnInlineOk, alignSelf:'flex-end'}}>
                                                {guardandoCat ? '...' : '✓ Guardar'}
                                            </button>
                                        </div>
                                    ) : (
                                        <select value={form.categoria_id} onChange={e => {setForm({...form, categoria_id: e.target.value, subcategoria_id: ''}); setHasChanges(true)}} style={styles.input} required>
                                            <option value="">-- Seleccionar --</option>
                                            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                        </select>
                                    )}
                                </div>
                                <div>
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
                                        <label style={styles.label}>Subcategoría</label>
                                        {form.categoria_id && <button type="button" onClick={() => setModoNuevaSub(!modoNuevaSub)} style={styles.inlineLbl}>{modoNuevaSub ? '✕ Cancelar' : '+ Nueva'}</button>}
                                    </div>
                                    {modoNuevaSub ? (
                                        <div style={{backgroundColor:'#faf5ff', border:'1px solid #d8b4fe', borderRadius:10, padding:12, display:'flex', flexDirection:'column', gap:8}}>
                                            <div style={{fontSize:'0.75rem', fontWeight:'700', color:'#6b21a8', marginBottom:2}}>✦ Nueva Subcategoría</div>
                                            <div style={{fontSize:'0.72rem', color:'#6b7280', marginBottom:2}}>
                                                Dentro de: <strong>{categorias.find(c => c.id.toString() === form.categoria_id.toString())?.nombre}</strong>
                                            </div>
                                            <input autoFocus type="text" placeholder="Nombre *" value={nuevoSubNombre} onChange={e => setNuevoSubNombre(e.target.value)} style={styles.input}/>
                                            <button type="button" onClick={guardarNuevaSubcategoria} disabled={guardandoSub || !nuevoSubNombre.trim()} style={{...styles.btnInlineOk, alignSelf:'flex-end', backgroundColor:'#7c3aed'}}>
                                                {guardandoSub ? '...' : '✓ Guardar'}
                                            </button>
                                        </div>
                                    ) : (
                                        <select value={form.subcategoria_id || ''} onChange={e => {setForm({...form, subcategoria_id: e.target.value}); setHasChanges(true)}} style={{...styles.input, backgroundColor: form.categoria_id ? 'white' : '#f3f4f6'}} disabled={!form.categoria_id}>
                                            <option value="">-- Opcional --</option>
                                            {subcategoriasFiltradas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>

                            {/* Descripción */}
                            <div style={{marginBottom:12, opacity: form.labor_origen_id ? 0.5 : 1}}>
                                <label style={styles.label}>Descripción {form.labor_origen_id && <span style={{color:'#d97706', fontSize:'0.7rem'}}>(bloqueado)</span>}</label>
                                <input type="text" placeholder="Ej: Compra fertilizante temporada..." value={form.descripcion}
                                    onChange={e => { if (!form.labor_origen_id) { setForm({...form, descripcion: e.target.value}); setHasChanges(true) } }}
                                    readOnly={!!form.labor_origen_id}
                                    style={{...styles.input, backgroundColor: form.labor_origen_id ? '#f9fafb' : 'white', cursor: form.labor_origen_id ? 'default' : 'text'}} required/>
                            </div>

                            {/* ---- CHECKBOX REGISTRAR EN BODEGA ---- */}
                            {!idGasto && (
                                <div style={{
                                    backgroundColor: registrarEnBodega ? (lineasInsumos ? '#f0fdf4' : '#fefce8') : '#f9fafb',
                                    border: `1px solid ${registrarEnBodega ? (lineasInsumos ? '#86efac' : '#fde68a') : '#e5e7eb'}`,
                                    borderRadius:9, padding:'10px 14px',
                                    display:'flex', justifyContent:'space-between', alignItems:'center', gap:10
                                }}>
                                    <label style={{display:'flex', alignItems:'center', gap:9, cursor:'pointer', flex:1}}>
                                        <input
                                            type="checkbox"
                                            checked={registrarEnBodega}
                                            onChange={e => { setRegistrarEnBodega(e.target.checked); setHasChanges(true) }}
                                            style={{width:16, height:16, cursor:'pointer', accentColor:'#2563eb'}}
                                        />
                                        <div>
                                            <div style={{fontSize:'0.85rem', fontWeight:'600', color: registrarEnBodega ? '#1e40af' : '#374151', display:'flex', alignItems:'center', gap:5}}>
                                                <Package size={14}/> ¿Registrar en Bodega?
                                            </div>
                                            <div style={{fontSize:'0.72rem', color:'#6b7280', marginTop:1}}>Actualiza el stock de productos / insumos</div>
                                        </div>
                                    </label>

                                    {/* Botón detalle — visible solo si el checkbox está marcado */}
                                    {registrarEnBodega && (
                                        <button type="button" onClick={() => setPopupInsumos(true)}
                                            style={{fontSize:'0.8rem', fontWeight:'bold', border:'none', borderRadius:6, padding:'6px 12px', cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5,
                                                backgroundColor: lineasInsumos ? '#166534' : '#d97706', color:'white'}}>
                                            <Package size={13}/>
                                            {lineasInsumos
                                                ? `✓ ${lineasInsumos.length} producto${lineasInsumos.length > 1 ? 's' : ''} — Editar`
                                                : '+ Detalle de Productos'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Parcela */}
                        <div style={styles.card}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                                <div style={{fontWeight:'bold', fontSize:'0.9rem', display:'flex', alignItems:'center', gap:6}}><Map size={18}/> Imputar a Parcela</div>
                                <div style={{display:'flex', alignItems:'center', gap:5}}>
                                    {modoSectores && (
                                        <select value={metodoDistribucion} onChange={e => setMetodoDistribucion(e.target.value)} style={{fontSize:'0.75rem', padding:'2px 6px', border:'1px solid #d1d5db', borderRadius:4, color:'#4b5563', marginRight:5, outline:'none', backgroundColor:'#f9fafb'}}>
                                            <option value="Superficie">x Ha</option><option value="Arboles">x Árbol</option><option value="Equitativo">Equitativo</option>
                                        </select>
                                    )}
                                    <span style={{fontSize:'0.75rem', color:'#6b7280'}}>¿Aplica a campo?</span>
                                    <input type="checkbox" checked={modoSectores} onChange={e => {
                                        setModoSectores(e.target.checked)
                                        if (!e.target.checked) setForm(f => ({...f, parcela_id: null, sectores_ids: []}))
                                        setHasChanges(true)
                                    }} style={{width:16, height:16, cursor:'pointer'}}/>
                                </div>
                            </div>
                            {modoSectores && (
                                <div style={{borderTop:'1px solid #f3f4f6', paddingTop:10}}>
                                    <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
                                        {parcelas.map(p => {
                                            const activa = form.parcela_id === p.id
                                            return (
                                                <div key={p.id}
                                                    onClick={() => {
                                                        const nuevaParcela = activa ? null : p.id
                                                        const nuevosSectores = activa ? [] : (p.sectores || []).map(s => s.id)
                                                        setForm(f => ({...f, parcela_id: nuevaParcela, sectores_ids: nuevosSectores}))
                                                        setHasChanges(true)
                                                    }}
                                                    style={{...styles.chip(activa), padding:'8px 16px', fontSize:'0.85rem'}}>
                                                    {p.nombre}
                                                    {activa && <span style={{fontSize:'0.7rem', color:'#6b7280', marginLeft:4}}>· {p.sectores?.length || 0} sectores</span>}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {form.parcela_id && (
                                        <div style={{marginTop:8, fontSize:'0.75rem', color:'#6b7280', backgroundColor:'#f9fafb', padding:'6px 10px', borderRadius:6}}>
                                            Sectores incluidos: {parcelas.find(p => p.id === form.parcela_id)?.sectores?.map(s => s.nombre).join(', ')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* PANEL DERECHO */}
                    <div style={styles.rightPanel}>

                        {/* MONTO + IVA */}
                        <div style={{backgroundColor:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:15, opacity: form.labor_origen_id ? 0.5 : 1, pointerEvents: form.labor_origen_id ? 'none' : 'auto'}}>
                            {form.labor_origen_id && (
                                <div style={{fontSize:'0.72rem', color:'#d97706', fontWeight:'700', marginBottom:8, textAlign:'center'}}>⚠ Monto controlado por la Labor — no editable</div>
                            )}
                            {/* Toggle neto/bruto — solo si es Factura y no viene de Labor */}
                            {form.tipo_documento === 'Factura' && !form.labor_origen_id && (
                                <div style={{display:'flex', justifyContent:'center', marginBottom:12}}>
                                    <div style={{display:'flex', backgroundColor:'#f3f4f6', borderRadius:8, padding:3, gap:2}}>
                                        {[['bruto','Ingresar Bruto (c/IVA)'],['neto','Ingresar Neto (s/IVA)']].map(([val, lbl]) => (
                                            <button key={val} type="button" onClick={() => setModoIngreso(val)}
                                                style={{padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer', fontSize:'0.78rem', fontWeight:'600',
                                                    backgroundColor: modoIngreso === val ? 'white' : 'transparent',
                                                    color: modoIngreso === val ? '#111827' : '#6b7280',
                                                    boxShadow: modoIngreso === val ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'}}>
                                                {lbl}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <BigMoneyInput
                                value={form.monto}
                                onChange={v => { setForm({...form, monto: v}); setHasChanges(true) }}
                                autoFocus
                                label={form.tipo_documento === 'Factura'
                                    ? (modoIngreso === 'bruto' ? 'Monto Total (Bruto c/IVA)' : 'Monto Neto (s/IVA)')
                                    : 'Monto Total'}
                            />

                            {/* Desglose IVA — solo facturas con monto */}
                            {form.tipo_documento === 'Factura' && parseFloat(form.monto) > 0 && (() => {
                                const bruto = modoIngreso === 'bruto'
                                    ? parseFloat(form.monto)
                                    : Math.round(parseFloat(form.monto) * 1.19)
                                const neto  = Math.round(bruto / 1.19)
                                const iva   = bruto - neto
                                return (
                                    <div style={{marginTop:12, backgroundColor:'#f8fafc', borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between', gap:8}}>
                                        <div style={{textAlign:'center', flex:1}}>
                                            <div style={{fontSize:'0.68rem', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', marginBottom:3}}>Neto</div>
                                            <div style={{fontSize:'0.95rem', fontWeight:'800', color:'#111827'}}>$ {neto.toLocaleString('es-CL')}</div>
                                        </div>
                                        <div style={{width:1, backgroundColor:'#e5e7eb'}}/>
                                        <div style={{textAlign:'center', flex:1}}>
                                            <div style={{fontSize:'0.68rem', fontWeight:'700', color:'#0369a1', textTransform:'uppercase', marginBottom:3}}>IVA 19%</div>
                                            <div style={{fontSize:'0.95rem', fontWeight:'800', color:'#0369a1'}}>$ {iva.toLocaleString('es-CL')}</div>
                                        </div>
                                        <div style={{width:1, backgroundColor:'#e5e7eb'}}/>
                                        <div style={{textAlign:'center', flex:1}}>
                                            <div style={{fontSize:'0.68rem', fontWeight:'700', color:'#166534', textTransform:'uppercase', marginBottom:3}}>Total Bruto</div>
                                            <div style={{fontSize:'0.95rem', fontWeight:'800', color:'#166534'}}>$ {bruto.toLocaleString('es-CL')}</div>
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>

                        <div style={styles.paymentCard}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:15, paddingBottom:10, borderBottom:'1px solid #e2e8f0'}}>
                                <div style={{fontWeight:'bold', fontSize:'1rem', color:'#0f172a', display:'flex', alignItems:'center', gap:8}}><Wallet size={18}/> Plan de Pagos</div>
                                <button type="button" onClick={() => setCuotas([...cuotas, {fecha_vencimiento: form.fecha, monto:'', forma_pago:'Transferencia', pagado_por_socio_id:'', estado:'Pendiente'}])} style={{backgroundColor:'#166534', color:'white', border:'none', borderRadius:6, padding:'6px 12px', fontSize:'0.8rem', fontWeight:'bold', cursor:'pointer', display:'flex', alignItems:'center', gap:5}}>
                                    <Plus size={14}/> Agregar Cuota
                                </button>
                            </div>

                            <div style={{overflowY:'auto', paddingRight:5}}>
                                {cuotas.map((c, i) => (
                                    <div key={i} style={styles.cuotaItem}>
                                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                            <div style={{flex:1, marginRight:10}}>
                                                <label style={{fontSize:'0.7rem', color:'#6b7280', display:'block', marginBottom:2}}>Vencimiento</label>
                                                <input type="date" value={c.fecha_vencimiento} onChange={e => updateCuota(i,'fecha_vencimiento',e.target.value)} style={styles.inputCuota}/>
                                            </div>
                                            <div style={{flex:1}}>
                                                <label style={{fontSize:'0.7rem', color:'#6b7280', display:'block', marginBottom:2}}>Monto Cuota</label>
                                                <TableMoneyInput value={c.monto} onChange={val => updateCuota(i,'monto',val)}/>
                                            </div>
                                        </div>
                                        <div style={{display:'flex', gap:10, alignItems:'center'}}>
                                            <select value={c.forma_pago} onChange={e => updateCuota(i,'forma_pago',e.target.value)} style={{...styles.inputCuota, flex:1}}>
                                                <option value="Transferencia">Transf.</option><option value="Efectivo">Efectivo</option><option value="Cheque">Cheque</option><option value="Tarjeta">Tarjeta</option>
                                            </select>
                                            <select value={c.pagado_por_socio_id||""} onChange={e => updateCuota(i,'pagado_por_socio_id',e.target.value)} style={{...styles.inputCuota, flex:1}}>
                                                <option value="">Empresa</option>
                                                {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                            </select>
                                            <select value={c.estado} onChange={e => updateCuota(i,'estado',e.target.value)} style={{...styles.inputCuota, width:'auto', color: c.estado==='Pagado'?'#166534':'#991b1b', fontWeight:'bold'}}>
                                                <option value="Pagado">Pagado</option><option value="Pendiente">Pendiente</option>
                                            </select>
                                            <button type="button" onClick={() => setCuotas(cuotas.filter((_,idx)=>idx!==i))} style={styles.btnTrash}><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{marginTop:10, paddingTop:10, borderTop:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                {(() => {
                                    const raw = parseFloat(form.monto || 0)
                                    const bruto = (form.tipo_documento === 'Factura' && modoIngreso === 'neto') ? Math.round(raw * 1.19) : raw
                                    const sumaCuotas = cuotas.reduce((a,b) => a + parseFloat(b.monto||0), 0)
                                    const cuadra = Math.abs(sumaCuotas - bruto) < 10
                                    return (
                                        <>
                                            <div style={{fontSize:'0.85rem', color:'#475569'}}>
                                                Suma Pagos: <strong>$ {sumaCuotas.toLocaleString('es-CL')}</strong>
                                                {form.tipo_documento === 'Factura' && modoIngreso === 'neto' && bruto > 0 && (
                                                    <span style={{fontSize:'0.72rem', color:'#9ca3af', marginLeft:5}}>(bruto c/IVA)</span>
                                                )}
                                            </div>
                                            {cuadra
                                                ? <div style={{display:'flex', alignItems:'center', gap:5, color:'#166534', fontWeight:'bold', fontSize:'0.8rem', backgroundColor:'#dcfce7', padding:'4px 8px', borderRadius:6}}><CheckCircle2 size={14}/> Cuadra</div>
                                                : <div style={{display:'flex', alignItems:'center', gap:5, color:'#991b1b', fontWeight:'bold', fontSize:'0.8rem', backgroundColor:'#fee2e2', padding:'4px 8px', borderRadius:6}}><AlertCircle size={14}/> Diferencia</div>
                                            }
                                        </>
                                    )
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{display:'flex', justifyContent:'flex-end', gap:12, marginTop:20, paddingTop:15, borderTop:'1px solid #e5e7eb'}}>

                    {/* ADVERTENCIA SOCIOS — aparece cuando hay pagos de socios y se intenta guardar */}
                    {confirmacionSocios && (() => {
                        const pagosSocios = cuotas.filter(c => c.estado === 'Pagado' && c.pagado_por_socio_id)
                        // Agrupar por socio
                        const porSocio = pagosSocios.reduce((acc, c) => {
                            const socio = socios.find(s => s.id.toString() === c.pagado_por_socio_id?.toString())
                            const nombre = socio?.nombre || 'Socio desconocido'
                            if (!acc[nombre]) acc[nombre] = 0
                            acc[nombre] += parseFloat(c.monto || 0)
                            return acc
                        }, {})
                        return (
                            <div style={{flex:1, backgroundColor:'#fff7ed', border:'1px solid #fed7aa', borderRadius:10, padding:'12px 16px'}}>
                                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                                    <AlertCircle size={16} color="#ea580c"/>
                                    <span style={{fontSize:'0.85rem', fontWeight:'700', color:'#9a3412'}}>
                                        Este gasto tiene pagos registrados de socios
                                    </span>
                                </div>
                                <div style={{fontSize:'0.78rem', color:'#c2410c', marginBottom:8}}>
                                    Al guardar se recalcularán los movimientos de billetera de:
                                </div>
                                <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:10}}>
                                    {Object.entries(porSocio).map(([nombre, monto]) => (
                                        <span key={nombre} style={{fontSize:'0.78rem', fontWeight:'700', backgroundColor:'#ffedd5', color:'#9a3412', padding:'3px 10px', borderRadius:6, border:'1px solid #fed7aa'}}>
                                            {nombre} · $ {Math.round(monto).toLocaleString('es-CL')}
                                        </span>
                                    ))}
                                </div>
                                <div style={{display:'flex', gap:8}}>
                                    <button type="button" onClick={() => setConfirmacionSocios(false)}
                                        style={{padding:'6px 14px', borderRadius:7, border:'1px solid #d1d5db', background:'white', cursor:'pointer', fontSize:'0.8rem', fontWeight:'600', color:'#374151'}}>
                                        Cancelar
                                    </button>
                                    <button type="submit"
                                        style={{padding:'6px 14px', borderRadius:7, border:'none', backgroundColor:'#ea580c', color:'white', cursor:'pointer', fontSize:'0.8rem', fontWeight:'700', display:'flex', alignItems:'center', gap:5}}>
                                        <Save size={14}/> Confirmar y Guardar
                                    </button>
                                </div>
                            </div>
                        )
                    })()}

                    {!confirmacionSocios && (
                        <>
                            <button type="button" onClick={handleCerrar} style={{padding:'10px 20px', borderRadius:8, border:'1px solid #d1d5db', background:'white', cursor:'pointer', fontWeight:'500', color:'#374151'}}>Cancelar</button>
                            <button type="submit" disabled={loading || bodegaPendiente}
                                style={{padding:'10px 20px', borderRadius:8, border:'none', backgroundColor: bodegaPendiente ? '#9ca3af' : '#111827', color:'white', fontWeight:'bold', display:'flex', alignItems:'center', gap:8, cursor: bodegaPendiente ? 'not-allowed' : 'pointer'}}
                                title={bodegaPendiente ? 'Completa el detalle de productos en bodega primero' : ''}>
                                <Save size={18}/> {loading ? 'Guardando...' : 'Guardar Gasto'}
                            </button>
                        </>
                    )}
                </div>
            </form>
        </>
    )
}

export default NuevoGasto