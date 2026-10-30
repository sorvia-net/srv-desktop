import { Component, useEffect, useState, useSyncExternalStore } from "react";
import type { ComponentType, ErrorInfo, ReactNode } from "react";

import type { InstalledModule } from "@shared/contracts";
import { bridge } from "@/data/bridge";

import { SHARED } from "./shared";

type Registry = Map<string, ComponentType>;

declare global {
  interface Window {
    __sorviaHost?: { require: (name: string) => unknown };
    __sorviaRegister?: (id: string, version: string, exports: Record<string, unknown>) => void;
  }
}

const loaded: Registry = new Map();
const pending = new Map<string, Promise<ComponentType>>();
const waiters = new Map<string, (component: ComponentType) => void>();
let installed: Record<string, InstalledModule> = {};
const listeners = new Set<() => void>();

window.__sorviaHost = {
  require(name: string) {
    if (!(name in SHARED)) throw new Error(`Sorvia modülü paylaşılmayan bir kütüphane istedi: ${name}`);
    return SHARED[name];
  },
};

window.__sorviaRegister = (id, version, exports) => {
  const key = `${id}@${version}`;
  const component = (exports.default ?? Object.values(exports).find((value) => typeof value === "function")) as ComponentType | undefined;
  if (!component) return;
  loaded.set(key, component);
  waiters.get(key)?.(component);
  waiters.delete(key);
};

function emit() {
  listeners.forEach((listener) => listener());
}

export function compareVersions(a: string, b: string) {
  const left = a.split(".").map((part) => Number(part) || 0);
  const right = b.split(".").map((part) => Number(part) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function startModules() {
  void bridge.modules.installed().then((list) => {
    installed = list;
    emit();
  });
  return bridge.modules.onUpdated((list) => {
    installed = list;
    emit();
  });
}

export function useInstalledModules() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => installed,
  );
}

function loadModule(id: string, version: string): Promise<ComponentType> {
  const key = `${id}@${version}`;
  const ready = loaded.get(key);
  if (ready) return Promise.resolve(ready);
  const running = pending.get(key);
  if (running) return running;
  const promise = new Promise<ComponentType>((resolve, reject) => {
    const base = `modules/${encodeURIComponent(id)}/${encodeURIComponent(version)}`;
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = `${base}/bundle.css`;
    style.dataset.module = key;
    document.head.appendChild(style);
    waiters.set(key, resolve);
    const script = document.createElement("script");
    script.src = `${base}/bundle.js`;
    script.async = true;
    script.onerror = () => {
      waiters.delete(key);
      pending.delete(key);
      reject(new Error("Modül yüklenemedi"));
    };
    document.head.appendChild(script);
    setTimeout(() => {
      if (!loaded.has(key)) {
        waiters.delete(key);
        pending.delete(key);
        reject(new Error("Modül zaman aşımına uğradı"));
      }
    }, 15_000);
  });
  pending.set(key, promise);
  return promise;
}

class Guard extends Component<{ fallback: ReactNode; onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Sorvia modülü çöktü", error, info.componentStack);
    this.props.onError();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const broken = new Set<string>();

export function ModuleScreen({ id, builtin: Builtin, builtinVersion }: { id: string; builtin: ComponentType; builtinVersion: string }) {
  const modules = useInstalledModules();
  const remote = modules[id];
  const usable = remote && compareVersions(remote.version, builtinVersion) > 0 && !broken.has(`${id}@${remote.version}`) ? remote.version : null;
  const [Loaded, setLoaded] = useState<ComponentType | null>(() => (usable ? (loaded.get(`${id}@${usable}`) ?? null) : null));

  useEffect(() => {
    if (!usable) {
      setLoaded(null);
      return;
    }
    let alive = true;
    loadModule(id, usable)
      .then((component) => alive && setLoaded(() => component))
      .catch(() => {
        broken.add(`${id}@${usable}`);
        if (alive) setLoaded(null);
      });
    return () => {
      alive = false;
    };
  }, [id, usable]);

  if (!usable || !Loaded) return <Builtin />;
  return (
    <Guard key={usable} fallback={<Builtin />} onError={() => broken.add(`${id}@${usable}`)}>
      <Loaded />
    </Guard>
  );
}
