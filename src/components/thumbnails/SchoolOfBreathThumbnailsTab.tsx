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
  getSchoolOfBreathDefaultLayoutStyle,
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
import { deriveHookLineBreak } from '../../thumbnail-engine/sob/renderSpec';

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
  layoutStyle,
  hookLine1,
  hookLine2,
}: {
  topLine: string;
  hook: string;
  cta: string;
  accent: string;
  mode: SchoolOfBreathMode;
  characterSide: 'left' | 'right';
  backgroundTheme: string;
  supportVisual: string;
  layoutStyle?: 'giant_hook_left' | 'balanced_subject_right' | 'centered_cosmic_hero';
  hookLine1?: string;
  hookLine2?: string;
}) {
  const cinematicBackground = getCinematicSceneStyle(backgroundTheme, accent);
  const isGiant = layoutStyle === 'giant_hook_left';
  const isCenteredCosmic = layoutStyle === 'centered_cosmic_hero';

  const textPanel = (
    <div className="flex flex-col h-full">
      <div className={`bg-stone-800 px-3 text-[11px] font-extrabold tracking-wide text-white uppercase leading-tight ${isGiant ? 'py-1' : 'py-1.5'}`}>
        {topLine || 'PRANAYAMA SEQUENCE'}
      </div>
      <div
        className={`px-3 flex-1 flex items-center border border-stone-950 ${isGiant ? 'py-3' : 'py-2'} ${isCenteredCosmic ? 'justify-center' : ''}`}
        style={{
          background: 'linear-gradient(90deg, #ffd84a 0%, #ffcc33 38%, #e8a010 72%, #d99a0b 100%)',
        }}
      >
        {hookLine1 && hookLine2 ? (
          <span
            className={`font-black leading-[0.90] tracking-tight uppercase text-stone-900 flex flex-col ${isCenteredCosmic ? 'items-center text-center w-full' : ''} ${isGiant ? 'text-[30px] sm:text-[38px]' : 'text-[26px] sm:text-[32px]'}`}
          >
            <span>{hookLine1}</span>
            <span>{hookLine2}</span>
          </span>
        ) : (
          <span className={`font-black leading-[0.95] tracking-tight uppercase text-stone-900 ${isGiant ? 'text-[30px] sm:text-[38px]' : 'text-[26px] sm:text-[32px]'}`}>
            {hook || 'DO IT THIS WAY'}
          </span>
        )}
      </div>
      <div
        className={`px-3 text-[12px] sm:text-[13px] font-extrabold tracking-wide text-white uppercase leading-tight ${isGiant ? 'py-1.5' : 'py-2'}`}
        style={{ backgroundColor: '#E21313' }}
      >
        {cta || 'WATCH NOW'}
      </div>
    </div>
  );

  if (isCenteredCosmic) {
    return (
      <div
        className="rounded-xl overflow-hidden border border-stone-300 min-h-[140px] relative flex flex-col"
        style={cinematicBackground}
      >
        <div className="relative z-10 flex flex-col flex-1 min-h-[140px] px-2 pt-2 pb-2">
          <div className="w-[92%] max-w-[520px] mx-auto flex-shrink-0 shadow-md rounded-sm overflow-hidden border border-black/10 h-[92px]">
            {textPanel}
          </div>
          <div className="flex-1 flex items-end justify-center pb-1">
            <span className="text-[9px] font-bold tracking-wider text-white/90 uppercase text-center px-2">
              {mode === 'without_character'
                ? 'Center reserved for Abhi · support inset left'
                : 'Abhi · centered lower frame'}
            </span>
          </div>
        </div>
        <span className="absolute top-1 left-2 text-[8px] text-white/75 font-semibold uppercase">chakra</span>
        <span className="absolute top-1 right-2 text-[8px] text-white/75 font-semibold uppercase">chakra</span>
      </div>
    );
  }

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

function getCharacterSideForLayout(
  layoutStyle: 'giant_hook_left' | 'balanced_subject_right' | 'centered_cosmic_hero' | undefined,
  fallback: 'left' | 'right'
): 'left' | 'right' {
  if (layoutStyle === 'balanced_subject_right') return 'left';
  if (layoutStyle === 'giant_hook_left') return 'right';
  return fallback;
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
    `CTA: ${sob?.bottomStrip ?? draft.canvaSpec.ctaText ?? ''}`,
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

const LAYOUT_OPTIONS: Array<{
  key: 'giant_hook_left' | 'balanced_subject_right' | 'centered_cosmic_hero';
  label: string;
  description: string;
}> = [
  {
    key: 'centered_cosmic_hero',
    label: 'Centered Cosmic Hero',
    description: 'Reference A: wide centered strips, subject bottom-center, CTA lower-right (e.g. Pranayama).',
  },
  {
    key: 'giant_hook_left',
    label: 'Giant Hook Left',
    description: 'Reference B: text column left, huge hook, fire/split energy topics.',
  },
  {
    key: 'balanced_subject_right',
    label: 'Balanced Subject Right',
    description: 'Classic left-text / right-subject grid without max hook dominance.',
  },
];

const VARIANT_LABELS: Array<{ id: string; label: string; description: string }> = [
  { id: 'A', label: 'Channel Match', description: 'On-channel layout & colors' },
];

const CUSTOM_TOPIC_VALUE = '__custom_topic__';

export default function SchoolOfBreathThumbnailsTab({
  thumbnailDrafts,
  setThumbnailDrafts,
  initialPrompt,
  onInitialPromptConsumed,
}: SchoolOfBreathThumbnailsTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'form' | 'preview' | 'variant_select'>('form');
  const [previewPlan, setPreviewPlan] = useState<ThumbnailDraft | null>(null);
  const [pendingGeneratedDraft, setPendingGeneratedDraft] = useState<ThumbnailDraft | null>(null);
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
  const [isCustomTopicEnabled, setIsCustomTopicEnabled] = useState(false);
  const [customTopicText, setCustomTopicText] = useState('');

  const [input, setInput] = useState<SchoolOfBreathThumbnailInput>(() =>
    getSchoolOfBreathDefaultInput()
  );

  useWakeLock(isPlanning || isGenerating || isSuggestingInput || !!regeneratingId);

  const topicMeta = useMemo(() => getSchoolOfBreathTopicMeta(input.topic), [input.topic]);
  const hookOptions = useMemo(() => getSchoolOfBreathHookOptions(input.topic), [input.topic]);
  const effectiveTopStrip = (input.topStripOverride?.trim() || topicMeta.topLine).toUpperCase();
  const effectiveCta = (input.ctaOverride?.trim() || topicMeta.cta).toUpperCase();

  // Match engine hook breaks (e.g. centered two-word hooks stack for huge type)
  const hookPreviewBreak = useMemo(
    () => deriveHookLineBreak(input.hook, { layoutStyle: input.layoutStyle }),
    [input.hook, input.layoutStyle]
  );
  const formHookLine1 =
    hookPreviewBreak.hookLineBreakMode === 'two_line_split' ? hookPreviewBreak.hookLine1 : undefined;
  const formHookLine2 =
    hookPreviewBreak.hookLineBreakMode === 'two_line_split' ? hookPreviewBreak.hookLine2 : undefined;

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
      topicSeed: customTopicText.trim() || initialPrompt?.trim() || undefined,
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
    customTopicText,
    hookOptions,
  ]);

  const resetModal = () => {
    setInput(getSchoolOfBreathDefaultInput());
    setModalError(null);
    setSuggestionRefreshKey(0);
    setModalStep('form');
    setPreviewPlan(null);
    setPendingGeneratedDraft(null);
    setLockUserText(false);
    setTitleTouched(false);
    setIsCustomTopicEnabled(false);
    setCustomTopicText('');
  };

  const handleGeneratePlan = async () => {
    setModalError(null);
    setIsPlanning(true);

    try {
      const trimmedCustomTopic = customTopicText.trim();
      const customTopicNote = trimmedCustomTopic
        ? `CUSTOM TOPIC FOCUS: ${trimmedCustomTopic}`
        : '';
      const mergedSpecialNote = [input.specialNote?.trim() || '', customTopicNote]
        .filter(Boolean)
        .join(' | ');
      const plan = await generateSchoolOfBreathThumbnailPlan({
        ...input,
        specialNote: mergedSpecialNote || input.specialNote,
      });
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

    try {
      const completed = await generateSchoolOfBreathThumbnailImages(previewPlan);
      if (completed.baseImages.length <= 1) {
        setThumbnailDrafts((prev) => [completed, ...prev]);
        setIsModalOpen(false);
        resetModal();
      } else {
        setPendingGeneratedDraft(completed);
        setModalStep('variant_select');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate thumbnail.';
      setModalError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePickVariant = (variantIndex: number) => {
    if (!pendingGeneratedDraft) return;
    const pickedImage = pendingGeneratedDraft.baseImages[variantIndex];
    const variantLabel = VARIANT_LABELS[variantIndex];
    const finalDraft: ThumbnailDraft = {
      ...pendingGeneratedDraft,
      baseImages: [pickedImage],
      validationSummary: [
        ...(pendingGeneratedDraft.validationSummary ?? []),
        `Selected: ${variantLabel ? `${variantLabel.label} — ${variantLabel.description}` : `Variant ${variantIndex + 1}`}`,
      ],
    };
    setThumbnailDrafts((prev) => [finalDraft, ...prev]);
    setIsModalOpen(false);
    resetModal();
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
    const topicMetaForRegen = getSchoolOfBreathTopicMeta(topic);
    const topStripOverride =
      sob?.topLine &&
      sob.topLine.trim().toUpperCase() !== topicMetaForRegen.topLine.trim().toUpperCase()
        ? sob.topLine
        : '';
    const ctaOverride =
      sob?.bottomStrip &&
      sob.bottomStrip.trim().toUpperCase() !== topicMetaForRegen.cta.trim().toUpperCase()
        ? sob.bottomStrip
        : '';

    const regenerateInput: SchoolOfBreathThumbnailInput = {
      title: draft.prompt.title,
      topic,
      mode:
        sob?.mode === 'with_character' || sob?.mode === 'without_character'
          ? sob.mode
          : fallback.mode,
      hook: draft.canvaSpec.hookWord || hookOptionsForTopic[0],
      topStripOverride,
      ctaOverride,
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
                              {VARIANT_LABELS[index]?.label ?? `Image ${index + 1}`}
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
                        layoutStyle={draft.canvaSpec.layoutStyle ?? sob?.layoutStyle}
                        hookLine1={draft.canvaSpec.hookLine1}
                        hookLine2={draft.canvaSpec.hookLine2}
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
                          <span className="font-semibold text-stone-900">CTA:</span>{' '}
                          {sob?.bottomStrip || draft.canvaSpec.ctaText || draftTopicMeta.cta || 'Pending'}
                        </p>
                        <p>
                          <span className="font-semibold text-stone-900">Support Visual:</span>{' '}
                          {sob?.supportVisual || draftTopicMeta.supportVisual || 'Pending'}
                        </p>
                        <p>
                          <span className="font-semibold text-stone-900">Background Theme:</span>{' '}
                          {(draft.canvaSpec.backgroundTheme || draftTopicMeta.backgroundTheme || 'Pending').replace(
                            /_/g,
                            ' '
                          )}
                        </p>
                        <p>
                          <span className="font-semibold text-stone-900">Character Pose:</span>{' '}
                          {draft.canvaSpec.characterPose || sob?.characterPose || 'n/a (support visual mode)'}
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
                  {(modalStep === 'preview' || modalStep === 'variant_select') && (
                    <button
                      onClick={() => {
                        if (isGenerating) return;
                        setModalStep(modalStep === 'variant_select' ? 'preview' : 'form');
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
                        : modalStep === 'preview'
                        ? 'Review Generation Plan'
                        : 'Choose Your Variant'}
                    </h3>
                    <p className="text-sm text-stone-500 mt-1">
                      {modalStep === 'form'
                        ? 'Topic → Mode → Approved Hook → Generate'
                        : modalStep === 'preview'
                        ? 'Review prompt and generate.'
                        : 'Pick the variant that best fits your message.'}
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

              {modalStep === 'variant_select' ? (
                <>
                  <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    <p className="text-sm text-stone-500">
                      Both variants have been generated. Click one to save it to your collection.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {pendingGeneratedDraft?.baseImages.map((image, index) => {
                        const vl = VARIANT_LABELS[index];
                        return (
                          <div key={index} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black uppercase tracking-widest bg-stone-900 text-white px-2 py-0.5 rounded">
                                {vl?.id ?? String(index + 1)}
                              </span>
                              <span className="text-sm font-semibold text-stone-700">
                                {vl?.description ?? `Variant ${index + 1}`}
                              </span>
                            </div>
                            <div className="relative w-full overflow-hidden rounded-xl border border-stone-200" style={{ paddingBottom: '56.25%' }}>
                              <img
                                src={image}
                                alt={vl ? `${vl.label} — ${vl.description}` : `Variant ${index + 1}`}
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                            </div>
                            <button
                              onClick={() => handlePickVariant(index)}
                              className="w-full px-4 py-2.5 rounded-xl border-2 border-stone-200 hover:border-amber-500 hover:bg-amber-50 text-sm font-semibold text-stone-700 hover:text-amber-800 transition-colors min-h-[44px]"
                            >
                              Choose {vl?.label ?? `Variant ${index + 1}`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {modalError && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <p className="whitespace-pre-line">{modalError}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="px-5 py-4 border-t border-stone-100 flex items-center justify-between gap-3">
                    <p className="text-xs text-stone-400">Choose one variant to save.</p>
                    <button
                      onClick={() => {
                        setModalStep('preview');
                        setModalError(null);
                      }}
                      className="px-4 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-sm font-medium text-stone-700 transition-colors min-h-[44px]"
                    >
                      Back to Plan
                    </button>
                  </div>
                </>
              ) : modalStep === 'form' ? (
                <>
                  <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-stone-800">Topic</label>
                      <select
                        value={isCustomTopicEnabled ? CUSTOM_TOPIC_VALUE : input.topic}
                        onChange={(e) => {
                          const topic = e.target.value;
                          if (topic === CUSTOM_TOPIC_VALUE) {
                            setIsCustomTopicEnabled(true);
                            return;
                          }
                          if (!isSchoolOfBreathTopic(topic)) return;
                          setIsCustomTopicEnabled(false);
                          const hooks = getSchoolOfBreathHookOptions(topic);
                          setInput((prev) => ({
                            ...prev,
                            topic,
                            mode: prev.mode,
                            hook: hooks[0],
                            layoutStyle: getSchoolOfBreathDefaultLayoutStyle(topic),
                            topStripOverride: '',
                            ctaOverride: '',
                          }));
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      >
                        {SOB_THUMBNAIL_TOPICS.map((topic) => (
                          <option key={topic.key} value={topic.key}>
                            {topic.label}
                          </option>
                        ))}
                        <option value={CUSTOM_TOPIC_VALUE}>Custom topic (write your own)</option>
                      </select>
                      {isCustomTopicEnabled && (
                        <input
                          value={customTopicText}
                          onChange={(e) => setCustomTopicText(e.target.value)}
                          placeholder="Write your custom topic..."
                          className="w-full mt-2 px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                        />
                      )}
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
                      <label className="text-sm font-medium text-stone-800">Layout Family</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {LAYOUT_OPTIONS.map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => setInput((prev: SchoolOfBreathThumbnailInput) => ({ ...prev, layoutStyle: opt.key }))}
                            className={`px-3 py-2.5 rounded-xl text-left transition-colors border ${
                              input.layoutStyle === opt.key
                                ? 'bg-stone-900 text-white border-stone-900'
                                : 'bg-white border-stone-200 text-stone-700 hover:border-stone-400'
                            }`}
                          >
                            <span className="block text-xs font-bold">{opt.label}</span>
                            <span className={`block text-[11px] mt-0.5 ${input.layoutStyle === opt.key ? 'text-stone-300' : 'text-stone-500'}`}>
                              {opt.description}
                            </span>
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
                      topLine={effectiveTopStrip}
                      hook={input.hook}
                      cta={effectiveCta}
                      accent={topicMeta.accent}
                      mode={input.mode}
                      characterSide={getCharacterSideForLayout(input.layoutStyle, topicMeta.characterSide)}
                      backgroundTheme={topicMeta.backgroundTheme}
                      supportVisual={topicMeta.supportVisual}
                      layoutStyle={input.layoutStyle}
                      hookLine1={formHookLine1}
                      hookLine2={formHookLine2}
                    />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-sm font-medium text-stone-800">Youtube title</label>
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

                    <details className="group" open>
                      <summary className="text-sm font-medium text-stone-500 cursor-pointer hover:text-stone-700 transition-colors">
                        Edit Texts Thumbnail
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

                        <label className="text-sm font-medium text-stone-800 mt-3 block">
                          Top Strip Override
                        </label>
                        <input
                          value={input.topStripOverride ?? ''}
                          onChange={(e) =>
                            setInput((prev) => ({ ...prev, topStripOverride: e.target.value.toUpperCase() }))
                          }
                          placeholder={topicMeta.topLine}
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 font-bold uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                        />

                        <label className="text-sm font-medium text-stone-800 mt-3 block">CTA Override</label>
                        <input
                          value={input.ctaOverride ?? ''}
                          onChange={(e) =>
                            setInput((prev) => ({ ...prev, ctaOverride: e.target.value.toUpperCase() }))
                          }
                          placeholder={topicMeta.cta}
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 font-bold uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                        />
                        <p className="text-xs text-stone-500">
                          Leave blank to use topic defaults.
                        </p>
                      </div>
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
                            characterSide={getCharacterSideForLayout(
                              previewPlan.canvaSpec.layoutStyle ?? previewPlan.prompt.schoolOfBreath?.layoutStyle,
                              previewPlan.prompt.schoolOfBreath?.category &&
                                isSchoolOfBreathTopic(previewPlan.prompt.schoolOfBreath.category)
                                ? getSchoolOfBreathTopicMeta(previewPlan.prompt.schoolOfBreath.category)
                                    .characterSide
                                : topicMeta.characterSide
                            )}
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
                            layoutStyle={previewPlan.canvaSpec.layoutStyle ?? previewPlan.prompt.schoolOfBreath?.layoutStyle}
                            hookLine1={previewPlan.canvaSpec.hookLine1}
                            hookLine2={previewPlan.canvaSpec.hookLine2}
                          />
                          <div className="space-y-1.5 text-sm text-stone-700">
                            <p>
                              <span className="font-semibold text-stone-900">Top Strip Text:</span>{' '}
                              {previewPlan.prompt.schoolOfBreath?.topLine ?? topicMeta.topLine}
                            </p>
                            <p>
                              <span className="font-semibold text-stone-900">Hook Text:</span>{' '}
                              {previewPlan.canvaSpec.hookWord}
                            </p>
                            <p>
                              <span className="font-semibold text-stone-900">CTA Text:</span>{' '}
                              {previewPlan.prompt.schoolOfBreath?.bottomStrip ??
                                previewPlan.canvaSpec.ctaText ??
                                topicMeta.cta}
                            </p>
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
                            <p>
                              <span className="font-semibold text-stone-900">Layout Family:</span>{' '}
                              {previewPlan.canvaSpec.layoutStyle === 'giant_hook_left'
                                ? 'Giant Hook Left'
                                : previewPlan.canvaSpec.layoutStyle === 'balanced_subject_right'
                                ? 'Balanced Subject Right'
                                : previewPlan.canvaSpec.layoutStyle === 'centered_cosmic_hero'
                                ? 'Centered Cosmic Hero'
                                : '—'}
                            </p>
                            <p>
                              <span className="font-semibold text-stone-900">Character Pose:</span>{' '}
                              {previewPlan.prompt.schoolOfBreath?.characterPose ||
                                'n/a (support visual mode)'}
                            </p>
                          </div>
                        </div>

                        {previewPlan.generationPrompts?.map((prompt, index) => {
                          const vl = VARIANT_LABELS[index];
                          return (
                          <div
                            key={index}
                            className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {vl && (
                                  <span className="text-xs font-black uppercase tracking-widest bg-stone-900 text-white px-2 py-0.5 rounded">
                                    {vl.id}
                                  </span>
                                )}
                                <p className="text-sm font-semibold text-stone-900">
                                  {vl ? vl.description : `Image Prompt ${index + 1}`}
                                </p>
                              </div>
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
                          );
                        })}
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
