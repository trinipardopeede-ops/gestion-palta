import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Save, DollarSign, Calendar, User, Tag, FileText } from 'lucide-react'

// Componente interno para Input con formato de moneda CL
const SmartInput = ({ value, onChange, onKeyDown, index, autoFocus, label }) => {
  const [displayValue, setDisplayValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (value) setDisplayValue(`$ ${parseInt(value).toLocaleString('es-CL')}`)
    else setDisplayValue('')
  }, [value])

  const handleFocus = () => {
    setIsFocused(true)
    setDisplayValue(value ? value.toString() : '')
  }

  const handleBlur = () => {
    setIsFocused(false)
    if (value) setDisplayValue(`$ ${parseInt(value).toLocaleString('es-CL')}`)
  }

  const handleChange = (e) => {
    const cleanVal = e.target.value.replace(/\D/g, '')
    setDisplayValue(cleanVal)
    onChange(cleanVal)
  }

  return (
    <div style={{
        position: 'relative', 
        border: isFocused ? '2px solid #2563eb' : '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: isFocused ? '#eff6ff' : 'white',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'row', // CAMBIO: Label a la izquierda, Input a la derecha
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 15px'
    }}>
        <label style={{
            fontSize: '0.85rem', 
            fontWeight: 'bold', 
            color: isFocused ? '#1e40af' : '#4b5563',
            textTransform: 'capitalize',
            flex: 1
        }}>
            {label}
        </label>
        <input
            type="text"
            className="price-input"
            data-index={index}
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={onKeyDown}
            placeholder="$ 0"
            autoFocus={autoFocus}
            style={{
                width: '120px', 
                border: 'none', 
                background: 'transparent',
                textAlign: 'right', 
                fontWeight: '800',
                fontSize: '1.1rem',
                color: '#111827', 
                outline: 'none',
                padding: 0
            }}
        />
    </div>
  )
}

const CALIBRES_STD = ["Extra", "Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Descarte", "Barrido"]

