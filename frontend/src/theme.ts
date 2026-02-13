import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // синий
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#fff',
    },
    secondary: {
      main: '#29b6f6', // голубой
      light: '#4fc3f7',
      dark: '#0288d1',
      contrastText: '#000',
    },
    background: {
      default: '#f5f9ff', // очень светлый голубой (небесный)
      paper: '#ffffff',
    },
    error: {
      main: '#d32f2f', // красный для удаления
    },
    warning: {
      main: '#ed6c02', // оранжевый/жёлтый для предупреждений
    },
    success: {
      main: '#2e7d32', // зелёный для подтверждений
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 14,
    button: {
      textTransform: 'none', // убираем капслок с кнопок
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8, // скругление углов
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderWidth: 2,
          '&:hover': {
            borderWidth: 2,
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          border: '1px solid #e0e0e0', // границы ячеек таблиц
        },
        head: {
          backgroundColor: '#e3f2fd', // голубой фон заголовков
          fontWeight: 700,
        },
      },
    },
  },
});

export default theme;