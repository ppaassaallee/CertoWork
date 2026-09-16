import type { ReactNode } from "react";

export function DirectionWidget({
  title,
  linkLabel,
  onLink,
  children,
  testId,
}: {
  title: string;
  linkLabel?: string;
  onLink?(): void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <article className="cw-dir-widget" data-testid={testId || "direction-widget"}>
      <header className="cw-dir-widget-head">
        <h2>{title}</h2>
        {linkLabel ? (
          <button className="cw-dir-widget-link" onClick={onLink} type="button">
            {linkLabel}
          </button>
        ) : null}
      </header>
      <div className="cw-dir-widget-body">{children}</div>
    </article>
  );
}

export function DirectionEmpty({ label }: { label: string }) {
  return <p className="cw-dir-empty">{label}</p>;
}

export function DirectionRow({
  leading,
  title,
  meta,
  metaTone,
  onClick,
}: {
  leading?: ReactNode;
  title: string;
  meta?: string;
  metaTone?: "danger" | "warning" | "ok" | "neutral";
  onClick?(): void;
}) {
  const content = (
    <>
      {leading}
      <span className="cw-dir-row-title">{title}</span>
      {meta ? (
        <span className={`cw-dir-row-meta${metaTone ? ` is-${metaTone}` : ""}`}>{meta}</span>
      ) : null}
    </>
  );
  if (onClick) {
    return (
      <button className="cw-dir-row" onClick={onClick} type="button">
        {content}
      </button>
    );
  }
  return <div className="cw-dir-row">{content}</div>;
}

export function DirectionDot({ color }: { color: string }) {
  return <span className="cw-dir-dot" style={{ background: color }} />;
}

export function DirectionAvatar({ name }: { name: string }) {
  const hue =
    Array.from(name).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 360;
  return (
    <span
      aria-hidden
      className="cw-dir-avatar"
      style={{ background: `hsl(${hue} 18% 62%)` }}
    />
  );
}

export function DirectionBar({
  ratio,
  tone,
}: {
  ratio: number;
  tone: "danger" | "warning" | "ok";
}) {
  const width = Math.min(100, Math.max(4, Math.round(ratio * 100)));
  return (
    <span className="cw-dir-bar" aria-hidden>
      <i className={`is-${tone}`} style={{ width: `${width}%` }} />
    </span>
  );
}
