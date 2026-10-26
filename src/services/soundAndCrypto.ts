import { jsPDF } from 'jspdf';
import {
  Attendee,
  EncryptedBackupPackage,
  EventConfig,
  EventHistorySession,
  PrizeTier,
} from '../types';

/**
 * Síntesis de Audio 8-Bit Nativa (Web Audio API sin archivos externos)
 */
class RetroAudioSynthesizer {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'square',
    startTimeOffsetSec: number = 0,
    peakGain: number = 0.06,
    endFreq?: number
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + startTimeOffsetSec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFreq),
        now + durationSec
      );
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.015);
  }

  public playCheckInSuccess() {
    this.playTone(523.25, 0.08, 'triangle', 0, 0.07);
    this.playTone(659.25, 0.08, 'triangle', 0.07, 0.07);
    this.playTone(783.99, 0.08, 'triangle', 0.14, 0.07);
    this.playTone(1046.5, 0.18, 'triangle', 0.21, 0.08);
  }

  public playArcadePickup(isBonus: boolean = false) {
    if (isBonus) {
      this.playTone(880, 0.06, 'square', 0, 0.06);
      this.playTone(1174.66, 0.06, 'square', 0.05, 0.06);
      this.playTone(1396.91, 0.12, 'square', 0.1, 0.07);
    } else {
      this.playTone(987.77, 0.05, 'square', 0, 0.05);
      this.playTone(1318.51, 0.09, 'square', 0.045, 0.06);
    }
  }

  public playArcadeHit() {
    this.playTone(220, 0.14, 'sawtooth', 0, 0.07, 65);
  }

  public playArcadeDash() {
    this.playTone(320, 0.11, 'triangle', 0, 0.06, 880);
  }

  public playWheelTick(progressRatio: number = 0.5) {
    const freq = 400 + (1 - progressRatio) * 320;
    this.playTone(freq, 0.022, 'triangle', 0, 0.045);
  }

  public playPrizeFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const times = [0, 0.09, 0.18, 0.27, 0.4, 0.5];
    const durs = [0.08, 0.08, 0.08, 0.11, 0.08, 0.26];
    notes.forEach((n, idx) => {
      this.playTone(n, durs[idx], 'triangle', times[idx], 0.07);
    });
  }
}

export const retroAudio = new RetroAudioSynthesizer();

/**
 * Criptografía en Navegador (window.crypto.subtle)
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const buffer = new ArrayBuffer(clean.length / 2);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function computeSha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digestBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digestBuffer));
}

async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBackupWithPassword(
  plaintextJson: string,
  password: string,
  eventName: string,
  attendeeCount: number
): Promise<EncryptedBackupPackage> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintextJson);
  const sha256Hash = await computeSha256Hex(plaintextJson);

  const saltBuffer = new ArrayBuffer(16);
  const salt = new Uint8Array(saltBuffer);
  window.crypto.getRandomValues(salt);

  const ivBuffer = new ArrayBuffer(12);
  const iv = new Uint8Array(ivBuffer);
  window.crypto.getRandomValues(iv);

  const key = await deriveKeyFromPassword(password, salt);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return {
    format: 'ARCADE_WELCOME_BACKUP_V1',
    eventName,
    createdAt: new Date().toISOString(),
    attendeeCount,
    sha256Hash,
    saltHex: bytesToHex(salt),
    ivHex: bytesToHex(iv),
    ciphertextBase64: bytesToBase64(new Uint8Array(encryptedBuffer)),
  };
}

export async function decryptBackupWithPassword(
  pkg: EncryptedBackupPackage,
  password: string
): Promise<string> {
  const salt = hexToBytes(pkg.saltHex);
  const iv = hexToBytes(pkg.ivHex);
  const cipherBytes = base64ToBytes(pkg.ciphertextBase64);

  const key = await deriveKeyFromPassword(password, salt);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBytes
  );
  return new TextDecoder().decode(decryptedBuffer);
}

export function pickRandomPrize(prizes: PrizeTier[]): {
  selectedPrize: PrizeTier;
  selectedIndex: number;
} {
  const available = prizes.filter((p) => p.stock > 0);
  const pool = available.length > 0 ? available : prizes;

  const rand = new Uint32Array(1);
  window.crypto.getRandomValues(rand);
  const randomIndexInPool = rand[0] % pool.length;
  const chosen = pool[randomIndexInPool];
  const selectedIndex = prizes.findIndex((p) => p.id === chosen.id);

  return {
    selectedPrize: chosen,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : 0,
  };
}

export function generateDeterministicQrMatrix(payload: string): boolean[][] {
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  const placeFinderPattern = (rowOffset: number, colOffset: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = rowOffset + r;
        const cc = colOffset + c;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
          reserved[rr][cc] = true;
          const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
          const onOuterEdge = r === 0 || r === 6 || c === 0 || c === 6;
          const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          matrix[rr][cc] = inOuter && (onOuterEdge || inInner);
        }
      }
    }
  };

  placeFinderPattern(0, 0);
  placeFinderPattern(0, size - 7);
  placeFinderPattern(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        const charCode = payload.charCodeAt((r * size + c) % payload.length) || 73;
        const bit =
          ((hash ^ (r * 31 + c * 17 + charCode * 13)) >>> ((r + c) % 16)) & 1;
        matrix[r][c] = bit === 1;
      }
    }
  }

  return matrix;
}

/**
 * Renderiza en un Canvas HTML5 una Credencial Personalizada lista para PDF o PNG
 * Respeta las opciones automáticas configuradas por el Admin (sin ruido de Tómbola por defecto)
 */
