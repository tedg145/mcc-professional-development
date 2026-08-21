# AI Professional Development — McLennan Community College

Workshop materials for MCC staff and faculty.

**Live site:** https://tedg145.github.io/mcc-professional-development/

| Path | What it is |
|---|---|
| `/` | Landing page — the cinematic intro, then the mission-control hub |
| `/presentations/` | Slide library, grouped into **Staff** and **Faculty** |
| `/scenarios/` | Interactive missions where the technology fails on purpose |
| `/inspector/` | Metadata Inspector — read what a file is carrying, in the browser |
| `/workshop/` | Build Your Own Tools (three-hour workshop) |
| `/sandbox/` | The Sabine Crossing practice environment |
| `/assets/` | Shared JavaScript. No frameworks, no CDN, no build step. |

Everything runs in a browser. No install, no account, nothing to configure.

## The hub

The hub organizes the curriculum into four zones: **Learn**, **Practice**,
**Build**, and **Use**. Each activity carries audience, difficulty, format, and
estimated-time metadata. Visitors can search the entire catalog, filter it by
role (Faculty, Staff, Supervisor, or Builder), and resume their most recent
activity from browser-local storage.

The shared catalog lives in `assets/mcc-content.js`. Add a new activity there
and it automatically appears in the right hub zone and participates in search
and audience filtering. Four featured activity IDs are selected in the root
`index.html`; the complete catalog stays collapsed until requested.

## The activity shell

`assets/mcc-activity-shell.css` and `assets/mcc-activity-shell.js` provide the
shared MCC header, activity metadata, learning objectives, start/save controls,
related activities, and responsive behavior. Activity-specific objectives and
icons live with the shared catalog in `assets/mcc-content.js`. The individual
pages retain their own experiments, simulations, presentations, and teaching
content inside that common navigation system.

---

## The QR button

Every page has a QR button in the bottom-left corner, or **Shift + Q** from the
keyboard. It generates a code for whatever URL is in the address bar *including
the `#` fragment*, so you can push the exact deck, scenario or step you are on to
every phone in the room. **Project it** blows it up full screen for the back row.

The QR encoder is written out in `assets/mcc-qr.js` rather than loaded from a
CDN, so the button still works when campus wifi does not.

---

## Adding a presentation

1. Put the PDF and the `.pptx` in `presentations/files/`, named the same
   (`my-deck.pdf`, `my-deck.pptx`).
2. In `presentations/index.html`, add one entry to the `LIBRARY` array inside the
   right category. The `id` must match the filename without its extension.

The page carries its own **How to add a presentation** panel with the same
instructions plus how to add a whole new category.

## Adding a scenario

1. Create `scenarios/data/my-scenario.json`.
2. Add `"my-scenario"` to the list in `scenarios/data/index.json`.

That is the whole process — no engine, page or CSS changes. Step types are
`brief`, `choice`, `multi`, `sort`, `inspect`, `terminal` and `reveal`; artifacts
are `email`, `doc`, `chat`, `table` and `terminal`. The full format reference,
with worked examples, is in the **How to write a new scenario** panel on the
scenarios page itself, so the instructions travel with the site.

## Adding a hub activity

Add the activity to `assets/mcc-content.js`. To feature it on the landing page,
add its ID to `FEATURED_IDS` in the root `index.html`.

---

## Notes for teaching

**Skip the intro.** Bookmark `…/#hub` and the landing page goes straight to the
menu. The intro still plays on the plain URL, and the hub footer has a **Replay
intro** link.

**Deep links.** `…/presentations/#foundations` opens that deck.
`…/scenarios/#redaction-trap/3` opens that scenario at step 4. Combine either
with the QR button to put a whole room on the same screen.

**The inspector is genuinely local.** Files are read in the browser and never
uploaded. Worth disconnecting from wifi once in front of a class to prove it —
only the map tiles for GPS coordinates come from the network.

**Sample files** live in `inspector/samples/` and are built to carry deliberate
metadata: a photo with GPS and a camera serial number, a Word draft that has been
through three people with tracked changes still in it, a PDF with two saved
revisions, and a screenshot that is nearly empty as the counter-example.

---

## Two things that will bite you

**Wait for the file list before committing.** When you upload through GitHub's
web interface, the staged file has to finish appearing on screen before you click
**Commit changes**. Click early and the commit silently succeeds with nothing in
it.

**Give Pages 30–90 seconds, then hard-refresh.** Ctrl+Shift+R, or Cmd+Shift+R on
a Mac. Browsers cache these pages aggressively.

---

© 2026 Ted Gonzalez, JD/MBA. All rights reserved.
