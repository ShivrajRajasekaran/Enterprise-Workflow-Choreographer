import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import App from './App';
import { SocketProvider } from './context/SocketContext';
import { IncidentProvider } from './context/IncidentContext';

// IBM-inspired theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0f62fe', // IBM Blue
      light: '#4589ff',
      dark: '#0043ce',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#6929c4', // IBM Purple
      light: '#8a3ffc',
      dark: '#491d8b',
    },
    success: {
      main: '#198038',
      light: '#24a148',
      dark: '#0e6027',
    },
    warning: {
      main: '#f1c21b',
      light: '#fddc69',
      dark: '#d2a106',
    },
    error: {
      main: '#da1e28',
      light: '#fa4d56',
      dark: '#a2191f',
    },
    info: {
      main: '#0072c3',
      light: '#1192e8',
      dark: '#00539a',
    },
    background: {
      default: '#f4f4f4',
      paper: '#ffffff',
    },
    text: {
      primary: '#161616',
      secondary: '#525252',
    },
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 600,
      fontSize: '2.5rem',
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
    },
    h4: {
      fontWeight: 500,
      fontSize: '1.5rem',
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 500,
      fontSize: '1rem',
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SocketProvider>
          <IncidentProvider>
            <App />
            <ToastContainer
              position="top-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
            />
          </IncidentProvider>
        </SocketProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
