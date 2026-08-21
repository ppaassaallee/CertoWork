import { ChevronRight } from "./ui/Icon";

export type BreadcrumbSegment = {
  label: string;
  onClick?: () => void;
};

/** Asana-style path: Workspace / Command Center / Project / Tab */
export function AppBreadcrumbs({ segments }: { segments: BreadcrumbSegment[] }) {
  const visible = segments.filter((segment) => segment.label);
  if (!visible.length) return null;
  return (
    <nav className="do-breadcrumb" aria-label="Breadcrumb">
      {visible.map((segment, index) => {
        const last = index === visible.length - 1;
        return (
          <span className="do-breadcrumb-seg" key={`${segment.label}-${index}`}>
            {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
            {segment.onClick && !last ? (
              <button onClick={segment.onClick} type="button">
                {segment.label}
              </button>
            ) : (
              <strong aria-current={last ? "page" : undefined}>
                {segment.label}
              </strong>
            )}
          </span>
        );
      })}
    </nav>
  );
}
