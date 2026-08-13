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
import { Link, useMatchRoute } from "@tanstack/react-router";
import cx from "clsx";
import { useTranslation } from "react-i18next";
import classes from "./Sidebar.module.css";

interface NavbarLinkProps {
  icon: Icon;
  label: string;
  url: string;
  active?: boolean;
}

function NavbarLink({ url, icon: Icon, label }: NavbarLinkProps) {
  const match = useMatchRoute();
  return (
    <Tooltip label={label} position="right">
      <Link
        to={url}
        preload="intent"
        aria-label={label}
        aria-current={match({ to: url, fuzzy: true }) !== false ? "page" : undefined}
        className={cx(classes.link, {
          [classes.active]: match({ to: url, fuzzy: true }) !== false,
        })}
      >
        <Icon size="1.5rem" stroke={1.5} />
      </Link>
    </Tooltip>
  );
}

const linksdata = [
  { icon: IconChess, labelKey: "SideBar.Board", url: "/" },
  { icon: IconUser, labelKey: "SideBar.User", url: "/accounts" },
  { icon: IconFiles, labelKey: "SideBar.Files", url: "/files" },
  {
    icon: IconDatabase,
    labelKey: "SideBar.Databases",
    url: "/databases",
  },
  { icon: IconCpu, labelKey: "SideBar.Engines", url: "/engines" },
];

export function SideBar() {
  const { t } = useTranslation();

  const links = linksdata.map((link) => (
    <NavbarLink {...link} label={t(link.labelKey)} key={link.labelKey} />
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
          <NavbarLink icon={IconSettings} label={t("SideBar.Settings")} url="/settings" />
        </Stack>
      </AppShellSection>
    </>
  );
}
