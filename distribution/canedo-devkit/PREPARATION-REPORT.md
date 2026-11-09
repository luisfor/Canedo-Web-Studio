# Distribución Canedo Devkit — estado de preparación

**Estado actual: APTO CON PENDIENTES; sin publicación.** El [informe de cierre](PREPUBLICATION-CLOSURE.md) sustituye los pendientes documentales anteriores: ISC aprobada y aplicada al código original con titular declarado CanedoStudio, y canal privado autorizado contacto@canedostudio.com. Los terceros conservan sus términos. La instalación limpia sigue **PENDIENTE DE VERIFICACIÓN** por decisión del propietario.

## Selección conservada

CLI/API/MCP, catálogos, doctor, reglas/versiones y recetas manuales, entornos/Docker, KIT-FIRST, memoria/eficiencia, generadores propios de ejemplo y pruebas. Hay 11 skills, 24 perfiles y 80 herramientas catalogadas; no son 80 SDKs probados. Se excluyeron las tres skills de marketing de marca, aplicaciones de clientes/automatismos, configuraciones personales, informes privados, plugins n8n y artefactos ajenos al núcleo. Los archivos originales no se borraron ni sobrescribieron.

AJV y cuatro paquetes transitivos son las únicas dependencias del núcleo. No se instalaron. Node >=24. El paquete conserva `private: true` como protección frente a publicación npm accidental, con licencia ISC y remoto previsto solo en metadatos; no se crea repositorio ni se altera ningún remoto real.

## Evidencia histórica y actual

La preparación anterior ejecutó 419/419 regresiones en una copia temporal aislada reutilizando dependencias existentes, más 37/37 pruebas específicas. No equivale a instalación desde cero ni certificación de clientes reales. Los tres ajustes de fixtures fueron conteo de skills, resolución de AJV y ruta de prueba sintética. El cierre actual no cambia el motor ni repite esas regresiones: verifica contenido, sintaxis, licencias, enlaces e integridad. [Validación](docs/validation.md).

[Manifiesto](DISTRIBUTION-MANIFEST.json) · [procedencia y exclusiones](SOURCE-PROVENANCE.json) · [lista exacta autorizable](PUBLICATION-FILES.txt). Los hashes no acreditan titularidad por sí solos y el manifiesto no se firma. [Licencia y alcance de la revisión local](LICENSE-PROPOSAL.md) · [terceros](THIRD-PARTY-NOTICES.md).

Repositorio previsto: `luisfor/canedo-devkit`, independiente del histórico. No se comprueba su existencia/disponibilidad ni se crea. Publicar esta subcarpeta dentro del repositorio histórico no eliminaría su contenido previo; no se propone alterar el histórico.

## Publicación posterior — no ejecutada ni autorizada

Solo después de aprobación expresa para cada operación, usar la raíz limpia y la URL elegida. La lista pública es inventario, no un comando de staging ni aprobación automática.

```sh
cd /ruta/canedo-devkit
node tools/verify-distribution.cjs
# Tras autorización de creación, commit y push:
git init -b main
git remote add origin https://github.com/luisfor/canedo-devkit.git
# Preparar lista literal revisada de rutas para staging.
git add --pathspec-from-file=publication-approved-files.txt
git diff --cached --name-status
git diff --cached --check
git commit -m "Prepare Canedo Devkit standalone distribution"
git push -u origin main
```

La lista aprobada de staging todavía no existe. No usar `git add .` en el proyecto original. No se ha ejecutado ninguno de los comandos de publicación anteriores. No hay instalaciones, descargas, configuraciones globales, repositorios nuevos ni modificaciones de proyectos ajenos.
