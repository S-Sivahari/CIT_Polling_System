import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Staff } from './types';
import { DatabaseService } from './services/databaseService';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3b82f6',
    },
    secondary: {
      main: '#a855f7',
    },
    background: {
      default: '#0f172a',
      paper: '#1e293b',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e293b',
          boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
          zIndex: 1300,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        root: {
          width: 240,
          flexShrink: 0,
          zIndex: 1200,
          position: 'relative',
        },
        paper: {
          backgroundColor: '#1e293b',
          borderRight: '1px solid #334155',
          width: 240,
          boxSizing: 'border-box',
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          '@media (min-width: 900px)': {
            paddingLeft: 24,
            paddingRight: 24,
          }
        }
      }
    },
  },
});

function App() {
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);
  const [loginError, setLoginError] = useState<string>('');

  const handleLogin = async (formData: { username: string; password: string }) => {
    try {
      // Use email as username for authentication
      const staff = await DatabaseService.authenticateStaff(formData.username);
      if (staff) {
        setCurrentStaff(staff);
        setLoginError('');
      } else {
        setLoginError('Invalid email or staff not found');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Login failed. Please try again.');
    }
  };

  const handleLogout = () => {
    setCurrentStaff(null);
    setLoginError('');
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route
            path="/"
            element={
              currentStaff ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login onLogin={handleLogin} error={loginError} />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              currentStaff ? (
                <Dashboard staff={currentStaff} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
