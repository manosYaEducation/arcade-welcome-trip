import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Sparkles,
  Gift,
  Shuffle,
  CheckCircle2,
  Users,
  Plus,
  Minus,
  Trash2,
  RotateCcw,
  Package,
} from 'lucide-react';
import { Attendee, EventConfig, PrizeTier } from '../types';
import { pickRandomPrize, retroAudio } from '../services/soundAndCrypto';

interface AdminTombolaModuleProps {
  config: EventConfig;
  attendees: Attendee[];
  onAssignPrizeToAttendee: (attendeeId: string, prize: PrizeTier) => void;
  onRevokePrizeFromAttendee: (attendeeId: string, prizeLabel: string) => void;
  onAddPrize: (label: string, stock: number) => void;
  onUpdatePrizeStock: (prizeId: string, nextStock: number) => void;
  onDeletePrize: (prizeId: string) => void;
}

export const AdminTombolaModule: React.FC<AdminTombolaModuleProps> = ({
  config,
  attendees,
  onAssignPrizeToAttendee,
  onRevokePrizeFromAttendee,
  onAddPrize,
  onUpdatePrizeStock,
  onDeletePrize,
}) => {
  const eligibleWithoutPrize = attendees.filter((a) => !a.prizeWon);
  const winnersWithPrize = attendees.filter((a) => Boolean(a.prizeWon));

  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string>(
    eligibleWithoutPrize[0]?.id || attendees[0]?.id || ''
  );
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'winners'>(
    'all'
  );
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [lastWinner, setLastWinner] = useState<{
    attendeeName: string;
    prizeLabel: string;
  } | null>(null);

  // Estado para agregar nuevo premio directamente desde la Tómbola Admin
  const [newPrizeLabel, setNewPrizeLabel] = useState<string>('');
  const [newPrizeStock, setNewPrizeStock] = useState<number>(10);

  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wheelAngleRef = useRef<number>(0);

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
      if (prizes.length === 0) return;
      const sliceAngle = (Math.PI * 2) / prizes.length;

      prizes.forEach((prize, idx) => {
        const startAngle = angleRad + idx * sliceAngle;
        const endAngle = startAngle + sliceAngle;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = prize.stock > 0 ? prize.color : '#334155';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#090D16';
        ctx.stroke();

        ctx.translate(cx, cy);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = prize.stock > 0 ? '#FFFFFF' : '#94A3B8';
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

  const handlePickRandomAttendee = () => {
    const pool =
      eligibleWithoutPrize.length > 0 ? eligibleWithoutPrize : attendees;
    if (pool.length === 0) return;
    const rand = new Uint32Array(1);
    window.crypto.getRandomValues(rand);
    const chosen = pool[rand[0] % pool.length];
    setSelectedAttendeeId(chosen.id);
    setLastWinner(null);
    retroAudio.playArcadePickup(false);
  };

  const handleAdminSpinWheel = () => {
    const targetAttendee = attendees.find((a) => a.id === selectedAttendeeId);
    if (isSpinning || !targetAttendee || config.prizes.length === 0) return;

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
  const totalStock = config.prizes.reduce((acc, p) => acc + p.stock, 0);

  const displayedAttendees = attendees.filter((a) => {
    if (filterMode === 'pending') return !a.prizeWon;
    if (filterMode === 'winners') return Boolean(a.prizeWon);
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Cabecera de la Tómbola Admin */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-amber-400">
            USO EXCLUSIVO DEL ORGANIZADOR · GESTIÓN INTEGRAL DE SORTEOS
          </div>
          <h2 className="text-2xl font-bold text-white mt-0.5">
            Tómbola de Premios e Inventario (Admin)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Esta información es 100% interna del organizador: no ensucia las credenciales PDF de los asistentes. Desde aquí puedes girar la ruleta, administrar el stock de premios o re-sortear si alguien no está presente.
          </p>
        </div>

        <div className="text-right font-mono text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 shrink-0 space-y-0.5">
          <div>Participantes: {attendees.length}</div>
          <div className="text-emerald-400">
            Ganadores: {winnersWithPrize.length} · Pendientes: {eligibleWithoutPrize.length}
          </div>
          <div className="text-amber-400">Stock total premios: {totalStock}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda (7 cols): Ruleta + Administración de Stock de Premios */}
        <div className="lg:col-span-7 space-y-6">
          {/* Tarjeta 1: Ruleta de Sorteo */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col items-center space-y-5">
            <canvas
              ref={wheelCanvasRef}
              width={310}
              height={310}
              className="w-[260px] h-[260px] sm:w-[290px] sm:h-[290px]"
            />

            {attendees.length === 0 ? (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-slate-400 max-w-md">
                Aún no hay asistentes registrados. Cuando se registren en la vista de Asistente (o cargues datos de prueba en Ajustes), podrás sortear premios aquí.
              </div>
            ) : (
              <div className="w-full max-w-md space-y-4">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Participante seleccionado para el giro:</span>
                    <button
                      type="button"
                      onClick={handlePickRandomAttendee}
                      className="text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>Elegir pendiente al azar</span>
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
                        {a.prizeWon ? `— Ganó: ${a.prizeWon}` : '— Sin premio'}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  disabled={isSpinning || !selectedAttendee || totalStock === 0}
                  onClick={handleAdminSpinWheel}
                  className="w-full min-h-[52px] bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>
                    {isSpinning
                      ? 'Girando la Ruleta...'
                      : totalStock === 0
                      ? 'Sin stock de premios (Agrega stock abajo)'
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
                        Premio registrado en el panel del organizador y descontado del inventario.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tarjeta 2: Administrar Premios y Stock directamente aquí */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                <span>Administrar Premios y Stock de la Ruleta ({config.prizes.length})</span>
              </h3>
              <span className="text-xs text-slate-400">
                Ajusta cantidades en vivo
              </span>
            </div>

            <div className="space-y-2">
              {config.prizes.map((p) => (
                <div
                  key={p.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="font-semibold text-white truncate">
                      {p.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdatePrizeStock(p.id, Math.max(0, p.stock - 1))
                      }
                      className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                      aria-label="Restar 1 al stock"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <span className="w-16 text-center font-mono font-bold text-amber-400">
                      {p.stock} disp.
                    </span>

                    <button
                      type="button"
                      onClick={() => onUpdatePrizeStock(p.id, p.stock + 1)}
                      className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                      aria-label="Sumar 1 al stock"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    {config.prizes.length > 2 && (
                      <button
                        type="button"
                        onClick={() => onDeletePrize(p.id)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 cursor-pointer ml-1"
                        aria-label="Eliminar premio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                value={newPrizeLabel}
                onChange={(e) => setNewPrizeLabel(e.target.value)}
                placeholder="Nombre del nuevo premio..."
                className="flex-1 min-w-[160px] bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
              />
              <input
                type="number"
                min={1}
                value={newPrizeStock}
                onChange={(e) => setNewPrizeStock(Number(e.target.value) || 5)}
                className="w-20 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newPrizeLabel.trim()) return;
                  onAddPrize(newPrizeLabel.trim(), newPrizeStock);
                  setNewPrizeLabel('');
                  retroAudio.playCheckInSuccess();
                }}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Premio</span>
              </button>
            </div>
          </div>
        </div>

        {/* Columna Derecha (5 cols): Control de Ganadores y Re-sorteo ("Al agua") */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Control de Sorteos por Participante</span>
            </h3>
          </div>

          {/* Filtros de estado */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({attendees.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('pending')}
              className={`py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                filterMode === 'pending'
                  ? 'bg-slate-800 text-amber-300 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sin premio ({eligibleWithoutPrize.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('winners')}
              className={`py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                filterMode === 'winners'
                  ? 'bg-slate-800 text-emerald-300 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Ganadores ({winnersWithPrize.length})
            </button>
          </div>

          {displayedAttendees.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center bg-slate-950 border border-slate-800 rounded-xl">
              No hay participantes en este filtro.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {displayedAttendees.map((att) => (
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
                    <div className="font-bold text-white truncate">
                      {att.name}
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      {att.arcadeScore.toLocaleString()} pts · {att.role}
                    </div>
                  </div>

                  <div
                    className="text-right shrink-0 flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {att.prizeWon ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <Gift className="w-3.5 h-3.5" />
                          <span>{att.prizeWon}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onRevokePrizeFromAttendee(att.id, att.prizeWon || '')
                          }
                          title="Quitar premio y devolver +1 al stock (Al agua / Re-sortear)"
                          className="px-2 py-1 bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Al agua</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedAttendeeId(att.id)}
                        className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg font-medium cursor-pointer"
                      >
                        Seleccionar
                      </button>
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
