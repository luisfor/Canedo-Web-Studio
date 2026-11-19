import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

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

test("FASE 4E: Corrección y Navegación del Botón 'Volver al Menú Principal'", async (t) => {
  const kv = createMockKV();

  const env = {
    BOT_TOKEN_SECRETO: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    ALLOWED_ADMIN_IDS: "999888,111222",
    ADMIN_KV: kv
  };

  await t.test("1. Retorno al Menú Principal desde submenú Blog (menu:main)", async () => {
    const cq = {
      id: "cq_main_1",
      from: { id: 999888, username: "luis_admin" },
      message: { message_id: 10, chat: { id: 999888 } },
      data: "menu:main"
    };

    const res = await worker.handleTelegramUpdate(
      { update_id: 301, callback_query: cq },
      env,
      {},
      "127.0.0.1"
    );

    assert.equal(res.ok, true);
    assert.equal(res.route, "main_menu");
  });

  await t.test("2. Limpieza de estado conversacional al pulsar 'menu:main'", async () => {
    // 1. Simular sesión conversacional activa (ej: usuario iba a dictar una nota CRM o un tema del blog)
    await kv.put("user_state:999888", JSON.stringify({ action: "awaiting_crm_note", leadNum: 5 }));

    // 2. El usuario decide pulsar 'Volver al Menú Principal'
    const cq = {
      id: "cq_main_2",
      from: { id: 999888, username: "luis_admin" },
      message: { message_id: 11, chat: { id: 999888 } },
      data: "menu:main"
    };

    const res = await worker.handleTelegramUpdate(
      { update_id: 302, callback_query: cq },
      env,
      {},
      "127.0.0.1"
    );

    assert.equal(res.ok, true);
    assert.equal(res.route, "main_menu");

    // 3. Confirmar que la sesión en KV fue eliminada
    const cleared = await kv.get("user_state:999888");
    assert.equal(cleared, null, "La sesión conversacional debe quedar limpia al volver al menú principal");
  });

  await t.test("3. Navegación de ida y vuelta: Main -> CRM (stub) -> Main", async () => {
    // 1. Ir a CRM sin binding (retorna stub)
    const cqCrm = {
      id: "cq_stub",
      from: { id: 999888, username: "luis_admin" },
      message: { message_id: 12, chat: { id: 999888 } },
      data: "menu:crm"
    };
    const resCrm = await worker.handleTelegramUpdate(
      { update_id: 303, callback_query: cqCrm },
      env,
      {},
      "127.0.0.1"
    );
    assert.equal(resCrm.ok, true);
    assert.equal(resCrm.route, "module_stub");

    // 2. Regresar al menú principal desde el botón del stub
    const cqBack = {
      id: "cq_back",
      from: { id: 999888, username: "luis_admin" },
      message: { message_id: 12, chat: { id: 999888 } },
      data: "menu:main"
    };
    const resBack = await worker.handleTelegramUpdate(
      { update_id: 304, callback_query: cqBack },
      env,
      {},
      "127.0.0.1"
    );
    assert.equal(resBack.ok, true);
    assert.equal(resBack.route, "main_menu");
  });
});

