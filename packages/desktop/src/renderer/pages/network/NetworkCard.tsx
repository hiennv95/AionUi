import { Tag } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PeerState, RemoteRequestState, WaitingKind } from './networkApi';

/** Settings-style card with a title, matching the WebUI settings page. */
export const NetworkCard: React.FC<{ title: string; extra?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  extra,
  children,
}) => (
  <div className='px-[12px] md:px-[28px] py-14px bg-2 rd-16px'>
    <div className='flex items-center justify-between gap-8px mb-8px'>
      <div className='text-14px font-500 text-t-primary'>{title}</div>
      {extra}
    </div>
    {children}
  </div>
);

const REQUEST_STATE_COLOR: Record<RemoteRequestState, string> = {
  pending_delivery: 'gray',
  queued: 'gray',
  running: 'arcoblue',
  waiting_for_owner: 'orange',
  succeeded: 'green',
  failed: 'red',
  cancelled: 'gray',
  expired: 'red',
};

export const RequestStateTag: React.FC<{ state: RemoteRequestState; waiting?: WaitingKind | null }> = ({
  state,
  waiting,
}) => {
  const { t } = useTranslation();
  const label =
    state === 'waiting_for_owner' && waiting
      ? t(`settings.network.waiting.${waiting}`)
      : t(`settings.network.requestState.${state}`);
  return (
    <Tag size='small' color={REQUEST_STATE_COLOR[state]}>
      {label}
    </Tag>
  );
};

const PEER_STATE_COLOR: Record<PeerState, string> = {
  pending_inbound: 'orange',
  pending_outbound: 'orange',
  trusted: 'green',
  revoked: 'red',
};

export const PeerStateTag: React.FC<{ state: PeerState }> = ({ state }) => {
  const { t } = useTranslation();
  return (
    <Tag size='small' color={PEER_STATE_COLOR[state]}>
      {t(`settings.network.peerState.${state}`)}
    </Tag>
  );
};
