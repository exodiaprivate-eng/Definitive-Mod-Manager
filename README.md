# Definitive Mod Manager

The modern mod manager for **Crimson Desert**. Standalone single executable, zero dependencies.

Built with Tauri (Rust backend) + React + Tailwind CSS.

## Download

Grab the latest release from the [Releases](https://github.com/exodiaprivate-eng/Definitive-Mod-Manager/releases) page — or from [Nexus Mods](https://www.nexusmods.com/crimsondesert). No installer required, just download and run.

Join the [Discord](https://discord.gg/DseMSN9TQc) for support and updates.

## Supported Mod Formats

| Format | Description |
|--------|-------------|
| **JSON byte-patch** (.json) | Hex patches at specific offsets in .pabgb game files — with automatic pattern scan fallback when game updates shift offsets |
| **File replacement** (manifest.json + files/) | Full file overrides (CSS, HTML, XML, WEM, DDS) organized by PAZ group. Compatible with Crimson Browser / CDUMM format |
| **Standalone overlay** (0036/) | Pre-built overlay PAZ/PAMT archives — mounted directly with automatic PAPGT CRC computation |
| **PAZ group replacement** | Replaces entire vanilla PAZ groups (e.g. language mods replacing group 0020) with automatic backup and restore |
| **Loose folder** | Numbered group directories (0000–0036) with game files inside — auto-detected, no manifest needed |
| **DDS textures** | Folder-based texture replacements registered in the game's PATHC index |
| **Audio mods** (.wem) | Wwise audio file replacement through the overlay pipeline |
| **Font mods** (.ttf / .otf) | Per-language font replacement via the Language & Fonts section |
| **ASI / DLL plugins** | Native code mods loaded by ASI Loader, with auto-install and custom folder support |
| **ReShade presets** | Post-processing shader management with preset switching |

## How It Works

Crimson Desert stores game data in **PAZ archives**, indexed by **PAMT** files, with a root hash table in **PAPGT**. This manager reverse-engineered the full archive format:

1. **Extract** — Reads clean game data from base PAZ archives (LZ4 decompressed)
2. **Patch** — Applies mod changes (byte patches, file replacements, textures, fonts, audio)
3. **Overlay** — Builds a new PAZ + PAMT in the `0036/` overlay directory
4. **Register** — Updates PAPGT with correct integrity hashes (Bob Jenkins hashlittle, seed `0xC5EDE`)

The game loads the overlay on top of vanilla data. Unmounting restores the clean PAPGT backup — the game ignores `0036/` when it's not referenced.

## Key Features

### Pattern Scan Engine
When a game update shifts byte offsets, DMM automatically scans for the original byte patterns and patches at the new location. Mods survive game updates without needing author updates. Short patterns (2+ bytes) use a windowed proximity scan to avoid false matches.

### Nuclear Unmount
Compares your game directory against a vanilla manifest and removes ALL non-vanilla files on unmount. ASI files are moved to staging instead of deleted. Guarantees a clean restore every time.

### Game Update Detection
Computes a SHA256 hash of PAPGT on startup. When the game updates, DMM detects the change automatically and refreshes all backups and caches. No more stale CRC mismatches.

### Mod Management
- Enable, disable, and reorder mods with drag-and-drop load ordering
- Per-patch toggles — enable or disable individual changes within a mod
- Preset picker — mods with bracket-labeled variants show radio buttons
- Merged mod cards — texture and file mods from the same folder display as one card
- Enable All / Disable All covers all mod types
- Mount status badges showing which mods are currently active
- Auto-refresh detects new mods and version changes every few seconds

### Mounting
- One-click mount/unmount with automatic vanilla backup
- Multi-file PAZ overlay engine — patches ANY .pabgb game file
- Pre-flight validation checks game files, offsets, and conflicts before mounting
- Interrupted mount recovery — detects and fixes broken state
- PAPGT validation — detects tainted game files from other tools with one-click Restore Vanilla

### Conflict Detection
- Warns when multiple mods patch the same byte offset or replace the same file
- Cross-format detection — works across JSON patches, file replacements, textures, and ASI mods
- Compatibility matrix showing pairwise mod compatibility in a visual grid

### Profiles & Sharing
- Mod profiles — save and load named mod configurations for instant switching
- Mod Packs — bundle multiple mods into shareable .dmpack files
- Community Profiles — export and import lightweight .dmprofile mod checklists

### Language & Fonts
- Dedicated section for translation and localization patches
- Dedicated `_language/` folder for folder-based language mods (PAZ group replacements)
- JSON language mods in `_lang/` folder
- Per-language game font replacement (.ttf) with LZ4 compression and full checksum chain

### ASI Mods
- ASI / DLL mod management with ASI Loader auto-install
- Custom ASI folder selection — use any folder instead of bin64
- Auto-pickup of ASI files from the mods folder and subdirectories
- Drag-and-drop for .asi and .dll files

### Import
- Drag-and-drop import for .json, .zip, .asi, .dll, and folder mods
- Language mod import supports files, folders, and ZIP archives
- Export/import mod lists with SHA-256 hash verification

### UI
- Dark theme with custom frameless window and accent glow
- Real-time activity log with timestamped, color-coded entries
- Auto-detection of Steam game directory across all drives
- Launch game directly from the manager

## Getting Started

1. Download `definitive-mod-manager.exe` from [Releases](https://github.com/exodiaprivate-eng/Definitive-Mod-Manager/releases)
2. Place it in its own folder (not inside the game directory) and run it
3. The app auto-detects your Crimson Desert Steam installation
4. Drop mod files into the mods folder (or drag them onto the app window)
5. Enable the mods you want and click **Mount Mods**

## Installing Mods

### JSON Mods
Drop `.json` mod files into the mods folder. They appear in the Mod Library automatically.

### File Replacement Mods
Drop the mod folder (containing `manifest.json` + `files/`, or numbered group directories) into the mods folder. It appears under "Texture, Archive & File Mods" in the library.

### Language Mods
Place folder-based language mods (with numbered group directories like `0020/`) into `mods/_language/`. JSON language mods go into `mods/_lang/`.

### ASI / DLL Mods
Drag `.asi` or `.dll` files onto the app window, or place them in the mods folder. DMM auto-detects and installs them to the game's bin64 directory (or your custom ASI folder).

### ZIP Archives
Drag a `.zip` file onto the app window. It extracts contents into the mods folder.

## Building from Source

Requires [Rust](https://rustup.rs/), [Node.js](https://nodejs.org/), and the [Tauri CLI](https://tauri.app/).

```bash
npm install
npx tauri build
```

The compiled exe is at `src-tauri/target/release/definitive-mod-manager.exe`.

## License

MIT
