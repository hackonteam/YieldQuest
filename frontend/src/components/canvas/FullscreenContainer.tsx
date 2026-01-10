import { useState } from "react";
import { BackgroundLayer } from "./BackgroundLayer";
import { HotspotLayer, ModalType } from "./HotspotLayer";
import { WalletHUD } from "./WalletHUD";
import { GameTitle } from "./GameTitle";
import { QuestDetailModal } from "@/components/modals/QuestDetailModal";
import { LeaderboardPanel } from "@/components/modals/LeaderboardPanel";
import { ProfileModal } from "@/components/modals/ProfileModal";
import { BadgeDisplayModal } from "@/components/modals/BadgeDisplayModal";
import { useContracts } from "@/hooks/useContracts";

export function FullscreenContainer() {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const { stats } = useContracts();

  const closeModal = () => setActiveModal(null);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      {/* Background Layer */}
      <BackgroundLayer />

      {/* Hotspot Layer */}
      <HotspotLayer 
        onOpenModal={setActiveModal} 
        activeQuest={stats.hasDeposit}
      />

      {/* HUD Elements */}
      <GameTitle />
      <WalletHUD />

      {/* Help Text */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40">
        <p className="text-xs text-muted-foreground bg-card/80 px-4 py-2 rounded">
          Click on buildings to interact • Deposit USDC to earn XP
        </p>
      </div>

      {/* Modal Overlays */}
      <QuestDetailModal
        isOpen={activeModal === "stable-vault" || activeModal === "risk-vault"}
        onClose={closeModal}
        questType={activeModal === "stable-vault" ? "safe" : "risky"}
      />

      <LeaderboardPanel
        isOpen={activeModal === "leaderboard"}
        onClose={closeModal}
      />

      <ProfileModal
        isOpen={activeModal === "profile"}
        onClose={closeModal}
      />

      <BadgeDisplayModal
        isOpen={activeModal === "badges"}
        onClose={closeModal}
      />
    </div>
  );
}
