import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Save, X } from 'lucide-react'

function NuevoGasto({ idGasto, cerrarModal, alGuardar }) {
  const [loading, setLoading] = useState(false)
  
  // Listas Maestras
  const [categorias, setCategorias] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [socios, setSocios] = useState([])
  const [parcelas, setParcelas] = useState([])

  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    descripcion: '',
    monto: '',
    categoria_id: '',
    proveedor_id: '',
    parcela_id: '',
    nro_documento: '',
    tipo_documento: 'Factura',
    estado_pago: 'Pagado', // Por defecto pagado
    forma_pago: 'Transferencia',
    pagado_por_socio_id: '' // Importante para las cuentas claras
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    // Carga paralela de maestros
    const [cat, prov, soc, parc] = await Promise.all([
        supabase.from('categorias_gastos').select('*').order('nombre'),
        supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
        supabase.from('socios').select('*').eq('activo', true).order('nombre'),
        supabase.from('parcelas').select('*').eq('activo', true).order('nombre')
    ])

    setCategorias(cat.data || [])
    setProveedores(prov.data || [])
    setSocios(soc.data || [])
    setParcelas(parc.data || [])

    // Si hay un ID, cargamos el gasto para editar
    if (idGasto) {
        const { data } = await supabase.from('gastos').select('*').eq('id', idGasto).single()
        if (data) setForm(data)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const guardar = async (e) => {
    e.preventDefault()
    setLoading(true)

    // Si el estado es "Pendiente", limpiamos quien pagó
    const payload = { ...form }
    if (payload.estado_pago === 'Pendiente') {
        payload.pagado_por_socio_id = null
    }

    try {
        if (idGasto) {
            await supabase.from('gastos').update(payload).eq('id', idGasto)
        } else {
            await supabase.from('gastos').insert([payload])
        }
        alGuardar()
    } catch (err) {
        console.error(err)
        alert("Error al guardar gasto")
    } finally {
        setLoading(false)
    }
  }

  // Estilos del Formulario
  const styles = {
    form: { display: 'grid', gap: '15px', gridTemplateColumns: '1fr 1fr' },
    fullWidth: { gridColumn: '1 / -1' },
    label: { display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#374151', marginBottom: 5 },
    input: { width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing:'border-box' },
    select: { width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem', backgroundColor:'white' },
    actions: { gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10, borderTop:'1px solid #e5e7eb', paddingTop:15 },
    btnSave: { padding: '10px 20px', backgroundColor: '#1f2937', color: 'white', borderRadius: 8, border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 },
    btnCancel: { padding: '10px 20px', backgroundColor: 'transparent', color: '#4b5563', borderRadius: 8, border: '1px solid #d1d5db', fontWeight: 'bold', cursor: 'pointer' },
    
    // Sección visual diferenciada para Pago
    paymentSection: { gridColumn: '1/-1', backgroundColor: '#f9fafb', padding: 15, borderRadius: 8, border: '1px dashed #d1d5db', display:'grid', gridTemplateColumns:'1fr 1fr', gap:15, marginTop:5 }
  }

  return (
    <form onSubmit={guardar} style={styles.form}>
        
        {/* FECHA Y MONTO */}
        <div>
            <label style={styles.label}>Fecha</label>
            <input type="date" name="fecha" value={form.fecha} onChange={handleChange} style={styles.input} required />
        </div>
        <div>
            <label style={styles.label}>Monto Total ($)</label>
            <input type="number" name="monto" value={form.monto} onChange={handleChange} style={styles.input} required placeholder="0" />
        </div>

        {/* DESCRIPCIÓN */}
        <div style={styles.fullWidth}>
            <label style={styles.label}>Descripción del Gasto</label>
            <input type="text" name="descripcion" value={form.descripcion} onChange={handleChange} style={styles.input} required placeholder="Ej: Compra de fertilizantes..." />
        </div>

        {/* CATEGORÍA Y PARCELA */}
        <div>
            <label style={styles.label}>Categoría</label>
            <select name="categoria_id" value={form.categoria_id} onChange={handleChange} style={styles.select} required>
                <option value="">-- Seleccionar --</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
        </div>
        <div>
            <label style={styles.label}>Asignar a Parcela (Opcional)</label>
            <select name="parcela_id" value={form.parcela_id} onChange={handleChange} style={styles.select}>
                <option value="">Gasto General / Administrativo</option>
                {parcelas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
        </div>

        {/* PROVEEDOR Y DOCUMENTO */}
        <div>
            <label style={styles.label}>Proveedor</label>
            <select name="proveedor_id" value={form.proveedor_id} onChange={handleChange} style={styles.select}>
                <option value="">-- Sin Proveedor / Varios --</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
        </div>
        <div style={{display:'flex', gap:5}}>
             <div style={{flex:1}}>
                <label style={styles.label}>Tipo Doc.</label>
                <select name="tipo_documento" value={form.tipo_documento} onChange={handleChange} style={styles.select}>
                    <option value="Factura">Factura</option>
                    <option value="Boleta">Boleta</option>
                    <option value="Recibo">Recibo</option>
                    <option value="Sin Doc">Sin Doc</option>
                </select>
             </div>
             <div style={{flex:1.5}}>
                <label style={styles.label}>Nro Doc.</label>
                <input type="text" name="nro_documento" value={form.nro_documento} onChange={handleChange} style={styles.input} />
             </div>
        </div>

        {/* SECCIÓN DE PAGO */}
        <div style={styles.paymentSection}>
            <div style={styles.fullWidth}>
                <label style={{...styles.label, color:'#2563eb'}}>Estado del Pago</label>
                <div style={{display:'flex', gap:10}}>
                    <label style={{display:'flex', alignItems:'center', gap:5, cursor:'pointer'}}>
                        <input type="radio" name="estado_pago" value="Pagado" checked={form.estado_pago === 'Pagado'} onChange={handleChange} />
                        <span style={{fontWeight:'bold', color:'#166534'}}>Pagado</span>
                    </label>
                    <label style={{display:'flex', alignItems:'center', gap:5, cursor:'pointer'}}>
                        <input type="radio" name="estado_pago" value="Pendiente" checked={form.estado_pago === 'Pendiente'} onChange={handleChange} />
                        <span style={{fontWeight:'bold', color:'#991b1b'}}>Pendiente</span>
                    </label>
                </div>
            </div>

            {form.estado_pago === 'Pagado' && (
                <>
                    <div>
                        <label style={styles.label}>Forma de Pago</label>
                        <select name="forma_pago" value={form.forma_pago} onChange={handleChange} style={styles.select}>
                            <option value="Transferencia">Transferencia</option>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Tarjeta">Tarjeta Crédito/Débito</option>
                            <option value="Cheque">Cheque</option>
                        </select>
                    </div>
                    <div>
                        <label style={styles.label}>¿Quién pagó? (Socio)</label>
                        <select name="pagado_por_socio_id" value={form.pagado_por_socio_id} onChange={handleChange} style={styles.select} required>
                            <option value="">-- Seleccionar Socio --</option>
                            {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                        <div style={{fontSize:'0.7rem', color:'#6b7280', marginTop:3}}>* Afecta Cta. Cte. del Socio</div>
                    </div>
                </>
            )}
        </div>

        <div style={styles.actions}>
            <button type="button" onClick={cerrarModal} style={styles.btnCancel}>Cancelar</button>
            <button type="submit" style={styles.btnSave}>
                {loading ? 'Guardando...' : <><Save size={18}/> Guardar Gasto</>}
            </button>
        </div>
    </form>
  )
}

export default NuevoGasto