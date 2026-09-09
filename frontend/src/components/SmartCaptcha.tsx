// frontend/src/components/SmartCaptcha.tsx
// ⭐ Yandex SmartCaptcha React-компонент
// Документация: https://yandex.cloud/ru/docs/smartcaptcha/

import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

// ⭐ Типизация глобального объекта window.smartCaptcha (создаётся скриптом Яндекса)
declare global {
  interface Window {
    smartCaptcha?: {
      init: (params: {
        sitekey: string;
        container: string;
        callback?: (token: string) => void;
        hl?: string;
        test?: boolean;
      }) => number; // возвращает ID инстанса
      reset: (id: number) => void;
      destroy: (id: number) => void;
    };
  }
}

interface SmartCaptchaProps {
  onTokenChange: (token: string | null) => void;
  sitekey?: string; // если не передан — берём из env
}

const SCRIPT_ID = 'yandex-smartcaptcha-script';
const CONTAINER_ID = 'smart-captcha-container';

const SmartCaptcha: React.FC<SmartCaptchaProps> = ({
  onTokenChange,
  sitekey = import.meta.env.VITE_SMARTCAPTCHA_CLIENT_KEY,
}) => {
  const instanceIdRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // ⭐ Загрузка внешнего скрипта (singleton — только один раз)
  useEffect(() => {
    if (!sitekey) {
      console.error('VITE_SMARTCAPTCHA_CLIENT_KEY не настроен');
      setError(true);
      setLoading(false);
      return;
    }

    const loadScript = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Если скрипт уже загружается или загружен — ждём window.smartCaptcha
        const existing = document.getElementById(SCRIPT_ID);
        if (existing) {
          if (window.smartCaptcha) return resolve();
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('Script load failed')));
          return;
        }

        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = 'https://smartcaptcha.yandexcloud.net/captcha.js?render=onload';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Script load failed'));
        document.head.appendChild(script);
      });
    };

    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled) return;
        // Ждём пока объект window.smartCaptcha станет доступен
        const waitReady = setInterval(() => {
          if (window.smartCaptcha) {
            clearInterval(waitReady);
            try {
              // 🔒 Инициализация виджета
              instanceIdRef.current = window.smartCaptcha!.init({
                sitekey,
                container: `#${CONTAINER_ID}`,
                callback: (token: string) => onTokenChange(token),
                hl: 'ru',
              });
              setLoading(false);
            } catch (err) {
              console.error('SmartCaptcha init error:', err);
              setError(true);
              setLoading(false);
            }
          }
        }, 100);

        // Страховка: если через 10 сек не загрузилось — ошибка
        setTimeout(() => {
          clearInterval(waitReady);
          if (!window.smartCaptcha) {
            setError(true);
            setLoading(false);
          }
        }, 10000);
      })
      .catch((err) => {
        console.error('SmartCaptcha script error:', err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    // 🧹 Cleanup при unmount
    return () => {
      cancelled = true;
      if (instanceIdRef.current !== null && window.smartCaptcha) {
        try {
          window.smartCaptcha.destroy(instanceIdRef.current);
        } catch {
          // игнорируем ошибки дестроя
        }
        instanceIdRef.current = null;
      }
      onTokenChange(null);
    };
  }, [sitekey, onTokenChange]);

  // 🔄 Ручной сброс капчи
  const handleReset = () => {
    if (instanceIdRef.current !== null && window.smartCaptcha) {
      window.smartCaptcha.reset(instanceIdRef.current);
      onTokenChange(null);
    }
  };

  if (error) {
    return (
      <Box sx={{
        border: '1px solid #d32f2f',
        borderRadius: 1,
        p: 2,
        bgcolor: '#ffebee',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}>
        <Typography variant="body2" sx={{ color: '#d32f2f', flexGrow: 1 }}>
          Не удалось загрузить капчу. Попробуйте ещё раз.
        </Typography>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => window.location.reload()}
          sx={{ color: '#d32f2f', textTransform: 'none' }}
        >
          Обновить
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CircularProgress size={16} sx={{ color: '#1976d2' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Загрузка капчи...
          </Typography>
        </Box>
      )}
      {/* ⭐ Контейнер для виджета Яндекса */}
      <Box id={CONTAINER_ID} sx={{ minHeight: 100 }} />
    </Box>
  );
};

export default SmartCaptcha;