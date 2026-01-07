import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { DollarSign, TrendingUp, AlertCircle, CheckCircle, Filter } from 'lucide-react';

export default function DashboardFinanzas() {
  const [loading, setLoading] = useState(true);
  const [gastos, setGastos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtroCat, setFiltroCat] = useState('Todas');
  
  const [kpis, setKpis] = useState({ gastosTotales: 0, deudaPendiente: 0, pagadoReal: 0 });
  const [gastosPorCat, setGastosPorCat] = useState([]);
  const [comparativaEstado, setComparativaEstado] = useState([]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const COLORS_ESTADO = ['#10b981', '#ef4444']; 

  useEffect(() => {
    fetchData();
  }, []);

  // Recalcular KPIs cuando cambia filtro o datos
  useEffect(() => {
      calcularMetricas()
  }, [filtroCat, gastos])

  const fetchData = async () => {
    setLoading(true);
    try {
      // Cargar categorías para el filtro
      const { data: cats } = await supabase.from('categorias_gastos').select('nombre').order('nombre');
      if(cats) setCategorias(cats.map(c => c.nombre));

      // Cargar gastos
      const { data } = await supabase
        .from('gastos')
        .select(`monto, estado_pago, categorias_gastos ( nombre )`);
      
      if (data) setGastos(data);

    } catch (error) {
      console.error("Error finanzas:", error);
    } finally {
      setLoading(false);
    }
  };

  const calcularMetricas = () => {
      if (!gastos) return;

      // 1. Filtrar
      const filtrados = filtroCat === 'Todas' 
        ? gastos 
        : gastos.filter(g => g.categorias_gastos?.nombre === filtroCat);

      // 2. KPIs
      const total = filtrados.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
      const pendiente = filtrados
          .filter(g => g.estado_pago === 'Pendiente' || g.estado_pago === 'Parcial')
          .reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
      const pagado = total - pendiente;

      setKpis({ gastosTotales: total, deudaPendiente: pendiente, pagadoReal: pagado });

      // 3. Gráfico Torta
      const porCategoria = {};
      filtrados.forEach(g => {
          const catName = g.categorias_gastos?.nombre || 'Sin Categoría';
          porCategoria[catName] = (porCategoria[catName] || 0) + (parseFloat(g.monto) || 0);
      });

      const dataPie = Object.keys(porCategoria).map(key => ({
          name: key, value: porCategoria[key]
      })).sort((a, b) => b.value - a.value);
      
      setGastosPorCat(dataPie);

      // 4. Gráfico Barras
      setComparativaEstado([
          { name: 'Pagado', valor: pagado },
          { name: 'Por Pagar', valor: pendiente }
      ]);
  }

  const fmt = (num) => `$ ${(num || 0).toLocaleString('es-CL')}`;

  const styles = {
    header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20 },
    filterContainer: { display:'flex', alignItems:'center', gap:10 },
    select: { padding:'8px 12px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'0.9rem' },
    
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' },
    card: { backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6' },
    label: { fontSize: '0.85rem', color: '#6b7280', marginBottom: '5px' },
    number: { fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' },
    chartContainer: { backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6', height: '350px', display: 'flex', flexDirection: 'column' }
  };

  if (loading) return <div style={{padding:20, color:'#6b7280'}}>Cargando finanzas...</div>;

  return (
    <div>
        <div style={styles.header}>
            <h3 style={{margin:0, color:'#374151'}}>Resumen Financiero</h3>
            <div style={styles.filterContainer}>
                <Filter size={16} color="#6b7280"/>
                <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={styles.select}>
                    <option value="Todas">Todas las Categorías</option>
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
        </div>

        <div style={styles.grid}>
            <div style={styles.card}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                    <div>
                        <div style={styles.label}>Gastos Totales</div>
                        <div style={styles.number}>{fmt(kpis.gastosTotales)}</div>
                    </div>
                    <DollarSign size={24} color="#3b82f6" />
                </div>
            </div>

            <div style={{...styles.card, borderLeft:'4px solid #ef4444'}}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                    <div>
                        <div style={styles.label}>Deuda Pendiente</div>
                        <div style={{...styles.number, color:'#ef4444'}}>{fmt(kpis.deudaPendiente)}</div>
                    </div>
                    <AlertCircle size={24} color="#ef4444" />
                </div>
            </div>

            <div style={{...styles.card, borderLeft:'4px solid #10b981'}}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                    <div>
                        <div style={styles.label}>Total Pagado</div>
                        <div style={{...styles.number, color:'#10b981'}}>{fmt(kpis.pagadoReal)}</div>
                    </div>
                    <CheckCircle size={24} color="#10b981" />
                </div>
            </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            <div style={styles.chartContainer}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '10px', color: '#374151' }}>Gastos por Categoría</h3>
                <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}> 
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={gastosPorCat} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                {gastosPorCat.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => fmt(value)} />
                            <Legend layout="vertical" verticalAlign="middle" align="right" />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div style={styles.chartContainer}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '10px', color: '#374151' }}>Estado de Cuentas</h3>
                <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparativaEstado} layout="vertical" margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" tickFormatter={(val) => `$${val/1000}k`} />
                            <YAxis type="category" dataKey="name" width={80} />
                            <Tooltip formatter={(value) => fmt(value)} cursor={{fill: 'transparent'}} />
                            <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                                {comparativaEstado.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS_ESTADO[index % 2]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    </div>
  );
}