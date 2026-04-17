import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type AppBrandProps = {
  className?: string;
  onClick?: () => void;
  href?: string;
  showText?: boolean;
  showTextOnMobile?: boolean;
};

export function AppBrand({
  className,
  onClick,
  href,
  showText = true,
  showTextOnMobile = false,
}: AppBrandProps) {
  const { i18n } = useTranslation();
  const brandText = i18n.language.startsWith("ru") ? "ЛЭТИ.Формы" : "ETU.Forms";

  const content = (
    <>
      <div className="h-12 w-12 rounded-lg flex items-center justify-center">
        <img
          src="/logo_etu.png"
          alt="ETU_LOGO"
          className="h-12 w-12 object-contain dark:brightness-0 dark:invert"
        />
      </div>
      {showText && (
        <span
          className={cn(
            "font-bold text-base sm:text-xl text-primary dark:!text-white truncate max-w-[9.5rem] sm:max-w-none",
            showTextOnMobile ? "inline" : "hidden sm:inline"
          )}
        >
          {brandText}
        </span>
      )}
    </>
  );

  if (href) {
    const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (!onClick) return;
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      onClick();
    };

    return (
      <a
        href={href}
        className={cn("flex items-center gap-2 cursor-pointer", className)}
        onClick={handleLinkClick}
      >
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={cn("flex items-center gap-2 cursor-pointer", className)} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={cn("flex items-center gap-2", className)}>{content}</div>;
}
