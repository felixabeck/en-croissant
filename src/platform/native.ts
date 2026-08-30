/** The only renderer module that imports Tauri plugin and API runtime values. */
export { getTauriVersion, getVersion } from "@tauri-apps/api/app";
export { convertFileSrc } from "@tauri-apps/api/core";
export { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
export { resolveResource } from "@tauri-apps/api/path";
export { getCurrentWebviewWindow, type WebviewWindow } from "@tauri-apps/api/webviewWindow";
export { getCurrentWindow } from "@tauri-apps/api/window";
export { getMatches } from "@tauri-apps/plugin-cli";
export { ask, message } from "@tauri-apps/plugin-dialog";
export { attachConsole, error, info, warn } from "@tauri-apps/plugin-log";
export {
    arch,
    platform,
    type Platform,
    type as osType,
    version as OSVersion,
} from "@tauri-apps/plugin-os";
export { exit } from "@tauri-apps/plugin-process";
