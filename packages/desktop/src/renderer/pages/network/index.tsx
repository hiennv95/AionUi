import { Alert, Spin } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingsPageWrapper from '@renderer/pages/settings/components/SettingsPageWrapper';
import HostSection from './HostSection';
import InboundSection from './InboundSection';
import { networkErrorText } from './networkApi';
import PeersSection from './PeersSection';
import RequestsSection from './RequestsSection';
import SharesSection from './SharesSection';
import { useNetworkData } from './useNetworkData';

/** Private-LAN collaboration (ADR-009): pairing, sharing agents, remote requests. */
const NetworkSettings: React.FC = () => {
  const { t } = useTranslation();
  const { status, peers, shares, requests, inbound, loadError, loaded, reload } = useNetworkData();

  return (
    <SettingsPageWrapper>
      <div className='flex flex-col gap-16px'>
        {!loaded && <Spin className='self-center' />}
        {loadError != null && <Alert type='error' content={networkErrorText(loadError, t)} />}
        {status && (
          <>
            <HostSection status={status} onChanged={reload} />
            <PeersSection peers={peers} lanEnabled={status.enabled} onChanged={reload} />
            <SharesSection shares={shares} peers={peers} onChanged={reload} />
            <RequestsSection peers={peers} requests={requests} onChanged={reload} />
            <InboundSection inbound={inbound} />
          </>
        )}
      </div>
    </SettingsPageWrapper>
  );
};

export default NetworkSettings;
