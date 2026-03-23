import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Copy, Upload, CheckCircle2, Loader2, Sparkles, Trash2, ArrowRight, PenTool, LayoutGrid, X, Wand2 } from 'lucide-react';
import { Draft, ReadyPost } from '../types';
import { generateDraft, generatePostContent, generateCarouselImagesWithProvider, type ImageProvider } from '../services/geminiService';

const SUGGESTED_TOPICS = [
  "Square Breathing",
  "Diaphragmatic Breathing",
  "6-3-9 Breathing",
  "Alternate Nostril Breathing",
  "Bhastrika",
  "Humming Bee Breath",
  "Om Chanting"
];

interface DraftsTabProps {
  drafts: Draft[];
  setDrafts: React.Dispatch<React.SetStateAction<Draft[]>>;
  setReadyPosts: React.Dispatch<React.SetStateAction<ReadyPost[]>>;
  onPostReady: () => void;
}

export default function DraftsTab({ drafts, setDrafts, setReadyPosts, onPostReady }: DraftsTabProps) {
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState<string | null>(null);
  const [isBuildingPost, setIsBuildingPost] = useState<string | null>(null);
  const [imageProvider, setImageProvider] = useState<ImageProvider>('google');
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  
  // Topic Modal State
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [customTopic, setCustomTopic] = useState("");
  const [slideCount, setSlideCount] = useState(6); // default 6, max 8

  const handleAutoBuildDraft = async (topic?: string) => {
    setIsTopicModalOpen(false);
    setIsGeneratingDraft(true);
    try {
      const data = await generateDraft(topic, slideCount);
      const newDraft: Draft = {
        id: crypto.randomUUID(),
        topic: data.topic,
        slides: data.slides,
        imagePrompt: data.imagePrompt,
        slideImagePrompts: data.slideImagePrompts,
        uploadedImages: [],
        status: 'draft',
      };
      setDrafts(prev => [newDraft, ...prev]);
    } catch (error) {
      console.error("Failed to generate draft:", error);
      alert("Failed to generate draft. Please try again.");
    } finally {
      setIsGeneratingDraft(false);
      setCustomTopic("");
    }
  };

  const handleCopyPrompt = (id: string, prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(id);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const handleUploadClick = (id: string) => {
    setActiveDraftId(id);
    fileInputRef.current?.click();
  };

  const handleGenerateWithAI = async (draft: Draft) => {
    setIsGeneratingImages(draft.id);
    try {
      const { images, modelUsed } = await generateCarouselImagesWithProvider(draft, imageProvider);
      setDrafts(prev =>
        prev.map(d =>
          d.id === draft.id
            ? {
                ...d,
                uploadedImages: images,
                status: 'images_uploaded' as const,
                imageModelUsed: modelUsed,
              }
            : d
        )
      );
    } catch (error) {
      console.error('Failed to generate images:', error);
      alert(`Failed to generate images with AI. Check your ${imageProvider === 'google' ? 'Gemini' : 'OpenAI'} API key.`);
    } finally {
      setIsGeneratingImages(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeDraftId || !e.target.files) return;

    const files = Array.from(e.target.files as FileList).slice(0, 8); // Max 8 images
    if (files.length === 0) return;

    const readers = files.map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(base64Images => {
      setDrafts(prev => prev.map(draft => {
        if (draft.id === activeDraftId) {
          return {
            ...draft,
            uploadedImages: base64Images,
            status: base64Images.length > 0 ? 'images_uploaded' : 'draft'
          };
        }
        return draft;
      }));
    }).catch(error => {
      console.error("Error reading files:", error);
      alert("Error reading files. Please try again.");
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setActiveDraftId(null);
  };

  const handleBuildPost = async (draft: Draft) => {
    setIsBuildingPost(draft.id);
    try {
      const slidesText = draft.slides.map(s => s.text);
      const data = await generatePostContent(draft.topic, slidesText);
      
      const newReadyPost: ReadyPost = {
        id: draft.id,
        topic: draft.topic,
        slides: draft.slides,
        images: draft.uploadedImages,
        caption: data.caption,
        hashtags: data.hashtags,
        title: data.title,
        imagePrompt: draft.imagePrompt,
        slideImagePrompts: draft.slideImagePrompts,
        imageProvider,
      };

      setReadyPosts(prev => [newReadyPost, ...prev]);
      setDrafts(prev => prev.filter(d => d.id !== draft.id));
      onPostReady();
    } catch (error) {
      console.error("Failed to build post:", error);
      alert("Failed to build post. Please try again.");
    } finally {
      setIsBuildingPost(null);
    }
  };

  const handleDeleteDraft = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Carousel Drafts</h2>
          <p className="text-stone-500 mt-1">Generate and manage your Instagram carousel ideas.</p>
        </div>
        <button
          onClick={() => setIsTopicModalOpen(true)}
          disabled={isGeneratingDraft}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
        >
          {isGeneratingDraft ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          Auto-Build Draft
        </button>
      </div>

      <input 
        type="file" 
        multiple 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {drafts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-stone-200 border-dashed">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <PenTool className="w-8 h-8 text-stone-400" />
          </div>
          <h3 className="text-lg font-medium text-stone-900 mb-2">No drafts yet</h3>
          <p className="text-stone-500 max-w-sm mx-auto mb-6">
            Click the Auto-Build Draft button to generate your first Instagram carousel idea.
          </p>
          <button
            onClick={() => setIsTopicModalOpen(true)}
            className="text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            Create your first draft
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {drafts.map((draft, index) => (
            <motion.div 
              key={draft.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2.5 py-1 bg-stone-100 text-stone-600 text-xs font-semibold uppercase tracking-wider rounded-md">
                      Draft
                    </span>
                    <h3 className="text-xl font-bold text-stone-900">{draft.topic}</h3>
                  </div>
                  <p className="text-stone-500 text-sm">{draft.slides.length} Slides • AI Generated</p>
                </div>
                <button 
                  onClick={() => handleDeleteDraft(draft.id)}
                  className="text-stone-400 hover:text-red-500 transition-colors p-2"
                  title="Delete draft"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 grid md:grid-cols-2 gap-8">
                {/* Left Column: Slides */}
                <div>
                  <h4 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-stone-400" />
                    Slide Content
                  </h4>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {draft.slides.map((slide, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <span className="font-mono text-stone-400 font-medium w-5 shrink-0">{i + 1}.</span>
                        <p className="text-stone-700 bg-stone-50 p-3 rounded-lg flex-1 border border-stone-100">{slide.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Workflow */}
                <div className="space-y-6">
                  {/* Step 1: Image Prompt */}
                  <div className="bg-stone-50 rounded-xl p-5 border border-stone-200">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-semibold text-stone-900 text-sm">1. Generate Images</h4>
                      <button 
                        onClick={() => handleCopyPrompt(draft.id, draft.imagePrompt)}
                        className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1.5"
                      >
                        {copiedPrompt === draft.id ? (
                          <><CheckCircle2 className="w-4 h-4" /> Copied</>
                        ) : (
                          <><Copy className="w-4 h-4" /> Copy Prompt</>
                        )}
                      </button>
                    </div>
                    <div className="text-xs text-stone-700 font-mono bg-white p-3 rounded border border-stone-200 mb-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {draft.imagePrompt}
                    </div>
                    <p className="text-xs text-stone-500">
                      Paste this prompt into ChatGPT or Gemini to generate your 8 individual slide images.
                    </p>
                  </div>

                  {/* Step 2: Get Images — Upload OR Generate with AI */}
                  <div className="bg-stone-50 rounded-xl p-5 border border-stone-200">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold text-stone-900 text-sm">2. Get Slide Images</h4>
                      <span className="text-xs font-medium text-stone-500 bg-stone-200 px-2 py-1 rounded-full">
                        {draft.uploadedImages.length}/{draft.slides.length}
                      </span>
                    </div>

                    {draft.imageModelUsed && (
                      <p className="text-xs text-emerald-700 mb-2 flex items-center gap-1.5">
                        <Wand2 className="w-3.5 h-3.5" />
                        Generated with {draft.imageModelUsed}
                      </p>
                    )}

                    <div className="mb-3">
                      <label className="block text-xs font-medium text-stone-600 mb-1.5">
                        Image model
                      </label>
                      <select
                        value={imageProvider}
                        onChange={(e) => setImageProvider(e.target.value as ImageProvider)}
                        className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-stone-900"
                      >
                        <option value="google">Google (Nano Banana)</option>
                        <option value="openai">OpenAI (GPT Image 1.5)</option>
                      </select>
                    </div>
                    
                    {draft.uploadedImages.length > 0 ? (
                      <div className="mb-4 grid grid-cols-4 gap-2 rounded-md overflow-hidden border border-stone-200 p-2">
                        {draft.uploadedImages.map((img, i) => (
                          <img key={i} src={img} alt={`Slide ${i+1}`} className="w-full h-auto aspect-square object-cover rounded" />
                        ))}
                      </div>
                    ) : null}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGenerateWithAI(draft)}
                        disabled={isGeneratingImages === draft.id}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isGeneratingImages === draft.id ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                        ) : (
                          <><Wand2 className="w-4 h-4" /> Generate with AI</>
                        )}
                      </button>
                      <button 
                        onClick={() => handleUploadClick(draft.id)}
                        className="flex-1 py-2.5 border border-stone-300 hover:border-stone-400 hover:bg-stone-100 text-stone-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Images
                      </button>
                    </div>
                  </div>

                  {/* Step 3: Build Post */}
                  <div>
                    <button 
                      onClick={() => handleBuildPost(draft)}
                      disabled={draft.uploadedImages.length === 0 || isBuildingPost === draft.id}
                      className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isBuildingPost === draft.id ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Building Post...</>
                      ) : (
                        <>Build Instagram Post <ArrowRight className="w-5 h-5" /></>
                      )}
                    </button>
                    {draft.uploadedImages.length === 0 && (
                      <p className="text-xs text-center text-stone-500 mt-2">
                        Upload your generated images to build the final post.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Topic Selection Modal */}
      <AnimatePresence>
        {isTopicModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTopicModalOpen(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-stone-900">Choose a Topic</h3>
                  <p className="text-stone-500 text-sm mt-1">Select a trending topic or enter your own.</p>
                </div>
                <button
                  onClick={() => setIsTopicModalOpen(false)}
                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Number of slides
                  </label>
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={slideCount}
                      onChange={(e) => setSlideCount(Number(e.target.value))}
                      className="flex-1 h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <span className="text-sm font-semibold text-stone-700 w-8 tabular-nums">
                      {slideCount}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-3">
                    Suggested Topics
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_TOPICS.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => handleAutoBuildDraft(topic)}
                        className="px-3 py-1.5 bg-stone-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-stone-700 text-sm font-medium rounded-lg border border-transparent transition-colors text-left"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-stone-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-sm text-stone-500 font-medium">OR</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="custom-topic" className="block text-sm font-medium text-stone-700 mb-2">
                    Custom Topic
                  </label>
                  <div className="flex gap-3">
                    <input
                      id="custom-topic"
                      type="text"
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      placeholder="e.g., The science of sighing..."
                      className="flex-1 px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-stone-900 placeholder:text-stone-400"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customTopic.trim()) {
                          handleAutoBuildDraft(customTopic.trim());
                        }
                      }}
                    />
                    <button
                      onClick={() => handleAutoBuildDraft(customTopic.trim())}
                      disabled={!customTopic.trim()}
                      className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      Generate
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
