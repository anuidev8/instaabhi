import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Loader2, Sparkles, Trash2, X, Video, Download,
  ChevronRight, AlertCircle, Clock, Globe, Upload, Film,
  CheckCircle2, Play, Mic, Clapperboard,
} from 'lucide-react';
import { VideoReelDraft, VideoReelInput, VideoReelMode, BrandContext } from '../types';
import { generateVideoReelScript } from '../services/geminiService';
import { generateReelVideo, FalJobPayload } from '../services/falService';

// ─── Brand Context ────────────────────────────────────────────────────────────
// Edit these to match your brand. voiceId is an ElevenLabs voice ID.
const BRAND_CONTEXT: BrandContext = {
  name: 'Meditate with Abhi',
  handle: '@meditatewithAbhi',
  niche: 'meditation, mindfulness, breathwork',
  voice: 'calm, nurturing, science-backed spiritual guide',
  pillars: 'breathing techniques, mindfulness, sleep improvement, stress relief',
  voiceId: (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined)?.trim() || 'i6TuzGTpruZ0jkkUZQyp',
};

// ─── Suggested topics ────────────────────────────────────────────────────────
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

// ─── Scene card ───────────────────────────────────────────────────────────────
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
}

export default function VideoReelsDraftTab({ reelDrafts, setReelDrafts }: VideoReelsDraftTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(null);

  // ── Modal form state ──────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<VideoReelMode>('PROMPT_ONLY');
  const [refVideoUrl, setRefVideoUrl] = useState('');
  const [refImages, setRefImages] = useState<string[]>([]);
  const [targetDuration, setTargetDuration] = useState(20);
  const [language, setLanguage] = useState('en');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  const refImageInputRef = useRef<HTMLInputElement>(null);

  const resetModal = () => {
    setPrompt('');
    setMode('PROMPT_ONLY');
    setRefVideoUrl('');
    setRefImages([]);
    setTargetDuration(20);
    setLanguage('en');
  };

  // ── Step 1: Generate script from Gemini ──────────────────────────────────
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
      const { script, scenes } = await generateVideoReelScript(videoReelInput, BRAND_CONTEXT);

      const newDraft: VideoReelDraft = {
        id: crypto.randomUUID(),
        topic: prompt.trim(),
        script,
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

    // Mark as generating in UI
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Video Reels Draft</h2>
          <p className="text-stone-500 mt-1">
            AI-generated short-form video scripts + automated Reel production via Fal.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
        >
          <Video className="w-5 h-5" />
          New Reel
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
            Click "New Reel" to generate a script and scenes, then produce your first AI-powered Instagram Reel.
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
              <div className="p-6 border-b border-stone-100 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <StatusBadge status={draft.status} />
                    <h3 className="text-xl font-bold text-stone-900">{draft.topic}</h3>
                  </div>
                  <div className="flex items-center gap-4 text-stone-500 text-sm">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {draft.videoReelInput.targetDurationSeconds}s target
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      {LANGUAGES.find(l => l.code === draft.videoReelInput.language)?.label ?? draft.videoReelInput.language}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clapperboard className="w-3.5 h-3.5" />
                      {draft.scenes.length} scenes
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(draft.id)}
                  className="text-stone-400 hover:text-red-500 transition-colors p-2"
                  title="Delete draft"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Card body */}
              <div className="p-6 grid md:grid-cols-2 gap-8">
                {/* Left: Script */}
                <div>
                  <h4 className="font-semibold text-stone-900 mb-3 flex items-center gap-2 text-sm">
                    <Mic className="w-4 h-4 text-stone-400" />
                    Voiceover Script
                  </h4>
                  <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 text-sm text-stone-700 leading-relaxed max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                    {draft.script}
                  </div>
                </div>

                {/* Right: Scenes + actions */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-stone-900 flex items-center gap-2 text-sm">
                    <Clapperboard className="w-4 h-4 text-stone-400" />
                    Scene Breakdown
                  </h4>
                  <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {draft.scenes.map(scene => (
                      <SceneCard key={scene.index} scene={scene} total={draft.scenes.length} />
                    ))}
                  </div>

                  {/* Action area */}
                  <div className="pt-2">
                    {draft.status === 'draft' && (
                      <button
                        onClick={() => handleGenerateVideo(draft)}
                        disabled={generatingVideoId !== null}
                        className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        {/* Inline preview */}
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
                            // Reset to draft status so user can retry
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
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal header */}
              <div className="p-6 border-b border-stone-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-stone-900">New Video Reel</h3>
                  <p className="text-stone-500 text-sm mt-1">
                    AI will write a script + scene plan, then Fal produces the video.
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={isGeneratingScript}
                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
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

                {/* Mode-specific inputs */}
                {mode === 'FROM_REFERENCE_VIDEO' && (
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
              <div className="p-6 border-t border-stone-100 flex gap-3 shrink-0">
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
