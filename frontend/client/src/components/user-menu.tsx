import { useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { LogOut, UserCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth, type User } from "@/lib/auth";

type UserMenuProps = {
  className?: string;
};

const getDisplayName = (user: User | null): string => {
  if (!user) return "";
  return user.name?.trim() || user.email?.trim() || "";
};

const getInitials = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const base = trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export function UserMenu({ className }: UserMenuProps) {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { user, clearAuth } = useAuth();

  const displayName = useMemo(() => getDisplayName(user), [user]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const secondary = user?.email && user?.name ? user.email : "";

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore network errors, still clear local auth state
    }
    clearAuth();
    setLocation("/auth");
  };

  const buttonLabel = displayName || t("profile.account");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-9 w-9 p-0", className)}
          title={buttonLabel}
        >
          {initials ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground/80">
              {initials}
            </span>
          ) : (
            <UserCircle className="h-5 w-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel>{t("profile.account")}</DropdownMenuLabel>
        <div className="px-2 pb-2 text-xs text-muted-foreground">
          <div className="truncate text-sm font-medium text-foreground">
            {buttonLabel}
          </div>
          {secondary ? <div className="truncate">{secondary}</div> : null}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="h-4 w-4" /> {t("profile.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
