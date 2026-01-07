import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Tags, Plus, Trash2, ChevronRight, FolderOpen } from 'lucide-react'

function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [subcategorias, setSubcategorias] = useState([])
  const [catSeleccionada, setCatSeleccionada] = useState(null)
  
  // Inputs
  const [nuevaCat, setNuevaCat] = useState('')
  const [nuevaSub, setNuevaSub] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const { data: cats } = await supabase.from('categorias_gastos').select('*').order('nombre')
    const { data: subs } = await supabase.from('subcategorias_gastos').select('*').order('nombre')
    setCategorias(cats || [])
    setSubcategorias(subs || [])
  }

  // --- ACCIONES CATEGORIAS ---
  const crearCategoria = async (e) => {
      e.preventDefault()
      if (!nuevaCat.trim()) return
      const { error } = await supabase.from('categorias_gastos').insert([{ nombre: nuevaCat }])
      if (!error) {
          setNuevaCat('')
          cargarDatos()
      }
  }

  const eliminarCategoria = async (id) => {
      if(confirm("¿Eliminar categoría y sus subcategorías?")) {
          await supabase.from('categorias_gastos').delete().eq('id', id)
          if(catSeleccionada?.id === id) setCatSeleccionada(null)
          cargarDatos()
      }
  }

  // --- ACCIONES SUBCATEGORIAS ---
  const crearSubcategoria = async (e) => {
      e.preventDefault()
      if (!nuevaSub.trim() || !catSeleccionada) return
      const { error } = await supabase.from('subcategorias_gastos').insert([{ 
          nombre: nuevaSub, 
          categoria_id: catSeleccionada.id 
      }])
      if (!error) {
          setNuevaSub('')
          cargarDatos()
      }
  }

  const eliminarSub = async (id) => {
      if(confirm("¿Eliminar subcategoría?")) {
          await supabase.from('subcategorias_gastos').delete().eq('id', id)
          cargarDatos()
      }
  }

  // Filtrar subs para la vista
  const subsVisibles = catSeleccionada 
      ? subcategorias.filter(s => s.categoria_id === catSeleccionada.id)
      : []

  const styles = {
    container: { padding: '20px', width: '90%', margin: '0 auto', maxWidth: '1000px' },
    title: { fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', display:'flex', alignItems:'center', gap:10, marginBottom:30 },
    
    layout: { display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap:'wrap' },
    
    // Panel Izq (Categorias)
    panel: { flex: 1, backgroundColor: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', minWidth:'300px' },
    panelHeader: { fontSize:'1rem', fontWeight:'bold', marginBottom:15, borderBottom:'1px solid #f3f4f6', paddingBottom:10, color:'#374151' },
    
    list: { listStyle: 'none', padding: 0, margin: 0 },
    itemCat: (active) => ({
        padding: '10px 12px', cursor: 'pointer', borderRadius: '8px', marginBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: active ? '#eff6ff' : 'transparent',
        color: active ? '#2563eb' : '#4b5563',
        fontWeight: active ? '600' : 'normal',
        border: active ? '1px solid #dbeafe' : '1px solid transparent'
    }),
    
    itemSub: { padding: '8px 12px', borderBottom: '1px dashed #f3f4f6', display: 'flex', justifyContent: 'space-between', color:'#4b5563', fontSize:'0.9rem' },

    inputGroup: { display: 'flex', gap: 5, marginTop: 15 },
    input: { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' },
    btnAdd: { backgroundColor: '#1f2937', color: 'white', border: 'none', borderRadius: '6px', padding: '0 12px', cursor: 'pointer' },
    btnDel: { border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.6 }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}><Tags /> Categorías de Gastos</h1>

      <div style={styles.layout}>
          
          {/* PANEL CATEGORÍAS */}
          <div style={styles.panel}>
              <div style={styles.panelHeader}>1. Categorías Principales</div>
              <ul style={styles.list}>
                  {categorias.map(c => (
                      <li key={c.id} style={styles.itemCat(catSeleccionada?.id === c.id)} onClick={() => setCatSeleccionada(c)}>
                          <span>{c.nombre}</span>
                          <div style={{display:'flex', alignItems:'center', gap:5}}>
                              <button onClick={(e) => { e.stopPropagation(); eliminarCategoria(c.id); }} style={styles.btnDel}><Trash2 size={16}/></button>
                              <ChevronRight size={16} style={{opacity: catSeleccionada?.id===c.id ? 1 : 0.3}}/>
                          </div>
                      </li>
                  ))}
              </ul>
              <form onSubmit={crearCategoria} style={styles.inputGroup}>
                  <input type="text" placeholder="Nueva categoría..." value={nuevaCat} onChange={e => setNuevaCat(e.target.value)} style={styles.input} />
                  <button type="submit" style={styles.btnAdd}><Plus size={18}/></button>
              </form>
          </div>

          {/* PANEL SUBCATEGORÍAS */}
          <div style={{...styles.panel, backgroundColor: catSeleccionada ? 'white' : '#f9fafb'}}>
              <div style={styles.panelHeader}>
                  {catSeleccionada ? `2. Subcategorías de "${catSeleccionada.nombre}"` : "2. Selecciona una categoría"}
              </div>
              
              {catSeleccionada ? (
                  <>
                      <ul style={styles.list}>
                          {subsVisibles.map(s => (
                              <li key={s.id} style={styles.itemSub}>
                                  <span>{s.nombre}</span>
                                  <button onClick={() => eliminarSub(s.id)} style={styles.btnDel}><Trash2 size={16}/></button>
                              </li>
                          ))}
                          {subsVisibles.length === 0 && <div style={{fontStyle:'italic', color:'#9ca3af', padding:10}}>Sin subcategorías.</div>}
                      </ul>
                      <form onSubmit={crearSubcategoria} style={styles.inputGroup}>
                          <input type="text" placeholder="Nueva subcategoría..." value={nuevaSub} onChange={e => setNuevaSub(e.target.value)} style={styles.input} />
                          <button type="submit" style={styles.btnAdd}><Plus size={18}/></button>
                      </form>
                  </>
              ) : (
                  <div style={{textAlign:'center', padding:40, color:'#9ca3af'}}>
                      <FolderOpen size={40} style={{opacity:0.2, marginBottom:10}}/>
                      <div>Selecciona una categoría de la izquierda para ver y editar sus subcategorías.</div>
                  </div>
              )}
          </div>

      </div>
    </div>
  )
}

export default Categorias