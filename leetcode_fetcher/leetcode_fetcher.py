import requests
import json
from typing import Optional, Dict, Any


class LeetCodeFetcher:
    def __init__(self):
        self.base_url = "https://leetcode.com/graphql"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/json',
            'Referer': 'https://leetcode.com'
        }

    def fetch_user_stats(self, username: str) -> Optional[Dict[str, Any]]:
        """
        Fetch comprehensive user statistics from LeetCode
        """
        # Query for basic user profile and problem stats
        profile_query = {
            "query": """
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
            """,
            "variables": {"username": username}
        }

        # Query for contest rating
        contest_query = {
            "query": """
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
                    userContestRankingHistory(username: $username) {
                        attended
                        trendDirection
                        problemsSolved
                        totalProblems
                        finishTimeInSeconds
                        rating
                        ranking
                        contest {
                            title
                            startTime
                        }
                    }
                }
            """,
            "variables": {"username": username}
        }

        # Query for badges
        badges_query = {
            "query": """
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
            """,
            "variables": {"username": username}
        }

        try:
            # Fetch all data
            profile_response = requests.post(self.base_url, json=profile_query, headers=self.headers, timeout=10)
            contest_response = requests.post(self.base_url, json=contest_query, headers=self.headers, timeout=10)
            badges_response = requests.post(self.base_url, json=badges_query, headers=self.headers, timeout=10)

            if profile_response.status_code != 200:
                print(f"Error fetching profile: {profile_response.status_code}")
                return None

            profile_data = profile_response.json()
            contest_data = contest_response.json() if contest_response.status_code == 200 else {
                "data": {"userContestRanking": None}}
            # Convert contest globalRanking to int if present
            contest_info = contest_data.get('data', {}).get('userContestRanking')
            if contest_info and 'globalRanking' in contest_info and contest_info['globalRanking'] is not None:
                try:
                    contest_info['globalRanking'] = int(float(contest_info['globalRanking']))
                except Exception:
                    pass
                    
            # Round the rating to 2 decimal places if present
            if contest_info and 'rating' in contest_info and contest_info['rating'] is not None:
                try:
                    contest_info['rating'] = round(float(contest_info['rating']), 2)
                except Exception:
                    pass
            badges_data = badges_response.json() if badges_response.status_code == 200 else {
                "data": {"matchedUser": {"badges": []}}}

            # Check if user exists
            if not profile_data.get('data', {}).get('matchedUser'):
                print(f"User '{username}' not found!")
                return None

            return {
                'profile': profile_data['data']['matchedUser'],
                'contest': contest_data['data'],
                'badges': badges_data['data']['matchedUser'] if badges_data.get('data', {}).get('matchedUser') else {}
            }

        except requests.exceptions.RequestException as e:
            print(f"Network error: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error: {e}")
            return None

    def display_user_stats(self, username: str):
        """
        Fetch and display user statistics in a formatted way
        """
        print(f"🔍 Fetching data for user: {username}")
        print("=" * 60)

        data = self.fetch_user_stats(username)
        if not data:
            return

        profile = data['profile']
        contest_info = data['contest'].get('userContestRanking') if data['contest'] else None
        badges_info = data['badges'] if data['badges'] else {}

        # Basic Profile Info
        print("👤 PROFILE INFORMATION")
        print("-" * 30)
        print(f"Username: {profile['username']}")
        if profile.get('profile'):
            p = profile['profile']
            if p.get('realName'):
                print(f"Real Name: {p['realName']}")
            if p.get('ranking'):
                print(f"Global Ranking: #{p['ranking']:,}")
            if p.get('company'):
                print(f"Company: {p['company']}")
            if p.get('school'):
                print(f"School: {p['school']}")
            if p.get('countryName'):
                print(f"Country: {p['countryName']}")

        print()

        # Problems Solved Stats
        print("📊 PROBLEMS SOLVED")
        print("-" * 30)

        if profile.get('submitStatsGlobal', {}).get('acSubmissionNum'):
            total_solved = 0
            easy_solved = 0
            medium_solved = 0
            hard_solved = 0

            for stat in profile['submitStatsGlobal']['acSubmissionNum']:
                difficulty = stat['difficulty']
                count = stat['count']
                total_solved += count

                if difficulty == "Easy":
                    easy_solved = count
                elif difficulty == "Medium":
                    medium_solved = count
                elif difficulty == "Hard":
                    hard_solved = count

            print(f"Total Problems Solved: {total_solved}")
            print(f"Easy: {easy_solved}")
            print(f"Medium: {medium_solved}")
            print(f"Hard: {hard_solved}")

            # Problem solving percentages
            if profile.get('problemsSolvedBeatsStats'):
                print("\n📈 PERFORMANCE PERCENTILES")
                print("-" * 30)
                for stat in profile['problemsSolvedBeatsStats']:
                    difficulty = stat['difficulty']
                    percentage = stat['percentage']
                    if percentage is not None:
                        print(f"{difficulty}: Beats {percentage:.1f}% of users")

        print()

        # Contest Rating
        print("🏆 CONTEST INFORMATION")
        print("-" * 30)

        if contest_info:
            print(f"Contest Rating: {contest_info.get('rating', 'N/A')}")
            print(f"Global Ranking: #{contest_info.get('globalRanking', 'N/A'):,}" if contest_info.get(
                'globalRanking') else "Global Ranking: N/A")
            print(f"Contests Attended: {contest_info.get('attendedContestsCount', 0)}")
            if contest_info.get('topPercentage'):
                print(f"Top {contest_info['topPercentage']:.2f}%")

            # Contest badge
            if contest_info.get('badge') and contest_info.get('badge', {}).get('name'):
                print(f"Contest Badge: {contest_info['badge']['name']}")
        else:
            print("No contest data available")

        print()

        # Badges
        print("🏅 BADGES")
        print("-" * 30)

        # Contest badge from profile
        if profile.get('contestBadge'):
            badge = profile['contestBadge']
            status = "Expired" if badge.get('expired') else "Active"
            print(f"Contest Badge: {badge.get('name', 'N/A')} ({status})")

        # Active badge
        if badges_info.get('activeBadge'):
            print(f"Active Badge: {badges_info['activeBadge'].get('displayName', 'N/A')}")

        # All badges
        if badges_info.get('badges'):
            print(f"Total Badges: {len(badges_info['badges'])}")
            if badges_info['badges']:
                print("Badge List:")
                for badge in badges_info['badges'][:5]:  # Show first 5 badges
                    badge_name = badge.get('displayName', 'Unknown Badge')
                    creation_date = badge.get('creationDate', 'Unknown Date')
                    print(f"  • {badge_name} (Earned: {creation_date})")

                if len(badges_info['badges']) > 5:
                    print(f"  ... and {len(badges_info['badges']) - 5} more badges")
        else:
            print("No badges earned yet")


# Usage example
def main():
    fetcher = LeetCodeFetcher()

    # Get username from user
    username = input("Enter LeetCode username: ").strip()

    if not username:
        print("Please provide a valid username!")
        return

    fetcher.display_user_stats(username)


if __name__ == "__main__":
    main()

