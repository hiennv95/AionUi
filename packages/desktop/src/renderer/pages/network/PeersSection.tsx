import { Button, Empty, Input, Message, Popconfirm } from '@arco-design/web-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NetworkCard, PeerStateTag } from './NetworkCard';
import { networkApi, networkErrorText, type Peer } from './networkApi';

/** Pair with another host by address, compare the code, approve, revoke or forget. */
const PeersSection: React.FC<{ peers: Peer[]; lanEnabled: boolean; onChanged: () => Promise<void> }> = ({
  peers,
  lanEnabled,
  onChanged,
}) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await action();
      if (success) Message.success(success);
      await onChanged();
      return true;
    } catch (error) {
      Message.error(networkErrorText(error, t));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const addPeer = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (await run('add', () => networkApi.addPeer(trimmed), t('settings.network.peers.added'))) setUrl('');
  };

  return (
    <NetworkCard title={t('settings.network.peers.title')}>
      <div className='text-12px text-t-tertiary mb-8px'>{t('settings.network.peers.description')}</div>
      <div className='flex gap-8px py-8px'>
        <Input
          value={url}
          placeholder={t('settings.network.peers.urlPlaceholder')}
          disabled={!lanEnabled}
          onChange={setUrl}
          onPressEnter={() => void addPeer()}
        />
        <Button type='primary' disabled={!lanEnabled || !url.trim()} loading={busy === 'add'} onClick={addPeer}>
          {t('settings.network.peers.add')}
        </Button>
      </div>
      {!lanEnabled && <div className='text-12px text-warning pb-8px'>{t('settings.network.peers.enableFirst')}</div>}

      {peers.length === 0 ? (
        <Empty description={t('settings.network.peers.empty')} />
      ) : (
        <div className='flex flex-col'>
          {peers.map((peer) => {
            const pending = peer.state === 'pending_inbound' || peer.state === 'pending_outbound';
            return (
              <div key={peer.id} className='flex flex-wrap items-center gap-12px py-12px border-t border-line'>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-8px'>
                    <span className='text-14px text-t-primary truncate'>{peer.display_name}</span>
                    <PeerStateTag state={peer.state} />
                  </div>
                  <div className='text-12px text-t-tertiary mt-2px font-mono truncate'>
                    {peer.peer_url ?? peer.fingerprint.slice(0, 16)}
                  </div>
                </div>
                {pending && (
                  <div className='text-center'>
                    <div className='text-11px text-t-tertiary'>{t('settings.network.peers.code')}</div>
                    <div className='text-20px font-mono font-600 tracking-widest text-t-primary'>
                      {peer.verification_code}
                    </div>
                  </div>
                )}
                <div className='flex items-center gap-8px'>
                  {pending && (
                    <Popconfirm
                      title={t('settings.network.peers.approveConfirm', { code: peer.verification_code })}
                      onOk={() => run(peer.id, () => networkApi.approvePeer(peer.id))}
                    >
                      <Button type='primary' size='small' loading={busy === peer.id}>
                        {t('settings.network.peers.approve')}
                      </Button>
                    </Popconfirm>
                  )}
                  {peer.state === 'trusted' && (
                    <Popconfirm
                      title={t('settings.network.peers.revokeConfirm')}
                      onOk={() => run(peer.id, () => networkApi.revokePeer(peer.id))}
                    >
                      <Button size='small' status='warning' loading={busy === peer.id}>
                        {t('settings.network.peers.revoke')}
                      </Button>
                    </Popconfirm>
                  )}
                  <Popconfirm
                    title={t('settings.network.peers.forgetConfirm')}
                    onOk={() => run(`forget-${peer.id}`, () => networkApi.forgetPeer(peer.id))}
                  >
                    <Button size='small' status='danger' loading={busy === `forget-${peer.id}`}>
                      {t('settings.network.peers.forget')}
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </NetworkCard>
  );
};

export default PeersSection;
