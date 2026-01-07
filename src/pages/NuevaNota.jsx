import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { 
    Save, Plus, Trash2, Calendar, CheckSquare, 
    AlertTriangle, Paperclip, X, FileText, Type 
} from 'lucide-react'

function NuevaNota({ notaEditar, cerrarModal, alGuardar }) {
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef(null)
  
  // --- ESTADOS DEL FORMULARIO ---
  const [formData, setFormData] = useState({
    titulo: '',
    contenido: '',
    tipo: 'Nota', // Nota, Incidente, Tarea, Hito
    importante: false,
    fecha_alerta: '',  
    estado: 'Pendiente'
  })

  // Checklist (Array de objetos { id, texto, hecho })
  const [checklistItems, setChecklistItems] = useState([]) 
  const [nuevoItemTexto, setNuevoItemTexto] = useState('')

  // Adjuntos (Array de URLs o Paths)
  const [adjuntos, setAdjuntos] = useState([]) 
  const [uploading, setUploading] = useState(false)

  // --- CARGA INICIAL (EDICIÓN) ---
  useEffect(() => {
    if (notaEditar) {
      setFormData({
        titulo: notaEditar.titulo || '',
        contenido: notaEditar.contenido || '',
        tipo: notaEditar.tipo || 'Nota',
        importante: notaEditar.importante || false,
        fecha_alerta: notaEditar.fecha_alerta ? notaEditar.fecha_alerta.split('T')[0] : '',
        estado: notaEditar.estado || 'Pendiente'
      })
      
      // FIX BUG CHECKLIST: Asegurar que cada item tenga ID único al cargar
      if (notaEditar.checklist && Array.isArray(notaEditar.checklist)) {
          const safeChecklist = notaEditar.checklist.map((item, idx) => ({
              ...item,
              id: item.id || Date.now() + idx // Si no tiene ID, generamos uno
          }))
          setChecklistItems(safeChecklist)
      }

      // Cargar Adjuntos
      if (notaEditar.adjuntos && Array.isArray(notaEditar.adjuntos)) {
          setAdjuntos(notaEditar.adjuntos)
      }
    }
  }, [notaEditar])

  // --- LÓGICA CHECKLIST ---
  const addChecklistItem = () => {
      if (!nuevoItemTexto.trim()) return
      const newItem = {
          id: Date.now(), // ID único basado en timestamp
          texto: nuevoItemTexto,
          hecho: false
      }
      setChecklistItems([...checklistItems, newItem])
      setNuevoItemTexto('')
  }

  const toggleCheck = (id) => {
      setChecklistItems(prev => prev.map(item => 
          item.id === id ? { ...item, hecho: !item.hecho } : item
      ))
  }

  const deleteChecklistItem = (id) => {
      setChecklistItems(prev => prev.filter(item => item.id !== id))
  }

  // --- LÓGICA ADJUNTOS (SUPABASE STORAGE) ---
  const handleFileUpload = async (e) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      setUploading(true)
      try {
          const newFiles = []
          for (const file of files) {
              const fileExt = file.name.split('.').pop()
              const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
              const filePath = `${fileName}`

              // Subir a bucket 'bitacora'
              const { data, error } = await supabase.storage
                  .from('bitacora')
                  .upload(filePath, file)

              if (error) throw error

              // Obtener URL pública
              const { data: publicUrlData } = supabase.storage
                  .from('bitacora')
                  .getPublicUrl(filePath)
              
              newFiles.push({
                  nombre: file.name,
                  url: publicUrlData.publicUrl,
                  path: filePath
              })
          }
          setAdjuntos([...adjuntos, ...newFiles])
      } catch (error) {
          alert("Error subiendo archivo: " + error.message + "\n(Asegúrate de crear el bucket 'bitacora' en Supabase)")
      } finally {
          setUploading(false)
      }
  }

  const removeAdjunto = (index) => {
      setAdjuntos(prev => prev.filter((_, i) => i !== index))
  }

  // --- GUARDAR ---
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
        const payload = {
            ...formData,
            checklist: checklistItems,
            adjuntos: adjuntos,
            // Si es nueva nota, ponemos fecha de hoy automáticamente
            fecha: notaEditar ? notaEditar.fecha : new Date().toISOString() 
        }

        if (notaEditar) {
            await supabase.from('bitacora').update(payload).eq('id', notaEditar.id)
        } else {
            await supabase.from('bitacora').insert([payload])
        }
        alGuardar()
    } catch (error) {
        alert("Error: " + error.message)
    } finally {
        setLoading(false)
    }
  }

  // --- ESTILOS (GRID LAYOUT) ---
  const styles = {
      layout: { display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '30px', alignItems: 'start' },
      colLeft: { display: 'flex', flexDirection: 'column', gap: '20px' },
      colRight: { backgroundColor: '#f9fafb', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', maxHeight:'70vh', overflowY:'auto' },
      label: { fontSize: '0.85rem', fontWeight: 'bold', color: '#374151', marginBottom: '5px', display:'flex', alignItems:'center', gap:6 },
      input: { padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', width: '100%', boxSizing: 'border-box' },
      textarea: { padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', width: '100%', boxSizing: 'border-box', minHeight: '100px', fontFamily: 'inherit' },
      
      // Checklist styles
      checkItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px', backgroundColor: 'white', borderBottom: '1px solid #f3f4f6' },
      
      // Adjuntos
      attachChip: { display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', backgroundColor:'#e5e7eb', borderRadius:'15px', fontSize:'0.8rem', marginRight:5, marginBottom:5 },
      
      footer: { marginTop: '25px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e5e7eb', paddingTop: '15px' },
      btnSave: { padding: '10px 24px', backgroundColor: '#111827', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }
  }

  return (
    <form onSubmit={handleSubmit}>
        <div style={styles.layout}>
            
            {/* COLUMNA IZQUIERDA: METADATA */}
            <div style={styles.colLeft}>
                <div>
                    <label style={styles.label}><Type size={14}/> Título</label>
                    <input type="text" value={formData.titulo} onChange={e => setFormData({...formData, titulo: e.target.value})} style={styles.input} placeholder="Ej: Falla en bomba sector 2" required autoFocus/>
                </div>

                <div style={{display:'flex', gap:15}}>
                    <div style={{flex:1}}>
                        <label style={styles.label}>Tipo</label>
                        <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} style={styles.input}>
                            <option>Nota</option>
                            <option>Incidente</option>
                            <option>Tarea</option>
                            <option>Hito</option>
                        </select>
                    </div>
                    <div style={{flex:1}}>
                         <label style={styles.label}>Estado</label>
                         <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})} style={styles.input}>
                            <option>Pendiente</option>
                            <option>En Proceso</option>
                            <option>Realizado</option>
                        </select>
                    </div>
                </div>

                <div style={{padding:'15px', backgroundColor: formData.importante ? '#fef2f2' : '#f3f4f6', borderRadius:'8px', border: formData.importante ? '1px solid #fecaca' : '1px solid #e5e7eb'}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                        <input type="checkbox" checked={formData.importante} onChange={e => setFormData({...formData, importante: e.target.checked})} id="chkImp" style={{width:16, height:16}}/>
                        <label htmlFor="chkImp" style={{fontWeight:'bold', color: formData.importante ? '#dc2626' : '#374151', cursor:'pointer', display:'flex', alignItems:'center', gap:5}}>
                            {formData.importante && <AlertTriangle size={16}/>}
                            Marcar como Importante
                        </label>
                    </div>
                </div>

                <div>
                    <label style={styles.label}><Calendar size={14}/> Fecha Alerta / Vencimiento</label>
                    <input type="date" value={formData.fecha_alerta} onChange={e => setFormData({...formData, fecha_alerta: e.target.value})} style={styles.input}/>
                </div>

                {/* ADJUNTOS */}
                <div>
                    <label style={styles.label}>
                        <Paperclip size={14}/> Archivos Adjuntos
                        <button type="button" onClick={() => fileInputRef.current.click()} style={{marginLeft:'auto', fontSize:'0.75rem', color:'#2563eb', background:'none', border:'none', cursor:'pointer', fontWeight:'bold'}}>
                            + Subir
                        </button>
                    </label>
                    <input type="file" multiple ref={fileInputRef} style={{display:'none'}} onChange={handleFileUpload} />
                    
                    <div style={{marginTop:5}}>
                        {uploading && <div style={{fontSize:'0.8rem', color:'#6b7280'}}>Subiendo...</div>}
                        {adjuntos.map((file, idx) => (
                            <div key={idx} style={styles.attachChip}>
                                <span style={{maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{file.nombre}</span>
                                <X size={12} style={{cursor:'pointer'}} onClick={() => removeAdjunto(idx)}/>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* COLUMNA DERECHA: CONTENIDO Y CHECKLIST */}
            <div style={styles.colRight}>
                <div style={{marginBottom:20}}>
                    <label style={styles.label}><FileText size={14}/> Detalle / Observación</label>
                    <textarea value={formData.contenido} onChange={e => setFormData({...formData, contenido: e.target.value})} style={styles.textarea} placeholder="Escribe aquí los detalles..." />
                </div>

                {/* CHECKLIST */}
                <div>
                    <label style={styles.label}><CheckSquare size={14}/> Tareas / Checklist</label>
                    <div style={{display:'flex', gap:5, marginBottom:10}}>
                        <input 
                            type="text" 
                            value={nuevoItemTexto} 
                            onChange={e => setNuevoItemTexto(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                            placeholder="Nueva tarea..." 
                            style={{...styles.input, fontSize:'0.9rem'}}
                        />
                        <button type="button" onClick={addChecklistItem} style={{backgroundColor:'#e5e7eb', border:'none', borderRadius:'6px', cursor:'pointer', padding:'0 12px'}}>
                            <Plus size={16}/>
                        </button>
                    </div>

                    <div style={{backgroundColor:'white', borderRadius:'8px', border:'1px solid #e5e7eb', overflow:'hidden'}}>
                        {checklistItems.length === 0 && <div style={{padding:15, color:'#9ca3af', fontSize:'0.85rem', textAlign:'center'}}>Sin tareas</div>}
                        
                        {checklistItems.map(item => (
                            <div key={item.id} style={styles.checkItem}>
                                <input 
                                    type="checkbox" 
                                    checked={item.hecho} 
                                    onChange={() => toggleCheck(item.id)} // Usamos ID específico
                                    style={{width:16, height:16, cursor:'pointer'}}
                                />
                                <span style={{flex:1, fontSize:'0.9rem', textDecoration: item.hecho ? 'line-through' : 'none', color: item.hecho ? '#9ca3af' : '#374151'}}>
                                    {item.texto}
                                </span>
                                <Trash2 size={14} color="#ef4444" style={{cursor:'pointer'}} onClick={() => deleteChecklistItem(item.id)}/>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        <div style={styles.footer}>
             <button type="button" onClick={cerrarModal} style={{...styles.btnSave, backgroundColor: 'transparent', color: '#4b5563', border: '1px solid #d1d5db'}}>Cancelar</button>
             <button type="submit" style={styles.btnSave} disabled={loading}>
                <Save size={18}/> {loading ? 'Guardando...' : 'Guardar Nota'}
             </button>
        </div>
    </form>
  )
}

export default NuevaNota