# Auditoría final de publicación — Canedo Devkit

**Dictamen: NO APTO para publicar el árbol completo en su estado actual.** El núcleo supera sus pruebas locales; la selección de distribución, licencia propia y experiencia de instalación/agentes necesitan correcciones. Este informe no autoriza publicación ni atribuye todos los cambios previos a esta auditoría.

## Repositorio y publicación efectiva

Comprobaciones ejecutadas: `git rev-parse --show-toplevel`, `git remote -v`, `git branch -vv`, `git status --short`, `git log -1 --oneline`, `git diff --cached --name-only`, `git rev-list --left-right --count HEAD...origin/main`.

- Remoto original: `https://github.com/luisfor/Canedo-Web-Studio.git`.
- Rama actual y destino propuesto: `main`, seguimiento `origin/main`. Rama adicional existente: `sitemap-backup`.
- HEAD: `3ebb378 Expand kit skills across stacks, product references and development workflows`.
- Comparación con referencia local: `0 0`, sin divergencia. No hay archivos preparados en el índice.
- Antes de añadir estos dos informes: 11 archivos rastreados modificados, 204 archivos no rastreados, 359 rastreados y 5898 ignorados.
- El núcleo nuevo de agentes, composición, catálogos y suites aparece sin seguimiento; las mejoras recientes no están incluidas en HEAD ni en el `origin/main` almacenado localmente. Los cambios a README/package/CLI tampoco están comprometidos.
- La comprobación en vivo `GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/usr/bin/false git ls-remote --heads origin main` falló: `Could not resolve host: github.com`. No se afirma que la referencia local refleje el estado remoto actual ni que no exista código equivalente en otro remoto.

No se cambió ningún remoto, rama o índice. No se ejecutó fetch, commit, push, instalación, descarga de repositorios o despliegue.

## Contenido y manifiesto

[Manifiesto de candidatos y exclusiones](PUBLICATION-MANIFEST.json). Contiene nombres exactos de candidatos locales; **no es una lista aprobada para staging**. Se distinguen núcleo, documentación y recursos opcionales heredados. Los cambios de selección requieren revisar vínculos y contratos existentes.

Núcleo: CLI/API/MCP, KIT-FIRST, planificación, doctor, reglas/recetas, herramientas, Docker, memoria, esquemas, pruebas y skills propias. Los generadores comerciales actuales son ejemplos/recursos existentes y se conservan durante esta auditoría. No se propone desarrollar aplicaciones comerciales.

Los recursos de webs, skills heredadas, plantillas y plugins pueden ofrecerse como opcionales, conservando avisos y licencias. El repositorio combina actualmente el kit universal y automatismos de Canedo Studio; no es una distribución mínima del núcleo.

Excluir de una distribución nueva:

- `cazas/`: 24 archivos ignorados de proyectos locales; no se enumeran identidades de clientes.
- `secretos/`: tres configuraciones privadas ignoradas; `.env` local ignorado. No se copiaron sus valores.
- Dependencias instaladas, cachés de Wrangler/QA/scratch, estado `.devkit`, caché derivada, logs, bases, copias y archivos personales.
- Se identificaron 15 bases locales ignoradas y dos archivos de respaldo bajo scratch de automatismos.
- `automatismos/canedostudio-sales-agent/`: conocimiento/prompts específicos de la marca, ajenos al núcleo universal. Los bots adicionales requieren decidir si serán ejemplos opcionales y revisar sus recursos.
- `automatismos/social-media-bot/dist/` y `bundled-test/`: JS compilado, sourcemaps, WASM y una fuente TTF ya rastreados. Hay duplicación y procedencia/licencias pendientes de consolidación.
- Imagen de prueba del bot e informes personales `docs/deployment-audit.md`, `docs/reports/CODEX-MCP-REGISTRATION.md` y `CODEX-PILOT-CONNECTION-CHECK.md`: contienen rutas/datos del entorno local. El informe de deployment también menciona Canedo One; no se modificó ese proyecto ni se encontró una carpeta rastreada homónima en las rutas comprobadas.

**Advertencia sobre Git:** `.gitignore` no elimina archivos rastreados ni historia. No añadir cambios de un artefacto ya rastreado tampoco lo retira del clon público. Separar ese contenido requerirá una acción autorizada sobre el índice/árbol o un artefacto de distribución seleccionado. No se hizo ninguna eliminación, traslado o reescritura.

## Secretos e historial

