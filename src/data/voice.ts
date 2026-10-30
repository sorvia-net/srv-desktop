import { useSyncExternalStore } from "react";

import type { VoicePeer } from "@shared/contracts";

import { voiceApi } from "./api";
import { bridge } from "./bridge";
import { invalidate } from "./query";
import { playEffect } from "./sound";

type Remote = {
  info: VoicePeer;
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  audio: HTMLAudioElement;
  videos: Map<string, MediaStream>;
  labels: { screen?: string; camera?: string };
  senders: RTCRtpSender[];
  screenSender: RTCRtpSender | null;
  cameraSender: RTCRtpSender | null;
  level: (() => number) | null;
};

export type VoiceView = {
  status: "idle" | "connecting" | "connected" | "error";
  error: string | null;
  channelId: string | null;
  channelName: string | null;
  peerId: string | null;
  muted: boolean;
  deafened: boolean;
  sharing: boolean;
  camera: boolean;
  volumes: Record<string, number>;
  ping: number | null;
  serverPing: number | null;
  peers: (VoicePeer & { me: boolean; speaking: boolean; connection: RTCPeerConnectionState | "self"; hasScreen: boolean; hasCamera: boolean })[];
};

const VOLUME_KEY = "sorvia.voice.volumes";
const DEVICE_KEY = "sorvia.voice.devices";
const QUALITY_KEY = "sorvia.voice.quality";

export type ShareQuality = { height: 720 | 1080 | 1440 | 0; fps: 15 | 30 | 60 };
export type VoiceDevices = { input: string; output: string; camera: string };

function readJson<T>(key: string, fallback: T): T {
  try {
    return { ...fallback, ...(JSON.parse(localStorage.getItem(key) ?? "{}") as Partial<T>) };
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    void 0;
  }
}

export function getDevices(): VoiceDevices {
  return readJson<VoiceDevices>(DEVICE_KEY, { input: "default", output: "default", camera: "default" });
}

export function getShareQuality(): ShareQuality {
  return readJson<ShareQuality>(QUALITY_KEY, { height: 1080, fps: 30 });
}
function loadVolumes(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(VOLUME_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

const IDLE: VoiceView = { status: "idle", error: null, channelId: null, channelName: null, peerId: null, muted: false, deafened: false, sharing: false, camera: false, volumes: {}, ping: null, serverPing: null, peers: [] };

let view: VoiceView = { ...IDLE, volumes: loadVolumes() };
const listeners = new Set<() => void>();
const remotes = new Map<string, Remote>();
let local: MediaStream | null = null;
let screen: MediaStream | null = null;
let camera: MediaStream | null = null;
let screenLabel: string | null = null;
let ice: RTCIceServer[] = [];
let outbox: { to: string; kind: string; payload: unknown }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let meter: ReturnType<typeof setInterval> | null = null;
let pinger: ReturnType<typeof setInterval> | null = null;
let audioContext: AudioContext | null = null;
let localLevel: (() => number) | null = null;
const speaking = new Set<string>();
let roster: VoicePeer[] = [];

function emit() {
  view = {
    ...view,
    peers: roster.map((peer) => {
      const remote = remotes.get(peer.id);
      return {
        ...peer,
        me: peer.id === view.peerId,
        speaking: speaking.has(peer.id),
        connection: peer.id === view.peerId ? "self" : (remote?.pc.connectionState ?? "new"),
        hasScreen: peer.id === view.peerId ? Boolean(screen) : Boolean(remote && videoOf(remote, "screen")),
        hasCamera: peer.id === view.peerId ? Boolean(camera) : Boolean(remote && videoOf(remote, "camera")),
        ...(peer.id === view.peerId ? { muted: view.muted, deafened: view.deafened, sharing: view.sharing, camera: view.camera } : {}),
      };
    }),
  };
  listeners.forEach((listener) => listener());
}

function set(patch: Partial<VoiceView>) {
  view = { ...view, ...patch };
  emit();
}

export function useVoice() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => view,
  );
}

