import { useState } from "react";
import { X, Shield, Flame, Zap, Coins, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/hooks/useWallet";
import { useContracts } from "@/hooks/useContracts";
import { toast } from "sonner";

interface QuestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  questType: "safe" | "risky";
}

// Per canvas-ui-spec v2: Quest = ERC-4626 QuestVault deposit/withdraw
// Start Quest = deposit(), Active Quest = shares > 0, Complete Quest = withdraw()
const QUEST_CONFIG = {
  safe: {
    title: "Stable Vault",
    subtitle: "Safe Quest",
    icon: Shield,
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/50",
    description: "Deposit TestUSDC to earn stable XP through yield generation. No risk, guaranteed rewards over time.",
  },
  risky: {
    title: "Treasury Bank",
    subtitle: "High Yield Quest", 
    icon: Flame,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/50",
    description: "Higher potential yield but exposed to market conditions. Fortune favors the bold!",
  },
};

export function QuestDetailModal({ isOpen, onClose, questType }: QuestDetailModalProps) {
  const { isConnected } = useWallet();
  const { stats, deposit, withdraw, claimYield, formatUsdc, formatXp, isLoading } = useContracts();
  const [amount, setAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  if (!isOpen) return null;

  const config = QUEST_CONFIG[questType];
  const Icon = config.icon;

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setIsDepositing(true);
    try {
      await deposit(amount);
      toast.success(`Deposited ${amount} TestUSDC!`);
      setAmount("");
    } catch (error: any) {
      toast.error(error.message || "Deposit failed");
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setIsWithdrawing(true);
    try {
      await withdraw(amount);
      toast.success(`Withdrew ${amount} TestUSDC!`);
      setAmount("");
    } catch (error: any) {
      toast.error(error.message || "Withdrawal failed");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleClaimYield = async () => {
    setIsClaiming(true);
    try {
      await claimYield();
      toast.success("Yield claimed! XP has been awarded.");
    } catch (error: any) {
      toast.error(error.message || "Failed to claim yield");
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div 
        className={`relative bg-card rounded-sm pixel-border max-w-lg w-full mx-4 animate-scale-in transition-all duration-300 ${config.borderColor}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded ${config.bgColor}`}>
              <Icon className={`w-6 h-6 ${config.color}`} />
            </div>
            <div>
              <h2 className="font-pixel text-sm text-foreground">{config.title}</h2>
              <p className={`text-xs ${config.color}`}>{config.subtitle}</p>
            </div>
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
          {/* Description */}
          <p className="text-sm text-muted-foreground">{config.description}</p>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded bg-muted/50">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-xp-glow" />
                <span className="text-xs text-muted-foreground">Your Level</span>
              </div>
              <span className="font-pixel text-lg text-primary">{stats.level}</span>
            </div>
            <div className="p-3 rounded bg-muted/50">
              <div className="flex items-center gap-2 mb-1">
                <Coins className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total XP</span>
              </div>
              <span className="font-pixel text-lg text-foreground">{formatXp(stats.xp)}</span>
            </div>
          </div>

          {/* Current Deposit */}
          <div className="bg-muted/30 p-4 rounded">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Your Vault Shares</span>
              <span className="font-pixel text-sm text-primary">
                {formatUsdc(stats.vaultShares)}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Deposited Assets</span>
              <span className="text-sm text-foreground">
                {formatUsdc(stats.depositedAssets)} TestUSDC
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Pending Yield</span>
              <span className={`text-sm ${stats.pendingYield > 0n ? 'text-success font-medium' : 'text-muted-foreground'}`}>
                {formatUsdc(stats.pendingYield)} TestUSDC
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Available TestUSDC</span>
              <span className="text-sm text-foreground">
                {formatUsdc(stats.usdcBalance)} TestUSDC
              </span>
            </div>
          </div>

          {/* Actions */}
          {isConnected ? (
            <div className="space-y-4">
              {/* Deposit/Withdraw */}
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-input border-border"
                />
                <Button
                  onClick={handleDeposit}
                  disabled={isDepositing || isLoading}
                  className="bg-success text-success-foreground hover:bg-success/90"
                >
                  <ArrowUp className="w-4 h-4 mr-1" />
                  {isDepositing ? "..." : "Deposit"}
                </Button>
                <Button
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || isLoading}
                  variant="outline"
                  className="border-border"
                >
                  <ArrowDown className="w-4 h-4 mr-1" />
                  {isWithdrawing ? "..." : "Withdraw"}
                </Button>
              </div>

              {/* Claim Yield for XP - only enabled when yield exists */}
              {stats.hasDeposit && (
                <Button
                  onClick={handleClaimYield}
                  disabled={isClaiming || isLoading || stats.pendingYield === 0n}
                  className="w-full font-pixel text-xs py-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {isClaiming ? "Claiming..." : stats.pendingYield > 0n ? "Claim Yield & Earn XP" : "No Yield to Claim"}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-sm">
              Connect your wallet to interact with the vault
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
