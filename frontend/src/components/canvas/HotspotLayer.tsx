import { Hotspot } from "./Hotspot";

export type ModalType = 
  | "stable-vault" 
  | "risk-vault" 
  | "leaderboard" 
  | "profile" 
  | "badges"
  | null;

interface HotspotLayerProps {
  onOpenModal: (modal: ModalType) => void;
  activeQuest?: boolean;
}

// Hotspot positions mapped to the village background image
const HOTSPOTS = [
  {
    id: "stable-vault",
    label: "Stable Vault (Low Risk)",
    position: { x: 5, y: 25 },
    size: { width: 20, height: 35 },
    modal: "stable-vault" as ModalType,
  },
  {
    id: "risk-vault",
    label: "Treasury Bank (High Risk)",
    position: { x: 50, y: 5 },
    size: { width: 28, height: 45 },
    modal: "risk-vault" as ModalType,
  },
  {
    id: "leaderboard",
    label: "Quest Board",
    position: { x: 35, y: 35 },
    size: { width: 10, height: 18 },
    modal: "leaderboard" as ModalType,
  },
  {
    id: "profile",
    label: "Tavern (Profile)",
    position: { x: 28, y: 5 },
    size: { width: 20, height: 40 },
    modal: "profile" as ModalType,
  },
  {
    id: "badges",
    label: "Trophy Shelf",
    position: { x: 55, y: 58 },
    size: { width: 25, height: 25 },
    modal: "badges" as ModalType,
  },
];

export function HotspotLayer({ onOpenModal, activeQuest }: HotspotLayerProps) {
  return (
    <div className="absolute inset-0" aria-label="Interactive areas">
      {HOTSPOTS.map((hotspot) => (
        <Hotspot
          key={hotspot.id}
          id={hotspot.id}
          label={hotspot.label}
          position={hotspot.position}
          size={hotspot.size}
          onClick={() => onOpenModal(hotspot.modal)}
          active={activeQuest && (hotspot.id === "stable-vault" || hotspot.id === "risk-vault")}
        />
      ))}
    </div>
  );
}
