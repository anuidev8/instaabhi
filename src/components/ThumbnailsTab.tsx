import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useWakeLock } from '../lib/useWakeLock';
import {
  DEITIES,
  MANTRAS_INTENTS,
  generateThumbnailDraft,
  getDefaultDeityForIntent,
  getQuickPicks,
  suggestThumbnailInput,
} from '../services/thumbnailService';
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

interface ThumbnailsTabProps {
  thumbnailDrafts: ThumbnailDraft[];
  setThumbnailDrafts: React.Dispatch<React.SetStateAction<ThumbnailDraft[]>>;
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
}

const EMPTY_CANVA_SPEC = {
  hookWord: '',
  secondary: '',
  badge: '',
  schoolLabel: 'SCHOOL OF MANTRAS',
  seoTitle: '',
  colors: {
    hook: '#FFFFFF',
    secondary: '#FFD700',
    brand: '#FFD700',
    badge: '#FFFFFF',
    aura: '#FFD700',
  },
};

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

export default function ThumbnailsTab({
  thumbnailDrafts,
  setThumbnailDrafts,
  initialPrompt,
  onInitialPromptConsumed,
}: ThumbnailsTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuggestingInput, setIsSuggestingInput] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [copiedSpecId, setCopiedSpecId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [suggestionRefreshKey, setSuggestionRefreshKey] = useState(0);
  const [input, setInput] = useState<ThumbnailPrompt>({
    title: '',
    deity: getDefaultDeityForIntent('abundance'),
    intent: 'abundance',
    special: '',
  });

  useWakeLock(isGenerating || isSuggestingInput || !!regeneratingId);

  const compatibleDeities = DEITIES.filter((deity) => deity.intents.includes(input.intent));
  const allDeities = DEITIES;
  const quickPicks = getQuickPicks(input.intent);
  const recommendedDeities = [
    ...quickPicks.deities,
    ...allDeities.map((deity) => deity.name).filter((name) => !quickPicks.deities.includes(name)),
  ].slice(0, 8);

  useEffect(() => {
    if (!initialPrompt) return;

    setInput((prev) => ({
      ...prev,
      title: initialPrompt,
      deity: prev.deity || getDefaultDeityForIntent(prev.intent),
    }));
    setIsModalOpen(true);
    onInitialPromptConsumed?.();
  }, [initialPrompt, onInitialPromptConsumed]);

  useEffect(() => {
    const isKnownDeity = allDeities.some((deity) => deity.name === input.deity);
    if (isKnownDeity) return;

    setInput((prev) => ({
      ...prev,
      deity: getDefaultDeityForIntent(prev.intent),
    }));
  }, [allDeities, input.deity]);

  useEffect(() => {
    if (!isModalOpen || !input.deity.trim()) return;

    let cancelled = false;
    setIsSuggestingInput(true);

    suggestThumbnailInput({
      deity: input.deity,
      intent: input.intent,
      topicSeed: initialPrompt?.trim() || undefined,
    })
      .then((suggestion) => {
        if (cancelled) return;
        setInput((prev) => ({
          ...prev,
          title: suggestion.title,
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to suggest thumbnail input:', error);
        setModalError(
          error instanceof Error
            ? error.message
            : 'Failed to generate AI suggestion for the video title.'
        );
      })
      .finally(() => {
        if (!cancelled) setIsSuggestingInput(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isModalOpen, input.deity, input.intent, initialPrompt, suggestionRefreshKey]);

  const resetModal = () => {
    setInput({
      title: '',
      deity: getDefaultDeityForIntent('abundance'),
      intent: 'abundance',
      special: '',
    });
    setModalError(null);
    setSuggestionRefreshKey(0);
  };

  const handleGenerate = async () => {
    if (!input.title.trim()) {
      setModalError('Video title is required.');
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
      special: input.special?.trim() || undefined,
    };

    const placeholderId = crypto.randomUUID();
    const placeholderDraft: ThumbnailDraft = {
      id: placeholderId,
      status: 'generating',
      prompt: draftInput,
      baseImages: [],
      canvaSpec: EMPTY_CANVA_SPEC,
      createdAt: new Date(),
    };

    setModalError(null);
    setIsGenerating(true);
    setThumbnailDrafts((prev) => [placeholderDraft, ...prev]);

    try {
      const generatedDraft = await generateThumbnailDraft(draftInput);
      setThumbnailDrafts((prev) =>
        prev.map((draft) => (draft.id === placeholderId ? { ...generatedDraft, id: placeholderId } : draft))
      );
      setIsModalOpen(false);
      resetModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate thumbnail.';
      setModalError(message);
      setThumbnailDrafts((prev) =>
        prev.map((draft) =>
          draft.id === placeholderId
            ? {
                ...draft,
                status: 'error',
                errorMessage: message,
              }
            : draft
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async (draft: ThumbnailDraft) => {
    setRegeneratingId(draft.id);
    setThumbnailDrafts((prev) =>
      prev.map((item) =>
        item.id === draft.id
          ? {
              ...item,
              status: 'generating',
              errorMessage: undefined,
            }
          : item
      )
    );

    try {
      const regenerated = await generateThumbnailDraft(draft.prompt);
      setThumbnailDrafts((prev) =>
        prev.map((item) =>
          item.id === draft.id
            ? {
                ...regenerated,
                id: draft.id,
              }
            : item
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to regenerate thumbnail.';
      setThumbnailDrafts((prev) =>
        prev.map((item) =>
          item.id === draft.id
            ? {
                ...item,
                status: 'error',
                errorMessage: message,
              }
            : item
        )
      );
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleDelete = (id: string) => {
    setThumbnailDrafts((prev) => prev.filter((draft) => draft.id !== id));
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

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">YouTube Thumbnails</h2>
          <p className="text-sm text-stone-500 mt-0.5">
                    Generate 2 finished thumbnails with left-side deity composition and clean 2-line text rendered directly into the image.
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">Drafts</p>
          <p className="mt-2 text-2xl font-bold text-stone-900">{thumbnailDrafts.length}</p>
          <p className="mt-1 text-xs text-stone-500">Saved in IndexedDB with final thumbnail variants and text planning data.</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">Recommended Line 1</p>
          <p className="mt-2 text-lg font-bold text-stone-900">{quickPicks.hooks[0] ?? 'Infinite Wealth'}</p>
          <p className="mt-1 text-xs text-stone-500">{input.intent} intent quick pick from the mantras context.</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">Suggested Deities</p>
          <p className="mt-2 text-lg font-bold text-stone-900">{quickPicks.deities.join(' · ') || 'Ganesha · Lakshmi'}</p>
          <p className="mt-1 text-xs text-stone-500">Left-side hero options matched to the selected intent.</p>
        </div>
      </div>

      {thumbnailDrafts.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-500">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-stone-900">No thumbnail drafts yet</h3>
          <p className="mt-2 text-sm text-stone-500 max-w-xl mx-auto">
            Start with a deity and intent, let AI suggest the title and art direction, then generate 2 final thumbnail variants.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {thumbnailDrafts.map((draft) => (
            <div key={draft.id} className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-stone-100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={draft.status} />
                      <span className="text-xs text-stone-400">{formatCreatedAt(draft.createdAt)}</span>
                      {draft.templateId && (
                        <span className="px-2 py-1 rounded-md bg-stone-100 text-stone-600 text-xs font-medium">
                          Template {draft.templateId}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-stone-900">{draft.prompt.title}</h3>
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
                      {copiedSpecId === draft.id ? 'Copied Text Spec' : 'Copy Text Spec'}
                    </button>
                    <button
                      onClick={() => handleRegenerate(draft)}
                      disabled={regeneratingId === draft.id || draft.status === 'generating'}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 hover:border-amber-300 hover:bg-amber-50 text-sm font-medium text-stone-700 hover:text-amber-700 transition-colors disabled:opacity-60 min-h-[40px]"
                    >
                      {regeneratingId === draft.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                      Regenerate
                    </button>
                    <button
                      onClick={() => handleExport(draft)}
                      disabled={draft.baseImages.length === 0 || exportingId === draft.id}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-60 min-h-[40px]"
                    >
                      {exportingId === draft.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Export ZIP
                    </button>
                    <button
                      onClick={() => handleDelete(draft.id)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 hover:border-red-300 hover:bg-red-50 text-sm font-medium text-stone-700 hover:text-red-700 transition-colors min-h-[40px]"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_320px] gap-5">
                <div>
                  {draft.baseImages.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {draft.baseImages.map((image, index) => (
                        <div key={index} className="rounded-2xl overflow-hidden border border-stone-200 bg-stone-100">
                          <div className="aspect-video">
                            <img src={image} alt={`${draft.prompt.title} variant ${index + 1}`} className="w-full h-full object-cover" />
                          </div>
                          <div className="px-3 py-2 text-xs text-stone-500 border-t border-stone-200">
                            Variant {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center text-sm text-stone-500">
                      {draft.status === 'generating' ? 'Generating image variants…' : 'No preview images yet.'}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                      <p className="text-sm font-semibold text-stone-900">Text Used In Generation</p>
                      </div>
                      <div className="space-y-2 text-sm text-stone-600">
                      <p><span className="font-semibold text-stone-900">Line 1:</span> {draft.canvaSpec.hookWord || 'Pending'}</p>
                      <p><span className="font-semibold text-stone-900">Line 2:</span> {draft.canvaSpec.secondary || 'Pending'}</p>
                      <p><span className="font-semibold text-stone-900">SEO title:</span> {draft.canvaSpec.seoTitle || 'Pending'}</p>
                      <p><span className="font-semibold text-stone-900">Line 1 color:</span> {draft.canvaSpec.colors.hook}</p>
                      <p><span className="font-semibold text-stone-900">Line 2 color:</span> {draft.canvaSpec.colors.secondary}</p>
                      <p><span className="font-semibold text-stone-900">Badge color:</span> {draft.canvaSpec.colors.badge || '#FFFFFF'}</p>
                      <p><span className="font-semibold text-stone-900">Aura color:</span> {draft.canvaSpec.colors.aura || draft.canvaSpec.colors.brand}</p>
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
                          <div key={index} className="flex items-start gap-2 text-sm text-stone-600">
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
                      <summary className="cursor-pointer text-sm font-semibold text-stone-900">Generation Prompts</summary>
                      <div className="mt-3 space-y-3">
                        {draft.generationPrompts.map((prompt, index) => (
                          <div key={index} className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-xs leading-relaxed text-stone-600">
                            <p className="font-semibold text-stone-800 mb-1">Variant {index + 1}</p>
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

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
            onClick={() => {
              if (isGenerating) return;
              setIsModalOpen(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-stone-100 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900">New YouTube Thumbnail</h3>
                  <p className="text-sm text-stone-500 mt-1">
                    School of Mantras full-thumbnail generation using the left-deity/right-text composition guide.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (isGenerating) return;
                    setIsModalOpen(false);
                  }}
                  className="p-2 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-stone-800">Video Title</label>
                    <button
                      onClick={() => setSuggestionRefreshKey((value) => value + 1)}
                      disabled={isSuggestingInput}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 disabled:opacity-60"
                    >
                      {isSuggestingInput ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      Refresh AI Suggestion
                    </button>
                  </div>
                  <input
                    value={input.title}
                    onChange={(event) => setInput((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="AI suggests the YouTube title based on deity, intent, and channel knowledge"
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-800">Intent</label>
                    <select
                      value={input.intent}
                      onChange={(event) =>
                        setInput((prev) => ({ ...prev, intent: event.target.value as IntentKey }))
                      }
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                    >
                      {MANTRAS_INTENTS.map((intent) => (
                        <option key={intent.key} value={intent.key}>
                          {intent.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-800">Deity</label>
                    <select
                      value={input.deity}
                      onChange={(event) => setInput((prev) => ({ ...prev, deity: event.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                    >
                      {allDeities.map((deity) => (
                        <option key={deity.name} value={deity.name}>
                          {deity.name}
                          {compatibleDeities.some((item) => item.name === deity.name) ? ' (Recommended)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-emerald-50/60 p-4 text-sm text-stone-600">
                  <div className="flex items-center gap-2 text-emerald-700 font-medium">
                    {isSuggestingInput ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    AI Suggestion Engine
                  </div>
                  <p className="mt-2">
                    The app suggests only the video title from the School of Mantras guide, selected deity, intent, and any calendar seed topic.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">Recommended Deities</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {recommendedDeities.map((deity) => (
                        <button
                          key={deity}
                          onClick={() => setInput((prev) => ({ ...prev, deity }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            input.deity === deity
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white border border-stone-200 text-stone-600 hover:border-emerald-300 hover:text-emerald-700'
                          }`}
                        >
                          {deity}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">Line 1 Quick Picks</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {quickPicks.hooks.map((hook) => (
                        <span
                          key={hook}
                          className="px-3 py-1.5 rounded-full bg-white border border-stone-200 text-xs font-medium text-stone-600"
                        >
                          {hook}
                        </span>
                      ))}
                    </div>
                  </div>
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

              <div className="px-5 py-4 border-t border-stone-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-stone-400">
                  Generates 2 variants, renders the planned text into the image, validates the left-right composition heuristics, and exports a ZIP pack.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (isGenerating) return;
                      setIsModalOpen(false);
                    }}
                    className="px-4 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-sm font-medium text-stone-700 transition-colors min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || isSuggestingInput}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-60 min-h-[44px]"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isGenerating ? 'Generating…' : 'Generate Full Thumbnails'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
