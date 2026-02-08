import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type AppBrandProps = {
  className?: string;
  onClick?: () => void;
  showText?: boolean;
};

export function AppBrand({ className, onClick, showText = true }: AppBrandProps) {
  const { i18n } = useTranslation();
  const brandText = i18n.language.startsWith("ru") ? "\u041b\u042d\u0422\u0418.\u0424\u043e\u0440\u043c\u044b" : "ETU.Forms";

  const content = (
    <>
      <div className="h-12 w-12 rounded-lg flex items-center justify-center">
        <img src="/logo_etu.png" alt="ETU_LOGO" />
      </div>
      {showText && <span className="font-bold text-xl color-txt hidden sm:inline">{brandText}</span>}
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
