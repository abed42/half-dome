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

Branch `halfdome` is our line of work. It rebases onto Ardia **release tags**, not every commit on `main`.

## Sync

When Ardia ships a release:

```bash
halfdome/scripts/sync-ardia.sh v0.2.48
```

That fetches `upstream`, rebases `halfdome` onto the tag, and leaves conflicts for you to fix.
GitHub Action `.github/workflows/sync-ardia.yml` opens a sync PR when Ardia publishes a non-nightly release.

Keep Half Dome changes under `halfdome/` when you can. Touch Ardia paths only for identity (name, icon, bundle id) or a feature that cannot live as an overlay.

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
| Sparkle update feed + Ed key | `apps/browser/macos/Ardia-macOS/Info.plist` (`SUFeedURL`, `SUPublicEDKey`) | Removed; Updates says “Updates aren't set up for this build” |
| Release notes menu | same plist → `ACReleaseNotesURL` | Release Notes menu item hidden |
| Feedback issues link | same plist → `ACFeedbackURL` | Empty (no Ardia issues link) |

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
