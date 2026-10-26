import { Button, Empty } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '@/renderer/services/i18n/format';
import { NetworkCard, RequestStateTag } from './NetworkCard';
import type { InboundRequest } from './networkApi';

/**
 * Requests peers sent to this host. Each runs in a normal conversation here,
 * where the owner approves tools and answers questions.
 */
const InboundSection: React.FC<{ inbound: InboundRequest[] }> = ({ inbound }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  return (
    <NetworkCard title={t('settings.network.inbound.title')}>
      <div className='text-12px text-t-tertiary mb-8px'>{t('settings.network.inbound.description')}</div>
      {inbound.length === 0 ? (
        <Empty description={t('settings.network.inbound.empty')} />
      ) : (
        <div className='flex flex-col'>
          {inbound.map((request) => (
            <div key={request.id} className='flex flex-wrap items-center gap-8px py-12px border-t border-line'>
              <RequestStateTag state={request.state} waiting={request.waiting_kind} />
              <span className='text-13px text-t-primary min-w-0 truncate'>
                {request.share_label} · {request.peer_display_name}
              </span>
              {request.error_code && (
                <span className='text-12px text-danger'>
                  {t(`settings.network.errors.${request.error_code}`, { defaultValue: request.error_code })}
                </span>
              )}
              <span className='text-12px text-t-tertiary ml-auto'>
                {formatDateTime(request.created_at, i18n.language)}
              </span>
              {request.conversation_id && (
                <Button
                  size='mini'
                  type={request.state === 'waiting_for_owner' ? 'primary' : 'secondary'}
                  onClick={() => void navigate(`/conversation/${request.conversation_id}`)}
                >
                  {request.state === 'waiting_for_owner'
                    ? t('settings.network.inbound.review')
                    : t('settings.network.inbound.open')}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </NetworkCard>
  );
};

export default InboundSection;
