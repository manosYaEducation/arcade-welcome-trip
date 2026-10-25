import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkles, Gift, Shuffle, CheckCircle2, Users } from 'lucide-react';
import { Attendee, EventConfig, PrizeTier } from '../types';
import { pickRandomPrize, retroAudio } from '../services/soundAndCrypto';

interface AdminTombolaModuleProps {
  config: EventConfig;
  attendees: Attendee[];
  onAssignPrizeToAttendee: (attendeeId: string, prize: PrizeTier) => void;
}

export const AdminTombolaModule: React.FC<AdminTombolaModuleProps> = ({
  config,
  attendees,
  onAssignPrizeToAttendee,
}) => {
  // Asistentes elegibles (todos los registrados, priorizando quienes aún no tienen premio)
  const eligibleWithoutPrize = attendees.filter((a) => !a.prizeWon);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string>(
    eligibleWithoutPrize[0]?.id || attendees[0]?.id || ''
  );
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [lastWinner, setLastWinner] = useState<{
    attendeeName: string;
    prizeLabel: string;
  } | null>(null);

  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wheelAngleRef = useRef<number>(0);

  // Mantener seleccionado a un asistente válido cuando cambie la lista
  useEffect(() => {
    if (!selectedAttendeeId && attendees.length > 0) {
      const next = eligibleWithoutPrize[0] || attendees[0];
      setSelectedAttendeeId(next.id);
    }
  }, [attendees, eligibleWithoutPrize, selectedAttendeeId]);

  const drawWheel = useCallback(
    (angleRad: number) => {
      const canvas = wheelCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const radius = Math.min(cx, cy) - 20;

      ctx.clearRect(0, 0, W, H);

      const prizes = config.prizes;
      const sliceAngle = (Math.PI * 2) / prizes.length;

      prizes.forEach((prize, idx) => {
        const startAngle = angleRad + idx * sliceAngle;
        const endAngle = startAngle + sliceAngle;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = prize.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#090D16';
        ctx.stroke();

        ctx.translate(cx, cy);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(
          `${prize.label.slice(0, 18)} (${prize.stock})`,
          radius - 16,
          4
        );
        ctx.restore();
      });

      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fillStyle = '#090D16';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Puntero indicador derecho
      ctx.beginPath();
      ctx.moveTo(W - 4, cy - 13);
      ctx.lineTo(W - 28, cy);
      ctx.lineTo(W - 4, cy + 13);
      ctx.closePath();
      ctx.fillStyle = '#F59E0B';
      ctx.fill();
      ctx.strokeStyle = '#090D16';
      ctx.lineWidth = 2;
      ctx.stroke();
    },
    [config.prizes]
  );

  useEffect(() => {
    drawWheel(wheelAngleRef.current);
  }, [drawWheel]);

  // Sortear al azar un asistente entre los registrados sin premio
  const handlePickRandomAttendee = () => {
    const pool = eligibleWithoutPrize.length > 0 ? eligibleWithoutPrize : attendees;
    if (pool.length === 0) return;
    const rand = new Uint32Array(1);
    window.crypto.getRandomValues(rand);
    const chosen = pool[rand[0] % pool.length];
    setSelectedAttendeeId(chosen.id);
    setLastWinner(null);
    retroAudio.playArcadePickup(false);
  };

  // Girar la Ruleta de Premios (Exclusivo Admin)
  const handleAdminSpinWheel = () => {
    const targetAttendee = attendees.find((a) => a.id === selectedAttendeeId);
    if (isSpinning || !targetAttendee) return;

    setIsSpinning(true);
    setLastWinner(null);

    const { selectedPrize, selectedIndex } = pickRandomPrize(config.prizes);
    const n = config.prizes.length;
    const sliceAngle = (Math.PI * 2) / n;
    const targetSectorCenter =
      (2 * Math.PI - (selectedIndex + 0.5) * sliceAngle) % (2 * Math.PI);
    const fullSpins = 5 * Math.PI * 2;
    const startAngle = wheelAngleRef.current % (Math.PI * 2);
    const finalAngle = fullSpins + targetSectorCenter;

    const durationMs = 2600;
    const startTime = performance.now();
    let lastTick = -1;

    const animate = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const currentAngle = startAngle + (finalAngle - startAngle) * eased;
      wheelAngleRef.current = currentAngle;
      drawWheel(currentAngle);

      const sector = Math.floor((currentAngle / sliceAngle) % n);
      if (sector !== lastTick && t < 0.96) {
        lastTick = sector;
        retroAudio.playWheelTick(t);
      }

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        retroAudio.playPrizeFanfare();
        onAssignPrizeToAttendee(targetAttendee.id, selectedPrize);
        setLastWinner({
          attendeeName: targetAttendee.name,
          prizeLabel: selectedPrize.label,
        });
      }
    };

    requestAnimationFrame(animate);
  };

  const selectedAttendee = attendees.find((a) => a.id === selectedAttendeeId);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-amber-400">
            EXCLUSIVO ORGANIZADOR · SORTEO DE TÓMBOLA
          </div>
          <h2 className="text-2xl font-bold text-white mt-0.5">
            Ruleta Oficial de Premios (Control Admin)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Solo el administrador gira la ruleta. El premio asignado aparece al instante en el Pase Digital y Diploma del participante.
          </p>
        </div>

        <div className="text-right font-mono text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 shrink-0">
          <div>Registrados: {attendees.length}</div>
          <div className="text-amber-400">
            Sin premio aún: {eligibleWithoutPrize.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Ruleta de Premios */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col items-center space-y-5">
          <canvas
            ref={wheelCanvasRef}
            width={310}
            height={310}
            className="w-[270px] h-[270px] sm:w-[300px] sm:h-[300px]"
          />

          {attendees.length === 0 ? (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-slate-400 max-w-md">
              Aún no hay asistentes registrados. Cuando se registren en la vista de Asistente (o los importes por CSV), podrás girar la ruleta para ellos aquí.
            </div>
          ) : (
            <div className="w-full max-w-md space-y-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Participante seleccionado para el giro:</span>
                  <button
                    type="button"
                    onClick={handlePickRandomAttendee}
                    className="text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Elegir al azar</span>
                  </button>
                </div>

                <select
                  value={selectedAttendeeId}
                  onChange={(e) => setSelectedAttendeeId(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-semibold"
                >
                  {attendees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.arcadeScore} pts){' '}
                      {a.prizeWon ? `— Ya ganó: ${a.prizeWon}` : '— Sin premio'}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={isSpinning || !selectedAttendee}
                onClick={handleAdminSpinWheel}
                className="w-full min-h-[52px] bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-5 h-5" />
                <span>
                  {isSpinning
                    ? 'Girando la Ruleta...'
                    : `Girar Ruleta para ${selectedAttendee?.name || 'Asistente'}`}
                </span>
              </button>

              {lastWinner && (
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center gap-3 text-xs text-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold text-white text-sm">
                      ¡{lastWinner.attendeeName} ganó {lastWinner.prizeLabel}!
                    </div>
                    <div>
                      Ya se actualizó automáticamente su Pase Digital y su Diploma descargable.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Columna Derecha: Lista de Participantes y Premios Entregados */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Estado de Premios por Asistente</span>
            </h3>
          </div>

          {attendees.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center bg-slate-950 border border-slate-800 rounded-xl">
              Sin participantes registrados todavía.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {attendees.map((att) => (
                <div
                  key={att.id}
                  onClick={() => setSelectedAttendeeId(att.id)}
                  className={`p-3.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs ${
                    att.id === selectedAttendeeId
                      ? 'bg-slate-950 border-amber-400'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">{att.name}</div>
                    <div className="text-slate-400 mt-0.5">
                      Puntaje: {att.arcadeScore.toLocaleString()} pts · {att.role}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {att.prizeWon ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                        <Gift className="w-3.5 h-3.5" />
                        <span>{att.prizeWon}</span>
                      </span>
                    ) : (
                      <span className="text-amber-400 font-medium">
                        Listo para sortear
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