Análisis automatizado del conjunto rastreado y no rastreado no ignorado, con reglas de rutas privadas, formatos de tokens/claves, credenciales en URL y asignaciones sensibles. Los archivos mayores de 8 MiB quedan fuera del análisis de contenido. Los archivos ignorados se inventariaron por nombre/categoría, sin exportar contenido privado.

Se revisaron 1101 objetos alcanzables de las referencias locales y 682 blobs de hasta 8 MiB. No se confirmó una credencial activa. Esto **no certifica ausencia de secretos** ni examina objetos inalcanzables, todos los formatos posibles o referencias remotas desconocidas.

- Una coincidencia de formato de token permanece en el WASM rastreado; no se considera una credencial confirmada ni se muestra su valor. Requiere clasificación o exclusión del artefacto.
- La URL con credenciales detectada en `tests/kit/tool-catalog.test.js` es una prueba de rechazo, no prueba de una cuenta real.
- Existió `.env` en el historial (`10fa420`, retirado de seguimiento en `a0cfd61`). El campo OpenRouter revisado contiene un marcador genérico y OpenAI está vacío; no se identificó allí una clave activa.
- `.agents/mcp_config.json` contiene configuración n8n genérica/local y `N8N_API_KEY` vacío. No es el registro personal global de Canedo Devkit. Debe presentarse como ejemplo optativo, no conexión activa.
- Coincidencias de rutas en referencias de terceros son mayormente ejemplos Linux/Windows genéricos. Los tres informes citados sí requieren exclusión o anonimización.

El `.gitignore` actual protege `.env`, `secretos/`, clientes, dependencias y caché propia. Faltan reglas generales o una selección explícita para estado `.devkit`, bases/logs/backups y artefactos de build. Añadir patrones exige preservar fixtures y ejemplos necesarios. No se modificó durante esta auditoría.

## README y experiencia de una persona nueva

| Requisito | Estado |
|---|---|
| Qué es el kit | Presente, pero la identidad inicial sigue centrada en Canedo Studio/webs; debe priorizar el asistente universal |
| Capacidades y límites | Bien diferenciados en varias tablas; métricas históricas aparecen como actuales y deben consolidarse |
| Requisitos | Node/npm descritos sin mínimo coherente en la raíz; falta `engines` |
| Instalación | Clone/ZIP y `npm ci` documentados; la instalación limpia real no se ejecutó |
| Diagnósticos | Comandos de catálogo/doctor reales; generación de comandos no equivale a instalación |
| CLI | Comandos existentes, incluidos planes técnicos en español |
| MCP Codex | Ejemplos genéricos disponibles; las herramientas progresivas están en guía separada; conexión de cliente real sin demostrar |
| Gemini y Claude | Instrucciones/skills y campos STDIO genéricos; faltan configuración concreta revisada y pruebas de clientes reales; no prometer integración completa |
| Herramientas y planes | Catálogos/recursos reutilizados; FastAPI consultivo funciona, sin generador de aplicación FastAPI certificado |
| Eficiencia | Guía y comandos existentes, límites y métricas separados de tokens reales |
| Pruebas y resolución de problemas | Suites reales; falta un recorrido público de MCP/SQLite/localhost para principiantes |
| Actualización/desinstalación | Se advierte sobre archivos privados, pero no hay procedimiento completo para actualizar conservando personalizaciones ni retirar MCP/skills sin borrar proyectos |

Se comprobaron **235 vínculos locales del README, cero destinos ausentes** en el árbol actual. Excluir automatismos exige reescribir navegación antes de publicar. No se probaron demos ni URLs externas. La evidencia histórica 52/52 agrupada no debe interpretarse como 52 capacidades ejercitadas; el runner actual separa omisiones internas.

Pendientes de metadatos: nombre npm de carpeta local, descripción pegada del README, URLs `[TU-USUARIO]/[TU-REPO]`, ausencia de `engines` y de allowlist `files`. AJV es dependencia de ejecución del CLI/API/MCP pero figura únicamente en `devDependencies`; instalaciones de producción que omitan desarrollo no garantizan funcionamiento. `npm ci` completo sí incluye AJV.

El README recomienda `npm ci` sin aclarar los scripts de instalación de Puppeteer, que pueden descargar un navegador. Debe ofrecerse un recorrido mínimo revisado (por ejemplo instalación sin scripts para el núcleo) y explicar las limitaciones de las funciones opcionales. No se ejecutó esa instalación.

## Licencias y seguridad

`package.json` declara ISC pero **no existe LICENSE en la raíz**. Debe confirmarse titularidad y alcance, y añadir el texto de licencia elegido; no se cambió unilateralmente la licencia.

