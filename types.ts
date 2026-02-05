
export interface PatrolLog {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  tag: string;
  isGenerated?: boolean;
}

export interface DayConfig {
  nightEnabled: boolean;
  dayEnabled: boolean;
  rounds: number;
}

export interface SiteConfig {
  month: number;
  year: number;
  roundsPerShift: number;
  tagsPerSite: number;
  nightShiftEnabled: boolean;
  dayShiftEnabled: boolean;
  nightStart: string;
  nightEnd: string;
  dayStart: string;
  dayEnd: string;
  tagNames: string[];
  tagIntervalMin: number;
  tagIntervalMax: number;
  // Nuove opzioni weekend
  saturdayConfig: DayConfig;
  sundayConfig: DayConfig;
}

export interface ReportData {
  logs: PatrolLog[];
  summary: {
    totalLogs: number;
    importedCount: number;
    generatedCount: number;
    totalRounds: number;
  };
}
