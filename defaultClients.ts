import { ClientProfile } from './types';

export const DEFAULT_CLIENTS: ClientProfile[] = [
  {
    id: "cli_1791550059614",
    name: "ART LEGNO SNC",
    code: "VIA TOBAGI, 14 FUSIGNANO",
    notes: "1 TAG, 2 MARCATE PER NOTTE.",
    roundsPerShift: 2,
    tagsPerSite: 1,
    tagNames: [
      "Galleria Negozi Livello 0",
      "Uscite di Sicurezza Retro",
      "Parcheggio Sotterraneo Settore B"
    ],
    tagIntervalMin: 2,
    tagIntervalMax: 5,
    nightShiftEnabled: true,
    nightStart: "21:30",
    nightEnd: "06:30",
    dayShift1Enabled: false,
    dayShift1Start: "06:30",
    dayShift1End: "14:30",
    dayShift2Enabled: false,
    dayShift2Start: "14:30",
    dayShift2End: "21:30",
    saturdayConfig: {
      nightEnabled: true,
      day1Enabled: false,
      day2Enabled: false,
      rounds: 2,
      nightRounds: 2,
      day1Rounds: 1,
      day2Rounds: 1
    },
    sundayConfig: {
      nightEnabled: true,
      day1Enabled: false,
      day2Enabled: false,
      rounds: 2,
      nightRounds: 2,
      day1Rounds: 2,
      day2Rounds: 1
    },
    customRoundSlotsEnabled: true,
    customRoundSlots: [
      {
        id: "1",
        name: "Ispezione Chiusura",
        startTime: "22:00",
        endTime: "23:15",
        enabled: true,
        daysFilter: "all"
      },
      {
        id: "2",
        name: "Controllo Notturno",
        startTime: "02:00",
        endTime: "03:30",
        enabled: true,
        daysFilter: "all"
      },
      {
        id: "3",
        name: "Apertura Varchi Staff",
        startTime: "05:45",
        endTime: "06:30",
        enabled: true,
        daysFilter: "all"
      }
    ]
  },
  {
    id: "cli_1791550180899",
    name: "BANCA IFIS ISPETTIVO",
    code: "VIA GIUSEPPE MAZZINI, 49 RAVENNA",
    notes: "2 MARCATE PER NOTTE, 3 TAG.",
    roundsPerShift: 2,
    tagsPerSite: 3,
    tagNames: [
      "Galleria Negozi Livello 0",
      "Uscite di Sicurezza Retro",
      "Parcheggio Sotterraneo Settore B"
    ],
    tagIntervalMin: 1,
    tagIntervalMax: 2,
    nightShiftEnabled: true,
    nightStart: "21:30",
    nightEnd: "06:30",
    dayShift1Enabled: false,
    dayShift1Start: "06:30",
    dayShift1End: "14:30",
    dayShift2Enabled: false,
    dayShift2Start: "14:30",
    dayShift2End: "21:30",
    saturdayConfig: {
      nightEnabled: true,
      day1Enabled: false,
      day2Enabled: false,
      rounds: 2,
      nightRounds: 2,
      day1Rounds: 1,
      day2Rounds: 1
    },
    sundayConfig: {
      nightEnabled: true,
      day1Enabled: false,
      day2Enabled: false,
      rounds: 2,
      nightRounds: 2,
      day1Rounds: 2,
      day2Rounds: 1
    },
    customRoundSlotsEnabled: true,
    customRoundSlots: [
      {
        id: "1",
        name: "Ispezione Chiusura",
        startTime: "22:00",
        endTime: "23:15",
        enabled: true,
        daysFilter: "all"
      },
      {
        id: "2",
        name: "Controllo Notturno",
        startTime: "02:00",
        endTime: "03:30",
        enabled: true,
        daysFilter: "all"
      },
      {
        id: "3",
        name: "Apertura Varchi Staff",
        startTime: "05:45",
        endTime: "06:30",
        enabled: true,
        daysFilter: "all"
      }
    ]
  },
  {
    id: "cli_1791550744028",
    name: "LOGIPORT",
    code: "VIA BAIONA, 151 RAVENNA",
    notes: "8 TAG, 2 MARCATE PER NOTTE.",
    roundsPerShift: 2,
    tagsPerSite: 8,
    tagNames: [
      "Galleria Negozi Livello 0",
      "Uscite di Sicurezza Retro",
      "Parcheggio Sotterraneo Settore B"
    ],
    tagIntervalMin: 1,
    tagIntervalMax: 2,
    nightShiftEnabled: true,
    nightStart: "21:30",
    nightEnd: "06:30",
    dayShift1Enabled: false,
    dayShift1Start: "06:30",
    dayShift1End: "14:30",
    dayShift2Enabled: false,
    dayShift2Start: "14:30",
    dayShift2End: "21:30",
    saturdayConfig: {
      nightEnabled: true,
      day1Enabled: false,
      day2Enabled: false,
      rounds: 2,
      nightRounds: 2,
      day1Rounds: 1,
      day2Rounds: 1
    },
    sundayConfig: {
      nightEnabled: true,
      day1Enabled: false,
      day2Enabled: false,
      rounds: 2,
      nightRounds: 2,
      day1Rounds: 2,
      day2Rounds: 1
    },
    customRoundSlotsEnabled: true,
    customRoundSlots: [
      {
        id: "1",
        name: "Ispezione Chiusura",
        startTime: "22:00",
        endTime: "23:15",
        enabled: true,
        daysFilter: "all"
      },
      {
        id: "2",
        name: "Controllo Notturno",
        startTime: "02:00",
        endTime: "03:30",
        enabled: true,
        daysFilter: "all"
      },
      {
        id: "3",
        name: "Apertura Varchi Staff",
        startTime: "05:45",
        endTime: "06:30",
        enabled: true,
        daysFilter: "all"
      }
    ]
  }
];