function videoOf(remote: Remote, kind: "screen" | "camera") {
  const id = remote.labels[kind];
  if (id && remote.videos.has(id)) return remote.videos.get(id)!;
  if (id) {
    const other = remote.labels[kind === "screen" ? "camera" : "screen"];
    const rest = [...remote.videos.entries()].filter(([key]) => key !== other);
    return rest.length === 1 ? rest[0]![1] : null;
  }
  const other = remote.labels[kind === "screen" ? "camera" : "screen"];
  const unlabeled = [...remote.videos.entries()].filter(([key]) => key !== other);
  if (kind === "screen" && remote.info.sharing && !remote.info.camera) return unlabeled[0]?.[1] ?? null;
  if (kind === "camera" && remote.info.camera && !remote.info.sharing) return unlabeled[0]?.[1] ?? null;
  return null;
}

export function remoteScreen(peerId: string) {
  if (peerId === view.peerId) return screen;
  const remote = remotes.get(peerId);
  return remote ? videoOf(remote, "screen") : null;
}

export function remoteCamera(peerId: string) {
  if (peerId === view.peerId) return camera;
  const remote = remotes.get(peerId);
  return remote ? videoOf(remote, "camera") : null;
}

function volumeFor(userId: string) {
  return view.volumes[userId] ?? 100;
}

function applyVolume(remote: Remote) {
  const volume = volumeFor(remote.info.userId);
  remote.audio.volume = Math.min(1, Math.max(0, volume / 100));
  remote.audio.muted = view.deafened || volume === 0;
  const sink = getDevices().output;
  const element = remote.audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
  if (element.setSinkId && sink) void element.setSinkId(sink === "default" ? "" : sink).catch(() => undefined);
}

function micConstraints(): MediaTrackConstraints {
  const input = getDevices().input;
  return { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(input && input !== "default" ? { deviceId: { exact: input } } : {}) };
}

export async function setDevices(next: Partial<VoiceDevices>) {
  const devices = { ...getDevices(), ...next };
  writeJson(DEVICE_KEY, devices);
  for (const remote of remotes.values()) applyVolume(remote);
  if (next.input && local) {
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ audio: micConstraints(), video: false });
      const track = fresh.getAudioTracks()[0]!;
      track.enabled = !view.muted && !view.deafened;
      for (const remote of remotes.values()) {
        const sender = remote.senders.find((item) => item.track?.kind === "audio");
        if (sender) await sender.replaceTrack(track);
      }
      local.getAudioTracks().forEach((item) => item.stop());
      local = fresh;
      localLevel = analyser(fresh);
    } catch {
      set({ error: "Seçilen mikrofon açılamadı." });
    }
  }
  emit();
}

function cameraConstraints(): MediaTrackConstraints {
  const id = getDevices().camera;
  return { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, ...(id && id !== "default" ? { deviceId: { exact: id } } : {}) };
}

export async function switchCamera(id: string) {
  writeJson(DEVICE_KEY, { ...getDevices(), camera: id });
  if (!camera) return emit();
  try {
    const fresh = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(), audio: false });
    const track = fresh.getVideoTracks()[0]!;
    track.contentHint = "motion";
    track.onended = () => void stopCamera();
    for (const remote of remotes.values()) if (remote.cameraSender) await remote.cameraSender.replaceTrack(track).catch(() => undefined);
    for (const item of camera.getTracks()) {
      item.onended = null;
      item.stop();
      camera.removeTrack(item);
    }
    camera.addTrack(track);
    emit();
  } catch {
    set({ error: "Seçilen kamera açılamadı." });
  }
}

export async function setShareQuality(next: Partial<ShareQuality>) {
  const quality = { ...getShareQuality(), ...next };
  writeJson(QUALITY_KEY, quality);
  const track = screen?.getVideoTracks()[0];
  if (track) await track.applyConstraints(shareConstraints(quality)).catch(() => undefined);
  emit();
}

function shareConstraints(quality: ShareQuality): MediaTrackConstraints {
  return { frameRate: { ideal: quality.fps, max: quality.fps }, ...(quality.height ? { height: { ideal: quality.height, max: quality.height } } : {}) };
}

