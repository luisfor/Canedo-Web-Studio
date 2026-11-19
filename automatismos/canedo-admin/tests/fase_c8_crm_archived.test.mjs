// File: automatismos/canedo-admin/tests/fase_c8_crm_archived.test.mjs
// Suite de pruebas unitarias para la Fase C8: Filtro de archivados y reactivación de prospectos en Telegram

import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { AdminCrmService } from "../src/modules/crm/service.js";
import { renderCrmMenu, renderLeadsList, renderLeadDetail, renderReactivateConfirmation } from "../src/modules/crm/ui.js";
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

test("FASE C8: Filtro de Archivados y Reactivación en Canedo Admin CRM", async (t) => {
  const mf = createLocalD1();
  const contactDb = await mf.getD1Database("CONTACT_DB");

  // Aplicar migraciones 0001 a 0005 en CONTACT_DB local
  await applyLocalContactMigrations(contactDb, { through: 5 });

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

  const crmService = new AdminCrmService(contactDb);

  // 1. Insertar prospectos simulando leads web (los UUID deben tener longitud de 36 caracteres y recovery_hash 64 hex chars)
  const now = Date.now();
  const id1 = crypto.randomUUID();
  const id2 = crypto.randomUUID();
  const hash1 = "a".repeat(64);
  const hash2 = "b".repeat(64);
  await contactDb.batch([
    contactDb.prepare(`INSERT INTO contact_requests (id, recovery_hash, fingerprint, payload_json, delivery_json, state, created_at, expires_at, rate_key, quota_expires_at)
      VALUES (?, ?, ?, ?, ?, 'saved', ?, ?, ?, ?)`).bind(
      id1, hash1, "fp1",
      JSON.stringify({ nombre: "Cliente Activo", email: "activo@example.com", servicios: ["Desarrollo Web"] }),
      "{}", now, now + 100000, "rk1", now + 100000
    ),
    contactDb.prepare(`INSERT INTO contact_requests (id, recovery_hash, fingerprint, payload_json, delivery_json, state, created_at, expires_at, rate_key, quota_expires_at)
      VALUES (?, ?, ?, ?, ?, 'saved', ?, ?, ?, ?)`).bind(
      id2, hash2, "fp2",
      JSON.stringify({ nombre: "Cliente Archivado", email: "archivado@example.com", servicios: ["Automatización"] }),
      "{}", now + 1, now + 100000, "rk2", now + 100000
    )
  ]);

  // Lead 1 es 'nuevo', Lead 2 lo pasamos a 'archivado'
  await crmService.updateStatus({ identifier: 2, newStatus: "archivado", changedBy: "test_admin", reason: "Prueba archivo" });

  await t.test("1. Menú principal del CRM contiene el botón 'Solo Archivados' con su contador exacto", async () => {
    const summary = await crmService.getPipelineSummary();
    assert.equal(summary.archivado, 1);
    assert.equal(summary.nuevo, 1);
    assert.equal(summary.total, 2);

    const menu = renderCrmMenu(summary);
    const hasArchivedButton = menu.replyMarkup.inline_keyboard.some((row) =>
      row.some((btn) => btn.callback_data === "crm:list:0:archivado" && btn.text.includes("Solo Archivados (1)"))
    );
    assert.ok(hasArchivedButton, "El botón 'Solo Archivados' debe existir con el contador correcto en el teclado");
  });

  await t.test("2. Listado con filtro 'archivado' devuelve exclusivamente los prospectos archivados", async () => {
    const res = await crmService.listLeads({ status: "archivado", limit: 5, offset: 0 });
    assert.equal(res.total, 1);
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].leadNum, 2);
    assert.equal(res.items[0].status, "archivado");

    const view = renderLeadsList({
      total: res.total,
      items: res.items,
      limit: res.limit,
      offset: res.offset,
      statusFilter: "archivado"
    });

    assert.ok(view.text.includes("Cliente Archivado"));
    assert.ok(!view.text.includes("Cliente Activo"));
  });

  await t.test("3. Ficha de detalle de un prospecto archivado muestra 'Reactivar Prospecto' en lugar de botones normales", async () => {
    const leadArchived = await crmService.getLead(2);
    assert.equal(leadArchived.status, "archivado");

    const detailView = renderLeadDetail(leadArchived);
    const hasReactivateAsk = detailView.replyMarkup.inline_keyboard.some((row) =>
      row.some((btn) => btn.callback_data === "crm:reactivate_ask:2")
    );
    const hasContactadoBtn = detailView.replyMarkup.inline_keyboard.some((row) =>
      row.some((btn) => btn.callback_data === "crm:s:c:2")
    );

    assert.ok(hasReactivateAsk, "Debe mostrar el botón '♻️ Reactivar Prospecto'");
    assert.ok(!hasContactadoBtn, "No debe mostrar los botones normales de cambio de estado directo sin reactivación");
  });

  await t.test("4. Pantalla de confirmación de reactivación explica el impacto y ofrece confirmar o cancelar", async () => {
    const leadArchived = await crmService.getLead(2);
    const confirmView = renderReactivateConfirmation(leadArchived);

    assert.ok(confirmView.text.includes("CONFIRMAR REACTIVACIÓN"));
    assert.ok(confirmView.text.includes("#2 — Cliente Archivado"));

    const hasConfirm = confirmView.replyMarkup.inline_keyboard.some((row) =>
      row.some((btn) => btn.callback_data === "crm:reactivate_do:2")
    );
    const hasCancel = confirmView.replyMarkup.inline_keyboard.some((row) =>
      row.some((btn) => btn.callback_data === "crm:v:2")
    );

    assert.ok(hasConfirm, "Debe existir botón de confirmación");
    assert.ok(hasCancel, "Debe existir botón de cancelación");
  });

  await t.test("5. Enrutamiento del Worker: crm:reactivate_ask muestra la confirmación al usuario", async () => {
    const update = {
      callback_query: {
        id: "cb_ask_1",
        from: { id: 999888, username: "luis_admin" },
        message: { message_id: 10, chat: { id: 999888 } },
        data: "crm:reactivate_ask:2"
      }
    };

    const res = await worker.handleTelegramUpdate(
      { update_id: 201, callback_query: update.callback_query },
      env,
      {},
      "127.0.0.1"
    );

    assert.equal(res.ok, true);
    assert.equal(res.route, "crm_reactivate_ask");
    assert.equal(res.leadNum, 2);
  });

  await t.test("6. Enrutamiento del Worker: crm:reactivate_do transiciona a 'nuevo' y registra auditoría", async () => {
    const update = {
      callback_query: {
        id: "cb_do_1",
        from: { id: 999888, username: "luis_admin" },
        message: { message_id: 10, chat: { id: 999888 } },
        data: "crm:reactivate_do:2"
      }
    };

    const res = await worker.handleTelegramUpdate(
      { update_id: 202, callback_query: update.callback_query },
      env,
      {},
      "127.0.0.1"
    );

    assert.equal(res.ok, true);
    assert.equal(res.route, "crm_reactivated");
    assert.equal(res.leadNum, 2);

    // Verificar en base de datos
    const updatedLead = await crmService.getLead(2);
    assert.equal(updatedLead.status, "nuevo");

    // Verificar auditoría en contact_crm_history
    const history = updatedLead.history;
    const reactivateEntry = history.find((h) => h.action === "status_change" && h.new_value === "nuevo" && h.previous_value === "archivado");
    assert.ok(reactivateEntry, "Debe existir un registro de auditoría en contact_crm_history con el cambio exacto");
    assert.equal(reactivateEntry.changed_by, "@luis_admin");
  });

  await t.test("7. Los prospectos no archivados (Lead #1) permanecen 100% intactos", async () => {
    const lead1 = await crmService.getLead(1);
    assert.equal(lead1.status, "nuevo");
    assert.equal(lead1.payload.nombre, "Cliente Activo");
  });

  await t.test("8. Concurrencia estricta: dos llamadas simultáneas a updateStatus generan una sola entrada en el historial", async () => {
    // Pasar lead 1 a archivado
    await crmService.updateStatus({ identifier: 1, newStatus: "archivado", changedBy: "test", reason: "setup" });

    // Ejecutar dos reactivaciones concurrentes con Promise.all
    const [res1, res2] = await Promise.all([
      crmService.updateStatus({ identifier: 1, newStatus: "nuevo", changedBy: "admin1", reason: "concurrente 1" }),
      crmService.updateStatus({ identifier: 1, newStatus: "nuevo", changedBy: "admin2", reason: "concurrente 2" })
    ]);

    const lead1After = await crmService.getLead(1);
    assert.equal(lead1After.status, "nuevo");

    // Filtrar entradas de reactivación en el historial
    const reactivations = lead1After.history.filter(h => h.action === "status_change" && h.new_value === "nuevo" && h.previous_value === "archivado");
    assert.equal(reactivations.length, 1, "Solo debe registrarse exactamente UNA entrada en el historial frente a concurrencia");
  });

  await mf.dispose();
});
