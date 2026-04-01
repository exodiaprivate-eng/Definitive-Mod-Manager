"""Unmount all mods by restoring the clean PAPGT.

The game ignores the 0036 overlay folder when PAPGT doesn't reference it.

Called from the Rust backend as a subprocess:
    python unmount_mods.py '{"game_path":"...","backup_dir":"..."}'

Output: JSON on stdout with {"success": bool, "restored": [...], "errors": [...]}
"""

import sys
import os
import json
import shutil
from pathlib import Path


def main():
    args = json.loads(sys.argv[1])
    game_path = args["game_path"]
    backup_dir = args["backup_dir"]

    result = {"success": True, "restored": [], "errors": []}

    backup_path = Path(backup_dir)
    papgt_backup = backup_path / "papgt_clean.bin"
    papgt_path = Path(game_path) / "meta" / "0.papgt"

    if papgt_backup.exists():
        try:
            shutil.copy2(papgt_backup, papgt_path)
            result["restored"].append("Mods unmounted — PAPGT restored to clean")
        except Exception as e:
            result["errors"].append(f"Failed to restore PAPGT: {e}")
            result["success"] = False
    else:
        result["errors"].append("No clean PAPGT backup found. Run Initialize first.")
        result["success"] = False

    print(json.dumps(result))


if __name__ == "__main__":
    main()