async function measurePing() {
  let best: number | null = null;
  for (const remote of remotes.values()) {
    try {
      const stats = await remote.pc.getStats();
      stats.forEach((report) => {
        const pair = report as { type: string; state?: string; nominated?: boolean; currentRoundTripTime?: number };
        if (pair.type === "candidate-pair" && pair.state === "succeeded" && pair.nominated && typeof pair.currentRoundTripTime === "number") {
          const value = Math.round(pair.currentRoundTripTime * 1000);
          best = best === null ? value : Math.max(best, value);
        }
      });
    } catch {
      void 0;
    }
  }
  if (best !== view.ping) {
    view = { ...view, ping: best };
    emit();
  }
}

export function setPeerVolume(userId: string, volume: number) {
  const volumes = { ...view.volumes, [userId]: Math.round(Math.max(0, Math.min(100, volume))) };
  try {
    localStorage.setItem(VOLUME_KEY, JSON.stringify(volumes));
  } catch {
    void 0;
  }
  view = { ...view, volumes };
  for (const remote of remotes.values()) if (remote.info.userId === userId) applyVolume(remote);
  emit();
}

function announce(to?: string) {
  const payload = { screen: screen ? (screenLabel ?? screen.id) : null, camera: camera?.id ?? null };
  for (const id of to ? [to] : [...remotes.keys()]) send(id, "streams", payload);
}

function analyser(stream: MediaStream) {
  try {
    audioContext ??= new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const node = audioContext.createAnalyser();
    node.fftSize = 512;
    source.connect(node);
    const data = new Uint8Array(node.frequencyBinCount);
    return () => {
      node.getByteFrequencyData(data);
      let sum = 0;
      for (const value of data) sum += value;
      return sum / data.length;
    };
  } catch {
    return null;
  }
}

function send(to: string, kind: string, payload: unknown) {
  outbox.push({ to, kind, payload });
}

function connect(info: VoicePeer) {
  const pc = new RTCPeerConnection({ iceServers: ice });
  const audio = new Audio();
  audio.autoplay = true;
  audio.muted = view.deafened;
  const remote: Remote = { info, pc, polite: (view.peerId ?? "") > info.id, makingOffer: false, ignoreOffer: false, audio, videos: new Map(), labels: {}, senders: [], screenSender: null, cameraSender: null, level: null };
  remotes.set(info.id, remote);
  applyVolume(remote);

  for (const track of local?.getTracks() ?? []) remote.senders.push(pc.addTrack(track, local!));
  if (screen) {
    const track = screen.getVideoTracks()[0];
    if (track) remote.screenSender = pc.addTrack(track, screen);
  }
  if (camera) {
    const track = camera.getVideoTracks()[0];
    if (track) remote.cameraSender = pc.addTrack(track, camera);
  }
  if (screen || camera) announce(info.id);

  pc.onicecandidate = (event) => {
    if (event.candidate) send(info.id, "candidate", event.candidate.toJSON());
  };
  pc.onnegotiationneeded = async () => {
    try {
      remote.makingOffer = true;
      await pc.setLocalDescription();
      send(info.id, "offer", pc.localDescription?.toJSON());
    } catch {
      return;
    } finally {
      remote.makingOffer = false;
    }
  };
  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (event.track.kind === "audio") {
      const audioStream = stream ?? new MediaStream([event.track]);
      audio.srcObject = audioStream;
      void audio.play().catch(() => undefined);
      remote.level = analyser(audioStream);
    } else {
      const video = stream ?? new MediaStream([event.track]);
      remote.videos.set(video.id, video);
      const drop = () => {
        remote.videos.delete(video.id);
        emit();
      };
      event.track.onended = drop;
      event.track.onmute = drop;
      event.track.onunmute = () => {
        remote.videos.set(video.id, video);
        emit();
      };
      emit();
    }
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") pc.restartIce();
    emit();
  };
  return remote;
}

function disconnect(id: string) {
  const remote = remotes.get(id);
  if (!remote) return;
  remote.pc.close();
  remote.audio.srcObject = null;
  remotes.delete(id);
  speaking.delete(id);
}

