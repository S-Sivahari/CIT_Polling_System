export interface Staff {
  id: string;
  username: string;
  password: string;
  department: string;
  section: string;
  name: string;
}

export interface Student {
  id: string;
  name: string;
  leetcodeId: string;
  department: string;
  section: string;
  email?: string;
  regNo?: string;
  gender?: string;
  hostelDay?: string;
  mobileNumber?: number;
  year?: number;
  codechefId?: string;
  codeforcesId?: string;
}

export interface LeetCodeProfile {
  username: string;
  realName?: string;
  ranking?: number;
  company?: string;
  school?: string;
  countryName?: string;
  userAvatar?: string;
  aboutMe?: string;
  websites?: string[];
  skillTags?: string[];
  postViewCount?: number;
  reputation?: number;
}

export interface LeetCodeStats {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  easyPercentage?: number;
  mediumPercentage?: number;
  hardPercentage?: number;
}

export interface LeetCodeContest {
  rating?: number;
  globalRanking?: number;
  attendedContestsCount: number;
  topPercentage?: number;
  badge?: {
    name: string;
  };
}

export interface LeetCodeBadge {
  id: string;
  displayName: string;
  icon: string;
  creationDate: string;
}

export interface LeetCodeData {
  profile: LeetCodeProfile;
  stats: LeetCodeStats;
  contest: LeetCodeContest;
  badges: LeetCodeBadge[];
  contestBadge?: {
    name: string;
    expired: boolean;
    hoverText: string;
    icon: string;
  };
}

export interface FetchOptions {
  includeProfile: boolean;
  includeStats: boolean;
  includeContest: boolean;
  includeBadges: boolean;
  includeRanking: boolean;
}

export interface LoginFormData {
  username: string;
  password: string;
}

export interface Department {
  id: string;
  name: string;
  sections: Section[];
}

export interface Section {
  id: string;
  name: string;
  departmentId: string;
}
