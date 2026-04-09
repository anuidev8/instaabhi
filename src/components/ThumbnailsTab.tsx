import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  Image as ImageIcon,
  Loader2,
  Lock,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { useWakeLock } from '../lib/useWakeLock';
import {
  DEITIES,
  MANTRAS_INTENTS,
  generateThumbnailDraft,
  generateThumbnailImages,
  generateThumbnailPlan,
  getDefaultDeityForIntent,
  getDeityAuraColor,
  getQuickPicks,
  suggestThumbnailInput,
} from '../services/thumbnailService';
import type { HookPairUI } from '../services/thumbnailService';
import { IntentKey, ThumbnailDraft, ThumbnailPrompt } from '../types';
import { downloadThumbnailDraftAsZip } from '../utils/thumbnailZipDownload';

function StatusBadge({ status }: { status: ThumbnailDraft['status'] }) {
  const map = {
    draft: { label: 'Draft', cls: 'bg-stone-100 text-stone-600' },
    generating: { label: 'Generating…', cls: 'bg-amber-100 text-amber-700 animate-pulse' },
    ready: { label: 'Ready', cls: 'bg-emerald-100 text-emerald-800' },
    error: { label: 'Review Needed', cls: 'bg-red-100 text-red-700' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-md ${cls}`}>
      {label}
    </span>
  );
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full border border-stone-300 shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

function HookPreview({
  line1,
  line2,
  line2Color,
}: {
  line1: string;
  line2: string;
  line2Color: string;
}) {
  if (!line1 && !line2) return null;
  return (
    <div className="rounded-xl bg-stone-950 p-5 flex flex-col items-center justify-center gap-1 min-h-[100px]">
      <span className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-lg leading-tight text-center">
        {line1 || '—'}
      </span>
      <span
        className="text-lg sm:text-xl font-bold tracking-tight drop-shadow-lg leading-tight text-center"
        style={{ color: line2Color || '#FF3B3B' }}
      >
        {line2 || '—'}
      </span>
      <span className="mt-2 text-[10px] text-white/40 tracking-widest uppercase">
        THE SCHOOL OF MANTRAS
      </span>
    </div>
  );
}

interface ThumbnailsTabProps {
  thumbnailDrafts: ThumbnailDraft[];
  setThumbnailDrafts: React.Dispatch<React.SetStateAction<ThumbnailDraft[]>>;
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
}

function buildSpecText(draft: ThumbnailDraft): string {
  return [
    `Title: ${draft.prompt.title}`,
    `Deity: ${draft.prompt.deity}`,
    `Intent: ${draft.prompt.intent}`,
    `School Label: ${draft.canvaSpec.schoolLabel ?? 'SCHOOL OF MANTRAS'}`,
    `Line 1: ${draft.canvaSpec.hookWord}`,
    `Line 2: ${draft.canvaSpec.secondary}`,
    `Badge: ${draft.canvaSpec.badge ?? ''}`,
    `SEO Title: ${draft.canvaSpec.seoTitle ?? ''}`,
    `Line 1 Color: ${draft.canvaSpec.colors.hook}`,
    `Line 2 Color: ${draft.canvaSpec.colors.secondary}`,
    `Badge Color: ${draft.canvaSpec.colors.badge ?? '#FFFFFF'}`,
    `Aura Color: ${draft.canvaSpec.colors.aura ?? draft.canvaSpec.colors.brand}`,
    `Brand Color: ${draft.canvaSpec.colors.brand}`,
  ].join('\n');
}

function formatCreatedAt(value: Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const BADGE_OPTIONS = ['108x', '40 Days', 'Body, Mind & Soul', 'Daily Practice'];

export default function ThumbnailsTab({
  thumbnailDrafts,
  setThumbnailDrafts,
  initialPrompt,
  onInitialPromptConsumed,
}: ThumbnailsTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'form' | 'preview'>('form');
  const [previewPlan, setPreviewPlan] = useState<ThumbnailDraft | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuggestingInput, setIsSuggestingInput] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [copiedSpecId, setCopiedSpecId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [suggestionRefreshKey, setSuggestionRefreshKey] = useState(0);
  const [lockUserText, setLockUserText] = useState(false);
  const [touched, setTouched] = useState({ title: false, line1: false, line2: false });

  const [input, setInput] = useState<ThumbnailPrompt>({
    title: '',
    deity: getDefaultDeityForIntent('abundance'),
    intent: 'abundance',
    line1: '',
    line2: '',
    badge: '108x',
    special: '',
  });

  useWakeLock(isPlanning || isGenerating || isSuggestingInput || !!regeneratingId);

  const quickPicks = getQuickPicks(input.intent);
  const compatibleDeities = DEITIES.filter((d) => d.intents.includes(input.intent));
  const otherDeities = DEITIES.filter((d) => !d.intents.includes(input.intent));
  const selectedAura = getDeityAuraColor(input.deity);
  const line2Color = quickPicks.defaultAura
    ? MANTRAS_INTENTS.find((i) => i.key === input.intent)?.color ?? '#FF3B3B'
    : '#FF3B3B';

  // Auto-set deity when intent changes
  useEffect(() => {
    const isCompatible = compatibleDeities.some((d) => d.name === input.deity);
    if (!isCompatible) {
      setInput((prev) => ({
        ...prev,
        deity: getDefaultDeityForIntent(prev.intent),
      }));
    }
  }, [input.intent]);

  // Consume initial prompt
  useEffect(() => {
    if (!initialPrompt) return;
    setInput((prev) => ({
      ...prev,
      title: initialPrompt,
      deity: prev.deity || getDefaultDeityForIntent(prev.intent),
    }));
    setTouched((prev) => ({ ...prev, title: true }));
    setIsModalOpen(true);
    onInitialPromptConsumed?.();
  }, [initialPrompt, onInitialPromptConsumed]);

  // AI title suggestion (only when not locked and not manually touched)
  useEffect(() => {
    if (!isModalOpen || !input.deity.trim()) return;
    if (lockUserText || touched.title) return;

    let cancelled = false;
    setIsSuggestingInput(true);

    suggestThumbnailInput({
      deity: input.deity,
      intent: input.intent,
      topicSeed: initialPrompt?.trim() || undefined,
    })
      .then((suggestion) => {
        if (cancelled) return;
        setInput((prev) => ({ ...prev, title: suggestion.title }));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to suggest thumbnail input:', error);
        setModalError(
          error instanceof Error ? error.message : 'Failed to generate AI suggestion.'
        );
      })
      .finally(() => {
        if (!cancelled) setIsSuggestingInput(false);
      });

    return () => { cancelled = true; };
  }, [isModalOpen, input.deity, input.intent, initialPrompt, suggestionRefreshKey, lockUserText, touched.title]);

  const resetModal = () => {
    setInput({
      title: '',
      deity: getDefaultDeityForIntent('abundance'),
      intent: 'abundance',
      line1: '',
      line2: '',
      badge: '108x',
      special: '',
    });
    setModalError(null);
    setSuggestionRefreshKey(0);
    setModalStep('form');
    setPreviewPlan(null);
    setLockUserText(false);
    setTouched({ title: false, line1: false, line2: false });
  };

  const handleSelectHookPair = (pair: HookPairUI) => {
    setInput((prev) => ({ ...prev, line1: pair.line1, line2: pair.line2 }));
    if (!lockUserText) setTouched((prev) => ({ ...prev, line1: false, line2: false }));
  };

  const handleGeneratePlan = async () => {
    if (!input.title.trim()) {
      setModalError('YouTube title is required.');
      return;
    }
    if (!input.deity.trim()) {
      setModalError('Choose a deity before generating.');
      return;
    }

    const draftInput: ThumbnailPrompt = {
      title: input.title.trim(),
      deity: input.deity.trim(),
      intent: input.intent,
      line1: input.line1?.trim() || undefined,
      line2: input.line2?.trim() || undefined,
      badge: input.badge?.trim() || undefined,
      special: input.special?.trim() || undefined,
    };

    setModalError(null);
    setIsPlanning(true);

    try {
      const plan = await generateThumbnailPlan(draftInput);
      setPreviewPlan(plan);
      setModalStep('preview');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate plan.';
      setModalError(message);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!previewPlan) return;
    setModalError(null);
    setIsGenerating(true);
    setThumbnailDrafts((prev) => [{ ...previewPlan, status: 'generating' }, ...prev]);

    try {
      const completed = await generateThumbnailImages(previewPlan);
      setThumbnailDrafts((prev) =>
        prev.map((d) => (d.id === previewPlan.id ? completed : d))
      );
      setIsModalOpen(false);
      resetModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate images.';
      setModalError(message);
      setThumbnailDrafts((prev) =>
        prev.map((d) =>
          d.id === previewPlan.id ? { ...d, status: 'error', errorMessage: message } : d
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async (draft: ThumbnailDraft) => {
    setRegeneratingId(draft.id);
    setThumbnailDrafts((prev) =>
      prev.map((d) =>
        d.id === draft.id ? { ...d, status: 'generating', errorMessage: undefined } : d
      )
    );
    try {
      const regenerated = await generateThumbnailDraft(draft.prompt);
      setThumbnailDrafts((prev) =>
        prev.map((d) => (d.id === draft.id ? { ...regenerated, id: draft.id } : d))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to regenerate.';
      setThumbnailDrafts((prev) =>
        prev.map((d) =>
          d.id === draft.id ? { ...d, status: 'error', errorMessage: message } : d
        )
      );
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleDelete = (id: string) => {
    setThumbnailDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const handleCopySpec = async (draft: ThumbnailDraft) => {
    await navigator.clipboard.writeText(buildSpecText(draft));
    setCopiedSpecId(draft.id);
    setTimeout(() => setCopiedSpecId(null), 2000);
  };

  const handleExport = async (draft: ThumbnailDraft) => {
    setExportingId(draft.id);
    try {
      await downloadThumbnailDraftAsZip(draft);
    } finally {
      setExportingId(null);
    }
  };

  // Derive top-card data
  const firstPair = quickPicks.hookPairs[0];
  const hookPairLabel = firstPair ? `${firstPair.line1} / ${firstPair.line2}` : '—';
  const bestDeityMatch = quickPicks.deities[0] ?? '—';

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
            YouTube Thumbnails
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Generate a thumbnail using left-side deity composition, ultra-clean right-side
            text, and a high-contrast 2-line hook.
          </p>
        </div>
        <button
          onClick={() => {
            setModalError(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors min-h-[44px] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Thumbnail
        </button>
      </div>

      {/* ── Top Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">Drafts</p>
          <p className="mt-2 text-2xl font-bold text-stone-900">{thumbnailDrafts.length}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">
            Recommended Hook
          </p>
          <p className="mt-2 text-base font-bold text-stone-900 leading-tight">{hookPairLabel}</p>
          <p className="mt-1 text-xs text-stone-500">{input.intent} intent</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">
            Best Deity Match
          </p>
          <p className="mt-2 text-base font-bold text-stone-900">{bestDeityMatch}</p>
          <p className="mt-1 text-xs text-stone-500">
            {quickPicks.deities.slice(1).join(', ') || '—'}
          </p>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">
            Aura Color
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-lg border border-stone-200"
              style={{ backgroundColor: selectedAura }}
            />
            <span className="text-xs font-mono text-stone-600">{selectedAura}</span>
          </div>
        </div>
      </div>

      {/* ── Empty State ── */}
      {thumbnailDrafts.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-500">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-stone-900">No thumbnail drafts yet</h3>
          <p className="mt-2 text-sm text-stone-500 max-w-xl mx-auto">
            Build a new thumbnail from an intent, deity, and 2-line hook. Review the structure
            first, then generate 2 final variants.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {thumbnailDrafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden"
            >
              {/* Draft header */}
              <div className="p-4 sm:p-5 border-b border-stone-100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={draft.status} />
                      <span className="text-xs text-stone-400">
                        {formatCreatedAt(draft.createdAt)}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-stone-900">
                        {draft.prompt.title}
                      </h3>
                      <p className="text-sm text-stone-500 mt-1">
                        {draft.prompt.deity} · {draft.prompt.intent}
                        {draft.prompt.special ? ` · ${draft.prompt.special}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleCopySpec(draft)}
                      className="px-3 py-2 rounded-lg border border-stone-200 hover:border-stone-300 hover:bg-stone-50 text-sm font-medium text-stone-700 transition-colors min-h-[40px]"
                    >
                      {copiedSpecId === draft.id ? 'Copied!' : 'Copy Thumbnail Spec'}
                    </button>
                    <button
                      onClick={() => handleRegenerate(draft)}
                      disabled={regeneratingId === draft.id || draft.status === 'generating'}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 hover:border-amber-300 hover:bg-amber-50 text-sm font-medium text-stone-700 hover:text-amber-700 transition-colors disabled:opacity-60 min-h-[40px]"
                    >
                      {regeneratingId === draft.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="w-4 h-4" />
                      )}
                      Regenerate
                    </button>
                    <button
                      onClick={() => handleExport(draft)}
                      disabled={draft.baseImages.length === 0 || exportingId === draft.id}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-60 min-h-[40px]"
                    >
                      {exportingId === draft.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Export ZIP
                    </button>
                    <button
                      onClick={() => handleDelete(draft.id)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 hover:border-red-300 hover:bg-red-50 text-sm font-medium text-stone-700 hover:text-red-700 transition-colors min-h-[40px]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Draft body */}
              <div className="p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_320px] gap-5">
                <div>
                  {draft.baseImages.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {draft.baseImages.map((image, index) => (
                        <div
                          key={index}
                          className="rounded-2xl overflow-hidden border border-stone-200 bg-stone-100"
                        >
                          <div className="aspect-video">
                            <img
                              src={image}
                              alt={`${draft.prompt.title} variant ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="px-3 py-2 text-xs text-stone-500 border-t border-stone-200">
                            Variant {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center text-sm text-stone-500">
                      {draft.status === 'generating'
                        ? 'Generating image variants…'
                        : 'No preview images yet.'}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Thumbnail Text Plan */}
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <p className="text-sm font-semibold text-stone-900">Thumbnail Text Plan</p>
                    </div>
                    <HookPreview
                      line1={draft.canvaSpec.hookWord.split(/\s+/).slice(0, Math.ceil(draft.canvaSpec.hookWord.split(/\s+/).length / 2)).join(' ')}
                      line2={draft.canvaSpec.hookWord.split(/\s+/).slice(Math.ceil(draft.canvaSpec.hookWord.split(/\s+/).length / 2)).join(' ')}
                      line2Color={draft.canvaSpec.colors.secondary}
                    />
                    <div className="space-y-1.5 text-sm text-stone-600">
                      <p>
                        <span className="font-semibold text-stone-900">2-Line Hook:</span>{' '}
                        {draft.canvaSpec.hookWord || 'Pending'}
                      </p>
                      <p>
                        <span className="font-semibold text-stone-900">SEO Title:</span>{' '}
                        {draft.canvaSpec.seoTitle || 'Pending'}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <ColorDot color={draft.canvaSpec.colors.hook} />
                          <span className="text-xs">Line 1</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <ColorDot color={draft.canvaSpec.colors.secondary} />
                          <span className="text-xs">Line 2</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <ColorDot
                            color={
                              draft.canvaSpec.colors.aura ?? draft.canvaSpec.colors.brand
                            }
                          />
                          <span className="text-xs">Aura</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {draft.errorMessage && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>{draft.errorMessage}</p>
                      </div>
                    </div>
                  )}

                  {!!draft.validationSummary?.length && (
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <p className="text-sm font-semibold text-stone-900">Validation Notes</p>
                      <div className="mt-3 space-y-2">
                        {draft.validationSummary.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-2 text-sm text-stone-600"
                          >
                            {item.toLowerCase().includes('passed') ? (
                              <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
                            )}
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!!draft.generationPrompts?.length && (
                    <details className="rounded-2xl border border-stone-200 bg-white p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-stone-900">
                        Image Prompt
                      </summary>
                      <div className="mt-3 space-y-3">
                        {draft.generationPrompts.map((prompt, index) => (
                          <div
                            key={index}
                            className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-xs leading-relaxed text-stone-600"
                          >
                            <p>{prompt}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ────────────────── Modal ────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
            onClick={() => {
              if (isGenerating || isPlanning) return;
              setIsModalOpen(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="px-5 py-4 border-b border-stone-100 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {modalStep === 'preview' && (
                    <button
                      onClick={() => {
                        if (isGenerating) return;
                        setModalStep('form');
                        setModalError(null);
                      }}
                      className="p-2 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-stone-900">
                      {modalStep === 'form' ? 'New YouTube Thumbnail' : 'Review Generation Plan'}
                    </h3>
                    <p className="text-sm text-stone-500 mt-1">
                      {modalStep === 'form'
                        ? 'Step 1 — Choose the intent, deity, and hook direction. Then review the title and full generation plan.'
                        : 'Step 2 — Review and edit the generated plan. Tweak the prompt if needed, then generate.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (isGenerating) return;
                    setIsModalOpen(false);
                  }}
                  className="p-2 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ─── FORM STEP ─── */}
              {modalStep === 'form' ? (
                <>
                  <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* 1. Intent */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-stone-800">Intent</label>
                      <select
                        value={input.intent}
                        onChange={(e) => {
                          const newIntent = e.target.value as IntentKey;
                          setInput((prev) => ({ ...prev, intent: newIntent, line1: '', line2: '' }));
                          setTouched((prev) => ({ ...prev, line1: false, line2: false }));
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                      >
                        {MANTRAS_INTENTS.map((intent) => (
                          <option key={intent.key} value={intent.key}>
                            {intent.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Deity — text input with autocomplete + quick picks */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-stone-800">Deity</label>
                      <input
                        list="deity-options"
                        value={input.deity}
                        onChange={(e) => setInput((prev) => ({ ...prev, deity: e.target.value }))}
                        placeholder="Type a deity name or select below"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                      />
                      <datalist id="deity-options">
                        {compatibleDeities.map((d) => (
                          <option key={d.name} value={d.name} />
                        ))}
                        {otherDeities.map((d) => (
                          <option key={d.name} value={d.name} />
                        ))}
                      </datalist>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {compatibleDeities.map((d) => (
                          <button
                            key={d.name}
                            onClick={() => setInput((prev) => ({ ...prev, deity: d.name }))}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                              input.deity === d.name
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white border border-stone-200 text-stone-600 hover:border-emerald-300 hover:text-emerald-700'
                            }`}
                          >
                            {d.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. Hook Quick Picks */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">
                        Hook Quick Picks
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {quickPicks.hookPairs.map((pair, i) => {
                          const isActive =
                            input.line1 === pair.line1 && input.line2 === pair.line2;
                          return (
                            <button
                              key={i}
                              onClick={() => handleSelectHookPair(pair)}
                              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                                isActive
                                  ? 'bg-stone-900 text-white'
                                  : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-400'
                              }`}
                            >
                              <span className="font-bold">{pair.line1}</span>
                              <span className="opacity-50 mx-1">/</span>
                              <span style={{ color: isActive ? undefined : line2Color }}>
                                {pair.line2}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. Line 1 + Line 2 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-stone-800">
                          Line 1{' '}
                          <span className="text-stone-400 font-normal">(command / action)</span>
                        </label>
                        <input
                          value={input.line1 ?? ''}
                          onChange={(e) => {
                            setInput((prev) => ({ ...prev, line1: e.target.value }));
                            setTouched((prev) => ({ ...prev, line1: true }));
                          }}
                          placeholder="e.g. STOP THE"
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-stone-800">
                          Line 2{' '}
                          <span className="text-stone-400 font-normal">(emotion / promise)</span>
                        </label>
                        <input
                          value={input.line2 ?? ''}
                          onChange={(e) => {
                            setInput((prev) => ({ ...prev, line2: e.target.value }));
                            setTouched((prev) => ({ ...prev, line2: true }));
                          }}
                          placeholder="e.g. PAIN NOW"
                          style={{ color: line2Color }}
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    {/* Mini hook preview */}
                    {(input.line1 || input.line2) && (
                      <HookPreview
                        line1={input.line1 ?? ''}
                        line2={input.line2 ?? ''}
                        line2Color={line2Color}
                      />
                    )}

                    {/* 5. YouTube Title */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-sm font-medium text-stone-800">YouTube Title</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setLockUserText((v) => !v)}
                            className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                              lockUserText ? 'text-amber-700' : 'text-stone-400'
                            }`}
                            title={lockUserText ? 'AI suggestions locked' : 'AI suggestions active'}
                          >
                            {lockUserText ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
                            )}
                            {lockUserText ? 'Locked' : 'Auto'}
                          </button>
                          <button
                            onClick={() => {
                              setTouched((prev) => ({ ...prev, title: false }));
                              setLockUserText(false);
                              setSuggestionRefreshKey((v) => v + 1);
                            }}
                            disabled={isSuggestingInput}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 disabled:opacity-60"
                          >
                            {isSuggestingInput ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                            Refresh AI
                          </button>
                        </div>
                      </div>
                      <input
                        value={input.title}
                        onChange={(e) => {
                          setInput((prev) => ({ ...prev, title: e.target.value }));
                          setTouched((prev) => ({ ...prev, title: true }));
                        }}
                        placeholder="AI suggests a title based on deity + intent"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                      />
                    </div>

                    {/* 6. Badge */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-stone-800">Badge Suffix</label>
                      <div className="flex flex-wrap gap-2">
                        {BADGE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setInput((prev) => ({ ...prev, badge: opt }))}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                              input.badge === opt
                                ? 'bg-stone-900 text-white'
                                : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-400'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 7. Optional special note */}
                    <details className="group">
                      <summary className="text-sm font-medium text-stone-500 cursor-pointer hover:text-stone-700 transition-colors">
                        Optional special note
                      </summary>
                      <textarea
                        value={input.special ?? ''}
                        onChange={(e) =>
                          setInput((prev) => ({ ...prev, special: e.target.value }))
                        }
                        placeholder="Any special instructions for this thumbnail…"
                        rows={2}
                        className="mt-2 w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-none"
                      />
                    </details>

                    {/* Strategy summary */}
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-stone-600">
                      <div>
                        <span className="font-semibold text-stone-800">Intent:</span>{' '}
                        {input.intent}
                      </div>
                      <div>
                        <span className="font-semibold text-stone-800">Deity:</span>{' '}
                        {input.deity}
                      </div>
                      <div>
                        <span className="font-semibold text-stone-800">Hook:</span>{' '}
                        {input.line1 && input.line2
                          ? `${input.line1} / ${input.line2}`
                          : 'AI will pick'}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-stone-800">Text:</span>
                        <span>White +</span>
                        <ColorDot color={line2Color} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-stone-800">Aura:</span>
                        <ColorDot color={selectedAura} />
                        <span className="font-mono">{selectedAura}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-stone-800">Badge:</span>{' '}
                        {input.badge || '108x'}
                      </div>
                    </div>

                    {/* AI Planning Engine info */}
                    <div className="rounded-xl border border-stone-200 bg-emerald-50/60 p-3 text-sm text-stone-600">
                      <div className="flex items-center gap-2 text-emerald-700 font-medium text-xs">
                        {isSuggestingInput ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        AI Planning Engine
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        Suggests title direction, hook structure, and thumbnail setup based on
                        selected deity, intent, and School of Mantras rules.
                      </p>
                    </div>

                    {modalError && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <p>{modalError}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Form footer */}
                  <div className="px-5 py-4 border-t border-stone-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-stone-400">
                      Generate the plan and image prompt for review before creating the thumbnail.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (isPlanning) return;
                          setIsModalOpen(false);
                        }}
                        className="px-4 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-sm font-medium text-stone-700 transition-colors min-h-[44px]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleGeneratePlan}
                        disabled={isPlanning || isSuggestingInput}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-60 min-h-[44px]"
                      >
                        {isPlanning ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                        {isPlanning ? 'Generating Plan…' : 'Generate & Preview Plan'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* ─── PREVIEW STEP ─── */
                <>
                  <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    {previewPlan && (
                      <>
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-4">
                          <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            Generation Plan Ready
                          </div>

                          {/* Visual hook preview */}
                          <HookPreview
                            line1={previewPlan.canvaSpec.hookWord.split(/\s+/).slice(0, Math.ceil(previewPlan.canvaSpec.hookWord.split(/\s+/).length / 2)).join(' ')}
                            line2={previewPlan.canvaSpec.hookWord.split(/\s+/).slice(Math.ceil(previewPlan.canvaSpec.hookWord.split(/\s+/).length / 2)).join(' ')}
                            line2Color={previewPlan.canvaSpec.colors.secondary}
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider">
                                2-Line Hook
                              </p>
                              <p className="mt-1 text-lg font-bold text-stone-900">
                                {previewPlan.canvaSpec.hookWord || '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider">
                                SEO Title
                              </p>
                              <p className="mt-1 text-sm font-medium text-stone-700">
                                {previewPlan.canvaSpec.seoTitle || '—'}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider">
                                Deity
                              </p>
                              <p className="mt-1 font-medium text-stone-800">
                                {previewPlan.prompt.deity}
                              </p>
                            </div>
                            <div>
                              <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider">
                                Intent
                              </p>
                              <p className="mt-1 font-medium text-stone-800">
                                {previewPlan.prompt.intent}
                              </p>
                            </div>
                            <div>
                              <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider">
                                Line 2 Color
                              </p>
                              <div className="mt-1 flex items-center gap-2">
                                <ColorDot color={previewPlan.canvaSpec.colors.secondary} />
                                <span className="text-xs font-mono text-stone-600">
                                  {previewPlan.canvaSpec.colors.secondary}
                                </span>
                              </div>
                            </div>
                            <div>
                              <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider">
                                Aura Color
                              </p>
                              <div className="mt-1 flex items-center gap-2">
                                <ColorDot
                                  color={
                                    previewPlan.canvaSpec.colors.aura ??
                                    previewPlan.canvaSpec.colors.brand
                                  }
                                />
                                <span className="text-xs font-mono text-stone-600">
                                  {previewPlan.canvaSpec.colors.aura ??
                                    previewPlan.canvaSpec.colors.brand}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {previewPlan.generationPrompts?.map((prompt, index) => (
                          <div
                            key={index}
                            className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-stone-900">
                                Image Prompt
                              </p>
                              <button
                                onClick={() => navigator.clipboard.writeText(prompt)}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-700 transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                Copy
                              </button>
                            </div>
                            <textarea
                              value={prompt}
                              onChange={(e) => {
                                const updated = [...(previewPlan.generationPrompts ?? [])];
                                updated[index] = e.target.value;
                                setPreviewPlan({
                                  ...previewPlan,
                                  generationPrompts: updated,
                                });
                              }}
                              rows={8}
                              className="w-full text-xs leading-relaxed text-stone-600 bg-white border border-stone-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-y"
                            />
                          </div>
                        ))}
                      </>
                    )}

                    {modalError && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <p>{modalError}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Preview footer */}
                  <div className="px-5 py-4 border-t border-stone-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-stone-400">
                      Review and edit the prompt above. Click Generate to create the thumbnail.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (isGenerating) return;
                          setModalStep('form');
                          setModalError(null);
                        }}
                        className="px-4 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-sm font-medium text-stone-700 transition-colors min-h-[44px]"
                      >
                        Back to Form
                      </button>
                      <button
                        onClick={handleGenerateImages}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-60 min-h-[44px]"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        {isGenerating ? 'Generating Image…' : 'Generate Thumbnail'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
