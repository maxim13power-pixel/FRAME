// frontend/src/components/PhotoCaptureDialog.tsx
// ⭐ №228: модалка «Сделать фото / из галереи» с комментарием к каждому фото.
// Фото сжимаются на клиенте (photoCompress) — на сервер уходят ~300–400 КБ.
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, LinearProgress, Stack, TextField, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import { preparePhoto, formatFileSize } from '../utils/photoCompress';
import type { PreparedPhoto } from '../utils/photoCompress';
import { uploadMaterialPhoto } from '../services/photoService';
import { getApiErrorMessage } from '../utils/errors';

const MAX_PHOTOS_PER_UPLOAD = 10;

interface QueueItem {
  key: string;
  prepared: PreparedPhoto;
  comment: string;
  status: 'ready' | 'uploading' | 'error';
  progress: number;
  error?: string;
}

interface Props {
  open: boolean;
  materialId: number;
  materialName: string;
  onClose: () => void;
  /** Вызывается после успешной загрузки хотя бы одного фото. */
  onUploaded: () => void;
}

const PhotoCaptureDialog: React.FC<Props> = ({
  open, materialId, materialName, onClose, onUploaded,
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  // objectURL превью нужно освобождать — храним актуальный список для cleanup
  const urlsRef = useRef<string[]>([]);

  const revokeAll = () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = [];
  };

  useEffect(() => {
    if (!open) {
      revokeAll();
      setItems([]);
      setError('');
      setPreparing(false);
      setUploading(false);
    }
  }, [open]);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    const free = MAX_PHOTOS_PER_UPLOAD - items.length;
    if (free <= 0) {
      setError(`За один раз можно добавить не больше ${MAX_PHOTOS_PER_UPLOAD} фото`);
      return;
    }
    const chosen = Array.from(files).slice(0, free);
    setPreparing(true);
    const added: QueueItem[] = [];
    const failed: string[] = [];
    for (const file of chosen) {
      try {
        const prepared = await preparePhoto(file);
        urlsRef.current.push(prepared.previewUrl);
        added.push({
          key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          prepared,
          comment: '',
          status: 'ready',
          progress: 0,
        });
      } catch (err) {
        failed.push(`${file.name}: ${err instanceof Error ? err.message : 'ошибка'}`);
      }
    }
    setItems((prev) => [...prev, ...added]);
    setPreparing(false);
    if (failed.length > 0) {
      setError(`Не удалось обработать: ${failed.join('; ')}. Для HEIC сохраните фото как JPEG.`);
    }
  };

  const removeItem = (key: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.key === key);
      if (target) URL.revokeObjectURL(target.prepared.previewUrl);
      urlsRef.current = urlsRef.current.filter((u) => u !== target?.prepared.previewUrl);
      return prev.filter((i) => i.key !== key);
    });
  };

  const updateItem = (key: string, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  };

  const uploadAll = async () => {
    const ready = items.filter((i) => i.status !== 'error');
    if (ready.length === 0) return;
    setUploading(true);
    setError('');
    let uploaded = 0;
    for (const item of ready) {
      updateItem(item.key, { status: 'uploading', progress: 0, error: undefined });
      try {
        await uploadMaterialPhoto(materialId, {
          file: item.prepared.file,
          thumb: item.prepared.thumb,
          comment: item.comment,
          width: item.prepared.width,
          height: item.prepared.height,
          onProgress: (percent) => updateItem(item.key, { progress: percent }),
        });
        uploaded++;
        // Успешное фото убираем из очереди и освобождаем превью
        URL.revokeObjectURL(item.prepared.previewUrl);
        urlsRef.current = urlsRef.current.filter((u) => u !== item.prepared.previewUrl);
        setItems((prev) => prev.filter((i) => i.key !== item.key));
      } catch (err) {
        updateItem(item.key, {
          status: 'error',
          progress: 0,
          error: getApiErrorMessage(err, 'Не удалось загрузить фото'),
        });
      }
    }
    setUploading(false);
    if (uploaded > 0) onUploaded();
  };

  const readyCount = items.filter((i) => i.status !== 'error').length;

  return (
    <Dialog open={open} onClose={uploading ? undefined : onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        Фото: {materialName}
        <IconButton
          onClick={onClose}
          disabled={uploading}
          sx={{ position: 'absolute', right: 8, top: 8 }}
          aria-label="Закрыть"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddAPhotoIcon />}
            disabled={preparing || uploading || items.length >= MAX_PHOTOS_PER_UPLOAD}
            onClick={() => cameraRef.current?.click()}
            sx={{ flex: 1, textTransform: 'none' }}
          >
            Сделать фото
          </Button>
          <Button
            variant="outlined"
            startIcon={<PhotoLibraryIcon />}
            disabled={preparing || uploading || items.length >= MAX_PHOTOS_PER_UPLOAD}
            onClick={() => galleryRef.current?.click()}
            sx={{ flex: 1, textTransform: 'none' }}
          >
            Из галереи
          </Button>
        </Stack>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Фото сжимаются автоматически (до 1600 px, JPEG) — исходный размер не влияет на скорость.
          До {MAX_PHOTOS_PER_UPLOAD} фото за раз.
        </Typography>
        {preparing && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="caption">Готовим фото…</Typography>
          </Stack>
        )}
        {error && <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>}
        <Stack spacing={1.5}>
          {items.map((item) => (
            <Box
              key={item.key}
              sx={{ display: 'flex', gap: 1.5, p: 1, border: '1px solid #e0e0e0', borderRadius: 2 }}
            >
              <Box
                component="img"
                src={item.prepared.previewUrl}
                alt="Превью фото"
                sx={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
              />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Комментарий к фото (до 500 символов)"
                  value={item.comment}
                  onChange={(e) => updateItem(item.key, { comment: e.target.value.slice(0, 500) })}
                  disabled={item.status === 'uploading'}
                  multiline
                  maxRows={4}
                  inputProps={{ maxLength: 500 }}
                  // ⭐ №229: слитный текст без пробелов переносится, а не уезжает вправо
                  sx={{ '& textarea': { overflowWrap: 'anywhere', wordBreak: 'break-word' } }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5, gap: 1 }}>
                  {/* ⭐ №229: счётчик виден всегда — понятно, что лимит 500, а не «обрезало молча» */}
                  <Typography
                    variant="caption"
                    color={item.comment.length >= 500 ? 'warning.main' : 'text.secondary'}
                    fontWeight={item.comment.length >= 500 ? 600 : 400}
                  >
                    {formatFileSize(item.prepared.file.size)} • {item.prepared.width}×{item.prepared.height}
                    {` • ${item.comment.length}/500`}
                    {item.comment.length >= 500 ? ' — лимит' : ''}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => removeItem(item.key)}
                    disabled={item.status === 'uploading'}
                    aria-label="Убрать фото"
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
                {item.status === 'uploading' && (
                  <LinearProgress variant="determinate" value={item.progress} sx={{ mt: 0.5, borderRadius: 1 }} />
                )}
                {item.error && (
                  <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                    {item.error}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={uploading} sx={{ textTransform: 'none' }}>Отмена</Button>
        <Button
          variant="contained"
          onClick={() => void uploadAll()}
          disabled={uploading || preparing || readyCount === 0}
          sx={{ textTransform: 'none' }}
        >
          {uploading ? 'Загружаем…' : `Загрузить${readyCount > 0 ? ` (${readyCount})` : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PhotoCaptureDialog;
