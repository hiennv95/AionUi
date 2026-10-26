/**
 * Client for the private-LAN owner API (`/api/network/*`, ADR-009).
 * Types mirror `aionui-api-types/src/network.rs`.
 */

import { httpRequest, isBackendHttpError } from '@/common/adapter/httpBridge';

export type PeerState = 'pending_inbound' | 'pending_outbound' | 'trusted' | 'revoked';

export type RemoteRequestState =
  | 'pending_delivery'
  | 'queued'
  | 'running'
  | 'waiting_for_owner'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'expired';

export type WaitingKind = 'approval' | 'question';

export type NetworkStatus = {
  enabled: boolean;
  host_fingerprint: string;
  display_name: string;
  listen_port: number | null;
  managed_by_cli: boolean;
  last_error: string | null;
};

export type UpdateNetworkSettings = {
  enabled?: boolean;
  listen_port?: number;
  display_name?: string;
};

export type Peer = {
  id: string;
  fingerprint: string;
  display_name: string;
  peer_url: string | null;
  state: PeerState;
  verification_code: string;
  created_at: number;
  updated_at: number;
};

export type Share = {
  id: string;
  peer_id: string;
  peer_display_name: string;
  label: string;
  backend: string;
  mode: string;
  workspace: string;
  expires_at: number | null;
  revoked_at: number | null;
  created_at: number;
};

export type CreateShare = {
  peer_id: string;
  label: string;
  backend: string;
  workspace?: string;
  expires_at?: number;
};

export type RemoteAgent = {
  peer_id: string;
  peer_display_name: string;
  share_id: string;
  label: string;
  backend: string;
  expires_at: number | null;
};

export type SendRemoteRequest = {
  peer_id: string;
  share_id: string;
  share_label: string;
  content: string;
  thread_id?: string;
};

export type OutboundRequest = {
  id: string;
  peer_id: string;
  peer_display_name: string;
  share_id: string;
  share_label: string;
  request_id: string;
  thread_id: string;
  content: string;
  state: RemoteRequestState;
  error_code: string | null;
  waiting_kind: WaitingKind | null;
  result_text: string | null;
  peer_reachable: boolean;
  cancel_requested: boolean;
  deadline_at: number;
  created_at: number;
  updated_at: number;
  finished_at: number | null;
};

export type InboundRequest = {
  id: string;
  peer_id: string;
  peer_display_name: string;
  share_id: string;
  share_label: string;
  request_id: string;
  state: RemoteRequestState;
  error_code: string | null;
  waiting_kind: WaitingKind | null;
  conversation_id: string | null;
  created_at: number;
  updated_at: number;
  finished_at: number | null;
};

const TERMINAL_STATES: ReadonlySet<RemoteRequestState> = new Set(['succeeded', 'failed', 'cancelled', 'expired']);

export function isTerminal(state: RemoteRequestState): boolean {
  return TERMINAL_STATES.has(state);
}

const id = (value: string) => encodeURIComponent(value);

export const networkApi = {
  status: () => httpRequest<NetworkStatus>('GET', '/api/network/status'),
  updateSettings: (body: UpdateNetworkSettings) => httpRequest<NetworkStatus>('PUT', '/api/network/status', body),
  listPeers: () => httpRequest<Peer[]>('GET', '/api/network/peers'),
  addPeer: (url: string) => httpRequest<Peer>('POST', '/api/network/peers', { url }),
  approvePeer: (peerId: string) => httpRequest<Peer>('POST', `/api/network/peers/${id(peerId)}/approve`),
  revokePeer: (peerId: string) => httpRequest<Peer>('POST', `/api/network/peers/${id(peerId)}/revoke`),
  forgetPeer: (peerId: string) => httpRequest<void>('DELETE', `/api/network/peers/${id(peerId)}`),
  remoteAgents: (peerId: string) => httpRequest<RemoteAgent[]>('GET', `/api/network/peers/${id(peerId)}/remote-agents`),
  listShares: () => httpRequest<Share[]>('GET', '/api/network/shares'),
  createShare: (body: CreateShare) => httpRequest<Share>('POST', '/api/network/shares', body),
  unshare: (shareId: string) => httpRequest<void>('DELETE', `/api/network/shares/${id(shareId)}`),
  listRequests: () => httpRequest<OutboundRequest[]>('GET', '/api/network/requests'),
  sendRequest: (body: SendRemoteRequest) => httpRequest<OutboundRequest>('POST', '/api/network/requests', body),
  cancelRequest: (requestId: string) =>
    httpRequest<OutboundRequest>('POST', `/api/network/requests/${id(requestId)}/cancel`),
  listInbound: () => httpRequest<InboundRequest[]>('GET', '/api/network/inbound'),
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** User-facing text for a failed network call: a translated code when known, else the backend message. */
export function networkErrorText(error: unknown, t: Translate): string {
  if (isBackendHttpError(error)) {
    const fallback = error.backendMessage || error.code || t('settings.network.errors.generic');
    return error.code ? t(`settings.network.errors.${error.code}`, { defaultValue: fallback }) : fallback;
  }
  return t('settings.network.errors.generic');
}
