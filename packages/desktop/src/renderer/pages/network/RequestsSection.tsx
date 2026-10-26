import { Button, Empty, Input, Message, Select, Tag } from '@arco-design/web-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@/renderer/services/i18n/format';
import { NetworkCard, RequestStateTag } from './NetworkCard';
import {
  isTerminal,
  networkApi,
  networkErrorText,
  type OutboundRequest,
  type Peer,
  type RemoteAgent,
} from './networkApi';

type FollowUp = { threadId: string; shareLabel: string };

/** Ask an agent another host shares with this host, and follow what happened to each request. */
const RequestsSection: React.FC<{ peers: Peer[]; requests: OutboundRequest[]; onChanged: () => Promise<void> }> = ({
  peers,
  requests,
  onChanged,
}) => {
  const { t, i18n } = useTranslation();
  const trusted = peers.filter((peer) => peer.state === 'trusted');
  const [peerId, setPeerId] = useState<string | undefined>();
  const [agents, setAgents] = useState<RemoteAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [shareId, setShareId] = useState<string | undefined>();
  const [content, setContent] = useState('');
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Share to select once the agent list for a newly picked peer has loaded (follow-up).
  const wantedShareId = useRef<string | undefined>(undefined);

  // A peer that stops being trusted can no longer be asked.
  useEffect(() => {
    if (peerId && !trusted.some((peer) => peer.id === peerId)) setPeerId(undefined);
  }, [peerId, trusted]);

  useEffect(() => {
    setAgents([]);
    setShareId(undefined);
    if (!peerId) return;
    let cancelled = false;
    setAgentsLoading(true);
    networkApi
      .remoteAgents(peerId)
      .then((list) => {
        if (cancelled) return;
        setAgents(list);
        const wanted = list.find((item) => item.share_id === wantedShareId.current);
        wantedShareId.current = undefined;
        if (wanted) setShareId(wanted.share_id);
        else if (list.length === 1) setShareId(list[0].share_id);
      })
      .catch((error: unknown) => {
        if (!cancelled) Message.error(networkErrorText(error, t));
      })
      .finally(() => {
        if (!cancelled) setAgentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [peerId, t]);

  const agent = agents.find((item) => item.share_id === shareId);

  const send = async () => {
    if (!peerId || !agent || !content.trim()) return;
    setBusy('send');
    try {
      await networkApi.sendRequest({
        peer_id: peerId,
        share_id: agent.share_id,
        share_label: agent.label,
        content: content.trim(),
        thread_id: followUp?.threadId,
      });
      setContent('');
      setFollowUp(null);
      await onChanged();
    } catch (error) {
      Message.error(networkErrorText(error, t));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (id: string) => {
    setBusy(id);
    try {
      await networkApi.cancelRequest(id);
      await onChanged();
    } catch (error) {
      Message.error(networkErrorText(error, t));
    } finally {
      setBusy(null);
    }
  };

  const startFollowUp = (request: OutboundRequest) => {
    setFollowUp({ threadId: request.thread_id, shareLabel: request.share_label });
    if (request.peer_id === peerId) {
      setShareId(request.share_id);
    } else {
      wantedShareId.current = request.share_id;
      setPeerId(request.peer_id);
    }
  };

  return (
    <NetworkCard title={t('settings.network.requests.title')}>
      <div className='text-12px text-t-tertiary mb-8px'>{t('settings.network.requests.description')}</div>
      {trusted.length === 0 ? (
        <div className='text-12px text-t-secondary py-8px'>{t('settings.network.requests.needTrustedPeer')}</div>
      ) : (
        <div className='flex flex-col gap-8px py-8px'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-8px'>
            <Select
              value={peerId}
              placeholder={t('settings.network.requests.peerPlaceholder')}
              options={trusted.map((peer) => ({ label: peer.display_name, value: peer.id }))}
              onChange={(value: string) => {
                setPeerId(value);
                setFollowUp(null);
              }}
            />
            <Select
              value={shareId}
              loading={agentsLoading}
              disabled={!peerId}
              placeholder={
                peerId && !agentsLoading && agents.length === 0
                  ? t('settings.network.requests.noAgents')
                  : t('settings.network.requests.agentPlaceholder')
              }
              options={agents.map((item) => ({ label: `${item.label} (${item.backend})`, value: item.share_id }))}
              onChange={(value: string) => {
                setShareId(value);
                setFollowUp(null);
              }}
            />
          </div>
          {followUp && (
            <div className='flex items-center gap-8px text-12px text-t-secondary'>
              <Tag size='small' color='arcoblue'>
                {t('settings.network.requests.followUpOf', { label: followUp.shareLabel })}
              </Tag>
              <Button size='mini' type='text' onClick={() => setFollowUp(null)}>
                {t('settings.network.requests.newThread')}
              </Button>
            </div>
          )}
          <Input.TextArea
            value={content}
            autoSize={{ minRows: 3, maxRows: 10 }}
            placeholder={t('settings.network.requests.contentPlaceholder')}
            onChange={setContent}
          />
          <div>
            <Button
              type='primary'
              disabled={!agent || !content.trim()}
              loading={busy === 'send'}
              onClick={() => void send()}
            >
              {t('settings.network.requests.send')}
            </Button>
          </div>
        </div>
      )}

      {requests.length === 0 ? (
        <Empty description={t('settings.network.requests.empty')} />
      ) : (
        <div className='flex flex-col'>
          {requests.map((request) => (
            <div key={request.id} className='flex flex-col gap-6px py-12px border-t border-line'>
              <div className='flex flex-wrap items-center gap-8px'>
                <RequestStateTag state={request.state} waiting={request.waiting_kind} />
                <span className='text-13px text-t-primary'>
                  {request.share_label} · {request.peer_display_name}
                </span>
                {!request.peer_reachable && !isTerminal(request.state) && (
                  <Tag size='small' color='orange'>
                    {t('settings.network.requests.unreachable')}
                  </Tag>
                )}
                <span className='text-12px text-t-tertiary ml-auto'>
                  {formatDateTime(request.created_at, i18n.language)}
                </span>
              </div>
              <div className='text-13px text-t-secondary whitespace-pre-wrap break-words'>{request.content}</div>
              {request.result_text && (
                <div className='text-13px text-t-primary whitespace-pre-wrap break-words rd-8px bg-fill-1 px-10px py-8px'>
                  {request.result_text}
                </div>
              )}
              {request.error_code && (
                <div className='text-12px text-danger'>
                  {t(`settings.network.errors.${request.error_code}`, { defaultValue: request.error_code })}
                </div>
              )}
              <div className='flex gap-8px'>
                {!isTerminal(request.state) && (
                  <Button
                    size='mini'
                    status='danger'
                    disabled={request.cancel_requested}
                    loading={busy === request.id}
                    onClick={() => void cancel(request.id)}
                  >
                    {request.cancel_requested
                      ? t('settings.network.requests.cancelling')
                      : t('settings.network.requests.cancel')}
                  </Button>
                )}
                {request.state === 'succeeded' && (
                  <Button size='mini' onClick={() => startFollowUp(request)}>
                    {t('settings.network.requests.followUp')}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </NetworkCard>
  );
};

export default RequestsSection;
