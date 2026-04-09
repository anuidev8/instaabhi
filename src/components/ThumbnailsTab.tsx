import React, { useMemo, useState } from 'react';
import { Flame, Sparkles } from 'lucide-react';
import SchoolOfBreathThumbnailsTab from './thumbnails/SchoolOfBreathThumbnailsTab';
import SchoolOfMantrasThumbnailsTab from './thumbnails/SchoolOfMantrasThumbnailsTab';
import { getThumbnailBrandFromDraft, withThumbnailBrand } from '../services/thumbnailBranding';
import { ThumbnailBrand, ThumbnailDraft } from '../types';

interface ThumbnailsTabProps {
  thumbnailDrafts: ThumbnailDraft[];
  setThumbnailDrafts: React.Dispatch<React.SetStateAction<ThumbnailDraft[]>>;
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
}

function applyDraftUpdater(
  current: ThumbnailDraft[],
  updater: React.SetStateAction<ThumbnailDraft[]>
): ThumbnailDraft[] {
  return typeof updater === 'function'
    ? (updater as (prev: ThumbnailDraft[]) => ThumbnailDraft[])(current)
    : updater;
}

function brandLabel(brand: ThumbnailBrand): string {
  return brand === 'school_of_breath' ? 'The School of Breath' : 'School of Mantras';
}

export default function ThumbnailsTab({
  thumbnailDrafts,
  setThumbnailDrafts,
  initialPrompt,
  onInitialPromptConsumed,
}: ThumbnailsTabProps) {
  const [activeBrand, setActiveBrand] = useState<ThumbnailBrand>('school_of_mantras');

  const mantrasDrafts = useMemo(
    () => thumbnailDrafts.filter((draft) => getThumbnailBrandFromDraft(draft) === 'school_of_mantras'),
    [thumbnailDrafts]
  );

  const breathDrafts = useMemo(
    () => thumbnailDrafts.filter((draft) => getThumbnailBrandFromDraft(draft) === 'school_of_breath'),
    [thumbnailDrafts]
  );

  const setDraftsForBrand = (
    brand: ThumbnailBrand,
    updater: React.SetStateAction<ThumbnailDraft[]>
  ) => {
    setThumbnailDrafts((prev) => {
      const currentBrandDrafts = prev.filter((draft) => getThumbnailBrandFromDraft(draft) === brand);
      const otherDrafts = prev.filter((draft) => getThumbnailBrandFromDraft(draft) !== brand);
      const updated = applyDraftUpdater(currentBrandDrafts, updater).map((draft) =>
        withThumbnailBrand(draft, brand)
      );
      return [...updated, ...otherDrafts];
    });
  };

  const initialPromptForActiveBrand =
    activeBrand === 'school_of_mantras' ? initialPrompt : undefined;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 rounded-2xl p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">Generator</p>
            <p className="text-sm text-stone-600 mt-1">
              Active pipeline: <span className="font-semibold text-stone-900">{brandLabel(activeBrand)}</span>
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-stone-200 p-1 bg-stone-50 w-full sm:w-auto">
            <button
              onClick={() => setActiveBrand('school_of_mantras')}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeBrand === 'school_of_mantras'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              School of Mantras
            </button>
            <button
              onClick={() => setActiveBrand('school_of_breath')}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeBrand === 'school_of_breath'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <Flame className="w-4 h-4" />
              The School of Breath
            </button>
          </div>
        </div>
      </div>

      {activeBrand === 'school_of_mantras' ? (
        <SchoolOfMantrasThumbnailsTab
          thumbnailDrafts={mantrasDrafts}
          setThumbnailDrafts={(updater) => setDraftsForBrand('school_of_mantras', updater)}
          initialPrompt={initialPromptForActiveBrand}
          onInitialPromptConsumed={onInitialPromptConsumed}
        />
      ) : (
        <SchoolOfBreathThumbnailsTab
          thumbnailDrafts={breathDrafts}
          setThumbnailDrafts={(updater) => setDraftsForBrand('school_of_breath', updater)}
          onInitialPromptConsumed={onInitialPromptConsumed}
        />
      )}
    </div>
  );
}
