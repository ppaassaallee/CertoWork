import type { ComponentProps } from "react";

/** Shared accessible native choice control for compact forms. */
export function NativeSelect(props: ComponentProps<"select">) {
  return <select {...props} />;
}
