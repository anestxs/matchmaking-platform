import { type MailTemplate, renderEmail } from './layout';

export const verifyEmailTemplate = (url: string): MailTemplate => ({
  subject: 'Verify your email address',
  ...renderEmail({
    preheader: 'Confirm your email to finish setting up your account.',
    heading: 'Confirm your email',
    body: 'Confirm your email address to finish setting up your Matchmaking Platform account.',
    action: { label: 'Verify email', url },
    note: 'This link expires in 24 hours. If you did not create an account, you can ignore this email.',
  }),
});
