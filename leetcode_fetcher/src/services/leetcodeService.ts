import { LeetCodeData, LeetCodeProfile, LeetCodeStats, LeetCodeContest, LeetCodeBadge } from '../types';

// Use dev proxy path in development to avoid CORS
const BASE_URL = '/leetcode/graphql';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Content-Type': 'application/json',
  'Referer': 'https://leetcode.com'
};

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

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(query)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data?.matchedUser;
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
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.data?.userContestRanking || null;
    } catch (error) {
      console.error('Error fetching contest data:', error);
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
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const user = data.data?.matchedUser;
      
      if (!user) return [];

      const badges = user.badges || [];
      if (user.activeBadge) {
        badges.push(user.activeBadge);
      }

      return badges;
    } catch (error) {
      console.error('Error fetching badges:', error);
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
