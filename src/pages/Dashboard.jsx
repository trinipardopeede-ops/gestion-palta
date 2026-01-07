import { useState } from 'react'
import { LayoutDashboard, Wallet, Sprout } from 'lucide-react'

import DashboardSectores from './DashboardSectores' 
import DashboardFinanzas from './DashboardFinanzas' 
import DashboardCosecha from './DashboardCosecha'

function Dashboard() {
  const [activeTab, setActiveTab] = useState('sectores')

  // Se eliminó la pestaña "Trabajos" (Labores) ya que era redundante con el menú lateral
  const tabs = [
    { id: 'sectores', label: 'Sectores', icon: <LayoutDashboard size={18} /> },
    { id: 'finanzas', label: 'Finanzas', icon: <Wallet size={18} /> },
    { id: 'cosecha', label: 'Cosecha', icon: <Sprout size={18} /> }
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'sectores': return <DashboardSectores />
      case 'finanzas': return <DashboardFinanzas />
      case 'cosecha':  return <DashboardCosecha />
      default: return null
    }
  }

  const styles = {
    container: { padding: '20px', maxWidth: '1400px', margin: '0 auto' },
    header: { marginBottom: '25px' },
    title: { fontSize: '1.8rem', fontWeight: 'bold', color: '#111827', margin: 0 },
    subtitle: { color: '#6b7280', marginTop: '5px' },
    
    tabsContainer: { 
        display: 'flex', gap: '8px', padding: '5px', backgroundColor: '#e5e7eb', 
        borderRadius: '12px', width: 'fit-content', marginBottom: '30px' 
    },
    tab: (isActive) => ({
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
      fontWeight: '600', fontSize: '0.9rem', transition: 'all 0.2s',
      backgroundColor: isActive ? 'white' : 'transparent',
      color: isActive ? '#1f2937' : '#6b7280',
      boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
    }),
    contentArea: { animation: 'fadeIn 0.3s ease-in-out' }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Panel de Control</h1>
        <div style={styles.subtitle}>Resumen general de tu campo</div>
      </div>

      <div style={styles.tabsContainer}>
        {tabs.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)}
            style={styles.tab(activeTab === tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.contentArea}>
        {renderContent()}
      </div>
    </div>
  )
}
export default Dashboard