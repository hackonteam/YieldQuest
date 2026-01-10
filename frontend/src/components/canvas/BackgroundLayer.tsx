import villageBackground from "@/assets/village-background.png";
import { currentOverlay } from "@/lib/timeOfDay";

export function BackgroundLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background image with time-based filter */}
      <img 
        src={villageBackground}
        alt="YieldQuest Village"
        className="w-full h-full object-cover"
        style={{ filter: currentOverlay.filter }}
        onError={(e) => {
          console.error("Failed to load background image");
          e.currentTarget.style.display = "none";
        }}
      />
      
      {/* Time-of-day color overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ background: currentOverlay.gradient }}
        aria-hidden="true"
      />
      
      {/* Fallback gradient if image fails to load */}
      <div 
        className="absolute inset-0 -z-10"
        style={{
          background: "linear-gradient(180deg, hsl(30 25% 12%) 0%, hsl(30 20% 8%) 100%)"
        }}
      />
    </div>
  );
}
