# REA, Clone Wars y AppFlowy

Fuentes revisadas el 1 de noviembre de 2026: README y licencia de los repositorios indicados. No se ejecutaron sus demos, no se compiló AppFlowy y no se conectó un servidor MCP nuevo.

| Recurso | Qué es | Cuándo aporta más | Qué no aporta al instalar las skills |
|---|---|---|---|
| [REA](https://github.com/morluto/rea) | Herramientas de análisis y workflow de agentes | Binarios, paquetes, evidencia de ejecución y reconstrucción de funciones | Motores nativos, MCP conectado o el código original recuperado con certeza |
| [Clone Wars](https://github.com/GorvGoyl/Clone-Wars) | Índice de clones, tutoriales y alternativas | Encontrar proyectos para estudiar implementación y stacks | Un motor de análisis, calidad garantizada o permiso universal para reutilizar |
| [AppFlowy](https://github.com/AppFlowy-IO/AppFlowy) | Aplicación de workspace construida con Flutter y Rust | Documentos, tablas, kanban y colaboración; evaluación de una alternativa a Notion | Un componente React, una skill o un servicio integrado al kit |

## Qué añadimos al kit

Antes existían web estática, SEO, automatismos, reseñas, una arquitectura centrada en Next.js y REA. Ahora hay procedimientos para:

- Seleccionar ejemplos relevantes y revisar código, dependencias y licencia de cada candidato.
- Diseñar documentos por bloques y vistas de tablas/kanban sobre registros compartidos.
- Modelar offline, sincronización, conflictos, permisos y restauración de un workspace.
- Escoger el stack solicitado y construir una función vertical con pruebas específicas.
- Desarrollar los lenguajes, motores de datos, infraestructura y análisis cuantitativo descritos en [CAPACIDADES.md](CAPACIDADES.md).

Estas incorporaciones son skills originales y comandos del kit. No son un fork de AppFlowy ni una importación de todos los clones. No se incluye un adaptador de API AppFlowy: se verifica su existencia y contrato cuando un proyecto lo requiera.

## Flujo conjunto

1. Definir función, plataforma y criterios de aceptación.
2. Buscar una referencia en Clone Wars cuando facilite encontrar código relevante.
3. Verificar el repositorio concreto: función implementada, licencia, estado, requisitos y seguridad de scripts.
4. Leer fuentes con herramientas normales. Si se necesita comprobar comportamiento distribuido o en ejecución, usar REA con un target y efectos delimitados.
5. Registrar observaciones, inferencias, fuentes y decisiones; implementar una solución propia o reutilizar con licencia compatible.
6. Probar el comportamiento implementado. No declarar que un ejemplo educativo es una base de producción solo por su apariencia.

## Licencias y procedencia

- La copia de la skill REA ya incluida conserva MIT y sus avisos. [Licencia original](https://github.com/morluto/rea/blob/main/LICENSE).
- Clone Wars declara AGPLv3 para su repositorio. Aquí se enlaza el índice; no se reproduce su tabla. Cada proyecto enlazado necesita su propia revisión. [Licencia](https://github.com/GorvGoyl/Clone-Wars/blob/main/LICENSE).
- AppFlowy declara AGPLv3. Aquí se enlaza como producto y referencia; no se distribuye su código. Si se modifica o incorpora, revisar las condiciones aplicables antes de distribuir o prestar el servicio. [Licencia](https://github.com/AppFlowy-IO/AppFlowy/blob/main/LICENSE).
- Las nuevas skills no cambian las licencias de terceros. Los plugins ya incluidos conservan sus archivos de licencia y avisos.

Para instalar AppFlowy o compilarlo, seguir su [README](https://github.com/AppFlowy-IO/AppFlowy/blob/main/README.md) y [documentación](https://docs.appflowy.io/docs/documentation/appflowy/from-source). Su instalación es opcional y separada de REA.