export function renderCredentialCardToCanvas(
  canvas: HTMLCanvasElement,
  attendee: Attendee,
  config: EventConfig
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const accent = config.badgeAccentColor || '#06B6D4';

  // Fondo oscuro elegante
  ctx.fillStyle = '#090D16';
  ctx.fillRect(0, 0, W, H);

  // Franja superior con el color de acento personalizado
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 18);

  // Marco perimetral
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 34, W - 48, H - 58);

  // Encabezado personalizado (badgeTitle + eventName + subtitle)
  ctx.fillStyle = accent;
  ctx.font = '700 15px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    (config.badgeTitle || 'CREDENCIAL OFICIAL DE ACCESO').toUpperCase(),
    W / 2,
    78
  );

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 32px "Outfit", sans-serif';
  ctx.fillText(config.eventName.slice(0, 32), W / 2, 118);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
  const venueLine = config.subtitle
    ? `${config.subtitle.slice(0, 38)} · ${config.venue}`
    : `${config.venue} · Ingreso: ${attendee.checkedInAt}`;
  ctx.fillText(venueLine, W / 2, 148);

  let currentY = 178;

  // Código QR central (si pdfShowQr está activo)
  if (config.pdfShowQr !== false) {
    const payload = `PASE:${attendee.name}|ROL:${attendee.role}|HORA:${attendee.checkedInAt}`;
    const matrix = generateDeterministicQrMatrix(payload);
    const qrCell = 7;
    const qrSize = matrix.length * qrCell + 24;
    const qrX = Math.floor((W - qrSize) / 2);
    const qrY = currentY;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = '#090D16';
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix.length; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(
            qrX + 12 + c * qrCell,
            qrY + 12 + r * qrCell,
            qrCell,
            qrCell
          );
        }
      }
    }
    currentY = qrY + qrSize + 52;
  } else {
    currentY = 250;
  }

  // Nombre del Participante
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 38px "Outfit", sans-serif';
  ctx.fillText(attendee.name.slice(0, 28), W / 2, currentY);

  // Rol e Institución (si pdfShowRoleOrg está activo)
  if (config.pdfShowRoleOrg !== false) {
    ctx.fillStyle = accent;
    ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
    const roleOrg = attendee.organization
      ? `${attendee.role} · ${attendee.organization}`
      : attendee.role;
    ctx.fillText(roleOrg.slice(0, 42), W / 2, currentY + 34);
  }

  // Bloques inferiores configurables (Palabra Aportada, Puntaje Arcade opcional, Premio opcional)
  const boxes: { title: string; value: string; borderColor: string; valueColor: string }[] = [
    {
      title: 'PALABRA CLAVE',
      value: (attendee.wordForCloud || 'Bienvenida').slice(0, 20),
      borderColor: '#10B981',
      valueColor: '#FFFFFF',
    },
  ];

  if (config.pdfShowScore !== false) {
    boxes.push({
      title: 'PUNTAJE ARCADE',
      value: `${attendee.arcadeScore.toLocaleString()} PTS`,
      borderColor: accent,
      valueColor: '#FFFFFF',
    });
  }

  if (config.pdfShowPrize === true && attendee.prizeWon) {
    boxes.push({
      title: 'PREMIO ASIGNADO',
      value: attendee.prizeWon.slice(0, 20),
      borderColor: '#F59E0B',
      valueColor: '#F59E0B',
    });
  }

  const boxY = currentY + 64;
  const count = boxes.length;
  const gap = 18;
  const totalMargin = 96;
  const boxW = Math.floor((W - totalMargin - gap * (count - 1)) / count);
  const boxH = 88;
  const startX = Math.floor((W - (boxW * count + gap * (count - 1))) / 2);

  boxes.forEach((b, idx) => {
    const x = startX + idx * (boxW + gap);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(x, boxY, boxW, boxH);
    ctx.strokeStyle = b.borderColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, boxY, boxW, boxH);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(b.title, x + boxW / 2, boxY + 30);

    ctx.fillStyle = b.valueColor;
    ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(b.value, x + boxW / 2, boxY + 62);
  });

  // Nota al pie personalizada
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    config.badgeFooterNote || 'Gracias por ser parte de esta experiencia',
    W / 2,
    H - 52
  );
}

