import { AppShellSection, Stack, Tooltip } from "@mantine/core";
import {
  type Icon,
  IconChess,
  IconCpu,
  IconDatabase,
  IconFiles,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import { Link, useRouterState } from "@tanstack/react-router";
import cx from "clsx";
import { useTranslation } from "react-i18next";
import {
  databaseRouteTarget,
  type DatabaseRouteTarget,
} from "@/components/databases/databaseRoute";
import { useActiveDatabaseViewStore } from "@/state/store/database";
import classes from "./Sidebar.module.css";

type SidebarPath = "/" | "/accounts" | "/files" | "/databases" | "/engines" | "/settings";

interface NavbarLinkProps {
  icon: Icon;
  label: string;
  target?: DatabaseRouteTarget | { to: SidebarPath };
  matchPath: SidebarPath;
}

function matchesSidebarPath(pathname: string, matchPath: SidebarPath): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === matchPath || (matchPath !== "/" && path.startsWith(`${matchPath}/`));
}

function NavbarLink({ matchPath, target = { to: matchPath }, icon: Icon, label }: NavbarLinkProps) {
  const active = useRouterState({
    select: (state) => matchesSidebarPath(state.location.pathname, matchPath),
  });
  return (
    <Tooltip label={label} position="right">
      <Link
        {...target}
        preload="intent"
        aria-label={label}
        className={cx(classes.link, active && classes.active)}
        aria-current={active ? "page" : undefined}
      >
        <Icon size="1.5rem" stroke={1.5} />
      </Link>
    </Tooltip>
  );
}

const linksdata = [
  { icon: IconChess, labelKey: "SideBar.Board", matchPath: "/" },
  { icon: IconUser, labelKey: "SideBar.User", matchPath: "/accounts" },
  { icon: IconFiles, labelKey: "SideBar.Files", matchPath: "/files" },
  {
    icon: IconDatabase,
    labelKey: "SideBar.Databases",
    matchPath: "/databases",
  },
  { icon: IconCpu, labelKey: "SideBar.Engines", matchPath: "/engines" },
] as const;

export function SideBar() {
  const { t } = useTranslation();
  const database = useActiveDatabaseViewStore((s) => s.database);

  const links = linksdata.map((link) => (
    <NavbarLink
      {...link}
      {...(link.matchPath === "/databases" ? { target: databaseRouteTarget(database) } : {})}
      label={t(link.labelKey)}
      key={link.labelKey}
    />
  ));

  return (
    <>
      <AppShellSection grow>
        <Stack justify="center" gap={0}>
          {links}
        </Stack>
      </AppShellSection>
      <AppShellSection>
        <Stack justify="center" gap={0}>
          <NavbarLink icon={IconSettings} label={t("SideBar.Settings")} matchPath="/settings" />
        </Stack>
      </AppShellSection>
    </>
  );
}
