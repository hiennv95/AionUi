import { Alert, Button, Input, InputNumber, Message, Switch } from '@arco-design/web-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NetworkCard } from './NetworkCard';
import { networkApi, networkErrorText, type NetworkStatus, type UpdateNetworkSettings } from './networkApi';

const DEFAULT_PEER_PORT = 25820;

/** This host's LAN identity and the on/off switch for the peer listener. */
const HostSection: React.FC<{ status: NetworkStatus; onChanged: () => Promise<void> }> = ({ status, onChanged }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState(status.display_name);
  const [port, setPort] = useState<number | undefined>(status.listen_port ?? undefined);

  // Follow the server after a save or a change made elsewhere.
  useEffect(() => setDisplayName(status.display_name), [status.display_name]);
  useEffect(() => setPort(status.listen_port ?? undefined), [status.listen_port]);

  const update = async (body: UpdateNetworkSettings) => {
    setBusy(true);
    try {
      await networkApi.updateSettings(body);
      await onChanged();
    } catch (error) {
      Message.error(networkErrorText(error, t));
    } finally {
      setBusy(false);
    }
  };

  const dirty = displayName.trim() !== status.display_name || (port !== undefined && port !== status.listen_port);

  return (
    <NetworkCard title={t('settings.network.host.title')}>
      <div className='text-12px text-t-tertiary mb-8px'>{t('settings.network.host.description')}</div>
      <div className='flex items-center justify-between gap-12px py-12px'>
        <div className='min-w-0 flex-1'>
          <div className='text-14px text-t-primary'>{t('settings.network.host.enable')}</div>
          <div className='text-12px text-t-tertiary mt-2px'>
            {status.managed_by_cli
              ? t('settings.network.host.managedByCli')
              : status.enabled && status.listen_port
                ? t('settings.network.host.listening', { port: status.listen_port })
                : t('settings.network.host.disabledHint')}
          </div>
        </div>
        <Switch
          checked={status.enabled}
          loading={busy}
          disabled={status.managed_by_cli}
          onChange={(enabled) => void update({ enabled })}
        />
      </div>
      {status.last_error && <Alert type='error' content={status.last_error} className='mb-8px' />}
      <div className='flex flex-wrap items-end gap-12px py-8px'>
        <div className='flex-1 min-w-200px'>
          <div className='text-12px text-t-secondary mb-4px'>{t('settings.network.host.displayName')}</div>
          <Input value={displayName} maxLength={64} onChange={setDisplayName} />
        </div>
        <div className='w-140px'>
          <div className='text-12px text-t-secondary mb-4px'>{t('settings.network.host.port')}</div>
          <InputNumber
            value={port}
            min={1024}
            max={65535}
            placeholder={String(DEFAULT_PEER_PORT)}
            disabled={status.managed_by_cli}
            onChange={(value) => setPort(value === undefined || value === null ? undefined : Number(value))}
          />
        </div>
        <Button
          type='primary'
          disabled={!dirty || !displayName.trim()}
          loading={busy}
          onClick={() =>
            void update({
              display_name: displayName.trim(),
              ...(port !== undefined && port !== status.listen_port ? { listen_port: port } : {}),
            })
          }
        >
          {t('common.save')}
        </Button>
      </div>
      <div className='text-12px text-t-tertiary py-8px break-all'>
        {t('settings.network.host.fingerprint')}: <span className='font-mono'>{status.host_fingerprint}</span>
      </div>
    </NetworkCard>
  );
};

export default HostSection;
