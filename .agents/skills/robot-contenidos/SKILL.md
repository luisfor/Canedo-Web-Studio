---
name: robot-contenidos
description: >-
  Úsalo cuando el usuario te pida instalar, configurar o modificar un "Robot de Contenidos", "Blog Automatizado" o "Automatización n8n para artículos". 
---

# 🤖 Robot Híbrido de Contenidos (The Ultimate Publishing Engine)

Eres el Ingeniero de Automatización de Canedo Web Studio. Cuando se te encargue desplegar un robot creador de contenidos, DEBES seguir estrictamente esta arquitectura de nivel avanzado. No uses flujos básicos; implementa estas reglas:

## 1. Lógica Híbrida de Generación
El robot tiene tres motores que actúan según el contexto:
*   **Motor 1 (Fijo):** Consume primero de la "Lista Curada de 210 temas" provista por el usuario.
*   **Motor 2 (Prensa Matutina):** Si la lista se agota y es de mañana, el robot debe leer feeds RSS verificados (marketing/prensa en español). Tomar titulares reales y convertirlos en "temas prácticos". (Nota: Usa solo los 3 feeds verificados en la documentación técnica).
*   **Motor 3 (Inventiva IA Vespertina):** En las tardes, inventa temas desde cero basados en la *Carta Editorial* (quién es el cliente y qué vende).

## 2. Filtro de Seguridad (Temas Vetados)
Antes de consumir créditos de IA para redactar, inserta un nodo/función filtro con este prompt estricto:
> *"Rechaza inmediatamente cualquier tema que roce política, religión, criptomonedas, apuestas, o chismes de famosos."*

## 3. Blindaje Anti-Repetición (3 Capas)
Nunca permitas que el robot publique el mismo concepto dos veces. La automatización debe incluir:
1.  **Historial Local:** Cruce contra un archivo/base de datos con los últimos 300 títulos generados.
2.  **Historial de Prensa:** Cruce contra los últimos 60 titulares de RSS.
3.  **Guardia de IA:** Un nodo final donde la IA evalúa: *"¿Este tema propuesto es semánticamente igual a alguno de los títulos recientes?"*

## 4. Estándares del Panel de Control
Todo despliegue del robot debe incluir un Panel de Control (ya sea en n8n o una página admin web) protegido por contraseña, que permita:
- Publicar un post manualmente al instante (Ideal para demos).
- Repintar portadas/imágenes.
- Mostrar ventanas de diagnóstico (logs de errores, estado de feeds).

## 5. Avisos por Email Optimizados
Al finalizar cada publicación, el robot debe enviar un reporte por correo que incluya:
- Enlace al artículo.
- **Origen del tema:** Debe especificar claramente si el tema salió de la `[LISTA_CURADA]`, de la `[PRENSA_RSS]`, o fue `[INVENTO_IA]`.

## Protocolo de Ejecución
Al recibir la orden de armar el robot, asegúrate de pedirle al usuario:
1. El archivo con los 210 temas.
2. La llave/contraseña que quiere usar para el Panel de Control.
