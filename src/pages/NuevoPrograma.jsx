import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Save, Trash2, Plus, Info, Clock, Calendar } from 'lucide-react'

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Helper formato
const formatNumber = (num) => new Intl.NumberFormat('es-CL').format(Math.round(num))

function NuevoPrograma({ idSector, cerrarModal, alGuardar }) {
  const [loading, setLoading] = useState(false)
  const [sectorInfo, setSectorInfo] = useState(null)

  // Form Data
  const [diasSeleccionados, setDiasSeleccionados] = useState([])
  const [turnos, setTurnos] = useState([{ id: 1, hora: '08:00', duracion: 60 }])

  useEffect(() => {
    async function load() {
        if (!idSector) return
        // Cargar info del sector
        const { data: s } = await supabase.from('sectores').select('*').eq('id', idSector).single()
        setSectorInfo(s)

        // Cargar programa activo
        const { data: prog } = await supabase.from('programas_riego')
            .select('*')
            .neq('estado', 'Finalizado')
            .or(`sector_id.eq.${idSector},sectores_ids.cs.{${idSector}}`)
            .maybeSingle()
        
        if (prog) {
            setDiasSeleccionados(prog.dias || [])
            if (prog.turnos && prog.turnos.length > 0) {
                const misTurnos = prog.turnos.filter(t => !t.sector_id || Number(t.sector_id) === Number(idSector))
                setTurnos(misTurnos.map((t, i) => ({ id: i, hora: t.hora, duracion: t.duracion })))
            }
        }
    }
    load()
  }, [idSector])

  const toggleDia = (dia) => {
    setDiasSeleccionados(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia])
  }

  const addTurno = () => setTurnos([...turnos, { id: Date.now(), hora: '18:00', duracion: 60 }])
  
  const removeTurno = (id) => {
      if (turnos.length > 1) setTurnos(turnos.filter(t => t.id !== id))
  }

  const updateTurno = (id, field, val) => {
      setTurnos(turnos.map(t => t.id === id ? { ...t, [field]: val } : t))
  }

  const caudalSector = sectorInfo ? (sectorInfo.cantidad_aspersores * sectorInfo.caudal_lph) : 0
  const minutosDiarios = turnos.reduce((acc, t) => acc + parseInt(t.duracion || 0), 0)
  const litrosDiarios = (caudalSector / 60) * minutosDiarios

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (diasSeleccionados.length === 0) return alert("Selecciona al menos un día.")
    
    setLoading(true)
    try {
        await supabase.from('programas_riego')
            .update({ estado: 'Finalizado', fecha_fin: new Date() })
            .or(`sector_id.eq.${idSector},sectores_ids.cs.{${idSector}}`)
            .neq('estado', 'Finalizado')

        const payload = {
            nombre: `Riego ${sectorInfo.nombre}`,
            sector_id: idSector,
            sectores_ids: [idSector],
            fecha_inicio: new Date(),
            fecha_creacion: new Date(),
            dias: diasSeleccionados,
            turnos: turnos.map(t => ({ hora: t.hora, duracion: t.duracion, sector_id: idSector })),
            estado: 'Activo'
        }

        const { error } = await supabase.from('programas_riego').insert([payload])
        if (error) throw error

        alGuardar()
    } catch (err) {
        console.error(err)
        alert("Error al guardar")
    } finally {
        setLoading(false)
    }
  }

  const styles = {
      wrapper: { display: 'flex', gap: '20px', alignItems: 'flex-start', minHeight: '400px' },
      
      leftPanel: { 
          flex: '0 0 280px', 
          backgroundColor: '#eff6ff', 
          borderRadius: '12px', 
          padding: '20px', 
          border: '1px solid #dbeafe',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px'
      },
      statItem: { borderBottom: '1px dashed #bfdbfe', paddingBottom: '12px' },
      statLabel: { fontSize: '0.75rem', textTransform: 'uppercase', color: '#60a5fa', fontWeight: 'bold', letterSpacing: '0.5px' },
      statValue: { fontSize: '1.1rem', fontWeight: 'bold', color: '#1e40af', marginTop: '4px' },

      rightPanel: { flex: 1, display: 'flex', flexDirection: 'column', gap: '25px' },
      sectionTitle: { fontSize: '0.95rem', fontWeight: 'bold', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' },
      
      daysGrid: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
      dayCard: (active) => ({
          flex: 1, minWidth: '40px', textAlign: 'center', padding: '10px 5px',
          borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold',
          border: active ? '1px solid #2563eb' : '1px solid #e5e7eb',
          backgroundColor: active ? '#2563eb' : 'white',
          color: active ? 'white' : '#64748b',
          transition: 'all 0.2s ease',
          boxShadow: active ? '0 4px 6px -1px rgba(37, 99, 235, 0.2)' : '0 1px 2px rgba(0,0,0,0.05)'
      }),

      turnosList: { display: 'flex', flexDirection: 'column', gap: '12px' },
      turnoCard: { 
          display: 'flex', alignItems: 'center', gap: '15px', 
          backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', 
          padding: '15px', borderRadius: '10px',
          position: 'relative'
      },
      inputGroup: { flex: 1 },
      labelInput: { display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '5px' },
      input: { 
          width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', 
          fontSize: '0.9rem', color: '#334155', backgroundColor: 'white', outline: 'none',
          boxSizing: 'border-box'
      },

      btnAdd: { 
          background: 'none', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '10px', 
          color: '#2563eb', fontWeight: 'bold', cursor: 'pointer', width: '100%', 
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
          transition: 'background 0.2s', marginTop: '5px'
      },

      btnSubmit: {
          marginTop: 'auto',
          backgroundColor: '#1f2937', color: 'white', padding: '14px', borderRadius: '8px',
          border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.wrapper}>
        
        {/* PANEL IZQUIERDO */}
        <div style={styles.leftPanel}>
            <div style={{display:'flex', alignItems:'center', gap:8, color:'#1e3a8a', fontWeight:'bold', marginBottom:5}}>
                <Info size={20}/> Resumen
            </div>
            
            {sectorInfo ? (
                <>
                    <div style={styles.statItem}>
                        <div style={styles.statLabel}>Sector</div>
                        <div style={styles.statValue}>{sectorInfo.nombre}</div>
                    </div>
                    <div style={styles.statItem}>
                        <div style={styles.statLabel}>Capacidad Bomba Req.</div>
                        <div style={styles.statValue}>{formatNumber(caudalSector)} L/h</div>
                    </div>
                    <div style={{...styles.statItem, borderBottom:'none'}}>
                        <div style={styles.statLabel}>Consumo Diario Est.</div>
                        <div style={{...styles.statValue, color: '#059669'}}>
                            {formatNumber(litrosDiarios)} L
                        </div>
                    </div>
                </>
            ) : <div>Cargando info...</div>}
        </div>

        {/* PANEL DERECHO */}
        <div style={styles.rightPanel}>
            
            <div>
                <div style={styles.sectionTitle}><Calendar size={18}/> 1. Frecuencia de Riego</div>
                <div style={styles.daysGrid}>
                    {DIAS_SEMANA.map(dia => (
                        <div key={dia} onClick={() => toggleDia(dia)} style={styles.dayCard(diasSeleccionados.includes(dia))}>
                            {dia.slice(0,3)}
                            {diasSeleccionados.includes(dia) && <div style={{fontSize:'0.6rem', marginTop:2}}>SI</div>}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{flex: 1}}>
                <div style={styles.sectionTitle}><Clock size={18}/> 2. Turnos Diarios</div>
                <div style={styles.turnosList}>
                    {turnos.map((t, i) => (
                        <div key={t.id} style={styles.turnoCard}>
                            <div style={{color:'#94a3b8', fontWeight:'bold', fontSize:'1.2rem'}}>#{i+1}</div>
                            
                            <div style={styles.inputGroup}>
                                <label style={styles.labelInput}>HORA INICIO (24h)</label>
                                <input type="time" value={t.hora} onChange={e => updateTurno(t.id, 'hora', e.target.value)} style={styles.input} />
                            </div>
                            
                            <div style={styles.inputGroup}>
                                <label style={styles.labelInput}>DURACIÓN (MIN)</label>
                                <input type="number" min="1" value={t.duracion} onChange={e => updateTurno(t.id, 'duracion', e.target.value)} style={styles.input} />
                            </div>

                            {turnos.length > 1 && (
                                <button type="button" onClick={() => removeTurno(t.id)} style={{border:'none', background:'none', color:'#ef4444', cursor:'pointer', padding:5}}>
                                    <Trash2 size={18}/>
                                </button>
                            )}
                        </div>
                    ))}
                    <button type="button" onClick={addTurno} style={styles.btnAdd}>
                        <Plus size={16}/> AGREGAR OTRO TURNO
                    </button>
                </div>
            </div>

            <button type="submit" style={styles.btnSubmit}>
                {loading ? 'Guardando...' : <><Save size={20}/> Guardar y Activar</>}
            </button>
        </div>
    </form>
  )
}

export default NuevoPrograma