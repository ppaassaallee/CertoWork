import { useRef, type ReactNode } from "react";
import { useSwipeable } from "react-swipeable";

export function MListRow({
  title,
  meta,
  leading,
  statusDot,
  twoLine,
  subtitle,
  onClick,
  onLongPress,
  swipeLeft,
  swipeRight,
  selected,
  className = "",
}: {
  title: string;
  meta?: ReactNode;
  leading?: ReactNode;
  statusDot?: "r" | "y" | "g" | null;
  twoLine?: boolean;
  subtitle?: ReactNode;
  onClick?: () => void;
  onLongPress?: () => void;
  swipeLeft?: ReactNode;
  swipeRight?: () => void;
  selected?: boolean;
  className?: string;
}) {
  const timer = useRef<number | null>(null);
  const handlers = useSwipeable({
    onSwipedRight: () => swipeRight?.(),
    trackMouse: false,
    delta: 48,
  });

  const startLong = () => {
    if (!onLongPress) return;
    timer.current = window.setTimeout(() => onLongPress(), 500);
  };
  const clearLong = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <div className={`m-list-row-wrap ${className}`.trim()}>
      {swipeLeft ? <div className="m-list-swipe-left">{swipeLeft}</div> : null}
      <div
        className={`m-list-row${twoLine ? " is-two" : ""}${selected ? " is-selected" : ""}`}
        onClick={onClick}
        onPointerCancel={clearLong}
        onPointerDown={startLong}
        onPointerUp={clearLong}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        {...handlers}
      >
        {swipeRight ? <span className="m-list-swipe-hint" aria-hidden /> : null}
        {leading ? <div className="m-list-leading">{leading}</div> : null}
        <div className="m-list-main">
          <div className="m-list-title">{title}</div>
          {twoLine && subtitle ? <div className="m-list-sub">{subtitle}</div> : null}
        </div>
        {meta ? <div className="m-list-meta">{meta}</div> : null}
        {statusDot ? <span className={`m-sem m-sem-${statusDot}`} /> : null}
      </div>
    </div>
  );
}
