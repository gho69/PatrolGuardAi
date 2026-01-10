
export interface PatrolLog {
  date: string; // ISO string or YYYY-MM-DD
  time: string; // HH:mm:ss
  tag: string;
  isGenerated?: boolean;
}

export interface SiteConfig {
  month: number; // 0-11
  year: number;
  roundsPerShift: number;
  tagsPerSite: number;
  nightShiftEnabled: boolean;
  dayShiftEnabled: boolean;
  nightStart: string; // HH:mm
  nightEnd: string; // HH:mm
  dayStart: string; // HH:mm
  dayEnd: string; // HH:mm
  tagNames: string[];
  tagIntervalMin: number;
  tagIntervalMax: number;
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
