import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import LogoutIcon from '@mui/icons-material/Logout';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import SchoolIcon from '@mui/icons-material/School';
import GroupIcon from '@mui/icons-material/Group';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { Staff, Student } from '../types';
import { DatabaseService } from '../services/databaseService';
import FetchOptionsDialog from './FetchOptionsDialog';
import StudentList from './StudentList';

interface DashboardProps {
  staff: Staff;
  onLogout: () => void;
}

const drawerWidth = 240;

const Dashboard: React.FC<DashboardProps> = ({ staff, onLogout }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isFetching] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        setError('');
        const staffStudents = await DatabaseService.getStudentsByStaff(staff.department, staff.section);
        setStudents(staffStudents);
      } catch (error) {
        console.error('Error fetching students:', error);
        setError('Failed to load students. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [staff]);

  const handleFetchData = () => {
    setShowOptions(true);
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box>
      <Toolbar />
      <List>
        <ListItem>
          <ListItemIcon>
            <SchoolIcon />
          </ListItemIcon>
          <ListItemText primary="Department" secondary={staff.department} />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <GroupIcon />
          </ListItemIcon>
          <ListItemText primary="Section" secondary={staff.section} />
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* App Bar */}
      <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
        <Toolbar>
          {isMobile && (
            <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontSize: { xs: '1.1rem', md: '1.25rem' } }}>
            LeetCode Staff Portal
          </Typography>
          <IconButton color="inherit" onClick={onLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Side Drawer - Mobile */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{ 
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { 
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
        >
          {drawer}
        </Drawer>
      )}

      {/* Side Drawer - Desktop */}
      <Box
        component="nav"
        sx={{ 
          width: { md: drawerWidth }, 
          flexShrink: { md: 0 },
          display: { xs: 'none', md: 'block' } 
        }}
      >
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: '1px solid rgba(255,255,255,0.05)',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Content */}
      <Box
        component="main"
        sx={{ 
          flexGrow: 1,
          p: { xs: 1, md: 3 }, 
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          backgroundColor: '#0f172a',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
              <CircularProgress size={60} />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '100%' }}>
            {/* Header Cards */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Card sx={{ boxShadow: '0 3px 15px rgba(0,0,0,0.2)', borderRadius: 2, backgroundColor: '#1e293b', minWidth: 0 }}>
                  <CardContent sx={{ 
                    minHeight: 80, 
                    display: 'flex', 
                    alignItems: 'center', 
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    py: 3,
                    px: { xs: 2, md: 3 }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-start', width: '100%' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#e2e8f0', fontSize: { xs: '1.1rem', md: '1.2rem' } }}>
                        Department:
                      </Typography>
                      <Chip 
                        label={staff.department === 'Computer Science' ? 'CSE' : staff.department} 
                        color="primary" 
                        sx={{ 
                          fontSize: '1rem', 
                          fontWeight: 600, 
                          height: 32,
                          boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
                          backgroundColor: '#3b82f6',
                          color: '#ffffff'
                        }} 
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Card sx={{ boxShadow: '0 3px 15px rgba(0,0,0,0.2)', borderRadius: 2, backgroundColor: '#1e293b', minWidth: 0 }}>
                  <CardContent sx={{ 
                    minHeight: 80, 
                    display: 'flex', 
                    alignItems: 'center',
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    py: 3,
                    px: { xs: 2, md: 3 }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-start', width: '100%' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#e2e8f0', fontSize: { xs: '1.1rem', md: '1.2rem' } }}>
                        Section:
                      </Typography>
                      <Chip 
                        label={staff.section} 
                        color="secondary" 
                        sx={{ 
                          fontSize: '1rem', 
                          fontWeight: 600, 
                          height: 32,
                          boxShadow: '0 2px 8px rgba(217,70,239,0.3)',
                          backgroundColor: '#a855f7',
                          color: '#ffffff'
                        }} 
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Box>

            {/* Action Buttons */}
            <Box>
              <Paper sx={{ p: { xs: 2.5, md: 3 }, backgroundColor: '#1e293b', boxShadow: '0 3px 15px rgba(0,0,0,0.2)', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { xs: 'stretch', md: 'center' } }}>
                  <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography variant="h6" sx={{ 
                      color: '#e2e8f0', 
                      fontSize: { xs: '1.1rem', md: '1.25rem' },
                      mb: 0,
                      fontWeight: 500,
                      letterSpacing: '0.01em',
                      textShadow: '0 0 1px rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      Total Students:
                    </Typography>
                    <Box sx={{
                      px: 1.2,
                      py: 0.25,
                      backgroundColor: 'rgba(59,130,246,0.08)',
                      borderRadius: 1.5,
                      display: 'inline-flex',
                      alignItems: 'center',
                      minWidth: 24,
                      height: 24,
                      justifyContent: 'center',
                      transition: 'all 0.2s ease-in-out',
                      border: '1px solid rgba(59,130,246,0.2)'
                    }}>
                      <Typography sx={{
                        color: '#4f9bff',
                        fontWeight: 700,
                        fontSize: '1rem',
                        textShadow: '0 0 10px rgba(79,155,255,0.8), 0 0 20px rgba(59,130,246,0.4)',
                        animation: 'pulse 1.5s infinite alternate',
                        '@keyframes pulse': {
                          '0%': {
                            textShadow: '0 0 10px rgba(79,155,255,0.8), 0 0 20px rgba(59,130,246,0.4)'
                          },
                          '100%': {
                            textShadow: '0 0 12px rgba(79,155,255,0.9), 0 0 24px rgba(59,130,246,0.5)'
                          }
                        }
                      }}>{students.length}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', md: 'row' }, width: { xs: '100%', md: 'auto' } }}>
                    <Button
                      variant="contained"
                      startIcon={
                        <RefreshIcon sx={{
                          animation: isFetching ? 'spin 1.5s linear infinite' : 'none',
                          '@keyframes spin': {
                            '0%': { transform: 'rotate(0deg)' },
                            '100%': { transform: 'rotate(360deg)' }
                          }
                        }} />
                      }
                      onClick={handleFetchData}
                      disabled={isFetching}
                      fullWidth={isMobile}
                      size="large"
                      sx={{
                        backgroundColor: '#3b82f6',
                        backgroundImage: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                        boxShadow: '0 4px 12px rgba(30,64,175,0.4), 0 1px 3px rgba(0,0,0,0.3)',
                        fontSize: { xs: '0.95rem', md: '1rem' },
                        fontWeight: 600,
                        letterSpacing: '0.01em',
                        py: 1.5,
                        px: { xs: 2, md: 3 },
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
                        },
                        '&.Mui-disabled': {
                          backgroundColor: '#3b82f6',
                          opacity: 0.5,
                          color: 'rgba(255,255,255,0.6)'
                        }
                      }}
                    >
                      {isFetching ? 'Fetching Data...' : 'Fetch LeetCode Data'}
                    </Button>
                  </Box>
                </Box>
              </Paper>
            </Box>

            {/* Student List */}
            <Box sx={{ minWidth: 0, maxWidth: '100%', mb: 4 }}>
              <StudentList students={students} />
            </Box>
          </Box>
          )}
        </Container>
      </Box>

      <FetchOptionsDialog
        open={showOptions}
        onClose={() => setShowOptions(false)}
        students={students}
        department={staff.department}
        section={staff.section}
      />
    </Box>
  );
};

export default Dashboard;
