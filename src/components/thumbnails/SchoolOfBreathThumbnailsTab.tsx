import React, { useEffect, useMemo, useState } from 'react';
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
  getSchoolOfBreathHookOptions,
  getSchoolOfBreathTopicMeta,
  isSchoolOfBreathHookChannelProven,
  isSchoolOfBreathTopic,
  SchoolOfBreathThumbnailInput,
  SOB_THUMBNAIL_TOPICS,
  suggestSchoolOfBreathInput,
} from '../../services/schoolOfBreathThumbnailService';
import { SchoolOfBreathMode, ThumbnailDraft } from '../../types';
import { downloadThumbnailDraftAsZip } from '../../utils/thumbnailZipDownload';

interface SchoolOfBreathThumbnailsTabProps {
  thumbnailDrafts: ThumbnailDraft[];
  setThumbnailDrafts: React.Dispatch<React.SetStateAction<ThumbnailDraft[]>>;
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
}

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

function HookPreview({
  topLine,
  hook,
  cta,
  accent,
  mode,
  characterSide,
  backgroundTheme,
  supportVisual,
}: {
  topLine: string;
  hook: string;
  cta: string;
  accent: string;
  mode: SchoolOfBreathMode;
  characterSide: 'left' | 'right';
  backgroundTheme: string;
  supportVisual: string;
}) {
  const cinematicBackground = getCinematicSceneStyle(backgroundTheme, accent);

  const textPanel = (
    <div className="flex flex-col h-full">
      <div className="bg-stone-800 px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-white uppercase leading-tight">
        {topLine || 'PRANAYAMA SEQUENCE'}
      </div>
      <div className="bg-yellow-400 px-3 py-2 flex-1 flex items-center">
        <span className="text-[28px] sm:text-[34px] font-black leading-[0.95] tracking-tight uppercase text-stone-900">
          {hook || 'DO IT THIS WAY'}
        </span>
      </div>
      <div
        className="px-3 py-2 text-[12px] sm:text-[13px] font-extrabold tracking-wide text-white uppercase leading-tight"
        style={{ backgroundColor: '#E21313' }}
      >
        {cta || 'WATCH NOW'}
      </div>
    </div>
  );

  const characterPanel = (
    <div className="h-full relative" style={cinematicBackground}>
      {mode === 'without_character' ? (
        <div className="absolute inset-0 border-2 border-dashed border-white/35 flex items-center justify-center">
          <div className="text-center px-2 space-y-1">
            <span className="block text-[10px] font-bold tracking-wider text-white/85 uppercase">
              Support Visual Zone
            </span>
            <span className="block text-[9px] font-semibold tracking-wide text-white/70 uppercase">
              {supportVisual || 'Support Visual'}
            </span>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold tracking-wider text-white/70 uppercase text-center px-2">
            Abhi Character Zone
          </span>
        </div>
      )}
      <span
        className="absolute bottom-2 left-2 w-7 h-7 rounded-full border-2 border-white"
        style={{ backgroundColor: accent || '#FF3B30' }}
      />
      <span className="absolute top-2 left-2 text-[9px] text-white/80 font-semibold uppercase tracking-wide">
        {backgroundTheme.replace(/_/g, ' ')}
      </span>
    </div>
  );

  return (
    <div className="rounded-xl overflow-hidden border border-stone-300 min-h-[140px]">
      <div className="grid grid-cols-11 h-[140px]">
        {characterSide === 'left' ? (
          <>
            <div className="col-span-5">{characterPanel}</div>
            <div className="col-span-6">{textPanel}</div>
          </>
        ) : (
          <>
            <div className="col-span-6">{textPanel}</div>
            <div className="col-span-5">{characterPanel}</div>
          </>
        )}
      </div>
    </div>
  );
}

