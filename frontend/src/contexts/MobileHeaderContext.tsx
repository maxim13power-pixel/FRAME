import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface MobileHeaderConfig {
  title?: string;
  editableKey?: string;
  onBack?: () => void;
  searchOpen?: boolean;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchOpen?: () => void;
  onSearchClose?: () => void;
  onSearchChange?: (v: string) => void;
  trailing?: React.ReactNode;
}

interface Ctx {
  config: MobileHeaderConfig | null;
  setConfig: (c: MobileHeaderConfig | null) => void;
}

const MobileHeaderContext = createContext<Ctx>({ config: null, setConfig: () => {} });

export const MobileHeaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<MobileHeaderConfig | null>(null);
  const value = useMemo(() => ({ config, setConfig }), [config]);
  return <MobileHeaderContext.Provider value={value}>{children}</MobileHeaderContext.Provider>;
};

// ⭐ Фикс бесконечного цикла: вызываем setConfig ТОЛЬКО при изменении стабильных полей.
// trailing (JSX) и функции не входят в deps — они обновляются через ref.
export const useMobileHeader = (config: MobileHeaderConfig) => {
  const { setConfig } = useContext(MobileHeaderContext);

  // Сохраняем актуальный config в ref (для функций и trailing)
  const configRef = useRef<MobileHeaderConfig>(config);
  useEffect(() => {
    configRef.current = config;
  });

  // setConfig вызывается только когда "данные" меняются (без JSX и функций)
  useEffect(() => {
    setConfig(configRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.title,
    config.editableKey,
    config.searchOpen,
    config.searchValue,
    config.searchPlaceholder,
    config.trailing,
  ]);
  // Cleanup при размонтировании страницы
  useEffect(() => {
    return () => setConfig(null);
  }, [setConfig]);
};

export const useHeaderConfig = () => useContext(MobileHeaderContext);