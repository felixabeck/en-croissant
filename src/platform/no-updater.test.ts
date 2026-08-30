import { test } from "vitest";

import tauriConfigText from "../../src-tauri/tauri.conf.json?raw";
import capabilityText from "../../src-tauri/capabilities/main.json?raw";
import packageText from "../../package.json?raw";
import cargoText from "../../src-tauri/Cargo.toml?raw";

const securityReason =
    "The updater must stay removed because its upstream endpoint and upstream minisign key could offer an upstream release as an update to this fork.";

type JsonObject = Record<string, unknown>;

function hasKey(value: unknown, key: string): boolean {
    if (Array.isArray(value)) return value.some((entry) => hasKey(entry, key));
    if (!value || typeof value !== "object") return false;

    return Object.entries(value).some(
        ([entryKey, entryValue]) => entryKey === key || hasKey(entryValue, key),
    );
}

function hasDependency(packageJson: JsonObject, dependencyName: string): boolean {
    return ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].some(
        (section) => {
            const dependencies = packageJson[section];
            return (
                dependencies !== null &&
                typeof dependencies === "object" &&
                !Array.isArray(dependencies) &&
                dependencyName in dependencies
            );
        },
    );
}

function assertSecurityBoundary(condition: boolean): void {
    if (!condition) throw new Error(securityReason);
}

test("keeps the insecure upstream updater integration absent", () => {
    const tauriConfig = JSON.parse(tauriConfigText) as JsonObject;
    const capability = JSON.parse(capabilityText) as JsonObject;
    const packageJson = JSON.parse(packageText) as JsonObject;
    const plugins = tauriConfig.plugins as JsonObject | undefined;
    const permissions = capability.permissions as unknown[] | undefined;

    assertSecurityBoundary(plugins?.updater === undefined);
    assertSecurityBoundary(!hasKey(tauriConfig, "pubkey"));
    assertSecurityBoundary(!hasKey(tauriConfig, "createUpdaterArtifacts"));

    assertSecurityBoundary(
        permissions?.some(
            (permission) => typeof permission === "string" && permission.startsWith("updater:"),
        ) !== true,
    );
    assertSecurityBoundary(!permissions?.includes("process:allow-restart"));
    assertSecurityBoundary(permissions?.includes("process:allow-exit") === true);

    assertSecurityBoundary(!hasDependency(packageJson, "@tauri-apps/plugin-updater"));
    assertSecurityBoundary(!cargoText.includes("tauri-plugin-updater"));
});
