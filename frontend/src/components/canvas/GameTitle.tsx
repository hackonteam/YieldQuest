import { currentSkyTextStyle } from "@/lib/timeOfDay";

export function GameTitle() {
  return (
    <div className="absolute top-4 left-4 z-40">
      <h1 
        className="font-pixel text-xl tracking-wider"
        style={{ 
          color: currentSkyTextStyle.titleColor,
          textShadow: currentSkyTextStyle.titleShadow,
        }}
      >
        YieldQuest
      </h1>
      <p 
        className="text-xs mt-1"
        style={{ color: currentSkyTextStyle.subtitleColor }}
      >
        DeFi Yield Adventure
      </p>
    </div>
  );
}
