import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Save, Plus, Trash2, Calendar, CheckSquare, X, Clock, Paperclip } from 'lucide-react'

function NuevaNota({ notaEditar, cerrarModal, alGuardar }) {
  const [loading, setLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const fileInputRef = useRef(null)
  
  const [formData, setFormData] = useState({
    titulo: '', contenido: '', tipo: 'Nota', importante: false, fecha: new Date().toISOString().split('T')[0]
  })

  const [checklistItems, setChecklistItems] = useState([]) 
  const [nuevoItem, setNuevoItem] = useState({ texto: '', fecha: '' })
  const [adjuntos, setAdjuntos] = useState([]) 
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (notaEditar) {
      setFormData({
        titulo: notaEditar.titulo || '',
        contenido: notaEditar.contenido || '',
        tipo: notaEditar.tipo || 'Nota',
        importante: notaEditar.importante || false,
        fecha: notaEditar.fecha || new Date().toISOString().split('T')[0]
      })
      setChecklistItems(notaEditar.checklist || [])
      setAdjuntos(notaEditar.adjuntos || [])
    }
  }, [notaEditar])

  const addChecklistItem = () => {
      if (!nuevoItem.texto.trim()) return
      setChecklistItems([...checklistItems, { 
          id: Date.now(), 
          texto: nuevoItem.texto, 
          fecha_vencimiento: nuevoItem.fecha, 
          hecho: false 
      }])
      setNuevoItem({ texto: '', fecha: '' })
      setHasChanges(true)
  }

  // FUNCIÓN REESTABLECIDA 
  const deleteChecklistItem = (id) => {
      setChecklistItems(prev => prev.filter(item => item.id !== id))
      setHasChanges(true)
  }

  const handleFileUpload = async (e) => {
      const files = e.target.files
      if (!files || files.length === 0) return
      setUploading(true)
      
      try {
          for (const file of files) {
              const fileExt = file.name.split('.').pop()
              const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
              
              const { error: uploadError } = await supabase.storage
                  .from('bitacora')
                  .upload(fileName, file)

              if (uploadError) throw uploadError

              const { data: { publicUrl } } = supabase.storage.from('bitacora').getPublicUrl(fileName)
              setAdjuntos(prev => [...prev, { nombre: file.name, url: publicUrl, path: fileName }])
          }
          setHasChanges(true)
      } catch (error) {
          alert("Error: Asegúrate de que el bucket 'bitacora' exista en Supabase Storage y sea Público.")
          console.error(error)
      } finally {
          setUploading(false)
      }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
        const payload = { ...formData, checklist: checklistItems, adjuntos: adjuntos, activo: true }
        if (notaEditar) await supabase.from('bitacora').update(payload).eq('id', notaEditar.id)
        else await supabase.from('bitacora').insert([payload])
        alGuardar()
    } catch (error) { alert(error.message) } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
        <div>
            <label style={{fontWeight:'bold', fontSize:'0.85rem'}}>Título</label>
            <input type="text" value={formData.titulo} onChange={e => {setFormData({...formData, titulo: e.target.value}); setHasChanges(true)}} style={{width:'100%', padding:10, borderRadius:8, border:'1px solid #ddd', marginTop:5}} required/>
            
            <label style={{fontWeight:'bold', fontSize:'0.85rem', display:'block', marginTop:15}}>Contenido</label>
            <textarea value={formData.contenido} onChange={e => {setFormData({...formData, contenido: e.target.value}); setHasChanges(true)}} style={{width:'100%', padding:10, borderRadius:8, border:'1px solid #ddd', minHeight:150, marginTop:5}}/>
            
            <div style={{marginTop:15, padding:12, backgroundColor:'#f3f4f6', borderRadius:8}}>
                <button type="button" onClick={() => fileInputRef.current.click()} style={{width:'100%', padding:8, border:'1px dashed #9ca3af', borderRadius:6, cursor:'pointer', backgroundColor:'white'}}>
                    {uploading ? "Subiendo..." : "+ Adjuntar Archivos"}
                </button>
                <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} style={{display:'none'}}/>
                <div style={{marginTop:10, display:'flex', flexWrap:'wrap', gap:5}}>
                    {adjuntos.map((f, i) => (
                        <span key={i} style={{fontSize:'0.7rem', backgroundColor:'#e5e7eb', padding:'4px 8px', borderRadius:10, display:'flex', alignItems:'center', gap:5}}>
                            {f.nombre} <X size={12} onClick={() => setAdjuntos(adjuntos.filter((_, idx) => idx !== i))} style={{cursor:'pointer'}}/>
                        </span>
                    ))}
                </div>
            </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', borderLeft:'1px solid #eee', paddingLeft:20}}>
            <label style={{fontWeight:'bold', fontSize:'0.85rem', color:'#111827'}}>TAREAS CON VENCIMIENTO</label>
            <div style={{marginTop:10, display:'flex', flexDirection:'column', gap:5}}>
                <input type="text" placeholder="¿Qué hacer?" value={nuevoItem.texto} onChange={e => setNuevoItem({...nuevoItem, texto: e.target.value})} style={{padding:8, borderRadius:6, border:'1px solid #ddd'}}/>
                <div style={{display:'flex', gap:5}}>
                    <input type="date" value={nuevoItem.fecha} onChange={e => setNuevoItem({...nuevoItem, fecha: e.target.value})} style={{flex:1, padding:8, borderRadius:6, border:'1px solid #ddd'}}/>
                    <button type="button" onClick={addChecklistItem} style={{padding:'0 15px', backgroundColor:'#111827', color:'white', border:'none', borderRadius:6}}><Plus size={18}/></button>
                </div>
            </div>

            <div style={{marginTop:15, maxHeight:250, overflowY:'auto'}}>
                {checklistItems.map(item => (
                    <div key={item.id} style={{display:'flex', justifyContent:'space-between', padding:'10px', backgroundColor:'white', border:'1px solid #f3f4f6', borderRadius:8, marginBottom:5}}>
                        <div>
                            <div style={{fontSize:'0.9rem', fontWeight:'bold'}}>{item.texto}</div>
                            {item.fecha_vencimiento && <div style={{fontSize:'0.75rem', color:'#d97706'}}><Clock size={10} style={{display:'inline'}}/> {item.fecha_vencimiento}</div>}
                        </div>
                        <Trash2 size={16} color="#ef4444" onClick={() => deleteChecklistItem(item.id)} style={{cursor:'pointer'}}/>
                    </div>
                ))}
            </div>

            <div style={{marginTop:'auto', display:'flex', gap:10, paddingTop:20}}>
                <button type="button" onClick={() => hasChanges ? confirm("¿Cerrar sin guardar?") && cerrarModal() : cerrarModal()} style={{flex:1, padding:12, borderRadius:8, border:'1px solid #ddd', cursor:'pointer'}}>Cancelar</button>
                <button type="submit" disabled={loading} style={{flex:2, padding:12, borderRadius:8, border:'none', backgroundColor:'#111827', color:'white', fontWeight:'bold', cursor:'pointer'}}>
                    <Save size={18} style={{display:'inline', marginRight:8}}/> Guardar Nota
                </button>
            </div>
        </div>
    </form>
  )
}

export default NuevaNota