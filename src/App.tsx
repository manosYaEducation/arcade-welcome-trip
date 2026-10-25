import React, { useEffect, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  UserCheck,
  Gamepad2,
  Award,
  Tv,
  Settings,
  ArrowRight,
  Trophy,
  MessageSquareHeart,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Download,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Smartphone,
  Gift,
} from 'lucide-react';
import {
  AdminTab,
  AppRoleMode,
  Attendee,
  AttendeeTab,
  EncryptedBackupPackage,
  EventConfig,
  PrizeTier,
  WordEntry,
} from './types';
import {
  DEFAULT_EVENT_CONFIG,
  decryptBackupWithPassword,
  encryptBackupWithPassword,
  retroAudio,
} from './services/soundAndCrypto';
import { ArcadeGameModule } from './components/ArcadeGameModule';
import { CertificateAndPassModule } from './components/CertificateAndPassModule';
import { AdminTombolaModule } from './components/AdminTombolaModule';

const SUGGESTED_WORDS = [
  'Innovación',
  'Comunidad',
  'Networking',
  'Aprender',
  'Tecnología',
  'Diseño',
  'Futuro',
  'Creatividad',
];

const ROLE_OPTIONS = [
  'Desarrollo / Ingeniería',
  'Diseño / UX',
  'Producto / Negocios',
  'Estudiante / Academia',
  'Invitado General',
];

