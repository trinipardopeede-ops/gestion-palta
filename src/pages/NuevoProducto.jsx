import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Save } from 'lucide-react'

function NuevoProducto({ producto, cerrar, alGuardar }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nombre: producto?.nombre || '',
    unidad_medida: producto?.unidad_medida || 'Litros',
    categoria: producto?.categoria || 'Fertilizante',
    stock_minimo: producto?.stock_minimo || 0
  })

  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value})

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
        if (producto) {
            await supabase.from('bodega_insumos').update(formData).eq('id', producto.id)
        } else {
            await supabase.from('bodega_insumos').insert([formData])
        }
        alGuardar()
    } catch (error) {
        alert(error.message)
    } finally {
        setLoading(false)
    }
  }

  const styles = {
    form: { display:'flex', flexDirection:'column', gap:'15px' },
    label: { fontWeight:'bold', fontSize:'0.9rem', color:'#374151', marginBottom:'5px', display:'block' },
    input: { padding:'10px', borderRadius:'6px', border:'1px solid #d1d5db', width:'100%', boxSizing:'border-box' },
    btn: { backgroundColor:'#1f2937', color:'white', padding:'12px', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', display:'flex', justifyContent:'center', gap:'10px' }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
        <div>
            <label style={styles.label}>Nombre Insumo</label>
            <input name="nombre" value={formData.nombre} onChange={handleChange} style={styles.input} placeholder="Ej: Urea 46%" required/>
        </div>
        
        <div style={{display:'flex', gap:'15px'}}>
            <div style={{flex:1}}>
                <label style={styles.label}>Unidad Medida</label>
                <select name="unidad_medida" value={formData.unidad_medida} onChange={handleChange} style={styles.input}>
                    <option value="Litros">Litros</option>
                    <option value="Kilos">Kilos</option>
                    <option value="Sacos">Sacos</option>
                    <option value="Unidades">Unidades</option>
                    <option value="Metros">Metros</option>
                </select>
            </div>
            <div style={{flex:1}}>
            <label style={styles.label}>Categoría <span style={{color:'red'}}>*</span></label>
                <select name="categoria" value={formData.categoria} onChange={handleChange} style={styles.input}>
                    <option value="Fertilizante">Fertilizante</option>
                    <option value="Fitosanitario">Fitosanitario</option>
                    <option value="Riego">Riego (Mangueras, Aspersores, Fittings)</option> {/* <--- NUEVO */}
                    <option value="Mantención">Mantención / Limpieza</option> {/* <--- NUEVO */}
                    <option value="Herramienta">Herramienta</option>
                    <option value="Combustible">Combustible</option>
                    <option value="Otro">Otro</option>
                </select>
            </div>
        </div>

        <div>
            <label style={styles.label}>Alerta Stock Mínimo</label>
            <input type="number" name="stock_minimo" value={formData.stock_minimo} onChange={handleChange} style={styles.input} />
        </div>

        <button type="submit" style={styles.btn} disabled={loading}>
            <Save size={18}/> {loading ? 'Guardando...' : 'Guardar Producto'}
        </button>
    </form>
  )
}
export default NuevoProducto
