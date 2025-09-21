// LeetCode integration types and services for the main app

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

export class LeetCodeService {
  static async fetchUserData(username: string): Promise<LeetCodeData | null> {
    try {
      const [matchedUser, contestData, badgesData] = await Promise.all([
        this.fetchProfile(username),
        this.fetchContestData(username),
        this.fetchBadges(username)
      ]);

      if (!matchedUser) {
        throw new Error(`User '${username}' not found!`);
      }

      const profile: LeetCodeProfile = {
        username: matchedUser.username,
        realName: matchedUser.profile?.realName,
        ranking: matchedUser.profile?.ranking,
        company: matchedUser.profile?.company,
        school: matchedUser.profile?.school,
        countryName: matchedUser.profile?.countryName,
        userAvatar: matchedUser.profile?.userAvatar,
        aboutMe: matchedUser.profile?.aboutMe,
        websites: matchedUser.profile?.websites,
        skillTags: matchedUser.profile?.skillTags,
        postViewCount: matchedUser.profile?.postViewCount,
        reputation: matchedUser.profile?.reputation
      };

      return {
        profile,
        stats: this.extractStats(matchedUser),
        contest: contestData || { attendedContestsCount: 0 },
        badges: badgesData || [],
        contestBadge: matchedUser.contestBadge
      };
    } catch (error) {
      console.error('Error fetching LeetCode data:', error);
      return null;
    }
  }

  private static async fetchProfile(username: string): Promise<any> {
    const query = {
      query: `
        query userPublicProfile($username: String!) {
          matchedUser(username: $username) {
            contestBadge {
              name
              expired
              hoverText
              icon
            }
            username
            githubUrl
            twitterUrl
            linkedinUrl
            profile {
              ranking
              userAvatar
              realName
              aboutMe
              school
              websites
              countryName
              company
              jobTitle
              skillTags
              postViewCount
              postViewCountDiff
              reputation
              reputationDiff
            }
            problemsSolvedBeatsStats {
              difficulty
              percentage
            }
            submitStatsGlobal {
              acSubmissionNum {
                difficulty
                count
                submissions
              }
            }
          }
        }
      `,
      variables: { username }
    };

    try {
      const response = await fetch('/api/leetcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errors && data.errors.length > 0) {
        console.error('GraphQL errors:', data.errors);
        throw new Error(`GraphQL error: ${data.errors[0].message}`);
      }
      
      if (!data.data || !data.data.matchedUser) {
        console.log(`No user found for username: ${username}`);
        return null;
      }
      
      return data.data.matchedUser;
    } catch (error) {
      console.error(`Error fetching profile for ${username}:`, error);
      throw error;
    }
  }

  private static async fetchContestData(username: string): Promise<LeetCodeContest | null> {
    const query = {
      query: `
        query userContestRankingInfo($username: String!) {
          userContestRanking(username: $username) {
            attendedContestsCount
            rating
            globalRanking
            totalParticipants
            topPercentage
            badge {
              name
            }
          }
        }
      `,
      variables: { username }
    };

    try {
      const response = await fetch('/api/leetcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        console.log(`Contest data not available for ${username}: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (data.errors && data.errors.length > 0) {
        console.log(`GraphQL errors for contest data ${username}:`, data.errors);
        return null;
      }
      
      return data.data?.userContestRanking || null;
    } catch (error) {
      console.log(`Error fetching contest data for ${username}:`, error);
      return null;
    }
  }

  private static async fetchBadges(username: string): Promise<LeetCodeBadge[]> {
    const query = {
      query: `
        query userBadges($username: String!) {
          matchedUser(username: $username) {
            badges {
              id
              displayName
              icon
              creationDate
            }
            activeBadge {
              id
              displayName
              icon
            }
          }
        }
      `,
      variables: { username }
    };

    try {
      const response = await fetch('/api/leetcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        console.log(`Badges not available for ${username}: HTTP ${response.status}`);
        return [];
      }

      const data = await response.json();
      
      if (data.errors && data.errors.length > 0) {
        console.log(`GraphQL errors for badges ${username}:`, data.errors);
        return [];
      }
      
      const user = data.data?.matchedUser;
      
      if (!user) return [];

      const badges = user.badges || [];
      if (user.activeBadge) {
        badges.push(user.activeBadge);
      }

      return badges;
    } catch (error) {
      console.log(`Error fetching badges for ${username}:`, error);
      return [];
    }
  }

  private static extractStats(matchedUser: any): LeetCodeStats {
    const stats: LeetCodeStats = {
      totalSolved: 0,
      easySolved: 0,
      mediumSolved: 0,
      hardSolved: 0,
      easyPercentage: 0,
      mediumPercentage: 0,
      hardPercentage: 0
    };

    if (matchedUser.submitStatsGlobal?.acSubmissionNum) {
      for (const stat of matchedUser.submitStatsGlobal.acSubmissionNum) {
        const difficulty = stat.difficulty;
        const count = stat.count;
        
        switch (difficulty) {
          case 'Easy':
            stats.easySolved = count;
            stats.totalSolved += count;
            break;
          case 'Medium':
            stats.mediumSolved = count;
            stats.totalSolved += count;
            break;
          case 'Hard':
            stats.hardSolved = count;
            stats.totalSolved += count;
            break;
          // Ignore 'All' difficulty to avoid double counting
        }
      }
    }

    if (matchedUser.problemsSolvedBeatsStats) {
      for (const stat of matchedUser.problemsSolvedBeatsStats) {
        const difficulty = stat.difficulty;
        const percentage = stat.percentage;
        
        switch (difficulty) {
          case 'Easy':
            stats.easyPercentage = percentage;
            break;
          case 'Medium':
            stats.mediumPercentage = percentage;
            break;
          case 'Hard':
            stats.hardPercentage = percentage;
            break;
        }
      }
    }

    return stats;
  }
}
