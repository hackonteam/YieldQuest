import { X, User, Zap, Trophy, Coins } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useContracts } from "@/hooks/useContracts";
import { Button } from "@/components/ui/button";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { isConnected, shortAddress, address, disconnect } = useWallet();
  const { stats, formatUsdc, formatXp } = useContracts();

  if (!isOpen) return null;

  const xpProgress = stats.xpToNextLevel > 0n && stats.xp > 0n
    ? Number((stats.currentLevelXp * 100n) / stats.xpToNextLevel)
    : 0;

  const hasActiveXp = stats.xp > 0n;

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div 
        className="relative bg-card rounded-sm pixel-border max-w-md w-full mx-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-primary" />
            <h2 className="font-pixel text-sm text-foreground">Adventurer Profile</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isConnected ? (
            <>
              {/* Avatar & Address */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center pixel-border">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="font-pixel text-sm text-foreground">{shortAddress}</p>
                  <p className="text-xs text-muted-foreground mt-1">Level {stats.level} Adventurer</p>
                </div>
              </div>

              {/* Achieved Level (Lifetime) */}
              <div className="bg-primary/10 p-4 rounded border border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">Achieved Level</span>
                  </div>
                  <span className="font-pixel text-lg text-primary">Level {stats.level}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Your highest lifetime level achieved. XP resets only when no new yield is generated.
                </p>
              </div>

              {/* Current XP Progress (Yield-based) */}
              <div className="bg-muted/30 p-4 rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-xp-glow" />
                    <span className="text-sm text-foreground">Current XP Progress</span>
                  </div>
                  {hasActiveXp && (
                    <span className="font-pixel text-sm text-primary">{formatXp(stats.xp)} XP</span>
                  )}
                </div>
                
                {hasActiveXp ? (
                  <>
                    <div className="xp-bar mb-2">
                      <div 
                        className="xp-bar-fill" 
                        style={{ width: `${Math.min(xpProgress, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      {formatXp(stats.currentLevelXp)} / {formatXp(stats.xpToNextLevel)} to Level {stats.level + 1}
                    </p>
                  </>
                ) : (
                  <div className="bg-muted/50 p-3 rounded mt-2">
                    <p className="text-xs text-muted-foreground text-center">
                      No active yield yet.<br />
                      <span className="italic">Generate real yield to earn XP.</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 p-3 rounded flex items-center gap-3">
                  <Trophy className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-lg font-bold text-foreground">{stats.badgeCount}</p>
                    <p className="text-xs text-muted-foreground">Badges</p>
                  </div>
                </div>
                <div className="bg-muted/30 p-3 rounded flex items-center gap-3">
                  <Coins className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-lg font-bold text-foreground">{formatUsdc(stats.depositedAssets)}</p>
                    <p className="text-xs text-muted-foreground">Staked</p>
                  </div>
                </div>
              </div>

              {/* Wallet Info */}
              <div className="bg-muted/20 p-3 rounded">
                <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
                <p className="text-xs text-foreground font-mono break-all">{address}</p>
              </div>

              {/* Disconnect */}
              <Button
                onClick={disconnect}
                variant="outline"
                className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                Disconnect Wallet
              </Button>
            </>
          ) : (
            <div className="text-center py-8">
              <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Connect your wallet to view your profile</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
