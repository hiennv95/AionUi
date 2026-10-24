# AionX

Personal AI operating system built on AionUi + AionCore, kept in this fork of AionUi.
Upstream `iOfficeAI/AionUi` is pull-only.

| Path                                             | Contents                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| [docs/adr](docs/adr)                             | Architecture decisions (ADR-001 client platform, ADR-002 minimize Node.js) |
| [docs/migration-plan.md](docs/migration-plan.md) | Phases P0–P5: Electron → AionCore host + Svelte web + Flutter mobile       |
| [docs/evidence](docs/evidence)                   | Measured results per phase                                                 |
| [host/macos](host/macos)                         | launchd service for the AionCore host (`install.sh`, `uninstall.sh`)       |
| [contracts](contracts)                           | OpenAPI contract and live contract test against a pinned `aioncore`        |
