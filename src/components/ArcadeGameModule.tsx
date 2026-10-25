import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Gamepad2,
  Play,
  RotateCcw,
  Award,
  ArrowLeft,
  ArrowRight,
  Zap,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { Attendee, EventConfig } from '../types';
import { retroAudio } from '../services/soundAndCrypto';

type GameState = 'READY' | 'PLAYING' | 'FINISHED';

interface ArcadeEntity {
  id: number;
  x: number;
  y: number;
  radius: number;
  speedY: number;
  type: 'COIN' | 'STAR' | 'OBSTACLE';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

interface ArcadeGameModuleProps {
  config: EventConfig;
  currentPlayer: Attendee | null;
  onSaveScore: (score: number, maxCombo: number) => void;
  onGoToPass: () => void;
  onGoToRegister: () => void;
}

export const ArcadeGameModule: React.FC<ArcadeGameModuleProps> = ({
  config,
  currentPlayer,
  onSaveScore,
  onGoToPass,
  onGoToRegister,
}) => {
  const [gameState, setGameState] = useState<GameState>('READY');
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(1);
  const [timeLeft, setTimeLeft] = useState<number>(config.gameDurationSeconds || 30);

  // Estado del Giroscopio (DeviceOrientationEvent)
  const [gyroEnabled, setGyroEnabled] = useState<boolean>(false);
  const [gyroSupported, setGyroSupported] = useState<boolean>(true);
  const [tiltGamma, setTiltGamma] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Inclina tu celular, desliza el dedo en la pantalla o usa los botones inferiores.'
  );

  const gameCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const engineRef = useRef<{
    playerX: number;
    keys: { left: boolean; right: boolean };
    gyroGamma: number;
    boostTimer: number;
    score: number;
    combo: number;
    maxCombo: number;
    timeRemaining: number;
    entities: ArcadeEntity[];
    particles: Particle[];
    nextId: number;
    spawnTimer: number;
    gridOffset: number;
    lastTime: number;
  }>({
    playerX: 210,
    keys: { left: false, right: false },
    gyroGamma: 0,
    boostTimer: 0,
    score: 0,
    combo: 1,
    maxCombo: 1,
    timeRemaining: config.gameDurationSeconds || 30,
    entities: [],
    particles: [],
    nextId: 1,
    spawnTimer: 0,
    gridOffset: 0,
    lastTime: 0,
  });

