import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Container,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { Login as LoginIcon } from '@mui/icons-material';
import { LoginFormData } from '../types';

interface LoginProps {
  onLogin: (formData: LoginFormData) => void;
  error?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, error }) => {
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '' // Keep for compatibility but won't be used
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: isMobile ? 3 : 4,
            width: '100%',
            maxWidth: 400,
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            border: '1px solid #334155'
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box 
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                mb: 2,
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.5)'
              }}
            >
              <LoginIcon sx={{ fontSize: 40, color: 'white' }} />
            </Box>
            <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#e2e8f0', fontWeight: 600 }}>
              Staff Login
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>
              Access your department's LeetCode data
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              name="username"
              type="email"
              value={formData.username}
              onChange={handleChange}
              margin="normal"
              required
              autoComplete="email"
              autoFocus
              InputLabelProps={{
                sx: { color: '#94a3b8' }
              }}
              InputProps={{
                sx: {
                  color: '#e2e8f0',
                  '&::before': { borderColor: '#475569' },
                  '&::after': { borderColor: '#3b82f6' },
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#475569'
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#60a5fa'
                  }
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: '#475569'
                  },
                  '&:hover fieldset': {
                    borderColor: '#60a5fa'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#3b82f6',
                    borderWidth: '2px'
                  }
                }
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ 
                mt: 3, 
                mb: 2,
                backgroundImage: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: '0 4px 12px rgba(59,130,246,0.3), 0 1px 3px rgba(0,0,0,0.2)',
                fontSize: '1rem',
                fontWeight: 600,
                letterSpacing: '0.01em',
                py: 1.5,
                borderRadius: '8px',
                position: 'relative',
                overflow: 'hidden',
                textTransform: 'none',
                transition: 'all 0.2s ease-in-out',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(rgba(255,255,255,0.12), rgba(255,255,255,0))',
                  opacity: 0.8
                },
                '&:hover': {
                  backgroundColor: '#1e40af',
                  backgroundImage: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 16px rgba(30,64,175,0.5), 0 2px 5px rgba(0,0,0,0.3)'
                },
                '&:active': {
                  transform: 'translateY(1px)',
                  boxShadow: '0 2px 8px rgba(30,64,175,0.5), 0 1px 2px rgba(0,0,0,0.3)'
                }
              }}
            >
              Sign In
            </Button>
          </Box>

          <Box sx={{ mt: 4, textAlign: 'center', p: 2, bgcolor: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px' }}>
            <Typography variant="body2" sx={{ color: '#94a3b8', mb: 1, fontWeight: 500 }}>
              Demo Credentials:
            </Typography>
            <Typography variant="body2" sx={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: '0.9rem' }}>
              Use your staff email to login
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;
