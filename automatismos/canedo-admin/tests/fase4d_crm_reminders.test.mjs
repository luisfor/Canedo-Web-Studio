import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { createLocalD1, applyLocalContactMigrations } from "../../../cazas/canedostudio.com/tests/contact/local-d1.mjs";
import { AdminCrmService } from "../src/modules/crm/service.js";

function createMockKV() {
  const store = new Map();
  return {
    async get(key) {
      return store.get(key) || null;
    },
    async put(key, val) {
      store.set(key, String(val));
    },
    async delete(key) {
      store.delete(key);
    }
  };
}

test("FASE 4D: Recordatorios Comerciales y Concurrencia en Canedo Admin", async (t) => {
  const mf = createLocalD1();
  const contactDb = await mf.getD1Database("CONTACT_DB");

  // Aplicar migraciones 0001 a 0005
  await applyLocalContactMigrations(contactDb, { through: 5 });

  const kv = createMockKV();

  const env = {
    BOT_TOKEN_SECRETO: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    ALLOWED_ADMIN_IDS: "999888,111222",
    CONTACT_DB: contactDb,
    ADMIN_KV: kv
  };

  const crmService = new AdminCrmService(contactDb);

  // Insertar un lead de prueba
  const leadId = crypto.randomUUID();
  const now = Date.now();
  const payload = {
    nombre: "Roberto Silva",
    empresa: "Inmobiliaria Silva & Asociados",
    email: "roberto@silva.com",
    telefono: "+57 320 555 1234",
    servicios: ["Desarrollo Web", "Automatización"],
    servicio: "Desarrollo Web, Automatización",
    presupuesto: "Proyecto avanzado",
    mensaje: "Buscamos renovar nuestro portal con CRM integrado."
  };

  await contactDb.prepare(`
    INSERT INTO contact_requests (id, recovery_hash, fingerprint, payload_json, delivery_json, state, created_at, expires_at, rate_key, quota_expires_at)
    VALUES (?, ?, ?, ?, '{}', 'saved', ?, ?, 'rate_fase4d_1', ?)
  `).bind(leadId, "3".repeat(64), "4".repeat(64), JSON.stringify(payload), now, now + 15552000000, now + 1200000).run();

  await t.test("1. Creación de recordatorio vencido y recordatorio futuro", async () => {
    // Recordatorio 1: Vencido (hace 1 hora)
    const resVencido = await crmService.createReminder({
      identifier: 1,
      reminderText: "Llamar a Roberto para confirmar reunión técnica",
      dueAt: now - 3600000,
      createdBy: "luis_admin"
    }).catch(() => null); // Puede rechazar dueAt <= now si valida fecha

    // Insertar manualmente el vencido en BD para simular paso del tiempo
    const remVencidoId = crypto.randomUUID();
    await contactDb.prepare(`
      INSERT INTO contact_crm_reminders (id, request_id, reminder_text, due_at, state, created_by, created_at)
      VALUES (?, ?, 'Llamar a Roberto para confirmar reunión técnica', ?, 'pending', 'luis_admin', ?)
    `).bind(remVencidoId, leadId, now - 3600000, now - 7200000).run();

    // Recordatorio 2: Futuro (dentro de 2 días)
    const remFuturo = await crmService.createReminder({
      identifier: 1,
      reminderText: "Enviar propuesta económica detallada",
      dueAt: now + (2 * 86400000),
      createdBy: "luis_admin"
    });
    assert.equal(remFuturo.success, true);

    // Verificar en BD
    const list = await contactDb.prepare(`SELECT COUNT(*) as c FROM contact_crm_reminders WHERE request_id = ?`).bind(leadId).first();
    assert.equal(list.c, 2);
  });

  await t.test("2. Concurrencia y Reserva Exclusiva: claimDueReminders solo toma el vencido", async () => {
    // Reclamo 1
    const claimed1 = await crmService.claimDueReminders({ limit: 5, leaseMs: 60000 });
    assert.equal(claimed1.length, 1, "Solo debe tomar el recordatorio vencido");
    assert.match(claimed1[0].reminderText, /Llamar a Roberto/);
    assert.equal(claimed1[0].leadNum, 1);

    // Reclamo 2 simultáneo (debe retornar vacío porque ya está bloqueado con lease 'sending')
    const claimed2 = await crmService.claimDueReminders({ limit: 5, leaseMs: 60000 });
    assert.equal(claimed2.length, 0, "No debe tomar el recordatorio mientras su lease esté activo");
  });

  await t.test("3. Procesamiento seguro en Scheduled: notifica y marca como 'notified'", async () => {
    // Simular que el envío por Telegram concluyó con éxito
    const rem = (await contactDb.prepare(`SELECT id FROM contact_crm_reminders WHERE state = 'sending'`).first());
    assert.ok(rem);

    await crmService.markReminderNotified(rem.id);

    const updated = await contactDb.prepare(`SELECT state, lease_until FROM contact_crm_reminders WHERE id = ?`).bind(rem.id).first();
    assert.equal(updated.state, "notified");
    assert.equal(updated.lease_until, null);
  });

  await t.test("4. Acciones Interactivas: Completar recordatorio desde botón (crm:rem_done)", async () => {
    const rem = (await contactDb.prepare(`SELECT id FROM contact_crm_reminders WHERE state = 'notified'`).first());

    const cq = {
      id: "cq_rem_done",
      from: { id: 999888, username: "luis_admin" },
      message: { message_id: 20, chat: { id: 999888 } },
      data: `crm:rem_done:${rem.id}`
    };

    const res = await worker.handleTelegramUpdate(
      { update_id: 201, callback_query: cq },
      env,
      {},
      "127.0.0.1"
    );

    assert.equal(res.ok, true);
    assert.equal(res.route, "crm_reminder_done");

    const finalRem = await contactDb.prepare(`SELECT state FROM contact_crm_reminders WHERE id = ?`).bind(rem.id).first();
    assert.equal(finalRem.state, "completed");
  });

  await t.test("5. Acciones Interactivas: Posponer recordatorio (+2 días) (crm:rem_postpone)", async () => {
    // Crear un nuevo recordatorio para probar posponer
    const remId = crypto.randomUUID();
    await contactDb.prepare(`
      INSERT INTO contact_crm_reminders (id, request_id, reminder_text, due_at, state, created_by, created_at)
      VALUES (?, ?, 'Revisión periódica de contrato', ?, 'pending', 'luis_admin', ?)
    `).bind(remId, leadId, now - 1000, now - 10000).run();

    const cq = {
      id: "cq_rem_postpone",
      from: { id: 999888, username: "luis_admin" },
      message: { message_id: 21, chat: { id: 999888 } },
      data: `crm:rem_postpone:${remId}:2`
    };

    const res = await worker.handleTelegramUpdate(
      { update_id: 202, callback_query: cq },
      env,
      {},
      "127.0.0.1"
    );

    assert.equal(res.ok, true);
    assert.equal(res.route, "crm_reminder_postponed");
    assert.equal(res.days, 2);

    const postpRem = await contactDb.prepare(`SELECT state, due_at FROM contact_crm_reminders WHERE id = ?`).bind(remId).first();
    assert.equal(postpRem.state, "pending");
    assert.ok(postpRem.due_at > now, "La nueva fecha debe ser en el futuro");
  });

  await t.test("6. Aislamiento de sesiones: Estado CRM no altera comandos del Blog", async () => {
    // 1. Poner usuario en estado CRM (esperando nota)
    await kv.put("user_state:999888", JSON.stringify({ action: "awaiting_crm_note", leadNum: 1 }));

    // 2. Si el usuario envía un comando de navegación o menú (/menu, /leads), se atiende limpiamente
    const resCmd = await worker.handleTelegramUpdate({
      update_id: 203,
      message: { message_id: 30, from: { id: 999888 }, chat: { id: 999888 }, text: "/leads" }
    }, env);

    assert.equal(resCmd.ok, true);
    assert.equal(resCmd.route, "crm_menu_cmd");
  });

  await t.test("7. Cascada de retención: Al purgar el prospecto vencido se eliminan sus recordatorios", async () => {
    await contactDb.prepare(`DELETE FROM contact_requests WHERE id = ?`).bind(leadId).run();

    const remCount = await contactDb.prepare(`SELECT COUNT(*) as c FROM contact_crm_reminders WHERE request_id = ?`).bind(leadId).first();
    assert.equal(remCount.c, 0, "Los recordatorios deben eliminarse automáticamente en cascada");
  });

  await mf.dispose();
});

