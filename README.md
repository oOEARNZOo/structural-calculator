# Structural Calculator

A static beam reaction calculator for practicing HTML, CSS, and JavaScript. The current UI is redesigned as a compact engineering workspace instead of a generic calculator page.

## Features

- Calculates Reaction A and Reaction B immediately as valid inputs change
- Lets the user choose Pin, Roller, or Fixed support symbols for A and B
- Supports Point Load, Uniform Distributed Load, and Triangular Load
- Renders a free-body diagram with SVG
- Validates input before calculation
- Shows total load and resultant load location
- Draggable point load, with arrow-key, Home/End and Shift-key controls
- Touch-friendly position slider on mobile; the whole beam stays visible
- Four examples: centre load, near support A, uniform and triangular load
- Expandable calculation steps with the current values substituted into equations
- Field-level validation and screen-reader announcements
- Saves a valid setup locally and restores it on the next visit
- Exports a standalone SVG with resolved colours and typography
- Plain HTML/CSS/JavaScript with no framework; Vite is used as the dev server

## Project Structure

```text
structural-calculator/
|-- index.html
|-- style.css
|-- solver.js            # pure validation and analysis
|-- type.js              # UI state, SVG rendering, save/export
|-- favicon.svg
|-- package.json         # Vite dev server and test scripts
|-- scripts/preview.cjs  # optional zero-dependency static server
|-- tests/solver.test.cjs
|-- DESIGN.md
`-- README.md
```

## How To Run

Requires Node.js. Install dependencies once, then start the Vite dev server:

```text
npm install
npm run dev
```

Then open `http://localhost:5173`. On Windows PowerShell, use `npm.cmd` if script execution is restricted.

Other options:

- Open `index.html` directly in a browser (local storage may be unavailable for `file://` pages, depending on browser settings).
- `node scripts/preview.cjs` serves the project at `http://127.0.0.1:4173` without installing anything.

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm test` | Run the solver tests |
| `npm run build` / `npm run preview` | See the note below |

**Build note:** `solver.js` and `type.js` are loaded as classic `<script defer>` files, not ES modules, so `npm run build` does not bundle them into `dist`. Convert them to modules before deploying a Vite build.

## Interaction

Edit the beam and load fields to update the analysis. On desktop, drag the round handle on the point-load arrow. Focus it and use arrow keys for 1% beam-length increments, Shift + arrow keys for 10%, or Home/End for the supports. Movement is rounded to 0.01 m and clamped to the beam. Mobile uses a native range slider alongside the precise position field.

Save setup stores only beam parameters in this browser's local storage. Reset setup restores defaults and clears the saved setup. Storage availability depends on browser settings, especially when opening files directly. Invalid inputs or unsupported support pairs hide reactions and disable saving/export, while valid loads can still be previewed with unsupported supports.

## Code and verification

`solver.js` contains pure validation and analysis functions. `type.js` handles interface state, persistence, export and SVG rendering. The runtime code has no dependencies; Vite is a development-only tool.

```text
npm test
```

Tests cover endpoint and asymmetric point loads, full uniform loads, partial triangular loads, force/moment equilibrium, reversed support order, invalid inputs and numerical overflow. UI checks were run in Chromium-based Edge at desktop, tablet and mobile sizes, including dragging, keyboard movement, save/restore and standalone SVG export.

## Core Equations

```text
Sum Fy = 0
RA + RB = Total Load

Sum MA = 0
RB * L = Resultant Load * x_bar
```

## Current Load Cases

- Point Load: a single concentrated load at a distance from support A
- Uniform Distributed Load: load distributed across the full beam length
- Triangular Load: linearly varying load over a selected span

## Support Behavior

The diagram can display Pin, Roller, and Fixed supports. The current reaction solver calculates only statically determinate pin + roller support pairs. If a Fixed support is selected, the diagram updates, but calculation is disabled because fixed-end reactions require moment and stiffness/compatibility analysis.

## Notes

This project is intended for front-end and structural-analysis practice only. It should not be used as a replacement for verified structural engineering software in real design work.
