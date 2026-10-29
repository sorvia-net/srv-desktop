import { useSyncExternalStore } from "react";

import type { Transfer } from "@shared/contracts";

import { bridge } from "./bridge";

let items: Transfer[] = [];
let started = false;
const listeners = new Set<() => void>();
const finishedListeners = new Set<(transfer: Transfer) => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function upsert(transfer: Transfer) {
  const previous = items.find((item) => item.id === transfer.id);
  items = previous ? items.map((item) => (item.id === transfer.id ? transfer : item)) : [transfer, ...items].slice(0, 60);
  if (transfer.status === "done" && previous?.status !== "done") finishedListeners.forEach((listener) => listener(transfer));
  emit();
}

function start() {
  if (started) return;
  started = true;
  void bridge.files.transfers().then((list) => {
    items = list;
    emit();
  });
  bridge.files.onTransfer(upsert);
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTransfers() {
  return useSyncExternalStore(subscribe, () => items);
}

export function onTransferDone(listener: (transfer: Transfer) => void) {
  start();
  finishedListeners.add(listener);
  return () => {
    finishedListeners.delete(listener);
  };
}

export function clearFinishedTransfers() {
  items = items.filter((item) => item.status === "queued" || item.status === "running");
  emit();
  void bridge.files.clearFinished();
}
