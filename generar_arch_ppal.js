import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputFile = 'archivos_del_menu.txt';

// Lista FILTRADA: Solo las páginas que tienen un botón en el Sidebar
const filesToRead = [
  // --- INICIO ---
  'src/pages/Dashboard.jsx',

  // --- OPERACIONES ---
  'src/pages/Cosechas.jsx',
  'src/pages/Labores.jsx',
  'src/pages/Riego.jsx',
  'src/pages/Bodega.jsx',

  // --- GESTIÓN ---
  'src/pages/OfertasComerciales.jsx',
  'src/pages/Gastos.jsx',
  'src/pages/CuentasSocios.jsx', // (Agregado recientemente)
  'src/pages/Bitacora.jsx',

  // --- CONFIGURACIÓN ---
  'src/pages/Clientes.jsx',
  'src/pages/Proveedores.jsx',
  'src/pages/Categorias.jsx',    // (Agregado recientemente)
  'src/pages/ConfiguracionCampo.jsx'
];

function generateTextFile() {
  let fullContent = '';
  console.log('--- Recopilando solo páginas del Menú ---');

  filesToRead.forEach((relativePath) => {
    const fullPath = path.join(__dirname, relativePath);

    try {
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        fullContent += '================================================================================\n';
        fullContent += `ARCHIVO: ${relativePath}\n`;
        fullContent += '================================================================================\n\n';
        fullContent += content;
        fullContent += '\n\n';
        
        console.log(`✅ Agregado: ${relativePath}`);
      } else {
        console.warn(`⚠️  No existe (¿Aún no lo creas?): ${relativePath}`);
        fullContent += `⚠️ ARCHIVO FALTANTE: ${relativePath}\n\n`;
      }
    } catch (err) {
      console.error(`❌ Error en ${relativePath}:`, err.message);
    }
  });

  try {
    fs.writeFileSync(path.join(__dirname, outputFile), fullContent);
    console.log('------------------------------------------');
    console.log(`🎉 Archivo creado: ${outputFile}`);
  } catch (err) {
    console.error('Error al guardar:', err);
  }
}

generateTextFile();