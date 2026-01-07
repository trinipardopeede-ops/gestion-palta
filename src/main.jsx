import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // Si tienes estilos globales
import { BrowserRouter } from 'react-router-dom' // <--- IMPORTANTE

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter> {/* <--- ENVOLVER AQUÍ */}
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)