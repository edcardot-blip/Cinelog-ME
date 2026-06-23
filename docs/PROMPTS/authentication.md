# Prompt — Authentication (Google via Supabase)

> Paste into a fresh Claude Code session, then add your specific request at the bottom.

## Context
CINELOG is a single-file, vanilla HTML/CSS/JS app. All current work happens in **`index.html`** (the live app; `v2.html`/`v1.html` are an alias/archive — do not edit them).
Read **`CLAUDE.md`** first. The engine in `getRecs()` is PROTECTED and out of scope here.

## Goal
Refine **authentication** — **Google OAuth via Supabase**. Auth gates the per-user lists in
`user_movies` (`seen`, `favorite`/"Like", `watchlist`, `not_interested`/Hidden), which are
RLS-scoped to the signed-in user. UI surface:

- A **gold profile bubble** (the account affordance) — signed-out shows a sign-in entry; signed-in
  shows the user's avatar/initial in the gold bubble.
- Clean **signed-in / signed-out states** across the app (collection pages, action pills, etc.).

## The redirect-URL requirement (do not forget)
Supabase OAuth only redirects back to URLs registered under **Supabase → Auth → redirect URLs**.
The GitHub Pages URL **must** be in that list:
- App: `https://edcardot-blip.github.io/Cinelog-ME/`
- Redesign: `https://edcardot-blip.github.io/Cinelog-ME/v2.html`

If sign-in "does nothing" or bounces, the redirect URL is almost always the cause. If you add a new
deploy URL, note that the Supabase dashboard list must be updated (it's outside this repo — flag it
to the user; you can't change it from code).

## Security note
The baked **anon key** is safe to expose because **RLS is on**. Never commit the service-role key
or any pipeline secret (those are GitHub secrets). Don't widen RLS or expose user data.

## Never break
- **Visual identity:** black + gold only, Fraunces / Inter, CSS variables. The profile bubble is
  gold; no other bright color. **Premium animations** (200–250ms).
- The Supabase session flow and the per-user list handlers (`onSeenClick`, `onFavClick`, watchlist
  /hidden). After sign-in/out, **refresh the user lists** so collections and action pills reflect
  the right state.
- Don't gate the homepage wizard or browsing behind auth unless explicitly asked — the app should
  feel usable, then prompt to sign in to save.

## Reuse, don't reinvent
- The **one reusable modal system** for any sign-in prompt/sheet (direct child of `<body>`).
- Gold **stroke SVG icons** (viewBox `0 0 24 24`, `stroke="currentColor"`, ~1.7 width) for
  profile/sign-in/sign-out glyphs. No colored emoji / no multi-color Google "G" if it clashes with
  the gold identity (use a tasteful gold-accented treatment).

## Design constraints
- Mobile-first; **safe-area insets** (the profile bubble clears the notch). Tap targets ≥ 44px.
- Handle the OAuth round-trip gracefully on iOS Safari and the installed PWA (returning from the
  redirect should land back in-app with the session restored).

## Verify before deploying
1. Syntax-check **both** inline `<script>` blocks (`vm.compileFunction`) — zero errors.
2. Confirm the session/auth handlers and per-user list refresh still resolve; no engine ids changed.
3. Deploy to Pages and **test on a real iPhone** (Safari **and** the installed PWA): sign in, return
   from redirect, lists populate, sign out, states flip correctly.
4. **Do not change `index.html`** unless explicitly told.

---
**My specific request:**
