import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { AppShell, MantineProvider } from "@mantine/core";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { installResizeObserverStub } from "@/tests/resizeObserver";
import { SideBar } from "./Sidebar";
import classes from "./Sidebar.module.css";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
installMatchMediaStub();
installResizeObserverStub();

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

test("keeps the active sidebar marker aligned with client navigation", async () => {
  const rootRoute = createRootRoute({
    component: () => (
      <AppShell navbar={{ width: "3rem", breakpoint: 0 }}>
        <AppShell.Navbar>
          <SideBar />
        </AppShell.Navbar>
        <AppShell.Main>
          <Outlet />
        </AppShell.Main>
      </AppShell>
    ),
  });
  const routePaths = [
    "/",
    "/accounts",
    "/files",
    "/databases",
    "/databases/$databaseId",
    "/engines",
    "/settings",
  ];
  const routes = routePaths.map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    await router.load();
  });
  await act(async () =>
    root!.render(
      <MantineProvider>
        <RouterProvider router={router} />
      </MantineProvider>,
    ),
  );

  const expectActiveLink = (label: string) => {
    const links = [...host!.querySelectorAll<HTMLAnchorElement>("a[aria-label]")];
    const classActive = links
      .filter((link) => link.classList.contains(classes.active))
      .map((link) => link.getAttribute("aria-label"));
    const ariaCurrent = links
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map((link) => link.getAttribute("aria-label"));

    expect(classActive).toEqual([label]);
    expect(ariaCurrent).toEqual([label]);
    expect(
      links
        .filter(
          (link) =>
            link.classList.contains(classes.active) && link.getAttribute("aria-current") === "page",
        )
        .map((link) => link.getAttribute("aria-label")),
    ).toEqual([label]);
  };

  const navigateAndExpect = async (to: string, label: string) => {
    await act(async () => {
      await router.navigate({ to });
    });
    expectActiveLink(label);
  };

  await navigateAndExpect("/accounts", "SideBar.User");
  await navigateAndExpect("/engines?selected=2", "SideBar.Engines");
  await navigateAndExpect("/files", "SideBar.Files");
  await navigateAndExpect("/databases", "SideBar.Databases");
  await navigateAndExpect("/databases/abc", "SideBar.Databases");
  await navigateAndExpect("/settings", "SideBar.Settings");
  await navigateAndExpect("/", "SideBar.Board");
});
