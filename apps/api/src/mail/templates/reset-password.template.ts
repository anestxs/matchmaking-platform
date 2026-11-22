import { type MailTemplate, renderEmail } from './layout';

export const resetPasswordTemplate = (url: string): MailTemplate => ({
  subject: 'Reset your password',
  ...renderEmail({
    preheader: 'Use this link to choose a new password. It expires in 1 hour.',
    heading: 'Reset your password',
    body: 'We received a request to reset the password for your account. Use the button below to choose a new one.',
    action: { label: 'Set a new password', url },
    note: 'This link expires in 1 hour. If you did not request a reset, ignore this email and your password will stay the same.',
  }),
});
