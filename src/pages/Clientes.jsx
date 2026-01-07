import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Users, Plus, Pencil, Archive, Search, ArrowUpDown, Mail, Phone, MapPin, UserCheck } from 'lucide-react' // Usamos Archive en vez de Trash2
import Modal from '../components/Modal'
import NuevoCliente from './NuevoCliente'

function Clientes() {
  const [clientes, setClientes] = useState([])
  const [filtro, setFiltro] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'asc' })
  
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)

  useEffect(() => {
    cargarClientes()
  }, [])

  async function cargarClientes() {
    // FILTRO: Solo cargamos los activos
    const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('activo', true) 
        .order('nombre')
    setClientes(data || [])
  }

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
  }

  const sortedData = [...clientes].sort((a, b) => {
    let valA = (a[sortConfig.key] || '').toString().toLowerCase()
    let valB = (b[sortConfig.key] || '').toString().toLowerCase()
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  }).filter(c => 
    c.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
    (c.rut && c.rut.includes(filtro))
  )

  // CAMBIO: Borrado Lógico (Archivar)
  const archivar = async (id) => {
      if(confirm("¿Archivar este cliente? Se mantendrá el historial pero no aparecerá en listas nuevas.")) {
          const { error } = await supabase.from('clientes').update({ activo: false }).eq('id', id)
          if(error) alert('Error al archivar: ' + error.message)
          else cargarClientes()
      }
  }

  // Helper para mostrar resumen de contactos
  const RenderContactos = ({ contactos }) => {
      if (!contactos || contactos.length === 0) return <span style={{color:'#9ca3af', fontStyle:'italic', fontSize:'0.8rem'}}>Sin contactos</span>
      
      const principal = contactos[0]
      const extra = contactos.length - 1

      return (
          <div style={{display:'flex', flexDirection:'column', gap:2}}>
              <div style={{display:'flex', alignItems:'center', gap:4, fontWeight:'500', fontSize:'0.85rem'}}>
                 <UserCheck size={13} color="#4b5563"/> {principal.nombre}
              </div>
              <div style={{fontSize:'0.75rem', color:'#6b7280', paddingLeft:18}}>
                  {principal.cargo || 'Contacto'} 
                  {extra > 0 && <span style={{marginLeft:5, backgroundColor:'#e5e7eb', padding:'0 4px', borderRadius:4, fontSize:'0.7rem'}}>+{extra} más</span>}
              </div>
          </div>
      )
  }

  // Estilos
  const styles = {
    container: { padding: '20px', width: '90%', margin: '0 auto', maxWidth: '1200px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    title: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' },
    search: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', width: '250px' },
    btnNew: { backgroundColor: '#1f2937', color: 'white', padding: '10px 15px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center' },
    
    tableContainer: { backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { backgroundColor: '#f9fafb', padding: '12px', textAlign: 'left', fontSize: '0.85rem', color: '#6b7280', fontWeight: '600', cursor: 'pointer', borderBottom:'1px solid #e5e7eb' },
    td: { padding: '12px', borderBottom: '1px solid #f9fafb', fontSize: '0.9rem', color: '#374151' },
    
    chip: { display:'inline-flex', alignItems:'center', gap:5, padding:'2px 8px', borderRadius:'12px', backgroundColor:'#f3f4f6', color:'#4b5563', fontSize:'0.8rem', marginRight:5 }
  }

  const ThSort = ({ label, sortKey }) => (
    <th style={styles.th} onClick={() => handleSort(sortKey)}>
        <div style={{display:'flex', alignItems:'center', gap:5}}>
            {label} {sortConfig.key === sortKey && <ArrowUpDown size={14}/>}
        </div>
    </th>
  )

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}><Users /> Clientes</h1>
        <div style={{display:'flex', gap:10}}>
            <div style={{position:'relative'}}>
                <Search size={16} style={{position:'absolute', left:10, top:10, color:'#9ca3af'}}/>
                <input type="text" placeholder="Buscar..." value={filtro} onChange={e => setFiltro(e.target.value)} style={{...styles.search, paddingLeft:35}} />
            </div>
            <button onClick={() => { setEditId(null); setModalOpen(true) }} style={styles.btnNew}><Plus size={18}/> Nuevo</button>
        </div>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
            <thead>
                <tr>
                    <ThSort label="Empresa / Razón Social" sortKey="nombre" />
                    <ThSort label="RUT" sortKey="rut" />
                    <th style={styles.th}>Contactos Clave</th>
                    <ThSort label="Ubicación" sortKey="direccion" />
                    <th style={styles.th}></th>
                </tr>
            </thead>
            <tbody>
                {sortedData.map(c => (
                    <tr key={c.id}>
                        <td style={styles.td}>
                            <strong>{c.nombre}</strong>
                            <div style={{fontSize:'0.8rem', color:'#6b7280'}}>{c.tipo}</div>
                        </td>
                        <td style={styles.td}>{c.rut || '-'}</td>
                        <td style={styles.td}>
                           {/* Renderizamos los contactos guardados en JSON */}
                           <RenderContactos contactos={c.contactos} />
                           {/* Si hay contacto general (legacy), lo mostramos si no hay contactos específicos */}
                           {(!c.contactos || c.contactos.length === 0) && c.email && 
                              <div style={{marginTop:4}}><span style={styles.chip}><Mail size={10}/> {c.email}</span></div>
                           }
                        </td>
                        <td style={styles.td}>
                            {c.direccion && <span style={{display:'flex', alignItems:'center', gap:4, color:'#6b7280'}}><MapPin size={14}/> {c.direccion}</span>}
                        </td>
                        <td style={styles.td}>
                            <div style={{display:'flex', gap:5, justifyContent:'flex-end'}}>
                                <button onClick={() => { setEditId(c.id); setModalOpen(true) }} style={{border:'none', background:'none', color:'#2563eb', cursor:'pointer'}}><Pencil size={16}/></button>
                                <button onClick={() => archivar(c.id)} style={{border:'none', background:'none', color:'#d97706', cursor:'pointer'}} title="Archivar"><Archive size={16}/></button>
                            </div>
                        </td>
                    </tr>
                ))}
                {sortedData.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', padding:30, color:'#9ca3af'}}>No se encontraron clientes activos.</td></tr>}
            </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? "Editar Cliente" : "Nuevo Cliente"}>
        {modalOpen && <NuevoCliente idCliente={editId} cerrarModal={() => setModalOpen(false)} alGuardar={() => { setModalOpen(false); cargarClientes(); }} />}
      </Modal>
    </div>
  )
}

export default Clientes