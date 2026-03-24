import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, RefreshCw, Loader2, X, Sparkles, Wand2, Eye, EyeOff, ImageIcon } from 'lucide-react';
import { ReadyPost } from '../types';
import {
  regenerateSingleSlideImage,
  getSlidePromptForIndex,
  generateSlidePromptSuggestion,
  buildLastSlideFromMockup,
  APP_MOCKUP_PATHS,
  type ImageProvider,
} from '../services/geminiService';

interface InstagramMobileMockupProps {
  post: ReadyPost;
  onImagesChange: (newImages: string[]) => void;
  imageProvider: ImageProvider;
  onImageProviderChange: (p: ImageProvider) => void;
}

export default function InstagramMobileMockup({
  post,
  onImagesChange,
  imageProvider,
  onImageProviderChange,
}: InstagramMobileMockupProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [showReplaceModal, setShowReplaceModal] = useState<number | null>(null);

  // Replace modal state
  const [promptText, setPromptText] = useState('');
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [isSuggestingPrompt, setIsSuggestingPrompt] = useState(false);
  const [suggestionHistory, setSuggestionHistory] = useState<string[]>([]);

  // App mockup picker state (for last/recap slide)
  const [selectedMockupIndex, setSelectedMockupIndex] = useState(0);
  const [mockupPreviews, setMockupPreviews] = useState<Record<number, string>>({});

  const images = post.images;
  const slideCount = post.slides.length;
  const canRegenerate =
    (post.imagePrompt || (post.slideImagePrompts && post.slideImagePrompts.length >= slideCount)) &&
    slideCount > 0;

  const isRecapSlide = (index: number) => {
    const slide = post.slides[index];
    return index === slideCount - 1 || slide?.role === 'recap';
  };

  // When the replace modal opens, pre-fill the prompt with the AI-generated prompt for that slide
  useEffect(() => {
    if (showReplaceModal === null) return;
    const existingPrompt = getSlidePromptForIndex(post, showReplaceModal);
    setPromptText(existingPrompt);
    setShowFullPrompt(false);
    setSuggestionHistory([]);
    // Reset mockup selector to a deterministic starting choice
    setSelectedMockupIndex(showReplaceModal % APP_MOCKUP_PATHS.length);
  }, [showReplaceModal]);

  // Build mockup preview thumbnails on demand
  const loadMockupPreview = async (mockupIdx: number) => {
    if (mockupPreviews[mockupIdx]) return;
    const slide = showReplaceModal !== null ? post.slides[showReplaceModal] : null;
    try {
      const preview = await buildLastSlideFromMockup(
        APP_MOCKUP_PATHS[mockupIdx],
        slide?.headline || 'READY TO RESET?',
        slide?.body || 'Download The School of Breath App\nfor guided sessions.'
      );
      setMockupPreviews(prev => ({ ...prev, [mockupIdx]: preview }));
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (showReplaceModal !== null && isRecapSlide(showReplaceModal)) {
      // Pre-load first 3 previews
      [0, 1, 2].forEach(loadMockupPreview);
    }
  }, [showReplaceModal]);

  const handleAiSuggest = async () => {
    if (showReplaceModal === null) return;
    setIsSuggestingPrompt(true);
    try {
      const slide = post.slides[showReplaceModal];
      const suggestion = await generateSlidePromptSuggestion(
        slide || { text: promptText },
        showReplaceModal,
        slideCount,
        promptText
      );
      setSuggestionHistory(prev => [promptText, ...prev.slice(0, 4)]);
      setPromptText(prev => `${prev}\n\nIMPROVEMENT: ${suggestion}`);
    } catch (err) {
      console.error('AI suggest failed:', err);
    } finally {
      setIsSuggestingPrompt(false);
    }
  };

  const handleRestoreSuggestion = (older: string) => {
    setSuggestionHistory(prev => prev.slice(1));
    setPromptText(older);
  };

  const handleRegenerateRecap = async (index: number) => {
    setRegeneratingIndex(index);
    setShowReplaceModal(null);
    try {
      const slide = post.slides[index];
      const dataUrl = await buildLastSlideFromMockup(
        APP_MOCKUP_PATHS[selectedMockupIndex],
        slide?.headline || 'READY TO RESET?',
        slide?.body || 'Download The School of Breath App\nfor guided sessions.'
      );
      const newImages = [...images];
      newImages[index] = dataUrl;
      onImagesChange(newImages);
    } catch (err) {
      console.error('Mockup regeneration failed:', err);
      alert('Failed to apply app mockup. Please try again.');
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleRegenerateWithPrompt = async (index: number) => {
    if (!canRegenerate) {
      alert('This post was built from uploaded images. Regeneration requires AI-generated content.');
      return;
    }
    setRegeneratingIndex(index);
    setShowReplaceModal(null);
    try {
      // Use the (possibly edited) promptText as the changeInstruction override
      const newImage = await regenerateSingleSlideImage(
        post,
        index,
        imageProvider,
        promptText.trim() || undefined
      );
      const newImages = [...images];
      newImages[index] = newImage;
      onImagesChange(newImages);
    } catch (error) {
      console.error('Regeneration failed:', error);
      alert(`Failed to regenerate image. Check your ${imageProvider === 'google' ? 'Gemini' : 'OpenAI'} API key.`);
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleRegenerate = (index: number) => {
    if (isRecapSlide(index)) {
      handleRegenerateRecap(index);
    } else {
      handleRegenerateWithPrompt(index);
    }
  };

  const slideRole = showReplaceModal !== null ? (post.slides[showReplaceModal]?.role || null) : null;
  const isModalRecap = showReplaceModal !== null && isRecapSlide(showReplaceModal);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Phone frame */}
      <div className="relative">
        <div className="w-[280px] rounded-[2.5rem] border-[10px] border-stone-800 bg-stone-900 p-2 shadow-2xl">
          {/* Notch */}
          <div className="h-6 mx-8 mb-1 rounded-b-2xl bg-stone-900" />

          {/* Instagram-style content */}
          <div className="rounded-2xl overflow-hidden bg-white aspect-[9/19] max-h-[520px] flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-3 py-2.5 border-b border-stone-200 bg-white shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-900 truncate">meditatewithabhi</p>
                <p className="text-xs text-stone-500 truncate">{post.topic}</p>
              </div>
              <button className="p-1.5 text-stone-400 hover:text-stone-600">
                <span className="text-xl font-bold">⋯</span>
              </button>
            </div>

            {/* Carousel area */}
            <div className="flex-1 relative overflow-hidden bg-black min-h-0">
              <div
                className="flex h-full transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {images.map((src, i) => (
                  <div
                    key={i}
                    className="w-full h-full flex-shrink-0 relative flex items-center justify-center bg-black"
                  >
                    <img
                      src={src}
                      alt={`Slide ${i + 1}`}
                      className="max-w-full max-h-full object-contain"
                    />
                    {regeneratingIndex === i && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                      </div>
                    )}
                    {/* Replace overlay on hover */}
                    {canRegenerate && regeneratingIndex === null && (
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-end justify-center pb-4 opacity-0 hover:opacity-100">
                        <button
                          onClick={() => setShowReplaceModal(i)}
                          className="flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white text-stone-800 rounded-full text-sm font-medium shadow-lg"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Replace slide
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Carousel dots */}
              {images.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentSlide(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i === currentSlide ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Nav arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentSlide((s) => Math.max(0, s - 1))}
                    className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setCurrentSlide((s) => Math.min(images.length - 1, s + 1))}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-4 px-3 py-2 border-t border-stone-200 bg-white shrink-0">
              <div className="flex gap-4">
                <span className="text-xl">♡</span>
                <span className="text-xl">💬</span>
                <span className="text-xl">↗</span>
              </div>
              <div className="flex-1" />
              <span className="text-xl">🔖</span>
            </div>
          </div>
        </div>
      </div>

      {/* Slide thumbnails */}
      <div className="flex flex-col items-center gap-3 w-full max-w-[280px]">
        <p className="text-sm text-stone-500">
          Slide {currentSlide + 1} of {images.length}
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {images.map((_, i) => (
            <div key={i} className="relative group">
              <button
                onClick={() => setCurrentSlide(i)}
                className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors block ${
                  i === currentSlide ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <img src={images[i]} alt="" className="w-full h-full object-cover" />
                {regeneratingIndex === i && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
                {/* Recap badge */}
                {isRecapSlide(i) && (
                  <div className="absolute bottom-0 left-0 right-0 bg-amber-500/80 text-white text-[8px] font-bold text-center py-0.5">
                    APP
                  </div>
                )}
              </button>
              {canRegenerate && regeneratingIndex === null && (
                <button
                  onClick={() => setShowReplaceModal(i)}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md hover:bg-emerald-600 transition-colors"
                  title="Replace this slide"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        {canRegenerate && (
          <p className="text-xs text-stone-400 text-center">
            Click ↻ on any slide to replace or redo it
          </p>
        )}
      </div>

      {/* ─── Replace Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showReplaceModal !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReplaceModal(null)}
              className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/60">
                <div>
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-500" />
                    Replace Slide {showReplaceModal + 1}
                    {slideRole && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-200 text-stone-600 uppercase tracking-wide">
                        {slideRole.replace('_', ' ')}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {isModalRecap
                      ? 'Pick an app mockup and apply it as the CTA slide.'
                      : 'Edit the image prompt below or get an AI suggestion, then regenerate.'}
                  </p>
                </div>
                <button
                  onClick={() => setShowReplaceModal(null)}
                  className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

                {/* ── RECAP / APP MOCKUP PICKER ────────────────────────── */}
                {isModalRecap ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                      <ImageIcon className="w-4 h-4 text-amber-500" />
                      Choose App Mockup
                      <span className="text-xs text-stone-400 font-normal">(real School of Breath screenshots)</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {APP_MOCKUP_PATHS.map((path, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedMockupIndex(idx);
                            loadMockupPreview(idx);
                          }}
                          className={`relative rounded-xl overflow-hidden border-2 aspect-square transition-all ${
                            selectedMockupIndex === idx
                              ? 'border-emerald-500 ring-2 ring-emerald-200 shadow-md'
                              : 'border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          {mockupPreviews[idx] ? (
                            <img src={mockupPreviews[idx]} alt={`Mockup ${idx + 1}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#0A0720] to-[#1A1040] flex items-center justify-center">
                              <span className="text-amber-400 text-xs font-bold">{idx + 1}</span>
                            </div>
                          )}
                          {selectedMockupIndex === idx && (
                            <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Preview of selected composite */}
                    {mockupPreviews[selectedMockupIndex] && (
                      <div className="rounded-xl overflow-hidden border border-stone-200 bg-stone-50">
                        <img
                          src={mockupPreviews[selectedMockupIndex]}
                          alt="Preview"
                          className="w-full object-cover max-h-48"
                        />
                      </div>
                    )}

                    <p className="text-xs text-stone-400">
                      The selected mockup will be composited with your CTA headline and handle on a dark overlay.
                    </p>
                  </div>
                ) : (
                  /* ── REGULAR SLIDE: PROMPT EDITOR ──────────────────── */
                  <div className="space-y-4">

                    {/* Prompt label + toggle full/short */}
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-stone-700">
                        Image Prompt
                        <span className="ml-1.5 text-xs text-stone-400 font-normal">
                          (pre-filled from your original AI generation)
                        </span>
                      </label>
                      <button
                        onClick={() => setShowFullPrompt(v => !v)}
                        className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
                      >
                        {showFullPrompt ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {showFullPrompt ? 'Collapse' : 'Show full prompt'}
                      </button>
                    </div>

                    {/* Prompt textarea */}
                    <textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      rows={showFullPrompt ? 10 : 4}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-stone-800 text-sm placeholder:text-stone-400 resize-none font-mono leading-relaxed transition-all"
                      placeholder="Edit the prompt, or use ✨ AI Suggest to get a brand-accurate improvement..."
                    />

                    {/* AI Suggest button + undo */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAiSuggest}
                        disabled={isSuggestingPrompt}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                      >
                        {isSuggestingPrompt ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Thinking…</>
                        ) : (
                          <><Wand2 className="w-4 h-4" /> ✨ AI Suggest</>
                        )}
                      </button>

                      {suggestionHistory.length > 0 && (
                        <button
                          onClick={() => handleRestoreSuggestion(suggestionHistory[0])}
                          className="text-xs text-stone-400 hover:text-stone-600 underline transition-colors"
                        >
                          ↩ Undo suggestion
                        </button>
                      )}

                      <span className="ml-auto text-xs text-stone-400">
                        {promptText.length} chars
                      </span>
                    </div>

                    {/* What AI Suggest does */}
                    <p className="text-xs text-stone-400 bg-stone-50 rounded-lg px-3 py-2 border border-stone-100">
                      <strong className="text-stone-500">✨ AI Suggest</strong> — analyzes your slide's role, content, and current prompt against the brand's visual rules (cosmic gold, sacred geometry, glow, etc.) and appends a specific improvement instruction.
                    </p>

                    {/* Model selector */}
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-stone-700 whitespace-nowrap">Image model:</label>
                      <select
                        value={imageProvider}
                        onChange={(e) => onImageProviderChange(e.target.value as ImageProvider)}
                        className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                      >
                        <option value="google">Google (Nano Banana)</option>
                        <option value="openai">OpenAI (GPT Image 1.5)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/60">
                <button
                  onClick={() => setShowReplaceModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-medium hover:bg-stone-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRegenerate(showReplaceModal!)}
                  disabled={regeneratingIndex !== null}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {regeneratingIndex !== null ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Generating…</>
                  ) : isModalRecap ? (
                    <><ImageIcon className="w-5 h-5" /> Apply Mockup</>
                  ) : (
                    <><RefreshCw className="w-5 h-5" /> Regenerate Slide</>
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
