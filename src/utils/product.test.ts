import { describe, expect, test } from "vitest";
import { shippedCatalogues } from "@/tests/catalogues";
import { PRODUCT_NAME, REPOSITORY_URL } from "./product.json";
import config from "../../src-tauri/tauri.conf.json";
import cargoManifest from "../../src-tauri/Cargo.toml?raw";
import contributionGuide from "../../CONTRIBUTING.md?raw";
import bugForm from "../../.github/ISSUE_TEMPLATE/bug.yml?raw";
import indexDocument from "../../index.html?raw";

describe("product identity", () => {
    test("keeps independent native, document and renderer inputs consistent", () => {
        expect(PRODUCT_NAME).toBe("ChessFable");
        expect(config.productName).toBe(PRODUCT_NAME);
        expect(config.mainBinaryName).toBe("chessfable");
        expect(config.bundle.publisher).toBe("Felix Beck");
        expect(config.app.windows[0].title).toBe(PRODUCT_NAME);
        expect(indexDocument).toContain(`<title>${PRODUCT_NAME}</title>`);
    });

    test("routes source, contribution and bug support to the fork", () => {
        expect(REPOSITORY_URL).toBe("https://github.com/felixabeck/en-croissant");
        expect(cargoManifest).toContain(`repository = "${REPOSITORY_URL}"`);
        expect(contributionGuide).toContain(`${REPOSITORY_URL}/compare`);
        expect(bugForm).toContain(`${REPOSITORY_URL}/issues?q=`);
    });

    test("brands changed catalogue keys while preserving attribution and chess-joke keys", () => {
        const brandedKeys = [
            "Engines.Remove.Message",
            "Menu.Application.About",
            "Menu.Application.Hide",
            "Menu.Application.Quit",
            "Settings.Privacy.Telemetry.Desc",
            "Settings.Version",
        ];
        for (const { translation } of shippedCatalogues()) {
            const brandedValues = brandedKeys.map((key) => translation[key]).join("\n");
            expect(brandedValues).not.toContain("En Croissant");
            expect(brandedValues).not.toContain("En-Croissant");
            expect(translation["Error.ReportIssue"]).toMatch(/<github>[^<]+<\/github>/u);
            expect(translation["Error.ReportIssue"]).not.toContain("discord");
            expect(translation["About.ModificationNotice"]).toContain("En Croissant");
            expect(translation["Settings.Anarchy.ForcedEnCroissant"]).not.toContain("ChessFable");
            expect(translation["Settings.Anarchy.ForcedEnCroissant.Desc"]).not.toContain(
                "ChessFable",
            );
        }
    });
});
