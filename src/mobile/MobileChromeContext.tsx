import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type MobileHeaderConfig = {
  title: string;
  subtitle?: ReactNode;
  onSubtitleClick?: () => void;
  actions?: ReactNode;
};

type Ctx = {
  header: MobileHeaderConfig;
  setHeader: (next: MobileHeaderConfig) => void;
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  keyboardUp: boolean;
  setKeyboardUp: (up: boolean) => void;
};

const MobileChromeContext = createContext<Ctx | null>(null);

export function MobileChromeProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<MobileHeaderConfig>({ title: "Certo" });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const setHeader = useCallback((next: MobileHeaderConfig) => setHeaderState(next), []);
  const value = useMemo(
    () => ({ header, setHeader, sheetOpen, setSheetOpen, keyboardUp, setKeyboardUp }),
    [header, setHeader, sheetOpen, keyboardUp],
  );
  return <MobileChromeContext.Provider value={value}>{children}</MobileChromeContext.Provider>;
}

export function useMobileChrome() {
  const ctx = useContext(MobileChromeContext);
  if (!ctx) throw new Error("useMobileChrome requires MobileChromeProvider");
  return ctx;
}

/** Pages call this to publish header config. */
export function useMobileHeader(config: MobileHeaderConfig) {
  const { setHeader } = useMobileChrome();
  useEffect(() => {
    setHeader(config);
  }, [config.title, config.subtitle, config.actions, config.onSubtitleClick, setHeader]);
}
