export type MailTemplate = {
  subject: string;
  html: string;
  text: string;
};

type EmailContent = {
  preheader: string;
  heading: string;
  body: string;
  action: { label: string; url: string };
  note: string;
};

const COLORS = {
  background: '#0d0f17',
  surface: '#161926',
  border: '#2a2d45',
  foreground: '#e9eaf4',
  muted: '#9094a8',
  brand: '#8b7cf9',
  brandForeground: '#0d0f17',
} as const;

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const PRODUCT_NAME = 'Matchmaking Platform';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderEmail(
  content: EmailContent,
): Omit<MailTemplate, 'subject'> {
  const preheader = escapeHtml(content.preheader);
  const heading = escapeHtml(content.heading);
  const body = escapeHtml(content.body);
  const label = escapeHtml(content.action.label);
  const url = escapeHtml(content.action.url);
  const note = escapeHtml(content.note);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>${heading}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${COLORS.background};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.background}" style="background-color:${COLORS.background};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
            <tr>
              <td bgcolor="${COLORS.surface}" style="background-color:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:16px;padding:32px;font-family:${FONT_STACK};">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="40" height="40" align="center" valign="middle" bgcolor="${COLORS.background}" style="width:40px;height:40px;background-color:${COLORS.background};border:1px solid ${COLORS.border};border-radius:9px;font-family:${FONT_STACK};font-size:15px;font-weight:800;color:${COLORS.brand};">MP</td>
                  </tr>
                </table>

                <h1 style="margin:24px 0 0;font-size:24px;line-height:32px;font-weight:600;color:${COLORS.foreground};">${heading}</h1>
                <p style="margin:8px 0 0;font-size:14px;line-height:22px;color:${COLORS.muted};">${body}</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                  <tr>
                    <td align="center" bgcolor="${COLORS.brand}" style="background-color:${COLORS.brand};border-radius:12px;">
                      <a href="${url}" target="_blank" style="display:block;padding:13px 24px;font-family:${FONT_STACK};font-size:15px;font-weight:600;color:${COLORS.brandForeground};text-decoration:none;">${label}</a>
                    </td>
                  </tr>
                </table>

                <p style="margin:24px 0 0;font-size:13px;line-height:20px;color:${COLORS.muted};">${note}</p>

                <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${COLORS.border};font-size:12px;line-height:18px;color:${COLORS.muted};">
                  If the button does not work, copy this link into your browser:<br>
                  <a href="${url}" target="_blank" style="color:${COLORS.brand};word-break:break-all;">${url}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:20px;font-family:${FONT_STACK};font-size:12px;color:${COLORS.muted};">${PRODUCT_NAME}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    content.heading,
    '',
    content.body,
    '',
    `${content.action.label}: ${content.action.url}`,
    '',
    content.note,
    '',
    PRODUCT_NAME,
  ].join('\n');

  return { html, text };
}