  // Solicitar permiso y activar el Giroscopio nativo del celular
  const enableGyroscope = async () => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setGyroSupported(false);
      setStatusMessage(
        'Este dispositivo no reporta sensor de giroscopio físico. Usa el control táctil o la barra de inclinación.'
      );
      return;
    }

    try {
      const DeviceOrientationWithPerm = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };

      if (typeof DeviceOrientationWithPerm.requestPermission === 'function') {
        const permission = await DeviceOrientationWithPerm.requestPermission();
        if (permission !== 'granted') {
          setStatusMessage(
            'Permiso de giroscopio denegado en el navegador. Puedes jugar deslizando el dedo.'
          );
          return;
        }
      }

      setGyroEnabled(true);
      setStatusMessage(
        'Giroscopio activo: inclina tu celular a la izquierda o derecha para mover la nave.'
      );
      retroAudio.playCheckInSuccess();
    } catch {
      // En Android o navegadores que no requieren requestPermission explícito
      setGyroEnabled(true);
      setStatusMessage(
        'Giroscopio activo: inclina tu celular a la izquierda o derecha para mover la nave.'
      );
    }
  };

  // Escuchar eventos de inclinación del dispositivo (gamma: izquierda/derecha)
  useEffect(() => {
    if (!gyroEnabled) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma !== null && !Number.isNaN(event.gamma)) {
        const clamped = Math.max(-35, Math.min(35, Math.round(event.gamma)));
        engineRef.current.gyroGamma = clamped;
        setTiltGamma(clamped);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [gyroEnabled]);

  const startRound = () => {
    const dur = config.gameDurationSeconds || 30;
    const canvasW = gameCanvasRef.current?.width || 420;
    engineRef.current = {
      playerX: canvasW / 2,
      keys: { left: false, right: false },
      gyroGamma: engineRef.current.gyroGamma,
      boostTimer: 0,
      score: 0,
      combo: 1,
      maxCombo: 1,
      timeRemaining: dur,
      entities: [],
      particles: [],
      nextId: 1,
      spawnTimer: 0,
      gridOffset: 0,
      lastTime: performance.now(),
    };
    setScore(0);
    setCombo(1);
    setTimeLeft(dur);
    retroAudio.playCheckInSuccess();
    setGameState('PLAYING');
  };

  const triggerBoost = useCallback(() => {
    if (gameState === 'PLAYING' && engineRef.current.boostTimer <= 0) {
      engineRef.current.boostTimer = 1.1;
      retroAudio.playArcadeDash();
    }
  }, [gameState]);

  // Controles de teclado para desktop
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        engineRef.current.keys.left = true;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        engineRef.current.keys.right = true;
      } else if (e.key === ' ') {
        e.preventDefault();
        triggerBoost();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        engineRef.current.keys.left = false;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        engineRef.current.keys.right = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gameState, triggerBoost]);

  // Deslizar el dedo o mouse directamente sobre el Canvas
  const handlePointerMoveOnCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING') return;
    const canvas = gameCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    engineRef.current.playerX = Math.max(32, Math.min(canvas.width - 32, relX));
  };

  // Loop de 60 FPS con soporte de Giroscopio + Touch + Teclado
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    let animId: number;
    const canvas = gameCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const playerY = H - 56;

    const addParticles = (x: number, y: number, color: string, count = 10) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const speed = 50 + Math.random() * 110;
        engineRef.current.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.38,
          maxLife: 0.38,
          color,
        });
      }
    };

    engineRef.current.lastTime = performance.now();

    const loop = (now: number) => {
      const st = engineRef.current;
      const dt = Math.min(0.05, (now - st.lastTime) / 1000);
      st.lastTime = now;

      st.timeRemaining = Math.max(0, st.timeRemaining - dt);
      if (st.boostTimer > 0) st.boostTimer = Math.max(0, st.boostTimer - dt);

      // 1. Movimiento por botones o teclado
      const moveSpeed = st.boostTimer > 0 ? 440 : 320;
      if (st.keys.left) st.playerX -= moveSpeed * dt;
      if (st.keys.right) st.playerX += moveSpeed * dt;

      // 2. Movimiento dinámico por Giroscopio (gamma en grados -35 a +35)
      if (Math.abs(st.gyroGamma) > 2) {
        const gyroVelocity = (st.gyroGamma / 25) * 340;
        st.playerX += gyroVelocity * dt;
      }

      st.playerX = Math.max(34, Math.min(W - 34, st.playerX));

      // Aparición de esferas
      const progress = 1 - st.timeRemaining / Math.max(10, config.gameDurationSeconds || 30);
      const speedScale = 1 + progress * 0.65;

      st.spawnTimer += dt * speedScale;
      if (st.spawnTimer >= 0.44) {
        st.spawnTimer = 0;
        const r = Math.random();
        const type: ArcadeEntity['type'] =
          r > 0.8 ? 'STAR' : r < 0.24 ? 'OBSTACLE' : 'COIN';
        st.entities.push({
          id: st.nextId++,
          x: 36 + Math.random() * (W - 72),
          y: -20,
          radius: type === 'STAR' ? 18 : 15,
          speedY: (165 + Math.random() * 75) * speedScale,
          type,
        });
      }

      // Actualizar entidades y colisiones
      const nextEntities: ArcadeEntity[] = [];
      for (const ent of st.entities) {
        if (st.boostTimer > 0 && ent.type !== 'OBSTACLE') {
          const dx = st.playerX - ent.x;
          const dy = playerY - ent.y;
          const d = Math.hypot(dx, dy);
          if (d < 150 && d > 1) {
            ent.x += (dx / d) * 250 * dt;
            ent.y += (dy / d) * 250 * dt;
          }
        }

        ent.y += ent.speedY * dt;
        const dist = Math.hypot(ent.x - st.playerX, ent.y - playerY);

        if (dist < ent.radius + 22) {
          if (ent.type === 'COIN') {
            st.score += 100 * st.combo;
            st.combo = Math.min(5, st.combo + 1);
            st.maxCombo = Math.max(st.maxCombo, st.combo);
            retroAudio.playArcadePickup(false);
            addParticles(ent.x, ent.y, '#06B6D4', 10);
          } else if (ent.type === 'STAR') {
            st.score += 300 * st.combo;
            st.combo = Math.min(5, st.combo + 1);
            st.maxCombo = Math.max(st.maxCombo, st.combo);
            retroAudio.playArcadePickup(true);
            addParticles(ent.x, ent.y, '#F59E0B', 14);
          } else {
            if (st.boostTimer > 0) {
              st.score += 150;
              retroAudio.playArcadePickup(false);
              addParticles(ent.x, ent.y, '#10B981', 12);
            } else {
              st.combo = 1;
              retroAudio.playArcadeHit();
              addParticles(ent.x, ent.y, '#F43F5E', 14);
            }
          }
          continue;
        }

        if (ent.y < H + 30) {
          nextEntities.push(ent);
        }
      }
      st.entities = nextEntities;

      st.particles = st.particles
        .map((p) => ({
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          life: p.life - dt,
        }))
        .filter((p) => p.life > 0);

      // Renderizar fondo retro
      ctx.fillStyle = '#070B14';
      ctx.fillRect(0, 0, W, H);

      st.gridOffset = (st.gridOffset + 110 * speedScale * dt) % 40;
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.13)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 55) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = st.gridOffset; y <= H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Dibujar esferas y obstáculos
      for (const ent of st.entities) {
        ctx.save();
        ctx.translate(ent.x, ent.y);
        if (ent.type === 'COIN') {
          ctx.fillStyle = '#06B6D4';
          ctx.beginPath();
          ctx.arc(0, 0, ent.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#090D16';
          ctx.font = '700 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('+100', 0, 1);
        } else if (ent.type === 'STAR') {
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(0, 0, ent.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#090D16';
          ctx.font = '700 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★300', 0, 1);
        } else {
          ctx.fillStyle = '#F43F5E';
          ctx.beginPath();
          ctx.moveTo(0, -ent.radius);
          ctx.lineTo(ent.radius, ent.radius);
          ctx.lineTo(-ent.radius, ent.radius);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      for (const p of st.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
        ctx.restore();
      }

      // Dibujar nave del jugador (con ligera rotación visual según inclinación)
      ctx.save();
      ctx.translate(st.playerX, playerY);
      const tiltAngleRad = (st.gyroGamma / 35) * 0.35;
      ctx.rotate(tiltAngleRad);

      if (st.boostTimer > 0) {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#06B6D4';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(22, 16);
      ctx.lineTo(7, 10);
      ctx.lineTo(-7, 10);
      ctx.lineTo(-22, 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      setScore(st.score);
      setCombo(st.combo);
      setTimeLeft(Number(st.timeRemaining.toFixed(1)));

      if (st.timeRemaining <= 0) {
        onSaveScore(st.score, st.maxCombo);
        retroAudio.playPrizeFanfare();
        setGameState('FINISHED');
        return;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, config.gameDurationSeconds, onSaveScore]);

  if (!currentPlayer) {
    return (
      <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-7 text-center space-y-4">
        <Gamepad2 className="w-12 h-12 text-cyan-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">
          Regístrate primero en el Paso 1
        </h2>
        <p className="text-sm text-slate-300">
          Ingresa tu nombre en la bienvenida para guardar tu puntaje en el ranking y habilitar tu pase digital.
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
    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Columna Izquierda / Principal Mobile-First: Cabina de Juego */}
      <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
        {/* Marcador Compacto Mobile-First */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-3 text-center">
          <div>
            <div className="text-[11px] text-slate-400">Puntaje</div>
            <div className="text-lg font-mono font-bold text-cyan-400 tabular-nums">
              {score.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Combo</div>
            <div className="text-lg font-mono font-bold text-amber-400 tabular-nums">
              x{combo}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Tiempo</div>
            <div className="text-lg font-mono font-bold text-white tabular-nums">
              {timeLeft.toFixed(0)}s
            </div>
          </div>
        </div>

        {/* Barra de Estado de Giroscopio / Inclinación */}
        <div className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2">
            <Smartphone
              className={`w-4 h-4 shrink-0 ${
                gyroEnabled ? 'text-emerald-400' : 'text-cyan-400'
              }`}
            />
            <span className="font-medium text-slate-200">
              {gyroEnabled
                ? `Giroscopio Activo (${tiltGamma > 0 ? `+${tiltGamma}` : tiltGamma}°)`
                : 'Control por Giroscopio / Touch'}
            </span>
          </div>

          {!gyroEnabled && gyroSupported && (
            <button
              type="button"
              onClick={enableGyroscope}
              className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg font-semibold text-[11px] whitespace-nowrap cursor-pointer"
            >
              Activar Giroscopio
            </button>
          )}
        </div>

        {/* Canvas Vertical Mobile-First (440x480) */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          <canvas
            ref={gameCanvasRef}
            width={440}
            height={440}
            onPointerMove={handlePointerMoveOnCanvas}
            className="w-full h-[360px] sm:h-[400px] block touch-none cursor-crosshair"
          />

          {/* Pantalla Inicial Lista para Jugar */}
          {gameState === 'READY' && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
              <Gamepad2 className="w-12 h-12 text-cyan-400 mb-3" />
              <h3 className="text-2xl font-bold text-white">
                ¡Turno de {currentPlayer.name}!
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xs mt-2 leading-relaxed">
                Inclina tu celular con el giroscopio o desliza tu dedo para atrapar esferas azules (+100) y doradas (+300).
              </p>

              <div className="w-full max-w-xs space-y-2.5 mt-6">
                <button
                  type="button"
                  onClick={startRound}
                  className="w-full min-h-[48px] bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>¡Empezar a Jugar ({config.gameDurationSeconds}s)!</span>
                </button>

                {!gyroEnabled && gyroSupported && (
                  <button
                    type="button"
                    onClick={enableGyroscope}
                    className="w-full min-h-[44px] bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs rounded-2xl border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Activar Giroscopio del Celular</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Pantalla Final para el Asistente (Sin Ruleta — Redirige a su Pase QR) */}
          {gameState === 'FINISHED' && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              <div>
                <div className="text-xs font-semibold text-emerald-400">
                  ¡PARTIDA COMPLETADA!
                </div>
                <h3 className="text-3xl font-bold text-white mt-1 tabular-nums">
                  {score.toLocaleString()} puntos
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xs mx-auto mt-2">
                  Tu puntaje ya está en el Ranking en Vivo y quedaste inscrito/a para el sorteo en la Tómbola del Organizador.
                </p>
              </div>

              <div className="w-full max-w-xs space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={onGoToPass}
                  className="w-full min-h-[48px] bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Award className="w-4 h-4" />
                  <span>Ver mi Pase QR y Diploma</span>
                </button>

                <button
                  type="button"
                  onClick={startRound}
                  className="w-full min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-2xl border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Jugar otra vez para mejorar récord</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Botones Táctiles Ergonomía Mobile (Zona del Pulgar >= 48px) */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onMouseDown={() => {
              engineRef.current.keys.left = true;
            }}
            onMouseUp={() => {
              engineRef.current.keys.left = false;
            }}
            onMouseLeave={() => {
              engineRef.current.keys.left = false;
            }}
            onTouchStart={() => {
              engineRef.current.keys.left = true;
            }}
            onTouchEnd={() => {
              engineRef.current.keys.left = false;
            }}
            onClick={() => {
              engineRef.current.playerX = Math.max(34, engineRef.current.playerX - 42);
            }}
            className="min-h-[48px] bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-white font-semibold text-xs rounded-2xl border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer select-none"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Izquierda</span>
          </button>

          <button
            type="button"
            onClick={triggerBoost}
            disabled={gameState !== 'PLAYING'}
            className="min-h-[48px] bg-amber-500/20 active:bg-amber-500 active:text-slate-950 disabled:opacity-40 text-amber-300 font-semibold text-xs rounded-2xl border border-amber-500/40 flex items-center justify-center gap-1.5 cursor-pointer select-none"
          >
            <Zap className="w-4 h-4" />
            <span>Escudo / Imán</span>
          </button>

          <button
            type="button"
            onMouseDown={() => {
              engineRef.current.keys.right = true;
            }}
            onMouseUp={() => {
              engineRef.current.keys.right = false;
            }}
            onMouseLeave={() => {
              engineRef.current.keys.right = false;
            }}
            onTouchStart={() => {
              engineRef.current.keys.right = true;
            }}
            onTouchEnd={() => {
              engineRef.current.keys.right = false;
            }}
            onClick={() => {
              engineRef.current.playerX = Math.min(406, engineRef.current.playerX + 42);
            }}
            className="min-h-[48px] bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-white font-semibold text-xs rounded-2xl border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer select-none"
          >
            <span>Derecha</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Columna Derecha: Calibrador de Giroscopio e Instrucciones */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
            <Smartphone className="w-4 h-4" />
            <span>Control Dinámico por Giroscopio</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{statusMessage}</p>

          {/* Barra deslizante para simular o calibrar la inclinación desde escritorio o móvil */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Inclinación Lateral (Gamma)</span>
              <span className="font-mono font-bold text-cyan-400 tabular-nums">
                {tiltGamma > 0 ? `+${tiltGamma}° Derecha` : tiltGamma < 0 ? `${tiltGamma}° Izquierda` : '0° Centro'}
              </span>
            </div>
            <input
              type="range"
              min={-35}
              max={35}
              value={tiltGamma}
              onChange={(e) => {
                const val = Number(e.target.value);
                setTiltGamma(val);
                engineRef.current.gyroGamma = val;
              }}
              aria-label="Simulador o calibrador de inclinación de giroscopio"
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>-35° Izq.</span>
              <button
                type="button"
                onClick={() => {
                  setTiltGamma(0);
                  engineRef.current.gyroGamma = 0;
                }}
                className="text-slate-400 hover:text-white underline cursor-pointer"
              >
                Centrar (0°)
              </button>
              <span>+35° Der.</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white">Tu Resumen de Jugador</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Participante:</span>
              <span className="font-semibold text-white">{currentPlayer.name}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Mejor Puntaje:</span>
              <span className="font-mono font-bold text-cyan-400 tabular-nums">
                {Math.max(currentPlayer.arcadeScore, score).toLocaleString()} pts
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Estado en Tómbola:</span>
              <span className="font-semibold text-amber-400">
                {currentPlayer.prizeWon
                  ? `Premio: ${currentPlayer.prizeWon}`
                  : 'Participando (La gira el Admin)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
