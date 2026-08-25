type Props = {
  className?: string;
  label?: string;
  size?: number;
};

export function CertoMark({ className = "", label = "Certo Work", size = 28 }: Props) {
  return (
    <span
      aria-label={label}
      className={`do-certo-mark ${className}`.trim()}
      data-testid="certo-mark"
      style={{ width: size, height: size }}
    >
      <svg aria-hidden="true" viewBox="0 0 32 32">
        <path
          d="M24 7H12.5A5.5 5.5 0 0 0 7 12.5v7A5.5 5.5 0 0 0 12.5 25H24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeWidth="7"
        />
      </svg>
    </span>
  );
}
