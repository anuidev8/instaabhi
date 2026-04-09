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
import { useWakeLock } from '../../lib/useWakeLock';
import {
  generateSchoolOfBreathThumbnailDraft,
  generateSchoolOfBreathThumbnailImages,
  generateSchoolOfBreathThumbnailPlan,
  getSchoolOfBreathDefaultInput,
  getSchoolOfBreathQuickPickSet,
  SchoolOfBreathThumbnailInput,
  SOB_THUMBNAIL_CATEGORIES,
  suggestSchoolOfBreathInput,
} from '../../services/schoolOfBreathThumbnailService';
import {
  SchoolOfBreathCategory,
  SchoolOfBreathHookFamily,
  SchoolOfBreathMode,
  ThumbnailDraft,
} from '../../types';
import { downloadThumbnailDraftAsZip } from '../../utils/thumbnailZipDownload';

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
  topLine,
  hook,
  bottomStrip,
  hookColor,
}: {
  topLine: string;
  hook: string;
  bottomStrip: string;
  hookColor: string;
}) {
  return (
    <div className="rounded-xl bg-stone-950 p-5 flex flex-col items-center justify-center gap-2 min-h-[120px]">
      <span className="text-[11px] font-semibold tracking-[0.2em] text-white/70 uppercase text-center">
        {topLine || 'BREATH PROTOCOL'}
      </span>
      <span
        className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-lg leading-tight text-center uppercase"
        style={{ color: hookColor || '#FFD400' }}
      >
        {hook || 'DO IT THIS WAY'}
      </span>
      <span className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold tracking-wider uppercase">
        {bottomStrip || 'WATCH NOW'}
      </span>
    </div>
  );
}

interface SchoolOfBreathThumbnailsTabProps {
  thumbnailDrafts: ThumbnailDraft[];
  setThumbnailDrafts: React.Dispatch<React.SetStateAction<ThumbnailDraft[]>>;
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
}

