# Avenli account emails

The six authentication templates and seven security notification templates match the application's dark charcoal and sage palette. They are saved in the hosted Supabase project under Authentication → Emails.

Regenerate the HTML and subject manifest with `node supabase/templates/generate-auth-emails.mjs`. Paste the relevant HTML and subject into the matching Supabase editor and save it. Local edits do not automatically update hosted templates.

Keep `{{ .ConfirmationURL }}` intact: Supabase supplies the verification link and requested callback, preserving both local and production authentication. Reauthentication uses `{{ .Token }}`; email changes use `{{ .NewEmail }}`. Do not replace these with fixed URLs or real tokens. No remote image or font assets are required.

## Security notifications

Enable all seven project notification switches: password changed, email changed, phone changed, sign-in method linked/removed, and MFA method added/removed. Template customization alone does not enable sending.

Supabase sends these emails when the corresponding account event occurs. They are independent of the application's optional task reminders and daily plan preferences; no duplicate client-side security mail sender is needed. Phone, linked-provider, and MFA notifications are ready for those events, but do not themselves add phone login, social login, or MFA controls to the app.

Security templates use `{{ .SiteURL }}/login` for a regular sign-in link, never a confirmation token. The configured hosted site URL is `https://avenli.silverspaceinc.tech`; authentication confirmation links continue to honor their allowed local or production callbacks. Each security message explains the change and advises the user to reset their password and secure their email account if it is unfamiliar. Event-specific placeholders remain intact (`OldEmail`, `Email`, `OldPhone`, `Phone`, `Provider`, `FactorType`).

Verify hosted saves by reopening each template and comparing its source with its HTML file. Do not change a real user's password, phone, email, or MFA enrollment merely to generate a test notification. A saved template preview verifies configuration and rendering, not inbox delivery.
