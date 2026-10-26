import { useCallback, useEffect, useRef, useState } from 'react';
import {
  networkApi,
  type InboundRequest,
  type NetworkStatus,
  type OutboundRequest,
  type Peer,
  type Share,
} from './networkApi';

/** Pairing and request states change on the other host, so the page polls. */
export const NETWORK_POLL_MS = 3000;

export type NetworkData = {
  status: NetworkStatus | null;
  peers: Peer[];
  shares: Share[];
  requests: OutboundRequest[];
  inbound: InboundRequest[];
  /** Set when the last load failed entirely (e.g. host unreachable). */
  loadError: unknown;
  loaded: boolean;
};

const EMPTY: NetworkData = {
  status: null,
  peers: [],
  shares: [],
  requests: [],
  inbound: [],
  loadError: null,
  loaded: false,
};

/** Loads every `/api/network` list and keeps it fresh while the page is open. */
export function useNetworkData(): NetworkData & { reload: () => Promise<void> } {
  const [data, setData] = useState<NetworkData>(EMPTY);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    try {
      const [status, peers, shares, requests, inbound] = await Promise.all([
        networkApi.status(),
        networkApi.listPeers(),
        networkApi.listShares(),
        networkApi.listRequests(),
        networkApi.listInbound(),
      ]);
      if (mounted.current) setData({ status, peers, shares, requests, inbound, loadError: null, loaded: true });
    } catch (error) {
      if (mounted.current) setData((prev) => ({ ...prev, loadError: error, loaded: true }));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    const timer = window.setInterval((): void => void reload(), NETWORK_POLL_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [reload]);

  return { ...data, reload };
}
