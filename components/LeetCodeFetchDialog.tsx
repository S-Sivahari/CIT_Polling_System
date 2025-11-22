'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Search, RefreshCw, Download, CheckCircle, Code, BarChart3, Trophy, 
  AlertCircle, Users, Building, Calendar, User, Eye, EyeOff
} from 'lucide-react';
import { LeetCodeData, FetchOptions } from '@/lib/leetcode';
import { LeetCodeService } from '@/lib/leetcode';
import { Student } from '@/types/student';
import * as XLSX from 'xlsx';

interface LeetCodeFetchDialogProps {
  open: boolean;
  onClose: () => void;
  students: Student[];
  department: string;
  section: string;
}

const LeetCodeFetchDialog: React.FC<LeetCodeFetchDialogProps> = ({
  open,
  onClose,
  students,
  department,
  section
}) => {
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
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [failedStudents, setFailedStudents] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);

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
    setShowErrors(false);

    const data: LeetCodeData[] = [];
    const errors: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      
      // Check if student has LeetCode ID
      if (!student.leetcode_contest_id || student.leetcode_contest_id.trim() === '') {
        errors.push(`No LeetCode ID for ${student.name} (${student.reg_no})`);
        failed.push(student.reg_no);
        setFetchProgress(((i + 1) / students.length) * 100);
        continue;
      }

      try {
        console.log(`Fetching data for ${student.name} (${student.leetcode_contest_id})`);
        const leetcodeData = await LeetCodeService.fetchUserData(student.leetcode_contest_id.trim());
        
        if (leetcodeData && leetcodeData.profile && leetcodeData.profile.username) {
          console.log(`Successfully fetched data for ${student.name}:`, leetcodeData);
          // Store the student information with the LeetCode data for proper mapping
          const dataWithStudent = {
            ...leetcodeData,
            studentInfo: {
              reg_no: student.reg_no,
              name: student.name,
              department: student.department,
              section: student.section,
              leetcode_contest_id: student.leetcode_contest_id
            }
          };
          data.push(dataWithStudent);
        } else {
          console.log(`No data returned for ${student.name} (${student.leetcode_contest_id})`);
          errors.push(`No data found for ${student.name} (${student.leetcode_contest_id}) - User may not exist or profile is private`);
          failed.push(student.reg_no);
        }
      } catch (error) {
        console.error(`Error fetching data for ${student.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Error fetching data for ${student.name} (${student.leetcode_contest_id}): ${errorMessage}`);
        failed.push(student.reg_no);
      }

      setFetchProgress(((i + 1) / students.length) * 100);
      // Increased delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Fetch completed. Success: ${data.length}, Errors: ${errors.length}`);
    setFetchedData(data);
    setFetchErrors(errors);
    setFailedStudents(failed);
    setIsFetching(false);
    
    if (errors.length > 0) {
      setShowErrors(true);
    }
  };

  const handleDownload = () => {
    if (fetchedData.length === 0) return;

    const worksheetData = fetchedData.map((data, index) => {
      const studentInfo = (data as any).studentInfo;
      return {
        'S.No': index + 1,
        'Registration No': studentInfo?.reg_no || '',
        'Name': studentInfo?.name || '',
        'Department': studentInfo?.department || '',
        'Section': studentInfo?.section || '',
        'LeetCode Username': data.profile.username,
        'Real Name': data.profile.realName || '',
        'Total Solved': data.stats.totalSolved || 0,
        'Easy Solved': data.stats.easySolved || 0,
        'Medium Solved': data.stats.mediumSolved || 0,
        'Hard Solved': data.stats.hardSolved || 0,
        'Easy Percentage': data.stats.easyPercentage || 0,
        'Medium Percentage': data.stats.mediumPercentage || 0,
        'Hard Percentage': data.stats.hardPercentage || 0,
        'Contest Rating': Math.round(data.contest.rating || 0),
        'Global Ranking': data.contest.globalRanking || 0,
        'Attended Contests': data.contest.attendedContestsCount || 0,
        'Top Percentage': data.contest.topPercentage || 0,
        'Badge': data.contest.badge?.name || '',
        'Contest Badge': data.contestBadge?.name || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'LeetCode Data');
    
    const fileName = `LeetCode_Data_${department}_${section}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleClose = () => {
    if (!isFetching) {
      onClose();
      setFetchedData([]);
      setFetchErrors([]);
      setFetchProgress(0);
      setQuery('');
      setSelectedRows([]);
      setShowErrors(false);
    }
  };

  const rows = useMemo(() => {
    const base = fetchedData.map((data, index) => {
      // Use the stored student information
      const studentInfo = (data as any).studentInfo;
      
      console.log(`Mapping data for ${data.profile.username}:`, {
        studentInfo: studentInfo,
        profile: data.profile,
        stats: data.stats,
        contest: data.contest
      });
      
      return {
        id: index,
        reg_no: studentInfo?.reg_no || 'Unknown',
        name: studentInfo?.name || 'Unknown',
        department: studentInfo?.department || 'Unknown',
        section: studentInfo?.section || 'Unknown',
        username: data.profile.username,
        realName: data.profile.realName || '',
        totalSolved: data.stats.totalSolved || 0,
        easySolved: data.stats.easySolved || 0,
        mediumSolved: data.stats.mediumSolved || 0,
        hardSolved: data.stats.hardSolved || 0,
        easyPercentage: data.stats.easyPercentage || 0,
        mediumPercentage: data.stats.mediumPercentage || 0,
        hardPercentage: data.stats.hardPercentage || 0,
        rating: Math.round(data.contest.rating || 0),
        globalRanking: data.contest.globalRanking || 0,
        attendedContestsCount: data.contest.attendedContestsCount || 0,
        topPercentage: data.contest.topPercentage || 0,
        badge: data.contest.badge?.name || '',
        contestBadge: data.contestBadge?.name || '',
        status: 'success'
      };
    });

    // Add failed students
    failedStudents.forEach((regNo, index) => {
      const student = students.find(s => s.reg_no === regNo);
        base.push({
        id: base.length + index,
        reg_no: student?.reg_no || regNo,
        name: student?.name || 'Unknown',
        department: student?.department || '',
        section: student?.section || '',
        username: student?.leetcode_contest_id || 'N/A',
        realName: '',
        totalSolved: 0,
        easySolved: 0,
        mediumSolved: 0,
        hardSolved: 0,
        easyPercentage: 0,
        mediumPercentage: 0,
        hardPercentage: 0,
        rating: 0,
        globalRanking: 0,
        attendedContestsCount: 0,
        topPercentage: 0,
        badge: '',
        contestBadge: '',
          status: 'failed'
        });
    });

    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(r =>
      String(r.username).toLowerCase().includes(q) ||
      String(r.realName).toLowerCase().includes(q) ||
      String(r.name).toLowerCase().includes(q) ||
      String(r.department).toLowerCase().includes(q) ||
      String(r.section).toLowerCase().includes(q)
    );
  }, [fetchedData, failedStudents, query, students]);

  useEffect(() => {
    if (rows.length > 0) {
      const validIds = rows.map(row => row.id);
      if (selectedRows.length === 0) {
        setSelectedRows(validIds);
      } else {
        setSelectedRows(prev => prev.filter(id => validIds.includes(id)));
      }
    } else {
      setSelectedRows([]);
    }
  }, [rows.map(r => r.id).join(','), selectedRows.length === 0]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (open) {
      // Store original overflow style
      const originalStyle = window.getComputedStyle(document.body).overflow;
      // Prevent scrolling
      document.body.style.overflow = 'hidden';
      
      // Cleanup function to restore scrolling when modal closes
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center mobile-p z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-2xl shadow-xl w-full max-w-7xl h-[95vh] border border-slate-700 flex flex-col m-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-600">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center">
              <Code className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">LeetCode Data Fetcher</h2>
              <p className="text-sm text-slate-400">{department} {section} • {students.length} students</p>
            </div>
          </div>
          <button
          onClick={handleClose} 
          disabled={isFetching}
            className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Controls */}
          <div className="p-6 border-b border-slate-600 flex-shrink-0">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Fetch Options */}
              <div className="card flex-1">
                <div className="flex items-center space-x-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-primary-400" />
                  <h3 className="font-medium text-white">Include Data</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Profile', key: 'includeProfile', icon: <User className="w-4 h-4" /> },
                    { label: 'Stats', key: 'includeStats', icon: <BarChart3 className="w-4 h-4" /> },
                    { label: 'Contest', key: 'includeContest', icon: <Trophy className="w-4 h-4" /> }
              ].map((option) => (
                    <label key={option.key} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                      checked={fetchOptions[option.key as keyof FetchOptions]}
                      onChange={() => handleOptionChange(option.key as keyof FetchOptions)}
                        className="w-4 h-4 text-primary-600 bg-slate-700 border-slate-600 rounded focus:ring-primary-500"
                    />
                      <div className="flex items-center space-x-1 text-slate-300">
                      {option.icon}
                        <span className="text-sm">{option.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

          {/* Search */}
              <div className="card flex-1">
                <div className="flex items-center space-x-2 mb-4">
                  <Search className="w-5 h-5 text-primary-400" />
                  <h3 className="font-medium text-white">Search Results</h3>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name, username, or department..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
                    className="input-field w-full pl-10"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Fetch Button */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleFetch}
                  disabled={isFetching || students.length === 0}
                  className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                  <span>{isFetching ? 'Fetching...' : 'Start Fetching'}</span>
                </button>
                
                {fetchedData.length > 0 && (
                  <button
                    onClick={handleDownload}
                    className="btn-accent flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Excel</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-4">
                  {fetchErrors.length > 0 && (
                  <button
                    onClick={() => setShowErrors(!showErrors)}
                    className="flex items-center space-x-2 text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>{fetchErrors.length} errors</span>
                    {showErrors ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
                
                <span className="text-sm text-slate-400">
                  {students.length} students • {fetchedData.length} successful
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            {isFetching && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
                  <span>Fetching LeetCode data...</span>
                  <span>{Math.round(fetchProgress)}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-primary-500 to-accent-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${fetchProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 overflow-hidden p-6">
            {rows.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Code className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No data to display</h3>
                <p className="text-slate-400">Click "Start Fetching" to begin fetching LeetCode data</p>
              </div>
            ) : (
              <div className="space-y-4 h-full flex flex-col">
                {/* Results Table */}
                <div className="card overflow-hidden flex-1 flex flex-col">
                  <div className="overflow-y-auto flex-1 max-h-[400px]" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 #1e293b' }}>
                    <table className="min-w-full">
                      <thead className="bg-gradient-to-r from-violet-600/90 via-purple-600/90 to-fuchsia-600/90">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                            <input
                              type="checkbox"
                              checked={rows.length > 0 && selectedRows.length === rows.length}
                              onChange={() => {
                                if (selectedRows.length === rows.length) {
                                  setSelectedRows([]);
                                } else {
                                  setSelectedRows(rows.map(row => row.id));
                                }
                              }}
                              className="w-4 h-4 text-primary-600 bg-slate-700 border-slate-600 rounded focus:ring-primary-500"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Student</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">LeetCode</th>
                          {fetchOptions.includeStats && (
                            <>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Total</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Easy</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Medium</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Hard</th>
                    </>
                  )}
                          {fetchOptions.includeContest && (
                            <>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Rating</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Ranking</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Contests</th>
                            </>
                          )}
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-600">
                        {rows.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-700/50">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedRows.includes(row.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setSelectedRows(prev =>
                                    prev.includes(row.id)
                                      ? prev.filter(id => id !== row.id)
                                      : [...prev, row.id]
                                  );
                                }}
                                className="w-4 h-4 text-primary-600 bg-slate-700 border-slate-600 rounded focus:ring-primary-500"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <div className="text-sm font-medium text-white">{row.name}</div>
                                <div className="text-xs text-slate-400">{row.reg_no}</div>
                                <div className="text-xs text-slate-500">{row.department} {row.section}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2">
                                <Code className="w-4 h-4 text-primary-400" />
                                <span className="text-sm font-mono text-slate-300">{row.username}</span>
                              </div>
                              {row.realName && (
                                <div className="text-xs text-slate-400 mt-1">{row.realName}</div>
                              )}
                            </td>
                            {fetchOptions.includeStats && (
                              <>
                                <td className="px-4 py-3 text-sm text-slate-300">{row.totalSolved}</td>
                                <td className="px-4 py-3 text-sm text-green-400">{row.easySolved}</td>
                                <td className="px-4 py-3 text-sm text-yellow-400">{row.mediumSolved}</td>
                                <td className="px-4 py-3 text-sm text-red-400">{row.hardSolved}</td>
                              </>
                            )}
                            {fetchOptions.includeContest && (
                              <>
                                <td className="px-4 py-3 text-sm text-slate-300">{row.rating}</td>
                                <td className="px-4 py-3 text-sm text-slate-300">{row.globalRanking || 'N/A'}</td>
                                <td className="px-4 py-3 text-sm text-slate-300">{row.attendedContestsCount}</td>
                              </>
                            )}
                            <td className="px-4 py-3">
                              {row.status === 'success' ? (
                                <div className="flex items-center space-x-1 text-green-400">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="text-xs">Success</span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1 text-red-400">
                                  <AlertCircle className="w-4 h-4" />
                                  <span className="text-xs">Failed</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Errors Section */}
                {showErrors && fetchErrors.length > 0 && (
                  <div className="card border-red-500/30 bg-red-900/10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <h3 className="font-medium text-red-400">Fetch Errors ({fetchErrors.length})</h3>
                      </div>
                      <button
                        onClick={() => setShowErrors(false)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 #1e293b' }}>
                      {fetchErrors.map((error, index) => (
                        <div key={index} className="text-sm text-red-300 bg-red-900/20 p-3 rounded border border-red-500/20">
                          <div className="flex items-start space-x-2">
                            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                            <span className="break-words">{error}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
                      <p className="text-sm text-blue-300">
                        <strong>Common issues:</strong> LeetCode usernames are case-sensitive, profiles might be private, or the user may not exist. 
                        Check that the LeetCode IDs in your database are correct and public.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LeetCodeFetchDialog;
