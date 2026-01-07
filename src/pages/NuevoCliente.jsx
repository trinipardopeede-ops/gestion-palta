import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Save, X, Trash2, Plus, User } from 'lucide-react'

function NuevoCliente({ idCliente, cerrarModal, alGuardar }) {
  
  const [loading, setLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false) 

  const [formData, setFormData] = useState({
    nombre: '',
    rut: '',
    telefono: '', // Telefono general empresa
    email: '',    // Email general empresa
    direccion: '',
    tipo: 'Exportadora',
    contactos: [] // ARRAY DE OBJETOS: { nombre, cargo, email, telefono }
  })

  useEffect(() => {
    if (idCliente) {
      async function cargarCliente() {
        const { data } = await supabase.from('clientes').select('*').eq('id', idCliente).single()
        if (data) {
          setFormData({
            nombre: data.nombre,
            rut: data.rut || '',
            telefono: data.telefono || '',
            email: data.email || '',
            direccion: data.direccion || '',
            tipo: data.tipo || 'Exportadora',
            contactos: data.contactos || [] // Cargamos el JSON
          })
        }
      }
      cargarCliente()
    }
  }, [idCliente])

  const handleChange = (e) => {
    setIsDirty(true)
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // MANEJO DE CONTACTOS DINÁMICOS
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

    const datosGuardar = { ...formData }

    let error
    if (idCliente) {
      const { error: errUpdate } = await supabase.from('clientes').update(datosGuardar).eq('id', idCliente)
      error = errUpdate
    } else {
      const { error: errInsert } = await supabase.from('clientes').insert([datosGuardar])
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
    formGroup: { marginBottom: '15px' },
    label: { display: 'block', marginBottom: '5px', color: '#4b5563', fontWeight: 'bold', fontSize: '0.85rem' },
    input: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing:'border-box' },
    select: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', backgroundColor: 'white', boxSizing:'border-box' },
    
    // Estilos para sección contactos
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
            <label style={styles.label}>Nombre Empresa / Razón Social <span style={{color:'red'}}>*</span></label>
            <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} style={styles.input} placeholder="Ej: Exportadora del Sur SpA" required />
          </div>

          <div style={{display: 'flex', gap: '15px'}}>
             <div style={{...styles.formGroup, flex: 1}}>
                <label style={styles.label}>RUT</label>
                <input type="text" name="rut" value={formData.rut} onChange={handleChange} style={styles.input} placeholder="76.xxx.xxx-x" />
             </div>
             <div style={{...styles.formGroup, flex: 1}}>
                <label style={styles.label}>Tipo</label>
                <select name="tipo" value={formData.tipo} onChange={handleChange} style={styles.select}>
                   <option value="Exportadora">Exportadora</option>
                   <option value="Mercado Interno">Mercado Interno</option>
                   <option value="Intermediario">Intermediario</option>
                   <option value="Particular">Particular</option>
                </select>
             </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Dirección Comercial</label>
            <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} style={styles.input} placeholder="Av. Principal 123, Quillota" />
          </div>

          {/* SECCIÓN CONTACTOS */}
          <div style={styles.contactSection}>
             <label style={{...styles.label, marginBottom:10, display:'flex', alignItems:'center', gap:5}}>
                <User size={16}/> Contactos / Trabajadores Asociados
             </label>
             
             {formData.contactos.map((c, index) => (
                 <div key={index} style={styles.contactRow}>
                    <div style={{flex:2}}>
                        <input type="text" placeholder="Nombre" value={c.nombre} onChange={(e) => changeContacto(index, 'nombre', e.target.value)} style={styles.contactInput} required />
                        <input type="text" placeholder="Cargo (ej: Agrónomo)" value={c.cargo} onChange={(e) => changeContacto(index, 'cargo', e.target.value)} style={{...styles.contactInput, marginTop:5, fontSize:'0.75rem', color:'#6b7280'}} />
                    </div>
                    <div style={{flex:2}}>
                        <input type="email" placeholder="Email" value={c.email} onChange={(e) => changeContacto(index, 'email', e.target.value)} style={styles.contactInput} />
                        <input type="text" placeholder="Teléfono" value={c.telefono} onChange={(e) => changeContacto(index, 'telefono', e.target.value)} style={{...styles.contactInput, marginTop:5}} />
                    </div>
                    <button type="button" onClick={() => eliminarContacto(index)} style={styles.btnRemove} title="Quitar contacto">
                        <Trash2 size={16} />
                    </button>
                 </div>
             ))}

             <button type="button" onClick={agregarContacto} style={styles.btnAdd}>
                 <Plus size={16}/> Agregar Persona
             </button>
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={() => window.intentarCerrarModal ? window.intentarCerrarModal() : cerrarModal()} style={styles.btnCancel}>
              <X size={20} /> Cancelar
            </button>
            <button type="submit" style={styles.btnSave} disabled={loading}>
              <Save size={20} /> {idCliente ? 'Actualizar' : 'Guardar Cliente'}
            </button>
          </div>

        </form>
    </div>
  )
}

export default NuevoCliente