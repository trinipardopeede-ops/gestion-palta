import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { 
    Save, Plus, Trash2, FileText, Wallet, 
    Map, CheckCircle2, AlertCircle, ArrowRight
} from 'lucide-react'

// --- HELPER: ALGORITMO DE DISTRIBUCIÓN EXACTA ---
const calcularDistribucionExacta = (montoTotal, idsSeleccionados, listaParcelas, metodo) => {
    const todosSectores = listaParcelas.flatMap(p => p.sectores || []);
    const sectoresTarget = todosSectores.filter(s => idsSeleccionados.includes(s.id));
    
    if (sectoresTarget.length === 0 || montoTotal <= 0) return [];

    let distribucion = [];
    let montoAcumulado = 0;
    const totalItems = sectoresTarget.length;

    let denominadorTotal = 0;
    if (metodo === 'Equitativo') {
        denominadorTotal = totalItems;
    } else if (metodo === 'Superficie') {
        denominadorTotal = sectoresTarget.reduce((acc, s) => acc + (parseFloat(s.superficie_ha) || 0), 0);
    } else if (metodo === 'Arboles') {
        denominadorTotal = sectoresTarget.reduce((acc, s) => acc + (parseInt(s.cantidad_arboles) || 0), 0);
    }

    if (denominadorTotal === 0 && metodo !== 'Equitativo') {
        denominadorTotal = totalItems;
        metodo = 'Equitativo';
    }

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

// Componente: Input Moneda Grande
const BigMoneyInput = ({ value, onChange, autoFocus = false }) => {
    const [display, setDisplay] = useState('')
    useEffect(() => {
        if (value || value === 0) setDisplay('$ ' + parseInt(value).toLocaleString('es-CL'))
        else setDisplay('')
    }, [value])
 
    const handleChange = (e) => {
        const raw = e.target.value.replace(/\D/g, '')
        setDisplay(raw);
        onChange(raw)
    }
    return (
        <div style={{position: 'relative', width: '100%'}}>
            <input 
                type="text" 
                value={display} 
                onChange={handleChange} 
                autoFocus={autoFocus}
                placeholder="$ 0"
                style={{ 
                    width: '100%', padding: '15px', borderRadius: 12, 
                    border: '1px solid #d1d5db', fontSize: '1.8rem', fontWeight: '800', 
                    textAlign: 'center', boxSizing: 'border-box', outline: 'none', 
                    color: '#111827' 
                }} 
            />
            <div style={{textAlign:'center', fontSize:'0.75rem', color:'#6b7280', marginTop:4, textTransform:'uppercase', letterSpacing:1}}>Monto Total Documento</div>
        </div>
    )
}

// Componente: Input Moneda Pequeño
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
  
  // Estados UI
  const [modoSectores, setModoSectores] = useState(false) 
  const [alertaInsumos, setAlertaInsumos] = useState(false) // Para avisar que vaya a bodega

  // Formulario
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

  // Distribución
  const [metodoDistribucion, setMetodoDistribucion] = useState('Superficie')

  // Cuotas
  const [cuotas, setCuotas] = useState([])

  useEffect(() => { cargarMaestros() }, [])

  // 1. FILTRO SUBCATEGORÍAS Y ALERTA DE BODEGA
  useEffect(() => {
      if(form.categoria_id) {
          const filtradas = subcategorias.filter(s => s.categoria_id.toString() === form.categoria_id.toString())
          setSubcategoriasFiltradas(filtradas)

          // Detectar si seleccionó algo que debería ir por Bodega
          const catObj = categorias.find(c => c.id.toString() === form.categoria_id.toString())
          if (catObj) {
              const nombre = catObj.nombre.toLowerCase()
              // Si suena a insumo tangible, mostramos alerta
              if (nombre.includes('insumo') || nombre.includes('material') || nombre.includes('fertilizante') || nombre.includes('agro')) {
                  setAlertaInsumos(true)
              } else {
                  setAlertaInsumos(false)
              }
          }
      } else {
          setSubcategoriasFiltradas([])
          setAlertaInsumos(false)
      }
  }, [form.categoria_id, subcategorias, categorias])

  // 2. SINCRONIZACIÓN CUOTA POR DEFECTO
  useEffect(() => {
      if (cuotas.length === 1) {
          const nuevaMonto = form.monto || ''
          if (cuotas[0].monto !== nuevaMonto) {
              const updatedCuotas = [...cuotas]
              updatedCuotas[0].monto = nuevaMonto
              setCuotas(updatedCuotas)
          }
      }
  }, [form.monto])

  async function cargarMaestros() {
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
        // Carga de Gasto
        const { data } = await supabase.from('gastos').select('*, pagos_gastos(*)').eq('id', idGasto).single()
        if (data) {
            setForm({
                ...data,
                subcategoria_id: data.subcategoria_id || '',
                proveedor_id: data.proveedor_id || '',
                nro_documento: data.nro_documento || '', 
                labor_origen_id: data.labor_origen_id 
            })
            setCuotas(data.pagos_gastos || [])
            if (data.sectores_ids?.length > 0) setModoSectores(true)
            if (data.metodo_distribucion) setMetodoDistribucion(data.metodo_distribucion)
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
      // Al agregar manualmente, se rompe la sincronización automática
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
        const todasPagadas = cuotas.every(c => c.estado === 'Pagado')
        const ningunaPagada = cuotas.every(c => c.estado === 'Pendiente')
        
        const cleanPayload = {
            fecha: form.fecha,
            clase_contable: form.clase_contable,
            descripcion: form.descripcion,
            monto: form.monto,
            categoria_id: form.categoria_id,
            subcategoria_id: form.subcategoria_id || null,
            proveedor_id: form.proveedor_id || null,
            labor_origen_id: form.labor_origen_id || null,
            tipo_documento: form.tipo_documento,
            nro_documento: form.nro_documento || null, 
            sectores_ids: modoSectores ? form.sectores_ids : [],
            metodo_distribucion: modoSectores ? metodoDistribucion : null,
            estado_pago: todasPagadas ? 'Pagado' : (ningunaPagada ? 'Pendiente' : 'Parcial')
        }

        if (idGasto) cleanPayload.id = idGasto

        // 1. Guardar Gasto (Header)
        const { data, error } = await supabase.from('gastos').upsert([cleanPayload]).select()
        if (error) throw error
        const gId = data[0].id

        // 2. Guardar Cuotas (Limpiar y Reinsertar)
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

        // 3. Guardar Distribución Contable (Limpiar y Reinsertar)
        await supabase.from('gasto_distribucion').delete().eq('gasto_id', gId)
        
        if (modoSectores && form.sectores_ids.length > 0) {
            const itemsDistribucion = calcularDistribucionExacta(
                totalGasto, 
                form.sectores_ids, 
                parcelas, 
                metodoDistribucion
            ).map(item => ({
                ...item,
                gasto_id: gId
            }));

            if (itemsDistribucion.length > 0) {
                await supabase.from('gasto_distribucion').insert(itemsDistribucion)
            }
        }

        // 4. Sincronización Billetera Socios (Aportes/Pagos)
        await supabase.from('movimientos_billetera').delete().ilike('descripcion', `%[GID:${gId}]`) 

        const pagosSocios = cuotas.filter(c => c.estado === 'Pagado' && c.pagado_por_socio_id)
        if (pagosSocios.length > 0) {
            const movsBilletera = pagosSocios.map(c => ({
                socio_id: c.pagado_por_socio_id,
                tipo: 'Aporte', 
                monto: c.monto,
                fecha: c.fecha_vencimiento,
                descripcion: `Pago Gasto: ${form.descripcion} [GID:${gId}]` 
            }))
            await supabase.from('movimientos_billetera').insert(movsBilletera)
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
                    
                    {/* Alerta de UX para Insumos */}
                    {alertaInsumos && (
                        <div style={{backgroundColor:'#fefce8', border:'1px solid #fef08a', padding:10, borderRadius:8, marginBottom:15, fontSize:'0.85rem', color:'#854d0e', display:'flex', gap:10, alignItems:'start'}}>
                            <AlertCircle size={18} style={{marginTop:2}}/>
                            <div>
                                <strong>¿Es una compra de Insumos?</strong>
                                <div style={{marginTop:2}}>
                                    Para registrar stock (fertilizantes, materiales) utiliza el módulo <strong>Bodega &gt; Nueva Compra</strong>.
                                    Aquí solo se registra el valor financiero.
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{marginBottom:12}}>
                        <label style={styles.label}>Clase Contable (Destino Financiero)</label>
                        <div style={{display:'flex', gap:10}}>
                            {['OPEX', 'CAPEX'].map(tipo => (
                                <div 
                                    key={tipo}
                                    onClick={() => { setForm({...form, clase_contable: tipo}); setHasChanges(true) }}
                                    style={{
                                        padding:'8px 16px', borderRadius:8, cursor:'pointer', fontWeight:'bold', fontSize:'0.85rem',
                                        border: form.clase_contable === tipo ? '2px solid #2563eb' : '1px solid #d1d5db',
                                        backgroundColor: form.clase_contable === tipo ? '#eff6ff' : 'white',
                                        color: form.clase_contable === tipo ? '#1e40af' : '#6b7280'
                                    }}
                                >
                                    {tipo === 'OPEX' ? '📉 Gasto Operacional' : '🏗️ Inversión (Activo)'}
                                </div>
                            ))}
                        </div>
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
                                <input type="text" placeholder="12345" value={form.nro_documento || ''} onChange={e => {setForm({...form, nro_documento: e.target.value}); setHasChanges(true)}} style={{...styles.input, flex:1}}/>
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

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
                         <div>
                             <label style={styles.label}>Categoría</label>
                            <select 
                                value={form.categoria_id} 
                                onChange={e => {
                                    setForm({...form, categoria_id: e.target.value, subcategoria_id: ''}); setHasChanges(true)
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
                         <input type="text" placeholder="Ej: Pago servicios contables..." value={form.descripcion} onChange={e => {setForm({...form, descripcion: e.target.value}); setHasChanges(true)}} style={styles.input} required/>
                    </div>
                </div>

                <div style={styles.card}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                        <div style={{fontWeight:'bold', fontSize:'0.9rem', display:'flex', alignItems:'center', gap:6}}>
                             <Map size={18}/> Imputar a Sectores
                        </div>
                        <div style={{display:'flex', alignItems:'center', gap:5}}>
                            {modoSectores && (
                                <select 
                                    value={metodoDistribucion}
                                    onChange={(e) => setMetodoDistribucion(e.target.value)}
                                    style={{
                                        fontSize:'0.75rem', 
                                        padding:'2px 6px', 
                                        border:'1px solid #d1d5db', 
                                        borderRadius:4, 
                                        color:'#4b5563',
                                        marginRight: 5,
                                        outline: 'none',
                                        backgroundColor: '#f9fafb'
                                    }}
                                >
                                    <option value="Superficie">x Ha</option>
                                    <option value="Arboles">x Árbol</option>
                                    <option value="Equitativo">Equitativo</option>
                                </select>
                            )}
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
                <BigMoneyInput value={form.monto} onChange={v => {setForm({...form, monto: v}); setHasChanges(true)}} autoFocus/>

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