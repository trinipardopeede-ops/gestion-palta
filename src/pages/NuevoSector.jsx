
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Save, X } from 'lucide-react'

function NuevoSector({ idSector, cerrarModal, alGuardar }) {
  const [loading, setLoading] = useState(false)
  const [parcelas, setParcelas] = useState([])

  const [formData, setFormData] = useState({
    nombre: '',
    parcela_id: '',
    variedad: 'Hass',
    cantidad_arboles: '', 
    superficie_ha: '',
    aspersores_por_planta: 1, // Dato para el usuario (Input)
    caudal_lph: '',
    ano_plantacion: '',
    marco_plantacion: ''
  })

  // 1. Cargar Parcelas (SOLO ACTIVAS)
  useEffect(() => {
    async function cargarParcelas() {
      const { data } = await supabase
        .from('parcelas')
        .select('id, nombre')
        .eq('activo', true) // <--- FILTRO IMPORTANTE
        .order('nombre')
      if (data) setParcelas(data)
    }
    cargarParcelas()
  }, [])

  // 2. Cargar Datos del Sector (si es edición)
  useEffect(() => {
    if (idSector) {
      async function cargarSector() {
        const { data } = await supabase.from('sectores').select('*').eq('id', idSector).single()
        if (data) {
          // Calcular el inverso (Total / Arboles) para mostrar en el input
          const ratio = data.cantidad_arboles > 0 ? (data.cantidad_aspersores / data.cantidad_arboles) : 1
          
          setFormData({
            nombre: data.nombre,
            parcela_id: data.parcela_id,
            variedad: data.variedad || 'Hass',
            cantidad_arboles: data.cantidad_arboles,
            superficie_ha: data.superficie_ha,
            aspersores_por_planta: ratio || 1, 
            caudal_lph: data.caudal_lph,
            ano_plantacion: data.ano_plantacion || '',
            marco_plantacion: data.marco_plantacion || ''
          })
        }
      }
      cargarSector()
    }
  }, [idSector])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // CALCULAMOS EL TOTAL PARA LA BD
      const totalAspersores = Math.round((parseFloat(formData.cantidad_arboles) || 0) * (parseFloat(formData.aspersores_por_planta) || 0))

      const payload = {
        nombre: formData.nombre,
        parcela_id: formData.parcela_id,
        variedad: formData.variedad,
        cantidad_arboles: parseInt(formData.cantidad_arboles),
        superficie_ha: parseFloat(formData.superficie_ha),
        cantidad_aspersores: totalAspersores, // Guardamos el TOTAL calculado
        caudal_lph: parseFloat(formData.caudal_lph),
        ano_plantacion: parseInt(formData.ano_plantacion) || null,
        marco_plantacion: formData.marco_plantacion
      }

      if (idSector) {
        await supabase.from('sectores').update(payload).eq('id', idSector)
      } else {
        await supabase.from('sectores').insert([payload])
      }

      alGuardar()
    } catch (error) {
      console.error(error)
      alert('Error al guardar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const styles = {
    form: { display: 'flex', flexDirection: 'column', gap: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '0.85rem', fontWeight: 'bold', color: '#374151' },
    input: { padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' },
    actions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' },
    btnCancel: { padding: '10px 15px', border: '1px solid #d1d5db', backgroundColor: 'white', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' },
    btnSave: { padding: '10px 15px', border: 'none', backgroundColor: '#1f2937', color: 'white', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      
      <div style={styles.formGroup}>
        <label style={styles.label}>Nombre del Sector</label>
        <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} style={styles.input} placeholder="Ej: Sector Norte" required />
      </div>

      <div style={{display:'flex', gap:'20px'}}>
        <div style={{...styles.formGroup, flex:1}}>
            <label style={styles.label}>Parcela</label>
            <select name="parcela_id" value={formData.parcela_id} onChange={handleChange} style={styles.input} required>
                <option value="">-- Seleccionar --</option>
                {parcelas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
        </div>
        <div style={{...styles.formGroup, flex:1}}>
            <label style={styles.label}>Variedad</label>
            <input type="text" name="variedad" value={formData.variedad} onChange={handleChange} style={styles.input} />
        </div>
      </div>

      <div style={{display:'flex', gap:'20px'}}>
         <div style={{...styles.formGroup, flex:1}}>
            <label style={styles.label}>Superficie (Ha)</label>
            <input type="number" step="0.01" name="superficie_ha" value={formData.superficie_ha} onChange={handleChange} style={styles.input} required />
         </div>
         <div style={{...styles.formGroup, flex:1}}>
            <label style={styles.label}>Cantidad Árboles</label>
            <input type="number" name="cantidad_arboles" value={formData.cantidad_arboles} onChange={handleChange} style={styles.input} required />
         </div>
      </div>

      <div style={{backgroundColor:'#eff6ff', padding:15, borderRadius:8, border:'1px solid #bfdbfe'}}>
         <div style={{fontSize:'0.8rem', fontWeight:'bold', color:'#1e40af', marginBottom:10}}>CONFIGURACIÓN RIEGO</div>
         <div style={{display:'flex', gap:'20px'}}>
            <div style={{...styles.formGroup, flex:1}}>
                <label style={styles.label}>Aspersores / Árbol</label>
                <input type="number" step="0.1" name="aspersores_por_planta" value={formData.aspersores_por_planta} onChange={handleChange} style={styles.input} placeholder="1" />
                <small style={{color:'#64748b'}}>Calcularemos el total autom.</small>
            </div>
            <div style={{...styles.formGroup, flex:1}}>
                <label style={styles.label}>Caudal (L/h)</label>
                <input type="number" step="0.1" name="caudal_lph" value={formData.caudal_lph} onChange={handleChange} style={styles.input} placeholder="Ej: 35" />
                <small style={{color:'#64748b'}}>Por emisor</small>
            </div>
         </div>
      </div>

      <div style={{display:'flex', gap:'20px'}}>
         <div style={{...styles.formGroup, flex:1}}>
            <label style={styles.label}>Año Plantación</label>
            <input type="number" name="ano_plantacion" value={formData.ano_plantacion} onChange={handleChange} style={styles.input} />
         </div>
         <div style={{...styles.formGroup, flex:1}}>
            <label style={styles.label}>Marco (ej: 6x4)</label>
            <input type="text" name="marco_plantacion" value={formData.marco_plantacion} onChange={handleChange} style={styles.input} />
         </div>
      </div>

      <div style={styles.actions}>
        <button type="button" onClick={() => cerrarModal()} style={styles.btnCancel}>
          <X size={20} /> Cancelar
        </button>
        <button type="submit" style={styles.btnSave} disabled={loading}>
          <Save size={20} /> {idSector ? 'Actualizar' : 'Crear Sector'}
        </button>
      </div>
    </form>
  )
}

export default NuevoSector