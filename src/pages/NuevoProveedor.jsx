import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Save, X, Trash2, Plus, User } from 'lucide-react'

function NuevoProveedor({ idProveedor, cerrarModal, alGuardar }) {
  const [loading, setLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const [formData, setFormData] = useState({
    nombre: '',
    rut: '',
    telefono: '',
    email: '',
    contactos: [] // Array JSON
  })

  useEffect(() => {
    if (idProveedor) {
      async function cargar() {
        const { data } = await supabase.from('proveedores').select('*').eq('id', idProveedor).single()
        if (data) setFormData({ 
            nombre: data.nombre, 
            rut: data.rut || '', 
            telefono: data.telefono || '', 
            email: data.email || '',
            contactos: data.contactos || [] 
        })
      }
      cargar()
    }
  }, [idProveedor])

  const handleChange = (e) => {
      setIsDirty(true)
      setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // Lógica de Contactos
  const agregarContacto = () => {
    setIsDirty(true)
    setFormData({
        ...formData,
        contactos: [...formData.contactos, { nombre: '', cargo: '', email: '', telefono: '' }]
    })
  }

  const eliminarContacto = (index) => {
    setIsDirty(true)
    const nuevos = [...formData.contactos]
    nuevos.splice(index, 1)
    setFormData({ ...formData, contactos: nuevos })
  }

  const changeContacto = (index, field, value) => {
    setIsDirty(true)
    const nuevos = [...formData.contactos]
    nuevos[index][field] = value
    setFormData({ ...formData, contactos: nuevos })
  }

  // Protección de cierre
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
    const payload = { ...formData }
    
    let error
    if (idProveedor) {
      const { error: err } = await supabase.from('proveedores').update(payload).eq('id', idProveedor)
      error = err
    } else {
      const { error: err } = await supabase.from('proveedores').insert([payload])
      error = err
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
    
    contactSection: { backgroundColor: '#f9fafb', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb', marginTop: '20px' },
    contactRow: { display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'flex-start' },
    contactInput: { flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.85rem' },
    btnRemove: { padding: '8px', backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' },
    btnAdd: { padding: '8px 12px', backgroundColor: 'white', border: '1px dashed #9ca3af', borderRadius: '6px', color: '#4b5563', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5, width: '100%', justifyContent: 'center' },

    actions: { display: 'flex', gap: '10px', marginTop: '30px' },
    btnSave: { flex: 1, padding: '12px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '1rem' },
    btnCancel: { flex: 1, padding: '12px', backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '1rem' }
  }

  return (
    <div style={styles.container}>
        <form onSubmit={handleSubmit}>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Nombre Fantasía / Razón Social <span style={{color:'red'}}>*</span></label>
            <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} style={styles.input} placeholder="Ej: Ferretería El Agro" required />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>RUT</label>
            <input type="text" name="rut" value={formData.rut} onChange={handleChange} style={styles.input} placeholder="76.xxx.xxx-x" />
          </div>
          
          <div style={{display:'flex', gap:'20px'}}>
             <div style={{...styles.formGroup, flex:1}}>
                <label style={styles.label}>Teléfono Central</label>
                <input type="text" name="telefono" value={formData.telefono} onChange={handleChange} style={styles.input} />
             </div>
             <div style={{...styles.formGroup, flex:1}}>
                <label style={styles.label}>Email Central</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} style={styles.input} />
             </div>
          </div>

          {/* CONTACTOS */}
          <div style={styles.contactSection}>
             <label style={{...styles.label, marginBottom:10, display:'flex', alignItems:'center', gap:5}}>
                <User size={16}/> Vendedores / Contactos
             </label>
             
             {formData.contactos.map((c, index) => (
                 <div key={index} style={styles.contactRow}>
                    <div style={{flex:2}}>
                        <input type="text" placeholder="Nombre" value={c.nombre} onChange={(e) => changeContacto(index, 'nombre', e.target.value)} style={styles.contactInput} required />
                        <input type="text" placeholder="Cargo / Área" value={c.cargo} onChange={(e) => changeContacto(index, 'cargo', e.target.value)} style={{...styles.contactInput, marginTop:5, fontSize:'0.75rem', color:'#6b7280'}} />
                    </div>
                    <div style={{flex:2}}>
                        <input type="email" placeholder="Email" value={c.email} onChange={(e) => changeContacto(index, 'email', e.target.value)} style={styles.contactInput} />
                        <input type="text" placeholder="Teléfono" value={c.telefono} onChange={(e) => changeContacto(index, 'telefono', e.target.value)} style={{...styles.contactInput, marginTop:5}} />
                    </div>
                    <button type="button" onClick={() => eliminarContacto(index)} style={styles.btnRemove}>
                        <Trash2 size={16} />
                    </button>
                 </div>
             ))}

             <button type="button" onClick={agregarContacto} style={styles.btnAdd}>
                 <Plus size={16}/> Agregar Contacto
             </button>
          </div>
          
          <div style={styles.actions}>
            <button type="button" onClick={() => window.intentarCerrarModal ? window.intentarCerrarModal() : cerrarModal()} style={styles.btnCancel}>
                <X size={20} /> Cancelar
            </button>
            <button type="submit" style={styles.btnSave} disabled={loading}>
                <Save size={20} /> {idProveedor ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
    </div>
  )
}
export default NuevoProveedor