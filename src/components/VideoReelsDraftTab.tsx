import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Loader2, Sparkles, Trash2, X, Video, Download,
  ChevronRight, AlertCircle, Clock, Globe, Upload, Film,
  CheckCircle2, Play, Clapperboard, MessageSquare, Copy, Link2,
} from 'lucide-react';
import {
  VideoReelDraft,
  VideoReelInput,
  VideoReelMode,
  BrandContext,
  SceneVideoProvider,
  VideoReferenceKind,
} from '../types';
import { generateVideoReelContent } from '../services/videoReelService';
import { generateReelVideo, FalJobPayload, uploadLocalReferenceVideo } from '../services/falService';
import { useWakeLock } from '../lib/useWakeLock';

// ─── Brand Context (used by scene video prompt pipeline) ─────────────────────
// Script + caption generation uses REEL_BRAND_CONTEXT from videoReelService internally.
const BRAND_CONTEXT: BrandContext = {
  name: 'Meditate with Abhi',
  handle: '@meditatewithAbhi',
  niche: 'meditation, mindfulness, breathwork',
  voice: 'calm, nurturing, science-backed spiritual guide',
  pillars: 'breathing techniques, mindfulness, sleep improvement, stress relief',
  voiceId: (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined)?.trim() || 'i6TuzGTpruZ0jkkUZQyp',
};

// ─── Suggested topics (hidden from UI, kept for future use) ──────────────────
const SUGGESTED_TOPICS = [
  '4-7-8 breathing for sleep',
  'Box breathing for anxiety',
  'Morning mindfulness ritual',
  'Diaphragmatic breathing',
  'Body scan meditation',
  '5-minute stress reset',
  'Alternate nostril breathing',
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'hi', label: 'Hindi' },
];

