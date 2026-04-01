mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_config,
            commands::save_config,
            commands::scan_mods,
            commands::apply_mods,
            commands::revert_mods,
            commands::get_mod_details,
            commands::check_conflicts,
            commands::create_backup,
            commands::restore_backup,
            commands::validate_game_path,
            commands::import_mod,
            commands::delete_mod,
            commands::scan_lang_mods,
            commands::import_archive,
            commands::auto_detect_game_path,
            commands::launch_game,
            commands::get_papgt_status,
            // Mod Profiles
            commands::save_profile,
            commands::load_profile,
            commands::list_profiles,
            commands::delete_profile,
            // Game Version Tracking
            commands::get_game_version,
            commands::check_version_changed,
            // Mod Readme
            commands::read_mod_readme,
            // Nexus Folder Import
            commands::scan_nexus_folders,
            commands::import_nexus_folder,
            // Export/Import Mod List
            commands::export_mod_list,
            commands::import_mod_list,
            // Backup Manager
            commands::list_backups,
            commands::delete_backup,
            commands::restore_single_backup,
            // Pre-flight Check
            commands::preflight_check,
            // Recovery & Diagnostics
            commands::recover_interrupted,
            commands::detailed_check,
            // Nexus Mods API
            commands::parse_nexus_mod_ids,
            commands::check_mod_updates,
            // Nexus Name-Based Search
            commands::search_nexus_by_name,
            commands::search_all_unmatched_mods,
            commands::load_nexus_cache,
            // App Initialization
            commands::get_app_dir,
            commands::get_nexus_api_key,
            commands::initialize_app,
            commands::open_folder,
            // ReShade
            commands::scan_reshade,
            commands::toggle_reshade,
            commands::set_reshade_preset,
            commands::open_reshade_config,
            // ASI / DLL Mods
            commands::scan_asi_mods,
            commands::enable_asi_mod,
            commands::disable_asi_mod,
            commands::install_asi_mod,
            commands::uninstall_asi_mod,
            commands::open_asi_config,
            commands::install_asi_loader,
            // Mod Packs
            commands::create_mod_pack,
            commands::import_mod_pack,
            commands::list_mod_packs,
            commands::delete_mod_pack,
            // Backup Snapshots
            commands::create_snapshot,
            commands::list_snapshots,
            commands::restore_snapshot,
            commands::delete_snapshot,
            // Mod Creator
            commands::create_mod_json,
            // Compatibility Matrix
            commands::get_compatibility_matrix,
            // Nexus Thumbnails
            commands::fetch_mod_thumbnail,
            // Nexus Search & Browse
            commands::search_nexus_mods,
            commands::get_nexus_mod_details,
            // Community Profiles
            commands::export_community_profile,
            commands::import_community_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
