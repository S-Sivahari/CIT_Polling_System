import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  TextField,
  Alert,
  Checkbox,
  FormControlLabel,
  FormGroup,
  IconButton,
  Chip,
  Paper,
  Card,
  CardHeader,
  CardContent,
  Divider,
  Tooltip,
  Stack,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
  Close as CloseIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Done as DoneIcon,
  Code as CodeIcon,
  BarChart as BarChartIcon,
  EmojiEvents as EmojiEventsIcon
} from '@mui/icons-material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Student, FetchOptions, LeetCodeData } from '../types';
import { LeetCodeService } from '../services/leetcodeService';
import { exportToCSV, generateFilename } from '../utils/csvExport';
import * as XLSX from 'xlsx';

interface FetchOptionsDialogProps {
  open: boolean;
  onClose: () => void;
  students: Student[];
  department: string;
  section: string;
}

const FetchOptionsDialog: React.FC<FetchOptionsDialogProps> = ({
  open,
  onClose,
  students,
  department,
  section
}) => {
  // Theme and responsive layout
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // State management
  const [fetchOptions, setFetchOptions] = useState<FetchOptions>({
    includeProfile: true,
    includeStats: true,
    includeContest: true,
    includeBadges: false,
    includeRanking: true
  });
  const [isFetching, setIsFetching] = useState(false);
  const [fetchedData, setFetchedData] = useState<LeetCodeData[]>([]);
  const [fetchErrors, setFetchErrors] = useState<string[]>([]);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [query, setQuery] = useState('');
  // Removed pagination in favor of a fixed-height scrollable grid
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(isMobile ? 'list' : 'grid');
  // Row selection state
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  // Failed students (for marking as red in CSV)
  const [failedStudents, setFailedStudents] = useState<string[]>([]);

  // Update view mode when screen size changes
  useEffect(() => {
    setViewMode(isMobile ? 'list' : 'grid');
  }, [isMobile]);

  const handleOptionChange = (option: keyof FetchOptions) => {
    setFetchOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  const handleFetch = async () => {
    if (students.length === 0) return;

    setIsFetching(true);
    setFetchProgress(0);
    setFetchedData([]);
    setFetchErrors([]);
    setFailedStudents([]);

    const data: LeetCodeData[] = [];
    const errors: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      try {
        const leetcodeData = await LeetCodeService.fetchUserData(student.leetcodeId);
        if (leetcodeData) {
          data.push(leetcodeData);
        } else {
          errors.push(`Failed to fetch data for ${student.name} (${student.leetcodeId})`);
          failed.push(student.leetcodeId);
        }
      } catch (error) {
        errors.push(`Error fetching data for ${student.name}: ${error}`);
        failed.push(student.leetcodeId);
      }

      setFetchProgress(((i + 1) / students.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to avoid rate limiting
    }

    setFetchedData(data);
    setFetchErrors(errors);
    setFailedStudents(failed);
    setIsFetching(false);
  };

  const handleDownload = () => {
    if (fetchedData.length > 0) {
      // Find the DataGrid element
      const grid = document.querySelector('.MuiDataGrid-root');
      if (!grid) return;

      // Get visible column field names from header cells
      const headerCells = grid.querySelectorAll('.MuiDataGrid-columnHeader:not([aria-hidden="true"])');
      let visibleFields = Array.from(headerCells).map(cell => cell.getAttribute('data-field')).filter(Boolean);
      // Remove the 'select' column (checkbox column) from export
      visibleFields = visibleFields.filter(field => field !== 'select');

      // Prepare visible columns and data
      const visibleColumns = columns.filter(col => visibleFields.includes(col.field));
      
      // Only export checked rows and separate by status
      const allSelectedRows = rows.filter(row => selectedRows.includes(row.id));
      
      const successfulRows = allSelectedRows.filter(row => row.status !== 'failed').map(row => {
        const filteredRow: Record<string, any> = {};
        visibleColumns.forEach(col => {
          filteredRow[String(col.field)] = row[col.field as keyof typeof row];
        });
        return filteredRow;
      });
      
      const failedRows = allSelectedRows.filter(row => row.status === 'failed').map(row => {
        const filteredRow: Record<string, any> = {};
        visibleColumns.forEach(col => {
          // For failed rows, only include basic info, clear stats
          const fieldName = String(col.field);
          if (['username', 'realName', 'department', 'section'].includes(fieldName)) {
            filteredRow[fieldName] = row[col.field as keyof typeof row];
          } else {
            filteredRow[fieldName] = ''; // Empty stats for failed students
          }
        });
        return filteredRow;
      });

      // Create Excel workbook
      const wb = XLSX.utils.book_new();
      
      // Prepare headers
      const csvHeader = visibleColumns.map(col => col.headerName || col.field);
      
      // Create worksheet for successful students
      if (successfulRows.length > 0) {
        const successData = [csvHeader];
        successfulRows.forEach(row => {
          successData.push(visibleFields.map(field => row[String(field)]));
        });
        
        const successWs = XLSX.utils.aoa_to_sheet(successData);
        
        // Style headers for successful students sheet
        visibleFields.forEach((_, colIndex) => {
          const headerCell = XLSX.utils.encode_cell({ c: colIndex, r: 0 });
          if (successWs[headerCell]) {
            successWs[headerCell].s = {
              font: { bold: true, color: { rgb: "FFFFFF" } },
              fill: { patternType: "solid", fgColor: { rgb: "4CAF50" } },
              alignment: { horizontal: "center" }
            };
          }
        });
        
        // Set column widths for successful students
        const colWidths = visibleFields.map(() => ({ wch: 15 }));
        successWs['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(wb, successWs, "Successfully Fetched");
      }
      
      // Create worksheet for failed students
      if (failedRows.length > 0) {
        const failedData = [csvHeader];
        failedRows.forEach(row => {
          failedData.push(visibleFields.map(field => row[String(field)]));
        });
        
        const failedWs = XLSX.utils.aoa_to_sheet(failedData);
        
        // Style headers for failed students sheet
        visibleFields.forEach((_, colIndex) => {
          const headerCell = XLSX.utils.encode_cell({ c: colIndex, r: 0 });
          if (failedWs[headerCell]) {
            failedWs[headerCell].s = {
              font: { bold: true, color: { rgb: "FFFFFF" } },
              fill: { patternType: "solid", fgColor: { rgb: "F44336" } },
              alignment: { horizontal: "center" }
            };
          }
        });
        
        // Style failed student data rows with red text
        failedRows.forEach((_, rowIndex) => {
          visibleFields.forEach((_, colIndex) => {
            const dataCell = XLSX.utils.encode_cell({ c: colIndex, r: rowIndex + 1 }); // +1 for header
            if (failedWs[dataCell]) {
              failedWs[dataCell].s = {
                font: { color: { rgb: "FF0000" }, bold: true },
                alignment: { horizontal: "left" }
              };
            }
          });
        });
        
        // Set column widths for failed students
        const colWidths = visibleFields.map(() => ({ wch: 15 }));
        failedWs['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(wb, failedWs, "Failed to Fetch");
      }
      
      // If no successful or failed data, create a summary sheet
      if (successfulRows.length === 0 && failedRows.length === 0) {
        const summaryData = [
          ['No Data Available'],
          [''],
          ['No students were selected for export.']
        ];
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
      }
      
      // Generate filename and download
      const filename = generateFilename(department, section).replace('.csv', '.xlsx');
      XLSX.writeFile(wb, filename, { 
        bookType: 'xlsx',
        cellStyles: true
      });
    }
  };

  const handleClose = () => {
    if (!isFetching) {
      onClose();
      setFetchedData([]);
      setFetchErrors([]);
      setFetchProgress(0);
      setQuery('');
    }
  };

  // Data grid columns
  const columns: GridColDef[] = useMemo(() => {
    const cols: GridColDef[] = [
      {
        field: 'select',
        headerName: '',
        width: 60,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: 'center',
        headerAlign: 'center',
        renderHeader: () => (
          <Checkbox
            checked={rows.length > 0 && selectedRows.length === rows.length}
            indeterminate={selectedRows.length > 0 && selectedRows.length < rows.length}
            onChange={() => {
              if (selectedRows.length === rows.length) {
                setSelectedRows([]);
              } else {
                setSelectedRows(rows.map(row => row.id));
              }
            }}
            size="small"
            sx={{
              color: '#475569',
              '&.Mui-checked': {
                color: '#60a5fa'
              },
              '&.MuiCheckbox-indeterminate': {
                color: '#60a5fa'
              }
            }}
          />
        ),
        renderCell: (params) => (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '100%',
            height: '100%'
          }}>
            <Checkbox
              checked={selectedRows.includes(params.row.id)}
              onChange={(e) => {
                e.stopPropagation();
                setSelectedRows(prev =>
                  prev.includes(params.row.id)
                    ? prev.filter(id => id !== params.row.id)
                    : [...prev, params.row.id]
                );
              }}
              size="small"
              sx={{
                color: '#475569',
                '&.Mui-checked': {
                  color: '#60a5fa'
                }
              }}
            />
          </Box>
        ),
      },
      { 
        field: 'username', 
        headerName: 'Username', 
  width: 150,
  minWidth: 150,
        align: 'left',
        headerAlign: 'left',
        renderCell: (params) => (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: 0.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            height: '100%',
            pl: 1
          }}>
            <CodeIcon sx={{ color: '#60a5fa', fontSize: 16 }} />
            <Typography 
              sx={{ 
                fontFamily: 'monospace', 
                fontWeight: 600,
                fontSize: '0.85rem',
                color: params.row.status === 'failed' ? '#ef4444' : '#e2e8f0'
              }}
            >
              {params.value}
            </Typography>
          </Box>
        )
      },
    ];

    if (fetchOptions.includeProfile) {
      cols.push(
        { 
          field: 'realName', 
          headerName: 'Name', 
          width: 170,
          minWidth: 170,
          align: 'left',
          headerAlign: 'left',
          renderCell: (params) => (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              height: '100%',
              pl: 1,
              width: '100%'
            }}>
              <Typography
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: params.row.status === 'failed' ? '#ef4444' : '#e2e8f0',
                  fontSize: '0.85rem'
                }}
              >
                {params.value || '-'}
              </Typography>
            </Box>
          )
        },
        { 
          field: 'department', 
          headerName: 'Dept', 
          width: 70, 
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) => (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '100%',
              height: '100%'
            }}>
              <Chip
                label={params.value === 'Computer Science' ? 'CSE' : params.value}
                size="small"
                sx={{
                  bgcolor: params.row.status === 'failed' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: params.row.status === 'failed' ? '#ef4444' : '#60a5fa',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  height: 20,
                  my: 'auto',
                  '& .MuiChip-label': {
                    px: 0.8,
                    py: 0
                  }
                }}
              />
            </Box>
          )
        },
        { 
          field: 'section', 
          headerName: 'Sec', 
          width: 70,
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) => (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '100%',
              height: '100%'
            }}>
              <Typography 
                sx={{ 
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: params.row.status === 'failed' ? '#ef4444' : '#e2e8f0',
                  textAlign: 'center'
                }}
              >
                {params.value}
              </Typography>
            </Box>
          )
        }
      );
    }

    if (fetchOptions.includeStats) {
      cols.push(
        { 
          field: 'totalSolved', 
          headerName: 'Total', 
          type: 'number', 
          width: 70,
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) => (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '100%',
              height: '100%'
            }}>
              <Typography 
                sx={{ 
                  fontWeight: 700, 
                  color: params.row.status === 'failed' ? '#ef4444' : '#60a5fa',
                  fontSize: '0.85rem',
                  textAlign: 'center'
                }}
              >
                {params.value}
              </Typography>
            </Box>
          )
        },
        { 
          field: 'easySolved', 
          headerName: 'Easy', 
          type: 'number', 
          width: 70, 
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) => (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '100%',
              height: '100%'
            }}>
              <Typography 
                sx={{ 
                  fontWeight: 600, 
                  color: '#4ade80',
                  fontSize: '0.85rem',
                  textAlign: 'center'
                }}
              >
                {params.value}
              </Typography>
            </Box>
          )
        },
        { 
          field: 'mediumSolved', 
          headerName: 'Med', 
          type: 'number', 
          width: 70, 
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) => (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '100%',
              height: '100%'
            }}>
              <Typography 
                sx={{ 
                  fontWeight: 600, 
                  color: '#facc15',
                  fontSize: '0.85rem',
                  textAlign: 'center'
                }}
              >
                {params.value}
              </Typography>
            </Box>
          )
        },
        { 
          field: 'hardSolved', 
          headerName: 'Hard', 
          type: 'number', 
          width: 70, 
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) => (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '100%',
              height: '100%'
            }}>
              <Typography 
                sx={{ 
                  fontWeight: 600, 
                  color: '#f87171',
                  fontSize: '0.85rem',
                  textAlign: 'center'
                }}
              >
                {params.value}
              </Typography>
            </Box>
          )
        }
      );
    }

    if (fetchOptions.includeContest) {
      cols.push(
        { 
          field: 'contestRating', 
          headerName: 'Rating', 
          type: 'number', 
          width: 80, 
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) => (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '100%',
              height: '100%'
            }}>
              <Box 
                sx={{ 
                  bgcolor: 'rgba(249, 115, 22, 0.15)',
                  px: 1,
                  py: 0.3,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography 
                  sx={{ 
                    fontWeight: 700, 
                    color: '#fb923c',
                    fontSize: '0.8rem'
                  }}
                >
                  {params.value || '-'}
                </Typography>
              </Box>
            </Box>
          )
        },
        { 
          field: 'globalRanking', 
          headerName: 'Rank', 
          type: 'number', 
          width: 80, 
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) => (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '100%',
              height: '100%'
            }}>
              <Typography 
                sx={{ 
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: '#e2e8f0',
                  textAlign: 'center'
                }}
              >
                {params.value || '-'}
              </Typography>
            </Box>
          )
        },
        { 
          field: 'attendedContestsCount', 
          headerName: 'Contests', 
          type: 'number', 
          width: 80, 
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) => (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '100%',
              height: '100%'
            }}>
              <Typography 
                sx={{ 
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: '#e2e8f0',
                  textAlign: 'center'
                }}
              >
                {params.value || '-'}
              </Typography>
            </Box>
          )
        },
        { 
          field: 'topPercentage', 
          headerName: 'Top %', 
          type: 'number', 
          width: 70, 
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) => (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '100%',
              height: '100%'
            }}>
              <Typography 
                sx={{ 
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: '#22c55e',
                  textAlign: 'center'
                }}
              >
                {params.value !== '-' ? `${params.value}%` : '-'}
              </Typography>
            </Box>
          )
        }
      );
    }

    return cols;
  }, [fetchOptions, selectedRows]);

        // Processed rows for the data grid
  const rows = useMemo(() => {
    const studentMap = new Map(students.map(s => [s.leetcodeId, s]));
    const base: any[] = [];

    // Add successful fetches
    fetchedData.forEach((d, i) => {
      base.push({
        id: i + 1,
        username: d.profile.username,
        realName: d.profile.realName || '',
        department: studentMap.get(d.profile.username)?.department || '',
        section: studentMap.get(d.profile.username)?.section || '',
        totalSolved: d.stats.totalSolved,
        easySolved: d.stats.easySolved,
        mediumSolved: d.stats.mediumSolved,
        hardSolved: d.stats.hardSolved,
        contestRating: d.contest.rating ? Number(d.contest.rating).toFixed(2) : '-',
        globalRanking: d.contest.globalRanking != null ? Math.trunc(d.contest.globalRanking) : '-',
        attendedContestsCount: d.contest.attendedContestsCount ?? 0,
        topPercentage: d.contest.topPercentage ? Number(d.contest.topPercentage).toFixed(2) : '-',
        status: 'success'
      });
    });

    // Add failed fetches with "Red" username and blank data
    failedStudents.forEach((leetcodeId, i) => {
      const student = studentMap.get(leetcodeId);
      if (student) {
        base.push({
          id: fetchedData.length + i + 1,
          username: leetcodeId,
          realName: student.name,
          department: student.department,
          section: student.section,
          totalSolved: '',
          easySolved: '',
          mediumSolved: '',
          hardSolved: '',
          contestRating: '',
          globalRanking: '',
          attendedContestsCount: '',
          topPercentage: '',
          status: 'failed'
        });
      }
    });

    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(r =>
      String(r.username).toLowerCase().includes(q) ||
      String(r.realName).toLowerCase().includes(q) ||
      String(r.department).toLowerCase().includes(q) ||
      String(r.section).toLowerCase().includes(q)
    );
  }, [fetchedData, failedStudents, query, students]);

  // Update selected rows when rows change (e.g., after filtering or initial load)
  useEffect(() => {
    if (rows.length > 0) {
      const validIds = rows.map(row => row.id);
      if (selectedRows.length === 0) {
        // Select all rows when data is first loaded
        setSelectedRows(validIds);
      } else {
        // Keep only valid row IDs when rows change (e.g., after filtering)
        setSelectedRows(prev => prev.filter(id => validIds.includes(id)));
      }
    } else {
      setSelectedRows([]);
    }
  }, [rows.map(r => r.id).join(','), selectedRows.length === 0]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xl"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          width: '100vw',
          maxWidth: { xs: '100vw', md: '90vw' },
          height: isMobile ? '100vh' : '90vh',
          maxHeight: isMobile ? '100vh' : '90vh',
          borderRadius: isMobile ? 0 : 2,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#0f172a',
          backgroundImage: 'radial-gradient(at 40% 20%, rgba(30, 58, 138, 0.1) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(30, 64, 175, 0.1) 0px, transparent 50%)',
        }
      }}
    >
      {/* Dialog Header */}
      <DialogTitle 
        sx={{ 
          background: 'linear-gradient(90deg, #1e40af 0%, #1e3a8a 100%)',
          px: { xs: 2, sm: 3 },
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)'
        }}
      >
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600,
            color: 'white',
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            textShadow: '0 1px 2px rgba(0,0,0,0.2)'
          }}
        >
          <RefreshIcon sx={{
            color: '#93c5fd',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
          }}/>
          Fetch LeetCode Data
        </Typography>
        <IconButton 
          onClick={handleClose} 
          disabled={isFetching}
          size="small"
          sx={{
            color: 'white',
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              transform: 'scale(1.05)'
            },
            '&.Mui-disabled': {
              color: 'rgba(255, 255, 255, 0.4)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Main Content */}
      <DialogContent 
        sx={{ 
          p: { xs: 2, sm: 3 },
          bgcolor: '#0f172a', 
          flex: 1, 
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          overflowX: 'hidden'
        }}
      >
        {/* Options and Search Row */}
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'stretch', md: 'center' },
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          {/* Data Fetch Options */}
            <Card 
              sx={{ 
                bgcolor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 2,
                display: 'flex',
                flexWrap: 'wrap',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                overflow: 'visible',
                mt: { xs: 2, sm: 3 }, // Add top margin for spacing
              }}
              elevation={0}
            >
            <Box sx={{ 
              p: 1.5,
              display: 'flex', 
              alignItems: 'center',
              gap: 0.8,
              borderRight: { xs: 'none', sm: '1px solid #334155' },
              borderBottom: { xs: '1px solid #334155', sm: 'none' },
              width: { xs: '100%', sm: 'auto' }
            }}>
              <Typography 
                sx={{ 
                  fontSize: '0.85rem', 
                  fontWeight: 600, 
                  color: '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8
                }}
              >
                <BarChartIcon sx={{ color: '#60a5fa', fontSize: '1.1rem' }} />
                Include Data:
              </Typography>
            </Box>
            
            <FormGroup 
              sx={{ 
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                p: 0.8,
              }}
            >
              {[
                { label: 'Profile', key: 'includeProfile', icon: <CodeIcon sx={{ color: '#60a5fa', fontSize: '0.95rem' }} /> },
                { label: 'Stats', key: 'includeStats', icon: <BarChartIcon sx={{ color: '#22c55e', fontSize: '0.95rem' }} /> },
                { label: 'Contest', key: 'includeContest', icon: <EmojiEventsIcon sx={{ color: '#eab308', fontSize: '0.95rem' }} /> }
              ].map((option) => (
                <FormControlLabel
                  key={option.key}
                  control={
                    <Checkbox 
                      checked={fetchOptions[option.key as keyof FetchOptions]}
                      onChange={() => handleOptionChange(option.key as keyof FetchOptions)}
                      size="small"
                      sx={{
                        color: '#475569',
                        padding: '4px',
                        '&.Mui-checked': {
                          color: '#60a5fa'
                        }
                      }}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {option.icon}
                      <Typography sx={{ fontSize: '0.8rem', color: '#e2e8f0' }}>
                        {option.label}
                      </Typography>
                    </Box>
                  }
                  sx={{ 
                    mx: 0.8,
                    '&:hover': {
                      bgcolor: 'rgba(59, 130, 246, 0.05)',
                      borderRadius: 1
                    }
                  }}
                />
              ))}
            </FormGroup>
          </Card>

          {/* Search */}
                        <TextField
            placeholder="Search results..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <Box sx={{ display: 'flex', color: '#60a5fa', mr: 1 }}>
                  <SearchIcon fontSize="small" />
                </Box>
              ),
              sx: {
                bgcolor: '#1e293b',
                borderRadius: 2,
                border: '1px solid #334155',
                color: '#e2e8f0',
                transition: 'all 0.2s ease',
                height: 42,
                '& fieldset': { border: 'none' },
                '&:hover': {
                  bgcolor: '#1e293b',
                  border: '1px solid #475569'
                },
                '&.Mui-focused': {
                  border: '1px solid #60a5fa',
                  boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)'
                },
                '& input::placeholder': {
                  color: '#64748b',
                  opacity: 0.8,
                }
              }
            }}
            sx={{ 
              width: { xs: '100%', md: 250, lg: 300 },
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: '#60a5fa'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#60a5fa'
                }
              }
            }}
          />
        </Box>

        {/* Student Selection and Progress Area */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
          {/* Left Section: Student Selection/Progress */}
          <Box sx={{ 
            width: { xs: '100%', md: 250, lg: 280 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            flexShrink: 0,
          }}>
            {/* Students Selected Card */}
            <Card
              elevation={0}
              sx={{
                bgcolor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 2,
                overflow: 'hidden',
                height: 'fit-content',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  boxShadow: '0 6px 16px rgba(0, 0, 0, 0.15)',
                }
              }}
            >
              <CardHeader
                title={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                    <Chip
                      label={students.length}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(59, 130, 246, 0.2)',
                        color: '#60a5fa',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        height: 24,
                        width: 24,
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                        '& .MuiChip-label': { px: 0 }
                      }}
                    />
                    <Typography 
                      sx={{ 
                        fontWeight: 600, 
                        color: '#e2e8f0', 
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        '&::after': {
                          content: '""',
                          display: { xs: 'none', sm: 'block' },
                          width: 3,
                          height: 3,
                          borderRadius: '50%',
                          bgcolor: '#60a5fa',
                          ml: 1.2,
                          opacity: 0.7
                        }
                      }}
                    >
                      Students Selected
                    </Typography>
                  </Box>
                }
                sx={{ 
                  p: 1.5,
                  bgcolor: 'rgba(15, 23, 42, 0.5)',
                  borderBottom: '1px solid #334155',
                  backgroundImage: 'linear-gradient(to right, rgba(30, 64, 175, 0.2), transparent)'
                }}
              />
              <CardContent sx={{ p: 1.8, pt: 1.5 }}>
                <Stack spacing={1.5}>
                  {isFetching ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <RefreshIcon sx={{
                          color: '#60a5fa',
                          fontSize: '1.1rem',
                          animation: 'spin 1.5s linear infinite',
                          '@keyframes spin': {
                            '0%': { transform: 'rotate(0deg)' },
                            '100%': { transform: 'rotate(360deg)' }
                          }
                        }} />
                        <Typography sx={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>
                          Fetching Data...
                        </Typography>
                      </Box>
                      
                      <LinearProgress 
                        variant="determinate" 
                        value={fetchProgress} 
                        sx={{ 
                          height: 6, 
                          borderRadius: 3,
                          backgroundColor: '#0f172a',
                          mb: 1,
                          '& .MuiLinearProgress-bar': {
                            backgroundImage: 'linear-gradient(to right, #3b82f6, #60a5fa)',
                            borderRadius: 3
                          }
                        }} 
                      />
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ color: '#60a5fa', fontWeight: 700, fontSize: '1rem' }}>
                          {Math.round(fetchProgress)}%
                        </Typography>
                        <Chip
                          label={`${Math.ceil(fetchProgress / 100 * students.length)}/${students.length}`}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            color: '#60a5fa',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            height: 22
                          }}
                        />
                      </Box>
                    </Box>
                  ) : (
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<RefreshIcon sx={{ fontSize: '1.1rem' }} />}
                      onClick={handleFetch}
                      size="medium"
                      sx={{ 
                        py: 1,
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                        transition: 'all 0.3s',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        letterSpacing: '0.01em',
                        height: 36,
                        '&:hover': {
                          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                          boxShadow: '0 6px 16px rgba(59, 130, 246, 0.5)',
                          transform: 'translateY(-2px)'
                        },
                        '&:active': {
                          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                          transform: 'translateY(0)'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Start Fetching
                        <Box component="span" sx={{ 
                          fontSize: '0.7rem', 
                          opacity: 0.9, 
                          bgcolor: 'rgba(255,255,255,0.2)', 
                          px: 0.7, 
                          py: 0.1, 
                          borderRadius: 0.8,
                          ml: 0.5
                        }}>
                          {students.length} students
                        </Box>
                      </Box>
                    </Button>
                  )}
                  
                  {/* Department & Section Info */}
                  <Paper
                    elevation={0}
                    sx={{
                      bgcolor: 'rgba(15, 23, 42, 0.5)',
                      p: 1,
                      borderRadius: 2,
                      border: '1px solid #334155',
                    }}
                  >
                    <Stack direction="row" spacing={1} divider={
                      <Divider orientation="vertical" flexItem sx={{ borderColor: '#334155' }} />
                    }>
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', mb: 0.3 }}>Department</Typography>
                        <Typography sx={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.85rem' }}>
                          {department === 'Computer Science' ? 'CSE' : department}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', mb: 0.3 }}>Section</Typography>
                        <Typography sx={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.85rem' }}>{section}</Typography>
                      </Box>
                    </Stack>
                  </Paper>
                  
                  {/* Error Alerts */}
                  {fetchErrors.length > 0 && (
                    <Alert 
                      severity="warning" 
                      sx={{ 
                        borderRadius: 2,
                        bgcolor: 'rgba(69, 26, 3, 0.6)',
                        color: '#fef3c7',
                        border: '1px solid #92400e',
                        '& .MuiAlert-icon': {
                          color: '#f59e0b'
                        }
                      }}
                    >
                      <Typography variant="body2" fontWeight={600}>
                        {fetchErrors.length} error{fetchErrors.length > 1 ? 's' : ''} occurred
                      </Typography>
                    </Alert>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Box>

          {/* Right Section: Results */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: -0.5 }}>
              <Typography 
                sx={{ 
                  fontWeight: 600,
                  color: '#e2e8f0',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  '&::before': {
                    content: '""',
                    display: 'inline-block',
                    width: 3,
                    height: 18,
                    bgcolor: '#3b82f6',
                    mr: 1.5,
                    borderRadius: 1
                  }
                }}
              >
                Results {fetchedData.length > 0 ? `(${fetchedData.length})` : ''}
              </Typography>
            </Box>

            {/* Results Table */}
            <Paper
              sx={{
                flex: 1,
                bgcolor: '#1e293b',
                borderRadius: 2,
                border: '1px solid #334155',
                overflow: 'hidden', 
                display: 'flex',
                flexDirection: 'column',
                minHeight: 200,
                position: 'relative',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              }}
              elevation={0}
            >
              {rows.length > 0 ? (
                <Box sx={{ height: 200, width: '100%' }}>
                  <DataGrid
                    rows={rows}
                    columns={columns}
                    disableRowSelectionOnClick
                    density="compact"
                    rowHeight={44}
                    sx={{
                      border: 'none',
                      color: '#e2e8f0',
                      overflowX: 'auto',
                      '.MuiDataGrid-main': { minHeight: 0 },
                      '.MuiDataGrid-virtualScroller': {
                        overflowY: 'auto',
                        overflowX: 'auto',
                        '&::-webkit-scrollbar': { width: 8 },
                        '&::-webkit-scrollbar-thumb': { background: '#475569', borderRadius: 4 },
                        '&::-webkit-scrollbar-thumb:hover': { background: '#60a5fa' },
                        '&::-webkit-scrollbar-track': { background: '#1e293b' }
                      },
                      '.MuiDataGrid-columnHeaders': {
                        bgcolor: 'rgba(15, 23, 42, 0.9)',
                        borderBottom: '1px solid #3b82f6',
                        color: '#93c5fd',
                        textTransform: 'uppercase',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                        minHeight: '40px !important',
                        height: '40px !important'
                      },
                      '.MuiDataGrid-cell': {
                        borderColor: 'rgba(51, 65, 85, 0.3)',
                        fontSize: '0.825rem',
                        padding: '4px 8px'
                      },
                      '.MuiDataGrid-row': { transition: 'background-color 0.2s' },
                      '.MuiDataGrid-row:hover': { bgcolor: 'rgba(59, 130, 246, 0.1)' },
                      '.MuiDataGrid-row:nth-of-type(even)': { bgcolor: 'rgba(15, 23, 42, 0.3)' },
                      '.MuiDataGrid-columnSeparator': { display: 'none' },
                      '.MuiDataGrid-footerContainer': { display: 'none' },
                      '.MuiDataGrid-overlay': { backgroundColor: 'rgba(15, 23, 42, 0.7)' }
                    }}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 200,
                    p: 4,
                    gap: 2,
                    textAlign: 'center',
                  }}
                >
                  {!isFetching && (
                    <>
                      <RefreshIcon sx={{ fontSize: 40, color: '#475569', mb: 1 }} />
                      <Typography sx={{ color: '#94a3b8', fontWeight: 500 }}>
                        No data fetched yet
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 400 }}>
                        Click the "Start Fetching" button to retrieve LeetCode data for the selected students
                      </Typography>
                    </>
                  )}
                </Box>
              )}
            </Paper>
          </Box>
        </Box>
      </DialogContent>

      {/* Dialog Footer */}
      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          bgcolor: 'rgba(15, 23, 42, 0.8)',
          borderTop: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {fetchedData.length > 0 && (
            <Chip
              icon={<DoneIcon fontSize="small" />}
              label={`${fetchedData.length} records fetched`}
              size="small"
              sx={{
                bgcolor: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#4ade80',
                '& .MuiChip-icon': {
                  color: '#4ade80',
                },
              }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {fetchedData.length > 0 && (
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              sx={{
                background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': {
                  background: 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)',
                },
              }}
            >
              Download Excel
            </Button>
          )}
          <Button
            onClick={handleClose}
            disabled={isFetching}
            variant="outlined"
            sx={{
              borderColor: 'rgba(148, 163, 184, 0.3)',
              color: '#94a3b8',
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': {
                borderColor: '#94a3b8',
                bgcolor: 'rgba(148, 163, 184, 0.05)',
              },
            }}
          >
            Close
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default FetchOptionsDialog;
