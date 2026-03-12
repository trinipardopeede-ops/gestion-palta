import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Save, Package, Droplets, Wrench, Leaf } from 'lucide-react'

// Categorías de Bodega — independientes de las categorías contables de Gastos
const CATEGORIAS_BODEGA = [
    {
        grupo: 'Insumos Agrícolas',
        icono: '🌱',
        desc: 'Fertilizantes, pesticidas, fungicidas, herbicidas',
        subcats: ['Fertilizante', 'Pesticida / Fungicida', 'Herbicida', 'Corrector de suelo', 'Estimulante / Bioestimulante']
    },
    {
        grupo: 'Materiales de Riego',
        icono: '💧',
        desc: 'Tuberías, aspersores, goteros, fittings',
        subcats: ['Tubería / Manguera', 'Aspersor / Gotero', 'Fitting / Conector', 'Filtro', 'Válvula']
    },
    {
        grupo: 'Materiales de Soporte',
        icono: '🪵',
        desc: 'Tutores, postes, malla, amarre',
        subcats: ['Tutor / Poste', 'Malla / Red', 'Alambre / Amarre', 'Plástico / Cobertura']
    },
    {
        grupo: 'Herramientas y Equipos',
        icono: '🔧',
        desc: 'Herramientas manuales, equipos menores, repuestos',
        subcats: ['Herramienta manual', 'Equipo menor', 'Repuesto / Pieza', 'Equipamiento seguridad']
    },
    {
        grupo: 'Combustibles y Lubricantes',
        icono: '⛽',
        desc: 'Combustible, aceite, lubricantes',
        subcats: ['Combustible', 'Lubricante / Aceite']
    },
    {
        grupo: 'Otro',
        icono: '📦',
        desc: 'Otros materiales no clasificados',
        subcats: ['Otro']
    }
]

const UNIDADES = [
    { value: 'Litros',    label: 'Litros (L)',         group: 'Volumen' },
    { value: 'Kilos',     label: 'Kilos (kg)',          group: 'Peso' },
    { value: 'Gramos',    label: 'Gramos (g)',          group: 'Peso' },
    { value: 'Metros',    label: 'Metros (m)',          group: 'Longitud' },
    { value: 'Metros2',   label: 'Metros² (m²)',        group: 'Superficie' },
    { value: 'Unidades',  label: 'Unidades (u)',        group: 'Conteo' },
    { value: 'Sacos',     label: 'Sacos',               group: 'Conteo' },
    { value: 'Cajas',     label: 'Cajas',               group: 'Conteo' },
    { value: 'Rollos',    label: 'Rollos',              group: 'Conteo' },
    { value: 'Litros/Ha', label: 'L/Ha (dosis)',        group: 'Agrícola' },
]

