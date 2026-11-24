# Half Dome

Tracking fork of [ardia-browser/ardia](https://github.com/ardia-browser/ardia).

Ardia carries Chromium, the sidebar browser, and security releases.
Half Dome carries branding and experiments. New ideas land here first;
when they belong upstream, open a PR against Ardia.

## Remotes

| Remote | Repo |
| --- | --- |
| `origin` | `abed42/half-dome` |
| `upstream` | `ardia-browser/ardia` |

Branch `halfdome` is our line of work. It merges Ardia **release tags**, not every commit on `main`.

## Sync

When Ardia ships a release:

```bash
halfdome/scripts/sync-ardia.sh v0.2.48
```

That fetches `upstream`, creates `sync/ardia-<tag>` from `halfdome`, merges the tag (a merge commit, not a rebase), and leaves conflicts for you to fix. Push the sync branch and open a PR into `halfdome`.

GitHub Action `.github/workflows/sync-ardia.yml` does the same on a 6-hour schedule and on dispatch: it skips when `halfdome` already contains the tag or when `sync/ardia-<tag>` already holds it, pushes with the `SYNC_TOKEN` secret, and opens the PR into `halfdome`.

Keep Half Dome changes under `halfdome/` when you can. Touch Ardia paths only for identity (name, icon, bundle id) or a feature that cannot live as an overlay.

## One-time setup

These are repo settings the workflow cannot change:

1. Make `halfdome` the default branch. Scheduled and `workflow_dispatch` runs load the workflow file from the default branch only; with `main` as default, `sync-ardia.yml` never fires.
2. Create a fine-grained personal access token with Contents and Pull requests read/write plus the `workflows` permission, and store it as the repository secret `SYNC_TOKEN`. `GITHUB_TOKEN` cannot push commits that change files under `.github/workflows/`, and every Ardia release does.
3. Disable these inherited Ardia workflows in the fork (Actions → each workflow → Disable), so Half Dome does not publish as Ardia, deploy ardia.dev, or enforce Ardia’s contributor gates:
   - `release.yml` — cuts Ardia-signed Mac/Linux/Windows releases
   - `deploy.yml` — deploys ardia.dev
   - `stale.yml` — Ardia’s outside-PR stale closer
   - `vouch-check-pr.yml` / `vouch-manage.yml` — Ardia’s vouch gate
   - `cla.yml` — Ardia’s CLA check
   - `linked-issue.yml` — Ardia’s linked-issue requirement

## Identity

| | Ardia | Half Dome |
| --- | --- | --- |
| Display name | Ardia | Half Dome |
| Bundle id | `com.ardia.browser` | `app.halfdome.browser` |
| App product | `Ardia.app` | `HalfDome.app` |
| Dev data dir | `~/Library/Application Support/Ardia Dev` | `~/Library/Application Support/Half Dome Dev` |
| Release data | bundle-id folder | `app.halfdome.browser` (separate from Ardia) |

Icon sources: `halfdome/branding/`.

## Layout

Half Dome defaults to Arc’s layout: vertical tabs and the address bar on the **left** (sidebar), so the page runs to the top of the window.

| Control | Where |
| --- | --- |
| Settings › Appearance › Address bar | Picture cards: **Top** or **Left** |
| View › Address Bar on Left | Menu toggle (checked when the URL is in the sidebar) |
| Sidebar › Browser Layout | Address Bar on Top / Address Bar on Left |

Needs vertical tabs (`tabLayout: sidebar`). With tabs across the top, the address bar stays in the toolbar.

## Servers

Half Dome has no servers of its own yet. Every outbound service URL is empty by
default, and each feature stays off until its URL is set:

| Service | Where | Empty means |
| --- | --- | --- |
| Telemetry / daily ping | `apps/browser/src/lib/endpoints.ts` → `LOGS_URL` | No posts; New Tab “Help fix Half Dome?” card stays hidden |
| Feedback / Report a Problem | same file → `FEEDBACK_URL` | Send fails locally; no network |
| Kill switches | same file → `SWITCHES_URL` | `refreshSwitches` skips the fetch |
| Source / releases / issue page | same file → `SOURCE_URL` (default `https://github.com/abed42/half-dome`); Mac plist `ACRepositoryURL` | Source, releases and GitHub issue links stay off; never falls back to ardia-browser |
| Sparkle update feed + Ed key | `apps/browser/macos/Ardia-macOS/Info.plist` (`SUFeedURL`, `SUPublicEDKey`) | Removed; Updates says “Updates aren't set up for this build” |
| Release notes menu | same plist → `ACReleaseNotesURL` | Release Notes menu item hidden |
| Feedback issues link | same plist → `ACFeedbackURL` | Empty (Linux Report a Problem uses `SOURCE_URL` instead) |

Background instances no longer fall back to Ardia's GitHub appcast
(`packages/shell/ios/AppUpdater.swift`).

To turn a service on later: put an `https://` URL in `endpoints.ts` (and for
updates, restore `SUFeedURL` + `SUPublicEDKey` for Half Dome's own feed and key).
Do not point any of them at `ardia.dev` or `ardia-browser` hosts.

## Build

Same as Ardia. Prebuilt engine download works until you change `engine/`.

```bash
pnpm install
pnpm pods
pnpm dev
pnpm macos
```

Debug launches as Half Dome with its own data dir. Your installed Ardia profile is untouched.