/**
 * Descarga un PDF individual de la credencial lista para imprimir o enviar por WhatsApp
 */
export function downloadSingleCredentialPdf(
  attendee: Attendee,
  config: EventConfig
) {
  const offscreen = document.createElement('canvas');
  offscreen.width = 600;
  offscreen.height = 760;
  renderCredentialCardToCanvas(offscreen, attendee, config);
  const imgData = offscreen.toDataURL('image/png');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Centrar credencial en hoja A4 (105mm x 133mm)
  pdf.addImage(imgData, 'PNG', 52.5, 40, 105, 133);
  const cleanName = attendee.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  pdf.save(`Credencial_${cleanName}.pdf`);
}

/**
 * Descarga un PDF con todas las credenciales en grilla (4 por página A4) listo para imprimir y recortar
 */
export function downloadAllCredentialsBatchPdf(
  attendees: Attendee[],
  config: EventConfig
) {
  if (attendees.length === 0) return;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const offscreen = document.createElement('canvas');
  offscreen.width = 600;
  offscreen.height = 760;

  const positions = [
    { x: 12, y: 12 },
    { x: 108, y: 12 },
    { x: 12, y: 148 },
    { x: 108, y: 148 },
  ];

  attendees.forEach((att, idx) => {
    const slotIdx = idx % 4;
    if (idx > 0 && slotIdx === 0) {
      pdf.addPage();
    }
    renderCredentialCardToCanvas(offscreen, att, config);
    const imgData = offscreen.toDataURL('image/png');
    const pos = positions[slotIdx];
    pdf.addImage(imgData, 'PNG', pos.x, pos.y, 90, 114);
  });

  const cleanEvent = config.eventName.replace(/[^a-zA-Z0-9_-]/g, '_');
  pdf.save(`Credenciales_Lote_${cleanEvent}.pdf`);
}

export interface HistorySummaryItem {
  name: string;
  role: string;
  score: number;
  prize: string;
}

export function parseHistoryAttendeesSummary(
  rawSummary: string
): HistorySummaryItem[] {
  if (!rawSummary) return [];
  try {
    const parsed = JSON.parse(rawSummary);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        name: String(item.name || 'Participante'),
        role: String(item.role || 'Invitado'),
        score: Number(item.score ?? 0),
        prize: String(item.prize || ''),
      }));
    }
  } catch {
    // Fallback para resúmenes guardados como texto plano
  }
  return rawSummary
    .split('\n')
    .filter(Boolean)
    .map((line) => ({
      name: line,
      role: '',
      score: 0,
      prize: '',
    }));
}

/**
 * Descarga un PDF de resumen de una sesión guardada en Histórico con tabla legible
 */