Metadatos del lockfile raíz: 87 paquetes con licencia declarada (54 MIT, 12 Apache-2.0, 13 BSD-3-Clause, 6 ISC, 1 BSD-2-Clause y 1 opción WTFPL OR MIT), ninguno sin campo. Las siete dependencias directas tienen metadatos de licencia. Es un inventario, no una auditoría de todas las licencias de código incorporado ni de los lockfiles anidados; no se ejecutó auditoría de vulnerabilidades en red.

REA conserva LICENSE MIT. El plugin n8n conserva MIT, NOTICES y copia Apache-2.0 para archivos adaptados. El esquema Compose incluye licencia y aviso. Conservarlos si se incluyen esos recursos.

AppFlowy, Clone Wars, AFPVentas y Vocero constan como referencias, no importaciones automáticas. El catálogo prohíbe importar código de las primeras referencias comerciales. No se ha cotejado todo archivo con sus repositorios de origen ni todos los avisos de WASM/fonts/bundles; su procedencia sigue pendiente. Un enlace público no autoriza redistribuir cualquier código.

`docs/security/README.md` documenta límites: no regenerar destinos existentes, controles de hashes/rutas, conexiones externas deshabilitadas, comandos de instalación manuales y Compose sin arranque automático. Falta un canal/procedimiento público de reporte de vulnerabilidades y resolver el contenido de publicación. Estos controles no certifican los clientes externos ni impiden escrituras fuera de las APIs del kit.

## Pruebas ejecutadas y no ejecutadas

1. `npm run kit:validate`: **14 skills y 24 perfiles válidos**.
2. `npm run test:kit` en sandbox: 411/419 aprobadas, ocho fallos de HTTP localhost bloqueado; no se presenta como éxito.
3. Mismo comando con permiso de localhost: **419/419 aprobadas**, cero fallos/omisiones del runner principal, 42304.4975 ms. Las omisiones internas de ejemplos se contabilizan por separado.
4. `npm pack --dry-run --ignore-scripts --json`: no crea ni publica paquete. Selección automática actual: **552 entradas, 24815709 bytes sin comprimir**, sin LICENSE raíz; incluye automatismos e informes que deben excluirse. Este diagnóstico de npm complementa, pero no sustituye la selección de archivos de GitHub.
5. Copia temporal de 502 archivos candidatos, sin clientes, secretos, automatismos ni tres informes privados. Sin dependencias instaladas fallan catálogo/validación/plan por ausencia de AJV, como es esperable. Reutilizando las dependencias existentes mediante `NODE_PATH`, los tres funcionan. Plan exacto: `Crear una API con Python y FastAPI`; resultado `technical-project-plan`, `ok: true`, `status: needs-decisions`, recursos presentes, **sin aplicación generada**.

La copia es una simulación de selección, no una instalación independiente ni una release ya validada. No ejecutó `npm ci`, descargas, contenedores o procesos de los proyectos de clientes. No se certificaron Windows/Linux ni conexiones reales Codex/Gemini/Claude. No se repitieron pruebas MCP previas.

Pendiente después de corregir y autorizar: clon/ZIP limpio con dependencia mínima instalada, recorridos CLI y MCP reales por cliente, pruebas nativas macOS/Windows/Linux y revisión de licencias/secretos del artefacto final exacto.

## Preparación y comandos futuros — NO EJECUTADOS

Orden propuesto: confirmar selección y licencia; corregir documentación/metadatos; anonimizar/excluir informes; decidir cómo retirar los artefactos ya rastreados sin perder copias locales; validar selección limpia; volver a revisar diff, secretos y licencias; solicitar aprobación del commit y luego del push. No cambiar remoto ni crear repositorio nuevo.

Después de esas correcciones y aprobaciones, usar una lista de **archivos exactos** revisados, no `git add .`. El manifiesto JSON actual no se pasa directamente a Git. Si se aprueba, se preparará `publication-approved-files.txt` como pathspec literal revisado y se revisarán por separado las exclusiones de contenido ya rastreado.

```sh
# Comandos propuestos, no ejecutados. La lista aprobada todavía no existe.
git add --pathspec-from-file=publication-approved-files.txt
git diff --cached --name-status
git diff --cached --check
# Revisar el diff de forma privada; no imprimir secretos en informes.
git commit -m "Prepare Canedo Devkit universal distribution"
git push origin main
```

Commit y push requieren aprobación explícita; los comandos anteriores no son autorización. No se propone reescritura del historial sin una necesidad demostrada y autorización específica. No se borró, trasladó ni modificó contenido existente del kit; únicamente se añadieron este informe y el manifiesto de preparación.
