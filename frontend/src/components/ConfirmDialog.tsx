import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import EventIcon from '@mui/icons-material/Event';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  details?: {
    currentDate: string;
    proposedDate: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  details,
  onConfirm,
  onCancel,
  confirmText = 'Да, заменить',
  cancelText = 'Отмена',
}) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          m: 2,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <WarningIcon sx={{ color: '#ff9800', fontSize: 28 }} />
        <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Typography sx={{ mb: 2, color: 'text.secondary' }}>
          {message}
        </Typography>
        
        {details && (
          <Box sx={{ 
            bgcolor: 'rgba(25, 118, 210, 0.08)', 
            p: 2, 
            borderRadius: 2,
            border: '1px solid rgba(25, 118, 210, 0.3)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <EventIcon sx={{ color: '#1976d2', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Текущая дата окончания объекта:
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 2, color: '#d32f2f' }}>
              {details.currentDate}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <EventIcon sx={{ color: '#4caf50', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Предложить новую дату:
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
              {details.proposedDate}
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button 
          onClick={onCancel} 
          variant="outlined"
          sx={{ borderRadius: 2 }}
        >
          {cancelText}
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained"
          sx={{ 
            borderRadius: 2,
            bgcolor: '#4caf50',
            '&:hover': { bgcolor: '#388e3c' },
          }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;