// frontend/src/components/AccessRevokedModal.tsx
// ⭐ №168: модалка «Доступ отозван». Бэкенд отвечает 403 на любую запись,
// api.ts превращает это в событие, а модалка объясняет, где лежит копия данных.
import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

const AccessRevokedModal = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setMessage(detail || 'Доступ отозван: изменения недоступны.');
      setOpen(true);
    };
    window.addEventListener('frame:access-revoked', handler);
    return () => window.removeEventListener('frame:access-revoked', handler);
  }, []);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle>🔒 Доступ отозван</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
        <DialogContentText sx={{ mt: 1.5 }}>
          Объект открыт только для чтения. Копия сметы уже сохранена в ваших шаблонах —
          продолжить работу можно в своём объекте, применив этот шаблон.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={() => setOpen(false)}>
          Понятно
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AccessRevokedModal;
