import React, { useMemo, useState } from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
// Removed Grid in favor of Box-based layout
import TextField from '@mui/material/TextField';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import { Student } from '../types';

interface StudentListProps {
  students: Student[];
}

const StudentList: React.FC<StudentListProps> = ({ students }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return students;
    const q = query.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.leetcodeId.toLowerCase().includes(q) ||
      s.section.toLowerCase().includes(q)
    );
  }, [students, query]);

  if (students.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: '#1e293b', borderRadius: 2 }}>
        <Typography variant="h6" color="#a5b4fc">
          No students found in this department and section.
        </Typography>
      </Paper>
    );
  }

  if (isMobile) {
    return (
      <Box sx={{ px: 1 }}>
        <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by name, LeetCode ID, or section"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'rgba(226, 232, 240, 0.7)', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{ 
              fontSize: '1rem',
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: 2,
                '&:hover fieldset': { borderColor: '#3b82f6' },
                pl: 1
              }
            }}
          />
        </Box>
        
        {/* Mobile-optimized table-like design */}
        <Paper sx={{ 
          backgroundColor: 'rgba(30, 41, 59, 0.8)', 
          borderRadius: 2, 
          overflow: 'hidden',
          boxShadow: '0 3px 15px rgba(0,0,0,0.15)'
        }}>
          {/* Table header */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: '2fr 1fr',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            p: 1.5,
            borderBottom: '2px solid rgba(59, 130, 246, 0.2)'
          }}>
            <Typography sx={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>
              Student
            </Typography>
            <Typography sx={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem', textAlign: 'center' }}>
              Details
            </Typography>
          </Box>
          
          {/* Table rows */}
          {filtered.map((student, index) => (
            <Box 
              key={student.id} 
              sx={{ 
                display: 'grid', 
                gridTemplateColumns: '2fr 1fr',
                p: 1.5, 
                borderBottom: index < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                transition: 'background-color 0.2s',
                '&:hover': { backgroundColor: 'rgba(59,130,246,0.05)' }
              }}
            >
              {/* Student name & ID column */}
              <Box sx={{ pr: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <PersonIcon sx={{ color: '#3b82f6', fontSize: 20, mr: 1 }} />
                  <Typography sx={{ 
                    color: '#e2e8f0', 
                    fontWeight: 600, 
                    fontSize: '0.95rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {student.name}
                  </Typography>
                </Box>
                <Typography sx={{ 
                  color: '#a5b4fc', 
                  fontSize: '0.85rem', 
                  fontFamily: 'monospace',
                  ml: 3.5
                }}>
                  {student.leetcodeId}
                </Typography>
              </Box>
              
              {/* Department & Section column */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                {student.department === 'Computer Science' ? (
                  <Chip 
                    size="small"
                    label="CSE"
                    sx={{ 
                      bgcolor: 'rgba(59,130,246,0.15)', 
                      color: '#3b82f6', 
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      mb: 0.75
                    }} 
                  />
                ) : (
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', mb: 0.75 }}>
                    {student.department}
                  </Typography>
                )}
                <Typography sx={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 500 }}>
                  Section {student.section}
                </Typography>
              </Box>
            </Box>
          ))}
        </Paper>
      </Box>
    );
  }

  return (
    <Paper sx={{ backgroundColor: '#1e293b', borderRadius: 2, boxShadow: '0 3px 15px rgba(0,0,0,0.2)', overflowX: 'auto' }}>
      <Box sx={{ p: 3, borderBottom: 1, borderColor: '#334155', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { xs: 'stretch', sm: 'center' }, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
          <GroupIcon sx={{ color: '#3b82f6', fontSize: 24 }} />
          <Typography variant="h6" sx={{ color: '#e2e8f0', fontSize: { xs: '1.1rem', md: '1.25rem' } }}>
            Student Directory
          </Typography>
          {filtered.length !== students.length && (
            <Chip
              size="small"
              label={`${filtered.length} of ${students.length}`}
              sx={{
                backgroundColor: 'rgba(59,130,246,0.1)',
                color: '#93c5fd',
                fontSize: '0.75rem',
                height: 24
              }}
            />
          )}
        </Box>
        <TextField
          size="small"
          placeholder="Search by name, LeetCode ID, or section"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'rgba(226, 232, 240, 0.7)', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{ 
            width: { xs: '100%', sm: 250, md: 300 },
            fontSize: '1rem',
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: '#475569' },
              '&:hover fieldset': { borderColor: '#64748b' },
              '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
              backgroundColor: 'rgba(255,255,255,0.05)',
              pl: 1
            }
          }}
        />
      </Box>
      <TableContainer sx={{ backgroundColor: '#1e293b', maxWidth: '100vw', overflowX: 'auto' }}>
        <Table sx={{ backgroundColor: '#1e293b', minWidth: 500 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: '#e2e8f0', borderBottom: '2px solid #334155', fontWeight: 'bold', fontSize: { xs: '0.95rem', md: '1rem' }, py: 2 }}>Name</TableCell>
              <TableCell sx={{ color: '#e2e8f0', borderBottom: '2px solid #334155', fontWeight: 'bold', fontSize: { xs: '0.95rem', md: '1rem' }, py: 2 }}>LeetCode ID</TableCell>
              <TableCell align="center" sx={{ color: '#e2e8f0', borderBottom: '2px solid #334155', fontWeight: 'bold', fontSize: { xs: '0.95rem', md: '1rem' }, py: 2 }}>Department</TableCell>
              <TableCell align="center" sx={{ color: '#e2e8f0', borderBottom: '2px solid #334155', fontWeight: 'bold', fontSize: { xs: '0.95rem', md: '1rem' }, py: 2 }}>Section</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((student) => (
              <TableRow 
                key={student.id} 
                hover
                sx={{ 
                  '&:hover': { backgroundColor: '#334155' },
                  '&.MuiTableRow-hover': { backgroundColor: 'transparent' },
                  borderBottom: '1px solid #334155'
                }}
              >
                <TableCell sx={{ borderBottom: 'none', color: '#e2e8f0', fontSize: { xs: '0.95rem', md: '1rem' }, py: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PersonIcon sx={{ mr: 1, color: '#3b82f6', fontSize: 24 }} />
                    {student.name}
                  </Box>
                </TableCell>
                <TableCell sx={{ borderBottom: 'none', color: '#e2e8f0', fontSize: { xs: '0.95rem', md: '1rem' }, py: 2 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#a5b4fc', fontSize: { xs: '0.95rem', md: '1rem' } }}>
                    {student.leetcodeId}
                  </Typography>
                </TableCell>
                <TableCell align="center" sx={{ borderBottom: 'none', color: '#e2e8f0', fontSize: { xs: '0.95rem', md: '1rem' }, py: 2 }}>
                  {student.department === 'Computer Science' ? (
                    <Typography variant="body2" sx={{ color: '#3b82f6', fontWeight: 700, fontSize: { xs: '0.95rem', md: '1rem' } }}>CSE</Typography>
                  ) : (
                    student.department
                  )}
                </TableCell>
                <TableCell align="center" sx={{ borderBottom: 'none', color: '#e2e8f0', fontSize: { xs: '0.95rem', md: '1rem' }, py: 2 }}>{student.section}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default StudentList;
