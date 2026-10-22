// frontend/src/contexts/FeedbackContext.tsx
// ⭐ Единые уведомления и подтверждения для всего приложения (вместо браузерных alert/confirm).
// Подключено в App.tsx: любой компонент вызывает useFeedback().
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
} from '@mui/material';

export type FeedbackSeverity = 'success' | 'info' | 'warning' | 'error';

export interface ConfirmOptions {
  title?: string;
  text: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface FeedbackContextValue {
  notify: (message: string, severity?: FeedbackSeverity) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve?: (value: boolean) => void;
}

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: FeedbackSeverity }>({
    open: false,
    message: '',
    severity: 'info',
  });
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const closeSnack = useCallback(() => setSnack((s) => ({ ...s, open: false })), []);

  const notify = useCallback((message: string, severity: FeedbackSeverity = 'info') => {
    setSnack({ open: true, message, severity });
  }, []);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      notify,
      success: (message: string) => notify(message, 'success'),
      error: (message: string) => notify(message, 'error'),
      confirm: (options: ConfirmOptions) =>
        new Promise<boolean>((resolve) => setConfirmState({ ...options, open: true, resolve })),
    }),
    [notify],
  );

  const closeConfirm = (result: boolean) => {
    confirmState?.resolve?.(result);
    setConfirmState(null);
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <Snackbar
        open={snack.open}
        autoHideDuration={snack.severity === 'error' ? 8000 : 4000}
        onClose={closeSnack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        // на мобилке поднимаем выше, чтобы не перекрывать нижнее меню
        sx={{ mb: { xs: 9, md: 2 } }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={closeSnack}
          sx={{ width: '100%', maxWidth: 560, boxShadow: 3, whiteSpace: 'pre-line' }}
        >
          {snack.message}
        </Alert>
      </Snackbar>

      <Dialog open={!!confirmState?.open} onClose={() => closeConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>{confirmState?.title ?? 'Подтвердите действие'}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ whiteSpace: 'pre-line' }}>{confirmState?.text}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => closeConfirm(false)}>{confirmState?.cancelText ?? 'Отмена'}</Button>
          <Button
            variant="contained"
            color={confirmState?.danger ? 'error' : 'primary'}
            onClick={() => closeConfirm(true)}
          >
            {confirmState?.confirmText ?? 'Подтвердить'}
          </Button>
        </DialogActions>
      </Dialog>
    </FeedbackContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useFeedback = (): FeedbackContextValue => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback должен использоваться внутри FeedbackProvider');
  }
  return ctx;
};
