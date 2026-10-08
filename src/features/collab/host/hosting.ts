import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { create } from 'zustand';
import { commit, flush, schedule } from '../../../db/saveQueue';
import { setSetting } from '../../../db/settings';
import {
  deleteGrant,
  deleteMember,
  insertMember,
  loadGrants,
  loadMembers,
  MEMBER_COLORS,
  newToken,
  renameMember,
  setGrant,
  type Member,
} from '../../../db/share';
import { newId } from '../../../lib/ids';
import { confirmDialog } from '../../../store/confirm';
import { reportError } from '../../../store/toast';
import { usePresence } from '../presence';
import type { Grant, Role } from '../access';
import { startHub, stopHub, syncAccess } from './hub';

export type Phase = 'off' | 'starting' | 'downloading' | 'connecting' | 'online' | 'error';

export interface ShareStatus {
  phase: Phase;
  url: string | null;
  localUrl: string | null;
  error: string | null;
}

const OFF: ShareStatus = { phase: 'off', url: null, localUrl: null, error: null };
export const HOST_COLOR = '#2f6fde';

interface HostingState {
  status: ShareStatus;
  /** Editoren und Boards laufen gemeinsam (Yjs) statt lokal. */
  live: boolean;
  members: Member[];
  grants: Grant[];
  hostName: string;
  hydrate(settings: Record<string, string>): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  invite(name: string): Promise<Member>;
  removeMember(id: string): Promise<void>;
  renameMember(id: string, name: string): void;
  setRole(memberId: string, pageId: string, role: Role | null): Promise<void>;
  setHostName(name: string): void;
}

/** Einladungslink einer Person; erst verfügbar, wenn der Tunnel steht. */
export function inviteLink(status: ShareStatus, member: Member): string | null {
  return status.url ? `${status.url}/#join=${member.token}` : null;
}

export const useHosting = create<HostingState>((set, get) => ({
  status: OFF,
  live: false,
  members: [],
  grants: [],
  hostName: 'Gastgeber',

  async hydrate(settings) {
    const [members, grants, status] = await Promise.all([loadMembers(), loadGrants(), invoke<ShareStatus>('share_status')]);
    set({ members, grants, status, hostName: settings['share.name'] || 'Gastgeber' });
    await listen<ShareStatus>('share:status', (event) => set({ status: event.payload }));
  },

  async start() {
    if (get().live) return;
    try {
      await flush();
      await startHub();
      set({ live: true });
      set({ status: await invoke<ShareStatus>('share_start') });
    } catch (err) {
      await get().stop();
      reportError('Teilen konnte nicht gestartet werden', err);
    }
  },

  async stop() {
    await invoke('share_stop').catch(() => undefined);
    await stopHub();
    set({ live: false, status: OFF });
  },

  async invite(name) {
    const { members } = get();
    const member: Member = {
      id: newId(),
      name: name.trim() || 'Gast',
      token: newToken(),
      color: MEMBER_COLORS[members.length % MEMBER_COLORS.length],
      createdAt: Date.now(),
    };
    await commit([insertMember(member)]);
    set({ members: [...members, member] });
    return member;
  },

  async removeMember(id) {
    await commit([deleteMember(id)]);
    set((s) => ({ members: s.members.filter((m) => m.id !== id), grants: s.grants.filter((g) => g.memberId !== id) }));
    await invoke('share_close_member', { memberId: id }).catch(() => undefined);
    syncAccess();
  },

  renameMember(id, name) {
    set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, name } : m)) }));
    schedule(`member:${id}`, () => {
      const member = get().members.find((m) => m.id === id);
      return member ? [renameMember(id, member.name.trim() || 'Gast')] : [];
    });
  },

  async setRole(memberId, pageId, role) {
    const others = get().grants.filter((g) => !(g.memberId === memberId && g.pageId === pageId));
    const grants = role ? [...others, { memberId, pageId, role }] : others;
    await commit([role ? setGrant(memberId, pageId, role) : deleteGrant(memberId, pageId)]);
    set({ grants });
    syncAccess();
  },

  setHostName(name) {
    set({ hostName: name });
    schedule('setting:share.name', () => [setSetting('share.name', get().hostName.trim() || 'Gastgeber')]);
  },
}));

export const isLive = () => useHosting.getState().live;

/** Vor dem Schließen: arbeiten gerade andere mit, nachfragen. */
export async function confirmStopSharing(): Promise<boolean> {
  const guests = usePresence.getState().people.filter((p) => p.id !== 'host').length;
  if (!useHosting.getState().live || guests === 0) return true;
  return confirmDialog({
    title: 'Teilen wird beendet',
    message: `${guests === 1 ? 'Eine Person arbeitet' : `${guests} Personen arbeiten`} gerade mit. Wenn flou schließt, werden sie getrennt; alles Bisherige ist gespeichert.`,
    confirmLabel: 'Trotzdem schließen',
    danger: true,
  });
}
