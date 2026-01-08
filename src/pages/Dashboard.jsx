import { useState } from 'react'
import { LayoutDashboard, Wallet, Sprout } from 'lucide-react'

import DashboardSectores from './DashboardSectores' 
import DashboardFinanzas from './DashboardFinanzas' 
import DashboardCosecha from './DashboardCosecha'

function Dashboard() {
  const [activeTab, setActiveTab] = useState('sectores')

  const tabs = [
    { id: 'sectores', label: 'Campo', icon: <LayoutDashboard size={18} /> },
    { id: 'finanzas', label: 'Finanzas', icon: <Wallet size={18} /> },
    { id: 'cosecha', label: 'Producción', icon: <Sprout size={18} /> }
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
    
    // Header flex para alinear título izq y tabs der
    header: { 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '25px',
        flexWrap: 'wrap',
        gap: '15px'
    },
    titleGroup: { display: 'flex', flexDirection: 'column' },
    title: { fontSize: '1.8rem', fontWeight: 'bold', color: '#111827', margin: 0 },
    subtitle: { color: '#6b7280', marginTop: '5px', fontSize:'0.9rem' },
    
    tabsContainer: { 
        display: 'flex', gap: '5px', padding: '4px', backgroundColor: '#e5e7eb', 
        borderRadius: '10px', height: 'fit-content'
    },
    tab: (isActive) => ({
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
      fontWeight: '600', fontSize: '0.9rem', transition: 'all 0.2s',
      backgroundColor: isActive ? 'white' : 'transparent',
      color: isActive ? '#1f2937' : '#6b7280',
      boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
    }),
    contentArea: { animation: 'fadeIn 0.3s ease-in-out' }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleGroup}>
            <h1 style={styles.title}>Dashboard</h1>
            <div style={styles.subtitle}>Visión general del negocio</div>
        </div>

        {/* Pestañas ahora a la derecha */}
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
      </div>

      <div style={styles.contentArea}>
        {renderContent()}
      </div>
    </div>
  )
}
export default Dashboard