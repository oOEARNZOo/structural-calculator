# Interface design

Structural Calculator is a restrained engineering workspace for learning and portfolio review. Preserve the teal identity and keep the model, values and solver limits visible.

## Composition

- Desktop: 312 px controls beside the diagram and reaction results. At intermediate desktop widths controls narrow to 280 px.
- At 800 px and below: diagram first, settings next, results last. Settings use two columns on tablets and one on phones.
- At 540 px and below: replace the diagram drag handle with a native position slider. The full beam stays visible.
- Calculation steps use a native details/summary disclosure and actual substituted values.

## Visual system

Colours are the OKLCH variables in style.css: teal for actions, orange for applied loads, blue for reactions, green for equilibrium and red for input issues. Text and labels carry state alongside colour.

Use the existing Segoe UI / Noto Sans Thai / system sans stack, fixed rem typography and tabular numerical figures. Surfaces have a single border and a 10 px corner radius. Keep the grid within the diagram. Spacing tokens use 4, 8, 16, 24 and 32 px; compact form sections use 20 px padding.

## Interaction and states

- Valid input updates diagrams and results immediately.
- Invalid fields have associated messages and aria-invalid; stale reactions are hidden.
- Unsupported support pairs show preview-only status and explain the limitation.
- Point loads support pointer capture, keyboard movement and a native mobile slider; number inputs provide precise entry.
- Focus is visible. Motion is limited to short control feedback and respects reduced-motion preferences.
- Result announcements are delayed by 500 ms so rapid editing does not repeatedly interrupt screen readers.
- Saving and exporting are available for valid solved models. Local storage failures show a message without disrupting analysis.
- Exported SVGs contain resolved presentation attributes and local fragment references, so they work outside the page.

The project uses plain HTML, CSS and JavaScript. Keep engineering validation and calculations in solver.js; UI and drawing belong in type.js.
