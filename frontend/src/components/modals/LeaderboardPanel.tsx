import { useState, useEffect } from "react";
import { X, Trophy, Medal, Crown, Zap } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useContracts, LeaderboardEntry } from "@/hooks/useContracts";

interface LeaderboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="w-5 h-5 text-primary" />;
    case 2:
      return <Medal className="w-5 h-5 text-muted-foreground" />;
    case 3:
      return <Medal className="w-5 h-5 text-accent" />;
    default:
      return <span className="w-5 h-5 flex items-center justify-center text-muted-foreground text-sm">{rank}</span>;
  }
};

const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function LeaderboardPanel({ isOpen, onClose }: LeaderboardPanelProps) {
  const { shortAddress, isConnected } = useWallet();
  const { stats, fetchLeaderboard, formatXp } = useContracts();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingLeaderboard(true);
      fetchLeaderboard()
        .then(setEntries)
        .finally(() => setIsLoadingLeaderboard(false));
    }
  }, [isOpen, fetchLeaderboard]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div 
        className="fixed right-0 top-0 h-full w-full max-w-md bg-card pixel-border border-l-4 border-l-primary/60 animate-slide-right overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-primary" />
            <h2 className="font-pixel text-sm text-foreground">Quest Board</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Your Stats */}
        {isConnected && (
          <div className="p-4 bg-muted/30 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-pixel text-xs text-foreground">{shortAddress}</p>
                  <p className="text-xs text-muted-foreground">Level {stats.level}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-pixel text-sm text-primary">{formatXp(stats.xp)} XP</p>
                <p className="text-xs text-muted-foreground">{stats.badgeCount} badges</p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="overflow-y-auto h-[calc(100%-140px)]">
          <div className="p-4 space-y-2">
            {isLoadingLeaderboard ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading leaderboard...</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No leaderboard data yet</p>
                <p className="text-xs text-muted-foreground mt-2">Be the first to earn XP!</p>
              </div>
            ) : (
              entries.map((entry) => (
                <div 
                  key={`${entry.user}-${entry.rank}`}
                  className={`flex items-center justify-between p-3 rounded ${
                    entry.rank <= 3 ? 'bg-muted/50' : 'bg-muted/20'
                  } hover:bg-muted/60 transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    {getRankIcon(entry.rank)}
                    <div>
                      <p className="text-sm text-foreground">{shortenAddress(entry.user)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-pixel text-xs text-primary">{formatXp(entry.xp)}</p>
                    <p className="text-[10px] text-muted-foreground">XP</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Info */}
          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Deposit into the vault and claim yield to earn XP!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
