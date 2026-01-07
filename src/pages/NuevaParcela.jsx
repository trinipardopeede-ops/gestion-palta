import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Save, X, MapPin } from 'lucide-react'

function NuevaParcela({ idParcela, cerrarModal, alGuardar }) {
  const [loading, setLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const [formData, setFormData] = useState({
    nombre: '',
    superficie_ha: ''
  })

  useEffect(() => {
    if (idParcela) {
      async function cargarParcela() {
        const { data } = await supabase.from('parcelas').select('*').eq('id', idParcela).single()
        if (data) {
          setFormData({
            nombre: data.nombre,
            superficie_ha: data.superficie_ha || ''
          })
        }
      }
      cargarParcela()
    }
  }, [idParcela])

  const handleChange = (e) => {
    setIsDirty(true)
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // Protección de cierre seguro
  useEffect(() => {
    window.intentarCerrarModal = () => {
        if (isDirty && window.confirm("⚠️ Tienes cambios sin guardar. ¿Deseas salir?")) {
            cerrarModal()
        } else if (!isDirty) {
            cerrarModal()
        }
    }
    return () => { window.intentarCerrarModal = null }
  }, [isDirty, cerrarModal])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const datosGuardar = {
      nombre: formData.nombre,
      superficie_ha: formData.superficie_ha
    }

    let error
    if (idParcela) {
      const { error: errUpdate } = await supabase.from('parcelas').update(datosGuardar).eq('id', idParcela)
      error = errUpdate
    } else {
      const { error: errInsert } = await supabase.from('parcelas').insert([datosGuardar])
      error = errInsert
    }

    setLoading(false)

    if (error) {
        alert('Error: ' + error.message)
    } else {
        setIsDirty(false)
        alGuardar()
    }
  }

  const styles = {
    container: { padding: '10px 20px', width: '100%', boxSizing: 'border-box' },
    formGroup: { marginBottom: '20px' },
    label: { display: 'block', marginBottom: '8px', color: '#4b5563', fontWeight: '500' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem', boxSizing:'border-box' },
    actions: { display: 'flex', gap: '10px', marginTop: '30px' },
    btnSave: { flex: 1, padding: '12px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '1rem' },
    btnCancel: { flex: 1, padding: '12px', backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '1rem' }
  }

  return (
    <div style={styles.container}>
        <form onSubmit={handleSubmit}>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Nombre de la Parcela <span style={{color:'red'}}>*</span></label>
            <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} style={styles.input} placeholder="Ej: Fundo El Retiro" required />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Superficie (Hectáreas)</label>
            <input type="number" step="0.1" name="superficie_ha" value={formData.superficie_ha} onChange={handleChange} style={styles.input} placeholder="Ej: 15.5" />
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={() => window.intentarCerrarModal ? window.intentarCerrarModal() : cerrarModal()} style={styles.btnCancel}>
              <X size={20} /> Cancelar
            </button>
            <button type="submit" style={styles.btnSave} disabled={loading}>
              <Save size={20} /> {idParcela ? 'Actualizar' : 'Guardar Parcela'}
            </button>
          </div>

        </form>
    </div>
  )
}

export default NuevaParcela
