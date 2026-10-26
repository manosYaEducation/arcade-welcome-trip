export type AppRoleMode = 'attendee' | 'admin';

export type AttendeeTab = 'register' | 'game' | 'pass';
export type AdminTab = 'tombola' | 'credentials' | 'live' | 'settings';

export interface PrizeTier {
  id: string;
  label: string;
  stock: number;
  color: string;
}

export interface EventConfig {
  eventName: string;
  subtitle: string;
  venue: string;
  gameDurationSeconds: number;
  badgeTitle: string;
  badgeAccentColor: string;
  badgeFooterNote: string;
  whatsappTemplate: string;
  pdfShowQr: boolean;
  pdfShowRoleOrg: boolean;
  pdfShowScore: boolean;
  pdfShowPrize: boolean;
  pdfAutoDownloadOnCheckIn: boolean;
  prizes: PrizeTier[];
}

export interface Attendee {
  id: string;
  name: string;
  role: string;
  organization: string;
  wordForCloud: string;
  checkedInAt: string;
  arcadeScore: number;
  maxCombo: number;
  playedArcade: boolean;
  prizeWon?: string;
  phone?: string;
}

export interface EventHistorySession {
  id: string;
  eventName: string;
  venue: string;
  closedAt: string;
  attendeeCount: number;
  topScore: number;
  topPlayerName: string;
  prizesAwardedCount: number;
  attendeesSummary: string;
}

export interface WordEntry {
  word: string;
  count: number;
}

export interface EncryptedBackupPackage {
  format: 'ARCADE_WELCOME_BACKUP_V1';
  eventName: string;
  createdAt: string;
  attendeeCount: number;
  sha256Hash: string;
  saltHex: string;
  ivHex: string;
  ciphertextBase64: string;
}