function getCinematicSceneStyle(backgroundTheme: string, accent: string): React.CSSProperties {
  const scene = backgroundTheme.toLowerCase();

  if (/(fire|heat|lava|volcanic)/.test(scene)) {
    return {
      background:
        'radial-gradient(circle at 78% 22%, rgba(255,132,0,0.62), transparent 38%), radial-gradient(circle at 18% 82%, rgba(255,70,0,0.38), transparent 40%), linear-gradient(140deg, #1a0a05 0%, #3f1407 45%, #0c0c0e 100%)',
      boxShadow: `inset 0 0 72px ${accent}4a`,
    };
  }

  if (/(forest|nature)/.test(scene)) {
    return {
      background:
        'radial-gradient(circle at 72% 18%, rgba(132,255,209,0.45), transparent 42%), radial-gradient(circle at 18% 86%, rgba(88,164,255,0.35), transparent 44%), linear-gradient(140deg, #07120c 0%, #0d3324 52%, #071019 100%)',
      boxShadow: `inset 0 0 72px ${accent}33`,
    };
  }

  if (/(cosmic|chakra)/.test(scene)) {
    return {
      background:
        'radial-gradient(circle at 75% 20%, rgba(117,173,255,0.5), transparent 42%), radial-gradient(circle at 20% 80%, rgba(187,123,255,0.42), transparent 44%), linear-gradient(140deg, #060a1f 0%, #131e49 54%, #080818 100%)',
      boxShadow: `inset 0 0 72px ${accent}40`,
    };
  }

  if (/(warm_studio|sunrise|morning)/.test(scene)) {
    return {
      background:
        'radial-gradient(circle at 78% 22%, rgba(255,225,133,0.68), transparent 42%), radial-gradient(circle at 18% 78%, rgba(255,142,69,0.46), transparent 42%), linear-gradient(140deg, #2a1406 0%, #7a3305 54%, #140a0f 100%)',
      boxShadow: `inset 0 0 72px ${accent}40`,
    };
  }

  if (/(cool_blue_sleep_field|sleep|night)/.test(scene)) {
    return {
      background:
        'radial-gradient(circle at 80% 18%, rgba(150,190,255,0.52), transparent 40%), radial-gradient(circle at 20% 82%, rgba(96,130,255,0.34), transparent 42%), linear-gradient(140deg, #040a1b 0%, #152d67 56%, #060d22 100%)',
      boxShadow: `inset 0 0 72px ${accent}35`,
    };
  }

  return {
    background:
      'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.24), transparent 42%), radial-gradient(circle at 20% 80%, rgba(255,255,255,0.14), transparent 44%), linear-gradient(140deg, #0f1117 0%, #24324a 52%, #101820 100%)',
    boxShadow: `inset 0 0 72px ${accent}33`,
  };
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

function buildSpecText(draft: ThumbnailDraft): string {
  const sob = draft.prompt.schoolOfBreath;
  return [
    'BRAND: THE SCHOOL OF BREATH',
    `TITLE: ${draft.prompt.title}`,
    `TOPIC: ${sob?.category ?? ''}`,
    `MODE: ${sob?.mode ?? ''}`,
    `HOOK: ${draft.canvaSpec.hookWord}`,
    `TOP LINE: ${sob?.topLine ?? ''}`,
    `SUPPORT VISUAL: ${sob?.supportVisual ?? ''}`,
    `VISUAL BADGE: ${sob?.visualBadgeType ?? ''}`,
    `CHARACTER POSE: ${sob?.characterPose ?? ''}`,
    `ACCENT: ${sob?.colorEmphasis ?? ''}`,
    `BACKGROUND STYLE: ${sob?.backgroundStyle ?? ''}`,
    `SEO TITLE: ${draft.canvaSpec.seoTitle ?? ''}`,
  ].join('\n');
}

const MODE_OPTIONS: Array<{ key: SchoolOfBreathMode; label: string }> = [
  { key: 'with_character', label: 'With Character' },
  { key: 'without_character', label: 'Without Character' },
];

export default function SchoolOfBreathThumbnailsTab({
  thumbnailDrafts,
  setThumbnailDrafts,
  initialPrompt,
  onInitialPromptConsumed,
}: SchoolOfBreathThumbnailsTabProps) {
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
  const [titleTouched, setTitleTouched] = useState(false);

  const [input, setInput] = useState<SchoolOfBreathThumbnailInput>(() =>
    getSchoolOfBreathDefaultInput()
  );

  useWakeLock(isPlanning || isGenerating || isSuggestingInput || !!regeneratingId);

  const topicMeta = useMemo(() => getSchoolOfBreathTopicMeta(input.topic), [input.topic]);
  const hookOptions = useMemo(() => getSchoolOfBreathHookOptions(input.topic), [input.topic]);

  useEffect(() => {
    if (!hookOptions.includes(input.hook)) {
      setInput((prev) => ({ ...prev, hook: hookOptions[0] }));
    }
  }, [hookOptions, input.hook]);

  useEffect(() => {
    if (!initialPrompt) return;
    setInput((prev) => ({ ...prev, title: initialPrompt }));
    setTitleTouched(true);
    setIsModalOpen(true);
    onInitialPromptConsumed?.();
  }, [initialPrompt, onInitialPromptConsumed]);

  useEffect(() => {
    if (!isModalOpen || lockUserText || titleTouched) return;
    let cancelled = false;

    setIsSuggestingInput(true);
    suggestSchoolOfBreathInput({
      topic: input.topic,
      mode: input.mode,
      topicSeed: initialPrompt?.trim() || undefined,
    })
      .then((suggestion) => {
        if (cancelled) return;
        setInput((prev) => ({
          ...prev,
          title: suggestion.title,
          hook: hookOptions.includes(prev.hook) ? prev.hook : suggestion.hooks[0],
        }));
      })
      .catch((error) => {
        if (cancelled) return;
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
    input.topic,
    input.mode,
    initialPrompt,
    suggestionRefreshKey,
    lockUserText,
    titleTouched,
    hookOptions,
  ]);

  const resetModal = () => {
    setInput(getSchoolOfBreathDefaultInput());
    setModalError(null);
    setSuggestionRefreshKey(0);
    setModalStep('form');
    setPreviewPlan(null);
    setLockUserText(false);
    setTitleTouched(false);
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
      const message = error instanceof Error ? error.message : 'Failed to generate thumbnail.';
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

    const fallback = getSchoolOfBreathDefaultInput();
    const sob = draft.prompt.schoolOfBreath;
    const topic = sob?.category && isSchoolOfBreathTopic(sob.category) ? sob.category : fallback.topic;
    const hookOptionsForTopic = getSchoolOfBreathHookOptions(topic);

    const regenerateInput: SchoolOfBreathThumbnailInput = {
      title: draft.prompt.title,
      topic,
      mode:
        sob?.mode === 'with_character' || sob?.mode === 'without_character'
          ? sob.mode
          : fallback.mode,
      hook: draft.canvaSpec.hookWord || hookOptionsForTopic[0],
      specialNote: draft.prompt.special || '',
    };

    try {
      const regenerated = await generateSchoolOfBreathThumbnailDraft(regenerateInput);
      setThumbnailDrafts((prev) =>
        prev.map((d) => (d.id === draft.id ? { ...regenerated, id: draft.id } : d))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to regenerate thumbnail.';
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
    setTimeout(() => setCopiedSpecId(null), 1800);
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
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
            The School of Breath Thumbnails
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Lightweight flow: Topic, Mode, Approved Hooks, Generate.
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
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">Topic</p>
          <p className="mt-2 text-base font-bold text-stone-900">{topicMeta.label}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">Mode</p>
          <p className="mt-2 text-base font-bold text-stone-900">
            {input.mode === 'with_character' ? 'With Character' : 'Without Character'}
          </p>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">Hook</p>
          <p className="mt-2 text-base font-bold text-stone-900 leading-tight">{input.hook}</p>
        </div>
      </div>

      {thumbnailDrafts.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-500">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-stone-900">No School of Breath drafts yet</h3>
          <p className="mt-2 text-sm text-stone-500 max-w-xl mx-auto">
            Start with topic, pick an approved hook, then generate.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {thumbnailDrafts.map((draft) => {
            const sob = draft.prompt.schoolOfBreath;
            const mode: SchoolOfBreathMode = sob?.mode === 'without_character' ? 'without_character' : 'with_character';
            const accent = sob?.colorEmphasis || '#FF3B30';
            const draftTopicMeta =
              sob?.category && isSchoolOfBreathTopic(sob.category)
                ? getSchoolOfBreathTopicMeta(sob.category)
                : topicMeta;
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
                          {sob?.category ?? 'pranayama'} · {mode}
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
                          ? 'Generating thumbnail…'
                          : 'No preview image yet.'}
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
                        topLine={sob?.topLine ?? draftTopicMeta.topLine}
                        hook={draft.canvaSpec.hookWord}
                        cta={sob?.bottomStrip ?? draftTopicMeta.cta}
                        accent={accent}
                        mode={mode}
                        characterSide={draftTopicMeta.characterSide}
                        backgroundTheme={draftTopicMeta.backgroundTheme}
                        supportVisual={sob?.supportVisual ?? draftTopicMeta.supportVisual}
                      />
                      <div className="space-y-1.5 text-sm text-stone-600">
                        <p>
                          <span className="font-semibold text-stone-900">Hook:</span>{' '}
                          {draft.canvaSpec.hookWord || 'Pending'}
                        </p>
                        <p>
                          <span className="font-semibold text-stone-900">Top Line:</span>{' '}
                          {sob?.topLine || 'Pending'}
                        </p>
                        <p>
                          <span className="font-semibold text-stone-900">Support Visual:</span>{' '}
                          {sob?.supportVisual || draftTopicMeta.supportVisual || 'Pending'}
                        </p>
                        <p>
                          <span className="font-semibold text-stone-900">SEO Title:</span>{' '}
                          {draft.canvaSpec.seoTitle || 'Pending'}
                        </p>
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
                              {item.toLowerCase().includes('lock') || item.toLowerCase().includes('normalized') ? (
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
                        ? 'Topic → Mode → Approved Hook → Generate'
                        : 'Review prompt and generate.'}
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
                      <label className="text-sm font-medium text-stone-800">Topic</label>
                      <select
                        value={input.topic}
                        onChange={(e) => {
                          const topic = e.target.value;
                          if (!isSchoolOfBreathTopic(topic)) return;
                          const hooks = getSchoolOfBreathHookOptions(topic);
                          setInput((prev) => ({
                            ...prev,
                            topic,
                            mode: prev.mode,
                            hook: hooks[0],
                          }));
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      >
                        {SOB_THUMBNAIL_TOPICS.map((topic) => (
                          <option key={topic.key} value={topic.key}>
                            {topic.label}
                          </option>
                        ))}
                      </select>
                    </div>

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
                      <label className="text-sm font-medium text-stone-800">Hook Options</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {hookOptions.map((hook) => (
                          <button
                            key={hook}
                            onClick={() => setInput((prev) => ({ ...prev, hook }))}
                            className={`px-3 py-2 rounded-xl text-left transition-colors ${
                              input.hook === hook
                                ? 'bg-amber-600 text-white'
                                : 'bg-white border border-stone-200 text-stone-700 hover:border-amber-300'
                            }`}
                          >
                            <span className="block text-xs font-semibold tracking-wide">{hook}</span>
                            {isSchoolOfBreathHookChannelProven(hook) && (
                              <span
                                className={`mt-1 inline-flex text-[10px] font-semibold uppercase tracking-wide ${
                                  input.hook === hook ? 'text-amber-100' : 'text-emerald-700'
                                }`}
                              >
                                Channel-Proven
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-stone-500">
                        Selected hook: <span className="font-semibold text-stone-700">{input.hook}</span>
                      </p>
                    </div>

                    <HookPreview
                      topLine={topicMeta.topLine}
                      hook={input.hook}
                      cta={topicMeta.cta}
                      accent={topicMeta.accent}
                      mode={input.mode}
                      characterSide={topicMeta.characterSide}
                      backgroundTheme={topicMeta.backgroundTheme}
                      supportVisual={topicMeta.supportVisual}
                    />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-sm font-medium text-stone-800">Title Suggestion</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setLockUserText((v) => !v)}
                            className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                              lockUserText ? 'text-amber-700' : 'text-stone-400'
                            }`}
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
                              setTitleTouched(false);
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
                            Refresh
                          </button>
                        </div>
                      </div>
                      <input
                        value={input.title}
                        onChange={(e) => {
                          setInput((prev) => ({ ...prev, title: e.target.value }));
                          setTitleTouched(true);
                        }}
                        placeholder="Suggested from topic + hook"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      />
                    </div>

                    <details className="group">
                      <summary className="text-sm font-medium text-stone-500 cursor-pointer hover:text-stone-700 transition-colors">
                        Advanced overrides
                      </summary>
                      <div className="mt-2 space-y-1.5">
                        <label className="text-sm font-medium text-stone-800">Custom Hook Override</label>
                        <input
                          value={input.hook}
                          onChange={(e) =>
                            setInput((prev) => ({ ...prev, hook: e.target.value.toUpperCase() }))
                          }
                          placeholder="Use only if approved hooks do not fit"
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 font-bold uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                        />
                        <p className="text-xs text-stone-500">
                          Approved hooks above are primary. Override only when needed.
                        </p>
                      </div>
                    </details>

                    <details className="group">
                      <summary className="text-sm font-medium text-stone-500 cursor-pointer hover:text-stone-700 transition-colors">
                        Optional note
                      </summary>
                      <textarea
                        value={input.specialNote ?? ''}
                        onChange={(e) => setInput((prev) => ({ ...prev, specialNote: e.target.value }))}
                        placeholder="Optional instruction..."
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
                    <p className="text-xs text-stone-400">Generate plan first, then render thumbnail.</p>
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
                            topLine={previewPlan.prompt.schoolOfBreath?.topLine ?? topicMeta.topLine}
                            hook={previewPlan.canvaSpec.hookWord}
                            cta={previewPlan.prompt.schoolOfBreath?.bottomStrip ?? topicMeta.cta}
                            accent={previewPlan.prompt.schoolOfBreath?.colorEmphasis ?? topicMeta.accent}
                            mode={
                              previewPlan.prompt.schoolOfBreath?.mode === 'without_character'
                                ? 'without_character'
                                : 'with_character'
                            }
                            characterSide={
                              previewPlan.prompt.schoolOfBreath?.category &&
                              isSchoolOfBreathTopic(previewPlan.prompt.schoolOfBreath.category)
                                ? getSchoolOfBreathTopicMeta(
                                    previewPlan.prompt.schoolOfBreath.category
                                  ).characterSide
                                : topicMeta.characterSide
                            }
                            backgroundTheme={
                              previewPlan.prompt.schoolOfBreath?.category &&
                              isSchoolOfBreathTopic(previewPlan.prompt.schoolOfBreath.category)
                                ? getSchoolOfBreathTopicMeta(
                                    previewPlan.prompt.schoolOfBreath.category
                                  ).backgroundTheme
                                : topicMeta.backgroundTheme
                            }
                            supportVisual={
                              previewPlan.prompt.schoolOfBreath?.supportVisual ?? topicMeta.supportVisual
                            }
                          />
                          <div className="space-y-1.5 text-sm text-stone-700">
                            <p>
                              <span className="font-semibold text-stone-900">Support Visual:</span>{' '}
                              {previewPlan.prompt.schoolOfBreath?.supportVisual ?? topicMeta.supportVisual}
                            </p>
                            <p>
                              <span className="font-semibold text-stone-900">Background Theme:</span>{' '}
                              {(
                                previewPlan.prompt.schoolOfBreath?.backgroundStyle ??
                                topicMeta.backgroundTheme
                              ).replace(/_/g, ' ')}
                            </p>
                          </div>
                        </div>

                        {previewPlan.generationPrompts?.map((prompt, index) => (
                          <div
                            key={index}
                            className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-stone-900">Image Prompt</p>
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
                                setPreviewPlan({ ...previewPlan, generationPrompts: updated });
                              }}
                              rows={8}
                              className="w-full text-xs leading-relaxed text-stone-600 bg-white border border-stone-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-y"
                            />
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  <div className="px-5 py-4 border-t border-stone-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-stone-400">
                      Review prompt and generate the thumbnail.
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
