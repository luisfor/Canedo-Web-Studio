# Documentación Técnica del Robot de Contenidos (Trampas y Gotchas)

Este documento contiene las reglas de despliegue y las "trampas" conocidas al implementar el Robot Híbrido de Contenidos. Cualquier agente o humano que despliegue este sistema debe verificar esta lista antes de dar el trabajo por terminado.

## 🚨 Trampas Documentadas (Obligatorio Revisar)

### 1. La Cuota Diaria de IA Gratuita
Si usas modelos gratuitos (como DeepSeek V3 vía OpenRouter o la capa gratuita de Gemini/Claude), ten cuidado con los **Rate Limits (Límites de Velocidad)**.
*   **Problema:** Si el robot intenta generar 5 artículos seguidos en menos de un minuto, la API puede bloquearte por 24 horas.
*   **Solución:** Introduce un nodo de `Wait` (Espera) de al menos 60 segundos entre cada llamada pesada a la IA dentro de n8n, o limita la ejecución del cron a 1 artículo cada 4 horas.

### 2. Los "Dos Archivitos" Obligatorios
El robot inyecta contenido en un repositorio de GitHub que luego Cloudflare Pages renderiza. Para que esto funcione, el despliegue requiere **dos archivos clave en el repositorio destino**:
1.  `posts.json` (o equivalente): Donde n8n inyectará los datos estructurados. Si este archivo no existe o tiene sintaxis JSON rota, el robot fallará silenciosamente.
2.  `trigger-build.js` (o un Webhook de Cloudflare): Un script que n8n debe llamar al final del proceso para decirle a Cloudflare "Hey, hay contenido nuevo, reconstruye el sitio".

### 3. La Caché de las Páginas
*   **Problema:** El robot avisa que ya publicó el artículo, pero al entrar a la web no se ve.
*   **Solución:** Esto sucede por la caché agresiva de Cloudflare o Next.js. Asegúrate de que el webhook de despliegue purgue la caché de la página de inicio (o que el cliente use Next.js App Router con `revalidateTag`).

### 4. Feeds RSS Verificados
De 6 feeds evaluados, 3 se rompían frecuentemente por mal formato XML.
*   **Feeds Aprobados para usar en el Motor 2:**
    *   (Por rellenar con los enlaces reales del cliente - ej. MarketingDirecto, Xataka, etc.)
*   **Regla:** NO agregues feeds RSS nuevos sin antes pasarlos por un validador XML estricto.
