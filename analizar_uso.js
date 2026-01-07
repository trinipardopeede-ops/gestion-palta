import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración
const SRC_DIR = path.join(__dirname, 'src');
const OUTPUT_FILE = 'reporte_uso_archivos.txt';

// Función para obtener todos los archivos recursivamente
function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      // Solo nos interesan .js y .jsx
      if (file.endsWith('.jsx') || file.endsWith('.js')) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

// Función principal
function analyzeUsage() {
  console.log('🔍 Escaneando proyecto...');
  const allFiles = getAllFiles(SRC_DIR);
  
  // Mapa: Clave = NombreArchivo, Valor = [Lista de archivos que lo importan]
  const usageMap = {};

  // Inicializar mapa
  allFiles.forEach(f => {
    const relative = path.relative(__dirname, f).replace(/\\/g, '/');
    usageMap[relative] = [];
  });

  // Analizar cada archivo
  allFiles.forEach(sourceFile => {
    const content = fs.readFileSync(sourceFile, 'utf8');
    const sourceRelative = path.relative(__dirname, sourceFile).replace(/\\/g, '/');

    // Buscar imports. Regex simple que captura: import ... from '.../NombreArchivo'
    const importRegex = /from\s+['"](.+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      // Intentamos coincidir el import con nuestros archivos
      // Ejemplo: import X from './components/Modal' -> buscamos Modal.jsx
      const importName = path.basename(importPath);

      // Buscamos en nuestro mapa qué archivo coincide con ese nombre
      for (const fileKey in usageMap) {
        const fileNameNoExt = path.basename(fileKey, path.extname(fileKey));
        
        // Si el nombre del archivo coincide con el import (ej: Modal === Modal)
        if (fileNameNoExt === importName) {
           // Evitar auto-referencias o duplicados
           if (!usageMap[fileKey].includes(sourceRelative)) {
             usageMap[fileKey].push(sourceRelative);
           }
        }
      }
    }
  });

  // Generar Reporte de Texto
  let output = 'REPORTE DE USO DE ARCHIVOS\n';
  output += '============================================\n\n';

  // Ordenar para mostrar primero los componentes más usados
  const sortedFiles = Object.keys(usageMap).sort();

  sortedFiles.forEach(file => {
    const usedBy = usageMap[file];
    
    output += `📂 ARCHIVO: ${file}\n`;
    if (usedBy.length === 0) {
      // Si nadie lo usa, podría ser una página principal o un archivo muerto
      output += `   ⚠️  NO SE ENCONTRARON REFERENCIAS (¿Archivo huérfano o Página Principal?)\n`;
    } else {
      output += `   ✅ Usado en (${usedBy.length} lugares):\n`;
      usedBy.forEach(u => output += `      - ${u}\n`);
    }
    output += '\n--------------------------------------------\n';
  });

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`🎉 Reporte generado: ${OUTPUT_FILE}`);
}

analyzeUsage();