// frontend/src/components/PhotoViewerDialog.tsx
// ⭐ №230: общий полноэкранный просмотр фото (галерея материала + лента на Главной).
// Комментарий переносится и скроллится (№229), картинка — через blob с JWT.
import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton,
  useMediaQuery, useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { MaterialPhotoData } from '../services/photoService';
import { deleteMaterialPhoto, fetchPhotoBlob } from '../services/photoService';
import { useFeedback } from '../contexts/FeedbackContext';
import { getApiErrorMessage } from '../utils/errors';

interface Props {
  photo: MaterialPhotoData | null;
  onClose: () => void;
  /** ⭐ №252: подпись материала для alt (комментарий больше не всплывает). */
  materialName?: string | null;
  /** Передан — показываем удаление и вызываем после успешного удаления. */
  onDeleted?: () => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const PhotoViewerDialog: React.FC<Props> = ({ photo, materialName, onClose, onDeleted }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { confirm, error: notifyError } = useFeedback();
  const [url, setUrl] = useState('');
  const urlRef = useRef('');
  const [deleting, setDeleting] = useState(false);

  const applyUrl = (next: string) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next;
    setUrl(next);
  };

  useEffect(() => {
    if (!photo) {
      applyUrl('');
      return;
    }
    let cancelled = false;
    void fetchPhotoBlob(photo.id, 'full')
      .then((blob) => {
        if (!cancelled) applyUrl(URL.createObjectURL(blob));
      })
      .catch((err) => notifyError(getApiErrorMessage(err, 'Не удалось открыть фото')));
    return () => {
      cancelled = true;
    };
  }, [photo, notifyError]);

  // Освобождаем URL при размонтировании (без setState после unmount)
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = '';
    },
    [],
  );

  const removePhoto = async () => {
    if (!photo || !onDeleted) return;
    const ok = await confirm({
      title: 'Удалить фото?',
      text: 'Фото будет удалено безвозвратно.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteMaterialPhoto(photo.id);
      onDeleted();
      onClose();
    } catch (err) {
      notifyError(getApiErrorMessage(err, 'Не удалось удалить фото'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={Boolean(photo)} onClose={onClose} fullScreen maxWidth="lg">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton onClick={onClose} aria-label="Назад"><ArrowBackIcon /></IconButton>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box component="span" sx={{ fontSize: '1rem', fontWeight: 600 }}>
            {photo ? formatDate(photo.createdAt) : ''}
          </Box>
        </Box>
        {url && photo && (
          <IconButton
            component="a"
            href={url}
            download={`photo-${photo.id}.jpg`}
            aria-label="Скачать"
          >
            <DownloadIcon />
          </IconButton>
        )}
        {photo && onDeleted && (
          <IconButton
            onClick={() => void removePhoto()}
            disabled={deleting}
            color="error"
            aria-label="Удалить фото"
          >
            <DeleteOutlineIcon />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#eaf4ff', minHeight: 240 }}>
        {url ? (
          <Box
            component="img"
            src={url}
            alt={materialName || 'Фото'}
            sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
          />
        ) : (
          <CircularProgress sx={{ color: '#1976d2' }} />
        )}
      </DialogContent>
      <DialogContent sx={{ maxWidth: '100%', overflowX: 'hidden' }}>
        {photo?.authorName && (
          <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            Автор: {photo.authorName}
          </Box>
        )}
        <Box sx={{ mt: 0.5, maxHeight: '30vh', overflowY: 'auto', overflowX: 'hidden', pr: 1 }}>
          <Box
            component="p"
            sx={{
              m: 0,
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }}
          >
            {photo?.comment || 'Без комментария'}
          </Box>
        </Box>
        {photo?.comment && (
          <Box component="span" sx={{ display: 'block', mt: 1, fontSize: '0.75rem', color: 'text.secondary' }}>
            {photo.comment.length}/500 символов
          </Box>
        )}
        <Box sx={{ mt: 1, display: 'flex' }}>
          <Button
            variant="outlined"
            onClick={onClose}
            fullWidth={isMobile}
            sx={{
              textTransform: 'none',
              ml: isMobile ? 0 : 'auto',
              minWidth: isMobile ? 0 : 180,
            }}
          >
            Закрыть
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoViewerDialog;
