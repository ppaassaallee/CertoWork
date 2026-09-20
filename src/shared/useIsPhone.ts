import { useEffect, useState } from "react";

/** Phone layout gate — max-width 767px. Desktop/tablet unchanged above this. */
export function useIsPhone(maxWidth = 767): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const get = () =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false;

  const [phone, setPhone] = useState(get);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setPhone(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return phone;
}
