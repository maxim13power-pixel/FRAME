// frontend/src/components/AccessRevokedModal.tsx
// ⭐ №168: модалка «Доступ отозван». Бэкенд отвечает 403 на любую запись,
// api.ts превращает это в событие, а модалка объясняет, где лежит копия данных.
// ⭐ №193 (A₂ F1): живого доступа больше нет вообще (включая чтение) —
// текст говорит только про копию в шаблонах, а не про «открыт на чтение».
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

const AccessRevokedModal = () => {
  const navigate = useNavigate();
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
          Живой объект закрыт. Копия сметы и справочника цен на момент отзыва
          сохранена в ваших шаблонах — работать с ней можно в своём объекте.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setOpen(false);
            navigate('/snapshots');
          }}
        >
          Открыть копию
        </Button>
        <Button variant="contained" onClick={() => setOpen(false)}>
          Понятно
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AccessRevokedModal;