export function downloadHistorySessionPdf(session: EventHistorySession) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  pdf.setFontSize(18);
  pdf.text(`Reporte Oficial de Sesión: ${session.eventName}`, 16, 20);

  pdf.setFontSize(11);
  pdf.text(`Lugar / Salón: ${session.venue}`, 16, 30);
  pdf.text(`Fecha de Cierre: ${session.closedAt}`, 16, 37);
  pdf.text(
    `Total Asistentes: ${session.attendeeCount}  |  Récord Arcade: ${session.topScore.toLocaleString()} pts (${session.topPlayerName || 'N/A'})  |  Premios Tómbola: ${session.prizesAwardedCount}`,
    16,
    44
  );

  pdf.setDrawColor(180);
  pdf.line(16, 49, 194, 49);

  const items = parseHistoryAttendeesSummary(session.attendeesSummary);

  pdf.setFontSize(10);
  let y = 57;
  pdf.text('#   Participante                    Perfil / Área              Puntaje     Premio Tómbola', 16, y);
  y += 3;
  pdf.line(16, y, 194, y);
  y += 6;

  if (items.length === 0) {
    pdf.text('Sin detalle de participantes en esta sesión.', 16, y);
  } else {
    items.forEach((item, idx) => {
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }
      const num = String(idx + 1).padEnd(3, ' ');
      const nameCol = item.name.slice(0, 28).padEnd(30, ' ');
      const roleCol = item.role.slice(0, 24).padEnd(26, ' ');
      const scoreCol = `${item.score.toLocaleString()} pts`.padEnd(11, ' ');
      const prizeCol = item.prize ? item.prize.slice(0, 22) : '-';
      pdf.text(`${num} ${nameCol} ${roleCol} ${scoreCol} ${prizeCol}`, 16, y);
      y += 6.5;
    });
  }

  const cleanName = session.eventName.replace(/[^a-zA-Z0-9_-]/g, '_');
  pdf.save(`Acta_Sesion_${cleanName}_${session.id.slice(-5)}.pdf`);
}

/**
 * Construye el enlace oficial wa.me para enviar la credencial por WhatsApp
 */
export function buildWhatsAppCredentialUrl(
  phoneRaw: string,
  attendee: Attendee,
  config: EventConfig
): string {
  const digits = phoneRaw.replace(/[^0-9]/g, '');
  const template =
    config.whatsappTemplate ||
    '¡Hola {nombre}! Aquí tienes tu credencial oficial de *{evento}* ({rol}). Tu puntaje en el reto Arcade: *{puntaje} pts*.';

  const message = template
    .replace(/\{nombre\}/gi, attendee.name)
    .replace(/\{evento\}/gi, config.eventName)
    .replace(/\{rol\}/gi, attendee.role)
    .replace(/\{puntaje\}/gi, attendee.arcadeScore.toLocaleString())
    .replace(/\{premio\}/gi, attendee.prizeWon || 'Acreditado');

  const encoded = encodeURIComponent(message);
  return digits
    ? `https://wa.me/${digits}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export const DEFAULT_EVENT_CONFIG: EventConfig = {
  eventName: 'Arcade Welcome Trip',
  subtitle: 'Recepción interactiva y bienvenida de asistentes',
  venue: 'Salón Principal',
  gameDurationSeconds: 30,
  badgeTitle: 'CREDENCIAL OFICIAL DE ACCESO',
  badgeAccentColor: '#06B6D4',
  badgeFooterNote: 'Gracias por ser parte de nuestro evento',
  whatsappTemplate:
    '¡Hola {nombre}! Te compartimos tu credencial oficial de *{evento}* ({rol}). Puntaje en el reto Arcade: *{puntaje} pts*.',
  pdfShowQr: true,
  pdfShowRoleOrg: true,
  pdfShowScore: true,
  pdfShowPrize: false,
  pdfAutoDownloadOnCheckIn: false,
  prizes: [
    { id: 'p-1', label: 'Café de Especialidad', stock: 15, color: '#06B6D4' },
    { id: 'p-2', label: 'Pack de Stickers Retro', stock: 25, color: '#F59E0B' },
    { id: 'p-3', label: 'Polera Oficial del Evento', stock: 8, color: '#10B981' },
    { id: 'p-4', label: 'Pase VIP Primera Fila', stock: 5, color: '#6366F1' },
    { id: 'p-5', label: 'Llavero Arcade Edición Especial', stock: 12, color: '#EC4899' },
  ],
};
