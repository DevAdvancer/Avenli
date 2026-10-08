import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('.', import.meta.url));
const definitions = [
  { slug: 'confirm-sign-up', subject: 'Welcome to Avenli — confirm your email', label: 'A FRESH START', title: 'Your space is almost ready.', text: 'A calmer home for your tasks, goals, and everyday progress. Confirm your email to make it yours.', action: 'Confirm my email', note: 'If you did not create an Avenli account, you can safely ignore this email.' },
  { slug: 'invite-user', subject: 'Your invitation to Avenli', label: 'MAKE A LITTLE SPACE', title: 'Make room for what matters.', text: 'You have been invited to Avenli, your personal space for plans, meaningful goals, and small steps forward.', action: 'Accept invitation', note: 'If you were not expecting this invitation, you can safely ignore this email.' },
  { slug: 'magic-link-or-otp', subject: 'Your Avenli sign-in link', label: 'WELCOME BACK', title: 'Pick up where you left off.', text: 'Use the button below to securely sign in to your personal space. This link is just for you.', action: 'Sign in to Avenli', note: 'If you did not request this email, you can safely ignore it. Do not share this link with anyone.' },
  { slug: 'change-email-address', subject: 'Confirm your email change — Avenli', label: 'YOUR ACCOUNT', title: 'A new address. Same space.', text: 'You requested to change the email address for your Avenli account to <strong style="color:#e4e9e3;word-break:break-word;">{{ .NewEmail }}</strong>. Confirm this change below.', action: 'Confirm email change', note: 'If you did not request this change, do not confirm it. Sign in to Avenli and review your account.' },
  { slug: 'reset-password', subject: 'Reset your Avenli password', label: 'LET’S GET YOU BACK IN', title: 'A fresh start for your password.', text: 'We received a request to reset your password. Choose a new one to get back to your plans.', action: 'Reset my password', note: 'If you did not request a reset, you can safely ignore this email. Your password will stay the same.' },
  { slug: 'reauthentication', subject: 'Your Avenli verification code', label: 'A QUICK CHECK', title: 'Let’s make sure it’s you.', text: 'Enter this verification code in Avenli to continue with your account change.', token: true, note: 'If you did not request this code, do not use it. Never share your verification code with anyone.' },
];

const securityDefinitions = [
  { slug: 'password-changed', subject: 'Your Avenli password was changed', title: 'Your password has changed.', text: 'The password for your Avenli account was recently changed.' },
  { slug: 'email-address-changed', subject: 'Your Avenli email address was changed', title: 'Your email address has changed.', text: 'The email address for your Avenli account was changed from <strong style="color:#e4e9e3;word-break:break-word;">{{ .OldEmail }}</strong> to <strong style="color:#e4e9e3;word-break:break-word;">{{ .Email }}</strong>.' },
  { slug: 'phone-number-changed', subject: 'Your Avenli phone number was changed', title: 'Your phone number has changed.', text: 'The phone number for your Avenli account was changed from <strong style="color:#e4e9e3;">{{ .OldPhone }}</strong> to <strong style="color:#e4e9e3;">{{ .Phone }}</strong>.' },
  { slug: 'sign-in-method-linked', subject: 'A sign-in method was added to your Avenli account', title: 'A new way to sign in.', text: 'A sign-in method (<strong style="color:#e4e9e3;">{{ .Provider }}</strong>) was linked to your Avenli account.' },
  { slug: 'sign-in-method-removed', subject: 'A sign-in method was removed from your Avenli account', title: 'A sign-in method was removed.', text: 'A sign-in method (<strong style="color:#e4e9e3;">{{ .Provider }}</strong>) was removed from your Avenli account.' },
  { slug: 'mfa-method-added', subject: 'Two-step verification was added to your Avenli account', title: 'An extra layer of protection.', text: 'A two-step verification method (<strong style="color:#e4e9e3;">{{ .FactorType }}</strong>) was added to your Avenli account.' },
  { slug: 'mfa-method-removed', subject: 'Two-step verification was removed from your Avenli account', title: 'A verification method was removed.', text: 'A two-step verification method (<strong style="color:#e4e9e3;">{{ .FactorType }}</strong>) was removed from your Avenli account.' },
].map(email => ({ ...email, security: true, label: 'ACCOUNT SECURITY', action: 'Open Avenli', note: 'Made this change? No further action is needed. If you do not recognize it, open Avenli directly, reset your password from the sign-in page, and secure your email account. Never share your password or verification codes.' }));

function render(email) {
  const actionUrl = email.security ? '{{ .SiteURL }}/login' : '{{ .ConfirmationURL }}';
  const action = email.token
    ? '<p style="margin:28px 0;padding:22px 12px;border:1px solid #303c33;border-radius:12px;background:#101613;color:#a6c58e;font-family:monospace;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;">{{ .Token }}</p>'
    : `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;"><tr><td bgcolor="#a6c58e" style="border-radius:10px;text-align:center;"><a href="${actionUrl}" style="display:inline-block;padding:16px 26px;border:1px solid #a6c58e;border-radius:10px;background:#a6c58e;color:#14200f;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;">${email.action}</a></td></tr></table>`;
  const fallback = email.token || email.security ? '' : '<p style="margin:24px 0 8px;color:#acb7a9;font-size:12px;line-height:20px;">Button not working? Copy this link into your browser:</p><p style="margin:0;font-size:12px;line-height:20px;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#a6c58e;text-decoration:underline;">{{ .ConfirmationURL }}</a></p>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${email.subject}</title></head>
<body bgcolor="#101613" style="margin:0;padding:0;background:#101613;color:#e4e9e3;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${email.title} ${email.token ? 'Your verification code is inside.' : email.action + ' to continue.'}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#101613"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 8px 28px;color:#e4e9e3;font-size:30px;font-weight:700;letter-spacing:-1px;">avenli<span style="color:#a6c58e;">.</span></td></tr>
<tr><td bgcolor="#19211c" style="padding:36px 28px;border:1px solid #303c33;border-radius:16px;background:#19211c;">
<p style="margin:0 0 18px;color:#a6c58e;font-size:11px;line-height:18px;font-weight:700;letter-spacing:2px;">${email.label}</p>
<h1 style="margin:0 0 18px;color:#e4e9e3;font-size:28px;line-height:36px;font-weight:600;letter-spacing:-0.6px;">${email.title}</h1>
<p style="margin:0;color:#acb7a9;font-size:15px;line-height:25px;">${email.text}</p>
${action}
<p style="margin:0;padding-top:22px;border-top:1px solid #303c33;color:#acb7a9;font-size:13px;line-height:22px;">${email.note}</p>
${fallback}
</td></tr>
<tr><td align="center" style="padding:26px 16px 8px;color:#acb7a9;font-size:12px;line-height:21px;">Small steps. Real progress.<br><span style="color:#a6c58e;">Avenli · Your personal space for progress</span></td></tr>
</table></td></tr></table></body></html>
`;
}

mkdirSync(directory, { recursive: true });
for (const email of [...definitions, ...securityDefinitions]) writeFileSync(`${directory}${email.slug}.html`, render(email), 'utf8');
writeFileSync(`${directory}subjects.json`, JSON.stringify(Object.fromEntries([...definitions, ...securityDefinitions].map(email => [email.slug, email.subject])), null, 2) + '\n');
