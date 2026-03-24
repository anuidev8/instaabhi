/**
 * ContentCalendarTab.tsx
 * Weekly Instagram content calendar for @meditate_with_abhi | School of Breath
 */

import { useState, useEffect, type ReactNode, type FC } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, RefreshCw, Sparkles,
  Copy, Check, X, Film, LayoutGrid, Image as ImageIcon,
  BookOpen, Users, TrendingUp,
} from 'lucide-react';
import { get, set } from 'idb-keyval';

// ─── Types ────────────────────────────────────────────────────────────────────

type PostFormat = 'Reel' | 'Carousel' | 'Static';
type ContentPillar = 'Teach' | 'Connect' | 'Convert';
type HashtagSet = 'A' | 'B' | 'C';
type StoryType = 'Poll' | 'BTS' | 'YouTube Alert' | 'Q&A Box' | 'Course CTA' | 'Comment Spotlight';

interface CalendarPost {
  id: string;
  dayIndex: number;
  format: PostFormat;
  pillar: ContentPillar;
  title: string;
  hook: string;
  technique: string;
  hashtagSet: HashtagSet;
  caption?: string;
}

interface CalendarStory {
  id: string;
  dayIndex: number;
  type: StoryType;
  idea: string;
}

interface WeekCalendar {
  weekOffset: number;
  posts: CalendarPost[];
  stories: CalendarStory[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── Content Pools ────────────────────────────────────────────────────────────

const MONDAY_REELS: { title: string; hook: string; technique: string }[] = [
  { title: "Someone Asked Me Why They Feel Dizzy After Breathwork", hook: "Someone asked me on my YouTube with 160K subs — 'why do I feel dizzy?'", technique: "Pranayama Safety" },
  { title: "The Most Common Breathwork Mistake (YouTube Q&A)", hook: "Someone asked me: 'Why am I not feeling anything from breathwork?' I get this every week.", technique: "Breath Awareness" },
  { title: "Is Tummo Safe for Beginners? (Answering Your Question)", hook: "Someone on my YouTube asked: 'Is Tummo safe for beginners?' Here's my honest answer.", technique: "Tummo Basics" },
  { title: "You Asked: What's the Best Time to Practise Pranayama?", hook: "My #1 most-asked YouTube question. Answered in 60 seconds.", technique: "Morning Pranayama" },
  { title: "Answering: 'How Long Until I Feel Results From Breathwork?'", hook: "I got this question on my most-viewed video. Honest answer below.", technique: "Breathwork Journey" },
  { title: "Your YouTube Question: Can I Do Pranayama Every Day?", hook: "One of my top comments, with 2K likes, asked this exact question.", technique: "Daily Practice" },
];

const MONDAY_CAROUSELS: { title: string; hook: string; technique: string }[] = [
  { title: "Complete Tummo Guide: 6 Tibetan Secrets", hook: "888K people watched the video. Here's the full technique in one carousel.", technique: "Tummo Breathing" },
  { title: "The Correct Pranayama Sequence (Most People Get This Wrong)", hook: "Most people do these in the wrong order. Here's the science behind the right sequence.", technique: "Pranayama Sequence" },
  { title: "Kumbhaka: The Lost Art of Breath Retention", hook: "This ancient technique extends your life span at the cellular level. Swipe to learn it.", technique: "Kumbhaka" },
  { title: "7 Chakras: What Each Controls & How Breath Activates Them", hook: "Your breath is the only tool that activates all 7 chakras simultaneously.", technique: "Chakra Breathwork" },
  { title: "Nadi Shodhana: The Ultimate Nervous System Reset", hook: "One nostril at a time. The most balancing breath in all of yoga.", technique: "Nadi Shodhana" },
  { title: "The Science of Pranayama: What Happens to Your Brain in 8 Weeks", hook: "Your brain physically changes after 8 weeks of daily pranayama. Here's the research.", technique: "Pranayama Science" },
];

const TUESDAY_REELS: { title: string; hook: string; technique: string }[] = [
  { title: "Calm Your Nervous System in 60 Seconds", hook: "Calm your nervous system in 60 seconds", technique: "Bhramari" },
  { title: "Your Body Detoxes Every Time You Do This", hook: "Your body detoxes every time you do this", technique: "Kapalbhati" },
  { title: "Activate Your Third Eye in 60 Seconds", hook: "Activate your third eye in 60 seconds", technique: "Third Eye Breathwork" },
  { title: "Feel the Fire in 1 Round of Tummo", hook: "Feel the fire in 1 round of Tummo", technique: "Tummo Breathing" },
  { title: "Do This Before Coffee — 3-Minute Wake-Up Breath", hook: "Do this before coffee — 3 minute wake-up breath", technique: "Morning Pranayama" },
  { title: "Do This Before Bed — Fall Asleep in 4 Minutes", hook: "Do this before bed — fall asleep in 4 minutes", technique: "4-7-8 Breathing" },
  { title: "Reset Your Nervous System in 2 Minutes", hook: "Box breathing: 4 counts in, hold, out, hold. 2 minutes. You'll feel it.", technique: "Box Breathing" },
  { title: "The 60-Second Bhastrika Energy Boost", hook: "Skip the coffee. Do 60 seconds of this instead.", technique: "Bhastrika" },
];

const WEDNESDAY_REELS: { title: string; hook: string; technique: string }[] = [
  { title: "Where Wim Hof Got His Method (The 3,000-Year-Old Original)", hook: "Where Wim Hof got his method — the 3,000-year-old original", technique: "Tummo vs Wim Hof" },
  { title: "Wim Hof vs Pranayama: The Real Difference", hook: "Wim Hof is popular. But this is where it actually came from.", technique: "Pranayama History" },
  { title: "The Breathwork Myth That's Holding Everyone Back", hook: "The biggest lie in the breathwork world — and everyone believes it", technique: "Breathwork Myths" },
  { title: "Why 'Just Breathe Deep' Is Wrong Advice", hook: "Breathing deeper is not always better. Here's the truth.", technique: "Diaphragmatic Breathing" },
  { title: "Why Mouth Breathing Is Destroying Your Health", hook: "You've been breathing wrong your entire life. Here's the proof.", technique: "Nasal Breathing" },
  { title: "The Cold Plunge Breath Secret (Not Wim Hof)", hook: "Everyone talks about Wim Hof. No one talks about where he learned it.", technique: "Tummo / Cold Exposure" },
];

const WEDNESDAY_CAROUSELS: { title: string; hook: string; technique: string }[] = [
  { title: "5 Signs Your Pineal Gland Is Blocked", hook: "505K people discovered this on YouTube. Are you showing these 5 signs?", technique: "Third Eye / Pineal" },
  { title: "The Bhramari Effect: Why 99% Feel Calmer in 60 Seconds", hook: "208K views. 99.5% like rate. Here's the neuroscience behind why it works.", technique: "Bhramari" },
  { title: "Perfect Morning Breathwork: 5 Techniques in Order", hook: "407K people use this morning sequence. Here's the exact order and why.", technique: "Morning Routine" },
  { title: "Fall Asleep in 10 Minutes: The Complete Breathwork Sequence", hook: "117K people use this to fall asleep faster. Try it tonight.", technique: "Sleep Breathwork" },
  { title: "What Kapalbhati Does to Your Body in 10 Minutes", hook: "279K views. Your body physically changes in 10 minutes — here's the science.", technique: "Kapalbhati" },
  { title: "Top 5 Pranayama Techniques Loved by My YouTube Community", hook: "My 160K subscribers chose these 5. Here's why they work.", technique: "Community Favorites" },
];

const THURSDAY_REELS: { title: string; hook: string; technique: string }[] = [
  { title: "He Healed His Anxiety With Just Breathwork", hook: "This student had panic attacks every single night. Then he tried this.", technique: "Anxiety Breathwork" },
  { title: "From Insomnia to 8 Hours: Her 21-Day Breathwork Journey", hook: "She hadn't slept through the night in 3 years. Until she started this.", technique: "Sleep Pranayama" },
  { title: "How Breathwork Changed My Student's Morning Forever", hook: "She was drinking 3 coffees a day to function. Now she needs zero.", technique: "Morning Breathwork" },
  { title: "What 21 Days of Pranayama Did to His Blood Pressure", hook: "His doctor couldn't explain the results. But we can.", technique: "Health Benefits" },
  { title: "She Used Breathwork During Labour — Here's What Happened", hook: "She had zero pain medication. Her midwife was stunned.", technique: "Pranayama Applications" },
  { title: "How a 68-Year-Old Transformed His Sleep With Pranayama", hook: "His sleep tracker couldn't believe the numbers. Neither could he.", technique: "Sleep / Nasal Breathing" },
];

const THURSDAY_CAROUSELS: { title: string; hook: string; technique: string }[] = [
  { title: "Vagus Nerve Reset: 10-Min Pranayama Protocol", hook: "111K people used this protocol to reset their nervous system. Here's the guide.", technique: "Vagus Nerve" },
  { title: "Breathwork for Digestion: The Gut-Breath Connection", hook: "Your gut and your breath are more connected than you think. Here's the science.", technique: "Digestive Breathwork" },
  { title: "How Nitric Oxide From Bhramari Heals Your Heart", hook: "This molecule is released every time you hum. Your heart needs it.", technique: "Bhramari / Heart Health" },
  { title: "The Immune System Reset: 5 Pranayama Techniques Proven by Science", hook: "Your immune system responds to breath within minutes. Here's the proof.", technique: "Immune Breathwork" },
  { title: "How Pranayama Changes Your Stress Response at the Cellular Level", hook: "They measured stress markers before and after 8 weeks of pranayama.", technique: "Pranayama Science" },
  { title: "Breathwork for Anxiety: The Complete Clinical Protocol", hook: "Clinical anxiety, measurably reduced in 5 minutes per day. Here's the protocol.", technique: "Anxiety Protocol" },
];

const FRIDAY_REELS: { title: string; hook: string; technique: string }[] = [
  { title: "Your Weekend Gift: Nadi Shodhana Full Tutorial", hook: "A gift for your weekend: the most balancing breath in all of yoga", technique: "Nadi Shodhana" },
  { title: "The 10-Minute Saturday Morning Practice (Do This Tomorrow)", hook: "Do this tomorrow morning. Your whole weekend changes.", technique: "Morning Pranayama" },
  { title: "4-7-8 Breathing: Your Weekend Stress Reset", hook: "4 seconds in. 7 seconds hold. 8 seconds out. Your weekend just got better.", technique: "4-7-8 Breathing" },
  { title: "Box Breathing: The Practice That Changes Everything", hook: "Navy SEALs use this to stay calm under pressure. Try it this weekend.", technique: "Box Breathing" },
  { title: "Gift Yourself 10 Minutes of Pranayama This Saturday", hook: "No plans needed. Just 10 minutes. Here's what to do.", technique: "Weekend Practice" },
  { title: "The Perfect Sunday Breathwork Ritual to Reset Your Week", hook: "The most powerful thing you can do this Sunday. 15 minutes.", technique: "Sunday Ritual" },
];

const SATURDAY_CAROUSELS: { title: string; hook: string; technique: string }[] = [
  { title: "How I Discovered Tummo in a Tibetan Monastery", hook: "I sat in the Himalayas at 4am. What happened next changed everything.", technique: "Tummo / Spiritual Journey" },
  { title: "The Day Breathwork Became My Life's Work", hook: "I was burned out, anxious, and completely lost. Then I found pranayama.", technique: "Personal Journey" },
  { title: "What Ancient Yogis Knew (That Science Just Confirmed)", hook: "3,000 years ago they discovered what neuroscience just proved in 2023.", technique: "Ancient Wisdom + Science" },
  { title: "My Journey to India That Started the School of Breath", hook: "I left everything behind to learn breathwork at its source.", technique: "Origin Story" },
  { title: "The Spiritual Dimension of Breath: What the Ancients Taught", hook: "Prana is not just air. The ancient texts knew something we forgot.", technique: "Prana / Spirituality" },
  { title: "Why I Left My Corporate Career for Breathwork", hook: "I had the job, the salary, the status. And I was miserable.", technique: "Personal Story / Mission" },
];

const SUNDAY_STATIC: { title: string; hook: string; technique: string }[] = [
  { title: "Sunday Morning in the Studio", hook: "This is what Sunday mornings look like at School of Breath 🌅", technique: "Behind the Scenes" },
  { title: "Where I Practice (My Sacred Space)", hook: "Your environment shapes your practice. Here's mine.", technique: "Personal / BTS" },
  { title: "The Book That Changed How I Teach Breathwork", hook: "If you're serious about pranayama, read this.", technique: "Book Recommendation" },
  { title: "A Quiet Sunday With the Community", hook: "Grateful for every single one of you in this community 🙏", technique: "Gratitude / Community" },
  { title: "My Morning Before the Camera Goes On", hook: "What 5am looks like when you build a breathwork brand 🌙", technique: "Creator BTS" },
  { title: "The Altar That Keeps Me Grounded", hook: "Every teacher has a place of practice. This is mine.", technique: "Spiritual Space" },
];

const STORY_IDEAS: Record<StoryType, string[]> = {
  'Poll': [
    "Do you practice breathwork in the morning or evening? 🌅🌙",
    "Have you ever tried Tummo breathing? Yes / Not yet",
    "What's your biggest breathwork challenge? Consistency / Finding time / Not sure where to start",
    "Which do you prefer? Short 5-min session / Full 20-min practice",
    "Do you practice daily? Every day / A few times a week / Occasionally",
    "Have you tried Bhramari (humming breath)? Yes, love it / Not yet",
  ],
  'BTS': [
    "Recording today's YouTube video — sneak peek of the setup 🎥",
    "My practice space before the morning session 🧘",
    "Behind the scenes of creating this week's carousel content for you",
    "What my workspace looks like during content creation week",
    "Prep day for the next YouTube video — here's what goes into it",
    "The morning routine before I teach — this is how I show up 🌄",
  ],
  'YouTube Alert': [
    "NEW VIDEO is live! 'Complete Tummo Guide' — link in bio 🔔",
    "Just posted a new pranayama tutorial on YouTube. Go watch! ▶️",
    "My most-requested video is finally live on YouTube — link in bio!",
    "160K subscribers can't be wrong — new video dropped today 🎉",
    "New YouTube video: watch the full technique I taught today 🫁",
    "If you missed the latest upload on YouTube — it's now live. Link in bio.",
  ],
  'Q&A Box': [
    "Ask me anything about breathwork 👇 I'll answer in tomorrow's story",
    "What breathwork questions do you have? Drop them below 🫁",
    "I'm answering your pranayama questions today — ask away!",
    "What do you want to learn this week? Your questions go here.",
    "Drop your biggest breathwork challenge below. I'm reading all of them.",
    "What technique are you struggling with? I'll answer tomorrow.",
  ],
  'Course CTA': [
    "🔥 The 21-Day Pranayama Challenge is open — link in bio",
    "Join 2,000+ students in the School of Breath app 📱",
    "The 7-Day Breathwork Starter is FREE — tap the link in bio",
    "Ready to go deeper? Our WhatsApp community is waiting for you",
    "New cohort opens this week — School of Breath program — link in bio",
    "If you're ready to commit to a daily practice, this is how 👇 Link in bio",
  ],
  'Comment Spotlight': [
    "This comment from my YouTube made my day 💛 (sharing with permission)",
    "When students share results like this, it's why I do this ❤️",
    "A student DM that gave me chills — sharing with permission",
    "This YouTube comment is what School of Breath is all about 🙏",
    "The kind of feedback that keeps me going 🌱 (shared with permission)",
    "From the community: this is the transformation breathwork creates 💫",
  ],
};

// ─── Hashtag Sets ─────────────────────────────────────────────────────────────

const HASHTAG_SETS: Record<HashtagSet, string> = {
  A: '#schoolofbreath #pranayama #breathwork #tummobreathing #kapalbhati #bhramari #morningroutine #nervoussystemregulation #breathingexercises #meditation #spiritualawakening #thirdeye #pinealgland #yogabreathing #pranayamadaily #holistichealth #anxietyrelief #stressrelief #breathwithAbhi #wellnessroutine',
  B: '#schoolofbreath #pranayama #breathwork #vagusnerve #boxbreathing #kumbhaka #chakras #guidedmeditation #yogapranayama #breathworkhealing #consciousbreathing #sleepbetter #immuneboost #chakrahealing #kundalini #higherself #meditationpractice #mindfulness #diaphragmaticbreathing #breathworkcoach',
  C: '#schoolofbreath #pranayama #breathwork #anulomvilom #bhastrika #nadibreathing #tibetanbreathing #tummo #nitricoxide #yoganidra #breathworkmeditation #morningpranayama #eveningbreathwork #pranayamateacher #breathworkfacilitator #vedic #sanskrit #spiritualwellness #holistic #breathfirst',
};

// ─── Utility Functions ────────────────────────────────────────────────────────

function getMondayOfCurrentWeek(): Date {
  const today = new Date();
  const day = today.getDay();
  const daysToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekDates(weekOffset: number): Date[] {
  const monday = getMondayOfCurrentWeek();
  monday.setDate(monday.getDate() + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekRange(weekOffset: number): string {
  const dates = getWeekDates(weekOffset);
  const start = dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const end = dates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${start} – ${end}`;
}

function pickFromPool<T>(arr: T[], seed: number): T {
  return arr[((seed % arr.length) + arr.length) % arr.length];
}

// ─── Week Content Generator ───────────────────────────────────────────────────

function generateWeekContent(weekOffset: number, refreshSeed: number = 0): WeekCalendar {
  const s = weekOffset * 7 + refreshSeed * 31;
  const hSets: HashtagSet[] = ['A', 'B', 'C'];
  const h = (n: number): HashtagSet => hSets[((s + n) % 3 + 3) % 3];

  const posts: CalendarPost[] = [
    // Monday: Reel (Connect) + Carousel (Teach)
    { id: `${s}-0-r`, dayIndex: 0, format: 'Reel', pillar: 'Connect', ...pickFromPool(MONDAY_REELS, s), hashtagSet: h(0) },
    { id: `${s}-0-c`, dayIndex: 0, format: 'Carousel', pillar: 'Teach', ...pickFromPool(MONDAY_CAROUSELS, s + 1), hashtagSet: h(1) },
    // Tuesday: Reel (Teach)
    { id: `${s}-1-r`, dayIndex: 1, format: 'Reel', pillar: 'Teach', ...pickFromPool(TUESDAY_REELS, s + 2), hashtagSet: h(2) },
    // Wednesday: Reel (Teach) + Carousel (Connect)
    { id: `${s}-2-r`, dayIndex: 2, format: 'Reel', pillar: 'Teach', ...pickFromPool(WEDNESDAY_REELS, s + 3), hashtagSet: h(3) },
    { id: `${s}-2-c`, dayIndex: 2, format: 'Carousel', pillar: 'Connect', ...pickFromPool(WEDNESDAY_CAROUSELS, s + 4), hashtagSet: h(4) },
    // Thursday: Reel (Connect) + Carousel (Teach)
    { id: `${s}-3-r`, dayIndex: 3, format: 'Reel', pillar: 'Connect', ...pickFromPool(THURSDAY_REELS, s + 5), hashtagSet: h(5) },
    { id: `${s}-3-c`, dayIndex: 3, format: 'Carousel', pillar: 'Teach', ...pickFromPool(THURSDAY_CAROUSELS, s + 6), hashtagSet: h(6) },
    // Friday: Reel (Teach)
    { id: `${s}-4-r`, dayIndex: 4, format: 'Reel', pillar: 'Teach', ...pickFromPool(FRIDAY_REELS, s + 7), hashtagSet: h(7) },
    // Saturday: Carousel (Connect)
    { id: `${s}-5-c`, dayIndex: 5, format: 'Carousel', pillar: 'Connect', ...pickFromPool(SATURDAY_CAROUSELS, s + 8), hashtagSet: h(8) },
    // Sunday: Static (Connect)
    { id: `${s}-6-s`, dayIndex: 6, format: 'Static', pillar: 'Connect', ...pickFromPool(SUNDAY_STATIC, s + 9), hashtagSet: h(9) },
  ];

  const storyTypes: StoryType[] = ['Poll', 'BTS', 'YouTube Alert', 'Q&A Box', 'Course CTA', 'Comment Spotlight'];
  const stories: CalendarStory[] = [];
  for (let day = 0; day < 7; day++) {
    const t1 = pickFromPool(storyTypes, s + day * 2);
    const t2 = pickFromPool(storyTypes, s + day * 2 + 3);
    stories.push({ id: `${s}-${day}-s1`, dayIndex: day, type: t1, idea: pickFromPool(STORY_IDEAS[t1], s + day) });
    stories.push({ id: `${s}-${day}-s2`, dayIndex: day, type: t2, idea: pickFromPool(STORY_IDEAS[t2], s + day + 7) });
  }

  return { weekOffset, posts, stories };
}

// ─── Caption Generator ────────────────────────────────────────────────────────

function generateCaption(post: CalendarPost): string {
  const tags = HASHTAG_SETS[post.hashtagSet];

  if (post.format === 'Reel') {
    const teachBody = `↓ Watch the full technique to the end ↓\n\n✅ Save this before you practice\n✅ Tag someone who needs this\n✅ Drop a 🔥 if you felt it\n\nThis is one of the most powerful practices in the School of Breath system.\n\nI've taught ${post.technique} to thousands of students on my YouTube channel (160K+ subscribers) and the results speak for themselves.\n\nWant to go deeper? Follow @meditate_with_abhi and hit the 🔔\n\n📲 School of Breath app — full practices + guided sessions → link in bio\n\n${tags}`;

    const connectBody = `↓ Watch this through ↓\n\nI get this question constantly — from my YouTube community, from DMs, from live sessions.\n\nEvery time, I give the same answer.\n\nBecause the truth about breathwork is simpler than most people think.\n\nIf this helped you, save it. Share it with someone who needs it.\n\nFollow @meditate_with_abhi for daily pranayama education 🙏\n\n📲 School of Breath app — link in bio\n\n${tags}`;

    const convertBody = `↓ Watch this ↓\n\nThis is what transformation looks like.\n\nNot a supplement. Not a hack. Just breath.\n\nIf you're ready to experience this yourself:\n\n🔥 Join the 21-Day Pranayama Challenge — link in bio\n📲 Download the School of Breath app\n💬 Join our WhatsApp breathwork community\n\nFollow @meditate_with_abhi for your daily practice 🫁\n\n${tags}`;

    const body = post.pillar === 'Teach' ? teachBody : post.pillar === 'Connect' ? connectBody : convertBody;
    return `${post.hook}\n\n${body}`;
  }

  if (post.format === 'Carousel') {
    const teachBody = `Swipe through every slide — this is the complete guide →\n\n🔬 Technique: ${post.technique}\n\nMost people only know the surface of this practice.\n\nAfter 15 years of studying with masters in India and Tibet, I've seen what this technique does at the deepest level.\n\nThe science backs it up. The ancient texts explain why.\n\nAll of it is in this carousel.\n\n💾 Save this post — you'll come back to it.\n🔔 Follow @meditate_with_abhi for the full curriculum.\n\n📲 School of Breath app — link in bio\n\n${tags}`;

    const connectBody = `Swipe through → every slide tells the story\n\n🔬 Focus: ${post.technique}\n\nThis comes directly from my YouTube community of 160K+ subscribers.\n\nThe questions you ask. The results you share. The transformations that move me every week.\n\nThis is for you.\n\n💛 Drop a 🙏 if this resonates.\n💾 Save it to revisit anytime.\n\nFollow @meditate_with_abhi | School of Breath 🫁\n\n📲 App + free resources — link in bio\n\n${tags}`;

    const convertBody = `Swipe through every slide →\n\n🔬 Practice: ${post.technique}\n\nThis is what real results look like.\n\nStudents in the School of Breath system experience this every single week.\n\nAnd you can too.\n\n🔥 21-Day Pranayama Challenge — link in bio\n📲 Download the School of Breath app\n💬 Join our WhatsApp breathwork community\n\nFollow @meditate_with_abhi 🙏\n\n${tags}`;

    const body = post.pillar === 'Teach' ? teachBody : post.pillar === 'Connect' ? connectBody : convertBody;
    return `${post.hook}\n\n${body}`;
  }

  // Static photo
  return `${post.hook}\n\nThis is the reality behind the content you see every week.\n\nBehind every technique, every carousel, every reel — there is a daily practice.\n\nA sacred space.\n\nA commitment to showing up, even on the days when it's hard.\n\nThis is mine.\n\nWhat does yours look like? Drop a 🙏 below.\n\nFollow @meditate_with_abhi | School of Breath\n\n📲 Join our community — link in bio\n\n${tags}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const FORMAT_STYLES: Record<PostFormat, { bg: string; text: string; icon: ReactNode; label: string }> = {
  Reel:     { bg: 'bg-violet-100', text: 'text-violet-700', icon: <Film className="w-3 h-3" />, label: 'Reel' },
  Carousel: { bg: 'bg-sky-100',    text: 'text-sky-700',    icon: <LayoutGrid className="w-3 h-3" />, label: 'Carousel' },
  Static:   { bg: 'bg-stone-100',  text: 'text-stone-600',  icon: <ImageIcon className="w-3 h-3" />, label: 'Static' },
};

const PILLAR_STYLES: Record<ContentPillar, { bg: string; text: string; icon: ReactNode }> = {
  Teach:   { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: <BookOpen className="w-3 h-3" /> },
  Connect: { bg: 'bg-emerald-100',text: 'text-emerald-700', icon: <Users className="w-3 h-3" /> },
  Convert: { bg: 'bg-amber-100',  text: 'text-amber-700',  icon: <TrendingUp className="w-3 h-3" /> },
};

const STORY_STYLES: Record<StoryType, { bg: string; text: string }> = {
  'Poll':               { bg: 'bg-pink-100',   text: 'text-pink-700' },
  'BTS':                { bg: 'bg-orange-100', text: 'text-orange-700' },
  'YouTube Alert':      { bg: 'bg-red-100',    text: 'text-red-700' },
  'Q&A Box':            { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  'Course CTA':         { bg: 'bg-amber-100',  text: 'text-amber-700' },
  'Comment Spotlight':  { bg: 'bg-teal-100',   text: 'text-teal-700' },
};

const PostCard: FC<{
  post: CalendarPost;
  onGenerateCaption: (post: CalendarPost) => void;
  onGenerateVideoScript: (title: string) => void;
  onCreateCarouselDraft: (title: string) => void;
}> = ({ post, onGenerateCaption, onGenerateVideoScript, onCreateCarouselDraft }) => {
  const fmt = FORMAT_STYLES[post.format];
  const pillar = PILLAR_STYLES[post.pillar];

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-sm space-y-2">
      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${fmt.bg} ${fmt.text}`}>
          {fmt.icon}{fmt.label}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pillar.bg} ${pillar.text}`}>
          {pillar.icon}{post.pillar}
        </span>
      </div>

      {/* Title */}
      <p className="text-xs font-semibold text-stone-800 leading-snug line-clamp-3">
        {post.title}
      </p>

      {/* Technique */}
      <p className="text-xs text-stone-400 font-medium truncate">
        {post.technique}
      </p>

      {/* Hashtag set */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-400">
          Hashtag Set <span className="font-bold text-stone-600">{post.hashtagSet}</span>
        </span>
        {post.caption && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Caption generated" />
        )}
      </div>

      {/* Format-specific action button */}
      {post.format === 'Reel' ? (
        <button
          onClick={() => onGenerateVideoScript(post.title)}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-stone-50 hover:bg-violet-50 border border-stone-200 hover:border-violet-300 text-xs font-medium text-stone-600 hover:text-violet-700 transition-colors"
        >
          <Film className="w-3 h-3" />
          Generate Video Script
        </button>
      ) : (
        <button
          onClick={() => onCreateCarouselDraft(post.title)}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-stone-50 hover:bg-emerald-50 border border-stone-200 hover:border-emerald-300 text-xs font-medium text-stone-600 hover:text-emerald-700 transition-colors"
        >
          <LayoutGrid className="w-3 h-3" />
          Create Carousel Draft
        </button>
      )}
    </div>
  );
}

const StoryCard: FC<{ story: CalendarStory }> = ({ story }) => {
  const style = STORY_STYLES[story.type];
  return (
    <div className="bg-white border border-stone-100 rounded-lg p-2 space-y-1">
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {story.type}
      </span>
      <p className="text-xs text-stone-500 leading-snug line-clamp-2">{story.idea}</p>
    </div>
  );
}

// ─── Caption Modal ────────────────────────────────────────────────────────────

const CaptionModal: FC<{
  post: CalendarPost;
  caption: string;
  onClose: () => void;
  onSave: (caption: string) => void;
}> = ({ post, caption, onClose, onSave }) => {
  const [text, setText] = useState(caption);
  const [copied, setCopied] = useState(false);
  const fmt = FORMAT_STYLES[post.format];
  const pillar = PILLAR_STYLES[post.pillar];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    onSave(text);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-stone-100">
          <div className="space-y-1.5 flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${fmt.bg} ${fmt.text}`}>
                {fmt.icon}{fmt.label}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pillar.bg} ${pillar.text}`}>
                {pillar.icon}{post.pillar}
              </span>
            </div>
            <p className="text-sm font-semibold text-stone-800 leading-snug">{post.title}</p>
            <p className="text-xs text-stone-400">{post.technique} · Hashtag Set {post.hashtagSet}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Caption editor */}
        <div className="flex-1 overflow-y-auto p-4">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            className="w-full h-full min-h-[280px] text-sm text-stone-700 leading-relaxed bg-stone-50 border border-stone-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            spellCheck
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 flex items-center justify-between gap-3">
          <p className="text-xs text-stone-400">{text.length} chars · Edit freely</p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Caption'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ContentCalendarTab({ onGenerateVideoScript, onCreateCarouselDraft }: { onGenerateVideoScript?: (title: string) => void; onCreateCarouselDraft?: (title: string) => void }) {
  const [calendar, setCalendar] = useState<WeekCalendar | null>(null);
  const [viewingOffset, setViewingOffset] = useState(0);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [captionModal, setCaptionModal] = useState<{ post: CalendarPost; caption: string } | null>(null);

  // Hydrate from IndexedDB
  useEffect(() => {
    get('meditate-calendar').then((saved: WeekCalendar | undefined) => {
      if (saved) {
        setCalendar(saved);
        setViewingOffset(saved.weekOffset);
      } else {
        setCalendar(generateWeekContent(0, 0));
      }
      setIsLoaded(true);
    }).catch(() => {
      setCalendar(generateWeekContent(0, 0));
      setIsLoaded(true);
    });
  }, []);

  // Persist to IndexedDB
  useEffect(() => {
    if (!isLoaded || !calendar) return;
    set('meditate-calendar', calendar).catch(console.error);
  }, [calendar, isLoaded]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    const newSeed = refreshSeed + 1;
    setRefreshSeed(newSeed);
    setTimeout(() => {
      setCalendar(generateWeekContent(viewingOffset, newSeed));
      setIsRefreshing(false);
    }, 300);
  };

  const handleNavigate = (delta: number) => {
    const newOffset = viewingOffset + delta;
    setViewingOffset(newOffset);
    setRefreshSeed(0);
    setCalendar(generateWeekContent(newOffset, 0));
  };

  const handleGenerateCaption = (post: CalendarPost) => {
    const caption = post.caption ?? generateCaption(post);
    setCaptionModal({ post, caption });

    // Auto-save caption to post if it's new
    if (!post.caption && calendar) {
      setCalendar(prev => prev ? {
        ...prev,
        posts: prev.posts.map(p => p.id === post.id ? { ...p, caption } : p),
      } : prev);
    }
  };

  const handleSaveCaption = (updatedCaption: string) => {
    if (!captionModal || !calendar) return;
    setCalendar(prev => prev ? {
      ...prev,
      posts: prev.posts.map(p => p.id === captionModal.post.id ? { ...p, caption: updatedCaption } : p),
    } : prev);
  };

  if (!isLoaded || !calendar) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  const weekDates = getWeekDates(viewingOffset);
  const reelCount = calendar.posts.filter(p => p.format === 'Reel').length;
  const carouselCount = calendar.posts.filter(p => p.format === 'Carousel').length;
  const staticCount = calendar.posts.filter(p => p.format === 'Static').length;
  const storyCount = calendar.stories.length;
  const isCurrentWeek = viewingOffset === 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">Content Calendar</h2>
          <p className="text-sm text-stone-500 mt-0.5">@meditate_with_abhi · School of Breath</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Week
        </button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between bg-white border border-stone-200 rounded-xl px-4 py-3">
        <button
          onClick={() => handleNavigate(-1)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-stone-100 text-stone-600 text-sm font-medium transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-stone-800">{formatWeekRange(viewingOffset)}</p>
          {isCurrentWeek && (
            <span className="text-xs text-emerald-600 font-medium">Current Week</span>
          )}
        </div>
        <button
          onClick={() => handleNavigate(1)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-stone-100 text-stone-600 text-sm font-medium transition-colors"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Reels', count: reelCount, bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
          { label: 'Carousels', count: carouselCount, bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
          { label: 'Stories', count: storyCount, bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
          { label: 'Static', count: staticCount, bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200' },
        ].map(({ label, count, bg, text, border }) => (
          <div key={label} className={`${bg} border ${border} rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold ${text}`}>{count}</p>
            <p className={`text-xs font-medium ${text} opacity-80`}>{label}</p>
          </div>
        ))}
      </div>

      {/* 7-day calendar grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${viewingOffset}-${refreshSeed}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
              {DAY_LABELS.map((day, dayIndex) => {
                const dayPosts = calendar.posts.filter(p => p.dayIndex === dayIndex);
                const dayStories = calendar.stories.filter(s => s.dayIndex === dayIndex);
                const date = weekDates[dayIndex];
                const isToday = new Date().toDateString() === date.toDateString();

                return (
                  <div key={day} className="w-[210px] shrink-0 space-y-2">
                    {/* Day header */}
                    <div className={`rounded-xl px-3 py-2 text-center ${isToday ? 'bg-emerald-600 text-white' : 'bg-white border border-stone-200'}`}>
                      <p className={`text-xs font-bold uppercase tracking-wide ${isToday ? 'text-emerald-100' : 'text-stone-500'}`}>{day.slice(0, 3)}</p>
                      <p className={`text-sm font-semibold ${isToday ? 'text-white' : 'text-stone-800'}`}>{formatDate(date)}</p>
                    </div>

                    {/* Feed posts */}
                    <div className="space-y-2">
                      {dayPosts.map(post => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onGenerateCaption={handleGenerateCaption}
                          onGenerateVideoScript={onGenerateVideoScript ?? (() => {})}
                          onCreateCarouselDraft={onCreateCarouselDraft ?? (() => {})}
                        />
                      ))}
                    </div>

                    {/* Stories section */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider px-1">Stories</p>
                      {dayStories.map(story => (
                        <StoryCard key={story.id} story={story} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Caption modal */}
      <AnimatePresence>
        {captionModal && (
          <CaptionModal
            post={captionModal.post}
            caption={captionModal.caption}
            onClose={() => setCaptionModal(null)}
            onSave={handleSaveCaption}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
