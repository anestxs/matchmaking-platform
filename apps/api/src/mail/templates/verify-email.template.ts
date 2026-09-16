export const verifyEmailTemplate = (url: string) => ({
  subject: 'Verify your email address',
  html: `
    <p>Confirm your email address to finish setting up your account.</p>
    <p><a href="${url}">Verify email</a></p>
    <p>This link expires in 24 hours. If you did not request it, ignore this message.</p>
  `,
});
