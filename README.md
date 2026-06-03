# Structural Calculator

A static beam reaction calculator for practicing HTML, CSS, and JavaScript. The current UI is redesigned as a compact engineering workspace instead of a generic calculator page.

## Features

- Calculates Reaction A and Reaction B for a simply supported beam
- Lets the user choose Pin, Roller, or Fixed support symbols for A and B
- Supports Point Load, Uniform Distributed Load, and Triangular Load
- Renders a free-body diagram with SVG
- Validates input before calculation
- Shows total load and resultant load location
- Runs as a static HTML/CSS/JavaScript project with no build step

## Project Structure

```text
structural-calculator/
|-- index.html
|-- style.css
|-- type.js
`-- README.md
```

## How To Run

Open `index.html` directly in a browser.

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
