import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  Clock,
  Copy,
  Download,
  Globe,
  Loader2,
  Megaphone,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import {
  AppMarketingVideoDraft,
  AppMarketingVideoInput,
  BrandContext,
  VideoReelInput,
  VideoReferenceKind,
} from '../types';
import { generateAppMarketingVideoPlan } from '../services/appMarketingVideoService';
import { generateReelVideo, uploadLocalReferenceVideo } from '../services/falService';
import { useWakeLock } from '../lib/useWakeLock';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'hi', label: 'Hindi' },
];

const DEFAULT_APP_NAME = 'The School of Breath';
const DEFAULT_VOICE_ID =
  (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined)?.trim() ||
  'i6TuzGTpruZ0jkkUZQyp';

function StatusBadge({ status }: { status: AppMarketingVideoDraft['status'] }) {
  const map = {
    draft: { label: 'Plan Ready', cls: 'bg-stone-100 text-stone-600' },
    generating: { label: 'Generating Video…', cls: 'bg-amber-100 text-amber-700 animate-pulse' },
    ready: { label: 'Video Ready', cls: 'bg-emerald-100 text-emerald-800' },
    error: { label: 'Error', cls: 'bg-red-100 text-red-700' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-md ${cls}`}>
      {label}
    </span>
  );
}

interface AppMarketingVideoTabProps {
  marketingDrafts: AppMarketingVideoDraft[];
  setMarketingDrafts: React.Dispatch<React.SetStateAction<AppMarketingVideoDraft[]>>;
}

export default function AppMarketingVideoTab({
  marketingDrafts,
  setMarketingDrafts,
}: AppMarketingVideoTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);

  const [appName, setAppName] = useState(DEFAULT_APP_NAME);
  const [campaignGoal, setCampaignGoal] = useState('');
  const [realUserStories, setRealUserStories] = useState('');
  const [callToAction, setCallToAction] = useState('Download the app and start your first session today.');
  const [targetAudience, setTargetAudience] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [targetDuration, setTargetDuration] = useState(30);
  const [language, setLanguage] = useState('en');

  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceVideoUrl, setReferenceVideoUrl] = useState('');
  const [referenceVideoKind, setReferenceVideoKind] = useState<VideoReferenceKind>('DIRECT_URL');
  const [uploadingReferenceVideo, setUploadingReferenceVideo] = useState(false);
  const [uploadedVideoName, setUploadedVideoName] = useState('');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useWakeLock(isGeneratingPlan || !!generatingVideoId);

  const handleCopyScript = (id: string, script: string) => {
    navigator.clipboard.writeText(script);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  const handleCopyCaption = (id: string, caption: string) => {
    navigator.clipboard.writeText(caption);
    setCopiedCaption(id);
    setTimeout(() => setCopiedCaption(null), 2000);
  };

  const resetModal = () => {
    setAppName(DEFAULT_APP_NAME);
    setCampaignGoal('');
    setRealUserStories('');
    setCallToAction('Download the app and start your first session today.');
    setTargetAudience('');
    setAppUrl('');
    setTargetDuration(30);
    setLanguage('en');
    setReferenceImages([]);
    setReferenceVideoUrl('');
    setReferenceVideoKind('DIRECT_URL');
    setUploadedVideoName('');
    setModalError(null);
  };

  const inferReferenceKindFromUrl = (url: string): VideoReferenceKind => {
    const normalized = url.toLowerCase();
    if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) return 'YOUTUBE';
    if (normalized.includes('instagram.com')) return 'INSTAGRAM';
    return 'DIRECT_URL';
  };

  const handleReferenceImagesUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;

    const files: File[] = Array.from(event.target.files as FileList).slice(0, 8);
    const readers = files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    );

    Promise.all(readers)
      .then((images) => setReferenceImages(images))
      .catch((error) => {
        console.error('Failed to read reference images:', error);
        setModalError('Failed to process uploaded images.');
      });

    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleReferenceVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setModalError(null);
    setUploadingReferenceVideo(true);
    try {
      const uploadedUrl = await uploadLocalReferenceVideo(file);
      setReferenceVideoUrl(uploadedUrl);
      setReferenceVideoKind('LOCAL_MP4');
      setUploadedVideoName(file.name);
    } catch (error) {
      console.error('Failed to upload reference video:', error);
      setModalError(error instanceof Error ? error.message : 'Failed to upload reference video.');
    } finally {
      setUploadingReferenceVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleGeneratePlan = async () => {
    if (!appName.trim()) {
      setModalError('App name is required.');
      return;
    }

    if (!campaignGoal.trim()) {
      setModalError('Campaign goal / angle is required.');
      return;
    }

    if (!realUserStories.trim()) {
      setModalError('Add real user stories / use cases to keep the video factual.');
      return;
    }

    if (!referenceVideoUrl.trim() && referenceImages.length === 0) {
      setModalError('Upload screenshots or provide/upload a reference video.');
      return;
    }

    setModalError(null);
    setIsGeneratingPlan(true);

    const input: AppMarketingVideoInput = {
      appName: appName.trim(),
      campaignGoal: campaignGoal.trim(),
      callToAction: callToAction.trim() || 'Download now.',
      realUserStories: realUserStories.trim(),
      targetAudience: targetAudience.trim() || undefined,
      appUrl: appUrl.trim() || undefined,
      targetDurationSeconds: targetDuration,
      language,
      referenceImages,
      referenceVideoUrl: referenceVideoUrl.trim() || undefined,
      referenceVideoKind: referenceVideoUrl.trim() ? referenceVideoKind : undefined,
    };

    try {
      const plan = await generateAppMarketingVideoPlan(input);
      const newDraft: AppMarketingVideoDraft = {
        id: crypto.randomUUID(),
        appName: input.appName,
        campaignGoal: input.campaignGoal,
        callToAction: input.callToAction,
        realUserStories: input.realUserStories,
        targetAudience: input.targetAudience,
        appUrl: input.appUrl,
        language: input.language,
        targetDurationSeconds: input.targetDurationSeconds,
        normalizedDurationSeconds: plan.normalizedDurationSeconds,
        sceneVideoProvider: 'gemini',
        referenceImages: input.referenceImages,
        referenceVideoUrl: input.referenceVideoUrl,
        referenceVideoKind: input.referenceVideoKind,
        headline: plan.headline,
        voiceoverScript: plan.voiceoverScript,
        caption: plan.caption,
        hashtags: plan.hashtags,
        visualAnalysisSummary: plan.visualAnalysisSummary,
        scenes: plan.scenes,
        status: 'draft',
      };

      setMarketingDrafts((prev) => [newDraft, ...prev]);
      setIsModalOpen(false);
      resetModal();
    } catch (error) {
      console.error('Failed to generate app marketing plan:', error);
      setModalError(error instanceof Error ? error.message : 'Failed to generate plan.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleGenerateVideo = async (draft: AppMarketingVideoDraft) => {
    setGeneratingVideoId(draft.id);
    setMarketingDrafts((prev) =>
      prev.map((item) => (item.id === draft.id ? { ...item, status: 'generating', errorMessage: undefined } : item))
    );

    const videoReelInput: VideoReelInput = {
      prompt: `${draft.appName}: ${draft.campaignGoal}\nReal user stories: ${draft.realUserStories || 'n/a'}`,
      mode: draft.referenceVideoUrl ? 'FROM_REFERENCE_VIDEO' : 'FROM_IMAGES',
      referenceVideoUrl: draft.referenceVideoUrl,
      referenceVideoKind: draft.referenceVideoKind,
      referenceVideoTitle: `${draft.appName} app demo`,
      referenceImageIntent: draft.referenceVideoUrl ? 'general' : 'app_ui_exact',
      referenceImages: draft.referenceImages,
      targetDurationSeconds: draft.normalizedDurationSeconds || draft.targetDurationSeconds,
      language: draft.language,
    };

    const brandContext: BrandContext = {
      name: draft.appName,
      handle: '@app',
      niche: 'mobile app growth and onboarding',
      voice: 'dynamic, clear, benefit-driven, conversion focused',
      pillars: 'problem hook, feature proof, user benefit, clear CTA',
      voiceId: DEFAULT_VOICE_ID,
      visualDirection:
        'Documentary-style premium app aesthetic with natural light and realistic b-roll. Feel comparable to Calm/Headspace production quality while staying original to this brand.',
      cameraDirection:
        'Use varied cinematic angles per scene: push-in hook, over-shoulder interaction shot, three-quarter orbit, subtle parallax pan, and soft zoom-out CTA finish. Keep movement smooth and believable.',
      humanDirection:
        `Human-first promo style based on provided real use-cases. Do not invent fictional personas or fake outcomes. Use realistic people/hands and daily-life behavior. Real user stories anchor: ${draft.realUserStories || 'none provided'}`,
      microInteractionDirection:
        'Add subtle infographic/UI micro-interactions only: breathing ring pulse, progress fill, gentle card reveal, tap ripple. Keep motion minimal and elegant.',
    };

    try {
      const result = await generateReelVideo({
        jobId: crypto.randomUUID(),
        draftId: draft.id,
        script: draft.voiceoverScript,
        scenes: draft.scenes,
        sceneVideoProvider: 'gemini',
        sourceAnalysisSummary: draft.visualAnalysisSummary,
        videoReelInput,
        brandContext,
        pipelineOptions: {
          disableStrictAssembly: true,
          forceSceneVideoProvider: 'gemini',
          disableReferenceClipSplit: true,
          mergeVoiceoverAudio: true,
          requireVoiceoverAudio: true,
          sceneGenerationConcurrency: 1,
          sceneGenerationDelayMs: 1200,
          normalizeSceneVideosBeforeConcat: true,
        },
      });

      setMarketingDrafts((prev) =>
        prev.map((item) =>
          item.id === draft.id
            ? {
                ...item,
                status: 'ready',
                finalVideoUrl: result.finalVideoUrl,
                errorMessage: undefined,
              }
            : item
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to generate app marketing video:', error);
      setMarketingDrafts((prev) =>
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
      setGeneratingVideoId(null);
    }
  };

  const handleDelete = (id: string) => {
    setMarketingDrafts((prev) => prev.filter((draft) => draft.id !== id));
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">App Marketing Video Generation</h2>
          <p className="text-stone-500 mt-1 text-sm sm:text-base">
            Upload app screenshots/video, let Gemini Vision plan the story, generate scenes with Gemini Veo, then join final video + voiceover with Fal.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm text-sm sm:text-base shrink-0 min-h-[44px]"
        >
          <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">New Marketing Video</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {marketingDrafts.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-stone-200 border-dashed">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-8 h-8 text-stone-400" />
          </div>
          <h3 className="text-lg font-medium text-stone-900 mb-2">No app marketing videos yet</h3>
          <p className="text-stone-500 max-w-md mx-auto mb-6">
            Create your first viral-style 30s app campaign by uploading screenshots or a product walkthrough video.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            Create your first campaign
          </button>
        </div>
      )}

      {marketingDrafts.length > 0 && (
        <div className="grid gap-6">
          {marketingDrafts.map((draft, index) => (
            <motion.div
              key={draft.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden"
            >
              <div className="p-4 sm:p-6 border-b border-stone-100 flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                    <StatusBadge status={draft.status} />
                    <h3 className="text-lg sm:text-xl font-bold text-stone-900 leading-snug truncate">{draft.appName}</h3>
                  </div>
                  <p className="text-sm text-stone-700 font-medium">{draft.headline}</p>
                  {draft.realUserStories && (
                    <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                      Real cases: {draft.realUserStories}
                    </p>
                  )}
                  <div className="flex items-center gap-3 sm:gap-4 text-stone-500 text-sm mt-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {draft.targetDurationSeconds}s target · {draft.normalizedDurationSeconds}s final
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      {LANGUAGES.find((item) => item.code === draft.language)?.label ?? draft.language}
                    </span>
                    <span>Scene model: <span className="font-medium">Gemini Veo (latest)</span></span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(draft.id)}
                  className="text-stone-400 hover:text-red-500 transition-colors p-2 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Delete campaign"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 grid md:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-stone-900 flex items-center gap-2 text-sm">
                      <Clapperboard className="w-4 h-4 text-stone-400" />
                      Voiceover Script
                    </h4>
                    <button
                      onClick={() => handleCopyScript(draft.id, draft.voiceoverScript)}
                      className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors"
                      title="Copy script"
                    >
                      {copiedScript === draft.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedScript === draft.id ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 text-sm max-h-56 overflow-y-auto custom-scrollbar">
                    <p className="text-[13px] text-stone-700 leading-relaxed whitespace-pre-wrap">{draft.voiceoverScript}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-stone-900 flex items-center gap-2 text-sm">
                        <Video className="w-4 h-4 text-stone-400" />
                        Caption
                      </h4>
                      <button
                        onClick={() => handleCopyCaption(draft.id, draft.caption)}
                        className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors"
                        title="Copy caption"
                      >
                        {copiedCaption === draft.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedCaption === draft.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 text-sm max-h-44 overflow-y-auto custom-scrollbar">
                      <p className="text-[13px] text-stone-700 leading-relaxed whitespace-pre-wrap">{draft.caption}</p>
                    </div>
                  </div>

                  {draft.visualAnalysisSummary && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-[11px] font-semibold tracking-wide uppercase text-blue-700">Gemini vision analysis</p>
                      <p className="text-xs text-blue-900 mt-1 leading-relaxed">{draft.visualAnalysisSummary}</p>
                    </div>
                  )}

                  <div className="pt-2">
                    {draft.status === 'draft' && (
                      <div className="space-y-2">
                        <p className="text-xs text-stone-500">Scene generation: Gemini Veo (latest)</p>
                        <button
                          onClick={() => handleGenerateVideo(draft)}
                          disabled={!!generatingVideoId}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {generatingVideoId === draft.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                          {generatingVideoId === draft.id ? 'Rendering + voiceover merge…' : 'Generate Marketing Video'}
                        </button>
                      </div>
                    )}

                    {draft.status === 'generating' && (
                      <div className="w-full py-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl font-medium flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Producing your campaign video…
                      </div>
                    )}

                    {draft.status === 'ready' && draft.finalVideoUrl && (
                      <div className="space-y-3">
                        <div className="w-full py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-medium flex items-center justify-center gap-2 text-sm">
                          <CheckCircle2 className="w-5 h-5" />
                          Campaign video ready
                        </div>
                        <a
                          href={draft.finalVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <Download className="w-5 h-5" />
                          Download Video
                        </a>
                        <video
                          src={draft.finalVideoUrl}
                          controls
                          className="w-full rounded-xl border border-stone-200 max-h-64 object-contain bg-stone-950"
                        />
                      </div>
                    )}

                    {draft.status === 'error' && (
                      <div className="space-y-3">
                        <div className="w-full py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2 px-4">
                          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">Generation failed</p>
                            {draft.errorMessage && (
                              <p className="text-xs text-red-600 mt-1 break-words">{draft.errorMessage}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setMarketingDrafts((prev) =>
                              prev.map((item) =>
                                item.id === draft.id
                                  ? { ...item, status: 'draft', errorMessage: undefined }
                                  : item
                              )
                            );
                          }}
                          className="w-full py-2.5 border border-stone-300 hover:border-stone-400 hover:bg-stone-50 text-stone-700 rounded-xl text-sm font-medium transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isGeneratingPlan && setIsModalOpen(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col"
            >
              <div className="p-4 sm:p-6 border-b border-stone-100 flex items-center justify-between shrink-0 gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900">New App Marketing Video</h3>
                  <p className="text-stone-500 text-sm mt-1">
                    Upload app assets, generate the plan with Gemini Vision, generate scenes with Gemini Veo, then join with ElevenLabs voiceover.
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={isGeneratingPlan}
                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto custom-scrollbar">
                <div>
                  <label htmlFor="app-name" className="block text-sm font-medium text-stone-700 mb-1.5">
                    App Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="app-name"
                    type="text"
                    value={appName}
                    onChange={(event) => setAppName(event.target.value)}
                    placeholder="The School of Breath"
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="campaign-goal" className="block text-sm font-medium text-stone-700 mb-1.5">
                    Campaign Goal / Angle <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="campaign-goal"
                    value={campaignGoal}
                    onChange={(event) => setCampaignGoal(event.target.value)}
                    placeholder="e.g. Show how the app helps users calm anxiety in 2 minutes."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>

                <div>
                  <label htmlFor="real-user-stories" className="block text-sm font-medium text-stone-700 mb-1.5">
                    Real User Stories / Use Cases <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="real-user-stories"
                    value={realUserStories}
                    onChange={(event) => setRealUserStories(event.target.value)}
                    placeholder="e.g. Ana uses the app before sleep to reduce racing thoughts. Carlos does 2-minute breathing before meetings to avoid panic."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>

                <div>
                  <label htmlFor="cta" className="block text-sm font-medium text-stone-700 mb-1.5">
                    CTA Line
                  </label>
                  <input
                    id="cta"
                    type="text"
                    value={callToAction}
                    onChange={(event) => setCallToAction(event.target.value)}
                    placeholder="Download the app and start now."
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="target-audience" className="block text-sm font-medium text-stone-700 mb-1.5">
                      Target Audience
                    </label>
                    <input
                      id="target-audience"
                      type="text"
                      value={targetAudience}
                      onChange={(event) => setTargetAudience(event.target.value)}
                      placeholder="Busy professionals, beginners..."
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="app-url" className="block text-sm font-medium text-stone-700 mb-1.5">
                      App URL (optional)
                    </label>
                    <input
                      id="app-url"
                      type="url"
                      value={appUrl}
                      onChange={(event) => setAppUrl(event.target.value)}
                      placeholder="https://example.com/app"
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    App Screenshots (up to 8)
                  </label>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleReferenceImagesUpload}
                  />
                  {referenceImages.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {referenceImages.map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`reference ${index + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border border-stone-200"
                        />
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full py-2.5 border border-dashed border-stone-300 hover:border-emerald-400 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {referenceImages.length > 0 ? 'Change Screenshots' : 'Upload Screenshots'}
                  </button>
                </div>

                <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                  <div>
                    <label htmlFor="reference-video-url" className="block text-sm font-medium text-stone-700 mb-1.5">
                      Product Walkthrough Video URL (optional)
                    </label>
                    <input
                      id="reference-video-url"
                      type="url"
                      value={referenceVideoUrl}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setReferenceVideoUrl(nextValue);
                        if (referenceVideoKind !== 'LOCAL_MP4') {
                          setReferenceVideoKind(inferReferenceKindFromUrl(nextValue));
                        }
                      }}
                      placeholder="https://youtube.com/... or direct MP4 URL"
                      className="w-full px-4 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="reference-video-kind" className="block text-sm font-medium text-stone-700 mb-1.5">
                      Source Type
                    </label>
                    <select
                      id="reference-video-kind"
                      value={referenceVideoKind}
                      onChange={(event) => setReferenceVideoKind(event.target.value as VideoReferenceKind)}
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    >
                      <option value="YOUTUBE">YouTube</option>
                      <option value="INSTAGRAM">Instagram Reel</option>
                      <option value="LOCAL_MP4">Local MP4</option>
                      <option value="DIRECT_URL">Direct URL</option>
                    </select>
                  </div>

                  <div>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/mp4,video/*"
                      className="hidden"
                      onChange={handleReferenceVideoUpload}
                    />
                    <button
                      onClick={() => videoInputRef.current?.click()}
                      disabled={uploadingReferenceVideo}
                      className="w-full py-2.5 border border-dashed border-stone-300 hover:border-emerald-400 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {uploadingReferenceVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploadingReferenceVideo ? 'Uploading walkthrough video…' : 'Upload Walkthrough Video'}
                    </button>
                    {uploadedVideoName && (
                      <p className="text-xs text-stone-600 mt-2">
                        Uploaded: <span className="font-medium">{uploadedVideoName}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      Target Duration
                      <span className="ml-2 text-emerald-600 font-semibold">{targetDuration}s</span>
                    </label>
                    <input
                      type="range"
                      min={20}
                      max={45}
                      step={1}
                      value={targetDuration}
                      onChange={(event) => setTargetDuration(Number(event.target.value))}
                      className="w-full accent-emerald-600"
                    />
                    <div className="flex justify-between text-xs text-stone-400 mt-1">
                      <span>20s</span>
                      <span>45s</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="marketing-language" className="block text-sm font-medium text-stone-700 mb-1.5">
                      Language
                    </label>
                    <select
                      id="marketing-language"
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    >
                      {LANGUAGES.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
                  Scene generation model: <span className="font-medium text-stone-800">Gemini Veo (latest)</span>
                </div>

                {modalError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-700">{modalError}</p>
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-6 border-t border-stone-100 flex gap-3 shrink-0">
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={isGeneratingPlan}
                  className="flex-1 py-2.5 border border-stone-300 hover:bg-stone-50 text-stone-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGeneratePlan}
                  disabled={
                    !appName.trim() ||
                    !campaignGoal.trim() ||
                    !realUserStories.trim() ||
                    isGeneratingPlan ||
                    uploadingReferenceVideo ||
                    (!referenceVideoUrl.trim() && referenceImages.length === 0)
                  }
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGeneratingPlan ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Building campaign plan…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Marketing Plan
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
