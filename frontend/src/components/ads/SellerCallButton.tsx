import { Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, type ButtonProps } from "@/components/ui/button";
import { formatRuPhone } from "@/components/ui/phone-input";
import { phoneTelHref } from "@/lib/footer-contacts";
import { cn } from "@/lib/utils";

export interface SellerCall {
  /** Раскрытый номер; до клика его в странице нет. */
  phone: string | null;
  loading: boolean;
  onReveal: () => void;
}

/**
 * «Позвонить продавцу»: до клика — кнопка, после — ссылка `tel:` с номером.
 *
 * Номер не приходит ни в разметке страницы, ни в ответе списка: карточка
 * знает только `phoneAvailable`, а сам номер — отдельный запрос по нажатию
 * (revealSellerPhone). Номер в разметке роботы собирают за один проход.
 *
 * `iconOnly` — для узкой нижней полосы на телефоне: там до раскрытия кнопка
 * значком, после — номер во всю оставшуюся ширину.
 */
export function SellerCallButton({
  call,
  size = "lg",
  iconOnly = false,
  className,
}: {
  call: SellerCall;
  size?: ButtonProps["size"];
  iconOnly?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();

  if (call.phone) {
    return (
      <Button
        asChild
        variant="outline"
        size={size}
        className={cn("rounded-[var(--r-button)] tabular-nums", className)}
      >
        <a href={phoneTelHref(call.phone)}>
          <Phone size={size === "sm" ? 14 : 16} /> {formatRuPhone(call.phone)}
        </a>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size={iconOnly ? "icon" : size}
      loading={call.loading}
      onClick={call.onReveal}
      aria-label={iconOnly ? t("pages.adDetail.callSeller") : undefined}
      className={cn("rounded-[var(--r-button)]", className)}
    >
      <Phone size={size === "sm" ? 14 : 16} />
      {iconOnly ? null : t("pages.adDetail.callSeller")}
    </Button>
  );
}
