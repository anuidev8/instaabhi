/**
 * CaptionEditor — Simple Instagram caption + hashtags editor.
 * Shows the assembled caption as editable text + hashtag chips.
 * AI Regenerate rewrites everything keeping brand voice.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Copy, CheckCircle2, X, Loader2, Wand2, Plus, Sparkles,
} from 'lucide-react';
import { CaptionBlocks } from '../types';
import { assembleCaptionFromBlocks, regenerateCaption } from '../services/geminiService';
import { useWakeLock } from '../lib/useWakeLock';

// ─── Props ────────────────────────────────────────────────────────────────────
interface CaptionEditorProps {
  postId: string;
  topic: string;
  slidesText: string[];
  captionBlocks: CaptionBlocks;
  hashtags: string[];
  onCaptionChange: (blocks: CaptionBlocks, caption: string) => void;
  onHashtagsChange: (hashtags: string[]) => void;
}

/** Parse flat caption text back into structured blocks (best-effort). */
function parseCaption(text: string): CaptionBlocks {
  const EMOJI_PATTERN = /^(?:1️⃣|2️⃣|3️⃣|4️⃣|5️⃣|6️⃣|7️⃣|8️⃣|9️⃣|🔟|\d+[.)]\s*)/;
  const parts = text.split(/\n\n+/).filter(Boolean);

  const hook: string[] = [];
  const points: string[] = [];
  const rest: string[] = [];
  let foundPoints = false;

  for (const part of parts) {
    const lines = part.split('\n').map(l => l.trim()).filter(Boolean);
    const hasNumbered = lines.some(l => EMOJI_PATTERN.test(l));

    if (hasNumbered) {
      foundPoints = true;
      for (const line of lines) {
        points.push(line.replace(EMOJI_PATTERN, '').trim());
      }
    } else if (!foundPoints) {
      hook.push(part);
    } else {
      rest.push(part);
    }
  }

  // If no numbered points found, treat first paragraph as hook, rest as CTA
  if (points.length === 0) {
    return {
      hook: parts[0] || '',
      points: [],
      microInstruction: parts.length > 2 ? parts.slice(1, -1).join('\n\n') : '',
      cta: parts[parts.length - 1] || '',
    };
  }

  return {
    hook: hook.join('\n\n'),
    points,
    microInstruction: rest[0] || '',
    cta: rest.slice(1).join('\n\n'),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CaptionEditor({
  postId,
  topic,
  slidesText,
  captionBlocks: initialBlocks,
  hashtags: initialHashtags,
  onCaptionChange,
  onHashtagsChange,
}: CaptionEditorProps) {
  const [blocks, setBlocks] = useState<CaptionBlocks>(initialBlocks);
  const [hashtags, setHashtags] = useState<string[]>(initialHashtags);
  const [captionText, setCaptionText] = useState(() => assembleCaptionFromBlocks(initialBlocks));

  // Copy state
  const [copied, setCopied] = useState<'caption' | 'hashtags' | null>(null);

  // Regen state
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenInstruction, setRegenInstruction] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  useWakeLock(isRegenerating);
  const [regenHistory, setRegenHistory] = useState<{ blocks: CaptionBlocks; hashtags: string[] }[]>([]);

  // Hashtag edit state
  const [editingHashtagIdx, setEditingHashtagIdx] = useState<number | null>(null);
  const [hashtagDraft, setHashtagDraft] = useState('');

  // Sync when initialBlocks change (e.g. switching posts)
  useEffect(() => {
    setBlocks(initialBlocks);
    setCaptionText(assembleCaptionFromBlocks(initialBlocks));
  }, [postId]);

  useEffect(() => {
    setHashtags(initialHashtags);
  }, [postId]);

  // ── Caption text editing ──────────────────────────────────────────────────
  const handleCaptionBlur = useCallback(() => {
    const parsed = parseCaption(captionText);
    setBlocks(parsed);
    onCaptionChange(parsed, captionText);
  }, [captionText, onCaptionChange]);

  // ── Copy handlers ─────────────────────────────────────────────────────────
  const handleCopyCaption = () => {
    navigator.clipboard.writeText(captionText);
    setCopied('caption');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyHashtags = () => {
    navigator.clipboard.writeText(hashtags.map(h => `#${h}`).join(' '));
    setCopied('hashtags');
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Hashtag editing ───────────────────────────────────────────────────────
  const startEditHashtag = (idx: number) => {
    setEditingHashtagIdx(idx);
    setHashtagDraft(hashtags[idx]);
  };

  const saveHashtag = (idx: number) => {
    const val = hashtagDraft.replace(/^#/, '').trim();
    if (!val) {
      deleteHashtag(idx);
      return;
    }
    const next = [...hashtags];
    next[idx] = val;
    setHashtags(next);
    onHashtagsChange(next);
    setEditingHashtagIdx(null);
  };

  const deleteHashtag = (idx: number) => {
    const next = hashtags.filter((_, i) => i !== idx);
    setHashtags(next);
    onHashtagsChange(next);
    setEditingHashtagIdx(null);
  };

  const addHashtag = () => {
    const next = [...hashtags, 'newtag'];
    setHashtags(next);
    onHashtagsChange(next);
    setTimeout(() => {
      setEditingHashtagIdx(next.length - 1);
      setHashtagDraft('newtag');
    }, 50);
  };

  // ── AI Regenerate ─────────────────────────────────────────────────────────
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      setRegenHistory(prev => [{ blocks, hashtags }, ...prev.slice(0, 4)]);

      const result = await regenerateCaption(
        topic,
        slidesText,
        blocks,
        regenInstruction.trim() || undefined
      );

      setBlocks(result.captionBlocks);
      setHashtags(result.hashtags);
      const newText = assembleCaptionFromBlocks(result.captionBlocks);
      setCaptionText(newText);
      onCaptionChange(result.captionBlocks, newText);
      onHashtagsChange(result.hashtags);
      setShowRegenModal(false);
      setRegenInstruction('');
    } catch (err) {
      console.error('Caption regeneration failed:', err);
      alert('Failed to regenerate caption. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleUndoRegen = () => {
    if (regenHistory.length === 0) return;
    const prev = regenHistory[0];
    setBlocks(prev.blocks);
    setHashtags(prev.hashtags);
    const prevText = assembleCaptionFromBlocks(prev.blocks);
    setCaptionText(prevText);
    onCaptionChange(prev.blocks, prevText);
    onHashtagsChange(prev.hashtags);
    setRegenHistory(h => h.slice(1));
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Header bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-stone-900 text-sm flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Caption
        </h4>
        <div className="flex items-center gap-2">
          {regenHistory.length > 0 && (
            <button
              onClick={handleUndoRegen}
              className="text-xs text-stone-400 hover:text-stone-600 underline transition-colors"
            >
              Undo
            </button>
          )}
          <button
            onClick={() => setShowRegenModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            <Wand2 className="w-3.5 h-3.5" />
            AI Regenerate
          </button>
          <button
            onClick={handleCopyCaption}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-medium rounded-lg transition-colors"
          >
            {copied === 'caption'
              ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span className="text-emerald-600">Copied</span></>
              : <><Copy className="w-3.5 h-3.5" /> Copy</>
            }
          </button>
        </div>
      </div>

      {/* ── Caption textarea ─────────────────────────────────────────── */}
      <textarea
        value={captionText}
        onChange={e => setCaptionText(e.target.value)}
        onBlur={handleCaptionBlur}
        rows={8}
        className="w-full px-4 py-3 text-sm text-stone-800 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 resize-y leading-relaxed placeholder:text-stone-400"
        placeholder="Write your Instagram caption here..."
      />

      {/* ── Hashtags ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-stone-900 text-sm">
            Hashtags <span className="text-xs font-normal text-stone-400">({hashtags.length})</span>
          </h4>
          <div className="flex items-center gap-2">
            <button onClick={addHashtag} className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium"><Plus className="w-3 h-3" /> Add</button>
            <button onClick={handleCopyHashtags} className="flex items-center gap-1.5 text-stone-500 hover:text-stone-700 text-xs font-medium transition-colors">
              {copied === 'hashtags'
                ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span className="text-emerald-600">Copied</span></>
                : <><Copy className="w-3.5 h-3.5" /> Copy</>
              }
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {hashtags.map((tag, i) => (
            <div key={i} className="group relative">
              {editingHashtagIdx === i ? (
                <input
                  autoFocus
                  value={hashtagDraft}
                  onChange={e => setHashtagDraft(e.target.value.replace(/^#/, ''))}
                  onBlur={() => saveHashtag(i)}
                  onKeyDown={e => { if (e.key === 'Enter') saveHashtag(i); if (e.key === 'Escape') setEditingHashtagIdx(null); }}
                  className="text-xs px-2 py-1 border border-emerald-400 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400 w-28 bg-white text-stone-800"
                />
              ) : (
                <button
                  onClick={() => startEditHashtag(i)}
                  className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md border border-emerald-100 hover:border-emerald-200 transition-colors flex items-center gap-1"
                >
                  #{tag}
                  <X
                    className="w-2.5 h-2.5 text-emerald-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={e => { e.stopPropagation(); deleteHashtag(i); }}
                  />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── AI Regenerate Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showRegenModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !isRegenerating && setShowRegenModal(false)}
              className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
                <h3 className="font-semibold text-stone-900 flex items-center gap-2 text-sm">
                  <Wand2 className="w-4 h-4 text-amber-500" />
                  AI Regenerate Caption
                </h3>
                <button onClick={() => !isRegenerating && setShowRegenModal(false)} className="p-1.5 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <textarea
                  value={regenInstruction}
                  onChange={e => setRegenInstruction(e.target.value)}
                  rows={3}
                  placeholder="Optional: what to change (e.g. &quot;make it shorter&quot;, &quot;focus on sleep&quot;)"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-sm text-stone-800 placeholder:text-stone-400 resize-none"
                  disabled={isRegenerating}
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => !isRegenerating && setShowRegenModal(false)}
                    className="flex-1 py-2 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors disabled:opacity-50"
                    disabled={isRegenerating}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isRegenerating
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Rewriting...</>
                      : <><Wand2 className="w-4 h-4" /> Regenerate</>
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