async function handleSignal(signal: { from: string; kind: string; payload: unknown }) {
  let remote = remotes.get(signal.from);
  if (!remote) {
    const info = roster.find((peer) => peer.id === signal.from);
    if (!info) return;
    remote = connect(info);
  }
  const pc = remote.pc;
  try {
    if (signal.kind === "offer" || signal.kind === "answer") {
      const description = signal.payload as RTCSessionDescriptionInit;
      const collision = description.type === "offer" && (remote.makingOffer || pc.signalingState !== "stable");
      remote.ignoreOffer = !remote.polite && collision;
      if (remote.ignoreOffer) return;
      await pc.setRemoteDescription(description);
      if (description.type === "offer") {
        await pc.setLocalDescription();
        send(signal.from, "answer", pc.localDescription?.toJSON());
      }
    } else if (signal.kind === "candidate") {
      try {
        await pc.addIceCandidate(signal.payload as RTCIceCandidateInit);
      } catch (error) {
        if (!remote.ignoreOffer) throw error;
      }
    } else if (signal.kind === "streams") {
      const labels = signal.payload as { screen?: string | null; camera?: string | null };
      remote.labels = { screen: labels.screen ?? undefined, camera: labels.camera ?? undefined };
      emit();
    } else if (signal.kind === "bye") {
      disconnect(signal.from);
    }
  } catch {
    return;
  }
}

async function loop() {
  if (!view.peerId) return;
  const signals = outbox;
  outbox = [];
  const started = performance.now();
  const result = await voiceApi.sync({ peerId: view.peerId, state: { muted: view.muted, deafened: view.deafened, sharing: view.sharing, camera: view.camera }, signals });
  if (!view.peerId) return;
  if (!result.ok) {
    if (result.status === 410) {
      await leaveVoice(false);
      set({ status: "error", error: "Ses bağlantısı kesildi." });
      return;
    }
    outbox = [...signals, ...outbox];
  } else {
    view = { ...view, serverPing: Math.round(performance.now() - started) };
    const before = new Set(roster.map((peer) => peer.id));
    roster = result.data.peers;
    const present = new Set(roster.map((peer) => peer.id));
    const others = (ids: Set<string>) => [...ids].filter((id) => id !== view.peerId);
    if (others(present).some((id) => !before.has(id))) playEffect("voice-join");
    else if (others(before).some((id) => !present.has(id))) playEffect("voice-leave");
    for (const id of [...remotes.keys()]) if (!present.has(id)) disconnect(id);
    for (const peer of roster) {
      if (peer.id === view.peerId) continue;
      const remote = remotes.get(peer.id);
      if (remote) remote.info = peer;
      else if (view.peerId && view.peerId < peer.id) connect(peer);
    }
    for (const signal of result.data.signals) await handleSignal(signal);
    emit();
  }
  timer = setTimeout(() => void loop(), outbox.length ? 150 : 700);
}

function measure() {
  const next = new Set<string>();
  if (view.peerId && localLevel && !view.muted && localLevel() > 18) next.add(view.peerId);
  for (const [id, remote] of remotes) if (remote.level && remote.level() > 14) next.add(id);
  const changed = next.size !== speaking.size || [...next].some((id) => !speaking.has(id));
  if (!changed) return;
  speaking.clear();
  next.forEach((id) => speaking.add(id));
  emit();
}

export async function joinVoice(channelId: string) {
  if (view.channelId === channelId && view.status !== "error") return;
  if (view.peerId) await leaveVoice();
  set({ ...IDLE, volumes: view.volumes, status: "connecting", channelId });
  try {
    local = await navigator.mediaDevices.getUserMedia({ audio: micConstraints(), video: false }).catch(() => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }));
  } catch {
    set({ ...IDLE, volumes: view.volumes, status: "error", error: "Mikrofona erişilemedi. Windows gizlilik ayarlarında mikrofon iznini kontrol et." });
    return;
  }
  const joined = await voiceApi.join(channelId);
  if (!joined.ok) {
    local.getTracks().forEach((track) => track.stop());
    local = null;
    set({ ...IDLE, volumes: view.volumes, status: "error", error: joined.message });
    return;
  }
  ice = joined.data.iceServers;
  roster = joined.data.peers;
  localLevel = analyser(local);
  set({ status: "connected", error: null, channelId, channelName: joined.data.channel.name, peerId: joined.data.peerId });
  playEffect("voice-join");
  for (const peer of roster) if (peer.id !== joined.data.peerId && joined.data.peerId < peer.id) connect(peer);
  meter = setInterval(measure, 200);
  pinger = setInterval(() => void measurePing(), 3000);
  void loop();
  invalidate("chat:channels");
}

