import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { createLocalD1, applyLocalContactMigrations } from "../../../cazas/canedostudio.com/tests/contact/local-d1.mjs";

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

test("FASE 4C: CRM Comercial en Canedo Admin (Telegram)", async (t) => {
  const mf = createLocalD1();
  const contactDb = await mf.getD1Database("CONTACT_DB");

  // Aplicar migraciones 0001 a 0005 en CONTACT_DB local
  await applyLocalContactMigrations(contactDb, { through: 5 });

  // Mock de BLOG_DB mínimo para inicializar worker
  const blogDb = {
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: [] }),
        first: async () => null,
        run: async () => ({ meta: { changes: 1 } })
      })
    }),
    batch: async () => []
  };

  const kv = createMockKV();

  const env = {
    BOT_TOKEN_SECRETO: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    ALLOWED_ADMIN_IDS: "999888,111222",
    CONTACT_DB: contactDb,
    BLOG_DB: blogDb,
    ADMIN_KV: kv
  };

  // Insertar un lead de prueba en contactDb para los tests de CRM
  const leadId = crypto.randomUUID();
  const now = Date.now();
  const payload = {
    nombre: "Alejandra Gómez",
    empresa: "Clínica Dental Sonrisas",
    email: "alejandra@sonrisas.co",
    telefono: "+57 315 987 6543",
    servicios: ["Chatbot / Asistente IA", "Automatización"],
    servicio: "Chatbot / Asistente IA, Automatización",
    presupuesto: "Proyecto mediano",
    mensaje: "Necesitamos un chatbot en WhatsApp para agendar citas de pacientes."
  };

  await contactDb.prepare(`
    INSERT INTO contact_requests (id, recovery_hash, fingerprint, payload_json, delivery_json, state, created_at, expires_at, rate_key, quota_expires_at)
    VALUES (?, ?, ?, ?, '{}', 'saved', ?, ?, 'rate_crm_1', ?)
  `).bind(leadId, "1".repeat(64), "2".repeat(64), JSON.stringify(payload), now, now + 15552000000, now + 1200000).run();

  await t.test("1. Autorización: Usuario no autorizado es rechazado al ejecutar comandos CRM", async () => {
    const unauthMessage = {
      message_id: 1,
      from: { id: 666666, username: "intruder" },
      chat: { id: 666666 },
      text: "/leads"
    };

    const res = await worker.handleTelegramUpdate(
      { update_id: 101, message: unauthMessage },
      env,
      {},
      "127.0.0.1"
    );

    assert.equal(res.ok, false);
    assert.equal(res.error, "Unauthorized user");
  });

  await t.test("2. Comando /leads y navegación a menú CRM", async () => {
    const msg = {
      message_id: 2,
      from: { id: 999888, username: "luis_admin" },
      chat: { id: 999888 },
      text: "/leads"
    };

    const res = await worker.handleTelegramUpdate(
      { update_id: 102, message: msg },
      env,
      {},
      "127.0.0.1"
    );

    assert.equal(res.ok, true);
    assert.equal(res.route, "crm_menu_cmd");
  });

  await t.test("3. Callback de listado paginado y filtrado (crm:list:0:all)", async () => {
    const cq = {
      id: "cq_103",
      from: { id: 999888, username: "luis_admin" },
      message: { message_id: 10, chat: { id: 999888 } },
      data: "crm:list:0:all"
    };

    const res = await worker.handleTelegramUpdate(
      { update_id: 103, callback_query: cq },
      env,
      {},
      "127.0.0.1"
    );

    assert.equal(res.ok, true);
    assert.equal(res.route, "crm_list");
    assert.equal(res.statusFilter, "all");
  });

  await t.test("4. Consulta de detalle por callback compacto (crm:v:1) y comando /lead 1", async () => {
    // Vía Callback compacto
    const cq = {
      id: "cq_104",
      from: { id: 999888, username: "luis_admin" },
      message: { message_id: 10, chat: { id: 999888 } },
      data: "crm:v:1"
    };

    const resCb = await worker.handleTelegramUpdate(
      { update_id: 104, callback_query: cq },
      env,
      {},
      "127.0.0.1"
    );
    assert.equal(resCb.ok, true);
    assert.equal(resCb.route, "crm_detail");
    assert.equal(resCb.leadNum, 1);

    // Vía Comando directo
    const msg = {
      message_id: 3,
      from: { id: 999888, username: "luis_admin" },
      chat: { id: 999888 },
      text: "/lead 1"
    };

    const resCmd = await worker.handleTelegramUpdate(
      { update_id: 105, message: msg },
      env,
      {},
      "127.0.0.1"
    );
    assert.equal(resCmd.ok, true);
    assert.equal(resCmd.route, "crm_lead_detail_cmd");
    assert.equal(resCmd.leadNum, 1);
  });

  await t.test("5. Cambio de estado interactivo compacto (crm:s:c:1 -> contactado)", async () => {
    const cq = {
      id: "cq_106",
      from: { id: 999888, username: "luis_admin" },
      message: { message_id: 10, chat: { id: 999888 } },
      data: "crm:s:c:1" // c = contactado
    };

    const res = await worker.handleTelegramUpdate(
      { update_id: 106, callback_query: cq },
      env,
      {},
      "127.0.0.1"
    );

    assert.equal(res.ok, true);
    assert.equal(res.route, "crm_status_updated");
    assert.equal(res.leadNum, 1);
    assert.equal(res.newStatus, "contactado");

    // Verificar en BD
    const row = await contactDb.prepare(`SELECT status FROM contact_crm_status WHERE lead_num = 1`).first();
    assert.equal(row.status, "contactado");
  });

  await t.test("6. Flujo conversacional: Registro de nota de seguimiento comercial", async () => {
    // 1. Iniciar prompt de nota
    const cq = {
      id: "cq_107",
      from: { id: 999888, username: "luis_admin" },
      message: { message_id: 10, chat: { id: 999888 } },
      data: "crm:note_prompt:1"
    };
    const resPrompt = await worker.handleTelegramUpdate(
      { update_id: 107, callback_query: cq },
      env,
      {},
      "127.0.0.1"
    );
    assert.equal(resPrompt.ok, true);
    assert.equal(resPrompt.route, "crm_note_prompt");

    // 2. Enviar texto de la nota
    const msg = {
      message_id: 4,
      from: { id: 999888, username: "luis_admin" },
      chat: { id: 999888 },
      text: "Llamada con la Dra. Alejandra. Necesita agendamiento con Google Calendar y WhatsApp."
    };
    const resSave = await worker.handleTelegramUpdate(
      { update_id: 108, message: msg },
      env,
      {},
      "127.0.0.1"
    );
    assert.equal(resSave.ok, true);
    assert.equal(resSave.route, "crm_note_saved");

    // Verificar en BD
    const note = await contactDb.prepare(`SELECT * FROM contact_crm_notes WHERE request_id = ?`).bind(leadId).first();
    assert.ok(note);
    assert.match(note.content, /Dra\. Alejandra/);
  });

  await t.test("7. Flujo conversacional: Creación de recordatorio comercial", async () => {
    // 1. Iniciar prompt
    const cq = {
      id: "cq_109",
      from: { id: 999888, username: "luis_admin" },
      message: { message_id: 10, chat: { id: 999888 } },
      data: "crm:rem_prompt:1"
    };
    const resPrompt = await worker.handleTelegramUpdate(
      { update_id: 109, callback_query: cq },
      env,
      {},
      "127.0.0.1"
    );
    assert.equal(resPrompt.ok, true);
    assert.equal(resPrompt.route, "crm_rem_prompt");

    // 2. Enviar texto del recordatorio con días
    const msg = {
      message_id: 5,
      from: { id: 999888, username: "luis_admin" },
      chat: { id: 999888 },
      text: "Enviar cotización del Chatbot con integración Calendar | 3"
    };
    const resSave = await worker.handleTelegramUpdate(
      { update_id: 110, message: msg },
      env,
      {},
      "127.0.0.1"
    );
    assert.equal(resSave.ok, true);
    assert.equal(resSave.route, "crm_reminder_saved");
    assert.equal(resSave.days, 3);

    // Verificar en BD
    const rem = await contactDb.prepare(`SELECT * FROM contact_crm_reminders WHERE request_id = ?`).bind(leadId).first();
    assert.ok(rem);
    assert.equal(rem.state, "pending");
    assert.match(rem.reminder_text, /cotización del Chatbot/);
  });

  await t.test("8. Comando /pipeline y vista de embudo consolidado", async () => {
    const msg = {
      message_id: 6,
      from: { id: 999888, username: "luis_admin" },
      chat: { id: 999888 },
      text: "/pipeline"
    };

    const res = await worker.handleTelegramUpdate(
      { update_id: 111, message: msg },
      env,
      {},
      "127.0.0.1"
    );

    assert.equal(res.ok, true);
    assert.equal(res.route, "crm_pipeline_cmd");
  });

  await mf.dispose();
});
