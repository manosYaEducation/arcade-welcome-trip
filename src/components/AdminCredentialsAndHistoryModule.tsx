import React, { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Printer,
  Send,
  Palette,
  Archive,
  History,
  Search,
  Download,
  Trash2,
  CheckCircle2,
  Phone,
} from 'lucide-react';
import { Attendee, EventConfig, EventHistorySession } from '../types';
import {
  buildWhatsAppCredentialUrl,
  downloadAllCredentialsBatchPdf,
  downloadHistorySessionPdf,
  downloadSingleCredentialPdf,
  renderCredentialCardToCanvas,
  retroAudio,
} from '../services/soundAndCrypto';

const ACCENT_PRESETS = [
  { label: 'Cian Eléctrico', hex: '#06B6D4' },
  { label: 'Ámbar Dorado', hex: '#F59E0B' },
  { label: 'Esmeralda', hex: '#10B981' },
  { label: 'Índigo Real', hex: '#6366F1' },
  { label: 'Rosa Neón', hex: '#EC4899' },
];

interface AdminCredentialsAndHistoryModuleProps {
  config: EventConfig;
  attendees: Attendee[];
  historySessions: EventHistorySession[];
  onUpdateConfig: (next: EventConfig, persistToCloud?: boolean) => void;
  onUpdateAttendeePhone: (attendeeId: string, phone: string) => void;
  onArchiveAndClearSession: () => Promise<void>;
  onDeleteHistorySession: (historyId: string) => Promise<void>;
}

export const AdminCredentialsAndHistoryModule: React.FC<
  AdminCredentialsAndHistoryModuleProps
