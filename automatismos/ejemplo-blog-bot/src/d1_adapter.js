/**
 * Adaptador de Escritura Doble Endurecido para Blog Bot
 *
 * Principios:
 * 1. D1 es la Fuente de Verdad Canónica permanente.
 * 2. KV es la Capa de Caché y Retrocompatibilidad transitoria.
 * 3. Fallo aislado: si una capa falla, se registra en log y no interrumpe la otra.
 * 4. Idempotencia total: ejecuciones repetidas actualizan sin duplicar filas ni slugs.
 * 5. Cero truncamiento en D1; en KV se mantiene un buffer de compatibilidad.
 */

export async function secureDualWritePost(env, post, options = {}) {
  const {
    enableD1 = true,
    enableKV = true,
    maxRetries = 2,
    retryDelayMs = 150
  } = options;

  const result = {
    slug: post.slug,
    d1: { success: false, attempts: 0, error: null },
    kv: { success: false, attempts: 0, error: null },
    timestamp: new Date().toISOString()
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 1. ESCRITURA EN CLOUDFLARE D1 (FUENTE DE VERDAD PRIMARIA)
  if (enableD1 && env.BLOG_DB && typeof env.BLOG_DB.prepare === 'function') {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      result.d1.attempts = attempt;
      try {
        const sql = `
          INSERT INTO blog_posts (slug, title, tag, date, reading_time, cover_url, excerpt, content_json, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')
          ON CONFLICT(slug) DO UPDATE SET
            title = excluded.title,
            tag = excluded.tag,
            date = excluded.date,
            reading_time = excluded.reading_time,
            cover_url = excluded.cover_url,
            excerpt = excluded.excerpt,
            content_json = excluded.content_json,
            status = 'published',
            updated_at = CURRENT_TIMESTAMP;
        `;
        await env.BLOG_DB.prepare(sql).bind(
          post.slug,
          post.title,
          post.tag,
          post.date,
          post.readingTime || '3 min',
          post.cover || '',
          post.excerpt || '',
          JSON.stringify(post.content || [])
        ).run();

        result.d1.success = true;
        result.d1.error = null;
        break;
      } catch (err) {
        result.d1.error = err.message;
        if (attempt <= maxRetries) {
          await sleep(retryDelayMs * attempt);
        }
      }
    }
  } else if (!enableD1) {
    result.d1.skipped = true;
  } else {
    result.d1.error = 'BLOG_DB binding not configured';
  }

  // 2. ESCRITURA EN CLOUDFLARE KV (BUFFER RETROCOMPATIBLE)
  if (enableKV && env.BLOG_POSTS && typeof env.BLOG_POSTS.get === 'function') {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      result.kv.attempts = attempt;
      try {
        const raw = await env.BLOG_POSTS.get('posts');
        const postsData = JSON.parse(raw || '{"posts":[]}');
        const posts = Array.isArray(postsData.posts) ? postsData.posts : [];

        // Deduplicar slug en caso de reescritura
        const filtered = posts.filter((p) => p.slug !== post.slug);
        filtered.unshift(post);

        // Guardar en KV
        postsData.posts = filtered;
        await env.BLOG_POSTS.put('posts', JSON.stringify(postsData));

        result.kv.success = true;
        result.kv.error = null;
        break;
      } catch (err) {
        result.kv.error = err.message;
        if (attempt <= maxRetries) {
          await sleep(retryDelayMs * attempt);
        }
      }
    }
  } else if (!enableKV) {
    result.kv.skipped = true;
  } else {
    result.kv.error = 'BLOG_POSTS binding not configured';
  }

  // Si fallaron ambas capas, lanzar error crítico
  if (!result.d1.success && !result.kv.success) {
    const combinedMsg = `CRITICAL DUAL-WRITE FAILURE: D1 (${result.d1.error}) | KV (${result.kv.error})`;
    console.error(combinedMsg);
    throw new Error(combinedMsg);
  }

  return result;
}
