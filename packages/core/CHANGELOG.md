# @coeiro-operator/core

## 2.0.0

### Major Changes

- 8f77506: Initial release of COEIRO Operator packages

  ### Features
  - **@coeiro-operator/common**: Common utilities and logger
  - **@coeiro-operator/core**: Core utilities and shared functionality
  - **@coeiro-operator/audio**: Audio synthesis and playback module
  - **@coeiro-operator/cli**: CLI tools (say-coeiroink, operator-manager, dictionary-register)
  - **@coeiro-operator/mcp**: MCP server for Claude Code integration
  - **@coeiro-operator/mcp-debug**: Debug tools for MCP development
  - **@coeiro-operator/term-bg**: Terminal background image controller for iTerm2

  ### Main Capabilities
  - COEIROINK voice synthesis integration
  - Terminal session operator management
  - Long text streaming support
  - Audio resampling (24kHz to 48kHz)
  - Parallel chunk generation for low latency
  - User dictionary support
  - iTerm2 background image support (macOS)

### Patch Changes

- Updated dependencies [8f77506]
  - @coeiro-operator/common@2.0.0
  - @coeiro-operator/term-bg@2.0.0
