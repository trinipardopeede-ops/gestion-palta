import os

# --- CONFIGURACIÓN ---
# Nombre del archivo de salida
output_file = "contexto_completo.txt"

# Extensiones de archivo que queremos leer (basado en tus pantallazos)
allowed_extensions = {'.js', '.jsx', '.css', '.html', '.json'}

# Carpetas que SIEMPRE debemos ignorar para no ensuciar el contexto
ignore_dirs = {'node_modules', '.git', 'dist', 'build', 'assets', 'public'}

# Archivos específicos a ignorar (opcional)
ignore_files = {'package-lock.json', 'yarn.lock'}

def create_context_file():
    # Obtenemos la ruta actual donde está el script
    root_dir = os.getcwd()
    
    with open(output_file, 'w', encoding='utf-8') as outfile:
        # Escribimos un encabezado explicativo para la IA
        outfile.write(f"--- CONTEXTO DEL PROYECTO: GESTION-PALTA ---\n")
        outfile.write(f"Este archivo contiene todo el código fuente relevante.\n\n")

        # Recorremos todas las carpetas y subcarpetas (os.walk)
        for dirpath, dirnames, filenames in os.walk(root_dir):
            
            # Modificamos 'dirnames' in-place para que os.walk no entre en carpetas ignoradas
            dirnames[:] = [d for d in dirnames if d not in ignore_dirs]
            
            for filename in filenames:
                # Obtenemos la extensión del archivo
                _, ext = os.path.splitext(filename)
                
                # Verificamos si es un archivo que nos interesa y no está en la lista negra
                if ext in allowed_extensions and filename not in ignore_files:
                    file_path = os.path.join(dirpath, filename)
                    # Creamos una ruta relativa para que la IA sepa dónde está el archivo (ej: src/pages/Riego.jsx)
                    relative_path = os.path.relpath(file_path, root_dir)
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as infile:
                            content = infile.read()
                            
                            # Escribimos el formato delimitador claro para la IA
                            outfile.write(f"\n{'='*50}\n")
                            outfile.write(f"RUTA: {relative_path}\n")
                            outfile.write(f"{'='*50}\n")
                            outfile.write(content + "\n")
                            
                        print(f"Agregado: {relative_path}")
                        
                    except Exception as e:
                        print(f"Error leyendo {relative_path}: {e}")

    print(f"\n¡Listo! Archivo '{output_file}' creado exitosamente.")

if __name__ == "__main__":
    create_context_file()