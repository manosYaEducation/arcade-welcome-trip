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
  Sliders,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';
import { Attendee, EventConfig, EventHistorySession } from '../types';
import {
  buildWhatsAppCredentialUrl,
  downloadAllCredentialsBatchPdf,
  downloadHistorySessionPdf,
  downloadSingleCredentialPdf,
  parseHistoryAttendeesSummary,
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
  onLoadSampleTestAttendees: () => Promise<void>;
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
  onLoadSampleTestAttendees,
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
      name: 'Carolina Pérez',
      role: 'Desarrollo / Ingeniería',
      organization: 'Tech Studio',
      wordForCloud: 'Innovación',
      checkedInAt: '09:30',
      arcadeScore: 2450,
      maxCombo: 4,
      playedArcade: true,
      prizeWon: 'Café de Especialidad',
      phone: '+56987654321',
    };

  // Dibujar vista previa en vivo cuando cambia el diseño, los interruptores automáticos o el asistente seleccionado
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
            CONFIGURACIÓN AUTOMÁTICA DE PDF · WHATSAPP · HISTÓRICO DE SESIONES
          </div>
          <h2 className="text-2xl font-bold text-white mt-0.5">
            Credenciales PDF Automáticas, Envío WhatsApp y Cierre de Jornada
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configura qué datos lleva el PDF de forma automática (sin contaminar la credencial con datos internos de la Tómbola), envía por WhatsApp o archiva la sesión lista en el Histórico.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {attendees.length === 0 && (
            <button
              type="button"
              onClick={onLoadSampleTestAttendees}
              className="min-h-[44px] px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 font-semibold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Cargar 3 Asistentes de Prueba</span>
            </button>
          )}

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
            <span>Imprimir Plancha A4 PDF ({attendees.length})</span>
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

      {/* Fila Superior: Configurador Automático de PDF + Vista Previa en Vivo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda (7 cols): Configurador Automático de PDF y Plantilla WhatsApp */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-cyan-400" />
              <span>1. Configuración Automática de los PDF y WhatsApp</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                onUpdateConfig(config, true);
                retroAudio.playCheckInSuccess();
              }}
              className="px-3.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-semibold text-xs rounded-xl cursor-pointer"
            >
              Guardar en Nube
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Título Superior del PDF / Credencial
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
                Subtítulo u Organizador en el PDF
              </label>
              <input
                type="text"
                value={config.subtitle}
                onChange={(e) =>
                  onUpdateConfig({ ...config, subtitle: e.target.value })
                }
                placeholder="Ej: Recepción Interactiva"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Nota al Pie del PDF
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

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Color de Acento del PDF y Diploma
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

          {/* Interruptores Automáticos del PDF */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <Sliders className="w-4 h-4" />
              <span>Campos y Comportamiento Automático del PDF</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <label className="flex items-center gap-2.5 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.pdfShowQr !== false}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, pdfShowQr: e.target.checked })
                  }
                  className="rounded border-slate-600 text-cyan-500"
                />
                <span>Incluir Código QR de verificación</span>
              </label>

              <label className="flex items-center gap-2.5 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.pdfShowRoleOrg !== false}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      pdfShowRoleOrg: e.target.checked,
                    })
                  }
                  className="rounded border-slate-600 text-cyan-500"
                />
                <span>Incluir Rol y Empresa del asistente</span>
              </label>

              <label className="flex items-center gap-2.5 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.pdfShowScore !== false}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      pdfShowScore: e.target.checked,
                    })
                  }
                  className="rounded border-slate-600 text-cyan-500"
                />
                <span>Incluir Puntaje del Juego Arcade</span>
              </label>

              <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.pdfShowPrize === true}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      pdfShowPrize: e.target.checked,
                    })
                  }
                  className="rounded border-slate-600 text-amber-500"
                />
                <span>
                  Mostrar premio Tómbola (Oculto por defecto)
                </span>
              </label>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-center gap-2.5 text-xs text-amber-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.pdfAutoDownloadOnCheckIn === true}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      pdfAutoDownloadOnCheckIn: e.target.checked,
                    })
                  }
                  className="rounded border-slate-600 text-amber-500"
                />
                <span>
                  Generar y descargar PDF automáticamente apenas una persona se registra (Modo Recepción / Impresora)
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Plantilla Automática de WhatsApp (Variables:{' '}
              <code className="text-cyan-300">{'{nombre}'}</code>,{' '}
              <code className="text-cyan-300">{'{evento}'}</code>,{' '}
              <code className="text-cyan-300">{'{rol}'}</code>,{' '}
              <code className="text-cyan-300">{'{puntaje}'}</code>)
            </label>
            <textarea
              rows={2}
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
            <div>
              <span className="text-xs font-semibold text-white block">
                Vista Previa en Vivo del PDF
              </span>
              <span className="text-[11px] text-slate-400">
                Limpia y sin datos de Tómbola por defecto
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                downloadSingleCredentialPdf(previewAttendee, config);
                retroAudio.playCheckInSuccess();
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Probar PDF</span>
            </button>
          </div>

          <canvas
            ref={previewCanvasRef}
            width={600}
            height={760}
            className="w-full max-w-[270px] h-auto rounded-xl border border-slate-800 shadow-lg block"
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
                2. Participantes Registrados — Descargar PDF o Enviar por WhatsApp ({attendees.length})
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Haz clic en cualquier participante para previsualizar su credencial arriba, edita su teléfono si lo deseas y envíale su credencial por WhatsApp.
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
          <div className="p-8 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-3">
            <p className="text-xs text-slate-400">
              No hay participantes registrados en la sesión activa.
            </p>
            <button
              type="button"
              onClick={onLoadSampleTestAttendees}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-semibold text-xs rounded-xl inline-flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cargar 3 Asistentes de Prueba para probar PDF y WhatsApp</span>
            </button>
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
                      <span> · {att.arcadeScore.toLocaleString()} pts</span>
                      <span> · Palabra: {att.wordForCloud}</span>
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

      {/* Sección 3: Histórico de Sesiones Guardadas (Con tabla limpia en vez de JSON crudo) */}
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
              Al pulsar &ldquo;Guardar Sesión en Histórico y Limpiar&rdquo;, la jornada queda archivada con su tabla de asistentes y la sesión activa queda limpia para un nuevo grupo.
            </p>
          </div>
        </div>

        {historySessions.length === 0 ? (
          <div className="p-8 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
            Aún no hay sesiones archivadas en el histórico.
          </div>
        ) : (
          <div className="space-y-4">
            {historySessions.map((sess) => {
              const items = parseHistoryAttendeesSummary(sess.attendeesSummary);
              return (
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
                        Cerrada: {sess.closedAt} · Asistentes:{' '}
                        {sess.attendeeCount} · Récord:{' '}
                        {sess.topScore.toLocaleString()} pts (
                        {sess.topPlayerName || 'N/A'}) · Premios Tómbola:{' '}
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
                        <span>Descargar Acta PDF</span>
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

                  {items.length > 0 && (
                    <div className="overflow-x-auto border border-slate-800 rounded-xl">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Participante</th>
                            <th className="py-2 px-3">Área / Perfil</th>
                            <th className="py-2 px-3">Puntaje Arcade</th>
                            <th className="py-2 px-3">Premio Tómbola</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {items.map((item, idx) => (
                            <tr key={idx} className="bg-slate-950">
                              <td className="py-2 px-3 font-mono text-slate-500">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3 font-semibold text-white">
                                {item.name}
                              </td>
                              <td className="py-2 px-3">{item.role || '-'}</td>
                              <td className="py-2 px-3 font-mono text-cyan-400">
                                {item.score.toLocaleString()} pts
                              </td>
                              <td className="py-2 px-3 text-amber-400">
                                {item.prize || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sección 4: Contraparte de Evaluación de UX y Coherencia del MVP */}
      <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
          <ClipboardCheck className="w-5 h-5" />
          <span>
            Evaluación de UX y Puntos de Coherencia Aplicados al MVP
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-bold text-white">
              1. Separación Tómbola vs. Credencial PDF
            </div>
            <p className="text-slate-400">
              Antes las credenciales PDF y diplomas mostraban un bloque fijo de &ldquo;Premio Tómbola: En sorteo&rdquo;. Se eliminó ese ruido por defecto: la credencial ahora es un documento limpio de acceso (QR, Rol, Palabra Clave y Puntaje), y la Tómbola queda 100% en manos del Admin.
            </p>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-bold text-white">
              2. Privacidad entre Asistentes en Vista Móvil
            </div>
            <p className="text-slate-400">
              Antes en &ldquo;3. Mi Pase y Diploma&rdquo; aparecía un selector que permitía a un asistente ver el pase de otras personas registradas. Se eliminó para que cada asistente vea únicamente su propio pase y diploma.
            </p>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-bold text-white">
              3. Administración Integral de la Tómbola en una sola pestaña
            </div>
            <p className="text-slate-400">
              Antes para cambiar el stock o crear premios había que salir de la Tómbola e ir a Ajustes. Ahora la pestaña &ldquo;1. Tómbola Admin&rdquo; incluye control directo de stock (+/-), alta de premios y botón &ldquo;Al agua / Re-sortear&rdquo; que devuelve el premio al inventario si el ganador no está presente.
            </p>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-bold text-white">
              4. Histórico Legible + Modo Recepción Automático
            </div>
            <p className="text-slate-400">
              El Histórico ahora presenta una tabla clara de participantes y genera un Acta PDF estructurada (en vez de JSON crudo), y se añadió el interruptor para auto-descargar el PDF apenas alguien se registra.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
