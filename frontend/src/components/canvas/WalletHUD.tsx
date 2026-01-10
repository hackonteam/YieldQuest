import { useWallet } from "@/hooks/useWallet";
import { useContracts } from "@/hooks/useContracts";
import { Button } from "@/components/ui/button";
import { Wallet, Zap, Trophy, Coins } from "lucide-react";

export function WalletHUD() {
  const { isConnected, shortAddress, connect, isConnecting, isCorrectChain, switchChain } = useWallet();
  const { stats, formatUsdc, formatXp } = useContracts();

  if (!isConnected) {
    return (
      <div className="absolute top-4 right-4 z-40">
        <Button
          onClick={connect}
          disabled={isConnecting}
          className="font-pixel text-xs px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 pixel-border"
        >
          <Wallet className="w-4 h-4 mr-2" />
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </Button>
      </div>
    );
  }

  if (!isCorrectChain) {
    return (
      <div className="absolute top-4 right-4 z-40">
        <Button
          onClick={switchChain}
          className="font-pixel text-xs px-6 py-3 bg-destructive text-destructive-foreground hover:bg-destructive/90 pixel-border"
        >
          Switch to Mantle
        </Button>
      </div>
    );
  }

  const xpProgress = stats.xpToNextLevel > 0n && stats.xp > 0n
    ? Number((stats.currentLevelXp * 100n) / stats.xpToNextLevel)
    : 0;

  const hasActiveXp = stats.xp > 0n;

  return (
    <div className="absolute top-4 right-4 z-40 flex flex-col gap-3 items-end">
      {/* Wallet Address */}
      <div className="bg-card/95 px-4 py-2 rounded pixel-border flex items-center gap-2">
        <Wallet className="w-4 h-4 text-primary" />
        <span className="font-pixel text-xs text-foreground">{shortAddress}</span>
      </div>

      {/* Stats Bar */}
      <div className="bg-card/95 px-4 py-3 rounded pixel-border flex flex-col gap-2 min-w-[220px]">
        {/* Achieved Level (Lifetime) */}
        <div className="flex items-center justify-between" title="Your highest lifetime level achieved. XP resets only when no new yield is generated.">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="font-pixel text-[10px] text-foreground">Level {stats.level}</span>
          </div>
          <span className="text-[9px] text-muted-foreground italic">Achieved</span>
        </div>

        {/* Separator */}
        <div className="h-px bg-border/50" />

        {/* Current XP Progress */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-xp-glow" />
              <span className="text-[9px] text-muted-foreground">XP Progress</span>
            </div>
            {hasActiveXp && (
              <span className="font-pixel text-[9px] text-foreground">
                {formatXp(stats.currentLevelXp)} / {formatXp(stats.xpToNextLevel)}
              </span>
            )}
          </div>
          
          {hasActiveXp ? (
            <div className="xp-bar">
              <div 
                className="xp-bar-fill" 
                style={{ width: `${Math.min(xpProgress, 100)}%` }}
              />
            </div>
          ) : (
            <p className="text-[8px] text-muted-foreground/70 italic">
              No active yield yet
            </p>
          )}
        </div>

        {/* Other Stats */}
        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <div className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-muted-foreground">{stats.badgeCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <Coins className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-muted-foreground">
              {formatUsdc(stats.usdcBalance)} USDC
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
