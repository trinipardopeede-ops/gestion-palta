import os

# --- CONFIGURACIÓN ---
output_file = "pages_completo.txt"
# Definimos la ruta específica que queremos leer
target_folder = os.path.join("src", "pages") 

allowed_extensions = {'.js', '.jsx', '.css'}

def create_pages_context():
    root_dir = os.getcwd()
    # Construimos la ruta completa a la carpeta pages
    pages_path = os.path.join(root_dir, target_folder)

    # Verificamos que la carpeta exista antes de empezar
    if not os.path.exists(pages_path):
        print(f"ERROR: No encuentro la carpeta '{target_folder}'. Asegúrate de ejecutar esto desde la raíz del proyecto.")
        return

    with open(output_file, 'w', encoding='utf-8') as outfile:
        outfile.write(f"--- CONTEXTO ESPECIFICO: CARPETA PAGES ---\n")
        outfile.write(f"Aquí están solo las vistas/páginas de la aplicación.\n\n")

        # Usamos os.walk comenzando directamente en la carpeta 'pages'
        for dirpath, _, filenames in os.walk(pages_path):
            for filename in filenames:
                _, ext = os.path.splitext(filename)
                
                if ext in allowed_extensions:
                    file_path = os.path.join(dirpath, filename)
                    # La ruta relativa se mostrará como 'src/pages/Archivo.jsx'
                    relative_path = os.path.relpath(file_path, root_dir)
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as infile:
                            content = infile.read()
                            
                            outfile.write(f"\n{'='*50}\n")
                            outfile.write(f"RUTA: {relative_path}\n")
                            outfile.write(f"{'='*50}\n")
                            outfile.write(content + "\n")
                            
                        print(f"Agregado: {relative_path}")
                        
                    except Exception as e:
                        print(f"Error leyendo {relative_path}: {e}")

    print(f"\n¡Listo! Archivo '{output_file}' creado con éxito.")

if __name__ == "__main__":
    create_pages_context()