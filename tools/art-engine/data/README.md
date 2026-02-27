# Data Directory

This directory contains your image layers organized by trait categories. The Art Engine uses a specific naming convention to control layer ordering (z-index), rarity weights, and conditional variations (edge cases).

## Structure

Organize your image layers in subdirectories, one for each trait category. Each folder and file can use special naming parameters to control behavior:

```
data/
  ├── Background__z10/
  │   ├── Blue__w5.png
  │   ├── Navy Blue__w10.png
  │   └── Orange__w10.png
  ├── Body__z20/
  │   ├── Green__w10.png
  │   ├── Grey__w10.png
  │   └── Robot__w5.png
  ├── Face__z40/
  │   ├── Old Face__w10.png
  │   ├── Old Face__z-15.png
  │   └── Robot Face__w20.png
  └── Prop__z50/
      ├── Backpack__w10.png
      └── edge-cases/
          └── Backpack__z-35__tClothing__vSanta.png
```

## Naming Conventions

### Folder Names (Layer Categories)

- **Basic**: `Background`, `Body`, `Face` - Simple folder names
- **With Z-Index**: `Background__z10`, `Body__z20` - Control layer rendering order
  - Use `__z{number}` to specify z-index (rendering depth)
  - Lower z-index values render behind higher ones
  - Example: `Background__z10` renders behind `Body__z20`

### File Names (Trait Variations)

- **Basic**: `Blue.png`, `Red.png` - Simple file names
- **With Weight**: `Blue__w5.png`, `Navy Blue__w10.png` - Control rarity
  - Use `__w{number}` to specify rarity weight
  - Higher weights = more likely to be selected
  - Example: `Navy Blue__w10` is twice as likely as `Blue__w5`
- **With Z-Index**: `Old Face__z-15.png` - Override layer z-index for specific files
  - Use `__z{number}` in filename to override folder z-index
  - Can be positive or negative
  - Example: `Old Face__z-15` renders at z-index -15 instead of the folder's z-index

### Edge Cases (Conditional Variations)

Edge cases allow you to create variations that appear only when specific conditions are met. Create an `edge-cases` folder inside any layer folder.

**Edge Case Parameters:**
- `__z{number}` - Z-index for the edge case
- `__t{TraitName}` - Trait name to match (e.g., `__tClothing`)
- `__v{Value}` - Trait value to match (e.g., `__vSanta`)

**Example**: `Backpack__z-35__tClothing__vSanta.png`
- This backpack variant appears when:
  - The `Clothing` trait has the value `Santa`
  - It renders at z-index -35

**Multiple Conditions**: You can combine multiple trait/value pairs:
- `Backpack__z20__tClothing__vSanta__tFace__vRobot.png` - Matches when Clothing=Santa AND Face=Robot

## Important Notes

- **Each subdirectory represents a trait category** (e.g., Background, Body, Face)
- **Image files within each subdirectory are the different variations** of that trait
- **Z-Index**: Controls rendering order (lower numbers render behind higher numbers)
- **Weight**: Controls rarity/probability of selection (higher numbers = more common)
- **Edge Cases**: Create conditional variations based on other trait combinations
- **Supported formats**: PNG, JPG, JPEG
- **Image dimensions**: Should be the same for best results
- **Layer order**: Automatically determined by z-index values, not folder order

## StreamVault workflow

1. Add your image layers to the appropriate subdirectories under `data/`.
2. Run `npm run start` from `tools/art-engine/` (Node 20+ required).
3. Generated images appear in `output/images/` (e.g. `1.png`, `2.png`, …).
4. In StreamVault, open **Publish to Arweave** for a track, choose **Full — Atomic Asset**, and use **Cover image** to upload one of the generated files. Your Art Engine cover will be stored on Arweave with the release.
