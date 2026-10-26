import { Button, DatePicker, Empty, Form, Input, Message, Popconfirm, Select, Tag } from '@arco-design/web-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Dayjs } from 'dayjs';
import { formatDateTime } from '@/renderer/services/i18n/format';
import { NetworkCard } from './NetworkCard';
import { networkApi, networkErrorText, type Peer, type Share } from './networkApi';

/** Agent backends RC1 can share; the host picks the safe mode for each. */
export const SHAREABLE_BACKENDS = ['codex', 'claude'] as const;

type ShareFormValues = {
  peer_id: string;
  label: string;
  backend: string;
  workspace?: string;
  expires_at?: number;
};

/** Agents this host shares with paired peers: create and unshare. */
const SharesSection: React.FC<{ shares: Share[]; peers: Peer[]; onChanged: () => Promise<void> }> = ({
  shares,
  peers,
  onChanged,
}) => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm<ShareFormValues>();
  const [busy, setBusy] = useState<string | null>(null);
  const trusted = peers.filter((peer) => peer.state === 'trusted');
  const active = shares.filter((share) => !share.revoked_at);

  const create = async (values: ShareFormValues) => {
    setBusy('create');
    try {
      await networkApi.createShare({
        peer_id: values.peer_id,
        label: values.label.trim(),
        backend: values.backend,
        workspace: values.workspace?.trim() || undefined,
        expires_at: values.expires_at,
      });
      Message.success(t('settings.network.shares.created'));
      form.resetFields();
      await onChanged();
    } catch (error) {
      Message.error(networkErrorText(error, t));
    } finally {
      setBusy(null);
    }
  };

  const unshare = async (shareId: string) => {
    setBusy(shareId);
    try {
      await networkApi.unshare(shareId);
      await onChanged();
    } catch (error) {
      Message.error(networkErrorText(error, t));
    } finally {
      setBusy(null);
    }
  };

  return (
    <NetworkCard title={t('settings.network.shares.title')}>
      <div className='text-12px text-t-tertiary mb-8px'>{t('settings.network.shares.description')}</div>
      {trusted.length === 0 ? (
        <div className='text-12px text-t-secondary py-8px'>{t('settings.network.shares.needTrustedPeer')}</div>
      ) : (
        <Form form={form} layout='vertical' onSubmit={create} initialValues={{ backend: 'codex' }} className='py-8px'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-x-12px'>
            <Form.Item label={t('settings.network.shares.peer')} field='peer_id' rules={[{ required: true }]}>
              <Select
                placeholder={t('settings.network.shares.peerPlaceholder')}
                options={trusted.map((peer) => ({ label: peer.display_name, value: peer.id }))}
              />
            </Form.Item>
            <Form.Item label={t('settings.network.shares.backend')} field='backend' rules={[{ required: true }]}>
              <Select options={SHAREABLE_BACKENDS.map((backend) => ({ label: backend, value: backend }))} />
            </Form.Item>
            <Form.Item label={t('settings.network.shares.label')} field='label' rules={[{ required: true }]}>
              <Input maxLength={64} placeholder={t('settings.network.shares.labelPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('settings.network.shares.workspace')} field='workspace'>
              <Input placeholder={t('settings.network.shares.workspacePlaceholder')} />
            </Form.Item>
            <Form.Item
              label={t('settings.network.shares.expiresAt')}
              field='expires_at'
              getValueFromEvent={(_text: string, date?: Dayjs) => date?.valueOf()}
            >
              <DatePicker showTime className='w-full' disabledDate={(date) => date.isBefore(Date.now(), 'day')} />
            </Form.Item>
          </div>
          <div className='text-12px text-t-tertiary mb-8px'>{t('settings.network.shares.modeHint')}</div>
          <Button type='primary' htmlType='submit' loading={busy === 'create'}>
            {t('settings.network.shares.create')}
          </Button>
        </Form>
      )}

      {active.length === 0 ? (
        <Empty description={t('settings.network.shares.empty')} />
      ) : (
        <div className='flex flex-col'>
          {active.map((share) => (
            <div key={share.id} className='flex flex-wrap items-center gap-12px py-12px border-t border-line'>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-8px'>
                  <span className='text-14px text-t-primary truncate'>{share.label}</span>
                  <Tag size='small'>{share.backend}</Tag>
                  <Tag size='small' color='green'>
                    {share.mode}
                  </Tag>
                </div>
                <div className='text-12px text-t-tertiary mt-2px truncate'>
                  {t('settings.network.shares.sharedWith', { peer: share.peer_display_name })}
                  {share.expires_at
                    ? ` · ${t('settings.network.shares.expires', { time: formatDateTime(share.expires_at, i18n.language) })}`
                    : ''}
                </div>
                <div className='text-12px text-t-tertiary font-mono truncate'>{share.workspace}</div>
              </div>
              <Popconfirm title={t('settings.network.shares.unshareConfirm')} onOk={() => unshare(share.id)}>
                <Button size='small' status='danger' loading={busy === share.id}>
                  {t('settings.network.shares.unshare')}
                </Button>
              </Popconfirm>
            </div>
          ))}
        </div>
      )}
    </NetworkCard>
  );
};

export default SharesSection;