function buildSpecText(draft: ThumbnailDraft): string {
  const sob = draft.prompt.schoolOfBreath;
  return [
    `Brand: SCHOOL OF BREATH`,
    `Title: ${draft.prompt.title}`,
    `Category: ${sob?.category ?? 'technique'}`,
    `Mode: ${sob?.mode ?? 'with_character'}`,
    `Hook Family: ${sob?.hookFamily ?? 'instruction'}`,
    `Top Line: ${sob?.topLine ?? ''}`,
    `Main Hook: ${draft.canvaSpec.hookWord}`,
    `Bottom Strip: ${sob?.bottomStrip ?? draft.canvaSpec.badge ?? ''}`,
    `Support Visual: ${sob?.supportVisual ?? ''}`,
    `Color Emphasis: ${sob?.colorEmphasis ?? ''}`,
    `Background Style: ${sob?.backgroundStyle ?? ''}`,
    `SEO Title: ${draft.canvaSpec.seoTitle ?? ''}`,
    `Hook Color: ${draft.canvaSpec.colors.hook}`,
    `Secondary Color: ${draft.canvaSpec.colors.secondary}`,
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

const MODE_OPTIONS: Array<{ key: SchoolOfBreathMode; label: string }> = [
  { key: 'with_character', label: 'With Character (Abhi)' },
  { key: 'without_character', label: 'Without Character' },
];

export default function SchoolOfBreathThumbnailsTab({
  thumbnailDrafts,
  setThumbnailDrafts,
  initialPrompt,
  onInitialPromptConsumed,
}: SchoolOfBreathThumbnailsTabProps) {
  const defaultInput = getSchoolOfBreathDefaultInput();
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
  const [touched, setTouched] = useState({
    title: false,
    mainHook: false,
    topLine: false,
    bottomStrip: false,
  });

  const [input, setInput] = useState<SchoolOfBreathThumbnailInput>(defaultInput);

  useWakeLock(isPlanning || isGenerating || isSuggestingInput || !!regeneratingId);

  const quickPicks = getSchoolOfBreathQuickPickSet(input.category, input.hookFamily);

  useEffect(() => {
    if (!quickPicks.hookFamilies.includes(input.hookFamily)) {
      setInput((prev) => ({ ...prev, hookFamily: quickPicks.hookFamilies[0] }));
    }
  }, [input.category, input.hookFamily, quickPicks.hookFamilies]);

  useEffect(() => {
    setInput((prev) => {
      let changed = false;
      let next = prev;

      if (!touched.mainHook && quickPicks.hooks[0] && prev.mainHook !== quickPicks.hooks[0]) {
        next = { ...next, mainHook: quickPicks.hooks[0] };
        changed = true;
      }

      if (!touched.topLine && quickPicks.topLines[0] && prev.topLine !== quickPicks.topLines[0]) {
        next = { ...next, topLine: quickPicks.topLines[0] };
        changed = true;
      }

      if (
        !touched.bottomStrip &&
        quickPicks.bottomStrips[0] &&
        prev.bottomStrip !== quickPicks.bottomStrips[0]
      ) {
        next = { ...next, bottomStrip: quickPicks.bottomStrips[0] };
        changed = true;
      }

      if (!prevValue(prev.supportVisual) && quickPicks.supportVisuals[0]) {
        next = { ...next, supportVisual: quickPicks.supportVisuals[0] };
        changed = true;
      }

      if (!prevValue(prev.colorEmphasis) && quickPicks.colorEmphasis[0]) {
        next = { ...next, colorEmphasis: quickPicks.colorEmphasis[0] };
        changed = true;
      }

      if (!prevValue(prev.backgroundStyle) && quickPicks.backgroundStyles[0]) {
        next = { ...next, backgroundStyle: quickPicks.backgroundStyles[0] };
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [
    input.category,
    input.hookFamily,
    quickPicks.hooks,
    quickPicks.topLines,
    quickPicks.bottomStrips,
    quickPicks.supportVisuals,
    quickPicks.colorEmphasis,
    quickPicks.backgroundStyles,
    touched.mainHook,
    touched.topLine,
    touched.bottomStrip,
  ]);

  useEffect(() => {
    if (!initialPrompt) return;
    setInput((prev) => ({ ...prev, title: initialPrompt }));
    setTouched((prev) => ({ ...prev, title: true }));
    setIsModalOpen(true);
    onInitialPromptConsumed?.();
  }, [initialPrompt, onInitialPromptConsumed]);

  useEffect(() => {
    if (!isModalOpen) return;
    if (lockUserText || touched.title) return;

    let cancelled = false;
    setIsSuggestingInput(true);

    suggestSchoolOfBreathInput({
      category: input.category,
      mode: input.mode,
      hookFamily: input.hookFamily,
      topicSeed: initialPrompt?.trim() || undefined,
    })
      .then((suggestion) => {
        if (cancelled) return;
        setInput((prev) => ({
          ...prev,
          title: suggestion.title,
          mainHook: touched.mainHook ? prev.mainHook : suggestion.mainHook,
          topLine: touched.topLine ? prev.topLine : suggestion.topLine,
          bottomStrip: touched.bottomStrip ? prev.bottomStrip : suggestion.bottomStrip,
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to suggest School of Breath thumbnail input:', error);
        setModalError(
          error instanceof Error ? error.message : 'Failed to generate School of Breath suggestion.'
        );
      })
      .finally(() => {
        if (!cancelled) setIsSuggestingInput(false);
      });

    return () => { cancelled = true; };
  }, [
    isModalOpen,
    input.category,
    input.mode,
    input.hookFamily,
    initialPrompt,
    suggestionRefreshKey,
    lockUserText,
    touched.title,
    touched.mainHook,
    touched.topLine,
    touched.bottomStrip,
  ]);

  const resetModal = () => {
    const fresh = getSchoolOfBreathDefaultInput();
    setInput(fresh);
    setModalError(null);
    setSuggestionRefreshKey(0);
    setModalStep('form');
    setPreviewPlan(null);
    setLockUserText(false);
    setTouched({
      title: false,
      mainHook: false,
      topLine: false,
      bottomStrip: false,
    });
  };

  const handleGeneratePlan = async () => {
    setModalError(null);
    setIsPlanning(true);

    try {
      const plan = await generateSchoolOfBreathThumbnailPlan(input);
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
      const completed = await generateSchoolOfBreathThumbnailImages(previewPlan);
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

    const sob = draft.prompt.schoolOfBreath;
    const fallback = getSchoolOfBreathDefaultInput();

    const regenerateInput: SchoolOfBreathThumbnailInput = {
      title: draft.prompt.title,
      category: sob?.category ?? fallback.category,
      mode:
        sob?.mode ??
        (draft.prompt.deity.toLowerCase() === 'no character' ? 'without_character' : 'with_character'),
      hookFamily: sob?.hookFamily ?? fallback.hookFamily,
      mainHook: draft.canvaSpec.hookWord || draft.prompt.line1 || fallback.mainHook,
      topLine: sob?.topLine ?? fallback.topLine,
      bottomStrip: sob?.bottomStrip ?? draft.canvaSpec.badge ?? fallback.bottomStrip,
      supportVisual: sob?.supportVisual ?? fallback.supportVisual,
      colorEmphasis: sob?.colorEmphasis ?? fallback.colorEmphasis,
      backgroundStyle: sob?.backgroundStyle ?? fallback.backgroundStyle,
      specialNote: draft.prompt.special ?? '',
    };

    try {
      const regenerated = await generateSchoolOfBreathThumbnailDraft(regenerateInput);
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

  const firstHook = quickPicks.hooks[0] ?? '—';

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
            The School of Breath Thumbnails
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Practical, high-contrast thumbnails with a controlled hook system and one final variant.
          </p>
        </div>
        <button
          onClick={() => {
            setModalError(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors min-h-[44px] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New SOB Thumbnail
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">Drafts</p>
          <p className="mt-2 text-2xl font-bold text-stone-900">{thumbnailDrafts.length}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">
            Top Hook
          </p>
          <p className="mt-2 text-base font-bold text-stone-900 leading-tight">{firstHook}</p>
          <p className="mt-1 text-xs text-stone-500">{input.category} category</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">
            Mode
          </p>
          <p className="mt-2 text-base font-bold text-stone-900">
            {input.mode === 'with_character' ? 'With Character' : 'Without Character'}
          </p>
          <p className="mt-1 text-xs text-stone-500">{input.hookFamily} hooks</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">
            Support Visual
          </p>
          <p className="mt-2 text-base font-bold text-stone-900">{input.supportVisual || '—'}</p>
          <p className="mt-1 text-xs text-stone-500">{input.colorEmphasis || '—'}</p>
        </div>
      </div>

      {thumbnailDrafts.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-500">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-stone-900">No School of Breath drafts yet</h3>
          <p className="mt-2 text-sm text-stone-500 max-w-xl mx-auto">
            Pick a category, mode, and hook to build one controlled thumbnail variant.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {thumbnailDrafts.map((draft) => {
            const sob = draft.prompt.schoolOfBreath;
            return (
              <div
                key={draft.id}
                className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden"
              >
                <div className="p-4 sm:p-5 border-b border-stone-100">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={draft.status} />
                        <span className="text-xs text-stone-400">{formatCreatedAt(draft.createdAt)}</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-stone-900">{draft.prompt.title}</h3>
                        <p className="text-sm text-stone-500 mt-1">
                          {sob?.category ?? 'technique'} · {sob?.mode ?? 'with_character'} ·{' '}
                          {sob?.hookFamily ?? 'instruction'}
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

                <div className="p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_320px] gap-5">
                  <div>
                    {draft.baseImages.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-3">
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
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <p className="text-sm font-semibold text-stone-900">Thumbnail Text Plan</p>
                      </div>
                      <HookPreview
                        topLine={sob?.topLine ?? ''}
                        hook={draft.canvaSpec.hookWord}
                        bottomStrip={sob?.bottomStrip ?? draft.canvaSpec.badge ?? ''}
                        hookColor={draft.canvaSpec.colors.hook}
                      />
                      <div className="space-y-1.5 text-sm text-stone-600">
                        <p>
                          <span className="font-semibold text-stone-900">Main Hook:</span>{' '}
                          {draft.canvaSpec.hookWord || 'Pending'}
                        </p>
                        <p>
                          <span className="font-semibold text-stone-900">Top Line:</span>{' '}
                          {sob?.topLine || 'Pending'}
                        </p>
                        <p>
                          <span className="font-semibold text-stone-900">Bottom Strip:</span>{' '}
                          {sob?.bottomStrip || draft.canvaSpec.badge || 'Pending'}
                        </p>
                        <p>
                          <span className="font-semibold text-stone-900">SEO Title:</span>{' '}
                          {draft.canvaSpec.seoTitle || 'Pending'}
                        </p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <ColorDot color={draft.canvaSpec.colors.hook} />
                            <span className="text-xs">Hook</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <ColorDot color={draft.canvaSpec.colors.secondary} />
                            <span className="text-xs">Secondary</span>
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
                              {item.toLowerCase().includes('normalized') ? (
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                      {modalStep === 'form'
                        ? 'New School of Breath Thumbnail'
                        : 'Review Generation Plan'}
                    </h3>
                    <p className="text-sm text-stone-500 mt-1">
                      {modalStep === 'form'
                        ? 'Step 1 — pick mode, category, and hook stack.'
                        : 'Step 2 — review the prompt plan before generation.'}
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

              {modalStep === 'form' ? (
                <>
                  <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-stone-800">Mode</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {MODE_OPTIONS.map((mode) => (
                          <button
                            key={mode.key}
                            onClick={() => setInput((prev) => ({ ...prev, mode: mode.key }))}
                            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                              input.mode === mode.key
                                ? 'bg-stone-900 text-white'
                                : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-400'
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-stone-800">Category</label>
                      <select
                        value={input.category}
                        onChange={(e) =>
                          setInput((prev) => ({
                            ...prev,
                            category: e.target.value as SchoolOfBreathCategory,
                          }))
                        }
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      >
                        {SOB_THUMBNAIL_CATEGORIES.map((category) => (
                          <option key={category.key} value={category.key}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-stone-800">Hook Family</label>
                      <div className="flex flex-wrap gap-2">
                        {quickPicks.hookFamilies.map((family) => (
                          <button
                            key={family}
                            onClick={() =>
                              setInput((prev) => ({
                                ...prev,
                                hookFamily: family as SchoolOfBreathHookFamily,
                              }))
                            }
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                              input.hookFamily === family
                                ? 'bg-amber-600 text-white'
                                : 'bg-white border border-stone-200 text-stone-600 hover:border-amber-300 hover:text-amber-700'
                            }`}
                          >
                            {family.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">
                        Hook Quick Picks
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {quickPicks.hooks.map((hook) => (
                          <button
                            key={hook}
                            onClick={() => {
                              setInput((prev) => ({ ...prev, mainHook: hook }));
                              setTouched((prev) => ({ ...prev, mainHook: true }));
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                              input.mainHook === hook
                                ? 'bg-stone-900 text-white'
                                : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-400'
                            }`}
                          >
                            {hook}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-stone-800">Main Hook (2-5 words)</label>
                      <input
                        value={input.mainHook}
                        onChange={(e) => {
                          setInput((prev) => ({ ...prev, mainHook: e.target.value }));
                          setTouched((prev) => ({ ...prev, mainHook: true }));
                        }}
                        placeholder="e.g. DO IT THIS WAY"
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 font-bold uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-stone-800">Top Line</label>
                        <input
                          value={input.topLine ?? ''}
                          onChange={(e) => {
                            setInput((prev) => ({ ...prev, topLine: e.target.value }));
                            setTouched((prev) => ({ ...prev, topLine: true }));
                          }}
                          placeholder="e.g. PRANAYAMA SEQUENCE"
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-stone-800">Bottom Strip</label>
                        <input
                          value={input.bottomStrip ?? ''}
                          onChange={(e) => {
                            setInput((prev) => ({ ...prev, bottomStrip: e.target.value }));
                            setTouched((prev) => ({ ...prev, bottomStrip: true }));
                          }}
                          placeholder="e.g. WATCH NOW"
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <HookPreview
                      topLine={input.topLine ?? ''}
                      hook={input.mainHook}
                      bottomStrip={input.bottomStrip ?? ''}
                      hookColor={draftHookColor(input.colorEmphasis)}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-stone-800">Support Visual</label>
                        <select
                          value={input.supportVisual ?? ''}
                          onChange={(e) =>
                            setInput((prev) => ({ ...prev, supportVisual: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                        >
                          {quickPicks.supportVisuals.map((visual) => (
                            <option key={visual} value={visual}>
                              {visual}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-stone-800">Color Emphasis</label>
                        <select
                          value={input.colorEmphasis ?? ''}
                          onChange={(e) =>
                            setInput((prev) => ({ ...prev, colorEmphasis: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                        >
                          {quickPicks.colorEmphasis.map((color) => (
                            <option key={color} value={color}>
                              {color.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-stone-800">Background Style</label>
                      <select
                        value={input.backgroundStyle ?? ''}
                        onChange={(e) =>
                          setInput((prev) => ({ ...prev, backgroundStyle: e.target.value }))
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      >
                        {quickPicks.backgroundStyles.map((style) => (
                          <option key={style} value={style}>
                            {style}
                          </option>
                        ))}
                      </select>
                    </div>

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
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 disabled:opacity-60"
                          >
                            {isSuggestingInput ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                            Refresh Suggestion
                          </button>
                        </div>
                      </div>
                      <input
                        value={input.title}
                        onChange={(e) => {
                          setInput((prev) => ({ ...prev, title: e.target.value }));
                          setTouched((prev) => ({ ...prev, title: true }));
                        }}
                        placeholder="Title for the generated thumbnail"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      />
                    </div>

                    <details className="group">
                      <summary className="text-sm font-medium text-stone-500 cursor-pointer hover:text-stone-700 transition-colors">
                        Optional special note
                      </summary>
                      <textarea
                        value={input.specialNote ?? ''}
                        onChange={(e) =>
                          setInput((prev) => ({ ...prev, specialNote: e.target.value }))
                        }
                        placeholder="Any special instruction for this thumbnail..."
                        rows={2}
                        className="mt-2 w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none"
                      />
                    </details>

                    {modalError && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <p className="whitespace-pre-line">{modalError}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-4 border-t border-stone-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-stone-400">
                      Build a controlled prompt plan first, then generate the final thumbnail.
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
                        disabled={isPlanning}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors disabled:opacity-60 min-h-[44px]"
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
                <>
                  <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    {previewPlan && (
                      <>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-4">
                          <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            Generation Plan Ready
                          </div>

                          <HookPreview
                            topLine={previewPlan.prompt.schoolOfBreath?.topLine ?? ''}
                            hook={previewPlan.canvaSpec.hookWord}
                            bottomStrip={
                              previewPlan.prompt.schoolOfBreath?.bottomStrip ??
                              previewPlan.canvaSpec.badge ??
                              ''
                            }
                            hookColor={previewPlan.canvaSpec.colors.hook}
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider">
                                Main Hook
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
                              className="w-full text-xs leading-relaxed text-stone-600 bg-white border border-stone-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-y"
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

                  <div className="px-5 py-4 border-t border-stone-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-stone-400">
                      Review and edit the prompt. Generate to create the School of Breath thumbnail.
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
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors disabled:opacity-60 min-h-[44px]"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        {isGenerating ? 'Generating Thumbnail…' : 'Generate Thumbnail'}
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

function prevValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function draftHookColor(colorEmphasis?: string): string {
  if (!colorEmphasis) return '#FFD400';
  if (colorEmphasis === 'science_blue') return '#1E7BFF';
  if (colorEmphasis === 'urgency_red') return '#FF2E2E';
  if (colorEmphasis === 'fire_orange') return '#FF7A00';
  return '#FFD400';
}
