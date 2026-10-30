import { useSyncExternalStore } from "react";

import type { VoicePeer } from "@shared/contracts";

import { voiceApi } from "./api";
import { bridge } from "./bridge";
import { invalidate } from "./query";

type Remote = {
  info: VoicePeer;
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  audio: HTMLAudioElement;
  screen: MediaStream | null;
  senders: RTCRtpSender[];
  screenSender: RTCRtpSender | null;
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
  peers: (VoicePeer & { me: boolean; speaking: boolean; connection: RTCPeerConnectionState | "self"; hasScreen: boolean })[];
};

const IDLE: VoiceView = { status: "idle", error: null, channelId: null, channelName: null, peerId: null, muted: false, deafened: false, sharing: false, peers: [] };

let view: VoiceView = IDLE;
const listeners = new Set<() => void>();
const remotes = new Map<string, Remote>();
let local: MediaStream | null = null;
let screen: MediaStream | null = null;
let ice: RTCIceServer[] = [];
let outbox: { to: string; kind: string; payload: unknown }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let meter: ReturnType<typeof setInterval> | null = null;
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
        hasScreen: peer.id === view.peerId ? Boolean(screen) : Boolean(remote?.screen),
        ...(peer.id === view.peerId ? { muted: view.muted, deafened: view.deafened, sharing: view.sharing } : {}),
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

export function remoteScreen(peerId: string) {
  return peerId === view.peerId ? screen : (remotes.get(peerId)?.screen ?? null);
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
  const remote: Remote = { info, pc, polite: (view.peerId ?? "") > info.id, makingOffer: false, ignoreOffer: false, audio, screen: null, senders: [], screenSender: null, level: null };
  remotes.set(info.id, remote);

  for (const track of local?.getTracks() ?? []) remote.senders.push(pc.addTrack(track, local!));
  if (screen) {
    const track = screen.getVideoTracks()[0];
    if (track) remote.screenSender = pc.addTrack(track, screen);
  }

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
      remote.screen = stream ?? new MediaStream([event.track]);
      event.track.onended = () => {
        remote.screen = null;
        emit();
      };
      event.track.onmute = () => {
        remote.screen = null;
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
  const result = await voiceApi.sync({ peerId: view.peerId, state: { muted: view.muted, deafened: view.deafened, sharing: view.sharing }, signals });
  if (!view.peerId) return;
  if (!result.ok) {
    if (result.status === 410) {
      await leaveVoice(false);
      set({ status: "error", error: "Ses bağlantısı kesildi." });
      return;
    }
    outbox = [...signals, ...outbox];
  } else {
    roster = result.data.peers;
    const present = new Set(roster.map((peer) => peer.id));
    for (const id of [...remotes.keys()]) if (!present.has(id)) disconnect(id);
    for (const peer of roster) {
      if (peer.id === view.peerId) continue;
      const remote = remotes.get(peer.id);
      if (remote) remote.info = peer;
      else if (view.peerId < peer.id) connect(peer);
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
  set({ ...IDLE, status: "connecting", channelId });
  try {
    local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
  } catch {
    set({ ...IDLE, status: "error", error: "Mikrofona erişilemedi. Windows gizlilik ayarlarında mikrofon iznini kontrol et." });
    return;
  }
  const joined = await voiceApi.join(channelId);
  if (!joined.ok) {
    local.getTracks().forEach((track) => track.stop());
    local = null;
    set({ ...IDLE, status: "error", error: joined.message });
    return;
  }
  ice = joined.data.iceServers;
  roster = joined.data.peers;
  localLevel = analyser(local);
  set({ status: "connected", error: null, channelId, channelName: joined.data.channel.name, peerId: joined.data.peerId });
  for (const peer of roster) if (peer.id !== joined.data.peerId && joined.data.peerId < peer.id) connect(peer);
  meter = setInterval(measure, 200);
  void loop();
  invalidate("chat:channels");
}

export async function leaveVoice(notify = true) {
  const peerId = view.peerId;
  if (timer) clearTimeout(timer);
  if (meter) clearInterval(meter);
  timer = null;
  meter = null;
  for (const id of [...remotes.keys()]) disconnect(id);
  local?.getTracks().forEach((track) => track.stop());
  screen?.getTracks().forEach((track) => track.stop());
  local = null;
  screen = null;
  localLevel = null;
  roster = [];
  outbox = [];
  speaking.clear();
  view = IDLE;
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
  for (const remote of remotes.values()) remote.audio.muted = deafened;
  local?.getAudioTracks().forEach((track) => (track.enabled = !deafened && !view.muted));
  set({ deafened, muted: deafened ? true : view.muted });
  if (!deafened) local?.getAudioTracks().forEach((track) => (track.enabled = !view.muted));
}

export async function startScreenShare(sourceId: string) {
  if (!view.peerId) return;
  await bridge.system.chooseScreen(sourceId);
  try {
    screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
  } catch {
    set({ error: "Ekran paylaşımı başlatılamadı." });
    return;
  }
  const track = screen.getVideoTracks()[0]!;
  track.contentHint = "detail";
  track.onended = () => void stopScreenShare();
  for (const remote of remotes.values()) remote.screenSender = remote.pc.addTrack(track, screen);
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
  set({ sharing: false });
}
