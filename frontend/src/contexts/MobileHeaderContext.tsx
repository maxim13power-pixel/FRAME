import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Конфиг мобильного хэдера: страница сама говорит, что показать
export interface MobileHeaderConfig {
  title?: string;                      // заголовок раздела
  editableKey?: string;                // ключ localStorage: если есть — тап по заголовку переименовывает
  onBack?: () => void;                 // стрелка «назад»
  searchOpen?: boolean;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchOpen?: () => void;
  onSearchClose?: () => void;
  onSearchChange?: (v: string) => void;
  trailing?: React.ReactNode;          // кнопки справа (сортировка, воронка)
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

// ⭐ Страница вызывает этот хук и передаёт конфиг хэдера
export const useMobileHeader = (config: MobileHeaderConfig) => {
  const { setConfig } = useContext(MobileHeaderContext);
  useEffect(() => {
    setConfig(config);
    return () => setConfig(null);
  });
};

// Хэдер читает конфиг
export const useHeaderConfig = () => useContext(MobileHeaderContext);