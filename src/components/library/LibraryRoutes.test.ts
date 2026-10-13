import { expect, test } from "vitest";
import { Route as Files } from "@/routes/files";
import { Route as Databases } from "@/routes/databases/index";

test.each([
    ["/files", Files],
    ["/databases", Databases],
] as const)("%s redirects without rendering an overview", (_path, route) => {
    expect(route.options.component).toBeUndefined();
    let result: unknown;
    try {
        route.options.beforeLoad!({} as never);
    } catch (redirect) {
        result = redirect;
    }
    expect(result).toMatchObject({ options: { to: "/library" } });
});