function NuevoProducto({ producto, cerrar, alGuardar }) {
    const [loading, setLoading] = useState(false)

    // Detectar grupo actual al editar
    const getGrupoInicial = () => {
        if (!producto?.categoria) return 'Insumos Agrícolas'
        const cat = CATEGORIAS_BODEGA.find(c => c.subcats.includes(producto.categoria) || c.grupo === producto.categoria)
        return cat ? cat.grupo : 'Insumos Agrícolas'
    }

    const [formData, setFormData] = useState({
        nombre: producto?.nombre || '',
        unidad_medida: producto?.unidad_medida || 'Kilos',
        categoria: producto?.categoria || 'Fertilizante',
        stock_minimo: producto?.stock_minimo || 0
    })
    const [grupoSeleccionado, setGrupoSeleccionado] = useState(getGrupoInicial())

    const grupoActual = CATEGORIAS_BODEGA.find(c => c.grupo === grupoSeleccionado)

    const handleGrupo = (grupo) => {
        setGrupoSeleccionado(grupo)
        const g = CATEGORIAS_BODEGA.find(c => c.grupo === grupo)
        // Resetear subcategoría al cambiar grupo
        setFormData(f => ({ ...f, categoria: g?.subcats[0] || grupo }))
    }

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const payload = { ...formData }
            if (producto) {
                await supabase.from('bodega_insumos').update(payload).eq('id', producto.id)
            } else {
                await supabase.from('bodega_insumos').insert([payload])
            }
            alGuardar()
        } catch (error) {
            alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    const s = {
        form: { display:'flex', flexDirection:'column', gap:16, minWidth:420 },
        label: { fontWeight:'600', fontSize:'0.82rem', color:'#374151', marginBottom:5, display:'block', textTransform:'uppercase', letterSpacing:'0.3px' },
        input: { padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', width:'100%', boxSizing:'border-box', fontSize:'0.9rem' },
        grupoGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 },
        grupoBtn: (active) => ({
            padding:'8px 10px', borderRadius:9, border: active ? '2px solid #2563eb' : '1px solid #e5e7eb',
            backgroundColor: active ? '#eff6ff' : 'white', cursor:'pointer', textAlign:'left',
            display:'flex', alignItems:'center', gap:7
        }),
        grupoBtnIcon: { fontSize:'1.1rem' },
        grupoBtnLabel: (active) => ({ fontSize:'0.8rem', fontWeight: active ? '700' : '500', color: active ? '#1e40af' : '#374151', lineHeight:1.2 }),
        subDesc: { fontSize:'0.75rem', color:'#6b7280', marginTop:8, fontStyle:'italic' },
        divider: { height:1, backgroundColor:'#f3f4f6', margin:'4px 0' },
        btn: { backgroundColor:'#1f2937', color:'white', padding:'12px', border:'none', borderRadius:8, cursor:'pointer', fontWeight:'bold', display:'flex', justifyContent:'center', gap:10, marginTop:4 }
    }

    return (
        <form onSubmit={handleSubmit} style={s.form}>

            {/* Nombre */}
            <div>
                <label style={s.label}>Nombre del Producto</label>
                <input name="nombre" value={formData.nombre} onChange={handleChange} style={s.input} placeholder="Ej: Urea 46%, Tutor 2m, Aspersor VYR35" required/>
            </div>

            {/* Categoría Bodega — dos niveles */}
            <div>
                <label style={s.label}>Categoría de Bodega</label>
                <div style={s.grupoGrid}>
                    {CATEGORIAS_BODEGA.map(c => (
                        <button key={c.grupo} type="button" onClick={() => handleGrupo(c.grupo)} style={s.grupoBtn(grupoSeleccionado === c.grupo)}>
                            <span style={s.grupoBtnIcon}>{c.icono}</span>
                            <span style={s.grupoBtnLabel(grupoSeleccionado === c.grupo)}>{c.grupo}</span>
                        </button>
                    ))}
                </div>
                {grupoActual && (
                    <div style={{marginTop:10}}>
                        <div style={s.subDesc}>{grupoActual.desc}</div>
                        <div style={{marginTop:8}}>
                            <label style={{...s.label, fontSize:'0.75rem'}}>Subcategoría</label>
                            <select name="categoria" value={formData.categoria} onChange={handleChange} style={s.input}>
                                {grupoActual.subcats.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            <div style={s.divider}/>

            {/* Unidad y stock mínimo */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <div>
                    <label style={s.label}>Unidad de Medida</label>
                    <select name="unidad_medida" value={formData.unidad_medida} onChange={handleChange} style={s.input}>
                        {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                </div>
                <div>
                    <label style={s.label}>Stock Mínimo (Alerta)</label>
                    <input type="number" name="stock_minimo" min="0" step="0.1" value={formData.stock_minimo} onChange={handleChange} style={s.input}/>
                    <div style={{fontSize:'0.72rem', color:'#9ca3af', marginTop:3}}>0 = sin alerta</div>
                </div>
            </div>

            <button type="submit" style={s.btn} disabled={loading}>
                <Save size={18}/> {loading ? 'Guardando...' : (producto ? 'Guardar Cambios' : 'Crear Producto')}
            </button>
        </form>
    )
}

export default NuevoProducto