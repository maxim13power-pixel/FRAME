// frontend/src/components/SmartCaptcha.tsx
import React, { useEffect, useRef, useState, useId } from 'react';
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
      init?: any;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const containerIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const uniqueId = useId(); // ⭐ уникальный id для каждого экземпляра

  useEffect(() => {
    if (!sitekey) {
      console.error('VITE_SMARTCAPTCHA_CLIENT_KEY не настроен');
      setError(true);
      setLoading(false);
      return;
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
        if (cancelled) return;

        const waitReady = setInterval(() => {
          if (window.smartCaptcha && containerRef.current) {
            clearInterval(waitReady);
            try {
              // ⭐ Проверяем что DOM-элемент существует
              if (!containerRef.current) {
                throw new Error('Container ref is null');
              }

              // ⭐ Устанавливаем уникальный id
              containerRef.current.id = `captcha-${uniqueId}`;

              // ⭐ render принимает HTMLElement ИЛИ селектор
              containerIdRef.current = window.smartCaptcha!.render(
                containerRef.current,
                {
                  sitekey,
                  callback: (token: string) => onTokenChange(token),
                  hl: 'ru',
                }
              );
              setLoading(false);
            } catch (err) {
              console.error('SmartCaptcha init error:', err);
              setError(true);
              setLoading(false);
            }
          }
        }, 100);

        setTimeout(() => {
          clearInterval(waitReady);
          if (!window.smartCaptcha || !containerRef.current) {
            if (!cancelled) {
              setError(true);
              setLoading(false);
            }
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

    return () => {
      cancelled = true;
      if (containerIdRef.current && window.smartCaptcha) {
        try {
          window.smartCaptcha.destroy(containerIdRef.current);
        } catch {}
        containerIdRef.current = null;
      }
      onTokenChange(null);
    };
  }, [sitekey, onTokenChange, uniqueId]);

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
      {/* ⭐ ref вместо глобального id */}
      <Box ref={containerRef} sx={{ minHeight: 100 }} />
    </Box>
  );
};

export default SmartCaptcha;