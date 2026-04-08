/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, PenTool, Loader2, Video, CalendarDays, Megaphone } from 'lucide-react';
import { get, set } from 'idb-keyval';
import { AppMarketingVideoDraft, Draft, ReadyPost, VideoReelDraft } from './types';
import DraftsTab from './components/DraftsTab';
import ContentVisualsTab from './components/ContentVisualsTab';
import VideoReelsDraftTab from './components/VideoReelsDraftTab';
import ContentCalendarTab from './components/ContentCalendarTab';
import AppMarketingVideoTab from './components/AppMarketingVideoTab';

type Tab = 'drafts' | 'visuals' | 'reels' | 'app-marketing' | 'calendar';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('drafts');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [readyPosts, setReadyPosts] = useState<ReadyPost[]>([]);
  const [reelDrafts, setReelDrafts] = useState<VideoReelDraft[]>([]);
  const [marketingDrafts, setMarketingDrafts] = useState<AppMarketingVideoDraft[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pendingReelPrompt, setPendingReelPrompt] = useState<string | undefined>(undefined);
  const [pendingDraftTopic, setPendingDraftTopic] = useState<string | undefined>(undefined);

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

        const savedMarketingVideos = await get('meditate-app-marketing-videos');
        if (savedMarketingVideos) setMarketingDrafts(savedMarketingVideos);
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

  useEffect(() => {
    if (!isLoaded) return;
    set('meditate-app-marketing-videos', marketingDrafts)
      .catch(e => console.error('Failed to save app marketing videos', e));
  }, [marketingDrafts, isLoaded]);

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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-serif italic font-bold text-sm sm:text-base">
              A
            </div>
            <h1 className="text-base sm:text-xl font-semibold tracking-tight hidden sm:block">Meditate with Abhi</h1>
            <h1 className="text-base font-semibold tracking-tight sm:hidden">MwA</h1>
          </div>
          {/* Tab nav — scrollable on mobile, full labels on desktop */}
          <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none -mr-4 pr-4 sm:mr-0 sm:pr-0">
            <button
              onClick={() => setActiveTab('drafts')}
              className={`px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[44px] ${
                activeTab === 'drafts'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
              }`}
            >
              <PenTool className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Carousel Drafts</span>
              <span className="sm:hidden">Drafts</span>
            </button>
            <button
              onClick={() => setActiveTab('visuals')}
              className={`px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[44px] ${
                activeTab === 'visuals'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
              }`}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Content Visuals</span>
              <span className="sm:hidden">Visuals</span>
            </button>
            <button
              onClick={() => setActiveTab('reels')}
              className={`px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[44px] ${
                activeTab === 'reels'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
              }`}
            >
              <Video className="w-4 h-4 shrink-0" />
              Reels
            </button>
            <button
              onClick={() => setActiveTab('app-marketing')}
              className={`px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[44px] ${
                activeTab === 'app-marketing'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
              }`}
            >
              <Megaphone className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">App Marketing</span>
              <span className="sm:hidden">Marketing</span>
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[44px] ${
                activeTab === 'calendar'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
              }`}
            >
              <CalendarDays className="w-4 h-4 shrink-0" />
              Calendar
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
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
                initialTopic={pendingDraftTopic}
                onInitialTopicConsumed={() => setPendingDraftTopic(undefined)}
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
              <VideoReelsDraftTab
                reelDrafts={reelDrafts}
                setReelDrafts={setReelDrafts}
                initialPrompt={pendingReelPrompt}
                onInitialPromptConsumed={() => setPendingReelPrompt(undefined)}
              />
            </motion.div>
          )}

          {activeTab === 'calendar' && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ContentCalendarTab
                onGenerateVideoScript={(title) => {
                  setPendingReelPrompt(title);
                  setActiveTab('reels');
                }}
                onCreateCarouselDraft={(title) => {
                  setPendingDraftTopic(title);
                  setActiveTab('drafts');
                }}
              />
            </motion.div>
          )}

          {activeTab === 'app-marketing' && (
            <motion.div
              key="app-marketing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AppMarketingVideoTab
                marketingDrafts={marketingDrafts}
                setMarketingDrafts={setMarketingDrafts}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