export async function leaveVoice(notify = true) {
  const peerId = view.peerId;
  if (peerId) playEffect("voice-leave");
  if (timer) clearTimeout(timer);
  if (meter) clearInterval(meter);
  if (pinger) clearInterval(pinger);
  pinger = null;
  timer = null;
  meter = null;
  for (const id of [...remotes.keys()]) disconnect(id);
  local?.getTracks().forEach((track) => track.stop());
  screen?.getTracks().forEach((track) => track.stop());
  camera?.getTracks().forEach((track) => track.stop());
  local = null;
  screen = null;
  camera = null;
  localLevel = null;
  roster = [];
  outbox = [];
  speaking.clear();
  view = { ...IDLE, volumes: view.volumes };
  emit();
  if (peerId && notify) await voiceApi.leave(peerId);
  invalidate("chat:channels");
}

export function toggleMute() {
  const muted = !view.muted;
  local?.getAudioTracks().forEach((track) => (track.enabled = !muted && !view.deafened));
  set({ muted });
}

export function toggleDeafen() {
  const deafened = !view.deafened;
  local?.getAudioTracks().forEach((track) => (track.enabled = !deafened && !view.muted));
  set({ deafened, muted: deafened ? true : view.muted });
  for (const remote of remotes.values()) applyVolume(remote);
  if (!deafened) local?.getAudioTracks().forEach((track) => (track.enabled = !view.muted));
}

export async function startScreenShare(sourceId: string) {
  if (!view.peerId) return;
  await bridge.system.chooseScreen(sourceId);
  const quality = getShareQuality();
  let next: MediaStream;
  try {
    next = await navigator.mediaDevices.getDisplayMedia({ video: shareConstraints(quality), audio: false });
  } catch {
    set({ error: "Ekran paylaşımı başlatılamadı." });
    return;
  }
  const track = next.getVideoTracks()[0]!;
  track.contentHint = quality.fps >= 60 ? "motion" : "detail";
  track.onended = () => void stopScreenShare();
  if (screen) {
    const old = screen;
    for (const remote of remotes.values()) {
      if (remote.screenSender) await remote.screenSender.replaceTrack(track).catch(() => undefined);
      else remote.screenSender = remote.pc.addTrack(track, next);
    }
    old.getTracks().forEach((item) => {
      item.onended = null;
      item.stop();
    });
    screen = next;
    announce();
    emit();
    return;
  }
  screen = next;
  screenLabel = next.id;
  for (const remote of remotes.values()) remote.screenSender = remote.pc.addTrack(track, screen);
  announce();
  set({ sharing: true });
}

export async function stopScreenShare() {
  for (const remote of remotes.values()) {
    if (remote.screenSender) {
      try {
        remote.pc.removeTrack(remote.screenSender);
      } catch {
        void 0;
      }
      remote.screenSender = null;
    }
  }
  screen?.getTracks().forEach((track) => track.stop());
  screen = null;
  screenLabel = null;
  announce();
  set({ sharing: false });
}

export async function startCamera() {
  if (!view.peerId || camera) return;
  try {
    camera = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(), audio: false });
  } catch {
    set({ error: "Kameraya erişilemedi. Windows gizlilik ayarlarında kamera iznini kontrol et." });
    return;
  }
  const track = camera.getVideoTracks()[0]!;
  track.contentHint = "motion";
  track.onended = () => void stopCamera();
  for (const remote of remotes.values()) remote.cameraSender = remote.pc.addTrack(track, camera);
  announce();
  set({ camera: true });
}

export async function stopCamera() {
  for (const remote of remotes.values()) {
    if (remote.cameraSender) {
      try {
        remote.pc.removeTrack(remote.cameraSender);
      } catch {
        void 0;
      }
      remote.cameraSender = null;
    }
  }
  camera?.getTracks().forEach((track) => track.stop());
  camera = null;
  announce();
  set({ camera: false });
}
