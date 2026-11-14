// frontend/src/components/PhotoFeedGalleryDialog.tsx
// ⭐ №256: галерея ВСЕХ доступных фото (открывается из «Все фото · N» на Главной).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PhotoViewerDialog from './PhotoViewerDialog';
import { fetchPhotoBlob, fetchPhotoLibrary } from '../services/photoService';
import type { PhotoFeedItem } from '../services/photoService';
import { getApiErrorMessage } from '../utils/errors';

interface Props {
  open: boolean;
  onClose: () => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const PhotoFeedGalleryDialog: React.FC<Props> = ({ open, onClose }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [items, setItems] = useState<PhotoFeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<PhotoFeedItem | null>(null);
  const urlsRef = useRef<Record<number, string>>({});

  const revokeAll = useCallback(() => {
    Object.values(urlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = {};
    setThumbs({});
  }, []);

  useEffect(() => {
    if (!open) {
      revokeAll();
      setViewer(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const page = await fetchPhotoLibrary(500);
        if (cancelled) return;
        setItems(page.items);
        setTotal(page.total);
        const pairs = await Promise.all(
          page.items.map(async (photo) => {
            try {
              const blob = await fetchPhotoBlob(
                photo.id,
                photo.hasThumb ? 'thumb' : 'full',
              );
              return [photo.id, URL.createObjectURL(blob)] as const;
            } catch {
              return [photo.id, null] as const;
            }
          }),
        );
        if (cancelled) {
          pairs.forEach(([, url]) => {
            if (url) URL.revokeObjectURL(url);
          });
          return;
        }
        const next: Record<number, string> = {};
        const bad = new Set<number>();
        for (const [id, url] of pairs) {
          if (url) next[id] = url;
          else bad.add(id);
        }
        urlsRef.current = next;
        setThumbs(next);
        setFailed(bad);
      } catch (err) {
        if (!cancelled) {
          setError(
            getApiErrorMessage(err, 'Не удалось загрузить фотографии'),
          );
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, revokeAll]);

  useEffect(() => () => revokeAll(), [revokeAll]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="md"
        fullScreen={fullScreen}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6, position: 'relative' }}>
          Все фото · {total}
          <IconButton
            aria-label="Закрыть"
            onClick={onClose}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress />
            </Box>
          ) : items.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              Фотографий пока нет.
            </Typography>
          ) : (
            <>
              {total > items.length && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Показаны первые {items.length} из {total}
                </Typography>
              )}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, 1fr)',
                    sm: 'repeat(3, 1fr)',
                    md: 'repeat(4, 1fr)',
                  },
                  gap: 1.5,
                }}
              >
                {items.map((photo) => (
                  <Box
                    key={photo.id}
                    role="button"
                    tabIndex={0}
                    title={photo.materialName}
                    onClick={() => setViewer(photo)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setViewer(photo);
                      }
                    }}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 2,
                      overflow: 'hidden',
                      bgcolor: '#f5f9ff',
                      border: '1px solid #e3edf8',
                    }}
                  >
                    {thumbs[photo.id] ? (
                      <Box
                        component="img"
                        src={thumbs[photo.id]}
                        alt={photo.materialName}
                        loading="lazy"
                        sx={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          objectFit: 'cover',
                          display: 'block',
                          border: '1px solid #e0e0e0',
                          boxSizing: 'border-box',
                        }}
                      />
                    ) : failed.has(photo.id) ? (
                      <Box
                        sx={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: '#eceff1',
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Файл недоступен
                        </Typography>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CircularProgress size={20} />
                      </Box>
                    )}
                    <Box sx={{ p: 1, minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        {formatDate(photo.createdAt)}
                        {photo.authorName ? ` • ${photo.authorName}` : ''}
                      </Typography>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {photo.materialName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                        {photo.projectName} • {photo.objectName}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>

      <PhotoViewerDialog
        photo={viewer}
        materialName={viewer?.materialName ?? null}
        objectName={viewer?.objectName ?? null}
        projectName={viewer?.projectName ?? null}
        objectId={viewer?.objectId ?? null}
        projectId={viewer?.projectId ?? null}
        materialId={viewer?.materialId ?? null}
        onClose={() => setViewer(null)}
      />
    </>
  );
};

export default PhotoFeedGalleryDialog;
