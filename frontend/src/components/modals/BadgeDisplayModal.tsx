import { X, Award, Shield, Star, Crown, Gem, Sparkles, Lock } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useContracts } from "@/hooks/useContracts";
import { BADGE_TYPES, BADGE_NAMES, BADGE_DESCRIPTIONS } from "@/lib/contracts";

interface BadgeDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Badge visual configuration mapped to contract badge types
const BADGE_VISUALS: Record<number, { icon: typeof Shield; color: string; bgColor: string }> = {
  [BADGE_TYPES.EARLY_ADOPTER]: {
    icon: Sparkles,
    color: "text-xp-glow",
    bgColor: "bg-xp-bar/20",
  },
  [BADGE_TYPES.FIRST_DEPOSIT]: {
    icon: Shield,
    color: "text-success",
    bgColor: "bg-success/20",
  },
  [BADGE_TYPES.LEVEL_5]: {
    icon: Star,
    color: "text-accent",
    bgColor: "bg-accent/20",
  },
  [BADGE_TYPES.LEVEL_10]: {
    icon: Crown,
    color: "text-primary",
    bgColor: "bg-primary/20",
  },
  [BADGE_TYPES.YIELD_MASTER]: {
    icon: Gem,
    color: "text-foreground",
    bgColor: "bg-foreground/10",
  },
};

export function BadgeDisplayModal({ isOpen, onClose }: BadgeDisplayModalProps) {
  const { isConnected } = useWallet();
  const { stats } = useContracts();

  if (!isOpen) return null;

  // Get all badge types and check which are unlocked
  const allBadgeTypes = Object.values(BADGE_TYPES);
  const unlockedBadges = new Set(stats.badges);

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div 
        className="relative bg-card rounded-sm pixel-border max-w-lg w-full mx-4 animate-scale-in max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 text-primary" />
            <div>
              <h2 className="font-pixel text-sm text-foreground">Trophy Shelf</h2>
              <p className="text-xs text-muted-foreground">{stats.badgeCount} badges earned</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Badge Grid */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isConnected ? (
            <div className="grid grid-cols-2 gap-4">
              {allBadgeTypes.map((badgeType) => {
                const isUnlocked = unlockedBadges.has(badgeType);
                const visual = BADGE_VISUALS[badgeType] || BADGE_VISUALS[BADGE_TYPES.FIRST_DEPOSIT];
                const Icon = visual.icon;
                const name = BADGE_NAMES[badgeType] || `Badge ${badgeType}`;
                const description = BADGE_DESCRIPTIONS[badgeType] || "A special achievement badge";
                
                return (
                  <div
                    key={badgeType}
                    className={`badge-card ${!isUnlocked && 'opacity-50'}`}
                  >
                    <div className={`w-12 h-12 rounded-full ${visual.bgColor} flex items-center justify-center mx-auto mb-3`}>
                      {isUnlocked ? (
                        <Icon className={`w-6 h-6 ${visual.color}`} />
                      ) : (
                        <Lock className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <h3 className={`font-pixel text-[10px] text-center ${isUnlocked ? visual.color : 'text-muted-foreground'}`}>
                      {name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground text-center mt-1">
                      {description}
                    </p>
                    {isUnlocked && (
                      <div className="absolute top-2 right-2">
                        <div className="w-3 h-3 bg-success rounded-full" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Award className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Connect your wallet to view your badges</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Badges are soulbound NFTs - proof of your achievements forever on-chain!
          </p>
        </div>
      </div>
    </div>
  );
}
