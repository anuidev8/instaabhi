/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, PenTool, Loader2, Video } from 'lucide-react';
import { get, set } from 'idb-keyval';
import { Draft, ReadyPost, VideoReelDraft } from './types';
import DraftsTab from './components/DraftsTab';
import ContentVisualsTab from './components/ContentVisualsTab';
import VideoReelsDraftTab from './components/VideoReelsDraftTab';

type Tab = 'drafts' | 'visuals' | 'reels';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('drafts');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [readyPosts, setReadyPosts] = useState<ReadyPost[]>([]);
  const [reelDrafts, setReelDrafts] = useState<VideoReelDraft[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // ── Persist & hydrate from IndexedDB ──────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      try {
        const savedDrafts = await get('meditate-drafts');
        if (savedDrafts) setDrafts(savedDrafts);

        const savedPosts = await get('meditate-ready-posts');
        if (savedPosts) setReadyPosts(savedPosts);

        const savedReels = await get('meditate-reel-drafts');
        if (savedReels) setReelDrafts(savedReels);
      } catch (e) {
        console.error('Failed to load from IndexedDB', e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    set('meditate-drafts', drafts).catch(e => console.error('Failed to save drafts', e));
  }, [drafts, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    set('meditate-ready-posts', readyPosts).catch(e => console.error('Failed to save posts', e));
  }, [readyPosts, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    set('meditate-reel-drafts', reelDrafts).catch(e => console.error('Failed to save reel drafts', e));
  }, [reelDrafts, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-stone-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-serif italic font-bold">
              A
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Meditate with Abhi</h1>
          </div>
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab('drafts')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'drafts'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
              }`}
            >
              <PenTool className="w-4 h-4" />
              Drafts
            </button>
            <button
              onClick={() => setActiveTab('visuals')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'visuals'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Content Visuals
            </button>
            <button
              onClick={() => setActiveTab('reels')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'reels'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
              }`}
            >
              <Video className="w-4 h-4" />
              Video Reels
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'drafts' && (
            <motion.div
              key="drafts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <DraftsTab
                drafts={drafts}
                setDrafts={setDrafts}
                setReadyPosts={setReadyPosts}
                onPostReady={() => setActiveTab('visuals')}
              />
            </motion.div>
          )}

          {activeTab === 'visuals' && (
            <motion.div
              key="visuals"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ContentVisualsTab readyPosts={readyPosts} setReadyPosts={setReadyPosts} />
            </motion.div>
          )}

          {activeTab === 'reels' && (
            <motion.div
              key="reels"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <VideoReelsDraftTab reelDrafts={reelDrafts} setReelDrafts={setReelDrafts} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
