# CONNECT-K — Made easy.
Starter project: responsive HTML/CSS/JavaScript frontend + Supabase authentication and database foundation.

## Included
- Midnight emerald, ivory/champagne and signature crimson-red brand system.
- Responsive landing page.
- Email-only registration and login; username is the public identity.
- Email verification and password reset flows.
- Starter dashboard and logout.
- SQL foundation for profiles, connection requests, conversations, messages and communities.
- Auth email is stored by Supabase Auth, not in the public profile table.

## Setup
1. Open this folder in VS Code.
2. Create a Supabase project.
3. Run `supabase/schema.sql` in Supabase SQL Editor.
4. In Supabase Project Settings > API, copy Project URL and anon/publishable key into `js/supabase.js`.
5. Never put the service_role/secret key in frontend code.
6. In Supabase Authentication > URL Configuration, set Site URL and add local/deployed redirect URLs for `/dashboard.html` and `/reset-password.html`.
7. Keep email confirmation enabled.
8. Run with VS Code Live Server. Do not open HTML by double-clicking.

## Test
Create an account, verify email, log in, log out, then test Forgot password.

## Current scope
This is the first foundation milestone. The visual frontend and authentication flow are included. Profile picture uploads, post feed, connections, interactive messaging and communities are planned next and are not yet implemented. The SQL schema is a starting point, not a production security audit. Before public launch, strengthen conversation membership creation, connection acceptance, blocking/reporting, abuse prevention and moderation.
