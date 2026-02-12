import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type AppBrandProps = {
  className?: string;
  onClick?: () => void;
  showText?: boolean;
  showTextOnMobile?: boolean;
};

export function AppBrand({
  className,
  onClick,
  showText = true,
  showTextOnMobile = false,
}: AppBrandProps) {
  const { i18n } = useTranslation();
  const brandText = i18n.language.startsWith("ru") ? "ЛЭТИ.Формы" : "ETU.Forms";

  const content = (
    <>
      <div className="h-12 w-12 rounded-lg flex items-center justify-center">
        <img src="/logo_etu.png" alt="ETU_LOGO" />
      </div>
      {showText && (
        <span
          className={cn(
            "font-bold text-base sm:text-xl color-txt truncate max-w-[9.5rem] sm:max-w-none",
            showTextOnMobile ? "inline" : "hidden sm:inline"
          )}
        >
          {brandText}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={cn("flex items-center gap-2", className)} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={cn("flex items-center gap-2", className)}>{content}</div>;
}
