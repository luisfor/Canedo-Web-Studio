# Instalación

## Opción 1: descargar el kit completo

Descarga el ZIP desde GitHub (Code → Download ZIP), descomprímelo y abre la
carpeta en tu asistente de programación compatible con skills.

También puedes clonarlo:

```bash
git clone https://github.com/luisfor/Canedo-Web-Studio.git
cd Canedo-Web-Studio
npm ci
```

Necesitas Node.js y npm para los scripts del proyecto. Las instrucciones de
Codex están en `.agents/skills/` y las de Claude Code en `.claude/skills/`.
Usa tu propia cuenta del asistente. Configura únicamente las integraciones
que necesites: las claves de proveedores de imágenes, chatbots y automatismos
son independientes de la cuenta del asistente.

Copia `.env.example` a `.env` si vas a usar las integraciones indicadas allí
y rellena tus propias claves. Nunca publiques ese archivo. No pongas claves
privadas de proveedores en HTML o JavaScript que llegue al navegador.

Las configuraciones de los bots contienen marcadores `YOUR_…`: crea tus propios
recursos y sustituye los marcadores antes de desplegar. Consulta el README de
cada bot. El kit no incluye cuentas, credenciales ni bases de datos del autor.

## Opción 2: instalar solamente la skill REA

Con Node.js y npm, desde la carpeta de tu proyecto:

```bash
npx skills add https://github.com/luisfor/Canedo-Web-Studio --skill reverse-engineer-anything
```

Revisa las opciones que muestre el instalador para seleccionar tu asistente
y el alcance de instalación. La skill original procede de
[morluto/rea](https://github.com/morluto/rea) y conserva su licencia MIT.
Las otras skills del kit no se instalan con este comando.

## Opción 3: REA con herramientas de análisis

Instalar la skill solo agrega instrucciones. Para conectar el servidor MCP
y las instrucciones compatibles con la versión publicada de REA:

```bash
npx rea-agents@latest setup
```

Selecciona tu asistente, revisa los cambios propuestos y reinícialo cuando
el instalador lo indique. Consulta los requisitos actuales y los motores
opcionales en la [guía oficial de REA](https://github.com/morluto/rea/blob/main/docs/installation.md).
Este comando configura REA; no instala todo el Kit Agencia Web.

## Archivos privados y actualizaciones

`.env`, `secretos/`, `cazas/`, dependencias y configuraciones locales están
excluidos mediante `.gitignore`. Revisa siempre los cambios antes de subirlos:
Git no elimina automáticamente información que ya esté versionada ni borra
su historial. Las configuraciones originales de esta máquina se conservan
solo en `secretos/config-original-privada/` cuando existe esa carpeta.
