import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'

// VISTAS PRINCIPALES
import Dashboard from './pages/Dashboard'
import Cosechas from './pages/Cosechas' // Vista de ingreso de datos
import Labores from './pages/Labores'
import Riego from './pages/Riego'
import Bodega from './pages/Bodega'

// GESTIÓN Y FINANZAS
import OfertasComerciales from './pages/OfertasComerciales' 
import Gastos from './pages/Gastos'
import Bitacora from './pages/Bitacora'
import CuentasSocios from './pages/CuentasSocios' // <--- NUEVO

// CONFIGURACIÓN Y MAESTROS
import Clientes from './pages/Clientes'
import Proveedores from './pages/Proveedores'
import Categorias from './pages/Categorias' // <--- NUEVO
import ConfiguracionCampo from './pages/ConfiguracionCampo'

// DETALLES ESPECÍFICOS
import DetalleSector from './pages/DetalleSector'

function App() {
  const styles = {
    layout: {
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    },
    mainContent: {
      flex: 1,
      padding: '20px',
      overflowY: 'auto',
      height: '100vh',
      boxSizing: 'border-box'
    }
  }

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.mainContent}>
        <Routes>
          {/* DASHBOARD UNIFICADO */}
          <Route path="/" element={<Dashboard />} />
          
          {/* OPERACIONES */}
          <Route path="/cosechas" element={<Cosechas />} />
          <Route path="/labores" element={<Labores />} />
          <Route path="/riego" element={<Riego />} />
          <Route path="/bodega" element={<Bodega />} />
          
          {/* VISTA DETALLE */}
          <Route path="/sector/:id" element={<DetalleSector />} />

          {/* GESTIÓN */}
          <Route path="/ofertas-comerciales" element={<OfertasComerciales />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/cuentas-socios" element={<CuentasSocios />} />
          <Route path="/bitacora" element={<Bitacora />} />

          {/* CONFIGURACIÓN */}
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/configuracion" element={<ConfiguracionCampo />} />
        </Routes>
      </main>
    </div>
  )
}

export default App