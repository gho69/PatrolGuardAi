
export interface PatrolLog {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  tag: string;
  isGenerated?: boolean;
}

export interface DayConfig {
  nightEnabled: boolean;
  day1Enabled: boolean;
  day2Enabled: boolean;
  rounds: number;
  nightRounds?: number;
  day1Rounds?: number;
  day2Rounds?: number;
}

export interface CustomRoundSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  enabled: boolean;
  daysFilter?: 'all' | 'weekdays' | 'weekend';
}

export interface SiteConfig {
  month: number;
  year: number;
  roundsPerShift: number;
  tagsPerSite: number;
  nightShiftEnabled: boolean;
  dayShift1Enabled: boolean;
  dayShift2Enabled: boolean;
  nightStart: string;
  nightEnd: string;
  dayShift1Start: string;
  dayShift1End: string;
  dayShift2Start: string;
  dayShift2End: string;
  tagNames: string[];
  tagIntervalMin: number;
  tagIntervalMax: number;
  // Nuove opzioni weekend
  saturdayConfig: DayConfig;
  sundayConfig: DayConfig;
  // Fasce orarie specifiche per singoli giri ed aperture
  customRoundSlotsEnabled?: boolean;
  customRoundSlots?: CustomRoundSlot[];
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