const SCENE_VIDEO_PROVIDERS: Array<{ value: SceneVideoProvider; label: string }> = [
  { value: 'gemini', label: 'Gemini (Latest Video Model)' },
  { value: 'openai', label: 'OpenAI (Latest Video Model)' },
];

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: VideoReelDraft['status'] }) {
  const map = {
    draft: { label: 'Script Ready', cls: 'bg-stone-100 text-stone-600' },
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

// ─── Scene card (hidden from main UI, kept for Fal pipeline reference) ────────
function SceneCard({ scene, total }: { scene: VideoReelDraft['scenes'][0]; total: number; 'key'?: React.Key }) {
  return (
    <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
          Scene {scene.index + 1} / {total}
        </span>
        <span className="text-xs bg-stone-200 text-stone-600 rounded-full px-2 py-0.5 font-medium">
          {scene.start}s – {scene.end}s · {scene.duration}s
        </span>
      </div>
      {Number.isFinite(scene.sourceStart) && Number.isFinite(scene.sourceEnd) && (
        <p className="text-[11px] text-stone-500">
          Source clip: {scene.sourceStart}s → {scene.sourceEnd}s
        </p>
      )}
      <p className="text-sm text-stone-800 italic">"{scene.narrative}"</p>
      <p className="text-xs text-stone-500 border-t border-stone-200 pt-2 leading-relaxed">
        <span className="font-semibold text-stone-600">Visual: </span>{scene.visualPrompt}
      </p>
      {(scene.cameraMovement || scene.transitionToNext || scene.overlayText) && (
        <p className="text-xs text-stone-500 leading-relaxed">
          {scene.cameraMovement && <><span className="font-semibold text-stone-600">Camera:</span> {scene.cameraMovement}. </>}
          {scene.transitionToNext && <><span className="font-semibold text-stone-600">Transition:</span> {scene.transitionToNext}. </>}
          {scene.overlayText && <><span className="font-semibold text-stone-600">Overlay:</span> {scene.overlayText}</>}
        </p>
      )}
    </div>
  );
}

// ─── Main Props ───────────────────────────────────────────────────────────────
interface VideoReelsDraftTabProps {
  reelDrafts: VideoReelDraft[];
  setReelDrafts: React.Dispatch<React.SetStateAction<VideoReelDraft[]>>;
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
}

export default function VideoReelsDraftTab({ reelDrafts, setReelDrafts, initialPrompt, onInitialPromptConsumed }: VideoReelsDraftTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);
  const [copiedYoutubeDescription, setCopiedYoutubeDescription] = useState<string | null>(null);

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

  const handleCopyYoutubeDescription = (id: string, description: string) => {
    navigator.clipboard.writeText(description);
    setCopiedYoutubeDescription(id);
    setTimeout(() => setCopiedYoutubeDescription(null), 2000);
  };

  // ── Modal form state ──────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<VideoReelMode>('PROMPT_ONLY');
  const [refVideoUrl, setRefVideoUrl] = useState('');
  const [refVideoKind, setRefVideoKind] = useState<VideoReferenceKind>('YOUTUBE');
  const [refVideoTitle, setRefVideoTitle] = useState('');
  const [uploadingRefVideo, setUploadingRefVideo] = useState(false);
  const [uploadedRefVideoName, setUploadedRefVideoName] = useState('');
  const [refImages, setRefImages] = useState<string[]>([]);
  const [targetDuration, setTargetDuration] = useState(30);
  const [sceneVideoProvider, setSceneVideoProvider] = useState<SceneVideoProvider>('gemini');
  const [language, setLanguage] = useState('en');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  useWakeLock(isGeneratingScript || !!generatingVideoId);

  const refImageInputRef = useRef<HTMLInputElement>(null);
  const refVideoInputRef = useRef<HTMLInputElement>(null);

  // Open modal pre-filled when navigated from Content Calendar
  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
      setIsModalOpen(true);
      onInitialPromptConsumed?.();
    }
  }, [initialPrompt]);

  const resetModal = () => {
    setPrompt('');
    setMode('PROMPT_ONLY');
    setRefVideoUrl('');
    setRefVideoKind('YOUTUBE');
    setRefVideoTitle('');
    setUploadingRefVideo(false);
    setUploadedRefVideoName('');
    setRefImages([]);
    setTargetDuration(30);
    setSceneVideoProvider('gemini');
    setLanguage('en');
    setModalError(null);
  };

  const inferReferenceKindFromUrl = (url: string): VideoReferenceKind => {
    const normalized = url.toLowerCase();
    if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) return 'YOUTUBE';
    if (normalized.includes('instagram.com')) return 'INSTAGRAM';
    return 'DIRECT_URL';
  };

  const handleRefVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setModalError(null);
    setUploadingRefVideo(true);
    try {
      const uploadedUrl = await uploadLocalReferenceVideo(file);
      setRefVideoUrl(uploadedUrl);
      setRefVideoKind('LOCAL_MP4');
      setUploadedRefVideoName(file.name);
      if (!refVideoTitle.trim()) {
        const titleWithoutExt = file.name.replace(/\.[^.]+$/, '');
        setRefVideoTitle(titleWithoutExt);
      }
    } catch (error) {
      console.error('Failed to upload reference video:', error);
      setModalError(
        error instanceof Error
          ? error.message
          : 'Failed to upload local MP4 to reference storage.'
      );
    } finally {
      setUploadingRefVideo(false);
      if (refVideoInputRef.current) refVideoInputRef.current.value = '';
    }
  };

  // ── Step 1: Generate script + caption from Gemini (brand context) ─────────
  const handleGenerateScript = async () => {
    if (!prompt.trim()) {
      setModalError('Topic / angle is required.');
      return;
    }

    if (mode === 'FROM_REFERENCE_VIDEO' && !refVideoUrl.trim()) {
      setModalError('Add a reference source URL or upload a local MP4 first.');
      return;
    }

    setModalError(null);
    setIsGeneratingScript(true);

    const normalizedRefUrl = refVideoUrl.trim();
    const effectiveReferenceKind =
      mode === 'FROM_REFERENCE_VIDEO'
        ? (refVideoKind === 'LOCAL_MP4' ? 'LOCAL_MP4' : inferReferenceKindFromUrl(normalizedRefUrl))
        : undefined;

    const videoReelInput: VideoReelInput = {
      prompt: prompt.trim(),
      mode,
      referenceVideoUrl: mode === 'FROM_REFERENCE_VIDEO' ? normalizedRefUrl : undefined,
      referenceVideoKind: effectiveReferenceKind,
      referenceVideoTitle: mode === 'FROM_REFERENCE_VIDEO' ? refVideoTitle.trim() || prompt.trim() : undefined,
      referenceImages: mode === 'FROM_IMAGES' ? refImages : undefined,
      targetDurationSeconds: targetDuration,
      language,
    };

    try {
      const {
        headline,
        body,
        cta,
        hashtags,
        brandScore,
        script,
        caption,
        scenes,
        instagramCaption,
        youtubeDescription,
        sourceAnalysisSummary,
        normalizedDurationSeconds,
      } = await generateVideoReelContent(videoReelInput);

      const newDraft: VideoReelDraft = {
        id: crypto.randomUUID(),
        topic: prompt.trim(),
        headline,
        body,
        cta,
        hashtags,
        brandScore,
        script,
        caption,
        instagramCaption,
        youtubeDescription,
        targetPlatforms: ['instagram_reels', 'youtube_shorts'],
        normalizedDurationSeconds,
        sourceAnalysisSummary,
        sceneVideoProvider,
        scenes,
        videoReelInput,
        status: 'draft',
      };

      setReelDrafts(prev => [newDraft, ...prev]);
      setIsModalOpen(false);
      resetModal();
    } catch (err) {
      console.error('Failed to generate reel script:', err);
      alert('Failed to generate script. Please try again.');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // ── Step 2: Send payload to Fal ──────────────────────────────────────────
  const handleGenerateVideo = async (draft: VideoReelDraft) => {
    setGeneratingVideoId(draft.id);

    setReelDrafts(prev =>
      prev.map(d => d.id === draft.id ? { ...d, status: 'generating' } : d)
    );

    const payload: FalJobPayload = {
      jobId: crypto.randomUUID(),
      draftId: draft.id,
      script: draft.script,
      scenes: draft.scenes,
      sceneVideoProvider: draft.sceneVideoProvider || 'gemini',
      sourceAnalysisSummary: draft.sourceAnalysisSummary,
      videoReelInput: draft.videoReelInput,
      brandContext: BRAND_CONTEXT,
    };

    try {
      const { finalVideoUrl } = await generateReelVideo(payload);

      setReelDrafts(prev =>
        prev.map(d =>
          d.id === draft.id
            ? { ...d, status: 'ready', finalVideoUrl }
            : d
        )
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to generate video:', err);
      setReelDrafts(prev =>
        prev.map(d =>
          d.id === draft.id
            ? { ...d, status: 'error', errorMessage }
            : d
        )
      );
    } finally {
      setGeneratingVideoId(null);
    }
  };

  const handleDelete = (id: string) => {
    setReelDrafts(prev => prev.filter(d => d.id !== id));
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files: File[] = Array.from(e.target.files as FileList).slice(0, 4);
    const readers = files.map(
      file =>
        new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string as string);
          r.onerror = reject;
          r.readAsDataURL(file);
        })
    );
    Promise.all(readers).then(imgs => setRefImages(imgs)).catch(console.error);
    if (refImageInputRef.current) refImageInputRef.current.value = '';
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">Video Reels Draft</h2>
          <p className="text-stone-500 mt-1 text-sm sm:text-base">
            AI script + scene planning, provider-based scene video generation, Fal concat assembly.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm text-sm sm:text-base shrink-0 min-h-[44px]"
        >
          <Video className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">New Reel</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Empty state */}
      {reelDrafts.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-stone-200 border-dashed">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Film className="w-8 h-8 text-stone-400" />
          </div>
          <h3 className="text-lg font-medium text-stone-900 mb-2">No video reels yet</h3>
          <p className="text-stone-500 max-w-sm mx-auto mb-6">
            Click "New Reel" to generate a script and metadata, then render scene videos with Gemini or OpenAI.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            Create your first reel
          </button>
        </div>
      )}

      {/* Draft cards */}
      {reelDrafts.length > 0 && (
        <div className="grid gap-6">
          {reelDrafts.map((draft, index) => (
            <motion.div
              key={draft.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden"
            >
              {/* Card header */}
              <div className="p-4 sm:p-6 border-b border-stone-100 flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                    <StatusBadge status={draft.status} />
                    <h3 className="text-lg sm:text-xl font-bold text-stone-900 leading-snug">{draft.topic}</h3>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 text-stone-500 text-sm flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {draft.videoReelInput.targetDurationSeconds}s target
                      {draft.normalizedDurationSeconds ? ` · ${draft.normalizedDurationSeconds}s final` : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      {LANGUAGES.find(l => l.code === draft.videoReelInput.language)?.label ?? draft.videoReelInput.language}
                    </span>
                    <span>
                      Scene model: <span className="font-medium">{draft.sceneVideoProvider || 'gemini'}</span>
                    </span>
                    {draft.videoReelInput.mode === 'FROM_REFERENCE_VIDEO' && (
                      <span className="flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5" />
                        {draft.videoReelInput.referenceVideoKind ?? 'DIRECT_URL'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(draft.id)}
                  className="text-stone-400 hover:text-red-500 transition-colors p-2 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Delete draft"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Card body */}
              <div className="p-4 sm:p-6 grid md:grid-cols-2 gap-6 sm:gap-8">
                {/* Left: Script */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-stone-900 flex items-center gap-2 text-sm">
                      <Clapperboard className="w-4 h-4 text-stone-400" />
                      Script
                    </h4>
                    <button
                      onClick={() => handleCopyScript(draft.id, draft.script ?? '')}
                      className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors"
                      title="Copy script"
                    >
                      {copiedScript === draft.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedScript === draft.id ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-stone-900">{draft.headline ?? draft.script}</p>
                  <p className="text-[13px] text-stone-600 leading-relaxed whitespace-pre-wrap">{draft.body ?? ''}</p>
                  {/* brandScore bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-xs text-stone-500">
                      <span>Brand score</span>
                      <span className="font-semibold text-stone-700">{draft.brandScore ?? 0}/100</span>
                    </div>
                    <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${draft.brandScore ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Caption + actions */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-stone-900 flex items-center gap-2 text-sm">
                        <MessageSquare className="w-4 h-4 text-stone-400" />
                        Instagram Caption
                      </h4>
                      <button
                        onClick={() => handleCopyCaption(draft.id, draft.caption ?? '')}
                        className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors"
                        title="Copy caption"
                      >
                        {copiedCaption === draft.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedCaption === draft.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 text-sm max-h-44 overflow-y-auto custom-scrollbar">
                      <p className="text-[13px] text-stone-700 leading-relaxed whitespace-pre-wrap">{draft.caption ?? ''}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-stone-900 flex items-center gap-2 text-sm">
                        <Video className="w-4 h-4 text-stone-400" />
                        YouTube Description
                      </h4>
                      <button
                        onClick={() => handleCopyYoutubeDescription(draft.id, draft.youtubeDescription ?? '')}
                        className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors"
                        title="Copy YouTube description"
                      >
                        {copiedYoutubeDescription === draft.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedYoutubeDescription === draft.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 text-sm max-h-36 overflow-y-auto custom-scrollbar">
                      <p className="text-[13px] text-stone-700 leading-relaxed whitespace-pre-wrap">
                        {draft.youtubeDescription ?? 'No YouTube description generated yet.'}
                      </p>
                    </div>
                  </div>

                  {draft.sourceAnalysisSummary && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-[11px] font-semibold tracking-wide uppercase text-blue-700">Source analysis</p>
                      <p className="text-xs text-blue-900 mt-1 leading-relaxed">{draft.sourceAnalysisSummary}</p>
                    </div>
                  )}

                  {/* Scene Breakdown — hidden from UI, data kept for Fal pipeline */}
                  <div className="hidden">
                    <div className="space-y-3">
                      {draft.scenes.map(scene => (
                        <SceneCard key={scene.index} scene={scene} total={draft.scenes.length} />
                      ))}
                    </div>
                  </div>

                  {/* Action area */}
                  <div className="pt-2">
                    {draft.status === 'draft' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-stone-500 shrink-0">Scene Model</label>
                          <select
                            value={draft.sceneVideoProvider || 'gemini'}
                            onChange={(e) => {
                              const nextProvider = e.target.value as SceneVideoProvider;
                              setReelDrafts(prev =>
                                prev.map(d =>
                                  d.id === draft.id
                                    ? { ...d, sceneVideoProvider: nextProvider }
                                    : d
                                )
                              );
                            }}
                            disabled={!!generatingVideoId}
                            className="flex-1 px-2.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          >
                            {SCENE_VIDEO_PROVIDERS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => handleGenerateVideo(draft)}
                          disabled={!!generatingVideoId}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {generatingVideoId === draft.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                          {generatingVideoId === draft.id
                            ? 'Generating scenes + concatenating…'
                            : 'Generate Reel Video'}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {draft.status === 'generating' && (
                      <div className="w-full py-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl font-medium flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Producing your Reel… this may take a minute.
                      </div>
                    )}

                    {draft.status === 'ready' && draft.finalVideoUrl && (
                      <div className="space-y-3">
                        <div className="w-full py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-medium flex items-center justify-center gap-2 text-sm">
                          <CheckCircle2 className="w-5 h-5" />
                          Your Reel is ready!
                        </div>
                        <a
                          href={draft.finalVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <Download className="w-5 h-5" />
                          Download Reel Video
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
                            setReelDrafts(prev =>
                              prev.map(d =>
                                d.id === draft.id
                                  ? { ...d, status: 'draft', errorMessage: undefined }
                                  : d
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

      {/* ── Creation Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isGeneratingScript && setIsModalOpen(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col"
            >
              {/* Modal header */}
              <div className="p-4 sm:p-6 border-b border-stone-100 flex items-center justify-between shrink-0 gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900">New Video Reel</h3>
                  <p className="text-stone-500 text-sm mt-1">
                    Gemini creates the reel plan from your prompt/source. Then scenes render with your chosen provider.
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={isGeneratingScript}
                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto custom-scrollbar">
                {/* Suggested topics */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Suggested Topics
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_TOPICS.map(t => (
                      <button
                        key={t}
                        onClick={() => setPrompt(t)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                          prompt === t
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-stone-100 text-stone-700 border-transparent hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prompt */}
                <div>
                  <label htmlFor="reel-prompt" className="block text-sm font-medium text-stone-700 mb-1.5">
                    Topic / Prompt <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="reel-prompt"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="e.g. 4-7-8 breathing technique for better sleep"
                    rows={2}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-stone-900 placeholder:text-stone-400 resize-none"
                  />
                </div>

                {/* Mode */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Mode</label>
                  <p className="text-xs text-stone-500 mb-2">
                    Gemini analyzes reference media when provided. Scene videos are generated with your selected model provider.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { v: 'PROMPT_ONLY', label: 'Prompt Only', icon: <Sparkles className="w-4 h-4" /> },
                        { v: 'FROM_REFERENCE_VIDEO', label: 'Any Video Source', icon: <Film className="w-4 h-4" /> },
                        { v: 'FROM_IMAGES', label: 'Reference Images', icon: <Upload className="w-4 h-4" /> },
                      ] as const
                    ).map(({ v, label, icon }) => (
                      <button
                        key={v}
                        onClick={() => {
                          setMode(v);
                          setModalError(null);
                        }}
                        className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-medium transition-colors ${
                          mode === v
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        {icon}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode-specific inputs */}
                {mode === 'FROM_REFERENCE_VIDEO' && (
                  <div className="space-y-4 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                    <div>
                      <label htmlFor="ref-video" className="block text-sm font-medium text-stone-700 mb-1.5">
                        Source URL (YouTube / Instagram / MP4)
                      </label>
                      <input
                        id="ref-video"
                        type="url"
                        value={refVideoUrl}
                        onChange={e => {
                          const nextValue = e.target.value;
                          setRefVideoUrl(nextValue);
                          if (refVideoKind !== 'LOCAL_MP4') {
                            setRefVideoKind(inferReferenceKindFromUrl(nextValue));
                          }
                        }}
                        placeholder="https://youtube.com/... or https://instagram.com/reel/..."
                        className="w-full px-4 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-stone-900 placeholder:text-stone-400"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="ref-kind" className="block text-sm font-medium text-stone-700 mb-1.5">
                          Source Type
                        </label>
                        <select
                          id="ref-kind"
                          value={refVideoKind}
                          onChange={(e) => setRefVideoKind(e.target.value as VideoReferenceKind)}
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-stone-900"
                        >
                          <option value="YOUTUBE">YouTube</option>
                          <option value="INSTAGRAM">Instagram Reel</option>
                          <option value="LOCAL_MP4">Local MP4</option>
                          <option value="DIRECT_URL">Direct URL</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="ref-title" className="block text-sm font-medium text-stone-700 mb-1.5">
                          Source Title (optional)
                        </label>
                        <input
                          id="ref-title"
                          type="text"
                          value={refVideoTitle}
                          onChange={(e) => setRefVideoTitle(e.target.value)}
                          placeholder="e.g. Morning Kapalabhati with Abhi"
                          className="w-full px-4 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-stone-900 placeholder:text-stone-400"
                        />
                      </div>
                    </div>

                    <div>
                      <input
                        ref={refVideoInputRef}
                        type="file"
                        accept="video/mp4,video/*"
                        className="hidden"
                        onChange={handleRefVideoFileUpload}
                      />
                      <button
                        onClick={() => refVideoInputRef.current?.click()}
                        disabled={uploadingRefVideo}
                        className="w-full py-2.5 border border-dashed border-stone-300 hover:border-emerald-400 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {uploadingRefVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploadingRefVideo ? 'Uploading local MP4…' : 'Upload Local MP4 (optional)'}
                      </button>
                      {uploadedRefVideoName && (
                        <p className="text-xs text-stone-600 mt-2">
                          Uploaded: <span className="font-medium">{uploadedRefVideoName}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {mode === 'FROM_IMAGES' && (
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      Reference Images (up to 4)
                    </label>
                    <input
                      ref={refImageInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleRefImageUpload}
                    />
                    {refImages.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {refImages.map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            alt={`ref ${i + 1}`}
                            className="w-full aspect-square object-cover rounded-lg border border-stone-200"
                          />
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => refImageInputRef.current?.click()}
                      className="w-full py-2.5 border border-dashed border-stone-300 hover:border-emerald-400 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {refImages.length > 0 ? 'Change Images' : 'Upload Reference Images'}
                    </button>
                  </div>
                )}

                {/* Duration + Language */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      Target Duration
                      <span className="ml-2 text-emerald-600 font-semibold">{targetDuration}s</span>
                    </label>
                    <input
                      type="range"
                      min={15}
                      max={60}
                      step={1}
                      value={targetDuration}
                      onChange={e => setTargetDuration(Number(e.target.value))}
                      className="w-full accent-emerald-600"
                    />
                    <div className="flex justify-between text-xs text-stone-400 mt-1">
                      <span>15s</span>
                      <span>60s</span>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="reel-lang" className="block text-sm font-medium text-stone-700 mb-1.5">
                      Language
                    </label>
                    <select
                      id="reel-lang"
                      value={language}
                      onChange={e => setLanguage(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-stone-900"
                    >
                      {LANGUAGES.map(l => (
                        <option key={l.code} value={l.code}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="scene-provider" className="block text-sm font-medium text-stone-700 mb-1.5">
                    Scene Video Provider
                  </label>
                  <select
                    id="scene-provider"
                    value={sceneVideoProvider}
                    onChange={(e) => setSceneVideoProvider(e.target.value as SceneVideoProvider)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-stone-900"
                  >
                    {SCENE_VIDEO_PROVIDERS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {modalError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-700">{modalError}</p>
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div className="p-4 sm:p-6 border-t border-stone-100 flex gap-3 shrink-0">
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={isGeneratingScript}
                  className="flex-1 py-2.5 border border-stone-300 hover:bg-stone-50 text-stone-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateScript}
                  disabled={
                    !prompt.trim() ||
                    isGeneratingScript ||
                    uploadingRefVideo ||
                    (mode === 'FROM_REFERENCE_VIDEO' && !refVideoUrl.trim()) ||
                    (mode === 'FROM_IMAGES' && refImages.length === 0)
                  }
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGeneratingScript ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Writing script + scene plan…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Reel Plan
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
