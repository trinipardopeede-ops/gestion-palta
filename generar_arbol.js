import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIGURACIÓN
const SRC_DIR = path.join(__dirname, 'src');
const OUTPUT_FILE = 'arbol_de_dependencias.txt';

// Extensiones a buscar
const EXTENSIONS = ['.jsx', '.js'];

// Función para verificar si existe el archivo con extensiones
function resolveFile(basePath) {
  if (fs.existsSync(basePath) && fs.lstatSync(basePath).isFile()) return basePath;
  for (const ext of EXTENSIONS) {
    if (fs.existsSync(basePath + ext)) return basePath + ext;
  }
  return null;
}

// Función recursiva para construir el árbol
function buildTree(filePath, currentDepth = 0, visited = new Set()) {
  const fileName = path.basename(filePath);
  let output = '';
  
  // Evitar ciclos infinitos (A importa a B, B importa a A)
  if (visited.has(filePath)) {
    return `${'    '.repeat(currentDepth)}└── ${fileName} (🔄 Ciclo detectado)\n`;
  }
  
  // Agregamos al set de visitados solo para esta rama
  const newVisited = new Set(visited);
  newVisited.add(filePath);

  // Formato visual del árbol
  const indent = '    '.repeat(currentDepth);
  const icon = currentDepth === 0 ? '📦' : '└──';
  output += `${indent}${icon} ${fileName}\n`;

  // Leer contenido
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Regex para buscar imports: import ... from "..."
    const importRegex = /import\s+(?:.*?\s+from\s+)?['"](.*?)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];

      // Ignorar librerías externas (react, lucide, supabase, etc.)
      // Solo queremos archivos que empiecen con . (./ o ../)
      if (importPath.startsWith('.')) {
        const dirOfCurrentFile = path.dirname(filePath);
        const resolvedPath = resolveFile(path.join(dirOfCurrentFile, importPath));

        if (resolvedPath) {
          // LLAMADA RECURSIVA: Aquí sucede la magia de la cascada
          output += buildTree(resolvedPath, currentDepth + 1, newVisited);
        }
      }
    }
  } catch (err) {
    output += `${indent}    ❌ Error leyendo archivo\n`;
  }

  return output;
}

// Función principal
function generateReport() {
  console.log('🌳 Generando árbol de dependencias...');
  let fullReport = 'ARBOL DE DEPENDENCIAS DEL PROYECTO\n';
  fullReport += '====================================\n\n';

  // 1. Buscamos archivos principales en /pages para empezar el árbol desde ahí
  const pagesDir = path.join(SRC_DIR, 'pages');
  
  if (fs.existsSync(pagesDir)) {
    const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));
    
    files.forEach(file => {
      const fullPath = path.join(pagesDir, file);
      fullReport += buildTree(fullPath);
      fullReport += '\n' + '-'.repeat(40) + '\n\n';
    });
  } else {
    console.log("⚠️ No encontré la carpeta src/pages");
  }

  fs.writeFileSync(OUTPUT_FILE, fullReport);
  console.log(`✅ ¡Listo! Revisa el archivo: ${OUTPUT_FILE}`);
}

generateReport();