import { useEffect } from 'react'
import { X } from 'lucide-react'

function Modal({ isOpen, onClose, title, children }) {
  
  // Manejo inteligente de la tecla ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        // 1. Preguntamos si el formulario hijo tiene una regla de bloqueo (cambios sin guardar)
        if (typeof window.intentarCerrarModal === 'function') {
           window.intentarCerrarModal(); // El hijo decide si cierra o pregunta
        } else {
           onClose(); // Si no hay bloqueo, cerramos directo
        }
      }
    }
    
    if (isOpen) {
        window.addEventListener('keydown', handleEsc)
        // Bloquear scroll del fondo
        document.body.style.overflow = 'hidden';
    }

    return () => {
        window.removeEventListener('keydown', handleEsc)
        // Reactivar scroll del fondo
        document.body.style.overflow = 'unset';
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const styles = {
    overlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)', 
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.2s'
    },
    container: {
      backgroundColor: 'white',
      borderRadius: '12px',
      width: '90%', maxWidth: '900px',
      maxHeight: '90vh', 
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
    },
    header: {
      padding: '20px', borderBottom: '1px solid #e5e7eb',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    },
    title: { margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' },
    closeBtn: {
      background: 'none', border: 'none', cursor: 'pointer',
      color: '#6b7280', padding: '8px', borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background-color 0.2s'
    },
    content: {
      padding: '20px',
      overflowY: 'auto' 
    }
  }

  // Wrapper para interceptar clic fuera del modal
  const handleOverlayClick = () => {
      if (typeof window.intentarCerrarModal === 'function') {
          window.intentarCerrarModal();
      } else {
          onClose();
      }
  }

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.container} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button style={styles.closeBtn} onClick={handleOverlayClick} title="Cerrar (Esc)">
            <X size={24} />
          </button>
        </div>
        <div style={styles.content}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default Modal