function NuevaOferta({ idOferta, cerrarModal, alGuardar }) {
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState([])
  
  const [formData, setFormData] = useState({
    cliente_id: '',
    nombre: '',
    fecha: new Date().toISOString().split('T')[0],
    activa: true
  })

  const [preciosMap, setPreciosMap] = useState({})
  
  useEffect(() => {
    async function load() {
        const { data } = await supabase.from('clientes').select('id, nombre').order('nombre')
        setClientes(data || [])

        const inicial = {}
        CALIBRES_STD.forEach(c => inicial[c] = '')
        setPreciosMap(inicial)

        if (idOferta) {
            const { data: of } = await supabase.from('ofertas_comerciales').select('*').eq('id', idOferta).single()
            if (of) {
                setFormData({
                    cliente_id: of.cliente_id || '',
                    nombre: of.nombre || '',
                    fecha: of.fecha,
                    activa: of.activa
                })
                if (of.precios_json && Array.isArray(of.precios_json)) {
                    const mapaBD = { ...inicial }
                    of.precios_json.forEach(item => mapaBD[item.calibre] = item.precio)
                    setPreciosMap(mapaBD)
                }
            }
        }
    }
    load()
  }, [idOferta])

  // Lógica de Navegación por Flechas (ACTUALIZADA PARA 1 COLUMNA)
  const handleGridKeyDown = (e, index) => {
    const totalInputs = CALIBRES_STD.length
    let nextIndex = null

    // Ahora solo nos movemos +1 o -1
    if (e.key === 'ArrowDown' || e.key === 'Enter') nextIndex = index + 1
    if (e.key === 'ArrowUp') nextIndex = index - 1
    
    // Evitamos que Enter envíe el formulario si estamos navegando
    if (e.key === 'Enter') e.preventDefault()

    if (nextIndex !== null && nextIndex >= 0 && nextIndex < totalInputs) {
      // Buscar el input por data-index en el DOM para enfocarlo
      const nextInput = document.querySelector(`.price-input[data-index="${nextIndex}"]`)
      if (nextInput) nextInput.focus()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
        const preciosArray = Object.entries(preciosMap)
            .filter(([_, precio]) => precio !== '' && precio !== null)
            .map(([calibre, precio]) => ({ calibre, precio: parseInt(precio) || 0 }))

        const payload = { ...formData, precios_json: preciosArray }

        if (idOferta) await supabase.from('ofertas_comerciales').update(payload).eq('id', idOferta)
        else await supabase.from('ofertas_comerciales').insert([payload])

        alGuardar()
    } catch (err) {
        alert("Error: " + err.message)
    } finally {
        setLoading(false)
    }
  }

  const styles = {
    layout: {
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr', // Columna derecha un poco más ancha para la lista vertical
        gap: '25px',
        alignItems: 'flex-start',
        minHeight: '400px'
    },
    colLeft: { 
        flex: '1', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px',
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        height: '100%'
    },
    colRight: { 
        flex: '1.5', 
        backgroundColor: '#f8fafc', 
        padding: '20px', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0',
        height: '100%'
    },
    
    sectionTitle: { fontSize: '0.9rem', fontWeight: 'bold', color: '#334155', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' },
    
    label: { fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '5px', display: 'block' },
    input: { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box', outline: 'none' },
    
    switchBox: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px', backgroundColor: formData.activa ? '#f0fdf4' : '#fef2f2',
        borderRadius: '8px', border: formData.activa ? '1px solid #bbf7d0' : '1px solid #fecaca',
        marginTop: 'auto'
    },
    switchLabel: { fontWeight: 'bold', color: formData.activa ? '#166534' : '#991b1b', fontSize: '0.9rem' },

    // Grid Precios (AHORA 1 COLUMNA)
    pricesGrid: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },

    footer: { marginTop: '25px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '20px' },
    btnCancel: { padding: '10px 20px', backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' },
    btnSave: { padding: '10px 24px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={styles.layout}>
        
        {/* COLUMNA IZQUIERDA: CONFIGURACIÓN */}
        <div style={styles.colLeft}>
            <div>
                <div style={styles.sectionTitle}><FileText size={18}/> Datos Generales</div>
                
                <div style={{marginBottom: '15px'}}>
                    <label style={styles.label}>Cliente</label>
                    <div style={{position: 'relative'}}>
                        <User size={16} color="#94a3b8" style={{position: 'absolute', left: 10, top: 12}}/>
                        <select 
                            value={formData.cliente_id} 
                            onChange={e => setFormData({...formData, cliente_id: e.target.value})} 
                            style={{...styles.input, paddingLeft: '35px', backgroundColor: 'white'}} 
                            required 
                            autoFocus
                        >
                            <option value="">-- Seleccionar Cliente --</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{marginBottom: '15px'}}>
                    <label style={styles.label}>Fecha Vigencia</label>
                    <div style={{position: 'relative'}}>
                        <Calendar size={16} color="#94a3b8" style={{position: 'absolute', left: 10, top: 12}}/>
                        <input 
                            type="date" 
                            value={formData.fecha} 
                            onChange={e => setFormData({...formData, fecha: e.target.value})} 
                            style={{...styles.input, paddingLeft: '35px'}} 
                            required
                        />
                    </div>
                </div>

                <div style={{marginBottom: '15px'}}>
                    <label style={styles.label}>Nombre / Referencia</label>
                    <div style={{position: 'relative'}}>
                        <Tag size={16} color="#94a3b8" style={{position: 'absolute', left: 10, top: 12}}/>
                        <input 
                            type="text" 
                            value={formData.nombre} 
                            onChange={e => setFormData({...formData, nombre: e.target.value})} 
                            style={{...styles.input, paddingLeft: '35px'}} 
                            placeholder="Ej: Oferta Verano 2026"
                        />
                    </div>
                </div>
            </div>

            {/* Switch de Estado */}
            <div style={styles.switchBox}>
                 <div>
                     <div style={styles.switchLabel}>{formData.activa ? 'Oferta Activa' : 'Oferta Inactiva'}</div>
                     <div style={{fontSize:'0.75rem', color: formData.activa ? '#16a34a' : '#ef4444'}}>
                         {formData.activa ? 'Disponible para cosechas' : 'No seleccionable'}
                     </div>
                 </div>
                 <div 
                    onClick={() => setFormData({...formData, activa: !formData.activa})}
                    style={{
                        width: '40px', height: '22px', backgroundColor: formData.activa ? '#16a34a' : '#cbd5e1',
                        borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s'
                    }}
                 >
                     <div style={{
                         width: '18px', height: '18px', backgroundColor: 'white', borderRadius: '50%',
                         position: 'absolute', top: '2px', left: formData.activa ? '20px' : '2px',
                         transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                     }}/>
                 </div>
            </div>
        </div>

        {/* COLUMNA DERECHA: LISTA DE PRECIOS */}
        <div style={styles.colRight}>
            <div style={{...styles.sectionTitle, color: '#0f172a', borderBottomColor: '#cbd5e1'}}>
                <DollarSign size={18} color="#0f172a"/> 
                Matriz de Precios (Por Kilo)
            </div>
            
            <div style={styles.pricesGrid}>
                {CALIBRES_STD.map((calibre, index) => (
                    <SmartInput
                        key={calibre}
                        label={calibre}
                        index={index}
                        value={preciosMap[calibre]}
                        onChange={(val) => setPreciosMap(prev => ({ ...prev, [calibre]: val }))}
                        onKeyDown={(e) => handleGridKeyDown(e, index)}
                    />
                ))}
            </div>
        </div>

      </div>

      <div style={styles.footer}>
         <button type="button" onClick={cerrarModal} style={styles.btnCancel}>
            Cancelar
         </button>
         <button type="submit" style={styles.btnSave} disabled={loading}>
            <Save size={18}/> {loading ? 'Guardando...' : 'Guardar Cotización'}
         </button>
      </div>
    </form>
  )
}

export default NuevaOferta