export default function App() {
  // Separación estricta: Modo Asistente (Mobile-First) vs Modo Admin (Organizador)
  const [roleMode, setRoleMode] = useState<AppRoleMode>('attendee');
  const [attendeeTab, setAttendeeTab] = useState<AttendeeTab>('register');
  const [adminTab, setAdminTab] = useState<AdminTab>('tombola');

  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [config, setConfig] = useState<EventConfig>(DEFAULT_EVENT_CONFIG);

  // Lista real de asistentes registrados en la sesión
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [currentAttendeeId, setCurrentAttendeeId] = useState<string>('');

  // Formulario de Registro (Modo Asistente)
  const [nameInput, setNameInput] = useState<string>('');
  const [roleInput, setRoleInput] = useState<string>(ROLE_OPTIONS[0]);
  const [orgInput, setOrgInput] = useState<string>('');
  const [wordInput, setWordInput] = useState<string>('Innovación');
  const [formError, setFormError] = useState<string>('');

  // Estados exclusivos del Modo Admin
  const [newPrizeLabel, setNewPrizeLabel] = useState<string>('');
  const [newPrizeStock, setNewPrizeStock] = useState<number>(10);
  const [csvImportText, setCsvImportText] = useState<string>('');
  const [backupPassword, setBackupPassword] = useState<string>('');
  const [encryptedPkg, setEncryptedPkg] =
    useState<EncryptedBackupPackage | null>(null);
  const [unlockPasswordInput, setUnlockPasswordInput] = useState<string>('');
  const [unlockedPreview, setUnlockedPreview] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string>('');

  const wordCloudCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentPlayer =
    attendees.find((a) => a.id === currentAttendeeId) || attendees[0] || null;

  const toggleSound = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    retroAudio.enabled = next;
    if (next) retroAudio.playArcadePickup(false);
  };

  // Paso 1 (Asistente): Registrarse y pasar al juego mobile-first
  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    if (!cleanName) {
      setFormError('Por favor escribe tu nombre para continuar.');
      return;
    }

    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newPerson: Attendee = {
      id: `user-${Date.now()}`,
      name: cleanName,
      role: roleInput,
      organization: orgInput.trim(),
      wordForCloud: wordInput.trim() || 'Bienvenida',
      checkedInAt: nowTime,
      arcadeScore: 0,
      maxCombo: 1,
      playedArcade: false,
    };

    setAttendees((prev) => [newPerson, ...prev]);
    setCurrentAttendeeId(newPerson.id);
    setNameInput('');
    setOrgInput('');
    setFormError('');
    retroAudio.playCheckInSuccess();
    setAttendeeTab('game');
  };

  // Paso 2 (Asistente): Guardar puntaje del juego (sin girar ruleta)
  const handleSavePlayerScore = (score: number, maxCombo: number) => {
    if (!currentPlayer) return;
    setAttendees((prev) =>
      prev.map((a) =>
        a.id === currentPlayer.id
          ? {
              ...a,
              arcadeScore: Math.max(a.arcadeScore, score),
              maxCombo: Math.max(a.maxCombo, maxCombo),
              playedArcade: true,
            }
          : a
      )
    );
  };

  // Exclusivo Admin: Girar la Tómbola y asignar el premio al asistente
  const handleAdminAssignPrize = (attendeeId: string, prize: PrizeTier) => {
    setAttendees((prev) =>
      prev.map((a) =>
        a.id === attendeeId
          ? {
              ...a,
              prizeWon: prize.label,
            }
          : a
      )
    );

    setConfig((prev) => ({
      ...prev,
      prizes: prev.prizes.map((p) =>
        p.id === prize.id ? { ...p, stock: Math.max(0, p.stock - 1) } : p
      ),
    }));
  };

  // Nube de palabras real
  const realWords: WordEntry[] = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const att of attendees) {
      const w = att.wordForCloud.trim();
      if (w) {
        counts.set(w, (counts.get(w) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count);
  }, [attendees]);

  useEffect(() => {
    if (roleMode !== 'admin' || adminTab !== 'live') return;
    const canvas = wordCloudCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#070B14';
    ctx.fillRect(0, 0, W, H);

    if (realWords.length === 0) {
      ctx.fillStyle = '#64748B';
      ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        'Las palabras que escriban los asistentes al registrarse aparecerán aquí en vivo.',
        W / 2,
        H / 2
      );
      return;
    }

    const cx = W / 2;
    const cy = H / 2;
    const colors = ['#06B6D4', '#F59E0B', '#10B981', '#38BDF8', '#F8FAFC', '#EC4899'];

    realWords.forEach((item, idx) => {
      const size = Math.min(42, 20 + item.count * 6);
      ctx.font = `700 ${size}px "Outfit", sans-serif`;
      ctx.fillStyle = colors[idx % colors.length];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (idx === 0) {
        ctx.fillText(`${item.word} (${item.count})`, cx, cy);
      } else {
        const angle = idx * 2.4;
        const rad = 45 + idx * 28;
        const x = Math.max(90, Math.min(W - 90, cx + Math.cos(angle) * rad * 1.3));
        const y = Math.max(36, Math.min(H - 36, cy + Math.sin(angle) * rad * 0.75));
        ctx.fillText(`${item.word} (${item.count})`, x, y);
      }
    });
  }, [roleMode, adminTab, realWords]);

  // Importar CSV en Admin
  const handleImportCsvGuests = () => {
    const lines = csvImportText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const imported: Attendee[] = lines.map((line, i) => {
      const parts = line.split(',').map((p) => p.trim());
      return {
        id: `import-${Date.now()}-${i}`,
        name: parts[0] || `Invitado ${i + 1}`,
        role: parts[1] || 'Invitado General',
        organization: parts[2] || '',
        wordForCloud: parts[3] || 'Comunidad',
        checkedInAt: nowTime,
        arcadeScore: 0,
        maxCombo: 1,
        playedArcade: false,
      };
    });

    setAttendees((prev) => [...imported, ...prev]);
    if (!currentAttendeeId && imported[0]) {
      setCurrentAttendeeId(imported[0].id);
    }
    setCsvImportText('');
    retroAudio.playCheckInSuccess();
  };

  // Respaldo Cifrado AES-GCM en Admin
  const handleCreateEncryptedBackup = async () => {
    if (!backupPassword.trim()) return;
    const payload = JSON.stringify(
      {
        event: config,
        attendees,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
    const pkg = await encryptBackupWithPassword(
      payload,
      backupPassword,
      config.eventName,
      attendees.length
    );
    setEncryptedPkg(pkg);
    setUnlockedPreview('');
    setUnlockError('');
    retroAudio.playCheckInSuccess();
  };

  const handleTestUnlockBackup = async () => {
    if (!encryptedPkg || !unlockPasswordInput) return;
    try {
      const plain = await decryptBackupWithPassword(
        encryptedPkg,
        unlockPasswordInput
      );
      setUnlockedPreview(plain);
      setUnlockError('');
      retroAudio.playCheckInSuccess();
    } catch {
      setUnlockError('Contraseña incorrecta. No se pudo desbloquear el respaldo.');
      setUnlockedPreview('');
    }
  };

  const sortedByScore = [...attendees].sort(
    (a, b) => b.arcadeScore - a.arcadeScore
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#090D16] text-slate-100 pb-20 md:pb-6">
      {/* Barra Superior (3 Zonas) con Conmutador Claro entre Modo Asistente y Panel Admin */}
      <header className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-30">
        {/* Zona 1: Nombre del Evento */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setRoleMode('attendee');
            setAttendeeTab('register');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          {config.eventName}
        </a>

        {/* Zona 2: Navegación contextual según el modo actual (Asistente vs Admin) */}
        {roleMode === 'attendee' ? (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <button
              type="button"
              onClick={() => setAttendeeTab('register')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
                attendeeTab === 'register'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
                  : ''
              }`}
            >
              1. Registro
            </button>
            <button
              type="button"
              onClick={() => setAttendeeTab('game')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
                attendeeTab === 'game'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
                  : ''
              }`}
            >
              2. Juego Arcade
            </button>
            <button
              type="button"
              onClick={() => setAttendeeTab('pass')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
                attendeeTab === 'pass'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
                  : ''
              }`}
            >
              3. Mi Pase y Diploma
            </button>
          </nav>
        ) : (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <button
              type="button"
              onClick={() => setAdminTab('tombola')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
                adminTab === 'tombola'
                  ? 'text-amber-400 border-b-2 border-amber-400 font-semibold'
                  : ''
              }`}
            >
              Ruleta / Tómbola
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('live')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
                adminTab === 'live'
                  ? 'text-amber-400 border-b-2 border-amber-400 font-semibold'
                  : ''
              }`}
            >
              Pantalla en Vivo ({attendees.length})
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('settings')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
                adminTab === 'settings'
                  ? 'text-amber-400 border-b-2 border-amber-400 font-semibold'
                  : ''
              }`}
            >
              Ajustes y Respaldo
            </button>
          </nav>
        )}

        {/* Zona 3: Botón de Cambio de Rol (Vista Asistente <-> Panel Admin) + Sonido */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleSound}
            aria-label="Activar o silenciar sonido"
            className="min-h-[40px] px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {audioEnabled ? (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
            <span className="hidden sm:inline">
              {audioEnabled ? 'Sonido' : 'Silencio'}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setRoleMode((prev) => (prev === 'attendee' ? 'admin' : 'attendee'))
            }
            className={`min-h-[40px] px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              roleMode === 'admin'
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
            }`}
          >
            {roleMode === 'admin' ? (
              <>
                <Smartphone className="w-4 h-4" />
                <span>Volver a Vista Asistente</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Panel Admin ({attendees.length})</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Sub-barra cuando está en Modo Admin para cambiar entre Tómbola, Pantalla en Vivo y Ajustes en móvil */}
      {roleMode === 'admin' && (
        <div className="border-b border-amber-500/30 bg-amber-950/20 px-4 py-2.5">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>MODO ADMINISTRADOR DEL EVENTO</span>
            </span>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setAdminTab('tombola')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  adminTab === 'tombola'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 border border-slate-800'
                }`}
              >
                <Gift className="w-3.5 h-3.5" />
                <span>1. Girar Tómbola</span>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('live')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  adminTab === 'live'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 border border-slate-800'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>2. Pantalla en Vivo</span>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('settings')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  adminTab === 'settings'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 border border-slate-800'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>3. Ajustes y Respaldo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
        {roleMode === 'attendee' ? (
          /* ===================================================================
             SECCIÓN ASISTENTE (MOBILE-FIRST: REGISTRO -> JUEGO GIROSCOPIO -> PASE)
             =================================================================== */
          <>
            {attendeeTab === 'register' && (
              <div className="max-w-lg mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div>
                  <div className="text-xs font-semibold text-cyan-400">
                    PASO 1 DE 3 · BIENVENIDA MOBILE-FIRST
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                    ¡Bienvenido/a a {config.eventName}!
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1">
                    Regístrate en segundos para jugar el reto arcade con el giroscopio de tu celular y obtener tu pase digital.
                  </p>
                </div>

                <form onSubmit={handleCheckInSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Tu Nombre y Apellido *
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => {
                        setNameInput(e.target.value);
                        if (formError) setFormError('');
                      }}
                      placeholder="Ej: Carolina Pérez"
                      className="w-full min-h-[48px] bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                    {formError && (
                      <p className="text-xs text-rose-400 mt-1.5">{formError}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                        Tu Área o Perfil
                      </label>
                      <select
                        value={roleInput}
                        onChange={(e) => setRoleInput(e.target.value)}
                        className="w-full min-h-[48px] bg-slate-950 border border-slate-700 rounded-2xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                        Empresa / Institución (Opcional)
                      </label>
                      <input
                        type="text"
                        value={orgInput}
                        onChange={(e) => setOrgInput(e.target.value)}
                        placeholder="Ej: Startup / Universidad"
                        className="w-full min-h-[48px] bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Elige o escribe 1 palabra para la Nube en Vivo
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2.5">
                      {SUGGESTED_WORDS.map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setWordInput(w)}
                          className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                            wordInput === w
                              ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-semibold'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={wordInput}
                      onChange={(e) => setWordInput(e.target.value)}
                      placeholder="O escribe tu propia palabra..."
                      className="w-full min-h-[46px] bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[52px] bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Registrarme y Pasar al Juego</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {attendeeTab === 'game' && (
              <ArcadeGameModule
                config={config}
                currentPlayer={currentPlayer}
                onSaveScore={handleSavePlayerScore}
                onGoToPass={() => setAttendeeTab('pass')}
                onGoToRegister={() => setAttendeeTab('register')}
              />
            )}

            {attendeeTab === 'pass' && (
              <CertificateAndPassModule
                config={config}
                attendees={attendees}
                currentAttendeeId={currentAttendeeId}
                onSelectAttendee={setCurrentAttendeeId}
                onGoToRegister={() => setAttendeeTab('register')}
                onGoToArcade={() => setAttendeeTab('game')}
              />
            )}
          </>
        ) : (
          /* ===================================================================
             SECCIÓN ADMIN / ORGANIZADOR (TÓMBOLA, PANTALLA EN VIVO, AJUSTES)
             =================================================================== */
          <>
            {adminTab === 'tombola' && (
              <AdminTombolaModule
                config={config}
                attendees={attendees}
                onAssignPrizeToAttendee={handleAdminAssignPrize}
              />
            )}

            {adminTab === 'live' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
                  <div>
                    <div className="text-xs font-semibold text-amber-400">
                      MODO PROYECTOR · ACTUALIZACIÓN EN TIEMPO REAL
                    </div>
                    <h2 className="text-2xl font-bold text-white mt-0.5">
                      {config.eventName} — Pantalla en Vivo
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAdminTab('tombola')}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Gift className="w-4 h-4" />
                    <span>Ir a Girar la Tómbola</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Ranking de Puntajes Reales */}
                  <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-400" />
                      <h3 className="text-lg font-bold text-white">
                        Ranking Arcade ({attendees.length})
                      </h3>
                    </div>

                    {sortedByScore.length === 0 ? (
                      <div className="p-8 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-2">
                        <p className="text-sm text-slate-300">
                          Esperando a los primeros jugadores...
                        </p>
                        <p className="text-xs text-slate-400">
                          A medida que los asistentes se registren y jueguen desde la Vista Asistente, aparecerán aquí.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {sortedByScore.map((att, idx) => (
                          <div
                            key={att.id}
                            className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-7 h-7 rounded-lg bg-slate-800 text-cyan-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-white truncate">
                                  {att.name}
                                </div>
                                <div className="text-xs text-slate-400 truncate">
                                  {att.role}
                                  {att.prizeWon ? ` · Premio: ${att.prizeWon}` : ''}
                                </div>
                              </div>
                            </div>

                            <div className="text-right font-mono font-bold text-cyan-400 text-sm tabular-nums shrink-0">
                              {att.arcadeScore.toLocaleString()} pts
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Nube de Palabras */}
                  <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <MessageSquareHeart className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-lg font-bold text-white">
                        Nube de Palabras en Vivo
                      </h3>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                      <canvas
                        ref={wordCloudCanvasRef}
                        width={540}
                        height={300}
                        className="w-full h-[280px] block"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {adminTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
                  <h2 className="text-2xl font-bold text-white">
                    Configuración del Evento, Invitados CSV y Respaldo Cifrado
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Personaliza el evento, administra el stock de premios de la tómbola, importa invitados o exporta el cierre cifrado AES-GCM.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Datos del Evento y Premios */}
                  <div className="lg:col-span-6 space-y-6">
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
                      <h3 className="text-base font-bold text-white">
                        1. Datos Generales del Evento
                      </h3>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Nombre del Evento
                          </label>
                          <input
                            type="text"
                            value={config.eventName}
                            onChange={(e) =>
                              setConfig({ ...config, eventName: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                              Lugar o Salón
                            </label>
                            <input
                              type="text"
                              value={config.venue}
                              onChange={(e) =>
                                setConfig({ ...config, venue: e.target.value })
                              }
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                              Duración del Juego (seg)
                            </label>
                            <input
                              type="number"
                              min={10}
                              max={120}
                              value={config.gameDurationSeconds}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  gameDurationSeconds: Number(e.target.value) || 30,
                                })
                              }
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
                      <h3 className="text-base font-bold text-white">
                        2. Premios de la Tómbola ({config.prizes.length})
                      </h3>

                      <div className="space-y-2">
                        {config.prizes.map((p) => (
                          <div
                            key={p.id}
                            className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: p.color }}
                              />
                              <span className="font-semibold text-white">
                                {p.label}
                              </span>
                              <span className="text-slate-400">
                                ({p.stock} disp.)
                              </span>
                            </div>
                            {config.prizes.length > 2 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfig({
                                    ...config,
                                    prizes: config.prizes.filter(
                                      (item) => item.id !== p.id
                                    ),
                                  })
                                }
                                className="text-rose-400 hover:text-rose-300 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="text"
                          value={newPrizeLabel}
                          onChange={(e) => setNewPrizeLabel(e.target.value)}
                          placeholder="Nuevo premio..."
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                        />
                        <input
                          type="number"
                          min={1}
                          value={newPrizeStock}
                          onChange={(e) =>
                            setNewPrizeStock(Number(e.target.value) || 5)
                          }
                          className="w-20 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newPrizeLabel.trim()) return;
                            const palette = [
                              '#06B6D4',
                              '#F59E0B',
                              '#10B981',
                              '#6366F1',
                              '#EC4899',
                            ];
                            const nextPrize: PrizeTier = {
                              id: `prize-${Date.now()}`,
                              label: newPrizeLabel.trim(),
                              stock: newPrizeStock,
                              color:
                                palette[config.prizes.length % palette.length],
                            };
                            setConfig({
                              ...config,
                              prizes: [...config.prizes, nextPrize],
                            });
                            setNewPrizeLabel('');
                          }}
                          className="px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Agregar</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Importar CSV y Cierre Cifrado */}
                  <div className="lg:col-span-6 space-y-6">
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-3">
                      <h3 className="text-base font-bold text-white">
                        3. Importar Invitados (Luma / CSV)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Formato por línea:{' '}
                        <code className="text-slate-200">
                          Nombre, Rol, Empresa, Palabra
                        </code>
                      </p>
                      <textarea
                        rows={3}
                        value={csvImportText}
                        onChange={(e) => setCsvImportText(e.target.value)}
                        placeholder={
                          'Ana Gómez, Diseño / UX, Studio Sur, Creatividad\nCarlos Ruiz, Desarrollo / Ingeniería, TechLab, Futuro'
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white"
                      />
                      <button
                        type="button"
                        onClick={handleImportCsvGuests}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Importar Invitados</span>
                      </button>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
                      <h3 className="text-base font-bold text-white">
                        4. Respaldo Cifrado AES-GCM y Limpieza
                      </h3>
                      <p className="text-xs text-slate-400">
                        Cifra los datos de los {attendees.length} participantes con tu contraseña antes de limpiar la memoria.
                      </p>

                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          value={backupPassword}
                          onChange={(e) => setBackupPassword(e.target.value)}
                          placeholder="Contraseña para cifrar el respaldo..."
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={handleCreateEncryptedBackup}
                          disabled={!backupPassword.trim()}
                          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Cifrar</span>
                        </button>
                      </div>

                      {encryptedPkg && (
                        <div className="p-4 bg-slate-950 border border-emerald-500/40 rounded-xl space-y-3 text-xs">
                          <div className="flex items-center justify-between text-emerald-400 font-semibold">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Cifrado con AES-GCM-256</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const blob = new Blob(
                                  [JSON.stringify(encryptedPkg, null, 2)],
                                  { type: 'application/json' }
                                );
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Respaldo_${config.eventName.replace(
                                  /\s+/g,
                                  '_'
                                )}.arcadetrip`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Descargar</span>
                            </button>
                          </div>

                          <div className="pt-2 border-t border-slate-800 space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="password"
                                value={unlockPasswordInput}
                                onChange={(e) =>
                                  setUnlockPasswordInput(e.target.value)
                                }
                                placeholder="Verificar con tu contraseña..."
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                              />
                              <button
                                type="button"
                                onClick={handleTestUnlockBackup}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-1 cursor-pointer"
                              >
                                <Unlock className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Verificar</span>
                              </button>
                            </div>
                            {unlockError && (
                              <p className="text-rose-400 text-xs">
                                {unlockError}
                              </p>
                            )}
                            {unlockedPreview && (
                              <pre className="p-2.5 bg-slate-900 rounded-lg text-[11px] font-mono text-emerald-300 max-h-[120px] overflow-y-auto">
                                {unlockedPreview}
                              </pre>
                            )}
                          </div>
                        </div>
                      )}

                      {attendees.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setAttendees([]);
                            setCurrentAttendeeId('');
                          }}
                          className="w-full py-2.5 px-4 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold text-xs rounded-xl border border-rose-500/40 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Borrar Datos de la Sesión en Memoria</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Barra Inferior Fija Mobile-First para el Asistente (Ergonomía Zona del Pulgar) */}
      {roleMode === 'attendee' && (
        <nav
          aria-label="Navegación móvil de asistente"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-3 items-center h-16 px-2"
        >
          <button
            type="button"
            onClick={() => setAttendeeTab('register')}
            className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
              attendeeTab === 'register'
                ? 'text-cyan-400 font-bold'
                : 'text-slate-400'
            }`}
          >
            <UserCheck className="w-5 h-5" />
            <span className="text-[11px] mt-0.5">1. Registro</span>
          </button>

          <button
            type="button"
            onClick={() => setAttendeeTab('game')}
            className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
              attendeeTab === 'game' ? 'text-cyan-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Gamepad2 className="w-5 h-5" />
            <span className="text-[11px] mt-0.5">2. Jugar</span>
          </button>

          <button
            type="button"
            onClick={() => setAttendeeTab('pass')}
            className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
              attendeeTab === 'pass' ? 'text-cyan-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Award className="w-5 h-5" />
            <span className="text-[11px] mt-0.5">3. Mi Pase</span>
          </button>
        </nav>
      )}
    </div>
  );
}
