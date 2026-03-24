import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Loader2, Sparkles, Trash2, X, Video, Download,
  ChevronRight, AlertCircle, Clock, Globe, Upload, Film,
  CheckCircle2, Play, Clapperboard, MessageSquare, Copy,
} from 'lucide-react';
import { VideoReelDraft, VideoReelInput, VideoReelMode, BrandContext } from '../types';
import { generateVideoReelContent } from '../services/videoReelService';
import { generateReelVideo, FalJobPayload } from '../services/falService';
import { useWakeLock } from '../lib/useWakeLock';

// ─── Brand Context (used by Fal video pipeline only) ─────────────────────────
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
      <p className="text-sm text-stone-800 italic">"{scene.narrative}"</p>
      <p className="text-xs text-stone-500 border-t border-stone-200 pt-2 leading-relaxed">
        <span className="font-semibold text-stone-600">Visual: </span>{scene.visualPrompt}
      </p>
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

  // ── Modal form state ──────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<VideoReelMode>('PROMPT_ONLY');
  const [refVideoUrl, setRefVideoUrl] = useState('');
  const [refImages, setRefImages] = useState<string[]>([]);
  const [targetDuration, setTargetDuration] = useState(30);
  const [language, setLanguage] = useState('en');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  useWakeLock(isGeneratingScript);

  const refImageInputRef = useRef<HTMLInputElement>(null);

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
    setRefImages([]);
    setTargetDuration(30);
    setLanguage('en');
  };

  // ── Step 1: Generate script + caption from Gemini (brand context) ─────────
  const handleGenerateScript = async () => {
    if (!prompt.trim()) return;
    setIsGeneratingScript(true);

    const videoReelInput: VideoReelInput = {
      prompt: prompt.trim(),
      mode,
      referenceVideoUrl: mode === 'FROM_REFERENCE_VIDEO' ? refVideoUrl : undefined,
      referenceImages: mode === 'FROM_IMAGES' ? refImages : undefined,
      targetDurationSeconds: targetDuration,
      language,
    };

    try {
      const { headline, body, cta, hashtags, brandScore, script, caption, scenes } = await generateVideoReelContent(videoReelInput);

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
            AI-generated short-form video scripts + automated Reel production via Fal.
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
            Click "New Reel" to generate a script and caption, then produce your first AI-powered Instagram Reel.
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
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      {LANGUAGES.find(l => l.code === draft.videoReelInput.language)?.label ?? draft.videoReelInput.language}
                    </span>
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
                  <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 text-sm max-h-64 overflow-y-auto custom-scrollbar">
                    <p className="text-[13px] text-stone-700 leading-relaxed whitespace-pre-wrap">{draft.caption ?? ''}</p>
                  </div>

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
                      <button
                        disabled
                        className="w-full py-3 bg-stone-200 text-stone-400 rounded-xl font-medium flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <Play className="w-5 h-5" />
                        Generate Reel Video
                        <ChevronRight className="w-4 h-4" />
                      </button>
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
                    AI will write a script + scene plan, then Fal produces the video.
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

                {/* Mode — hidden for now */}
                <div className="hidden">
                  <label className="block text-sm font-medium text-stone-700 mb-2">Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { v: 'PROMPT_ONLY', label: 'Prompt Only', icon: <Sparkles className="w-4 h-4" /> },
                        { v: 'FROM_REFERENCE_VIDEO', label: 'Ref. Video', icon: <Film className="w-4 h-4" /> },
                        { v: 'FROM_IMAGES', label: 'From Images', icon: <Upload className="w-4 h-4" /> },
                      ] as const
                    ).map(({ v, label, icon }) => (
                      <button
                        key={v}
                        onClick={() => setMode(v)}
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

                {/* Mode-specific inputs — hidden for now */}
                {false && mode === 'FROM_REFERENCE_VIDEO' && (
                  <div>
                    <label htmlFor="ref-video" className="block text-sm font-medium text-stone-700 mb-1.5">
                      Reference Video URL
                    </label>
                    <input
                      id="ref-video"
                      type="url"
                      value={refVideoUrl}
                      onChange={e => setRefVideoUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-stone-900 placeholder:text-stone-400"
                    />
                  </div>
                )}

                {false && mode === 'FROM_IMAGES' && (
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

                {/* Duration + Language — hidden for now */}
                <div className="hidden grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      Target Duration
                      <span className="ml-2 text-emerald-600 font-semibold">{targetDuration}s</span>
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={60}
                      step={1}
                      value={targetDuration}
                      onChange={e => setTargetDuration(Number(e.target.value))}
                      className="w-full accent-emerald-600"
                    />
                    <div className="flex justify-between text-xs text-stone-400 mt-1">
                      <span>10s</span>
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
                  disabled={!prompt.trim() || isGeneratingScript}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGeneratingScript ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Writing script…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Script
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
