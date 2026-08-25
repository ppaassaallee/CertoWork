import { MessageSquare } from "./ui/Icon";
import { useNavigate } from "react-router-dom";
import { productHomePath, type CertoProduct } from "../lib/collabModule";
import { t } from "../lib/i18n";

type Props = {
  product: CertoProduct;
};

export function ProductSwitcher({ product }: Props) {
  const navigate = useNavigate();
  return (
    <div aria-label={t("productSwitcher")} className="do-product-switch" role="tablist">
      <button
        aria-selected={product === "work"}
        className={product === "work" ? "is-active" : ""}
        data-testid="product-work"
        onClick={() => navigate(productHomePath("work"))}
        role="tab"
        type="button"
      >
        {t("productWork")}
      </button>
      <button
        aria-selected={product === "collab"}
        className={product === "collab" ? "is-active" : ""}
        data-testid="product-collab"
        onClick={() => navigate(productHomePath("collab"))}
        role="tab"
        type="button"
      >
        <MessageSquare size={12} />
        {t("productCollab")}
      </button>
    </div>
  );
}
