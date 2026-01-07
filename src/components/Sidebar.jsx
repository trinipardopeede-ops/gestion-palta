import { Link, useLocation } from 'react-router-dom'
import { 
  TrendingUp, 
  Sprout, 
  Shovel, 
  Droplet, 
  Package, 
  FileText, 
  DollarSign, 
  StickyNote, 
  Briefcase, 
  Truck, 
  MapPin,
  Users, // <--- Nuevo icono para Socios
  Tags   // <--- Nuevo icono para Categorías
} from 'lucide-react'

function Sidebar() {
  const location = useLocation()
  const currentPath = location.pathname

  const styles = {
    sidebar: {
      width: '250px',
      backgroundColor: '#1f2937', 
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      boxSizing: 'border-box',
      flexShrink: 0 
    },
    logo: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      marginBottom: '30px',
      color: '#4ade80', 
      textAlign: 'center',
      borderBottom: '1px solid #374151',
      paddingBottom: '20px'
    },
    sectionTitle: {
      fontSize: '0.75rem',
      textTransform: 'uppercase',
      color: '#9ca3af', 
      fontWeight: 'bold',
      marginTop: '20px',
      marginBottom: '10px',
      letterSpacing: '1px'
    },
    navItem: (isActive) => ({
      display: 'flex',
      alignItems: 'center',
      padding: '10px 12px',
      marginBottom: '5px',
      borderRadius: '8px',
      textDecoration: 'none',
      color: isActive ? 'white' : '#d1d5db',
      backgroundColor: isActive ? '#374151' : 'transparent',
      transition: 'background-color 0.2s',
      fontWeight: isActive ? 'bold' : 'normal',
      cursor: 'pointer'
    }),
    icon: {
      marginRight: '10px'
    }
  }

  // Componente interno para cada enlace
  const NavItem = ({ to, icon, label }) => {
    const isActive = currentPath === to
    return (
      <Link to={to} style={styles.navItem(isActive)}>
        <span style={styles.icon}>{icon}</span>
        {label}
      </Link>
    )
  }

  return (
    <nav style={styles.sidebar}>
      <div style={styles.logo}>Gestión Palta 🥑</div>

      <NavItem to="/" icon={<TrendingUp size={20}/>} label="Dashboard" />

      <div style={styles.sectionTitle}>OPERACIONES</div>
      <NavItem to="/cosechas" icon={<Sprout size={20}/>} label="Cosechas" />
      <NavItem to="/labores" icon={<Shovel size={20}/>} label="Labores" />
      <NavItem to="/riego" icon={<Droplet size={20}/>} label="Riego" />
      <NavItem to="/bodega" icon={<Package size={20}/>} label="Bodega" />

      <div style={styles.sectionTitle}>GESTIÓN</div>
      <NavItem to="/ofertas-comerciales" icon={<FileText size={20}/>} label="Ofertas / Precios" />
      <NavItem to="/gastos" icon={<DollarSign size={20}/>} label="Gastos" />
      <NavItem to="/cuentas-socios" icon={<Users size={20}/>} label="Cuentas Socios" /> {/* Agregado */}
      <NavItem to="/bitacora" icon={<StickyNote size={20}/>} label="Bitácora" />

      <div style={styles.sectionTitle}>CONFIGURACIÓN</div>
      <NavItem to="/clientes" icon={<Briefcase size={20}/>} label="Clientes" />
      <NavItem to="/proveedores" icon={<Truck size={20}/>} label="Proveedores" />
      <NavItem to="/categorias" icon={<Tags size={20}/>} label="Categorías" /> {/* Agregado */}
      <NavItem to="/configuracion" icon={<MapPin size={20}/>} label="Campo (Sectores)" />
    </nav>
  )
}

export default Sidebar