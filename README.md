# Avenli

A standard Next.js 16 App Router application with Supabase authentication, database, and scheduled reminders. Ready to import into Vercel.

## Features

Personal tasks, priorities, subtasks, recurring schedules, calendar, list and board views, measurable goals, focus sessions, progress overview, AI todo planning, in-app reminders, optional email reminders/digests, and JSON export. Dark mode is the default; the light/dark switch remembers your choice on this browser.

## Local development

Requires Node.js 22.13 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The local `.env` is already configured. For a fresh checkout, copy `.env.example` to `.env.local` and set the existing backend signing secret. Sign in or create an account through Supabase; no mock user or ChatGPT sign-in is used.

## Deploy to Vercel

1. Import the repository into Vercel. Select **Next.js**. Leave Root Directory blank for the `DevAdvancer/Avenli` repository. If importing a parent folder instead, set Root Directory to `Avenli`.
2. Use `npm run build` and the default Next.js output settings.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `AVENLI_BACKEND_SECRET` from `.env.example`. Copy the signing secret privately from the existing local `.env`; it must match Supabase Vault. For AI planning, also add `ANTHROPIC_API_KEY` and `ANTHROPIC_WORKSPACE_ID` as server-only Production environment variables in Vercel. Set the workspace ID to the ID of the Claude workspace that owns the key. Redeploy after adding them. Never prefix either secret with `NEXT_PUBLIC_`.
4. In Supabase **Authentication > URL Configuration**, keep Site URL `https://avenli.silverspaceinc.tech` as the default. Both production origins are supported: `https://avenli.silverspaceinc.tech` and `https://avenli.abhirupkumar.in`. Allow the exact `/auth/callback` and `/auth/callback?next=/auth/reset` URLs under each origin. Keep the same local callbacks under `http://127.0.0.1:5173`. These six redirects are configured in the hosted project.
5. Email/password authentication must be enabled. Keep email confirmation enabled and configure the Supabase Auth email sender for real users; built-in test sending has recipient/rate restrictions. Auth emails and task reminder emails are separate configurations.
6. Reminder and security email links default to `https://avenli.silverspaceinc.tech`. An optional Supabase Edge Function `AVENLI_APP_URL` can override the reminder destination with another HTTPS origin. Sign-up and password reset links use the origin where the user requested them, including the secondary domain or the allowed local origin. Sessions are separate across the two production domains, so users sign in on each domain they use.

No Vercel cron is required: the existing Supabase cron runs the reminder worker every minute.

AI planning is a full workspace section and uses Claude Haiku 4.5 from a server-side route. The chat turns a description into up to eight tasks, asks at most one question if a date or time is unclear, asks whether scheduled tasks need reminders, and then saves them through the existing workspace API without a manual add step. Unscheduled tasks are saved immediately without a reminder. A bare day such as "the 12th" means the current month; a bare time such as "at 9" means 09:00, while "in the evening" makes it 21:00. EST/EDT/Eastern means local `America/New_York` time, using the scheduled date's daylight-saving offset. It uses up to 12 recent task titles, areas, priorities, and reminder timing to adapt suggestions; no model training or new database table is needed. The 10-request daily per-user limit is a best-effort guard on each server instance, so set a Claude workspace spending limit to cap total API spend.

## Backend and security

Supabase project: `dpahxvrwkyihqukermji`.

Next.js verifies the Supabase user on every workspace API request, then signs a server-to-server request to `avenli-api`. The Edge Function filters every operation by that trusted owner. Tables have RLS enabled with direct client access revoked. Secrets stay in Supabase Vault and server environment variables. Email recipients come from the authenticated, confirmed account.

Applied database changes: `database/schema.sql`, `database/reminder-scheduling.sql`, then `database/fix-reminder-queue.sql`. Supabase scheduler checks returned HTTP 200 after the queue fix.

## Email status

Brevo SMTP authentication has passed over encrypted port 465. Supabase Auth uses the same custom sender: **Avenli <abhirupvizva@gmail.com>**, with 30 auth emails/hour and a 60-second minimum interval. Email confirmation stays enabled. At the owner's request, Brevo SMTP IP restrictions were disabled because hosted sending IPs varied.

The Settings connection check sends no message. The test email button sends only to the signed-in user. SMTP authentication is verified; the sender address is verified in Brevo; actual inbox delivery still needs account registration or the Settings test. No test email was sent during development.

## Verification

```sh
npm run typecheck
npm run build
node scripts/verify-backend.mjs
node scripts/verify-smtp.mjs
```

Backend verification uses disposable owners and needs network access. Remove its disposable profiles using the generated ignored `work/verification-owners.json` after testing; task and goal records are cleaned automatically. SMTP verification is separate and checks connectivity without sending mail.

The production build and TypeScript pass. Live backend checks cover persistence, ownership, export isolation, recurrence, input validation, and replay prevention. The new sign-in screens have been browser checked; inbox delivery of confirmation and recovery messages remains a final user acceptance check.

References: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Release checklist

- Vercel: Node.js 22, Next.js preset, five environment variables from `.env.example`; redeploy after changing variables.
- Add both `avenli.silverspaceinc.tech` and `avenli.abhirupkumar.in` to the same Vercel project's Production deployment in Vercel Domains, then apply the DNS records Vercel provides for each. Configure both to serve the app if users should stay on their chosen domain. This code checkout does not publish DNS or a deployment.
- Keep these six exact Supabase redirect URLs: `/auth/callback` and `/auth/callback?next=/auth/reset` under both production origins and `http://127.0.0.1:5173`.
- Test sign-up and confirmation, sign-out and sign-in, recovery, task persistence after refresh, and the Settings test email on the deployed domain.
- Reminder worker: deployed `avenli-api`, backed by Supabase cron, Vault credentials, and owner checks. No service-role key belongs in Vercel or the browser.
- JSON exports retrieve all owned records with pagination, including older notifications; the workspace shows the latest 100 notifications. A 50,000-record safeguard returns an explicit error instead of a partial export.
- `.env`, `.vercel`, `work`, and local tool state are ignored. Publish `.env.example` and `package-lock.json` with the source.

For a first account, use **Create an account**. Resend confirmation only applies to an existing, unconfirmed account; its generic response deliberately avoids revealing whether an address is registered.

## Dependency verification (2026-10-08)

Next.js and eslint-config-next are pinned to 16.4.0. The production dependency audit reports zero vulnerabilities after updating the lockfile. The full audit still reports a development-only `braces` advisory through the Next.js ESLint plugin's glob dependencies; npm offers no compatible fix (its suggested downgrade would replace the framework's lint configuration). This tooling dependency is not included in the production runtime. Recheck upstream before a later release.

Production build, TypeScript, lint, 12 live backend checks, SMTP authentication, and a 505-task pagination check passed. Disposable verification rows were removed.
