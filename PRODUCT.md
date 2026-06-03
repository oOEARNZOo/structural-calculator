# Product

## Register

product

## Users

This tool serves three overlapping user groups:

- The project owner, who is practicing HTML, CSS, and JavaScript while learning how to make a technical interface feel credible.
- Civil or structural engineering students who want a simple visual way to understand support reactions, load cases, and equilibrium.
- Portfolio viewers who need to quickly understand that the project combines front-end craft with engineering-domain logic.

Users are likely working in a learning or review context, not a production design workflow. They need the interface to be direct, legible, and trustworthy enough to support practice and explanation.

## Product Purpose

Structural Calculator is a static web tool for calculating support reactions on basic beam examples. It exists to help the owner practice front-end implementation while making structural-analysis concepts visible through forms, computed results, and SVG diagrams.

Success means a user can enter a beam length, choose support symbols, choose a load case, understand whether the current support pair is supported by the solver, and read the result without needing external instructions.

## Brand Personality

Technical, clear, disciplined.

The product should feel like a lightweight engineering workspace: focused, calm, and precise. It should not feel like a generic landing page, a playful educational toy, or a decorative template.

## Anti-references

- Do not make it look like a SaaS marketing homepage.
- Do not use oversized hero sections, decorative illustration, or repeated feature-card grids.
- Do not make the interface feel like a game or cartoon.
- Do not hide engineering limits. If the solver does not support fixed-end reactions, say that plainly.
- Do not use loud colors, heavy gradients, or visual effects that compete with the diagram and inputs.

## Design Principles

1. Make the engineering model visible.
   The beam diagram, support symbols, load arrows, and reaction values should explain the calculation, not decorate the page.

2. Keep the task path short.
   The main workflow is setup, load input, calculate, inspect result. Controls should stay close to the diagram and results.

3. Be honest about solver limits.
   Unsupported support combinations should still update the diagram, but calculation must be disabled with a clear reason.

4. Prefer earned familiarity.
   Use standard form controls, restrained colors, consistent spacing, and predictable layout so users trust the tool.

5. Support learning and portfolio review at the same time.
   The UI should be understandable to students and credible to someone reviewing the code or design as a front-end project.

## Accessibility & Inclusion

Target WCAG AA contrast for text and controls. Preserve keyboard-accessible native inputs and selects. Avoid motion that is not necessary for state feedback. Do not rely on color alone for validation or unsupported states; pair color with explicit messages.
