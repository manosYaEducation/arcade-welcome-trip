import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { Attendee, EventConfig, EventHistorySession, PrizeTier } from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAIL = 'asus.alphadocere@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function logoutFirebase() {
  return signOut(auth);
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'item_default';
}

export async function saveEventConfigToFirestore(cfg: EventConfig) {
  const path = 'eventConfig/current';
  try {
    await setDoc(doc(db, 'eventConfig', 'current'), {
      eventName: cfg.eventName.trim().slice(0, 120) || 'Arcade Welcome Trip',
      subtitle: (cfg.subtitle || '').trim().slice(0, 200),
      venue: cfg.venue.trim().slice(0, 120) || 'Salón Principal',
      gameDurationSeconds: Math.max(
        10,
        Math.min(120, Math.round(cfg.gameDurationSeconds || 30))
      ),
      badgeTitle:
        (cfg.badgeTitle || 'CREDENCIAL OFICIAL DE ACCESO').trim().slice(0, 80),
      badgeAccentColor: (cfg.badgeAccentColor || '#06B6D4').trim().slice(0, 20),
      badgeFooterNote: (cfg.badgeFooterNote || '').trim().slice(0, 160),
      whatsappTemplate:
        (
          cfg.whatsappTemplate ||
          '¡Hola {nombre}! Aquí tienes tu credencial oficial de *{evento}* ({rol}). Puntaje Arcade: *{puntaje} pts*.'
        )
          .trim()
          .slice(0, 500),
      pdfShowQr: Boolean(cfg.pdfShowQr),
      pdfShowRoleOrg: Boolean(cfg.pdfShowRoleOrg),
      pdfShowScore: Boolean(cfg.pdfShowScore),
      pdfShowPrize: Boolean(cfg.pdfShowPrize),
      pdfAutoDownloadOnCheckIn: Boolean(cfg.pdfAutoDownloadOnCheckIn),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function savePrizeToFirestore(prize: PrizeTier) {
  const cleanId = sanitizeId(prize.id);
  const path = `prizes/${cleanId}`;
  try {
    await setDoc(doc(db, 'prizes', cleanId), {
      label: prize.label.trim().slice(0, 80) || 'Premio',
      stock: Math.max(0, Math.min(100000, Math.round(prize.stock))),
      color: (prize.color || '#06B6D4').slice(0, 20),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePrizeFromFirestore(prizeId: string) {
  const cleanId = sanitizeId(prizeId);
  const path = `prizes/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'prizes', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createAttendeeInFirestore(att: Attendee, authorUid: string) {
  const cleanId = sanitizeId(att.id);
  const path = `attendees/${cleanId}`;
  try {
    await setDoc(doc(db, 'attendees', cleanId), {
      authorUid: sanitizeId(authorUid),
      name: att.name.trim().slice(0, 100),
      role: att.role.trim().slice(0, 80) || 'Invitado General',
      organization: (att.organization || '').trim().slice(0, 100),
      wordForCloud: (att.wordForCloud || 'Bienvenida').trim().slice(0, 60),
      checkedInAt: (att.checkedInAt || 'Ahora').trim().slice(0, 40),
      arcadeScore: Math.max(0, Math.min(1000000, Math.round(att.arcadeScore || 0))),
      maxCombo: Math.max(1, Math.min(10, Math.round(att.maxCombo || 1))),
      playedArcade: Boolean(att.playedArcade),
      prizeWon: (att.prizeWon || '').trim().slice(0, 100),
      isPublic: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (att.phone && att.phone.trim()) {
      await saveAttendeeContactPhone(cleanId, authorUid, att.phone.trim());
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveAttendeeContactPhone(
  attendeeId: string,
  authorUid: string,
  phone: string
) {
  const cleanId = sanitizeId(attendeeId);
  const path = `attendeeContacts/${cleanId}`;
  try {
    await setDoc(doc(db, 'attendeeContacts', cleanId), {
      authorUid: sanitizeId(authorUid),
      phone: phone.trim().slice(0, 30),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateAttendeeScoreInFirestore(
  attendeeId: string,
  arcadeScore: number,
  maxCombo: number
) {
  const cleanId = sanitizeId(attendeeId);
  const path = `attendees/${cleanId}`;
  try {
    await updateDoc(doc(db, 'attendees', cleanId), {
      arcadeScore: Math.max(0, Math.min(1000000, Math.round(arcadeScore))),
      maxCombo: Math.max(1, Math.min(10, Math.round(maxCombo))),
      playedArcade: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function assignPrizeInFirestoreAdmin(
  attendeeId: string,
  prizeLabel: string
) {
  const cleanId = sanitizeId(attendeeId);
  const path = `attendees/${cleanId}`;
  try {
    await updateDoc(doc(db, 'attendees', cleanId), {
      prizeWon: prizeLabel.trim().slice(0, 100),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAttendeeFromFirestoreAdmin(attendeeId: string) {
  const cleanId = sanitizeId(attendeeId);
  const path = `attendees/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'attendees', cleanId));
    await deleteDoc(doc(db, 'attendeeContacts', cleanId)).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveEventHistorySessionAdmin(
  session: EventHistorySession
) {
  const cleanId = sanitizeId(session.id);
  const path = `eventHistory/${cleanId}`;
  try {
    await setDoc(doc(db, 'eventHistory', cleanId), {
      eventName: session.eventName.trim().slice(0, 120) || 'Evento',
      venue: session.venue.trim().slice(0, 120) || 'Salón',
      closedAt: session.closedAt.trim().slice(0, 60),
      attendeeCount: Math.max(0, Math.min(100000, session.attendeeCount)),
      topScore: Math.max(0, Math.min(10000000, session.topScore)),
      topPlayerName: (session.topPlayerName || '').trim().slice(0, 100),
      prizesAwardedCount: Math.max(
        0,
        Math.min(100000, session.prizesAwardedCount)
      ),
      attendeesSummary: (session.attendeesSummary || '').slice(0, 15000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteEventHistorySessionAdmin(historyId: string) {
  const cleanId = sanitizeId(historyId);
  const path = `eventHistory/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'eventHistory', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
