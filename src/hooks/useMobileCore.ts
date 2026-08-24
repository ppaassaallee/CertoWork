import { useEffect, useState } from "react";
import { isMobileCoreViewport, MOBILE_CORE_MAX_WIDTH } from "../lib/mobileCore";

export function useMobileCore() {
  const [mobileCore, setMobileCore] = useState(() => isMobileCoreViewport());

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_CORE_MAX_WIDTH}px)`);
    const sync = () => setMobileCore(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return mobileCore;
}
