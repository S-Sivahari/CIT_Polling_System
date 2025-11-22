import { LeetCodeData, FetchOptions } from '../types';
import Papa from 'papaparse';

export interface CSVRow {
  Username: string;
  RealName?: string;
  Ranking?: string;
  Company?: string;
  School?: string;
  Country?: string;
  TotalSolved?: string;
  EasySolved?: string;
  MediumSolved?: string;
  HardSolved?: string;
  EasyPercentage?: string;
  MediumPercentage?: string;
  HardPercentage?: string;
  ContestRating?: string;
  GlobalRanking?: string;
  ContestsAttended?: string;
  TopPercentage?: string;
  ContestBadge?: string;
  TotalBadges?: string;
  BadgeList?: string;
}

export const exportToCSV = (data: LeetCodeData[], options: FetchOptions, filename: string = 'leetcode_data.csv') => {
  const csvData: CSVRow[] = data.map(item => {
    const row: CSVRow = {
      Username: item.profile.username
    };

    if (options.includeProfile) {
      row.RealName = item.profile.realName || '';
      row.Company = item.profile.company || '';
      row.School = item.profile.school || '';
      row.Country = item.profile.countryName || '';
      row.Ranking = item.profile.ranking?.toString() || '';
    }

    if (options.includeStats) {
      row.TotalSolved = item.stats.totalSolved.toString();
      row.EasySolved = item.stats.easySolved.toString();
      row.MediumSolved = item.stats.mediumSolved.toString();
      row.HardSolved = item.stats.hardSolved.toString();
      row.EasyPercentage = item.stats.easyPercentage?.toFixed(2) || '';
      row.MediumPercentage = item.stats.mediumPercentage?.toFixed(2) || '';
      row.HardPercentage = item.stats.hardPercentage?.toFixed(2) || '';
    }

    if (options.includeContest) {
      row.ContestRating = item.contest.rating ? Number(item.contest.rating).toFixed(2) : '';
      row.GlobalRanking = item.contest.globalRanking?.toString() || '';
      row.ContestsAttended = item.contest.attendedContestsCount.toString();
      row.TopPercentage = item.contest.topPercentage?.toFixed(2) || '';
    }

    if (options.includeBadges) {
      row.ContestBadge = item.contestBadge?.name || '';
      row.TotalBadges = item.badges.length.toString();
      row.BadgeList = item.badges.map(b => b.displayName).join(', ');
    }

    return row;
  });

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const generateFilename = (department: string, section: string): string => {
  const date = new Date().toISOString().split('T')[0];
  return `leetcode_${department}_${section}_${date}.csv`;
};
