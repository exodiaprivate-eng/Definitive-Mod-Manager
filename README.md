# Definitive Mod Manager

The modern mod manager for **Crimson Desert**. Standalone single executable, zero dependencies, 15MB.

Built with Tauri (Rust backend) + React + Tailwind CSS.

## Download

Grab the latest release from the [Releases](https://github.com/exodiaprivate-eng/Definitive-Mod-Manager/releases) page. No installer required — just download and run.

## Supported Mod Formats

| Format | Description |
|--------|-------------|
| **JSON byte-patch** (.json) | The standard Crimson Desert modding format. Hex patches applied at specific byte offsets in .pabgb game files. |
| **File replacement** (manifest.json + files/) | Full file overrides organized by PAZ group number. Compatible with Crimson Browser mod format. |
| **Loose folder** | Drop a folder containing numbered group directories (0000–0036) with game files inside. Auto-detected, no manifest needed. |
| **DDS textures** | Folder-based texture replacements registered in the game's PATHC index. |
| **Font mods** (.ttf / .otf) | Per-language font replacement via the Language & Fonts section. |
| **ASI / DLL plugins** | Native code mods loaded by ASI Loader, with auto-install support. |
| **ReShade presets** | Post-processing shader management with preset switching. |

## How It Works

Crimson Desert stores game data in **PAZ archives**, indexed by **PAMT** files, with a root hash table in **PAPGT**. This manager reverse-engineered the full archive format:

1. **Extract** — Reads clean game data from base PAZ archives (LZ4 decompressed)
2. **Patch** — Applies mod changes (byte patches, file replacements, textures, fonts)
3. **Overlay** — Builds a new PAZ + PAMT in the `0036/` overlay directory
4. **Register** — Updates PAPGT with correct integrity hashes (Bob Jenkins hashlittle, seed `0xC5EDE`)

The game loads the overlay on top of vanilla data. Unmounting restores the clean PAPGT backup — the game ignores `0036/` when it's not referenced.

## Features

### Mod Management
- Enable, disable, and reorder mods with drag-and-drop load ordering
- Per-patch toggles — enable or disable individual changes within a mod
- Mount status badges showing which mods are currently active in-game
- Mod deletion directly from the mod list
- Auto-refresh detects new mods dropped into the folder every few seconds

### Mounting
- One-click mount/unmount with automatic vanilla backup
- Multi-file PAZ overlay engine — patches ANY .pabgb game file
- Pre-flight validation checks game files, offsets, and conflicts before mounting
- Detailed diagnostics with version mismatch and stale backup detection
- Interrupted mount recovery — detects and fixes broken state

### Conflict Detection
- Warns when multiple mods patch the same byte offset
- Cross-format detection — works across JSON patches, file replacements, and textures
- Compatibility matrix showing pairwise mod compatibility in a visual grid

### Profiles & Sharing
- Mod profiles — save and load named mod configurations for instant switching
- Mod Packs — bundle multiple mods into shareable .dmpack files with embedded data
- Community Profiles — export and import lightweight .dmprofile mod checklists

### Language & Fonts
- Dedicated section for translation and localization patches
- Per-language game font replacement (.ttf) with LZ4 compression and full checksum chain

### Integrations
- Nexus Mods update checker — checks installed mods for available updates via API
- Nexus mod ID search with local result caching
- ASI / DLL mod management with ASI Loader auto-install
- ReShade toggle, preset switching, and config access

### Import
- Drag-and-drop import for .json, .zip, and folder mods
- Multi-format import dialog — JSON files, ZIP archives, and Nexus download folders
- Export/import mod lists with SHA-256 hash verification

### UI
- Dark and light theme (toggle in Settings)
- Custom frameless window with accent glow line
- Real-time activity log with timestamped, color-coded entries
- Auto-detection of Steam game directory across all drives
- Launch game directly from the manager

## Getting Started

1. Download `Definitive Mod Manager.exe` from [Releases](https://github.com/exodiaprivate-eng/Definitive-Mod-Manager/releases)
2. Place it anywhere on your system and run it
3. The app auto-detects your Crimson Desert Steam installation
4. Drop mod files into the mods folder (or drag them onto the app window)
5. Enable the mods you want and click **Mount Mods**

## Installing Mods

### JSON Mods
Drop `.json` mod files into the mods folder. They appear in the Mod Library automatically.

### File Replacement Mods
Drop the mod folder (containing `manifest.json` + `files/`, or numbered group directories) into the mods folder. The app detects it and shows it under "File Replacement Mods" in the library.

### Texture Mods
Drop a folder containing `.dds` files into the mods folder. It appears under "Texture Mods" in the library.

### ZIP Archives
Drag a `.zip` file onto the app window. It extracts all contents into the mods folder.

## Nexus API Key

To use update checking and mod ID search, place your Nexus Mods API key in a file called `nexus_api_key.txt` next to the exe. You can get your key from [Nexus Mods API settings](https://www.nexusmods.com/users/myaccount?tab=api+access).

## Building from Source

Requires [Rust](https://rustup.rs/), [Node.js](https://nodejs.org/), and the [Tauri CLI](https://tauri.app/).

```bash
npm install
npx tauri build
```

The compiled exe is at `src-tauri/target/release/definitive-mod-manager.exe`.

## License

MIT
