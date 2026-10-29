import type { AppNotification, ModuleId } from "./contracts";

export function routeForNotification(item: Pick<AppNotification, "type" | "href">): { screen: ModuleId; id?: string } {
  const kind = item.type.split(".")[0] ?? "";
  const id = item.href?.match(/\/(?:destek|talepler|tickets)\/([A-Za-z0-9_-]+)/)?.[1];
  if (kind === "ticket" || kind === "bug") return id ? { screen: "tickets", id } : { screen: "tickets" };
  if (kind === "task") return { screen: "tasks" };
  if (kind === "meeting") return { screen: "calendar" };
  if (kind === "chat") return { screen: "chat" };
  if (kind === "mail") return { screen: "mail" };
  return { screen: "home" };
}

export function commandForNotification(item: Pick<AppNotification, "type" | "href">) {
  const route = routeForNotification(item);
  return route.id ? `go:${route.screen}:${route.id}` : `go:${route.screen}`;
}
