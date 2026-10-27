// frontend/src/components/SectionIntro.tsx
// ⭐ №179: одноразовая подсказка раздела — «первый раз зашёл и сразу понятно».
// Показывается под заголовком, закрывается крестиком, факт закрытия живёт в localStorage.
// Поменяли текст → поднимите version, подсказка покажется снова.
import React, { useState } from 'react';
import { Alert, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const STORAGE_PREFIX = 'frame:intro:';

export const introKey = (id: string, version: number) => `${STORAGE_PREFIX}${id}:v${version}`;

export const isIntroHidden = (id: string, version = 1): boolean => {
  try {
    return localStorage.getItem(introKey(id, version)) === '1';
  } catch {
    return false;
  }
};

/** Сброс всех подсказок (кнопка «Показать подсказки снова» в Настройках) */
export const resetAllIntros = (): number => {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    return keys.length;
  } catch {
    return 0;
  }
};

interface SectionIntroProps {
  /** стабильный id раздела: 'objects', 'projects', 'materials', 'price-catalogs'… */
  id: string;
  /** версия текста: изменили текст — поднимите, подсказка покажется заново */
  version?: number;
  children: React.ReactNode;
}

const SectionIntro: React.FC<SectionIntroProps> = ({ id, version = 1, children }) => {
  const [hidden, setHidden] = useState<boolean>(() => isIntroHidden(id, version));
  if (hidden) return null;

  const handleClose = () => {
    try {
      localStorage.setItem(introKey(id, version), '1');
    } catch {
      /* приватный режим — просто скрываем до перезагрузки */
    }
    setHidden(true);
  };

  return (
    <Alert
      severity="info"
      icon={false}
      sx={{
        mb: 2,
        borderRadius: 2,
        alignItems: 'flex-start',
        bgcolor: 'rgba(25, 118, 210, 0.06)',
        color: 'text.primary',
        '& .MuiAlert-message': { width: '100%' },
      }}
      action={
        <IconButton size="small" aria-label="Скрыть подсказку" onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      }
    >
      <Box sx={{ fontSize: { xs: '0.82rem', sm: '0.9rem' }, lineHeight: 1.45 }}>{children}</Box>
    </Alert>
  );
};

export default SectionIntro;
