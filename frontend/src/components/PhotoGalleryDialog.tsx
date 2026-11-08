// frontend/src/components/PhotoGalleryDialog.tsx
// ⭐ №228: галерея фото материала — группировка по датам, миниатюры,
// комментарий в 2 строки (полный — в полноэкранном просмотре), удаление.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle,
  IconButton, Stack, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  deleteMaterialPhoto,
  fetchMaterialPhotos,
  fetchPhotoBlob,
} from '../services/photoService';
import type { MaterialPhotoData } from '../services/photoService';
import { useFeedback } from '../contexts/FeedbackContext';
import { getApiErrorMessage } from '../utils/errors';

interface Props {
  open: boolean;
  materialId: number;
  materialName: string;
  onClose: () => void;
  /** Перейти к добавлению фото (родитель закроет галерею и откроет съёмку). */
  onAddPhoto: () => void;
  /** Список изменился (удаление/добавление) — обновить счётчики в Materials. */
  onChanged: () => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const dayLabel = (iso: string): string => {
  const date = new Date(iso);
  const today = new Date();
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((dayStart(today) - dayStart(date)) / 86_400_000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
};

const PhotoGalleryDialog: React.FC<Props> = ({
  open, materialId, materialName, onClose, onAddPhoto, onChanged,
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { confirm, error: notifyError } = useFeedback();
  const [photos, setPhotos] = useState<MaterialPhotoData[]>([]);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<MaterialPhotoData | null>(null);
  const [viewerUrl, setViewerUrl] = useState('');
  const [deleting, setDeleting] = useState(false);
  const urlsRef = useRef<Record<number, string>>({});

  const revokeAll = useCallback(() => {
    Object.values(urlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = {};
    setThumbs({});
    setViewerUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchMaterialPhotos(materialId);
      setPhotos(list);
      const pairs = await Promise.all(
        list.map(async (photo) => {
          try {
            const blob = await fetchPhotoBlob(photo.id, photo.hasThumb ? 'thumb' : 'full');
            return [photo.id, URL.createObjectURL(blob)] as const;
          } catch {
            return null;
          }
        }),
      );
      const next: Record<number, string> = {};
      pairs.forEach((pair) => {
        if (!pair) return;
        // старый URL этого фото (если был) освобождаем
        const prev = urlsRef.current[pair[0]];
        if (prev && prev !== pair[1]) URL.revokeObjectURL(prev);
        next[pair[0]] = pair[1];
      });
      Object.entries(urlsRef.current).forEach(([id, url]) => {
        if (!next[Number(id)]) URL.revokeObjectURL(url);
      });
      urlsRef.current = next;
      setThumbs(next);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось загрузить фото'));
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    if (!open) {
      revokeAll();
      setPhotos([]);
      setViewer(null);
      return;
    }
    void load();
    return () => revokeAll();
  }, [open, load, revokeAll]);

  const groups = useMemo(() => {
    const map = new Map<string, MaterialPhotoData[]>();
    photos.forEach((photo) => {
      const label = dayLabel(photo.createdAt);
      const bucket = map.get(label);
      if (bucket) bucket.push(photo);
      else map.set(label, [photo]);
    });
    return [...map.entries()];
  }, [photos]);

  const openViewer = async (photo: MaterialPhotoData) => {
    setViewer(photo);
    try {
      const blob = await fetchPhotoBlob(photo.id, 'full');
      setViewerUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (err) {
      notifyError(getApiErrorMessage(err, 'Не удалось открыть фото'));
    }
  };

  const closeViewer = () => {
    setViewer(null);
    setViewerUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
  };

  const removePhoto = async (photo: MaterialPhotoData) => {
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
      closeViewer();
      await load();
      onChanged();
    } catch (err) {
      notifyError(getApiErrorMessage(err, 'Не удалось удалить фото'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open && !viewer} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
          Фото: {materialName}
          <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }} aria-label="Закрыть">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
            <Button variant="contained" startIcon={<AddAPhotoIcon />} onClick={onAddPhoto} sx={{ textTransform: 'none' }}>
              Добавить фото
            </Button>
          </Stack>
          {loading && (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress />
            </Stack>
          )}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {!loading && photos.length === 0 && !error && (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              Пока нет фото. Нажмите «Добавить фото» — снять камерой или выбрать из галереи.
            </Typography>
          )}
          {groups.map(([label, list]) => (
            <Box key={label} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>{label}</Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
                  gap: 1.5,
                }}
              >
                {list.map((photo) => (
                  <Box
                    key={photo.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => void openViewer(photo)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void openViewer(photo);
                      }
                    }}
                    sx={{
                      cursor: 'pointer', borderRadius: 2, overflow: 'hidden',
                      bgcolor: '#f5f9ff', border: '1px solid #e3edf8',
                    }}
                  >
                    {thumbs[photo.id] ? (
                      <Box
                        component="img"
                        src={thumbs[photo.id]}
                        alt={photo.comment ?? 'Фото'}
                        loading="lazy"
                        sx={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <Box sx={{ width: '100%', aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CircularProgress size={20} />
                      </Box>
                    )}
                    <Box sx={{ p: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {formatDate(photo.createdAt)}
                        {photo.authorName ? ` • ${photo.authorName}` : ''}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          minHeight: '2.4em',
                        }}
                      >
                        {photo.comment || 'Без комментария'}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewer)} onClose={closeViewer} fullScreen maxWidth="lg">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={closeViewer} aria-label="Назад"><ArrowBackIcon /></IconButton>
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
            {viewer ? formatDate(viewer.createdAt) : ''}
          </Typography>
          {viewerUrl && (
            <IconButton
              component="a"
              href={viewerUrl}
              download={`photo-${viewer?.id ?? 0}.jpg`}
              aria-label="Скачать"
            >
              <DownloadIcon />
            </IconButton>
          )}
          {viewer && (
            <IconButton
              onClick={() => void removePhoto(viewer)}
              disabled={deleting}
              color="error"
              aria-label="Удалить фото"
            >
              <DeleteOutlineIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#111', minHeight: 240 }}>
          {viewerUrl ? (
            <Box
              component="img"
              src={viewerUrl}
              alt={viewer?.comment ?? 'Фото'}
              sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
            />
          ) : (
            <CircularProgress sx={{ color: '#fff' }} />
          )}
        </DialogContent>
        <DialogContent>
          {viewer?.authorName && (
            <Typography variant="caption" color="text.secondary">Автор: {viewer.authorName}</Typography>
          )}
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
            {viewer?.comment || 'Без комментария'}
          </Typography>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PhotoGalleryDialog;
