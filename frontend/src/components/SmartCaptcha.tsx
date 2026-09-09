// frontend/src/components/SmartCaptcha.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

declare global {
  interface Window {
    smartCaptcha?: {
      render: (container: string | HTMLElement, params: {
        sitekey: string;
        callback?: (token: string) => void;
        hl?: string;
      }) => string;
      reset: (containerId: string) => void;
      destroy: (containerId: string) => void;
    };
  }
}

interface SmartCaptchaProps {
  onTokenChange: (token: string | null) => void;
  sitekey?: string;
}

const SCRIPT_ID = 'yandex-smartcaptcha-script';

const SmartCaptcha: React.FC<SmartCaptchaProps> = ({
  onTokenChange,
  sitekey = import.meta.env.VITE_SMARTCAPTCHA_CLIENT_KEY,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const captchaDivRef = useRef<HTMLDivElement | null>(null);
  const containerIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!sitekey) {
      console.error('VITE_SMARTCAPTCHA_CLIENT_KEY не настроен');
      setError(true);
      setLoading(false);
      return;
    }

    // ⭐ Создаём div для Яндекса через DOM API — React его не трогает
    if (hostRef.current && !captchaDivRef.current) {
      const div = document.createElement('div');
      div.style.minHeight = '100px';
      hostRef.current.appendChild(div);
      captchaDivRef.current = div;
    }

    const loadScript = (): Promise<void> => {
      return new Promise((resolve, reject) => {
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
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Script load failed'));
        document.head.appendChild(script);
      });
    };

    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !captchaDivRef.current) return;

        const waitReady = setInterval(() => {
          if (window.smartCaptcha && captchaDivRef.current) {
            clearInterval(waitReady);
            try {
              // ⭐ Защита: не рендерим дважды
              if (containerIdRef.current) return;

              containerIdRef.current = window.smartCaptcha!.render(
                captchaDivRef.current,
                {
                  sitekey,
                  // ⭐ Стабильный callback: только при валидном токене
                  callback: (token: string) => {
                    if (!cancelled && token) {
                      onTokenChange(token);
                    }
                  },
                  hl: 'ru',
                }
              );
              setLoading(false);
            } catch (err) {
              console.error('SmartCaptcha init error:', err);
              if (!cancelled) {
                setError(true);
                setLoading(false);
              }
            }
          }
        }, 100);

        setTimeout(() => {
          clearInterval(waitReady);
          if (!cancelled && (!window.smartCaptcha || !captchaDivRef.current)) {
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

    // 🧹 Cleanup
    return () => {
      cancelled = true;
      
      // ⭐ НЕ сбрасываем токен в cleanup — он должен жить до отправки формы
      // Иначе React StrictMode (двойной монтаж) уничтожит токен
        
      // Уничтожаем виджет Яндекса (игнорируем их внутренние ошибки)
      if (containerIdRef.current && window.smartCaptcha) {
        try {
          window.smartCaptcha.destroy(containerIdRef.current);
        } catch {
          // игнорируем их ошибки гидратации
        }
        containerIdRef.current = null;
      }
      
      // Удаляем div
      if (captchaDivRef.current && captchaDivRef.current.parentNode) {
        captchaDivRef.current.parentNode.removeChild(captchaDivRef.current);
      }
      captchaDivRef.current = null;
    };
    // ⭐ onTokenChange убран из зависимостей — не нужен ререндер
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitekey]);

  if (error) {
    return (
      <Box sx={{
        border: '1px solid #d32f2f',
        borderRadius: 1,
        p: 2,
        bgcolor: '#ffebee',
      }}>
        <Typography variant="body2" sx={{ color: '#d32f2f' }}>
          Не удалось загрузить капчу. Попробуйте ещё раз.
        </Typography>
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
      <Box ref={hostRef} sx={{ minHeight: 100 }} />
    </Box>
  );
};

export default SmartCaptcha;