export const resetPasswordTemplate = (url: string) => ({
  subject: 'Reset your password',
  html: `
    <p>We received a request to reset your password.</p>
    <p><a href="${url}">Reset password</a></p>
    <p>This link expires in 1 hour. If you did not request it, ignore this message — your password will not change.</p>
  `,
});
