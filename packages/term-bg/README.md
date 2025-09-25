# @coeiro-operator/term-bg

Terminal background image controller for iTerm2.

## Features

- Set background images in iTerm2 programmatically
- Control opacity and display mode
- Python environment auto-setup with uv

## Installation

```bash
npm install @coeiro-operator/term-bg
```

The postinstall script will automatically:
1. Check for `uv` installation
2. Create a Python virtual environment
3. Install required dependencies (iterm2)

## Usage

```typescript
import { TerminalBackground } from '@coeiro-operator/term-bg';

const termBg = new TerminalBackground();

// Check if running in iTerm2
if (termBg.isITerm2()) {
  // Set background image
  await termBg.setBackground({
    imagePath: '/path/to/image.png',
    opacity: 0.3,  // 30% opacity
    mode: 'stretch'  // or 'tile', 'fit', 'fill'
  });

  // Clear background
  await termBg.clearBackground();
}
```

## Requirements

- Node.js >= 18
- iTerm2 with Python API enabled
- uv (for Python environment management)

## iTerm2 Setup

1. Open iTerm2 Preferences
2. Go to General > Magic
3. Enable "Enable Python API"
4. Restart iTerm2

## Development

```bash
# Build TypeScript
npm run build

# Setup Python environment manually
node scripts/setup-python-env.js
```