import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList 
} from 'recharts';
import { DollarSign, TrendingUp, AlertCircle, CheckCircle, BarChart3, PieChart } from 'lucide-react';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function DashboardFinanzas() {
  const [loading, setLoading] = useState(true);
  const [gastos, setGastos] = useState([]);
  
  // Maestros
  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);

  // Filtros
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear().toString());
  const [filtroMes, setFiltroMes] = useState('Todos');
  const [filtroCat, setFiltroCat] = useState('Todas');
  const [filtroProv, setFiltroProv] = useState('Todos');
  const [filtroEstado, setFiltroEstado] = useState('Todos');

  // KPIs y Datos Gráficos
  const [kpis, setKpis] = useState({ gastosTotales: 0, deudaPendiente: 0, pagadoReal: 0 });
  const [dataCategorias, setDataCategorias] = useState([]);
  const [dataEstado, setDataEstado] = useState([]);

  const COLORS_CAT = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#06b6d4'];
  const COLORS_ESTADO = { 'Pagado': '#16a34a', 'Por Pagar': '#dc2626' }; 

  useEffect(() => { fetchData() }, [filtroAnio]); 
  useEffect(() => { calcularMetricas() }, [filtroCat, filtroProv, filtroMes, filtroEstado, gastos]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: cats } = await supabase.from('categorias_gastos').select('id, nombre').order('nombre');
      if(cats) setCategorias(cats);

      const { data: provs } = await supabase.from('proveedores').select('id, nombre').order('nombre');
      if(provs) setProveedores(provs);

      let query = supabase
        .from('gastos')
        .select(`
            monto, estado_pago, fecha, proveedor_id,
            categorias_gastos!gastos_categoria_id_fkey ( nombre ),
            proveedores ( nombre )
        `)
        .gte('fecha', `${filtroAnio}-01-01`)
        .lte('fecha', `${filtroAnio}-12-31`);

      const { data, error } = await query;
      if (error) throw error;
      setGastos(data || []);

    } catch (error) {
      console.error("Error finanzas:", error);
    } finally {
      setLoading(false);
    }
  };

  const calcularMetricas = () => {
      if (!gastos) return;

      let filtrados = gastos;

      if (filtroCat !== 'Todas') filtrados = filtrados.filter(g => g.categorias_gastos?.nombre === filtroCat);
      if (filtroProv !== 'Todos') filtrados = filtrados.filter(g => g.proveedor_id?.toString() === filtroProv);
      if (filtroEstado !== 'Todos') filtrados = filtrados.filter(g => g.estado_pago === filtroEstado);
      if (filtroMes !== 'Todos') {
          const mIdx = parseInt(filtroMes);
          filtrados = filtrados.filter(g => parseInt(g.fecha.split('-')[1]) === mIdx);
      }

      // 1. Cálculo KPIs Globales
      const total = filtrados.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
      const pendiente = filtrados
          .filter(g => g.estado_pago === 'Pendiente' || g.estado_pago === 'Parcial')
          .reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
      const pagado = total - pendiente; 

      setKpis({ gastosTotales: total, deudaPendiente: pendiente, pagadoReal: pagado });

      // 2. Datos por Categoría
      const porCategoria = {};
      filtrados.forEach(g => {
          const catName = g.categorias_gastos?.nombre || 'Sin Categoría';
          porCategoria[catName] = (porCategoria[catName] || 0) + (parseFloat(g.monto) || 0);
      });

      const dataCat = Object.keys(porCategoria)
        .map(key => ({
            name: key, 
            value: porCategoria[key],
            percentage: total > 0 ? (porCategoria[key] / total) * 100 : 0
        }))
        .sort((a, b) => b.value - a.value); 
      
      setDataCategorias(dataCat);

      // 3. Datos por Estado
      setDataEstado([
          { name: 'Pagado', value: pagado, percentage: total > 0 ? (pagado/total)*100 : 0 },
          { name: 'Por Pagar', value: pendiente, percentage: total > 0 ? (pendiente/total)*100 : 0 }
      ]);
  }

  const fmt = (num) => `$ ${(num || 0).toLocaleString('es-CL')}`;

  // --- ETIQUETAS EXTERNAS LIMPIAS ---
  // Esta función renderiza el texto FUERA de la barra para que se vea siempre
  const renderExternalLabel = (props) => {
    const { x, y, width, height, value } = props;
    const isVertical = props.orientation === 'top'; // Identificador casero para saber cual grafico es

    if (isVertical) {
        // Para gráfico vertical (Estado Pagos): Texto ARRIBA
        return (
            <text x={x + width / 2} y={y - 10} fill="#374151" textAnchor="middle" dominantBaseline="bottom" style={{fontSize: '0.85rem', fontWeight: 'bold'}}>
                {fmt(value)}
            </text>
        );
    } else {
        // Para gráfico horizontal (Categorías): Texto a la DERECHA
        return (
            <text x={x + width + 5} y={y + height / 2} fill="#374151" textAnchor="start" dominantBaseline="middle" style={{fontSize: '0.8rem', fontWeight: 'bold'}}>
                {fmt(value)}
            </text>
        );
    }
  };

  const styles = {
    toolbar: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems:'center', backgroundColor:'white', padding:15, borderRadius:12, border:'1px solid #e5e7eb' },
    selectGroup: { display:'flex', flexDirection:'column', gap:4 },
    labelSelect: { fontSize:'0.7rem', fontWeight:'bold', color:'#6b7280', textTransform:'uppercase' },
    select: { padding:'8px 10px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'0.85rem', minWidth:130, cursor:'pointer' },
    
    gridKpi: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' },
    kpiCard: (borderColor, bgColor) => ({ 
        backgroundColor: bgColor || 'white', borderRadius: '16px', padding: '20px', 
        border: `1px solid ${borderColor}`, display:'flex', flexDirection:'column', gap:5,
        boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
    }),
    kpiTitle: { fontSize: '0.85rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' },
    kpiValue: { fontSize: '2rem', fontWeight: '800', color: '#1f2937' },
    
    chartRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' },
    chartCard: { 
        backgroundColor: 'white', padding: '20px', borderRadius: '16px', 
        border: '1px solid #e5e7eb', boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
        minWidth: 0, 
    },
    chartContainer: { width: '100%', height: 350, marginTop: 10 },
    chartTitle: { fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color:'#374151', marginBottom: 10 },
  };

  if (loading) return <div style={{padding:40, textAlign:'center', color:'#9ca3af'}}>Calculando finanzas...</div>;

  return (
    <div>
        <div style={styles.toolbar}>
            <div style={{display:'flex', alignItems:'center', gap:10, marginRight:'auto', minWidth:200}}>
                <div style={{backgroundColor:'#eff6ff', padding:8, borderRadius:8}}><DollarSign color="#2563eb" size={20}/></div>
                <div>
                    <h3 style={{margin:0, color:'#1f2937', fontSize:'1.1rem'}}>Finanzas</h3>
                    <span style={{fontSize:'0.8rem', color:'#6b7280'}}>Resumen de egresos</span>
                </div>
            </div>

            <div style={styles.selectGroup}>
                <span style={styles.labelSelect}>Año</span>
                <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)} style={styles.select}>
                    {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>

            <div style={styles.selectGroup}>
                <span style={styles.labelSelect}>Mes</span>
                <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={styles.select}>
                    <option value="Todos">Todos</option>
                    {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
            </div>

            <div style={styles.selectGroup}>
                <span style={styles.labelSelect}>Categoría</span>
                <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={styles.select}>
                    <option value="Todas">Todas</option>
                    {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
            </div>

            <div style={styles.selectGroup}>
                <span style={styles.labelSelect}>Proveedor</span>
                <select value={filtroProv} onChange={e => setFiltroProv(e.target.value)} style={styles.select}>
                    <option value="Todos">Todos</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
            </div>

            <div style={styles.selectGroup}>
                <span style={styles.labelSelect}>Estado Pago</span>
                <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={styles.select}>
                    <option value="Todos">Todos</option>
                    <option value="Pagado">Pagado</option>
                    <option value="Pendiente">Pendiente</option>
                </select>
            </div>
        </div>

        <div style={styles.gridKpi}>
            <div style={styles.kpiCard('#e5e7eb', 'white')}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                    <span style={styles.kpiTitle}>Gasto Total</span>
                    <TrendingUp size={20} color="#6b7280"/>
                </div>
                <span style={styles.kpiValue}>{fmt(kpis.gastosTotales)}</span>
            </div>

            <div style={styles.kpiCard('#fecaca', '#fef2f2')}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                    <span style={{...styles.kpiTitle, color:'#991b1b'}}>Deuda Pendiente</span>
                    <AlertCircle size={20} color="#dc2626"/>
                </div>
                <span style={{...styles.kpiValue, color:'#991b1b'}}>{fmt(kpis.deudaPendiente)}</span>
            </div>

            <div style={styles.kpiCard('#bbf7d0', '#f0fdf4')}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                    <span style={{...styles.kpiTitle, color:'#166534'}}>Pagado Real</span>
                    <CheckCircle size={20} color="#16a34a"/>
                </div>
                <span style={{...styles.kpiValue, color:'#166534'}}>{fmt(kpis.pagadoReal)}</span>
            </div>
        </div>

        <div style={styles.chartRow}>
            {/* GRÁFICO 1: GASTOS POR CATEGORÍA (Horizontal) */}
            <div style={styles.chartCard}>
                <div style={styles.chartTitle}><PieChart size={20}/> Distribución por Categoría</div>
                
                {dataCategorias.length === 0 ? (
                    <div style={{height: 350, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontStyle:'italic'}}>
                        Sin datos para mostrar
                    </div>
                ) : (
                    <div style={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={dataCategorias} 
                                layout="vertical" 
                                // AUMENTAMOS margen derecho (right: 90) para que quepa el dinero
                                margin={{top: 5, right: 90, left: 30, bottom: 5}} 
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6"/>
                                <XAxis type="number" hide/>
                                <YAxis 
                                    type="category" 
                                    dataKey="name" 
                                    width={100} 
                                    tick={{fontSize:11, fill:'#4b5563', fontWeight:500}} 
                                    axisLine={false} 
                                    tickLine={false}
                                />
                                <Tooltip 
                                    formatter={(value) => fmt(value)} 
                                    cursor={{fill: '#f9fafb'}}
                                    contentStyle={{borderRadius:8, border:'none', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={25}>
                                    {dataCategorias.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS_CAT[index % COLORS_CAT.length]} />
                                    ))}
                                    {/* Etiqueta a la derecha */}
                                    <LabelList dataKey="value" content={(props) => renderExternalLabel({...props, orientation: 'right'})} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* GRÁFICO 2: ESTADO DE PAGOS (Vertical) */}
            <div style={styles.chartCard}>
                <div style={styles.chartTitle}><BarChart3 size={20}/> Estado de Pagos</div>
                
                <div style={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                            data={dataEstado} 
                            // AUMENTAMOS margen superior (top: 30) para que quepa el dinero
                            margin={{top: 30, right: 20, left: 20, bottom: 5}}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                            <XAxis 
                                dataKey="name" 
                                tick={{fontSize:12, fontWeight:'bold', fill:'#4b5563'}} 
                                axisLine={false} 
                                tickLine={false}
                            />
                            <YAxis hide/>
                            <Tooltip 
                                formatter={(value) => fmt(value)} 
                                cursor={{fill: '#f9fafb'}}
                                contentStyle={{borderRadius:8, border:'none', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}
                            />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={60}>
                                {dataEstado.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS_ESTADO[entry.name] || '#9ca3af'} />
                                ))}
                                {/* Etiqueta arriba */}
                                <LabelList dataKey="value" content={(props) => renderExternalLabel({...props, orientation: 'top'})} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    </div>
  );
}