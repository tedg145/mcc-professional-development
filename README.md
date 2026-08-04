# AI Professional Development — McLennan Community College

Workshop materials for MCC staff and faculty.

**Live site:** https://tedg145.github.io/mcc-professional-development/

| Path | What it is |
|---|---|
| `/` | Landing page — the intro sequence, then the hub |
| `/presentations/` | Slide library, grouped into **Staff** and **Faculty** |
| `/workshop/` | Build Your Own Tools (three-hour workshop) |
| `/sandbox/` | The Sabine Crossing practice environment |

Everything runs in a browser. No install, no account, no build step.

---

## Adding a presentation

1. Put the PDF and the `.pptx` in `presentations/files/`, named the same
   (`my-deck.pdf`, `my-deck.pptx`).
2. Open `presentations/index.html` and add one entry to the `LIBRARY` array,
   inside whichever category it belongs to. Copy the shape of an existing entry.
   The `id` must match the filename without the extension.

The page has a **How to add a presentation** panel at the bottom with the same
instructions, including how to add a whole new category.

> When uploading through GitHub's web interface, wait for the file list to
> appear before clicking **Commit changes** — clicking early silently drops
> the upload.

## Skipping the intro in class

Bookmark `…/#hub` and the landing page goes straight to the menu. The intro is
still there on the plain URL, and the hub footer has a **Replay intro** link.

---

© 2026 Ted Gonzalez, JD/MBA. All rights reserved.
