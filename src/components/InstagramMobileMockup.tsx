import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, RefreshCw, Loader2, X, Sparkles } from 'lucide-react';
import { ReadyPost } from '../types';
import { regenerateSingleSlideImage, type ImageProvider } from '../services/geminiService';

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
  const [changeInstruction, setChangeInstruction] = useState('');

  const images = post.images;
  const canRegenerate =
    (post.imagePrompt || (post.slideImagePrompts && post.slideImagePrompts.length >= 8)) &&
    post.slides.length > 0;

  const handleRegenerate = async (index: number) => {
    if (!canRegenerate) {
      alert('This post was built from uploaded images. Regeneration requires AI-generated content.');
      return;
    }
    setRegeneratingIndex(index);
    setShowReplaceModal(null);
    setChangeInstruction('');
    try {
      const newImage = await regenerateSingleSlideImage(
        post,
        index,
        imageProvider,
        changeInstruction.trim() || undefined
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

              {/* Nav arrows (outside image area, for desktop) */}
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

            {/* Action bar (Instagram-like) */}
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

      {/* Slide thumbnails with Replace */}
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
            Click the ↻ icon on any slide to replace or redo it
          </p>
        )}
      </div>

      {/* Replace modal */}
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-200 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-500" />
                  Replace slide {showReplaceModal + 1}
                </h3>
                <button
                  onClick={() => setShowReplaceModal(null)}
                  className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-stone-600 mb-4">
                Regenerate this slide with AI. Optionally specify what to change:
              </p>
              <input
                type="text"
                value={changeInstruction}
                onChange={(e) => setChangeInstruction(e.target.value)}
                placeholder="e.g. Make the text larger, fix typo in headline, darker background..."
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 mb-4 text-stone-900 placeholder:text-stone-400"
              />
              <div className="flex gap-2 mb-4">
                <label className="flex-1 text-sm font-medium text-stone-700">Model:</label>
                <select
                  value={imageProvider}
                  onChange={(e) => onImageProviderChange(e.target.value as ImageProvider)}
                  className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="google">Google (Nano Banana)</option>
                  <option value="openai">OpenAI (GPT Image 1.5)</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReplaceModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-medium hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRegenerate(showReplaceModal)}
                  disabled={regeneratingIndex !== null}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {regeneratingIndex !== null ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                  Regenerate
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
