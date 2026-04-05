# Definitive Mod Manager

The definitive mod manager for **Crimson Desert**. Standalone single executable — zero dependencies, no installer, just download and run.

Built with Tauri (Rust) + React + Tailwind CSS.

[![Download](https://img.shields.io/github/v/release/exodiaprivate-eng/Definitive-Mod-Manager?label=Download&style=for-the-badge)](https://github.com/exodiaprivate-eng/Definitive-Mod-Manager/releases/latest)
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/wGV8SN2CS9)

## What It Does

DMM reverse-engineered Crimson Desert's full archive format (PAZ/PAMT/PAPGT) and builds game-compatible overlays that load on top of vanilla data. Mount your mods, play, unmount — your game files are always clean.

- **Every mod type supported** — JSON byte patches, file replacements, standalone overlays, DDS textures, fonts, audio, ASI/DLL plugins, ReShade presets
- **Cross-mod compatibility** — three-way merge engine combines changes from multiple mods targeting the same file
- **Survives game updates** — pattern scan engine and contextual scan relocate patches automatically when offsets shift
- **One-click mount/unmount** — always patches from a clean vanilla backup, nuclear unmount guarantees clean restore

## Core Engine

### PAZ Overlay System
Crimson Desert stores game data in PAZ archives indexed by PAMT files with a root hash table in PAPGT. DMM extracts clean data, applies mod changes, builds a new overlay in `0036/`, and registers it with correct integrity hashes (Bob Jenkins hashlittle, seed `0xC5EDE`). The game loads the overlay on top of vanilla. Unmounting restores the clean backup.

### Pattern Scan Engine
When a game update shifts byte offsets, DMM scans for the original byte patterns and patches at the new location. Short patterns (2+ bytes) use a windowed proximity scan to avoid false matches. Mods survive game updates without needing author updates.

### Contextual Pattern Scan
When a structural mod (save editor mod) changes a file's size, traditional pattern matching breaks. DMM grabs a ~50 byte context window from vanilla around each patch — including the item's name, neighboring fields, and surrounding structure — and searches for that fingerprint in the modified file. Even 1-byte patches land at the correct position.

### Three-Way Merge Engine
When multiple mods provide the same game file, DMM merges their changes using vanilla as the common ancestor:
- **Same-size mods** — byte-level three-way merge, non-overlapping changes from both mods are kept
- **Structural mods** (different file size) — used as the base, other patches applied via contextual scan with uniqueness verification
- **Conflicts** — resolved by load order, reported in the activity log

### DDS Texture Injection
The game's texture loader ignores overlay groups, so DDS textures are injected directly into base PAZ archives using the game's native split compression format (128-byte raw DDS header + LZ4 body). Full CRC chain maintained: PAPGT, PAMT header, PazInfo, and PAZ data.

## Supported Mod Formats

| Format | Description |
|--------|-------------|
| **JSON byte-patch** (.json) | Hex patches at specific offsets in .pabgb game files with automatic pattern scan fallback |
| **File replacement** (manifest.json + files/) | Full file overrides (CSS, HTML, XML, DDS, WEM) organized by PAZ group |
| **Manifest-free file replacement** (files/ only) | Same as above but auto-detected without needing a manifest |
| **Standalone overlay** (0036/) | Pre-built overlay PAZ/PAMT archives from save editors or mod tools |
| **PAZ group replacement** | Replaces entire vanilla PAZ groups (e.g. language mods replacing group 0020) |
| **Loose folder** | Numbered group directories (0000–0035) with game files inside |
| **DDS textures** | Texture replacements injected directly into base PAZ archives |
| **Mod bundles** | Subfolders with multiple JSON variants displayed as a collapsible card with radio selection |
| **Audio mods** (.wem) | Wwise audio file replacement through the overlay pipeline |
| **Font mods** (.ttf / .otf) | Per-language font replacement via the Language & Fonts section |
| **ASI / DLL plugins** | Native code mods loaded by ASI Loader with auto-install and custom folder support |
| **ReShade presets** | Post-processing shader management with preset switching |

## Features

### Mod Management
- Enable, disable, and reorder mods with drag-and-drop load ordering
- Per-patch toggles — enable or disable individual changes within a mod
- Preset picker — mods with bracket-labeled variants show radio buttons
- Merged mod cards — texture and file mods from the same folder display as one card
- Mod bundle folders — subfolders with JSON variants (x2, x5, x10) show as collapsible cards
- Auto-refresh detects new mods and version changes every few seconds

### Conflict Detection
- Warns when multiple mods patch the same byte offset or replace the same file
- Cross-format detection across JSON patches, file replacements, standalone overlays, and ASI mods
- Same-author conflict suppression — mods from the same author don't trigger warnings
- Standalone overlay PAMT parsing for accurate file-level conflict detection
- Compatibility matrix showing pairwise mod compatibility in a visual grid

### Safety
- One-click mount/unmount with automatic vanilla backup
- Pre-flight validation checks game files, offsets, and conflicts before mounting
- Nuclear unmount compares against vanilla manifest and removes ALL non-vanilla files
- Interrupted mount recovery — detects and fixes broken state
- PAPGT validation — detects tainted game files from other tools with one-click Restore Vanilla
- Game update detection — auto-refreshes backups and caches when the game updates

### Profiles & Sharing
- Mod profiles — save and load named mod configurations
- Mod Packs — bundle multiple mods into shareable .dmpack files
- Community Profiles — export and import lightweight .dmprofile mod checklists

### Language & Fonts
- Dedicated `_language/` folder for folder-based language mods (PAZ group replacements)
- JSON language mods in `_lang/` folder
- Per-language game font replacement with LZ4 compression and full checksum chain

### Import
- Drag-and-drop for .json, .zip, .asi, .dll, and folder mods
- Language mod import supports files, folders, and ZIP archives
- Export/import mod lists with SHA-256 hash verification

## Getting Started

1. Download `definitive-mod-manager.exe` from [Releases](https://github.com/exodiaprivate-eng/Definitive-Mod-Manager/releases/latest)
2. Place it in its own folder (not inside the game directory) and run it
3. The app auto-detects your Crimson Desert Steam installation
4. Drop mod files into the mods folder (or drag them onto the app window)
5. Enable the mods you want and click **Mount Mods**

## Installing Mods

| Mod Type | How to Install |
|----------|---------------|
| **JSON mods** | Drop `.json` files into the mods folder |
| **File replacement** | Drop the mod folder (with `manifest.json` + `files/`, or just `files/`) into the mods folder |
| **Standalone overlay** | Drop the mod folder (containing `0036/0.paz` + `0036/0.pamt`) into the mods folder |
| **Language mods** | Place folder-based mods in `mods/_language/`, JSON mods in `mods/_lang/` |
| **ASI / DLL** | Drag onto the app window or place in the mods folder |
| **ZIP archives** | Drag onto the app window — extracts automatically |
| **Mod bundles** | Drop the folder containing multiple `.json` variants into the mods folder |

## Building from Source

Requires [Rust](https://rustup.rs/), [Node.js](https://nodejs.org/), and the [Tauri CLI](https://tauri.app/).

```bash
npm install
npx tauri build
```

The compiled exe is at `src-tauri/target/release/definitive-mod-manager.exe`.

## Community

- [Discord](https://discord.gg/wGV8SN2CS9) — support, bug reports, mod sharing
- [GitHub Issues](https://github.com/exodiaprivate-eng/Definitive-Mod-Manager/issues) — bug reports and feature requests
- [Releases](https://github.com/exodiaprivate-eng/Definitive-Mod-Manager/releases) — download latest version

## License

MIT
