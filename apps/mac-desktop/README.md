# Fate AI macOS Desktop

This app is the native macOS shell for Fate AI.

First-stage responsibilities:

- SwiftUI chat UI.
- Project and workspace selection.
- User confirmation and permission UI.
- Local desktop settings.
- Bridge to the TypeScript agent runtime in `packages/agent-runtime`.

The app layer should not implement agent loop logic directly. Agent orchestration belongs in the runtime package.
