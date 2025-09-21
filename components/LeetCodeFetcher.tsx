import { useState, useEffect } from 'react';

interface LeetCodeData {
  profile?: any;
  stats?: any;
  contest?: any;
  // Add more specific types as needed
}

interface LeetCodeFetcherProps {
  onClose: () => void;
}

export default function LeetCodeFetcher({ onClose }: LeetCodeFetcherProps) {
  const [fetchedData, setFetchedData] = useState<LeetCodeData | null>(() => {
    // Initialize from localStorage if available
    const saved = localStorage.getItem('leetcodeFetcherData');
    return saved ? JSON.parse(saved) : null;
  });

  const [includeProfile, setIncludeProfile] = useState(true);
  const [includeStats, setIncludeStats] = useState(true);
  const [includeContest, setIncludeContest] = useState(true);

  const handleStartFetching = async () => {
    try {
      // Your fetching logic here
      const data = {
        profile: includeProfile ? await fetchProfile() : null,
        stats: includeStats ? await fetchStats() : null,
        contest: includeContest ? await fetchContest() : null,
      };

      setFetchedData(data);
      localStorage.setItem('leetcodeFetcherData', JSON.stringify(data));
    } catch (error) {
      console.error('Error fetching LeetCode data:', error);
      // Add error handling UI as needed
    }
  };

  return (
    <div className="leetcode-fetcher-wrapper" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="leetcode-fetcher-modal">
        <div className="leetcode-fetcher-content">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">LeetCode Data Fetcher</h2>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeProfile}
                  onChange={(e) => setIncludeProfile(e.target.checked)}
                  className="form-checkbox"
                />
                Profile
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeStats}
                  onChange={(e) => setIncludeStats(e.target.checked)}
                  className="form-checkbox"
                />
                Stats
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeContest}
                  onChange={(e) => setIncludeContest(e.target.checked)}
                  className="form-checkbox"
                />
                Contest
              </label>
            </div>

            {fetchedData ? (
              <div className="mt-4 space-y-4">
                {/* Render your fetched data here */}
                <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto">
                  {JSON.stringify(fetchedData, null, 2)}
                </pre>
              </div>
            ) : (
              <button 
                onClick={handleStartFetching}
                className="btn-primary w-full"
              >
                Start Fetching
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Placeholder fetch functions - replace with your actual API calls
const fetchProfile = async () => { /* Your fetch logic */ };
const fetchStats = async () => { /* Your fetch logic */ };
const fetchContest = async () => { /* Your fetch logic */ };