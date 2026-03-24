import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileArchive, CheckCircle2, Trash2, LayoutGrid, Image as ImageIcon, Settings2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Plus, Minus, ZoomIn, RotateCcw, Smartphone, Grid3X3, Share2 } from 'lucide-react';
import { ReadyPost, CaptionBlocks } from '../types';
import InstagramMobileMockup from './InstagramMobileMockup';
import CaptionEditor from './CaptionEditor';
import { assembleCaptionFromBlocks } from '../services/geminiService';
import type { ImageProvider } from '../services/geminiService';
import {
  confirmInstagramPublish,
  sendDraftContainerToInstagram,
  uploadImagesForInstagramDraft,
} from '../services/instagramService';
import { bitmapToSquareCarouselDataUrl, imageToSquareCarouselDataUrl, CAROUSEL_SLIDE_PX } from '../utils/carouselSlideExport';
import { downloadCarouselSlidesAsZip } from '../utils/carouselZipDownload';

function SplitImagesDisplay({ post }: { post: ReadyPost }) {
  const [splitImages, setSplitImages] = useState<string[]>([]);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(4);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [padding, setPadding] = useState(0);
  const [gap, setGap] = useState(0);
  const [scale, setScale] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [slideOffsets, setSlideOffsets] = useState<Record<number, {x: number, y: number}>>({});

  const isGrid = post.images.length === 1;

  useEffect(() => {
    if (!isGrid && scale > 1) setScale(1);
  }, [isGrid, scale]);

  const updateSlideOffset = (index: number, dx: number, dy: number) => {
    setSlideOffsets(prev => {
      const current = prev[index] || { x: 0, y: 0 };
      return {
        ...prev,
        [index]: { x: current.x + dx, y: current.y + dy }
      };
    });
  };

  const resetSlideOffset = (index: number) => {
    setSlideOffsets(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  useEffect(() => {
    setZipError(null);
    if (!post.images || post.images.length === 0) return;

    if (isGrid) {
      const imgSrc = post.images[0];
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        // Calculate available width and height after removing padding and gaps
        const availableWidth = img.width - (padding * 2) - (gap * (cols - 1));
        const availableHeight = img.height - (padding * 2) - (gap * (rows - 1));
        
        const cellWidth = availableWidth / cols;
        const cellHeight = availableHeight / rows;
        
        const newImages: string[] = [];

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const canvas = document.createElement('canvas');
            canvas.width = cellWidth;
            canvas.height = cellHeight;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              const index = r * cols + c;
              const sOffset = slideOffsets[index] || { x: 0, y: 0 };
              
              // Apply scale
              const sWidth = cellWidth / scale;
              const sHeight = cellHeight / scale;
              
              // Center the scaled crop and apply offsets (inverted so +x moves image right)
              const sourceX = padding + c * (cellWidth + gap) - offsetX - sOffset.x + (cellWidth - sWidth) / 2;
              const sourceY = padding + r * (cellHeight + gap) - offsetY - sOffset.y + (cellHeight - sHeight) / 2;
              
              ctx.drawImage(
                img,
                sourceX, sourceY, sWidth, sHeight, // Source
                0, 0, cellWidth, cellHeight // Destination
              );

              newImages.push(bitmapToSquareCarouselDataUrl(canvas));
            }
          }
        }
        setSplitImages(newImages);
      };
      
      img.src = imgSrc;
    } else {
      Promise.all(post.images.map((imgSrc, index) => {
        return new Promise<string>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const sOffset = slideOffsets[index] || { x: 0, y: 0 };
            const out = imageToSquareCarouselDataUrl(img, {
              scale,
              offsetX,
              offsetY,
              slideOffsetX: sOffset.x,
              slideOffsetY: sOffset.y,
            });
            resolve(out || imgSrc);
          };
          img.onerror = () => resolve(imgSrc);
          img.src = imgSrc;
        });
      })).then(images => {
        setSplitImages(images);
      });
    }
  }, [post.images, padding, gap, cols, rows, offsetX, offsetY, scale, slideOffsets, isGrid]);

  const handleDownloadZip = async () => {
    if (splitImages.length === 0) return;
    setZipBusy(true);
    setZipError(null);
    try {
      await downloadCarouselSlidesAsZip(splitImages, post.topic);
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Could not create ZIP.');
    } finally {
      setZipBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h4 className="font-semibold text-stone-900 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-stone-400" />
          Carousel Slides
        </h4>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors min-h-[36px] ${showSettings ? 'bg-stone-200 text-stone-800' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            <Settings2 className="w-4 h-4" /> {isGrid ? 'Adjust Split' : 'Adjust Images'}
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadZip()}
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
            disabled={splitImages.length === 0 || zipBusy}
            title={`ZIP of ${CAROUSEL_SLIDE_PX}×${CAROUSEL_SLIDE_PX} PNGs — Instagram carousel 1:1, full image letterboxed (no crop)`}
          >
            <FileArchive className="w-4 h-4" /> {zipBusy ? 'Building ZIP…' : 'Download ZIP'}
          </button>
        </div>
      </div>

      <p className="text-xs text-stone-500 mb-3 -mt-1">
        Exports match Instagram carousel: {CAROUSEL_SLIDE_PX}×{CAROUSEL_SLIDE_PX} square; your artwork is scaled to fit inside without cropping (letterbox).
      </p>
      
      {showSettings && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 p-5 bg-stone-50 rounded-xl border border-stone-200 space-y-6 overflow-hidden"
        >
          {/* Grid Layout - Only show if it's a grid image */}
          {isGrid && (
            <div>
              <h5 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Grid Layout</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Columns</label>
                  <div className="flex items-center bg-white border border-stone-200 rounded-lg overflow-hidden w-fit">
                    <button onClick={() => setCols(Math.max(1, cols - 1))} className="p-1.5 hover:bg-stone-100 text-stone-600"><Minus className="w-4 h-4" /></button>
                    <span className="w-10 text-center text-sm font-medium">{cols}</span>
                    <button onClick={() => setCols(cols + 1)} className="p-1.5 hover:bg-stone-100 text-stone-600"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Rows</label>
                  <div className="flex items-center bg-white border border-stone-200 rounded-lg overflow-hidden w-fit">
                    <button onClick={() => setRows(Math.max(1, rows - 1))} className="p-1.5 hover:bg-stone-100 text-stone-600"><Minus className="w-4 h-4" /></button>
                    <span className="w-10 text-center text-sm font-medium">{rows}</span>
                    <button onClick={() => setRows(rows + 1)} className="p-1.5 hover:bg-stone-100 text-stone-600"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Alignment / Shift */}
          <div>
            <h5 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Alignment (Shift)</h5>
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center gap-1">
                <button onClick={() => setOffsetY(offsetY - 10)} className="p-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 text-stone-600"><ChevronUp className="w-4 h-4" /></button>
                <div className="flex items-center gap-1">
                  <button onClick={() => setOffsetX(offsetX - 10)} className="p-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 text-stone-600"><ChevronLeft className="w-4 h-4" /></button>
                  <div className="w-12 h-12 bg-stone-200 rounded-full flex items-center justify-center text-xs font-medium text-stone-500">
                    {offsetX},{offsetY}
                  </div>
                  <button onClick={() => setOffsetX(offsetX + 10)} className="p-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 text-stone-600"><ChevronRight className="w-4 h-4" /></button>
                </div>
                <button onClick={() => setOffsetY(offsetY + 10)} className="p-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 text-stone-600"><ChevronDown className="w-4 h-4" /></button>
              </div>
              
              <div className="flex-1 space-y-4">
                 <div>
                    <div className="flex justify-between text-sm mb-1">
                      <label className="font-medium text-stone-700">Shift X</label>
                      <span className="text-stone-500">{offsetX}px</span>
                    </div>
                    <input type="range" min="-500" max="500" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} className="w-full accent-emerald-600" />
                 </div>
                 <div>
                    <div className="flex justify-between text-sm mb-1">
                      <label className="font-medium text-stone-700">Shift Y</label>
                      <span className="text-stone-500">{offsetY}px</span>
                    </div>
                    <input type="range" min="-500" max="500" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} className="w-full accent-emerald-600" />
                 </div>
              </div>
            </div>
          </div>

          {/* Spacing & Scale */}
          <div>
            <h5 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Spacing & Scale</h5>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <label className="font-medium text-stone-700 flex items-center gap-1.5"><ZoomIn className="w-4 h-4 text-stone-400" /> Zoom / Scale</label>
                  <span className="text-stone-500">{scale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max={isGrid ? 2 : 1}
                  step="0.01"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
                {!isGrid && (
                  <p className="text-xs text-stone-500 mt-1">
                    Max 1× for multi-slide export: full image stays visible inside {CAROUSEL_SLIDE_PX}×{CAROUSEL_SLIDE_PX} (Instagram 1:1).
                  </p>
                )}
              </div>
              {isGrid && (
                <>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <label className="font-medium text-stone-700">Outer Padding</label>
                      <span className="text-stone-500">{padding}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="500" 
                      value={padding} 
                      onChange={(e) => setPadding(Number(e.target.value))}
                      className="w-full accent-emerald-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <label className="font-medium text-stone-700">Inner Gap</label>
                      <span className="text-stone-500">{gap}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="200" 
                      value={gap} 
                      onChange={(e) => setGap(Number(e.target.value))}
                      className="w-full accent-emerald-600"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
      
      {splitImages.length === 0 ? (
        <div className="h-48 flex items-center justify-center bg-stone-50 rounded-xl border border-stone-200">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {splitImages.map((src, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden border border-stone-200 shadow-sm aspect-square bg-stone-100 flex items-center justify-center">
              <img src={src} alt={`Slide ${i + 1}`} className="w-full h-full object-contain" />
              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded-md backdrop-blur-md">
                {i + 1}
              </div>
              
              {/* Individual Slide Controls */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/80 p-1.5 rounded-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button onClick={() => updateSlideOffset(i, -10, 0)} className="p-1.5 hover:bg-white/20 rounded-md text-white transition-colors" title="Move Left"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => updateSlideOffset(i, 10, 0)} className="p-1.5 hover:bg-white/20 rounded-md text-white transition-colors" title="Move Right"><ChevronRight className="w-4 h-4" /></button>
                <button onClick={() => updateSlideOffset(i, 0, -10)} className="p-1.5 hover:bg-white/20 rounded-md text-white transition-colors" title="Move Up"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => updateSlideOffset(i, 0, 10)} className="p-1.5 hover:bg-white/20 rounded-md text-white transition-colors" title="Move Down"><ChevronDown className="w-4 h-4" /></button>
                <div className="w-px h-4 bg-white/30 mx-1"></div>
                <button onClick={() => resetSlideOffset(i)} className="p-1.5 hover:bg-white/20 rounded-md text-white transition-colors" title="Reset Alignment"><RotateCcw className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {zipError && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {zipError}
        </p>
      )}
    </div>
  );
}

interface ContentVisualsTabProps {
  readyPosts: ReadyPost[];
  setReadyPosts: React.Dispatch<React.SetStateAction<ReadyPost[]>>;
}

export default function ContentVisualsTab({ readyPosts, setReadyPosts }: ContentVisualsTabProps) {
  const [viewMode, setViewMode] = useState<'mockup' | 'grid'>('mockup');
  const [imageProvider, setImageProvider] = useState<ImageProvider>('google');
  const [creatingDraftId, setCreatingDraftId] = useState<string | null>(null);
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);

  /** Build a fallback CaptionBlocks from a flat caption string (for older posts without blocks) */
  const buildFallbackBlocks = (caption: string): CaptionBlocks => {
    const lines = caption.split('\n\n');
    return {
      hook: lines[0] || caption,
      points: [],
      microInstruction: lines[1] || '',
      cta: lines[lines.length - 1] || '',
    };
  };

  const handleDeletePost = (id: string) => {
    setReadyPosts(prev => prev.filter(p => p.id !== id));
  };

  const handlePostImagesChange = (postId: string, newImages: string[]) => {
    setReadyPosts(prev =>
      prev.map((p) => (p.id === postId ? { ...p, images: newImages } : p))
    );
  };

  const handleCaptionChange = (postId: string, blocks: CaptionBlocks, caption: string) => {
    setReadyPosts(prev =>
      prev.map(p => p.id === postId ? { ...p, captionBlocks: blocks, caption } : p)
    );
  };

  const handleHashtagsChange = (postId: string, hashtags: string[]) => {
    setReadyPosts(prev =>
      prev.map(p => p.id === postId ? { ...p, hashtags } : p)
    );
  };

  const handleCreateInstagramDraft = async (post: ReadyPost) => {
    setCreatingDraftId(post.id);
    setReadyPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, instagramDraftStatus: 'creating', instagramDraftError: undefined }
          : p,
      ),
    );

    try {
      const imageUrls = await uploadImagesForInstagramDraft(post.images);
      if (imageUrls.length === 0) {
        throw new Error('No valid image URLs returned from Cloudinary upload.');
      }

      const result = await sendDraftContainerToInstagram({
        imageUrls,
        caption: post.caption,
      });

      setReadyPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                instagramDraftStatus: 'created',
                instagramDraftCreationId: result.creationId,
                instagramDraftError: undefined,
              }
            : p,
        ),
      );
    } catch (error) {
      setReadyPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                instagramDraftStatus: 'error',
                instagramDraftError: error instanceof Error ? error.message : 'Failed to create draft container.',
              }
            : p,
        ),
      );
    } finally {
      setCreatingDraftId(null);
    }
  };

  /** Upload → create carousel/single container → media_publish (goes live on the account). */
  const handlePublishCarouselLive = async (post: ReadyPost) => {
    setPublishingPostId(post.id);
    setReadyPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              instagramPublishStatus: 'publishing',
              instagramPublishError: undefined,
            }
          : p,
      ),
    );

    try {
      let creationId = post.instagramDraftCreationId;

      if (!creationId || post.instagramDraftStatus !== 'created') {
        const imageUrls = await uploadImagesForInstagramDraft(post.images);
        if (imageUrls.length === 0) {
          throw new Error('No valid image URLs returned from Cloudinary upload.');
        }
        const draft = await sendDraftContainerToInstagram({
          imageUrls,
          caption: post.caption,
        });
        creationId = draft.creationId;
        setReadyPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  instagramDraftCreationId: draft.creationId,
                  instagramDraftStatus: 'created',
                  instagramDraftError: undefined,
                }
              : p,
          ),
        );
      }

      if (!creationId) {
        throw new Error('No container id to publish.');
      }

      const published = await confirmInstagramPublish(creationId);
      const mediaId =
        published.meta && typeof published.meta === 'object' && 'id' in published.meta
          ? String((published.meta as { id?: string }).id ?? '')
          : '';

      setReadyPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                instagramPublishStatus: 'published',
                instagramPublishedMediaId: mediaId || undefined,
                instagramPublishError: undefined,
              }
            : p,
        ),
      );
    } catch (error) {
      setReadyPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                instagramPublishStatus: 'error',
                instagramPublishError:
                  error instanceof Error ? error.message : 'Failed to publish carousel.',
              }
            : p,
        ),
      );
    } finally {
      setPublishingPostId(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">Content Visuals</h2>
        <p className="text-stone-500 mt-1 text-sm sm:text-base">Your ready-to-post Instagram carousels.</p>
      </div>

      {/* Instagram connection banner — hidden */}

      {readyPosts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-stone-200 border-dashed">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <LayoutGrid className="w-8 h-8 text-stone-400" />
          </div>
          <h3 className="text-lg font-medium text-stone-900 mb-2">No ready posts</h3>
          <p className="text-stone-500 max-w-sm mx-auto">
            Go to the Drafts tab to build your first Instagram post.
          </p>
        </div>
      ) : (
        <div className="grid gap-8">
          {readyPosts.map((post, index) => (
            <motion.div 
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-stone-100 flex justify-between items-start gap-3 bg-stone-50/50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold uppercase tracking-wider rounded-md flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready to Post
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-stone-900 leading-snug">{post.title}</h3>
                  </div>
                  <p className="text-stone-500 text-sm">Topic: {post.topic}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-end shrink-0">
                  {/* Instagram draft + publish buttons — hidden */}
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-stone-400 hover:text-red-500 transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Delete post"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {/* Instagram draft/publish status rows — hidden */}

              <div className="p-4 sm:p-6 grid lg:grid-cols-12 gap-6 sm:gap-8">
                {/* Left Column: Phone Mockup or Visual Grid */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex rounded-lg border border-stone-200 p-1 bg-stone-50">
                      <button
                        onClick={() => setViewMode('mockup')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          viewMode === 'mockup'
                            ? 'bg-white text-stone-900 shadow-sm'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                        Phone Preview
                      </button>
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          viewMode === 'grid'
                            ? 'bg-white text-stone-900 shadow-sm'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        <Grid3X3 className="w-4 h-4" />
                        Slides
                      </button>
                    </div>
                  </div>

                  {viewMode === 'mockup' ? (
                    <InstagramMobileMockup
                      post={post}
                      onImagesChange={(newImages) => handlePostImagesChange(post.id, newImages)}
                      imageProvider={post.imageProvider ?? imageProvider}
                      onImageProviderChange={(p) => {
                        setImageProvider(p);
                        setReadyPosts((prev) =>
                          prev.map((q) => (q.id === post.id ? { ...q, imageProvider: p } : q))
                        );
                      }}
                    />
                  ) : (
                    <SplitImagesDisplay post={post} />
                  )}
                </div>

                {/* Right Column: Caption Editor */}
                <div className="lg:col-span-5">
                  <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 h-full overflow-y-auto lg:max-h-[600px] custom-scrollbar">
                    <CaptionEditor
                      postId={post.id}
                      topic={post.topic}
                      slidesText={post.slides.map(s => s.headline ? `${s.headline}: ${s.body || ''}` : s.text)}
                      captionBlocks={
                        post.captionBlocks ?? buildFallbackBlocks(post.caption)
                      }
                      hashtags={post.hashtags}
                      onCaptionChange={(blocks, caption) => handleCaptionChange(post.id, blocks, caption)}
                      onHashtagsChange={(hashtags) => handleHashtagsChange(post.id, hashtags)}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
