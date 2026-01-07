import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Save, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

const formatMoney = (amount) => '$ ' + Math.round(amount || 0).toLocaleString('es-CL')

function NuevoMovimientoBodega({ config, movimientoEditar, cerrar, alGuardar }) {
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    cantidad: '',
    costo_total: '',
    fecha: new Date().toISOString().split('T')[0],
    referencia: ''
  })

  // DETERMINAR TIPO: Si editamos, usamos el tipo del registro; si es nuevo, usamos la config
  const tipoMovimiento = movimientoEditar ? movimientoEditar.tipo_movimiento : config?.tipo
  const isEntrada = tipoMovimiento === 'Entrada'

  // PRE-CARGA DE DATOS EN EDICIÓN
  useEffect(() => {
      if (movimientoEditar) {
          // Si es entrada, reconstruimos el Costo Total para que el usuario lo vea
          let costoTotalInicial = ''
          if (movimientoEditar.tipo_movimiento === 'Entrada') {
              costoTotalInicial = (parseFloat(movimientoEditar.cantidad) * parseFloat(movimientoEditar.costo_unitario)).toFixed(0)
          }

          setFormData({
              cantidad: movimientoEditar.cantidad,
              costo_total: costoTotalInicial,
              fecha: movimientoEditar.fecha,
              referencia: movimientoEditar.referencia || ''
          })
      }
  }, [movimientoEditar])

  // Cálculos en tiempo real
  const cantidadNum = parseFloat(formData.cantidad) || 0
  const costoTotalNum = parseFloat(formData.costo_total) || 0
  const costoUnitarioCalc = (cantidadNum > 0 && costoTotalNum > 0) ? (costoTotalNum / cantidadNum) : 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.cantidad || parseFloat(formData.cantidad) <= 0) return alert("Ingresa una cantidad válida")
    
    setLoading(true)
    try {
        let costoUnitarioFinal = 0
        
        if (isEntrada) {
            // Entrada: Unitario = Total / Cantidad
            costoUnitarioFinal = costoUnitarioCalc
        } else {
            // Salida:
            // Si es NUEVO -> Costo = PMP actual del producto
            // Si es EDICIÓN -> Costo = Se mantiene el histórico (movimientoEditar.costo_unitario) 
            //                  o forzamos PMP actual? Generalmente en edición histórica se mantiene el costo original 
            //                  a menos que se quiera recalcular explícitamente. 
            //                  Para simplificar y evitar corromper PMP histórico, mantenemos el original si existe.
            costoUnitarioFinal = movimientoEditar ? movimientoEditar.costo_unitario : (config.producto.costo_promedio || 0)
        }

        const movimientoData = {
            insumo_id: config.producto.id,
            tipo_movimiento: tipoMovimiento,
            cantidad: parseFloat(formData.cantidad),
            fecha: formData.fecha,
            referencia: formData.referencia || (isEntrada ? 'Compra / Ingreso' : 'Ajuste / Salida'),
            costo_unitario: costoUnitarioFinal
        }

        if (movimientoEditar) {
            // UPDATE
            const { error } = await supabase
                .from('bodega_movimientos')
                .update(movimientoData)
                .eq('id', movimientoEditar.id)
            if (error) throw error
        } else {
            // INSERT
            const { error } = await supabase
                .from('bodega_movimientos')
                .insert([movimientoData])
            if (error) throw error
        }

        alGuardar()
    } catch (err) {
        alert("Error: " + err.message)
    } finally {
        setLoading(false)
    }
  }

  const styles = {
      form: { display:'flex', flexDirection:'column', gap:15 },
      label: { fontWeight:'bold', fontSize:'0.85rem', color:'#374151', display:'block', marginBottom:5 },
      input: { width:'100%', padding:10, borderRadius:6, border:'1px solid #d1d5db', boxSizing:'border-box', fontSize:'0.9rem' },
      infoBox: { 
          backgroundColor: isEntrada ? '#f0fdf4' : '#fef2f2', 
          padding:15, borderRadius:8, 
          border: isEntrada ? '1px solid #bbf7d0' : '1px solid #fecaca', 
          marginBottom:10, display:'flex', alignItems:'center', gap:10 
      },
      readOnlyCalc: { textAlign:'right', fontSize:'0.8rem', color:'#6b7280', marginTop:4, backgroundColor:'#f9fafb', padding:'2px 5px', borderRadius:4, display:'inline-block' }
  }

  return (
      <form onSubmit={handleSubmit} style={styles.form}>
          {/* Encabezado Visual */}
          <div style={styles.infoBox}>
              {isEntrada ? <ArrowUpCircle size={28} color="#166534"/> : <ArrowDownCircle size={28} color="#991b1b"/>}
              <div>
                  <div style={{fontWeight:'bold', color: isEntrada ? '#166534' : '#991b1b', textTransform:'uppercase', fontSize:'0.75rem', letterSpacing:'0.5px'}}>
                      {movimientoEditar ? `Editar ${tipoMovimiento}` : (isEntrada ? 'Entrada de Producto' : 'Salida de Producto')}
                  </div>
                  <div style={{fontSize:'1.2rem', fontWeight:'800', color:'#1f2937'}}>{config?.producto?.nombre}</div>
                  <div style={{fontSize:'0.85rem', color:'#6b7280'}}>Stock Actual: {config?.producto?.stock_actual} {config?.producto?.unidad_medida}</div>
              </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns: isEntrada ? '1fr 1fr' : '1fr', gap:15}}>
              <div>
                  <label style={styles.label}>Cantidad ({config?.producto?.unidad_medida})</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.cantidad} 
                    onChange={e => setFormData({...formData, cantidad: e.target.value})} 
                    style={styles.input}
                    autoFocus
                    required
                    placeholder="0.00"
                  />
              </div>
              
              {/* CAMPO DE COSTO (SOLO VISIBLE EN ENTRADA) */}
              {isEntrada && (
                  <div>
                      <label style={styles.label}>Costo Total Compra ($)</label>
                      <input 
                        type="number" 
                        value={formData.costo_total} 
                        onChange={e => setFormData({...formData, costo_total: e.target.value})} 
                        style={styles.input}
                        placeholder="Monto total factura"
                      />
                      {costoUnitarioCalc > 0 && (
                          <div style={{textAlign:'right'}}>
                              <span style={styles.readOnlyCalc}>
                                  Unitario aprox: <strong>{formatMoney(costoUnitarioCalc)}</strong> / {config?.producto?.unidad_medida}
                              </span>
                          </div>
                      )}
                  </div>
              )}
          </div>

          <div>
              <label style={styles.label}>Fecha</label>
              <input 
                type="date" 
                value={formData.fecha} 
                onChange={e => setFormData({...formData, fecha: e.target.value})} 
                style={styles.input}
                required
              />
          </div>

          <div>
              <label style={styles.label}>Referencia / Nota</label>
              <input 
                type="text" 
                value={formData.referencia} 
                onChange={e => setFormData({...formData, referencia: e.target.value})} 
                style={styles.input}
                placeholder={isEntrada ? "Ej: Factura N° 123" : "Ej: Merma, Ajuste..."}
              />
          </div>

          <div style={{display:'flex', justifyContent:'flex-end', gap:10, marginTop:15, paddingTop:15, borderTop:'1px solid #e5e7eb'}}>
              <button type="button" onClick={cerrar} style={{padding:'10px 20px', background:'white', border:'1px solid #d1d5db', borderRadius:6, cursor:'pointer', fontWeight:'500', color:'#374151'}}>Cancelar</button>
              <button type="submit" disabled={loading} style={{padding:'10px 20px', backgroundColor:'#1f2937', color:'white', border:'none', borderRadius:6, fontWeight:'bold', cursor:'pointer', display:'flex', alignItems:'center', gap:8}}>
                  <Save size={18}/> {loading ? 'Guardando...' : (movimientoEditar ? 'Actualizar' : 'Confirmar')}
              </button>
          </div>
      </form>
  )
}

export default NuevoMovimientoBodega