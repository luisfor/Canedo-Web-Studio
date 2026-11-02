---
name: workspace-colaborativo
description: Diseñar e implementar editores por bloques, documentos, wikis, tablas, kanban y colaboración de equipos; evaluar AppFlowy como aplicación externa o como referencia de arquitectura.
---
# Workspace colaborativo
AppFlowy es una aplicación Flutter/Rust, no una skill ni un componente React. Su instalación, self-hosting y lectura de código son tareas diferentes. Consulta su [README](https://github.com/AppFlowy-IO/AppFlowy) y documentación vigente para la tarea concreta.
No afirmes que el kit tiene AppFlowy instalado ni una API conectada. Para integrarlo, comprueba la versión, el servicio, la autenticación y los contratos documentados antes de escribir un adaptador.
## Modelo del producto
Define workspace, miembros, documento, bloque, colección, propiedad, fila, vista y permiso. Una tabla y un kanban son vistas sobre los mismos registros; no dupliques su persistencia. Usa IDs estables para vínculos entre bloques, filas y documentos.
Empieza por el flujo solicitado: crear, editar, guardar, recargar y recuperar un documento. Luego añade búsqueda, filtros, relaciones, comentarios, historial y exportación según alcance.
## Edición y almacenamiento
- Define un esquema versionado de bloques y migraciones; conserva bloques desconocidos en importación.
- Sanitiza HTML importado, restringe adjuntos por tamaño/tipo y comprueba permisos al descargarlos.
- Separa contenido persistente, selección del editor, presencia efímera y estado de sincronización.
- Define exportación/importación con adjuntos y prueba restauración; copiar un archivo de base de datos activa no garantiza una copia consistente.
## Colaboración y modo offline
Aclara si basta edición individual o se requiere concurrencia. No denomines colaborativo a un editor con guardado remoto único.
Si necesitas offline y edición simultánea, elige CRDT u OT con persistencia, autorización y sincronización compatibles; WebSocket por sí solo no resuelve conflictos. Documenta reconexión, tombstones, versiones y compactación.
Permisos de workspace/documento se verifican en servidor en lectura, escritura y suscripción. Una URL impredecible o un filtro de interfaz no aísla datos.
## Validación
Prueba dos clientes editando, desconexión y reconexión, invitación revocada y exportación/restauración. Si falta un cliente o servidor, comunica qué comportamiento no se probó.
El kit aporta este procedimiento, no una implementación terminada de AppFlowy. Para modificar su código, respeta sus avisos AGPL y verifica los requisitos de distribución del caso; no incorpores su código como si fuera MIT.
