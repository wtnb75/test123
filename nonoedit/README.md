# NonoEdit

NonoEdit is a monochrome nonogram stage editor built with Phaser and Vite.
You can create a puzzle, run logical analysis, export/import PBM text, and test play in the same app.

## Purpose

- Build monochrome nonogram stages quickly
- Check whether a puzzle is logically solvable
- Estimate difficulty by weighted logical techniques
- Share puzzle data through PBM text on clipboard

## Rules

- Puzzle is monochrome only (`1 = filled`, `0 = empty`)
- Row and column hints are generated from filled runs
- Test play clear condition: player `filled` cells must exactly match solution `filled` cells
- `unknown` and `marked` are ignored for clear check

## Controls

### Mouse

- Click cell in edit mode: toggle `empty` / `filled`
- Click cell in play mode: cycle `unknown` -> `filled` -> `marked`
- Toolbar buttons:
  - `Resize`: change width/height from UI prompt
  - `Import`: paste PBM text (`P1`)
  - `Copy PBM`: copy current puzzle with metadata comments
  - `Analyze`: run logical analysis
  - `Test Play` / `Back to Edit`: mode switch

### Keyboard

- `1-9`: size presets (`5,7,10,12,15,18,20,22,25`)
- `C`: copy PBM
- `D`: run analysis
- `T`: start test play
- `E`: back to edit mode
- `R`: clear board

## PBM Format

Export format: Netpbm `P1` text.

Metadata comments are always written:

- `# difficulty: <rank>`
- `# score: <value>`
- `# unique: <true|false>`

Import ignores all comment lines.

## Development

```bash
npm install
npm run dev
```

## Quality Checks

```bash
npm run lint
npm run test
npm run test:coverage
npm run build
```
