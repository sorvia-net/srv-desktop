import assert from "node:assert/strict";
import { test } from "node:test";

import { commandForNotification, routeForNotification } from "../shared/routes.ts";
import { newer } from "../shared/version.ts";

test("bildirim türü doğru ekrana gider", () => {
  assert.deepEqual(routeForNotification({ type: "ticket.assigned", href: "/admin/destek/clx1abc" }), { screen: "tickets", id: "clx1abc" });
  assert.deepEqual(routeForNotification({ type: "ticket.reply", href: null }), { screen: "tickets" });
  assert.deepEqual(routeForNotification({ type: "task.assigned", href: null }), { screen: "tasks" });
  assert.deepEqual(routeForNotification({ type: "meeting.accepted", href: "/admin/gorusmeler/x" }), { screen: "calendar" });
  assert.deepEqual(routeForNotification({ type: "chat.mention", href: null }), { screen: "chat" });
  assert.deepEqual(routeForNotification({ type: "security.desktop", href: "/panel/hesap/guvenlik" }), { screen: "home" });
});

test("bildirim komutu kimliği taşır", () => {
  assert.equal(commandForNotification({ type: "ticket.assigned", href: "/admin/destek/abc_123" }), "go:tickets:abc_123");
  assert.equal(commandForNotification({ type: "task.done", href: null }), "go:tasks");
});

test("sürüm karşılaştırma", () => {
  assert.equal(newer("0.2.0", "0.1.0"), true);
  assert.equal(newer("0.1.0", "0.1.0"), false);
  assert.equal(newer("0.1.9", "0.1.10"), false);
  assert.equal(newer("1.0.0-beta.1", "0.9.9"), true);
  assert.equal(newer("v1.2", "1.2.0"), false);
  assert.equal(newer("1.10.0", "1.9.3"), true);
});
