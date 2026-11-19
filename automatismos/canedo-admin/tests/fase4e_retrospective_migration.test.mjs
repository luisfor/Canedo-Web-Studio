import test from "node:test";
import assert from "node:assert/strict";
import { createLocalD1, applyLocalContactMigrations } from "../../../cazas/canedostudio.com/tests/contact/local-d1.mjs";

test("REVISIÓN FINAL: Migración retrospectiva e idempotencia sobre contactos existentes", async (t) => {
  const mf = createLocalD1();
  const db = await mf.getD1Database("CONTACT_DB");

  // 1. Aplicar migraciones 0001 a 0004 (estado previo de producción)
  await applyLocalContactMigrations(db, { through: 4 });

  // 2. Insertar exactamente 3 contactos previos (simulando los 3 registros reales existentes en producción)
  const now = Date.now();
  const existingIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];

  for (let i = 0; i < 3; i++) {
    const p = {
      nombre: `Contacto Previo ${i + 1}`,
      email: `previo${i + 1}@test.com`,
      mensaje: `Mensaje previo ${i + 1}`
    };
    await db.prepare(`
      INSERT INTO contact_requests (id, recovery_hash, fingerprint, payload_json, delivery_json, state, created_at, expires_at, rate_key, quota_expires_at)
      VALUES (?, ?, ?, ?, '{}', 'saved', ?, ?, 'rate_prev', ?)
    `).bind(existingIds[i], `${i}`.repeat(64), `${i}`.repeat(64), JSON.stringify(p), now - (3 - i) * 100000, now + 15552000000, now + 1200000).run();
  }

  // Comprobar que existen los 3
  const countBefore = await db.prepare(`SELECT count(*) as c FROM contact_requests`).first();
  assert.equal(countBefore.c, 3);

  // 3. Aplicar migración 0005_crm_pipeline.sql (Simulando la ejecución del despliegue)
  await applyLocalContactMigrations(db, { through: 5, after: 4 });

  // 4. Verificar que los 3 contactos fueron inicializados retrospectivamente
  const crmRows = await db.prepare(`SELECT * FROM contact_crm_status ORDER BY lead_num ASC`).all();
  assert.equal(crmRows.results.length, 3, "Los 3 contactos existentes deben tener su registro en contact_crm_status");

  assert.equal(crmRows.results[0].lead_num, 1);
  assert.equal(crmRows.results[0].request_id, existingIds[0]);
  assert.equal(crmRows.results[0].status, "nuevo");

  assert.equal(crmRows.results[1].lead_num, 2);
  assert.equal(crmRows.results[1].request_id, existingIds[1]);

  assert.equal(crmRows.results[2].lead_num, 3);
  assert.equal(crmRows.results[2].request_id, existingIds[2]);

  // 5. Probar IDEMPOTENCIA: Re-aplicar la sección retrospectiva no debe duplicar ni fallar
  const reinsertResult = await db.prepare(`
    INSERT OR IGNORE INTO contact_crm_status (request_id, lead_num, status, priority, created_at, updated_at)
    SELECT
      r.id,
      (COALESCE((SELECT MAX(lead_num) FROM contact_crm_status), 0) + ROW_NUMBER() OVER (ORDER BY r.created_at ASC)),
      'nuevo',
      'media',
      r.created_at,
      r.created_at
    FROM contact_requests r
    WHERE r.state = 'saved'
      AND NOT EXISTS (SELECT 1 FROM contact_crm_status s WHERE s.request_id = r.id);
  `).run();

  const crmRowsAfterReapply = await db.prepare(`SELECT count(*) as c FROM contact_crm_status`).first();
  assert.equal(crmRowsAfterReapply.c, 3, "La re-ejecución no debe duplicar registros");

  // 6. Probar concurrencia con nuevo contacto entrante tras la migración
  const newLeadId = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO contact_requests (id, recovery_hash, fingerprint, payload_json, delivery_json, state, created_at, expires_at, rate_key, quota_expires_at)
    VALUES (?, ?, ?, '{"nombre":"Nuevo Concurrente"}', '{}', 'saved', ?, ?, 'rate_new', ?)
  `).bind(newLeadId, "9".repeat(64), "9".repeat(64), now + 1000, now + 15552000000, now + 1200000).run();

  const newStatus = await db.prepare(`SELECT * FROM contact_crm_status WHERE request_id = ?`).bind(newLeadId).first();
  assert.ok(newStatus, "El nuevo contacto debe recibir su estado CRM automáticamente vía trigger");
  assert.equal(newStatus.lead_num, 4, "El nuevo contacto debe recibir el siguiente lead_num secuencial (4)");

  await mf.dispose();
});

