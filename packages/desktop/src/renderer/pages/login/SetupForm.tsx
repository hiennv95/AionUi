import { Alert, Button, Form, Input } from '@arco-design/web-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { submitSetup } from './setupApi';

type SetupValues = { username: string; password: string; confirm: string };

/**
 * First-run form shown instead of sign-in while the host has no owner account.
 * `onDone(true)` = account created and signed in; `onDone(false)` = someone
 * else finished setup first, so the caller should fall back to sign-in.
 */
const SetupForm: React.FC<{ onDone: (signedIn: boolean) => void }> = ({ onDone }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<SetupValues>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: SetupValues) => {
    setLoading(true);
    setError(null);
    const result = await submitSetup(values.username.trim(), values.password);
    setLoading(false);
    if (result.code === 'ok') {
      onDone(true);
      return;
    }
    if (result.code === 'alreadyDone') {
      onDone(false);
      return;
    }
    if (result.code === 'networkError') setError(t('login.errors.networkError'));
    else if (result.code === 'serverError') setError(t('login.errors.serverError'));
    else setError(result.message ?? t('login.setup.failed'));
  };

  return (
    <Form form={form} layout='vertical' onSubmit={handleSubmit} autoComplete='off'>
      <Alert type='info' content={t('login.setup.hint')} className='mb-16px' />
      <Form.Item
        label={t('login.username')}
        field='username'
        rules={[{ required: true, message: t('login.setup.usernameRequired') }]}
      >
        <Input placeholder={t('login.usernamePlaceholder')} autoComplete='username' autoFocus />
      </Form.Item>
      <Form.Item
        label={t('login.password')}
        field='password'
        rules={[{ required: true, minLength: 8, message: t('login.setup.passwordTooShort') }]}
      >
        <Input.Password placeholder={t('login.passwordPlaceholder')} autoComplete='new-password' />
      </Form.Item>
      <Form.Item
        label={t('login.setup.confirmPassword')}
        field='confirm'
        rules={[
          { required: true, message: t('login.setup.passwordMismatch') },
          {
            validator: (value: string | undefined, callback: (error?: string) => void) =>
              callback(value === form.getFieldValue('password') ? undefined : t('login.setup.passwordMismatch')),
          },
        ]}
      >
        <Input.Password autoComplete='new-password' />
      </Form.Item>
      {error && <Alert type='error' content={error} className='mb-16px' />}
      <Button type='primary' htmlType='submit' long loading={loading}>
        {loading ? t('login.setup.submitting') : t('login.setup.submit')}
      </Button>
    </Form>
  );
};

export default SetupForm;
