import { Filter, Layers, Settings2, Users, LayoutGrid } from "../../components/ui/Icon";
import type { SavedView } from "../../lib/views/types";
import { t } from "../../lib/i18n";

export function ViewsBar({
  views,
  activeViewId,
  onSelect,
  onCreate,
  onOpenCustomizer,
  filterCount = 0,
  sortLabel,
  groupLabel,
}: {
  views: SavedView[];
  activeViewId: string;
  onSelect(viewId: string): void;
  onCreate(): void;
  onOpenCustomizer(section?: "filter" | "sort" | "group" | "customize"): void;
  filterCount?: number;
  sortLabel?: string;
  groupLabel?: string;
}) {
  return (
    <div className="cw-views-bar" data-testid="views-bar">
      <div className="cw-views-tabs" role="tablist">
        {views.map((view) => (
          <button
            className={view.id === activeViewId ? "is-active" : ""}
            key={view.id}
            onClick={() => onSelect(view.id)}
            role="tab"
            type="button"
          >
            {view.scope === "team" ? <Users size={12} /> : null}
            {view.name}
          </button>
        ))}
        <button className="cw-views-tab-add" onClick={onCreate} type="button">
          + {t("views.new")}
        </button>
      </div>
      <div className="cw-views-bar-tools">
        <button
          data-testid="views-filter"
          onClick={() => onOpenCustomizer("filter")}
          title={t("views.filter")}
          type="button"
        >
          <Filter size={13} />
          {t("views.filter")}
          {filterCount > 0 ? ` ${filterCount}` : ""}
        </button>
        <button
          data-testid="views-sort"
          onClick={() => onOpenCustomizer("sort")}
          title={t("views.sort")}
          type="button"
        >
          <Layers size={13} />
          {t("views.sort")}
          {sortLabel ? ` ${sortLabel}` : ""}
        </button>
        <button
          data-testid="views-group"
          onClick={() => onOpenCustomizer("group")}
          title={t("views.group")}
          type="button"
        >
          <LayoutGrid size={13} />
          {t("views.group")}
          {groupLabel ? ` ${groupLabel}` : ""}
        </button>
        <button data-testid="views-customize" onClick={() => onOpenCustomizer("customize")} type="button">
          <Settings2 size={13} />
          {t("views.customize")}
        </button>
      </div>
    </div>
  );
}
