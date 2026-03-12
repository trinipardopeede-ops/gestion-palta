import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Save, Info, CheckCircle2 } from 'lucide-react'

const LISTA_CALIBRADA = ["Extra", "Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Descarte"]
const LISTA_BARRIDO = ["Barrido"]

function NuevaCosecha({ idCosecha, cerrarModal, alGuardar }) {
  const [loading, setLoading] = useState(false)
  
  // Maestros
  const [sectores, setSectores] = useState([])
  const [clientes, setClientes] = useState([])
  const [parcelas, setParcelas] = useState([])
  const [ofertasCliente, setOfertasCliente] = useState([]) 

  const inputsRef = useRef({}) 
  const [modoCosecha, setModoCosecha] = useState('Calibrada') 

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    parcela_id: '',
    sector_id: '',
    cliente_id: '',
    oferta_id: '', 
    nro_guia: '',
    tipo_cosecha: 'Venta',
    destino: 'Venta',
    comentarios: ''
  })

  const [detalles, setDetalles] = useState([])

  // Helpers de Formato
  const formatNumber = (val) => {
    if (val === '' || val === undefined) return ''
    return new Intl.NumberFormat('es-CL').format(val)
  }

  const parseNumber = (val) => {
    if (!val) return ''
    return val.toString().replace(/\./g, '')
  }

  // 1. CARGA
  useEffect(() => {
    async function load() {
      const { data: sec } = await supabase.from('sectores').select('id, nombre, parcela_id').order('nombre')
      setSectores(sec || [])
      const { data: cli } = await supabase.from('clientes').select('id, nombre').order('nombre')
      setClientes(cli || [])
      const { data: par } = await supabase.from('parcelas').select('id, nombre').order('nombre')
      setParcelas(par || [])

      if (idCosecha) {
        const { data: c } = await supabase.from('cosechas').select('*').eq('id', idCosecha).single()
        if (c) {
           setFormData({
               fecha: c.fecha,
               parcela_id: c.parcela_id || '',
               sector_id: c.sector_id || '',
               cliente_id: c.cliente_id || '',
               oferta_id: '',
               nro_guia: c.nro_guia || '',
               tipo_cosecha: c.tipo_cosecha,
               destino: c.destino,
               comentarios: c.comentarios || ''
           })
           
           const { data: dets } = await supabase.from('detalle_cosechas').select('*').eq('cosecha_id', idCosecha)
           if (dets && dets.length > 0) {
               const existentes = dets.map(d => ({ 
                   calibre: d.calibre, 
                   kilos: d.kilos, 
                   precio_kilo: d.precio_kilo 
               }))
               setDetalles(existentes)
               const tieneBarrido = existentes.some(d => d.calibre === 'Barrido')
               setModoCosecha(tieneBarrido ? 'Barrido' : 'Calibrada')
           }
        }
      } else {
          resetearTabla('Calibrada')
      }
    }
    load()
  }, [idCosecha])

  useEffect(() => {
    if (formData.cliente_id) {
        async function fetchOfertas() {
            const { data } = await supabase.from('ofertas_comerciales')
                .select('*').eq('cliente_id', formData.cliente_id).eq('activa', true).order('created_at', { ascending: false })
            setOfertasCliente(data || [])
        }
        fetchOfertas()
    } else { setOfertasCliente([]) }
  }, [formData.cliente_id])

  const cambiarModo = (nuevoModo) => {
      if (nuevoModo === modoCosecha) return
      setModoCosecha(nuevoModo)
      resetearTabla(nuevoModo)
  }

  const resetearTabla = (modo) => {
      const listaBase = modo === 'Barrido' ? LISTA_BARRIDO : LISTA_CALIBRADA
      const nuevasFilas = listaBase.map(c => ({ calibre: c, kilos: '', precio_kilo: '' }))
      setDetalles(nuevasFilas)
  }

  const aplicarOferta = (ofertaId) => {
      setFormData(prev => ({ ...prev, oferta_id: ofertaId }))
      if (!ofertaId) return 
      const oferta = ofertasCliente.find(o => o.id == ofertaId)
      if (oferta && oferta.precios_json && confirm("¿Aplicar precios de cotización?")) {
          const nuevosDetalles = oferta.precios_json.map(p => ({ calibre: p.calibre, precio_kilo: p.precio, kilos: '' }))
          setDetalles(nuevosDetalles)
          const esBarrido = nuevosDetalles.some(d => d.calibre === 'Barrido')
          setModoCosecha(esBarrido ? 'Barrido' : 'Calibrada')
      }
  }

  const handleSectorSelect = (parcelaId, sectorId) => {
      setFormData(prev => ({ ...prev, parcela_id: parcelaId, sector_id: sectorId }))
  }

  const handleDetalleChange = (index, field, value) => {
      const copia = [...detalles]
      if (field === 'precio_kilo' || field === 'kilos') {
          const raw = parseNumber(value)
          if (!isNaN(raw)) copia[index][field] = raw
      } else {
          copia[index][field] = value
      }
      setDetalles(copia)
  }

  const handleHeaderChange = (e) => {
      const { name, value } = e.target
      setFormData({ ...formData, [name]: value })
  }

  const totalKilos = detalles.reduce((sum, d) => sum + (parseFloat(d.kilos) || 0), 0)
  const totalVenta = detalles.reduce((sum, d) => sum + ((parseFloat(d.kilos) || 0) * (parseFloat(d.precio_kilo) || 0)), 0)
  const precioPromedio = totalKilos > 0 ? (totalVenta / totalKilos) : 0

  const handleSubmit = async (e) => {
      e.preventDefault()
      if (!formData.fecha) return alert("Falta Fecha")
      if (!formData.sector_id) return alert("Selecciona un Sector")
      
      setLoading(true)
      try {
          const cabecera = {
              ...formData,
              sector_id: formData.sector_id || null,
              cliente_id: formData.cliente_id || null,
              oferta_id: formData.oferta_id || null,
              kilos: totalKilos,
              precio_kilo: precioPromedio
          }
          
          let finalId = idCosecha
          if (idCosecha) {
              await supabase.from('cosechas').update(cabecera).eq('id', idCosecha)
              await supabase.from('detalle_cosechas').delete().eq('cosecha_id', idCosecha)
          } else {
              const { data, error } = await supabase.from('cosechas').insert([cabecera]).select().single()
              if (error) throw error
              finalId = data.id
          }

          const lineasGuardar = detalles.filter(d => parseFloat(d.kilos) > 0).map(d => ({
              cosecha_id: finalId,
              calibre: d.calibre || 'Sin Calibre',
              kilos: parseFloat(d.kilos) || 0,
              precio_kilo: parseFloat(d.precio_kilo) || 0
          }))

          await supabase.from('detalle_cosechas').insert(lineasGuardar)
          alGuardar()
      } catch (err) { alert(err.message) } finally { setLoading(false) }
  }

  const styles = {
      // Wrapper: Centrado vertical de las columnas
      wrapper: { display:'grid', gridTemplateColumns:'1fr auto', gap:30, fontSize:'0.9rem', alignItems:'center' },
      
      // Left Col: Reduje el gap de 15 a 10 para juntar secciones
      leftCol: { display:'flex', flexDirection:'column', gap:10 },
      
      // Right Col: Ajuste de padding/border
      rightCol: { backgroundColor:'#f9fafb', padding:15, borderRadius:8, border:'1px solid #e5e7eb', width: 'fit-content', minWidth: '320px' },
      
      label: { display:'block', fontWeight:'bold', marginBottom:4, fontSize:'0.8rem', color:'#374151' },
      input: { width:'100%', padding:'8px', borderRadius:6, border:'1px solid #d1d5db', fontSize:'0.9rem', boxSizing:'border-box' },
      
      toggleGroup: { display:'flex', gap:0, backgroundColor:'#f3f4f6', borderRadius:6, border:'1px solid #e5e7eb', width:'fit-content', marginBottom: 5 },
      toggleBtn: (active) => ({
          padding:'6px 12px', border:'none', cursor:'pointer', fontSize:'0.8rem', fontWeight:'600',
          backgroundColor: active ? 'white' : 'transparent', color: active ? '#16a34a' : '#6b7280', borderRadius:6,
          boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
      }),

      selectorContainer: { border:'1px solid #e5e7eb', borderRadius:8, padding:10, backgroundColor:'white', maxHeight:'300px', overflowY:'auto' },
      parcelaGroup: { marginBottom:10 },
      parcelaHeader: { fontSize:'0.75rem', fontWeight:'bold', color:'#9ca3af', marginBottom:5, textTransform:'uppercase', letterSpacing:0.5 },
      sectorList: { display:'flex', flexDirection:'column', gap:5 },
      sectorItem: (active) => ({
          padding:'8px 12px', borderRadius:6, border: active ? '1px solid #16a34a' : '1px solid #e5e7eb',
          backgroundColor: active ? '#dcfce7' : 'white', color: active ? '#166534' : '#374151',
          cursor:'pointer', fontSize:'0.85rem', fontWeight: active ? 'bold' : 'normal',
          display:'flex', alignItems:'center', justifyContent:'space-between'
      }),

      table: { width:'100%', borderCollapse:'collapse' },
      th: { textAlign:'left', padding:'8px 4px', borderBottom:'1px solid #e5e7eb', fontSize:'0.75rem', color:'#6b7280', fontWeight:'bold' },
      td: { padding:'6px 4px', borderBottom:'1px solid #f3f4f6' },
      
      inputNum: { width:'90px', padding:'6px', textAlign:'right', border:'1px solid #e5e7eb', borderRadius:4, fontSize:'0.9rem' },
      
      totalBox: { marginTop:15, padding:10, backgroundColor:'#dcfce7', borderRadius:8, border:'1px solid #86efac', display:'flex', justifyContent:'space-between', alignItems:'center' },
      btnSave: { marginTop:20, width:'100%', padding:12, backgroundColor:'#1f2937', color:'white', border:'none', borderRadius:8, fontWeight:'bold', cursor:'pointer', display:'flex', justifyContent:'center', gap:8 }
  }

  return (
    <form onSubmit={handleSubmit}>
        <div style={styles.wrapper}>
            {/* COLUMNA IZQUIERDA: CABECERA */}
            <div style={styles.leftCol}>
                
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                        <div style={styles.toggleGroup}>
                            <button type="button" onClick={() => cambiarModo('Calibrada')} style={styles.toggleBtn(modoCosecha === 'Calibrada')}>Calibrada</button>
                            <button type="button" onClick={() => cambiarModo('Barrido')} style={styles.toggleBtn(modoCosecha === 'Barrido')}>Barrido</button>
                        </div>
                    </div>
                    <div style={{width:'150px'}}>
                         <label style={styles.label}>Fecha</label>
                         <input type="date" name="fecha" value={formData.fecha} onChange={handleHeaderChange} style={styles.input} required />
                    </div>
                </div>

                {/* SELECTOR DE SECTORES (Tipo Labor) */}
                <div>
                    <label style={styles.label}>Origen (Parcela / Sector)</label>
                    <div style={styles.selectorContainer}>
                        {parcelas.map(p => {
                            const sectoresParcela = sectores.filter(s => s.parcela_id === p.id);
                            if (sectoresParcela.length === 0) return null;
                            return (
                                <div key={p.id} style={styles.parcelaGroup}>
                                    <div style={styles.parcelaHeader}>{p.nombre}</div>
                                    <div style={styles.sectorList}>
                                        {sectoresParcela.map(s => (
                                            <div 
                                                key={s.id} 
                                                onClick={() => handleSectorSelect(p.id, s.id)}
                                                style={styles.sectorItem(formData.sector_id === s.id)}
                                            >
                                                <span>{s.nombre}</span>
                                                {formData.sector_id === s.id && <CheckCircle2 size={16}/>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Divisor más pequeño */}
                <div style={{borderTop:'1px dashed #e5e7eb', margin:'2px 0'}}></div>

                <div>
                    <label style={styles.label}>Cliente</label>
                    <select name="cliente_id" value={formData.cliente_id} onChange={handleHeaderChange} style={styles.input}>
                        <option value="">-- Seleccionar --</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 100px', gap:10}}>
                    <div>
                        <label style={styles.label}>Cotización (Precios)</label>
                        <select name="oferta_id" value={formData.oferta_id} onChange={(e) => aplicarOferta(e.target.value)} style={styles.input} disabled={!formData.cliente_id}>
                            <option value="">-- Manual --</option>
                            {ofertasCliente.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={styles.label}>N° Guía</label>
                        <input type="text" name="nro_guia" value={formData.nro_guia} onChange={handleHeaderChange} style={styles.input} />
                    </div>
                </div>
            </div>

            {/* COLUMNA DERECHA: TABLA DETALLES */}
            <div style={styles.rightCol}>
                <div style={{display:'flex', alignItems:'center', gap:5, fontSize:'0.8rem', fontWeight:'bold', color:'#374151', marginBottom:10}}>
                    <Info size={16}/> Detalle de Calibres
                </div>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Calibre</th>
                            <th style={{...styles.th, textAlign:'right'}}>Kg</th>
                            <th style={{...styles.th, textAlign:'right'}}>Precio ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {detalles.map((fila, i) => (
                            <tr key={i}>
                                <td style={styles.td}><strong>{fila.calibre}</strong></td>
                                <td style={{...styles.td, textAlign:'right'}}>
                                    <input 
                                        type="text" 
                                        value={formatNumber(fila.kilos)} 
                                        onChange={(e) => handleDetalleChange(i, 'kilos', e.target.value)}
                                        style={styles.inputNum}
                                        placeholder="0"
                                    />
                                </td>
                                <td style={{...styles.td, textAlign:'right'}}>
                                    <input 
                                        type="text" 
                                        value={formatNumber(fila.precio_kilo)} 
                                        onChange={(e) => handleDetalleChange(i, 'precio_kilo', e.target.value)}
                                        style={styles.inputNum}
                                        placeholder="$ 0"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={styles.totalBox}>
                    <div>
                        <div style={{fontSize:'0.75rem', fontWeight:'bold', color:'#166534'}}>TOTAL VENTA</div>
                        <div style={{fontSize:'1.1rem', fontWeight:'bold', color:'#14532d'}}>${formatNumber(Math.round(totalVenta))}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                         <div style={{fontSize:'0.75rem', fontWeight:'bold', color:'#374151'}}>TOTAL KILOS</div>
                         <div style={{fontSize:'1rem', fontWeight:'bold', color:'#1f2937'}}>{formatNumber(Math.round(totalKilos))} Kg</div>
                    </div>
                </div>
            </div>
        </div>

        <button type="submit" style={styles.btnSave}>
            <Save size={18} /> Guardar Cosecha
        </button>
    </form>
  )
}

export default NuevaCosecha