> = ({
  config,
  attendees,
  historySessions,
  onUpdateConfig,
  onUpdateAttendeePhone,
  onArchiveAndClearSession,
  onDeleteHistorySession,
}) => {
  const [selectedPreviewId, setSelectedPreviewId] = useState<string>(
    attendees[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [archiveSuccessMsg, setArchiveSuccessMsg] = useState<string>('');
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!selectedPreviewId && attendees.length > 0) {
      setSelectedPreviewId(attendees[0].id);
    }
  }, [attendees, selectedPreviewId]);

  const previewAttendee: Attendee =
    attendees.find((a) => a.id === selectedPreviewId) ||
    attendees[0] || {
      id: 'preview-demo',
      name: 'Nombre del Participante',
      role: 'Desarrollo / Ingeniería',
      organization: 'Empresa Ejemplo',
      wordForCloud: 'Innovación',
      checkedInAt: '17:20',
      arcadeScore: 2450,
      maxCombo: 4,
      playedArcade: true,
      prizeWon: 'Café de Especialidad',
      phone: '+56912345678',
    };

  // Dibujar vista previa en vivo cuando cambia el diseño o el asistente seleccionado
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    renderCredentialCardToCanvas(canvas, previewAttendee, config);
  }, [previewAttendee, config]);

  const filteredAttendees = attendees.filter((a) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q) ||
      a.organization.toLowerCase().includes(q) ||
      (a.phone || '').toLowerCase().includes(q)
    );
  });

  const handleArchiveClick = async () => {
    if (attendees.length === 0 || isArchiving) return;
    setIsArchiving(true);
    try {
      await onArchiveAndClearSession();
      retroAudio.playPrizeFanfare();
      setArchiveSuccessMsg(
        '¡Sesión guardada en el Histórico y lista de participantes limpiada con éxito!'
      );
      setTimeout(() => setArchiveSuccessMsg(''), 6000);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Encabezado Principal con Acciones Rápidas de Lote PDF y Cierre a Histórico */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-amber-400">
            GESTIÓN DE CREDENCIALES PDF, WHATSAPP E HISTÓRICO DE SESIONES
          </div>
          <h2 className="text-2xl font-bold text-white mt-0.5">
            Credenciales Imprimibles, Envío WhatsApp y Cierre de Sesión
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Personaliza el diseño de las credenciales, descárgalas en PDF individual o lote A4, envíalas por WhatsApp o archiva la sesión en el Histórico.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={attendees.length === 0}
            onClick={() => {
              downloadAllCredentialsBatchPdf(attendees, config);
              retroAudio.playCheckInSuccess();
            }}
            className="min-h-[44px] px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Todas en PDF ({attendees.length})</span>
          </button>

          <button
            type="button"
            disabled={attendees.length === 0 || isArchiving}
            onClick={handleArchiveClick}
            className="min-h-[44px] px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Archive className="w-4 h-4" />
            <span>
              {isArchiving
                ? 'Guardando en Histórico...'
                : 'Guardar Sesión en Histórico y Limpiar'}
            </span>
          </button>
        </div>
      </div>

      {archiveSuccessMsg && (
        <div className="p-4 bg-emerald-950/50 border border-emerald-500/40 rounded-2xl flex items-center gap-3 text-xs text-emerald-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">{archiveSuccessMsg}</span>
        </div>
      )}

      {/* Fila Superior: Personalizador de Credencial + Vista Previa en Vivo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda (7 cols): Personalización de Credencial y Plantilla WhatsApp */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-cyan-400" />
              <span>1. Personalizar Diseño de Credencial y Mensaje WhatsApp</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                onUpdateConfig(config, true);
                retroAudio.playCheckInSuccess();
              }}
              className="px-3.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-semibold text-xs rounded-xl cursor-pointer"
            >
              Guardar Diseño
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Título Superior de la Credencial
              </label>
              <input
                type="text"
                value={config.badgeTitle}
                onChange={(e) =>
                  onUpdateConfig({ ...config, badgeTitle: e.target.value })
                }
                placeholder="Ej: CREDENCIAL OFICIAL DE ACCESO"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nota al Pie de la Credencial
              </label>
              <input
                type="text"
                value={config.badgeFooterNote}
                onChange={(e) =>
                  onUpdateConfig({ ...config, badgeFooterNote: e.target.value })
                }
                placeholder="Ej: Gracias por ser parte de nuestro evento"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Color de Acento de la Credencial
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() =>
                    onUpdateConfig({ ...config, badgeAccentColor: preset.hex })
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-2 cursor-pointer ${
                    config.badgeAccentColor === preset.hex
                      ? 'bg-slate-800 border-white text-white font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: preset.hex }}
                  />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Plantilla Personalizable de WhatsApp (Usa{' '}
              <code className="text-cyan-300">{'{nombre}'}</code>,{' '}
              <code className="text-cyan-300">{'{evento}'}</code>,{' '}
              <code className="text-cyan-300">{'{rol}'}</code>,{' '}
              <code className="text-cyan-300">{'{puntaje}'}</code>,{' '}
              <code className="text-cyan-300">{'{premio}'}</code>)
            </label>
            <textarea
              rows={3}
              value={config.whatsappTemplate}
              onChange={(e) =>
                onUpdateConfig({ ...config, whatsappTemplate: e.target.value })
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white leading-relaxed"
            />
          </div>
        </div>

        {/* Columna Derecha (5 cols): Vista Previa en Vivo de la Credencial PDF */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col items-center space-y-4">
          <div className="w-full flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              Vista Previa de Credencial PDF
            </span>
            <button
              type="button"
              onClick={() => {
                downloadSingleCredentialPdf(previewAttendee, config);
                retroAudio.playCheckInSuccess();
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar este PDF</span>
            </button>
          </div>

          <canvas
            ref={previewCanvasRef}
            width={600}
            height={760}
            className="w-full max-w-[260px] h-auto rounded-xl border border-slate-800 shadow-lg block"
          />
        </div>
      </div>

      {/* Directorio de Asistentes para Imprimir PDF Individual o Enviar por WhatsApp */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              <span>
                2. Lista de Participantes — Generar PDF o Enviar por WhatsApp ({attendees.length})
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Si el participante ingresó su número al registrarse aparece aquí; también puedes escribirlo o editarlo antes de enviar por WhatsApp.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar participante o teléfono..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white"
            />
          </div>
        </div>

        {filteredAttendees.length === 0 ? (
          <div className="p-8 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
            No hay participantes registrados en la sesión actual.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {filteredAttendees.map((att) => {
              const waUrl = buildWhatsAppCredentialUrl(
                att.phone || '',
                att,
                config
              );
              return (
                <div
                  key={att.id}
                  onClick={() => setSelectedPreviewId(att.id)}
                  className={`p-4 rounded-xl border transition-colors flex flex-col md:flex-row md:items-center md:justify-between gap-3 cursor-pointer ${
                    att.id === selectedPreviewId
                      ? 'bg-slate-950 border-cyan-400'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm font-bold text-white">
                      {att.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      <span>{att.role}</span>
                      {att.organization ? ` · ${att.organization}` : ''}
                      <span> · Puntaje: {att.arcadeScore.toLocaleString()} pts</span>
                      {att.prizeWon ? (
                        <span className="text-amber-400 font-semibold">
                          {' '}
                          · Premio: {att.prizeWon}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Controles de Teléfono WhatsApp + Botón WhatsApp + Botón PDF */}
                  <div
                    className="flex flex-wrap items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                      <input
                        type="tel"
                        value={att.phone || ''}
                        onChange={(e) =>
                          onUpdateAttendeePhone(att.id, e.target.value)
                        }
                        placeholder="WhatsApp (ej: +569...)"
                        className="w-36 bg-transparent text-xs font-mono text-white focus:outline-none"
                      />
                    </div>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar WhatsApp</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        downloadSingleCredentialPdf(att, config);
                        retroAudio.playCheckInSuccess();
                      }}
                      className="min-h-[36px] px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span>PDF Credencial</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sección 3: Histórico de Sesiones Guardadas */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              <span>
                3. Histórico de Sesiones Guardadas ({historySessions.length})
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cada vez que pulsas &ldquo;Guardar Sesión en Histórico y Limpiar&rdquo;, el registro completo queda archivado aquí y la sesión activa queda en cero.
            </p>
          </div>
        </div>

        {historySessions.length === 0 ? (
          <div className="p-8 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
            Aún no hay sesiones archivadas en el histórico. Cuando termines una jornada o grupo, usa el botón superior &ldquo;Guardar Sesión en Histórico y Limpiar&rdquo;.
          </div>
        ) : (
          <div className="space-y-3">
            {historySessions.map((sess) => (
              <div
                key={sess.id}
                className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-white">
                      {sess.eventName} · {sess.venue}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      Cerrada: {sess.closedAt} · Asistentes: {sess.attendeeCount}{' '}
                      · Récord: {sess.topScore.toLocaleString()} pts (
                      {sess.topPlayerName || 'N/A'}) · Premios entregados:{' '}
                      {sess.prizesAwardedCount}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadHistorySessionPdf(sess)}
                      className="px-3.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Reporte PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteHistorySession(sess.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 cursor-pointer"
                      aria-label="Eliminar sesión del histórico"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {sess.attendeesSummary && (
                  <pre className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300 max-h-[140px] overflow-y-auto whitespace-pre-wrap">
                    {sess.attendeesSummary}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
