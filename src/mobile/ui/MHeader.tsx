import type { ReactNode } from "react";

export function MHeader({
  title,
  subtitle,
  actions,
  onSubtitleClick,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  onSubtitleClick?: () => void;
}) {
  return (
    <header className="m-header">
      <div className="m-header-text">
        <h1>{title}</h1>
        {subtitle ? (
          onSubtitleClick ? (
            <button className="m-header-sub" onClick={onSubtitleClick} type="button">
              {subtitle}
            </button>
          ) : (
            <div className="m-header-sub">{subtitle}</div>
          )
        ) : null}
      </div>
      {actions ? <div className="m-header-actions">{actions}</div> : null}
    </header>
  );
}
