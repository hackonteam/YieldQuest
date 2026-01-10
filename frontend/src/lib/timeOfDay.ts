// Time-of-day visual utilities (static per page load)

export type TimeOfDay = "dawn" | "morning" | "noon" | "afternoon" | "sunset" | "evening" | "night" | "lateNight";

// Get time-of-day category based on current hour
function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "noon";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 19) return "sunset";
  if (hour >= 19 && hour < 21) return "evening";
  if (hour >= 21 && hour < 24) return "night";
  return "lateNight"; // 0-5
}

// Background overlay styles
export const TIME_OVERLAYS: Record<TimeOfDay, { gradient: string; filter: string }> = {
  dawn: {
    gradient: "linear-gradient(180deg, rgba(255, 200, 150, 0.15) 0%, rgba(255, 180, 120, 0.1) 100%)",
    filter: "brightness(0.95) saturate(1.1)",
  },
  morning: {
    gradient: "linear-gradient(180deg, rgba(255, 250, 230, 0.1) 0%, rgba(255, 240, 200, 0.05) 100%)",
    filter: "brightness(1.05) saturate(1.05)",
  },
  noon: {
    gradient: "linear-gradient(180deg, rgba(255, 255, 240, 0.08) 0%, rgba(255, 255, 255, 0.05) 100%)",
    filter: "brightness(1.1) contrast(1.02)",
  },
  afternoon: {
    gradient: "linear-gradient(180deg, rgba(255, 230, 180, 0.1) 0%, rgba(255, 220, 160, 0.08) 100%)",
    filter: "brightness(1.02) saturate(1.08)",
  },
  sunset: {
    gradient: "linear-gradient(180deg, rgba(255, 150, 80, 0.2) 0%, rgba(255, 100, 50, 0.15) 100%)",
    filter: "brightness(0.95) saturate(1.2) sepia(0.1)",
  },
  evening: {
    gradient: "linear-gradient(180deg, rgba(80, 70, 120, 0.2) 0%, rgba(60, 50, 100, 0.25) 100%)",
    filter: "brightness(0.85) saturate(0.9)",
  },
  night: {
    gradient: "linear-gradient(180deg, rgba(30, 30, 80, 0.35) 0%, rgba(20, 20, 60, 0.4) 100%)",
    filter: "brightness(0.7) saturate(0.8) hue-rotate(-10deg)",
  },
  lateNight: {
    gradient: "linear-gradient(180deg, rgba(20, 20, 50, 0.45) 0%, rgba(10, 10, 40, 0.5) 100%)",
    filter: "brightness(0.6) saturate(0.7) hue-rotate(-15deg)",
  },
};

// Text contrast styles for sky-overlaid elements
// Bright times = dark text, Dark times = light text with glow
export const SKY_TEXT_STYLES: Record<TimeOfDay, {
  titleColor: string;
  titleShadow: string;
  subtitleColor: string;
}> = {
  dawn: {
    titleColor: "hsl(35, 90%, 55%)",
    titleShadow: "0 0 10px rgba(255, 180, 100, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3)",
    subtitleColor: "hsl(35, 30%, 80%)",
  },
  morning: {
    titleColor: "hsl(30, 80%, 25%)",
    titleShadow: "0 1px 2px rgba(255, 255, 255, 0.3)",
    subtitleColor: "hsl(30, 20%, 35%)",
  },
  noon: {
    titleColor: "hsl(30, 70%, 20%)",
    titleShadow: "0 1px 2px rgba(255, 255, 255, 0.4)",
    subtitleColor: "hsl(30, 15%, 30%)",
  },
  afternoon: {
    titleColor: "hsl(35, 75%, 30%)",
    titleShadow: "0 1px 3px rgba(255, 255, 255, 0.25)",
    subtitleColor: "hsl(35, 20%, 40%)",
  },
  sunset: {
    titleColor: "hsl(40, 95%, 60%)",
    titleShadow: "0 0 12px rgba(255, 150, 50, 0.6), 0 2px 4px rgba(0, 0, 0, 0.4)",
    subtitleColor: "hsl(40, 40%, 85%)",
  },
  evening: {
    titleColor: "hsl(45, 90%, 70%)",
    titleShadow: "0 0 15px rgba(255, 200, 100, 0.5), 0 2px 6px rgba(0, 0, 0, 0.5)",
    subtitleColor: "hsl(45, 30%, 75%)",
  },
  night: {
    titleColor: "hsl(50, 80%, 80%)",
    titleShadow: "0 0 20px rgba(255, 220, 150, 0.4), 0 2px 8px rgba(0, 0, 0, 0.6)",
    subtitleColor: "hsl(220, 20%, 70%)",
  },
  lateNight: {
    titleColor: "hsl(55, 70%, 85%)",
    titleShadow: "0 0 25px rgba(255, 230, 180, 0.35), 0 2px 10px rgba(0, 0, 0, 0.7)",
    subtitleColor: "hsl(230, 15%, 65%)",
  },
};

// Calculate once at module load (static per page load)
export const currentTimeOfDay = getTimeOfDay();
export const currentOverlay = TIME_OVERLAYS[currentTimeOfDay];
export const currentSkyTextStyle = SKY_TEXT_STYLES[currentTimeOfDay];
