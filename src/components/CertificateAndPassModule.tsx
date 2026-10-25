import React, { useEffect, useRef, useState } from 'react';
import { Download, Award, QrCode, UserPlus, Gamepad2 } from 'lucide-react';
import { Attendee, EventConfig } from '../types';
import {
  computeSha256Hex,
  generateDeterministicQrMatrix,
  retroAudio,
} from '../services/soundAndCrypto';

interface CertificateAndPassModuleProps {
  config: EventConfig;
  attendees: Attendee[];
  currentAttendeeId: string;
  onSelectAttendee: (id: string) => void;
  onGoToRegister: () => void;
  onGoToArcade: () => void;
}

export const CertificateAndPassModule: React.FC<CertificateAndPassModuleProps> = ({
  config,
  attendees,
  currentAttendeeId,
  onSelectAttendee,
  onGoToRegister,
  onGoToArcade,
}) => {
  const activeAttendee =
    attendees.find((a) => a.id === currentAttendeeId) || attendees[0] || null;

  const [verificationHash, setVerificationHash] = useState<string>('');
  const [downloaded, setDownloaded] = useState<boolean>(false);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const certCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!activeAttendee) return;
    const raw = `${config.eventName}|${activeAttendee.name}|${activeAttendee.checkedInAt}|${activeAttendee.arcadeScore}|${activeAttendee.prizeWon || 'SORTEO_ADMIN'}`;
    computeSha256Hex(raw).then((h) => setVerificationHash(h));
  }, [activeAttendee, config.eventName]);

  // Dibujar QR del Pase Digital
  useEffect(() => {
    const canvas = qrCanvasRef.current;
    if (!canvas || !activeAttendee) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const payload = `PASE:${activeAttendee.name}|ROL:${activeAttendee.role}|PTS:${activeAttendee.arcadeScore}`;
    const matrix = generateDeterministicQrMatrix(payload);
    const size = matrix.length;
    const cellPx = Math.floor(canvas.width / (size + 4));
    const margin = Math.floor((canvas.width - cellPx * size) / 2);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#090D16';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(margin + c * cellPx, margin + r * cellPx, cellPx, cellPx);
        }
      }
    }
  }, [activeAttendee]);

  // Dibujar el Diploma en alta resolución (1200x800)
  useEffect(() => {
    const canvas = certCanvasRef.current;
    if (!canvas || !activeAttendee) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.strokeRect(56, 56, W - 112, H - 112);

    ctx.fillStyle = '#06B6D4';
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DIPLOMA DE BIENVENIDA Y PARTICIPACIÓN', W / 2, 130);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 46px "Outfit", sans-serif';
    ctx.fillText(config.eventName, W / 2, 190);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${config.venue} · ${activeAttendee.checkedInAt}`, W / 2, 232);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Otorgado a:', W / 2, 305);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 58px "Outfit", sans-serif';
    ctx.fillText(activeAttendee.name, W / 2, 375);

    ctx.fillStyle = '#38BDF8';
    ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
    const subtitleRole = activeAttendee.organization
      ? `${activeAttendee.role} · ${activeAttendee.organization}`
      : activeAttendee.role;
    ctx.fillText(subtitleRole, W / 2, 420);

    const boxY = 470;
    const boxW = 300;
    const boxH = 120;
    const gap = 30;
    const startX = (W - (boxW * 3 + gap * 2)) / 2;

    const boxes = [
      {
        title: 'PALABRA APORTADA',
        value: activeAttendee.wordForCloud || 'Bienvenida',
        color: '#10B981',
      },
      {
        title: 'PUNTAJE ARCADE',
        value: `${activeAttendee.arcadeScore.toLocaleString()} PTS`,
        color: '#06B6D4',
      },
      {
        title: 'PREMIO TÓMBOLA ADMIN',
        value: (activeAttendee.prizeWon || 'En sorteo oficial').slice(0, 22),
        color: '#F59E0B',
      },
    ];

    boxes.forEach((b, i) => {
      const x = startX + i * (boxW + gap);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(x, boxY, boxW, boxH);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, boxY, boxW, boxH);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.title, x + boxW / 2, boxY + 42);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(b.value, x + boxW / 2, boxY + 82);
    });

    ctx.fillStyle = '#64748B';
    ctx.font = '500 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `Huella de verificación SHA-256: ${verificationHash.slice(0, 48)}`,
      W / 2,
      H - 85
    );
  }, [activeAttendee, config, verificationHash]);

  const handleDownloadPng = () => {
    const canvas = certCanvasRef.current;
    if (!canvas || !activeAttendee) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const cleanName = activeAttendee.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `Diploma_${cleanName}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    retroAudio.playCheckInSuccess();
    setDownloaded(true);
  };

  if (!activeAttendee) {
    return (
      <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-7 text-center space-y-4">
        <Award className="w-12 h-12 text-amber-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">
          Aún no te has registrado
        </h2>
        <p className="text-sm text-slate-300">
          Completa el Paso 1 de registro para obtener tu Pase Digital QR y tu Diploma personalizado.
        </p>
        <button
          type="button"
          onClick={onGoToRegister}
          className="w-full min-h-[48px] px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-2xl transition-colors cursor-pointer"
        >
          Ir al Paso 1: Registro
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-5">
        <div>
          <div className="text-xs font-medium text-cyan-400">
            Paso 3 de 3 · Tu Credencial y Diploma
          </div>
          <h2 className="text-xl font-bold text-white mt-0.5">
            ¡Bienvenido/a, {activeAttendee.name}!
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {attendees.length > 1 && (
            <select
              value={activeAttendee.id}
              onChange={(e) => onSelectAttendee(e.target.value)}
              className="min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-medium"
            >
              {attendees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.arcadeScore} pts)
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={onGoToRegister}
            className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Registrar a otra persona</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Pase Digital con QR */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400">
            <QrCode className="w-4 h-4" />
            <span>PASE DIGITAL DE ASISTENTE</span>
          </div>

          <div className="bg-white p-3 rounded-2xl inline-block mx-auto">
            <canvas
              ref={qrCanvasRef}
              width={160}
              height={160}
              className="w-[150px] h-[150px] block"
            />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-white">{activeAttendee.name}</h3>
            <p className="text-xs text-slate-400">
              {activeAttendee.role}
              {activeAttendee.organization ? ` · ${activeAttendee.organization}` : ''}
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-left space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Hora de registro:</span>
              <span className="font-mono text-white">{activeAttendee.checkedInAt}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Puntaje Arcade:</span>
              <span className="font-mono font-bold text-cyan-400">
                {activeAttendee.arcadeScore.toLocaleString()} pts
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Tómbola (Admin):</span>
              <span className="font-semibold text-amber-400">
                {activeAttendee.prizeWon || 'Inscrito en el sorteo'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onGoToArcade}
            className="w-full min-h-[46px] py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs rounded-2xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Gamepad2 className="w-4 h-4" />
            <span>
              {activeAttendee.playedArcade ? 'Volver a jugar Arcade' : 'Ir a jugar Arcade'}
            </span>
          </button>
        </div>

        {/* Diploma en PNG */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">
                Tu Diploma Personalizado
              </h3>
              <p className="text-xs text-slate-400">
                Si el organizador te asigna un premio en la Tómbola Admin, tu diploma se actualiza al instante.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadPng}
              className="min-h-[46px] px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-2xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>
                {downloaded ? '¡Descargado! Descargar de nuevo' : 'Descargar Diploma PNG'}
              </span>
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
            <canvas
              ref={certCanvasRef}
              width={1200}
              height={800}
              className="w-full h-auto rounded-xl block"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
