import { cn } from "@/lib/utils";

interface HotspotProps {
  id: string;
  label: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

export function Hotspot({
  id,
  label,
  position,
  size,
  onClick,
  disabled = false,
  active = false,
}: HotspotProps) {
  return (
    <button
      id={id}
      data-label={label}
      className={cn(
        "hotspot",
        active && "pulse-glow border-primary/60",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: `${size.width}%`,
        height: `${size.height}%`,
      }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
    />
  );
}
