import React, { useState, useEffect, useRef, useCallback } from "react";

interface Subtask {
  id: string;
  name: string;
  completed: boolean;
  createdAt: Date;
}

interface Activity {
  id: string;
  name: string;
  color: string;
  percentage?: number;
  duration: number;
  timeRemaining?: number;
  isCompleted?: boolean;
  isLocked?: boolean;
  category?: string;
  tags?: string[];
  templateId?: string;
  sharedId?: string; // For linking session and daily activities
  // Daily activity specific properties
  status?: 'scheduled' | 'active' | 'completed' | 'overtime';
  isActive?: boolean;
  timeSpent?: number;
  startedAt?: Date | null;
  subtasks?: Subtask[];
  countUp?: boolean;
  // When an activity is completed, preserve its elapsed seconds so segmented/donut can keep its share
  completedElapsedSeconds?: number;
  // New: schedule tracking for rollover logic
  scheduledDate?: string; // YYYY-MM-DD of the day this activity is scheduled for
  rolledOverFromYesterday?: boolean; // show dashed style if rolled over
}

interface ActivityTemplate {
  id: string;
  name: string;
  color: string;
  category?: string;
  tags?: string[];
  // Time window scheduling properties
  isAllDay?: boolean;
  startTime?: string; // Time in HH:MM format (24-hour)
  endTime?: string; // Time in HH:MM format (24-hour)
  presetDuration?: number; // Duration in minutes for auto-created activities
  // Recurring schedule properties
  recurring?: {
    type: 'none' | 'every-day' | 'specific-days-week' | 'specific-days-month' | 'specific-days-year' | 'interval' | 'repeat';
    daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
    daysOfMonth?: number[]; // 1-31
    daysOfYear?: string[]; // MM-DD format
    intervalDays?: number; // For interval type (e.g., every 2 days)
    repeatDays?: number; // For repeat type (e.g., every 3 days)
    isFlexible?: boolean; // Show each day until completed
    alternatesDays?: boolean; // For alternate days option
  };
}

// RPG Stats interfaces
interface RPGTag {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt: Date;
  parentId?: string; // For sub-categories - references parent tag
  isSubCategory?: boolean; // Whether this is a sub-category
  overallProgress?: number; // Permanent progress that persists (0-100)
  totalLifetimeMinutes?: number; // Total time ever spent in this category
}

interface RPGStat {
  tagId: string;
  tagName: string;
  totalMinutes: number;
  sessionMinutes: number;
  dailyMinutes: number;
  weeklyMinutes: number;
  level: number;
  experience: number;
  color: string;
}

interface RPGBalance {
  current: RPGStat[];
  suggested: RPGStat[];
  balanceScore: number;
}

// --- Self-Contained UI Components ---

const Icon = ({ name, className }) => {
  const icons = {
    plus: <path d="M5 12h14m-7-7v14" />,
    plusCircle: <><circle cx="12" cy="12" r="10" /><path d="M12 8v8m-4-4h8" /></>,
    trash2: <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-6 8v-4m4 4v-4" />,
    play: <path d="m5 3 14 9-14 9V3z" />,
    pause: <path d="M6 4h4v16H6zM14 4h4v16h-4z" />,
    rotateCcw: (
      <>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </>
    ),
    settings: (
      <>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    x: <path d="M18 6 6 18M6 6l12 12" />,
    heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
    lock: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
    unlock: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 5-5v0a5 5 0 0 1 5 5v4" />
      </>
    ),
    dice: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <path d="M16 8h.01" />
        <path d="M12 12h.01" />
        <path d="M8 16h.01" />
        <path d="M8 8h.01" />
        <path d="M16 16h.01" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
    arrowUpDown: <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />,
    edit: (
      <>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="m18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </>
    ),
    trash: <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />,
    alertTriangle: (
      <>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="m12 17 .01 0" />
      </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    refresh: (
      <>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M3 21v-5h5" />
      </>
    ),
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {icons[name]}
    </svg>
  );
};

const Button = ({ variant = 'default', size = 'default', className = '', children, ...props }) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 touch-manipulation";
  const sizeClasses = {
    default: "h-9 sm:h-10 px-3 sm:px-4 py-2 text-sm",
    sm: "h-8 sm:h-9 rounded-md px-2 sm:px-3 text-xs sm:text-sm",
    lg: "h-10 sm:h-11 rounded-md px-4 sm:px-6 md:px-8 text-sm sm:text-base",
  };
  const variantClasses = {
    default: "bg-slate-900 text-slate-50 hover:bg-slate-900/90",
    destructive: "bg-red-500 text-slate-50 hover:bg-red-500/90",
    outline: "border border-slate-200 bg-transparent hover:bg-slate-100 hover:text-slate-900",
    ghost: "hover:bg-slate-100 hover:text-slate-900",
  };
  return (
    <button className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Input = ({ className = '', ...props }) => (
  <input className={`flex h-9 sm:h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation ${className}`} {...props} />
);

const Card = ({ className = '', children }) => <div className={`rounded-lg border bg-white text-slate-950 shadow-sm ${className}`}>{children}</div>;
const CardHeader = ({ className = '', children }) => <div className={`flex flex-col space-y-1 sm:space-y-1.5 p-3 sm:p-4 md:p-6 ${className}`}>{children}</div>;
const CardTitle = ({ className = '', children }) => <h3 className={`text-lg sm:text-xl md:text-2xl font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
const CardContent = ({ className = '', children }) => <div className={`p-3 sm:p-4 md:p-6 pt-0 ${className}`}>{children}</div>;

// Mobile Zoom Utilities
const getMobileClasses = (zoomLevel: string) => {
  switch (zoomLevel) {
    case 'compact':
      return {
        container: 'p-1 sm:p-2 md:p-4 space-y-2 sm:space-y-3 md:space-y-6',
        text: {
          xs: 'text-[10px] sm:text-xs',
          sm: 'text-xs sm:text-sm',
          base: 'text-sm sm:text-base',
          lg: 'text-base sm:text-lg',
          xl: 'text-lg sm:text-xl',
          '2xl': 'text-xl sm:text-2xl',
          '3xl': 'text-2xl sm:text-3xl',
          '8xl': 'text-4xl sm:text-6xl md:text-8xl'
        },
        spacing: {
          cardPadding: 'p-2 sm:p-3',
          buttonPadding: 'px-2 py-1 sm:px-3 sm:py-1.5',
          margin: 'm-1 sm:m-2',
          gap: 'gap-1 sm:gap-2'
        },
        button: {
          sm: 'h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm',
          base: 'h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm',
          lg: 'h-9 sm:h-10 px-4 sm:px-6 text-sm sm:text-base'
        }
      };
    case 'large':
      return {
        container: 'p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 md:space-y-8',
        text: {
          xs: 'text-xs sm:text-sm',
          sm: 'text-sm sm:text-base',
          base: 'text-base sm:text-lg',
          lg: 'text-lg sm:text-xl',
          xl: 'text-xl sm:text-2xl',
          '2xl': 'text-2xl sm:text-3xl',
          '3xl': 'text-3xl sm:text-4xl',
          '8xl': 'text-6xl sm:text-8xl md:text-9xl'
        },
        spacing: {
          cardPadding: 'p-4 sm:p-6',
          buttonPadding: 'px-4 py-2 sm:px-6 sm:py-3',
          margin: 'm-2 sm:m-4',
          gap: 'gap-3 sm:gap-4'
        },
        button: {
          sm: 'h-10 sm:h-11 px-4 sm:px-5 text-sm sm:text-base',
          base: 'h-11 sm:h-12 px-5 sm:px-6 text-base sm:text-lg',
          lg: 'h-12 sm:h-14 px-6 sm:px-8 text-lg sm:text-xl'
        }
      };
    default: // normal
      return {
        container: 'p-2 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6',
        text: {
          xs: 'text-xs',
          sm: 'text-sm',
          base: 'text-base',
          lg: 'text-lg',
          xl: 'text-xl',
          '2xl': 'text-2xl',
          '3xl': 'text-3xl',
          '8xl': 'text-6xl sm:text-8xl'
        },
        spacing: {
          cardPadding: 'p-3 sm:p-4 md:p-6',
          buttonPadding: 'px-3 py-1.5 sm:px-4 sm:py-2',
          margin: 'm-2 sm:m-3',
          gap: 'gap-2 sm:gap-3'
        },
        button: {
          sm: 'h-8 sm:h-9 px-3 text-sm',
          base: 'h-9 sm:h-10 px-4 text-sm',
          lg: 'h-10 sm:h-11 px-6 text-base'
        }
      };
  }
};

// RPG Stats Radar Chart Component with Enhanced Today's Tasks Display
const RPGStatsChart = ({ stats, suggestedStats, size = 400, activities = [], dailyActivities = [], rpgTags = [] }: {
  stats: any[];
  suggestedStats: any[];
  size?: number;
  activities?: any[];
  dailyActivities?: any[];
  rpgTags?: RPGTag[];
}) => {
  const [displayMode, setDisplayMode] = useState('overview'); // 'overview', 'today-tasks', 'daily-view', 'progress', 'balance'
  const [showToggles, setShowToggles] = useState(true);
  // New: global toggles (top-right)
  const [showTagLabels, setShowTagLabels] = useState(true);
  const [showYesterdayOverlay, setShowYesterdayOverlay] = useState(false);
  // New: Overview-only time range
  const [timeRange, setTimeRange] = useState<'today' | '3d' | '7d' | 'month' | 'all'>('today');
  
  // Responsive sizing: shrink chart slightly on small screens (e.g., Android phones)
  const [effectiveSize, setEffectiveSize] = useState<number>(size);
  useEffect(() => {
    const updateSize = () => {
      // Leave some horizontal padding (~48px). Clamp to [280, size].
      const w = typeof window !== 'undefined' ? window.innerWidth : size;
      const target = Math.max(280, Math.min(size, Math.min(420, w - 48)));
      setEffectiveSize(target);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [size]);
  
  // Guard: if no stats, show a friendly placeholder instead of rendering the chart
  if (!stats || stats.length === 0) {
    return (
      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
        No tag data yet. Create tags and assign them to activities to see your RPG balance.
      </div>
    );
  }
  
  const center = effectiveSize / 2;
  // Use smaller padding on small screens so content fits comfortably
  const padding = effectiveSize < 360 ? 72 : 100;
  const maxRadius = center - padding;
  
  // Helpers: date ranges
  const getRangeBounds = useCallback((range: 'today' | '3d' | '7d' | 'month' | 'all') => {
    const end = new Date();
    const start = new Date(end);
    // normalize to end of day for inclusive bounds
    const setStartOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
    const setEndOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
    switch (range) {
      case 'today':
        return { start: setStartOfDay(end), end: setEndOfDay(end) };
      case '3d':
        start.setDate(end.getDate() - 2); // last 3 days including today
        return { start: setStartOfDay(start), end: setEndOfDay(end) };
      case '7d':
        start.setDate(end.getDate() - 6);
        return { start: setStartOfDay(start), end: setEndOfDay(end) };
      case 'month':
        start.setDate(1);
        return { start: setStartOfDay(start), end: setEndOfDay(end) };
      default:
        return { start: null as Date | null, end: null as Date | null };
    }
  }, []);
  
  const parseYMD = (ymd?: string): Date | null => {
    if (!ymd) return null;
    const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    return dt;
  };
  
  const inRange = (date: Date | null | undefined, start: Date | null, end: Date | null) => {
    if (!date) return start === null && end === null; // if all-time, accept only when both null handled by caller
    if (start === null || end === null) return true;
    const t = date.getTime();
    return t >= start.getTime() && t <= end.getTime();
  };
  
  // Build range-based totals for Overview display
  const buildOverviewRangeStats = useCallback((range: 'today' | '3d' | '7d' | 'month' | 'all') => {
    const bounds = getRangeBounds(range);
    // Start with zeroed map by tagId to keep axes order
    const totals = new Map<string, number>();
    stats.forEach(s => totals.set(s.tagId, 0));
    
    // Daily activities: use timeSpent and scheduledDate
    (dailyActivities || []).forEach(a => {
      const tags = a.tags || [];
      const dateFromSchedule = parseYMD(a.scheduledDate);
      const dateToUse = dateFromSchedule || (a.startedAt ? new Date(a.startedAt) : null);
      const include = (bounds.start === null && bounds.end === null) || inRange(dateToUse, bounds.start, bounds.end);
      if (!include) return;
      const minutes = Math.max(0, a.timeSpent || 0);
      tags.forEach(tag => {
        if (!totals.has(tag)) return;
        totals.set(tag, (totals.get(tag) || 0) + minutes);
      });
    });
    
    // Session activities: use ACTUAL elapsed (not preset duration) when we can date it (startedAt)
    (activities || []).forEach(a => {
      const tags = a.tags || [];
      const dateToUse = a.startedAt ? new Date(a.startedAt) : null;
      const include = (bounds.start === null && bounds.end === null) || inRange(dateToUse, bounds.start, bounds.end);
      if (!include) return;
      // Compute elapsed minutes consistent with RPGStats
      const durationSec = Math.max(0, (a.duration || 0) * 60);
      const tr = typeof a.timeRemaining === 'number' ? a.timeRemaining : undefined;
      let minutes = 0;
      if (a.countUp) {
        minutes = Math.max(0, Math.floor((a.timeRemaining || 0) / 60));
      } else if (typeof tr === 'number') {
        const elapsedSec = tr >= 0 ? (durationSec - tr) : (durationSec + Math.abs(tr));
        minutes = Math.max(0, Math.floor(elapsedSec / 60));
      }
      tags.forEach(tag => {
        if (!totals.has(tag)) return;
        totals.set(tag, (totals.get(tag) || 0) + minutes);
      });
    });
    
    // Convert to levels mirroring RPGStat calculation
    return stats.map(s => {
      const totalMinutes = totals.get(s.tagId) || 0;
      const level = Math.floor(totalMinutes / 60) + 1;
      const experience = totalMinutes % 60;
      return { ...s, totalMinutes, level, experience };
    });
  }, [activities, dailyActivities, getRangeBounds, stats]);
  
  // Calculate today's task data per tag
  const calculateTodayTaskData = () => {
    const today = new Date();
    const todayStr = today.toDateString();
    
    const tagData = new Map();
    stats.forEach(stat => {
      tagData.set(stat.tagId, {
        tagName: stat.tagName,
        color: stat.color,
        plannedToday: 0,
        completedToday: 0,
        progressToday: 0,
        totalPlanned: 0
      });
    });
    
    // Process daily activities for today's data
    dailyActivities.forEach(activity => {
      if (activity.tags && activity.tags.length > 0) {
        activity.tags.forEach(tagId => {
          const data = tagData.get(tagId);
          if (data) {
            data.totalPlanned += activity.duration;
            data.plannedToday += activity.duration;
            
            if (activity.status === 'completed') {
              data.completedToday += activity.duration;
            }
            
            data.progressToday += activity.timeSpent || 0;
          }
        });
      }
    });
    
    // Process session activities (use actual elapsed)
    activities.forEach(activity => {
      if (activity.tags && activity.tags.length > 0) {
        let activityProgress = 0;
        const durationSec = Math.max(0, (activity.duration || 0) * 60);
        const tr = typeof activity.timeRemaining === 'number' ? activity.timeRemaining : undefined;
        if (activity.countUp) {
          activityProgress = Math.max(0, (activity.timeRemaining || 0) / 60);
        } else if (typeof tr === 'number') {
          const elapsedSec = tr >= 0 ? (durationSec - tr) : (durationSec + Math.abs(tr));
          activityProgress = Math.max(0, elapsedSec / 60);
        }
        activity.tags.forEach(tagId => {
          const data = tagData.get(tagId);
          if (data) {
            data.progressToday += Math.max(0, activityProgress);
          }
        });
      }
    });
    
    return Array.from(tagData.values());
  };
  
  const todayTaskData = calculateTodayTaskData();
  
  // Calculate dynamic scaling based on current stats
  const maxLevel = Math.max(...stats.map(s => s.level), 1);
  const minLevel = Math.min(...stats.map(s => s.level));
  
  // Dynamic ring calculation for better representation
  const calculateOptimalRings = () => {
    if (maxLevel <= 5) return 5;
    if (maxLevel <= 10) return Math.max(5, Math.ceil(maxLevel / 2));
    if (maxLevel <= 20) return Math.max(8, Math.ceil(maxLevel / 3));
    return Math.max(10, Math.ceil(maxLevel / 4));
  };
  
  const rings = calculateOptimalRings();
  
  // Dynamic scaling factor for better visual representation
  const calculateScalingFactor = () => {
    if (maxLevel <= 3) return 2.5;
    if (maxLevel <= 5) return 2.0;
    if (maxLevel <= 10) return 1.5;
    if (maxLevel <= 15) return 1.2;
    return 1.0;
  };
  
  const scalingFactor = calculateScalingFactor();
  const effectiveMaxLevel = Math.max(maxLevel * scalingFactor, rings);
  
  // Calculate angle for each stat
  const angleStep = (2 * Math.PI) / stats.length;
  
  // Generate dynamic ring paths with adaptive scaling
  const ringPaths = Array.from({ length: rings }, (_, i) => {
    const ringLevel = (effectiveMaxLevel / rings) * (i + 1);
    const radius = (maxRadius / rings) * (i + 1);
    const points = stats.map((_, index) => {
      const angle = index * angleStep - Math.PI / 2;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      return `${x},${y}`;
    });
    return { 
      path: `M ${points.join(' L ')} Z`,
      level: Math.round(ringLevel * 10) / 10,
      radius
    };
  });
  
  // Generate paths based on display mode
  const generateDisplayPaths = () => {
    switch (displayMode) {
      case 'today-tasks':
        const maxPlanned = Math.max(...todayTaskData.map(d => d.plannedToday), 1);
        return todayTaskData.map((data, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const normalizedValue = Math.min(data.plannedToday / maxPlanned, 1);
          const radius = maxRadius * normalizedValue;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          return `${x},${y}`;
        });
        
      case 'daily-view':
        // Calculate daily activity completion rates for each tag
        const dailyViewData = stats.map(stat => {
          const dailyMinutes = dailyActivities
            .filter(a => a.tags?.includes(stat.tagId))
            .reduce((sum, a) => sum + (a.timeSpent || 0), 0);
          const plannedDaily = dailyActivities
            .filter(a => a.tags?.includes(stat.tagId))
            .reduce((sum, a) => sum + a.duration, 0);
          return {
            ...stat,
            dailyCompletionRate: plannedDaily > 0 ? dailyMinutes / plannedDaily : 0,
            dailyMinutes,
            plannedDaily
          };
        });
        
        const maxDailyCompletion = Math.max(...dailyViewData.map(d => d.dailyCompletionRate), 1);
        return dailyViewData.map((data, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const normalizedValue = Math.min(data.dailyCompletionRate / maxDailyCompletion, 1);
          const radius = maxRadius * normalizedValue;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          return `${x},${y}`;
        });
        
      case 'progress':
        const maxProgress = Math.max(...todayTaskData.map(d => d.progressToday), 1);
        return todayTaskData.map((data, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const normalizedValue = Math.min(data.progressToday / maxProgress, 1);
          const radius = maxRadius * normalizedValue;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          return `${x},${y}`;
        });
        
      case 'balance':
        return suggestedStats.map((stat, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const scaledLevel = stat.level * scalingFactor;
          const normalizedValue = Math.min(scaledLevel / effectiveMaxLevel, 1);
          const radius = maxRadius * normalizedValue;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          return `${x},${y}`;
        });
        
      default: // overview
        // Recompute view using selected time range
        const rangeStats = buildOverviewRangeStats(timeRange);
        return rangeStats.map((stat, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const scaledLevel = stat.level * scalingFactor;
          const normalizedValue = Math.min(scaledLevel / effectiveMaxLevel, 1);
          const radius = maxRadius * normalizedValue;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          return `${x},${y}`;
        });
    }
  };
  
  const displayPath = generateDisplayPaths();
  
  // Generate suggested stats path
  const suggestedPath = suggestedStats.map((stat, index) => {
    const angle = index * angleStep - Math.PI / 2;
    const scaledLevel = stat.level * scalingFactor;
    const normalizedValue = Math.min(scaledLevel / effectiveMaxLevel, 1);
    const radius = maxRadius * normalizedValue;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    return `${x},${y}`;
  });
  
  const getDisplayColor = () => {
    switch (displayMode) {
      case 'today-tasks': return '#10b981'; // green
      case 'daily-view': return '#0891b2'; // teal
      case 'progress': return '#f59e0b'; // amber  
      case 'balance': return '#8b5cf6'; // purple
      default: return '#3b82f6'; // blue
    }
  };
  
  const getDisplayLabel = () => {
    switch (displayMode) {
      case 'today-tasks': return 'Today\'s Planned Tasks';
      case 'daily-view': return 'Daily Activity View';
      case 'progress': return 'Today\'s Progress';
      case 'balance': return 'Suggested Balance';
      default: return 'Current Stats';
    }
  };
  
  const getTimeRangeLabel = (r: typeof timeRange) => {
    switch (r) {
      case 'today': return 'Today';
      case '3d': return 'Last 3 Days';
      case '7d': return 'Last 7 Days';
      case 'month': return 'This Month';
      default: return 'All Time';
    }
  };

  // Organize tags into parent-child tree structure
  const organizeTagsWithSubCategories = () => {
    const parentTags = rpgTags.filter(tag => !tag.isSubCategory);
    const subCategories = rpgTags.filter(tag => tag.isSubCategory);
    
    return parentTags.map(parent => {
      const children = subCategories.filter(sub => sub.parentId === parent.id);
      return {
        parent,
        children,
        stat: stats.find(s => s.tagId === parent.id)
      };
    });
  };

  const tagTree = organizeTagsWithSubCategories();

  // Generate sub-category branch positions
  const generateSubCategoryBranches = () => {
    interface Branch {
      parent: { x: number; y: number; stat: any; tag: RPGTag };
      child: { x: number; y: number; stat: any; tag: RPGTag };
      angle: number;
    }
    
    const branches: Branch[] = [];
    
    tagTree.forEach((node, index) => {
      if (node.children.length === 0) return;
      
      const parentAngle = index * angleStep - Math.PI / 2;
      const parentStat = node.stat;
      
      if (!parentStat) return;
      
      const parentScaledLevel = parentStat.level * scalingFactor;
      const parentRadius = maxRadius * Math.min(parentScaledLevel / effectiveMaxLevel, 1);
      const parentX = center + Math.cos(parentAngle) * parentRadius;
      const parentY = center + Math.sin(parentAngle) * parentRadius;
      
      // Create sub-category positions branching from parent
      node.children.forEach((child, childIndex) => {
        const childStat = stats.find(s => s.tagId === child.id);
        if (!childStat) return;
        
        // Create branch angle with spacing around parent
        const branchOffset = (childIndex - (node.children.length - 1) / 2) * 0.3; // 0.3 radians spacing
        const childAngle = parentAngle + branchOffset;
        
        // Sub-categories appear at 60-80% of parent radius to create tree effect
        const childScaledLevel = childStat.level * scalingFactor;
        const childBaseRadius = maxRadius * Math.min(childScaledLevel / effectiveMaxLevel, 1);
        const childRadius = Math.min(childBaseRadius, parentRadius * 0.8); // Constrain to parent radius
        
        const childX = center + Math.cos(childAngle) * childRadius;
        const childY = center + Math.sin(childAngle) * childRadius;
        
        branches.push({
          parent: { x: parentX, y: parentY, stat: parentStat, tag: node.parent },
          child: { x: childX, y: childY, stat: childStat, tag: child },
          angle: childAngle
        });
      });
    });
    
    return branches;
  };

  const subCategoryBranches = generateSubCategoryBranches();
  
  // Yesterday overlay path (Overview only)
  const yesterdayPath = (() => {
    if (!showYesterdayOverlay || displayMode !== 'overview') return null;
    // Calculate yesterday bounds and levels
    const yesterdayStart = new Date();
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const b = { start: new Date(yesterdayStart.setHours(0,0,0,0)), end: new Date(new Date().setDate(new Date().getDate() - 1)) };
    (b.end as Date).setHours(23,59,59,999);
    // Temporarily reuse buildOverviewRangeStats by mocking a custom range
    const customRangeStats = (() => {
      // same as buildOverviewRangeStats but with custom bounds
      const totals = new Map<string, number>();
      stats.forEach(s => totals.set(s.tagId, 0));
      (dailyActivities || []).forEach(a => {
        const tags = a.tags || [];
        const dateFromSchedule = parseYMD(a.scheduledDate);
        const dateToUse = dateFromSchedule || (a.startedAt ? new Date(a.startedAt) : null);
        const include = inRange(dateToUse, b.start, b.end);
        if (!include) return;
        const minutes = Math.max(0, a.timeSpent || 0);
        tags.forEach(tag => { if (totals.has(tag)) totals.set(tag, (totals.get(tag) || 0) + minutes); });
      });
      (activities || []).forEach(a => {
        const tags = a.tags || [];
        const dateToUse = a.startedAt ? new Date(a.startedAt) : null;
        const include = inRange(dateToUse, b.start, b.end);
        if (!include) return;
        let minutes = 0;
        const durationSec = Math.max(0, (a.duration || 0) * 60);
        const tr = typeof a.timeRemaining === 'number' ? a.timeRemaining : undefined;
        if (a.countUp) {
          minutes = Math.max(0, Math.floor((a.timeRemaining || 0) / 60));
        } else if (typeof tr === 'number') {
          const elapsedSec = tr >= 0 ? (durationSec - tr) : (durationSec + Math.abs(tr));
          minutes = Math.max(0, Math.floor(elapsedSec / 60));
        }
        tags.forEach(tag => { if (totals.has(tag)) totals.set(tag, (totals.get(tag) || 0) + minutes); });
      });
      return stats.map(s => {
        const totalMinutes = totals.get(s.tagId) || 0;
        const level = Math.floor(totalMinutes / 60) + 1;
        return { ...s, level };
      });
    })();
    const points = customRangeStats.map((stat, index) => {
      const angle = index * angleStep - Math.PI / 2;
      const scaledLevel = stat.level * scalingFactor;
      const normalizedValue = Math.min(scaledLevel / effectiveMaxLevel, 1);
      const radius = maxRadius * normalizedValue;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')} Z`;
  })();

  return (
    <div className="flex flex-col items-center w-full">
      {/* Toggle Controls */}
      <div className="mb-3 w-full flex flex-wrap items-center justify-between gap-2">
        {/* View tabs (left) */}
        <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setDisplayMode('overview')}
          className={`px-3 py-1 text-xs rounded-full transition-all ${
            displayMode === 'overview' 
              ? 'bg-blue-500 text-white shadow-md' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📊 Overview
        </button>
  {/* Other tabs removed to keep only Overview */}
        </div>
        {/* Global toggles (right) */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-700">
            <input type="checkbox" className="accent-slate-600" checked={showTagLabels} onChange={(e) => setShowTagLabels(e.target.checked)} />
            Show Tags
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-700">
            <input type="checkbox" className="accent-slate-600" checked={showYesterdayOverlay} onChange={(e) => setShowYesterdayOverlay(e.target.checked)} />
            Yesterday Overlay
          </label>
        </div>
      </div>

      {/* Overview time-range controls */}
      {displayMode === 'overview' && (
        <div className="mb-2 flex flex-wrap gap-2">
          {(['today','3d','7d','month','all'] as const).map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1 text-xs rounded-md border ${timeRange === r ? 'bg-teal-600 text-white border-teal-700' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'}`}
            >
              {getTimeRangeLabel(r)}
            </button>
          ))}
        </div>
      )}
      
    <div className="mb-2 text-center">
        <div className="text-xs text-slate-500">
    Showing: {getDisplayLabel()} {displayMode === 'overview' ? `• ${getTimeRangeLabel(timeRange)}` : ''} • 
      {rings} Rings • Range: Lv.{minLevel}-{maxLevel}
        </div>
      </div>
      
  <svg width={effectiveSize} height={effectiveSize} className="bg-slate-50 rounded-lg border transition-all duration-500 ease-in-out" viewBox={`0 0 ${effectiveSize} ${effectiveSize}`} preserveAspectRatio="xMidYMid meet">
        {/* Dynamic grid circles with level indicators */}
        {ringPaths.map((ring, i) => (
          <g key={i}>
            <circle
              cx={center}
              cy={center}
              r={ring.radius}
              fill="none"
              stroke={i === rings - 1 ? "#94a3b8" : "#e2e8f0"}
              strokeWidth={i === rings - 1 ? "2" : "1"}
              strokeDasharray={i % 2 === 0 ? "none" : "3,3"}
              opacity={0.6 + (i / rings) * 0.4}
            />
            {/* Ring level labels */}
            <text
              x={center + ring.radius + 8}
              y={center - 2}
              className="text-xs fill-slate-400"
              dominantBaseline="middle"
            >
              {displayMode === 'today-tasks' ? `${Math.round(ring.level)}m` : 
               displayMode === 'progress' ? `${Math.round(ring.level)}m` :
               ring.level}
            </text>
          </g>
        ))}
        
        {/* Grid lines */}
        {stats.map((_, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const x = center + Math.cos(angle) * maxRadius;
          const y = center + Math.sin(angle) * maxRadius;
          return (
            <line
              key={index}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth="1"
              opacity="0.5"
            />
          );
        })}
        
        {/* Yesterday overlay (controlled by toggle) */}
        {yesterdayPath && showYesterdayOverlay && (
          <path d={yesterdayPath} fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="5,4" opacity="0.9" />
        )}
        
        {/* Main display area with dynamic styling */}
        <path
          d={`M ${displayPath.join(' L ')} Z`}
          fill={`${getDisplayColor()}20`}
          stroke={getDisplayColor()}
          strokeWidth="3"
          style={{
            transformOrigin: `${center}px ${center}px`,
            animation: 'pulse 2s ease-in-out infinite alternate'
          }}
        />
        
        {/* Data points for each stat */}
        {stats.map((stat, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const data = todayTaskData[index] || {};
          
          let radius, pointData;
          
          switch (displayMode) {
            case 'today-tasks':
              const maxPlanned = Math.max(...todayTaskData.map(d => d.plannedToday), 1);
              radius = maxRadius * Math.min(data.plannedToday / maxPlanned, 1);
              pointData = `${data.plannedToday}m planned`;
              break;
            case 'daily-view':
              const dailyMinutes = dailyActivities
                .filter(a => a.tags?.includes(stat.tagId))
                .reduce((sum, a) => sum + (a.timeSpent || 0), 0);
              const plannedDaily = dailyActivities
                .filter(a => a.tags?.includes(stat.tagId))
                .reduce((sum, a) => sum + a.duration, 0);
              const completionRate = plannedDaily > 0 ? dailyMinutes / plannedDaily : 0;
              const maxDailyCompletion = 1; // Completion rates are 0-1
              radius = maxRadius * Math.min(completionRate / maxDailyCompletion, 1);
              pointData = `${Math.round(completionRate * 100)}% daily completion`;
              break;
            case 'progress':
              const maxProgress = Math.max(...todayTaskData.map(d => d.progressToday), 1);
              radius = maxRadius * Math.min(data.progressToday / maxProgress, 1);
              pointData = `${Math.round(data.progressToday)}m done`;
              break;
            case 'balance':
              const scaledLevel = suggestedStats[index]?.level * scalingFactor;
              radius = maxRadius * Math.min(scaledLevel / effectiveMaxLevel, 1);
              pointData = `Suggested Lv.${suggestedStats[index]?.level}`;
              break;
            default:
              const currentScaledLevel = stat.level * scalingFactor;
              radius = maxRadius * Math.min(currentScaledLevel / effectiveMaxLevel, 1);
              pointData = `Lv.${stat.level} (${stat.experience}/60)`;
          }
          
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          
          return (
            <g key={stat.tagId}>
              {/* Completion indicator for today-tasks mode */}
              {displayMode === 'today-tasks' && data.completedToday > 0 && (
                <circle
                  cx={x}
                  cy={y}
                  r={8 + (data.completedToday / data.plannedToday) * 8}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  opacity="0.6"
                />
              )}
              
              {/* Main data point */}
              <circle
                cx={x}
                cy={y}
                r={displayMode === 'overview' ? Math.min(6 + stat.level * 0.5, 12) : 8}
                fill={displayMode === 'overview' ? stat.color : getDisplayColor()}
                stroke="white"
                strokeWidth="2"
                style={{
                  transition: 'all 0.3s ease-in-out',
                  filter: (displayMode === 'overview' && stat.level >= 10) ? 'drop-shadow(0px 0px 4px rgba(59, 130, 246, 0.5))' : 'none'
                }}
              />
              
              {/* Special indicators */}
              {displayMode === 'today-tasks' && data.completedToday === data.plannedToday && data.plannedToday > 0 && (
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" className="text-xs font-bold fill-white">✓</text>
              )}
              
              {displayMode === 'overview' && stat.level >= 10 && (
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" className="text-xs font-bold fill-white">
                  {stat.level}
                </text>
              )}
            </g>
          );
        })}
        
  {/* Sub-category branches (tree-like visualization) */}
  {showTagLabels && subCategoryBranches.map((branch, branchIndex) => (
          <g key={`branch-${branchIndex}`}>
            {/* Branch line connecting parent to child */}
            <line
              x1={branch.parent.x}
              y1={branch.parent.y}
              x2={branch.child.x}
              y2={branch.child.y}
              stroke={branch.parent.tag.color}
              strokeWidth="2"
              opacity="0.6"
              strokeDasharray="3,2"
            />
            
            {/* Sub-category data point */}
            <circle
              cx={branch.child.x}
              cy={branch.child.y}
              r="6"
              fill={branch.parent.tag.color}
              stroke="white"
              strokeWidth="2"
              opacity="0.8"
              style={{
                filter: `brightness(0.9)`,
                transition: 'all 0.3s ease-in-out'
              }}
            />
            
            {/* Sub-category level indicator */}
            <text 
              x={branch.child.x} 
              y={branch.child.y + 1} 
              textAnchor="middle" 
              dominantBaseline="middle" 
              className="text-xs font-bold fill-white"
            >
              {branch.child.stat.level}
            </text>
            
            {/* Sub-category mini label */}
            <text
              x={branch.child.x}
              y={branch.child.y - 15}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs font-medium fill-slate-600"
              style={{ fontSize: '10px' }}
            >
              {branch.child.tag.name}
            </text>
          </g>
  ))}
        
  {/* Enhanced labels with mode-specific information */}
  {showTagLabels && stats.map((stat, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const labelRadius = maxRadius + 50;
          const x = center + Math.cos(angle) * labelRadius;
          const y = center + Math.sin(angle) * labelRadius;
          const data = todayTaskData[index] || {};
          
          let labelText = stat.tagName;
          let subText = `Lv.${stat.level} (${stat.experience}/60)`;
          
          if (displayMode === 'today-tasks') {
            subText = `${data.plannedToday}m planned • ${data.completedToday}m done`;
          } else if (displayMode === 'daily-view') {
            const dailyMinutes = dailyActivities
              .filter(a => a.tags?.includes(stat.tagId))
              .reduce((sum, a) => sum + (a.timeSpent || 0), 0);
            const plannedDaily = dailyActivities
              .filter(a => a.tags?.includes(stat.tagId))
              .reduce((sum, a) => sum + a.duration, 0);
            const completionRate = plannedDaily > 0 ? Math.round((dailyMinutes / plannedDaily) * 100) : 0;
            subText = `${dailyMinutes}m / ${plannedDaily}m (${completionRate}%)`;
          } else if (displayMode === 'progress') {
            subText = `${Math.round(data.progressToday)}m progress today`;
          } else if (displayMode === 'balance') {
            subText = `Target: Lv.${suggestedStats[index]?.level}`;
          }
          
          return (
            <g key={`label-${stat.tagId}`}>
              {/* Label background for better readability */}
              <rect
                x={x - 30}
                y={y - 18}
                width="60"
                height="36"
                fill="rgba(255, 255, 255, 0.95)"
                stroke="#e2e8f0"
                strokeWidth="1"
                rx="4"
                opacity="0.95"
              />
              <text
                x={x}
                y={y - 4}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-sm font-medium fill-slate-700"
              >
                {labelText}
              </text>
              <text
                x={x}
                y={y + 10}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xs fill-slate-500"
                style={{ fontWeight: stat.level >= 5 ? 'bold' : 'normal' }}
              >
                {subText}
              </text>
            </g>
          );
        })}
        
        {/* Center indicator showing current mode */}
        <circle
          cx={center}
          cy={center}
          r="4"
          fill={getDisplayColor()}
          style={{
            animation: scalingFactor > 1 ? 'pulse 1.5s ease-in-out infinite' : 'none'
          }}
        />
        <text
          x={center}
          y={center + 22}
          textAnchor="middle"
          className="text-xs fill-slate-400 font-medium"
        >
      {getDisplayLabel()} {displayMode === 'overview' ? `• ${getTimeRangeLabel(timeRange)}` : ''}
        </text>
      </svg>
      
  {/* Legend removed per request */}

      {/* Add CSS animations */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.8; transform: scale(1); }
          100% { opacity: 1; transform: scale(1.02); }
        }
        @keyframes glow-0 { 0% { opacity: 0.05; } 100% { opacity: 0.15; } }
        @keyframes glow-1 { 0% { opacity: 0.08; } 100% { opacity: 0.18; } }
        @keyframes glow-2 { 0% { opacity: 0.06; } 100% { opacity: 0.16; } }
        @keyframes glow-3 { 0% { opacity: 0.07; } 100% { opacity: 0.17; } }
        @keyframes glow-4 { 0% { opacity: 0.09; } 100% { opacity: 0.19; } }
        @keyframes glow-5 { 0% { opacity: 0.05; } 100% { opacity: 0.15; } }
      `}</style>
    </div>
  );
};

// RPG Stats Page Component
const RPGStatsPage = ({ 
  rpgBalance, 
  rpgTags, 
  activities, 
  dailyActivities, 
  onBackToTimer, 
  onAddTag, 
  onUpdateTag, 
  onRemoveTag,
  onAddTagToActivity,
  onRemoveTagFromActivity 
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [isAddingSubCategory, setIsAddingSubCategory] = useState(false);
  const [selectedParentTag, setSelectedParentTag] = useState('');

  const handleAddTag = () => {
    if (newTagName.trim()) {
      if (isAddingSubCategory && selectedParentTag) {
        // Add as sub-category
        const parentTag = rpgTags.find(tag => tag.id === selectedParentTag);
        onAddTag(newTagName, parentTag?.color || newTagColor, newTagDescription, selectedParentTag, true);
      } else {
        // Add as main category
        onAddTag(newTagName, newTagColor, newTagDescription);
      }
      setNewTagName('');
      setNewTagDescription('');
      setIsAddingSubCategory(false);
      setSelectedParentTag('');
    }
  };

  // Get main categories (not sub-categories)
  const mainCategories = rpgTags.filter(tag => !tag.isSubCategory);
  
  // Organize tags with their sub-categories for display
  const organizedTags = mainCategories.map(parent => ({
    parent,
    subCategories: rpgTags.filter(tag => tag.parentId === parent.id)
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🎮 RPG Life Stats</h1>
          <p className="text-gray-600">Track your life balance and level up different areas</p>
        </div>
        <Button onClick={onBackToTimer} variant="outline">
          ← Back to Timer
        </Button>
      </div>

      {/* Balance Score */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {rpgBalance.balanceScore}%
            </div>
            <div className="text-lg text-gray-600 mb-4">Life Balance Score</div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${rpgBalance.balanceScore}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {rpgBalance.balanceScore >= 80 ? "🌟 Excellent balance!" :
               rpgBalance.balanceScore >= 60 ? "✨ Good balance" :
               rpgBalance.balanceScore >= 40 ? "⚡ Room for improvement" :
               "🔥 Focus needed"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'overview' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📊 Overview
        </button>
        <button
          onClick={() => setActiveTab('tags')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'tags' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🏷️ Manage Tags
        </button>
        <button
          onClick={() => setActiveTab('activities')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'activities' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🎯 Tag Activities
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Life Areas Radar</CardTitle>
            </CardHeader>
            <CardContent>
              <RPGStatsChart 
                stats={rpgBalance.current} 
                suggestedStats={rpgBalance.suggested}
                activities={activities}
                dailyActivities={dailyActivities}
                rpgTags={rpgTags}
                size={350}
              />
            </CardContent>
          </Card>

          {/* Today's Task Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {dailyActivities.filter(a => a.status === 'scheduled' || a.status === 'active').length}
                    </div>
                    <div className="text-sm text-blue-700">Planned Today</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {dailyActivities.filter(a => a.status === 'completed').length}
                    </div>
                    <div className="text-sm text-green-700">Completed</div>
                  </div>
                </div>
                
                {/* Progress by tag */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Today's Progress by Area</h4>
                  {rpgBalance.current.map(stat => {
                    const todayMinutes = dailyActivities
                      .filter(a => a.tags?.includes(stat.tagId))
                      .reduce((sum, a) => sum + (a.timeSpent || 0), 0);
                    const plannedMinutes = dailyActivities
                      .filter(a => a.tags?.includes(stat.tagId))
                      .reduce((sum, a) => sum + a.duration, 0);
                    const completionRate = plannedMinutes > 0 ? (todayMinutes / plannedMinutes) * 100 : 0;
                    
                    return (
                      <div key={stat.tagId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stat.color }}
                          ></div>
                          <span className="text-sm font-medium">{stat.tagName}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {Math.round(todayMinutes)}m / {plannedMinutes}m
                          </div>
                          <div className="text-xs text-gray-500">
                            {Math.round(completionRate)}% complete
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Active activity indicator */}
                {dailyActivities.find(a => a.status === 'active') && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-amber-800">
                        Currently active: {dailyActivities.find(a => a.status === 'active')?.name}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'tags' && (
        <div className="space-y-6">
          {/* Add New Tag */}
          <Card>
            <CardHeader>
              <CardTitle>Add New Life Area Tag</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Tag Type Toggle */}
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      checked={!isAddingSubCategory}
                      onChange={() => setIsAddingSubCategory(false)}
                      className="form-radio"
                    />
                    <span>Main Category</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      checked={isAddingSubCategory}
                      onChange={() => setIsAddingSubCategory(true)}
                      className="form-radio"
                    />
                    <span>Sub-category</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Input
                    placeholder="Tag name (e.g., Fitness)"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                  />
                  
                  {/* Parent selection for sub-categories */}
                  {isAddingSubCategory && (
                    <select
                      value={selectedParentTag}
                      onChange={(e) => setSelectedParentTag(e.target.value)}
                      className="h-10 px-3 rounded border border-gray-300"
                    >
                      <option value="">Select Parent Category</option>
                      {mainCategories.map(tag => (
                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                      ))}
                    </select>
                  )}
                  
                  {/* Color picker (disabled for sub-categories) */}
                  <input
                    type="color"
                    value={isAddingSubCategory && selectedParentTag 
                      ? rpgTags.find(t => t.id === selectedParentTag)?.color || newTagColor
                      : newTagColor
                    }
                    onChange={(e) => setNewTagColor(e.target.value)}
                    disabled={isAddingSubCategory}
                    className="h-10 w-full rounded border border-gray-300 cursor-pointer disabled:opacity-50"
                  />
                  
                  <Input
                    placeholder="Description (optional)"
                    value={newTagDescription}
                    onChange={(e) => setNewTagDescription(e.target.value)}
                  />
                  
                  <Button 
                    onClick={handleAddTag} 
                    disabled={!newTagName.trim() || (isAddingSubCategory && !selectedParentTag)}
                  >
                    Add {isAddingSubCategory ? 'Sub-category' : 'Tag'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Existing Tags with Tree Structure */}
          <Card>
            <CardHeader>
              <CardTitle>Life Area Tags & Overall Progress</CardTitle>
              <p className="text-sm text-gray-600">Overall progress tracks lifetime achievement in each area</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {organizedTags.map(({ parent, subCategories }) => (
                  <div key={parent.id} className="p-4 border rounded-lg bg-gray-50">
                    {/* Parent Category */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: parent.color }}
                        ></div>
                        <div>
                          <span className="font-bold text-lg">{parent.name}</span>
                          {parent.description && (
                            <p className="text-sm text-gray-600">{parent.description}</p>
                          )}
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => onRemoveTag(parent.id)}
                      >
                        <Icon name="trash2" className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Overall Progress Bar */}
                    <div className="mb-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Overall Progress</span>
                        <span className="text-sm text-gray-600">
                          {parent.overallProgress || 0}% • {Math.floor((parent.totalLifetimeMinutes || 0) / 60)}h total
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="h-3 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${parent.overallProgress || 0}%`,
                            backgroundColor: parent.color,
                            opacity: 0.8
                          }}
                        />
                      </div>
                    </div>

                    {/* Sub-categories */}
                    {subCategories.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700 border-b pb-1">Sub-categories</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-4">
                          {subCategories.map(subCategory => (
                            <div key={subCategory.id} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                              <div className="flex items-center space-x-2">
                                <div className="flex items-center space-x-1">
                                  <div className="w-2 h-8 border-l-2 border-b-2 border-gray-300 rounded-bl"></div>
                                  <div 
                                    className="w-4 h-4 rounded-full border border-gray-300"
                                    style={{ 
                                      backgroundColor: parent.color,
                                      filter: 'brightness(0.9)'
                                    }}
                                  ></div>
                                </div>
                                <div>
                                  <span className="font-medium text-sm">{subCategory.name}</span>
                                  {subCategory.description && (
                                    <p className="text-xs text-gray-500">{subCategory.description}</p>
                                  )}
                                  <div className="text-xs text-gray-600">
                                    Progress: {subCategory.overallProgress || 0}% • {Math.floor((subCategory.totalLifetimeMinutes || 0) / 60)}h
                                  </div>
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => onRemoveTag(subCategory.id)}
                              >
                                <Icon name="trash2" className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'activities' && (
        <div className="space-y-6">
          {/* Session Activities */}
          <Card>
            <CardHeader>
              <CardTitle>Session Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activities.map(activity => (
                  <ActivityTagManager
                    key={activity.id}
                    activity={activity}
                    rpgTags={rpgTags}
                    onAddTag={(tagId) => onAddTagToActivity(activity.id, tagId, false)}
                    onRemoveTag={(tagId) => onRemoveTagFromActivity(activity.id, tagId, false)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Daily Activities */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dailyActivities.map(activity => (
                  <ActivityTagManager
                    key={activity.id}
                    activity={activity}
                    rpgTags={rpgTags}
                    onAddTag={(tagId) => onAddTagToActivity(activity.id, tagId, true)}
                    onRemoveTag={(tagId) => onRemoveTagFromActivity(activity.id, tagId, true)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// Add Activity Dropdown Component
const AddActivityDropdown = ({ template, onAddToSession, onAddToDaily, onAddToBoth }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex-1 h-8 text-xs sm:text-sm"
      >
        <Icon name="plus" className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
        Add Activity
        <Icon name="arrowUpDown" className="h-3 w-3 ml-1" />
      </Button>
      
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <div className="p-2 space-y-1">
              <button
                onClick={() => {
                  onAddToSession(template);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-md flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Session Only</span>
                <span className="ml-auto text-xs text-gray-500">Timer focus</span>
              </button>
              
              <button
                onClick={() => {
                  onAddToDaily(template);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 rounded-md flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Daily Only</span>
                <span className="ml-auto text-xs text-gray-500">Schedule</span>
              </button>
              
              <button
                onClick={() => {
                  onAddToBoth(template);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 rounded-md flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>Both (Shared)</span>
                <span className="ml-auto text-xs text-gray-500">Sync progress</span>
              </button>
            </div>
            
            <div className="border-t border-gray-100 p-2">
              <div className="text-xs text-gray-500 px-3 py-1">
                💡 Shared activities sync progress between session timer and daily schedule
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
const ActivityTagManager = ({ activity, rpgTags, onAddTag, onRemoveTag }) => {
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  
  const assignedTags = activity.tags || [];
  const availableTags = rpgTags.filter(tag => !assignedTags.includes(tag.id));

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium">{activity.name}</span>
        <div className="text-sm text-gray-500">
          {activity.duration || activity.timeSpent || 0}m
        </div>
      </div>
      
      {/* Assigned Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        {assignedTags.map(tagId => {
          const tag = rpgTags.find(t => t.id === tagId);
          if (!tag) return null;
          
          return (
            <div 
              key={tagId}
              className="flex items-center space-x-1 px-2 py-1 rounded-full text-sm"
              style={{ backgroundColor: tag.color, color: 'white' }}
            >
              <span>{tag.name}</span>
              <button
                onClick={() => onRemoveTag(tagId)}
                className="hover:bg-black hover:bg-opacity-20 rounded-full p-0.5"
              >
                <Icon name="x" className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        
        {assignedTags.length === 0 && (
          <span className="text-sm text-gray-500 italic">No tags assigned</span>
        )}
      </div>

      {/* Add Tag Dropdown */}
      <div className="relative">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowTagDropdown(!showTagDropdown)}
          disabled={availableTags.length === 0}
        >
          + Add Tag
        </Button>
        
        {showTagDropdown && availableTags.length > 0 && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-48">
            {availableTags.map(tag => (
              <button
                key={tag.id}
                onClick={() => {
                  onAddTag(tag.id);
                  setShowTagDropdown(false);
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 hover:bg-gray-50 text-left"
              >
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                ></div>
                <span>{tag.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Separator = ({ className = '' }) => <hr className={`-mx-6 border-slate-200 ${className}`} />;

const Badge = ({ variant = 'default', className = '', children }) => {
  const variantClasses = {
    default: "border-transparent bg-slate-900 text-slate-50",
    secondary: "border-transparent bg-slate-100 text-slate-900",
    destructive: "border-transparent bg-red-500 text-slate-50",
  };
  return <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variantClasses[variant]} ${className}`}>{children}</div>;
};

const VisualProgress = ({ activities, style, className, overallProgress, currentActivityColor, totalSessionMinutes = 0, currentActivityIndex }) => {
  // Calculate total time considering both allocated and added activities
  const totalSessionSeconds = totalSessionMinutes * 60;
  const totalTime = activities.reduce((sum, act) => {
    if (act.percentage > 0) {
      return sum + (act.percentage / 100) * totalSessionSeconds;
    } else if (act.duration > 0) {
      return sum + (act.duration * 60);
    }
    return sum;
  }, 0);

  // Helper: compute actual elapsed seconds per activity (includes overtime and count-up)
  const perActivityElapsed = activities.map(act => {
    let planned = 0;
    if (act.percentage && act.percentage > 0) planned = (act.percentage / 100) * totalSessionSeconds;
    else if (act.duration && act.duration > 0) planned = act.duration * 60;

    if (act.countUp) {
      return Math.max(0, act.timeRemaining || 0);
    }
    const tr = act.timeRemaining;
    if (typeof tr === 'number') {
      // If tr >= 0, elapsed = planned - tr; if tr < 0, elapsed = planned + |tr| (overtime)
      return Math.max(0, planned - tr);
    }
    // No timer yet → zero elapsed
    return 0;
  });
  const totalElapsed = perActivityElapsed.reduce((s, v) => s + v, 0);
  const hasAnyCountUp = activities.some(a => a.countUp);

  // If no planned time exists but there is elapsed time (e.g., count-up), fall back to elapsed-based rendering
  if (totalTime === 0) {
    if (totalElapsed > 0) {
      return (
        <div className={`relative h-4 w-full overflow-hidden rounded-full flex bg-slate-200 ${className}`}>
          {activities.map((activity, idx) => {
            const widthPercentage = totalElapsed > 0 ? (perActivityElapsed[idx] / totalElapsed) * 100 : 0;
            if (!widthPercentage || widthPercentage <= 0) return null;
            return (
              <div
                key={activity.id}
                style={{ width: `${widthPercentage}%`, backgroundColor: activity.color }}
                className="h-full"
              />
            );
          })}
        </div>
      );
    }
    return <div className={`relative h-4 w-full overflow-hidden rounded-full bg-slate-100 ${className}`} />;
  }

  if (style === 'segmented') {
    // Build planned seconds per activity based on percentage or fixed duration
    // Planned seconds per activity (completed count-up keeps its preserved elapsed for width)
    const plannedSeconds = activities.map(act => {
      if (act.isCompleted) {
        return Math.max(0, act.completedElapsedSeconds || 0);
      }
      // If this activity was added mid-session with 0%, it shouldn't occupy planned width yet.
      if (act.percentage && act.percentage > 0) return (act.percentage / 100) * totalSessionSeconds;
      if (act.duration && act.duration > 0) return act.duration * 60;
      return 0;
    });
    const totalPlannedRaw = plannedSeconds.reduce((s, v) => s + v, 0);
    const useElapsedFallback = totalPlannedRaw <= 0 || (hasAnyCountUp && totalElapsed > 0);

    // Fallback: if there's no meaningful planned time (or count-up active with elapsed), show elapsed-based distribution
    if (useElapsedFallback) {
      if (totalElapsed <= 0) {
        return <div className={`relative h-4 w-full overflow-hidden rounded-full bg-slate-100 ${className}`} />;
      }
      return (
        <div className={`relative h-4 w-full overflow-hidden rounded-full flex bg-slate-200 ${className}`}>
          {activities.map((activity, idx) => {
            const widthPercentage = (perActivityElapsed[idx] / totalElapsed) * 100;
            if (!widthPercentage || widthPercentage <= 0) return null;
            return (
              <div
                key={activity.id}
                style={{ width: `${widthPercentage}%`, backgroundColor: activity.color }}
                className="h-full"
              />
            );
          })}
        </div>
      );
    }

    const totalPlanned = totalPlannedRaw || 1; // avoid div by 0
    const baseWidths = plannedSeconds.map(sec => (sec / totalPlanned) * 100);

    // Find the activity that is actually in overtime (most negative timeRemaining)
    const overtimeIndex = (() => {
      let idx = -1;
      let mostNeg = 0;
      activities.forEach((a, i) => {
        const tr = typeof a.timeRemaining === 'number' ? a.timeRemaining : 0;
        if (tr < mostNeg) {
          mostNeg = tr;
          idx = i;
        }
      });
      return idx;
    })();

    let redistributedWidths = [...baseWidths];
    if (overtimeIndex !== -1) {
      const overtimeSec = Math.abs(activities[overtimeIndex].timeRemaining || 0);
      // Extra width as percentage of total planned time
      let extraPercent = (overtimeSec / totalPlanned) * 100;

      // Subtract this equally from all other non-zero segments without going negative
      let indices = redistributedWidths
        .map((_, i) => i)
        .filter(i => i !== overtimeIndex && redistributedWidths[i] > 0 && !activities[i].isCompleted);

      let remainingToSubtract = extraPercent;
      let actuallySubtracted = 0;
      while (remainingToSubtract > 1e-6 && indices.length > 0) {
        const per = remainingToSubtract / indices.length;
        let roundSub = 0;
        const nextIndices: number[] = [];
        for (const i of indices) {
          const remove = Math.min(per, redistributedWidths[i]);
          redistributedWidths[i] -= remove;
          roundSub += remove;
          if (redistributedWidths[i] > 1e-6) nextIndices.push(i);
        }
        actuallySubtracted += roundSub;
        remainingToSubtract -= roundSub;
        indices = nextIndices;
        if (roundSub <= 1e-6) break; // nothing left to take
      }
      // Give only what we could subtract to the overtime segment; cap to 100
      redistributedWidths[overtimeIndex] = Math.min(100, redistributedWidths[overtimeIndex] + actuallySubtracted);
      // Normalize small floating errors to keep total ~100
      const totalWidth = redistributedWidths.reduce((s, v) => s + v, 0);
      if (Math.abs(totalWidth - 100) > 0.01) {
        // Scale all to sum 100, keeping proportions (minor correction only)
        const scale = 100 / totalWidth;
        redistributedWidths = redistributedWidths.map(w => w * scale);
      }
    }

    return (
      <div className={`relative h-4 w-full overflow-hidden rounded-full flex bg-slate-100 ${className}`}>
        {activities.map((activity, idx) => {
          const segmentWidth = redistributedWidths[idx];
          if (!segmentWidth || segmentWidth <= 0) return null;

          // Compute fill within segment based on its own planned time
          let activityTime = plannedSeconds[idx];
          let fillWidth = 0;
          const inOvertime = overtimeIndex !== -1;
          const isOvertimeSegment = idx === overtimeIndex;
          if (activity.isCompleted) {
            // For completed count-up, show as fully filled within its preserved width; for countdown, also full
            fillWidth = 100;
          } else if (inOvertime && !isOvertimeSegment) {
            // During overtime, non-selected segments should remain empty (no colorful fill)
            fillWidth = 0;
          } else if (activityTime > 0) {
            // Allow overtime to fully fill the segment (>=100%) visually by capping at 100
            const tr = activity.timeRemaining;
            let elapsed = 0;
            if (typeof tr === 'number') {
              elapsed = tr >= 0 ? (activityTime - tr) : (activityTime + Math.abs(tr));
            } else {
              // Not started yet
              elapsed = 0;
            }
            fillWidth = Math.min(100, Math.max(0, (elapsed / activityTime) * 100));
          }

          return (
            <div key={activity.id} style={{ width: `${segmentWidth}%` }} className="h-full relative last:border-r-0">
              <div 
                className="h-full"
                style={{ opacity: inOvertime && !isOvertimeSegment ? 0.25 : 0.35, backgroundColor: activity.color }}
              />
              <div 
                style={{ 
                  width: `${Math.max(0, fillWidth)}%`, 
                  backgroundColor: activity.color 
                }} 
                className="h-full absolute top-0 left-0" 
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (style === 'dynamicColor') {
    // Compute actual elapsed seconds per activity, including overtime and count-up
    const perActivityElapsed = activities.map(act => {
      let planned = 0;
      if (act.percentage && act.percentage > 0) planned = (act.percentage / 100) * totalSessionSeconds;
      else if (act.duration && act.duration > 0) planned = act.duration * 60;

      if (act.countUp) {
        return Math.max(0, act.timeRemaining || 0);
      }
      const tr = act.timeRemaining;
      if (typeof tr === 'number') {
        // If tr >= 0, elapsed = planned - tr; if tr < 0, elapsed = planned + |tr| (overtime)
        return Math.max(0, planned - tr);
      }
      // No timer yet → zero elapsed
      return 0;
    });
    const totalElapsed = perActivityElapsed.reduce((s, v) => s + v, 0);
    // Fallback to previous behavior if nothing has elapsed yet
    if (totalElapsed <= 0) {
      return (
        <div className={`relative h-4 w-full overflow-hidden rounded-full flex bg-slate-200 ${className}`}></div>
      );
    }

    return (
      <div className={`relative h-4 w-full overflow-hidden rounded-full flex bg-slate-200 ${className}`}>
        {activities.map((activity, idx) => {
          const widthPercentage = (perActivityElapsed[idx] / totalElapsed) * 100;
          if (!widthPercentage || widthPercentage <= 0) return null;
          return (
            <div
              key={activity.id}
              style={{ width: `${widthPercentage}%`, backgroundColor: activity.color }}
              className="h-full"
            />
          );
        })}
      </div>
    );
  }

  // Default style
  return (
    <div className={`relative h-4 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <div className="h-full transition-all" style={{ width: `${overallProgress}%`, backgroundColor: '#0f172a' }} />
      <div className="h-full transition-all" style={{ width: `${overallProgress}%`, backgroundColor: '#0f172a' }} />
    </div>
  );
};

const CircularProgress = ({ activities, style, totalProgress, activityProgress, activityColor, totalSessionMinutes = 0, currentActivityIndex }) => {
  const size = 200;
  const strokeWidth = 12;
  const center = size / 2;
  const radius = center - strokeWidth;
  const activityRadius = radius - strokeWidth - 4;
  const circumference = 2 * Math.PI * radius;
  const activityCircumference = 2 * Math.PI * activityRadius;
  const lastShownRef = useRef<Record<string, number>>({});
  
  // Calculate total time considering both allocated and added activities
  const totalSessionSeconds = totalSessionMinutes * 60;
  const totalTime = activities.reduce((sum, act) => {
    if (act.percentage > 0) {
      return sum + (act.percentage / 100) * totalSessionSeconds;
    } else if (act.duration > 0) {
      return sum + (act.duration * 60);
    }
    return sum;
  }, 0);

  const activityOffset = activityCircumference - (activityProgress / 100) * activityCircumference;

  // --- Divider lines for segmented style ---
  const renderSegmentDividers = () => {
    // Remove divider lines for cleaner visual appearance
    return null;
  };

  const renderOuterRing = () => {
    // If no planned time, but elapsed exists (e.g., count-up), render elapsed-based ring instead of nothing
    const perElapsedForFallback = activities.map(act => {
      let planned = 0;
      if (act.percentage && act.percentage > 0) planned = (act.percentage / 100) * totalSessionSeconds;
      else if (act.duration && act.duration > 0) planned = act.duration * 60;

      if (act.countUp) {
        return Math.max(0, act.timeRemaining || 0);
      }
      const tr = act.timeRemaining;
      if (typeof tr === 'number') {
        return tr >= 0 ? Math.max(0, planned - tr) : planned + Math.abs(tr);
      }
      return 0;
    });
    const totalElapsedForFallback = perElapsedForFallback.reduce((s, v) => s + v, 0);
    if (totalTime === 0) {
      if (totalElapsedForFallback <= 0) return null;
      let cumulativeRotation = -90;
      return activities.map((activity, idx) => {
        const share = perElapsedForFallback[idx] / totalElapsedForFallback;
        if (!share || share <= 0) return null;
        const angle = share * 360;
        const arcLength = (angle / 360) * circumference;
        const rotation = cumulativeRotation;
        cumulativeRotation += angle;
        return (
          <circle
            key={`progress-fallback-${activity.id}`}
            stroke={activity.color}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            r={radius}
            cx={center}
            cy={center}
            transform={`rotate(${rotation} ${center} ${center})`}
            strokeLinecap="butt"
          />
        );
      });
    }

    if (style === 'dynamicColor') {
      // Compute elapsed seconds per activity (includes overtime and count-up)
      const perElapsed = activities.map(act => {
        let planned = 0;
        if (act.percentage && act.percentage > 0) planned = (act.percentage / 100) * totalSessionSeconds;
        else if (act.duration && act.duration > 0) planned = act.duration * 60;

        if (act.countUp) {
          return Math.max(0, act.timeRemaining || 0);
        }
        const tr = act.timeRemaining;
        if (typeof tr === 'number') {
          return tr >= 0 ? Math.max(0, planned - tr) : planned + Math.abs(tr);
        }
        return 0;
      });
      const totalElapsed = perElapsed.reduce((s, v) => s + v, 0);
      if (totalElapsed <= 0) return null;

      let cumulativeRotation = -90;
      return activities.map((activity, idx) => {
        const share = perElapsed[idx] / totalElapsed;
        if (!share || share <= 0) return null;
        const angle = share * 360;
        const arcLength = (angle / 360) * circumference;
        const rotation = cumulativeRotation;
        cumulativeRotation += angle;
        return (
          <circle
            key={`progress-${activity.id}`}
            stroke={activity.color}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            r={radius}
            cx={center}
            cy={center}
            transform={`rotate(${rotation} ${center} ${center})`}
            strokeLinecap="butt"
          />
        );
      });
    }

    if (style === 'segmented') {
      // Planned seconds per activity
      const plannedSeconds = activities.map(a => {
        if (a.isCompleted) {
          return Math.max(0, a.completedElapsedSeconds || 0);
        }
        if (a.percentage && a.percentage > 0) return (a.percentage / 100) * totalSessionSeconds;
        if (a.duration && a.duration > 0) return a.duration * 60;
        return 0;
      });
      const totalPlannedRaw = plannedSeconds.reduce((s, v) => s + v, 0);

      // If we lack planned time but do have elapsed (or count-ups are present), use the dynamic/elapsed distribution
      const hasAnyCountUp = activities.some(a => a.countUp);
      if (totalPlannedRaw <= 0 || (hasAnyCountUp && totalElapsedForFallback > 0)) {
        if (totalElapsedForFallback <= 0) return null;
        let cumulativeRotation = -90;
        return activities.map((activity, idx) => {
          const share = perElapsedForFallback[idx] / totalElapsedForFallback;
          if (!share || share <= 0) return null;
          const angle = share * 360;
          const arcLength = (angle / 360) * circumference;
          const rotation = cumulativeRotation;
          cumulativeRotation += angle;
          return (
            <circle
              key={`progress-elapsed-${activity.id}`}
              stroke={activity.color}
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference}`}
              r={radius}
              cx={center}
              cy={center}
              transform={`rotate(${rotation} ${center} ${center})`}
              strokeLinecap="butt"
            />
          );
        });
      }

      const totalPlanned = totalPlannedRaw || 1;
      // Base angles by plan
      let angles = plannedSeconds.map(sec => (sec / totalPlanned) * 360);

      // Overtime: find the activity truly in overtime (most negative timeRemaining)
      const overtimeIndex = (() => {
        let idx = -1;
        let mostNeg = 0;
        activities.forEach((a, i) => {
          const tr = typeof a.timeRemaining === 'number' ? a.timeRemaining : 0;
          if (tr < mostNeg) {
            mostNeg = tr;
            idx = i;
          }
        });
        return idx;
      })();
      if (overtimeIndex !== -1) {
        const overtimeSec = Math.abs(activities[overtimeIndex].timeRemaining || 0);
        let extraAngle = (overtimeSec / totalPlanned) * 360;
        // Subtract evenly from others without going below 0
  let idxs = angles.map((_, i) => i).filter(i => i !== overtimeIndex && angles[i] > 0 && !activities[i].isCompleted);
        let remaining = extraAngle;
        let taken = 0;
        while (remaining > 1e-6 && idxs.length > 0) {
          const per = remaining / idxs.length;
          let round = 0;
          const next: number[] = [];
          for (const i of idxs) {
            const remove = Math.min(per, angles[i]);
            angles[i] -= remove;
            round += remove;
            if (angles[i] > 1e-6) next.push(i);
          }
          taken += round;
          remaining -= round;
          idxs = next;
          if (round <= 1e-6) break;
        }
        angles[overtimeIndex] = Math.min(360, angles[overtimeIndex] + taken);
        // Normalize to sum ~360
        const sumAngles = angles.reduce((s, v) => s + v, 0);
        if (Math.abs(sumAngles - 360) > 0.01) {
          const scale = 360 / sumAngles;
          angles = angles.map(a => a * scale);
        }
      }

      let cumulativeRotation = -90;
      return activities.map((activity, idx) => {
        const segmentAngle = angles[idx];
        if (!segmentAngle || segmentAngle <= 0) return null;
        const segmentArcLength = (segmentAngle / 360) * circumference;

        // Fill overlay rules with persistence:
        // - During overtime: only the SELECTED segment continues updating; others keep their last shown progress (do not backfill).
        // - When not in overtime: all segments show and update their own progress.
        const planned = plannedSeconds[idx];
  let fillAngle = 0;
        const inOvertime = overtimeIndex !== -1;
        const isSelected = idx === currentActivityIndex;
  if (planned > 0) {
          const tr = activity.timeRemaining;
          let elapsed = 0;
          if (typeof tr === 'number') {
            elapsed = tr >= 0 ? (planned - tr) : (planned + Math.abs(tr));
          }
          const progressWithin = Math.min(1, Math.max(0, elapsed / planned));

          let shown = progressWithin;
          if (inOvertime) {
            if (isSelected) {
              // Update selected segment's shown progress
              lastShownRef.current[activity.id] = progressWithin;
            } else {
              // Hold the last shown value for non-selected
              const held = lastShownRef.current[activity.id];
              // If we haven't stored anything yet (just entered overtime), initialize with current
              if (typeof held !== 'number') {
                lastShownRef.current[activity.id] = progressWithin;
                shown = progressWithin;
              } else {
                shown = held;
              }
            }
          } else {
            // Not in overtime -> keep last shown synced with actual progress
            lastShownRef.current[activity.id] = progressWithin;
          }
          fillAngle = segmentAngle * shown;
        }
        const fillArcLength = (fillAngle / 360) * circumference;

        const rotation = cumulativeRotation;
        cumulativeRotation += segmentAngle;

        return (
          <g key={`segment-${activity.id}`} transform={`rotate(${rotation} ${center} ${center})`}>
            <circle
              stroke={activity.color}
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentArcLength} ${circumference}`}
              r={radius}
              cx={center}
              cy={center}
              strokeLinecap="butt"
              opacity={0.3}
            />
            {fillArcLength > 0 && (
              <circle
                stroke={activity.color}
                fill="transparent"
                strokeWidth={strokeWidth}
                strokeDasharray={`${fillArcLength} ${circumference}`}
                r={radius}
                cx={center}
                cy={center}
                strokeLinecap="butt"
                opacity={0.95}
                style={{ transition: 'opacity 200ms linear' }}
              />
            )}
          </g>
        );
      });
    }

    // Default style
    return (
      <circle
        stroke="#0f172a"
        fill="transparent"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={circumference - (totalProgress / 100) * circumference}
        strokeLinecap="round"
        r={radius}
        cx={center}
        cy={center}
        transform={`rotate(-90 ${center} ${center})`}
      />
    );
  };

  return (
    <div className="flex items-center justify-center py-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circles */}
        <circle
          stroke="#e2e8f0"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={center}
          cy={center}
        />
        <circle
          stroke="#e2e8f0"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={activityRadius}
          cx={center}
          cy={center}
        />

        {/* Segment divider lines for segmented style */}
        {renderSegmentDividers()}

        {/* Outer Progress Ring(s) */}
        {renderOuterRing()}

        {/* Inner Activity Ring */}
        <circle
          stroke={activityColor}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={activityCircumference}
          strokeDashoffset={activityOffset}
          strokeLinecap="round"
          r={activityRadius}
          cx={center}
          cy={center}
          transform={`rotate(-90 ${center} ${center})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dy=".3em" className="text-3xl font-bold fill-current text-slate-700">
          {Math.round(totalProgress)}%
        </text>
      </svg>
    </div>
  );
};

// --- Category/Tag Spider Chart (independent from RPG system) ---
const SpiderChart = ({
  activities,
  categoryColors,
  showTags,
  size = 360,
}: {
  activities: Activity[];
  categoryColors: Record<string, string>;
  showTags: boolean;
  size?: number;
}) => {
  const center = size / 2;
  const radius = center - 40;

  // Aggregate time per category/tag using duration - timeRemaining for countdown and timeRemaining for countUp
  const aggregates = React.useMemo(() => {
    const perCategory = new Map<string, number>();
    const perTag = new Map<string, number>();

    activities.forEach(a => {
      // compute spent seconds
      let spent = 0;
      if (a.countUp) {
        spent = Math.max(0, a.timeRemaining || 0);
      } else {
        const planned = (a.percentage && a.percentage > 0) ? 0 : (a.duration || 0) * 60;
        const tr = typeof a.timeRemaining === 'number' ? a.timeRemaining : planned;
        spent = planned > 0 ? Math.max(0, planned - Math.max(0, tr)) : 0;
      }
      const cat = (a.category || 'uncategorized').toLowerCase();
      perCategory.set(cat, (perCategory.get(cat) || 0) + spent);
      (a.tags || []).forEach(tag => {
        perTag.set(`${cat}::${tag}`, (perTag.get(`${cat}::${tag}`) || 0) + spent);
      });
    });
    return { perCategory, perTag };
  }, [activities]);

  const categories = Array.from(aggregates.perCategory.keys());
  const total = Array.from(aggregates.perCategory.values()).reduce((s, v) => s + v, 0) || 1;
  const angleStep = (2 * Math.PI) / Math.max(1, categories.length);

  const polarToXY = (r: number, angle: number) => ({ x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) });

  const categoryPoints = categories.map((cat, i) => {
    const value = aggregates.perCategory.get(cat) || 0;
    const norm = value / total; // share of time
    const r = radius * norm;
    const angle = -Math.PI / 2 + i * angleStep;
    const { x, y } = polarToXY(r, angle);
    return { x, y, cat, value, angle };
  });

  const outlinePoints = categoryPoints.map(p => `${p.x},${p.y}`).join(' ');

  // Tag overlays per category (inner polygons), dashed
  const tagOverlays = categories.map((cat, i) => {
    const catColor = categoryColors[cat] || '#64748b';
    const tags = Array.from(aggregates.perTag.entries())
      .filter(([key]) => key.startsWith(cat + '::'))
      .map(([key, val]) => ({ tag: key.split('::')[1], val }));
    if (tags.length === 0) return null;
    const sum = tags.reduce((s, t) => s + t.val, 0) || 1;
    // Order tags stable
    const polys = tags.map((t, ti) => {
      const norm = (t.val / sum) * (aggregates.perCategory.get(cat)! / total);
      const r = radius * norm;
      const angle = -Math.PI / 2 + i * angleStep;
      const { x, y } = polarToXY(r, angle);
      return { x, y, tag: t.tag };
    });
    // Single point overlay shape is just a point; we'll render small circles with tooltip
    return { cat, catColor, points: polys };
  });

  return (
    <svg width={size} height={size} className="bg-white rounded-lg border">
      {/* Grid */}
      {[0.25, 0.5, 0.75, 1].map((f, idx) => (
        <circle key={idx} cx={center} cy={center} r={radius * f} fill="none" stroke="#e2e8f0" strokeWidth={1} />
      ))}
      {/* Axes */}
      {categories.map((cat, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const { x, y } = polarToXY(radius, angle);
        return <line key={cat} x1={center} y1={center} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={1} />;
      })}
      {/* Category polygon */}
      {categories.length > 0 && (
        <polygon points={outlinePoints} fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth={2} />
      )}
      {/* Category vertices */}
      {categoryPoints.map((p, i) => (
        <g key={p.cat}>
          <circle cx={p.x} cy={p.y} r={4} fill={categoryColors[p.cat] || '#3b82f6'} stroke="#fff" strokeWidth={2} />
          {/* Labels */}
          <text x={center + (radius + 14) * Math.cos(p.angle)} y={center + (radius + 14) * Math.sin(p.angle)} textAnchor="middle" className="text-xs fill-slate-600">
            {p.cat}
          </text>
        </g>
      ))}
      {/* Tag overlays */}
      {showTags && tagOverlays.map((ov) => ov && (
        <g key={`ov-${ov.cat}`}>
          {ov.points.map(pt => (
            <g key={`${ov.cat}-${pt.tag}`}>
              <circle cx={pt.x} cy={pt.y} r={3} fill={ov.catColor} opacity={0.7} />
              <title>{`${pt.tag}`}</title>
              <line x1={center} y1={center} x2={pt.x} y2={pt.y} stroke={ov.catColor} strokeDasharray="4,4" opacity={0.4} />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
};


const Switch = ({ checked, onCheckedChange, id }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    id={id}
    className={`${checked ? 'bg-slate-900' : 'bg-slate-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2`}
  >
    <span
      aria-hidden="true"
      className={`${checked ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
    />
  </button>
);

const Label = ({ className = '', children, ...props }) => <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}>{children}</label>;

// --- Modals ---
const ColorPicker = ({ isOpen, onClose, currentColor, onColorChange, favorites, onAddFavorite }) => {
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [lightness, setLightness] = useState(50);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (currentColor) {
      const hslMatch = currentColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (hslMatch) {
        setHue(Number.parseInt(hslMatch[1]));
        setSaturation(Number.parseInt(hslMatch[2]));
        setLightness(Number.parseInt(hslMatch[3]));
      }
    }
  }, [currentColor]);

  const currentHSL = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

  useEffect(() => {
    onColorChange(currentHSL);
  }, [hue, saturation, lightness, onColorChange]);

  const handleCanvasInteraction = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;

      setSaturation(Math.max(0, Math.min(100, x)));
      setLightness(Math.max(0, Math.min(100, 100 - y)));
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const s = (x / width) * 100;
        const l = ((height - y) / height) * 100;
        ctx.fillStyle = `hsl(${hue}, ${s}%, ${l}%)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [hue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base sm:text-lg">Color Picker</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8">
            <Icon name="x" className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full border-2 border-gray-300" style={{ backgroundColor: currentHSL }} />
            <span className="text-sm font-mono">{currentHSL}</span>
          </div>

          <div className="space-y-2">
            <Label>Hue</Label>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="360"
                value={hue}
                onChange={(e) => setHue(Number.parseInt(e.target.value))}
                className="w-full h-6 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: "linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))",
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Saturation & Lightness</Label>
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={256}
                height={256}
                className="w-full h-48 border rounded cursor-crosshair"
                onMouseDown={(e) => { setIsDragging(true); handleCanvasInteraction(e); }}
                onMouseMove={(e) => { if (isDragging) handleCanvasInteraction(e); }}
                onMouseUp={() => setIsDragging(false)}
                onTouchStart={(e) => { setIsDragging(true); handleCanvasInteraction(e); }}
                onTouchMove={(e) => { if (isDragging) handleCanvasInteraction(e); }}
                onTouchEnd={() => setIsDragging(false)}
              />
              <div
                className="absolute w-3 h-3 border-2 border-white rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${saturation}%`,
                  top: `${100 - lightness}%`,
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Favorites</Label>
              <Button variant="outline" size="sm" onClick={() => onAddFavorite(currentHSL)} className="text-xs">
                <Icon name="heart" className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {favorites.map((color, index) => (
                <button
                  key={index}
                  className="w-8 h-8 rounded-full border-2 border-gray-300 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => onColorChange(color)}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const BorrowTimeModal = ({ isOpen, onClose, onBorrow, maxTime, activityName }) => {
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  if (!isOpen) return null;

  const handleBorrow = () => {
    const totalSeconds = minutes * 60 + seconds;
    if (totalSeconds > 0 && totalSeconds <= maxTime) {
      onBorrow(totalSeconds);
    }
  };

  const handleBorrowAll = () => {
    if (maxTime > 0) {
      onBorrow(maxTime);
    }
  };

  const maxMinutes = Math.floor(maxTime / 60);
  const maxSeconds = maxTime % 60;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Borrow from Vault</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Add time to <span className="font-bold">{activityName}</span>.</p>
          <p>Vault has: <span className="font-semibold">{maxMinutes}m {maxSeconds}s</span></p>
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label htmlFor="borrow-minutes">Minutes</Label>
              <Input 
                id="borrow-minutes" 
                type="number" 
                min="0" 
                max={maxMinutes} 
                value={minutes} 
                onChange={e => {
                  const value = e.target.value;
                  if (value === '') {
                    setMinutes(0);
                  } else {
                    setMinutes(Math.max(0, Math.min(maxMinutes, Number(value) || 0)));
                  }
                }}
                onBlur={e => {
                  const value = Number(e.target.value) || 0;
                  setMinutes(Math.max(0, Math.min(maxMinutes, value)));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="borrow-seconds">Seconds</Label>
              <Input 
                id="borrow-seconds" 
                type="number" 
                min="0" 
                max="59" 
                value={seconds} 
                onChange={e => {
                  const value = e.target.value;
                  if (value === '') {
                    setSeconds(0);
                  } else {
                    setSeconds(Math.max(0, Math.min(59, Number(value) || 0)));
                  }
                }}
                onBlur={e => {
                  const value = Number(e.target.value) || 0;
                  setSeconds(Math.max(0, Math.min(59, value)));
                }}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="outline" onClick={handleBorrowAll} disabled={maxTime <= 0}>
              Borrow All
            </Button>
            <Button onClick={handleBorrow}>Borrow</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};



// Siphon Time Modal Component (NEW)
const SiphonTimeModal = ({ isOpen, onClose, onSiphon, activities, vaultTime, sourceActivityId, targetActivityId, targetIsVault }) => {
  const [minutes, setMinutes] = useState(1);
  const [seconds, setSeconds] = useState(0);

  if (!isOpen) return null;

  const sourceActivity = activities.find(a => a.id === sourceActivityId);
  const targetActivity = targetIsVault ? null : activities.find(a => a.id === targetActivityId);
  
  const maxAmount = sourceActivityId === 'vault' ? vaultTime : (sourceActivity?.timeRemaining || 0);
  const maxMinutes = Math.floor(maxAmount / 60);
  const maxSecondsTotal = maxAmount % 60;

  const handleSiphon = () => {
    const totalSeconds = minutes * 60 + seconds;
    console.log('handleSiphon called with:', { totalSeconds, maxAmount });
    if (totalSeconds > 0 && totalSeconds <= maxAmount) {
      onSiphon(sourceActivityId, targetActivityId, totalSeconds, targetIsVault);
      onClose();
    }
  };

  const handleTransferAll = () => {
    console.log('handleTransferAll called with maxAmount:', maxAmount);
    if (maxAmount > 0) {
      onSiphon(sourceActivityId, targetActivityId, maxAmount, targetIsVault);
      onClose();
    }
  };

  const handleCloseModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Modal close triggered');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleCloseModal}
      style={{ touchAction: 'manipulation' }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-sm">Transfer Time</CardTitle>
          </CardHeader>
        <CardContent className="space-y-4">
          <p>Available: <span className="font-semibold">{maxMinutes}m {maxSecondsTotal}s</span></p>
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <label>Minutes</label>
              <Input 
                type="number" 
                min="0" 
                max={maxMinutes} 
                value={minutes} 
                onChange={e => {
                  const value = e.target.value;
                  if (value === '') {
                    setMinutes(0);
                  } else {
                    setMinutes(Math.min(maxMinutes, Math.max(0, Number(value) || 0)));
                  }
                }}
                onBlur={e => {
                  const value = Number(e.target.value) || 0;
                  setMinutes(Math.min(maxMinutes, Math.max(0, value)));
                }}
              />
            </div>
            <div className="space-y-1">
              <label>Seconds</label>
              <Input 
                type="number" 
                min="0" 
                max="59" 
                value={seconds} 
                onChange={e => {
                  const value = e.target.value;
                  if (value === '') {
                    setSeconds(0);
                  } else {
                    setSeconds(Math.min(59, Math.max(0, Number(value) || 0)));
                  }
                }}
                onBlur={e => {
                  const value = Number(e.target.value) || 0;
                  setSeconds(Math.min(59, Math.max(0, value)));
                }}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button 
              variant="outline" 
              onClick={handleTransferAll} 
              disabled={maxAmount <= 0}
              style={{ touchAction: 'manipulation' }}
            >
              Transfer All
            </Button>
            <Button 
              onClick={handleSiphon}
              style={{ touchAction: 'manipulation' }}
            >
              Transfer
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

// Add Activity Modal Component (NEW)
interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Allow passing category and tags from modal
  onAdd: (
    name: string,
    color: string,
    presetTime?: number,
    countUp?: boolean,
    category?: string,
    tags?: string[]
  ) => void;
  templates: ActivityTemplate[];
  // Save template with category/tags as well
  onSaveTemplate: (name: string, color: string, category?: string, tags?: string[]) => void;
  // Existing options and adders
  customCategories: string[];
  customTags: string[];
  onAddCategory: (name: string) => void;
  rpgTags: RPGTag[]; // kept for compatibility but no longer used as source for selection
  onAddRPGTag: (name: string, color?: string) => void; // kept for compatibility
  // Also add to Manage Activity tags (string list)
  onAddCustomTag?: (name: string) => void;
}

const AddActivityModal = ({ isOpen, onClose, onAdd, templates = [], onSaveTemplate, customCategories = [], customTags = [], onAddCategory, rpgTags = [], onAddRPGTag, onAddCustomTag }: AddActivityModalProps) => {
  const [activityName, setActivityName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<ActivityTemplate | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [presetMinutes, setPresetMinutes] = useState(0);
  const [presetSeconds, setPresetSeconds] = useState(0);
  const [usePresetTime, setUsePresetTime] = useState(false);
  const [useCountUp, setUseCountUp] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagText, setNewTagText] = useState<string>('');
  
  // Predefined color palette (same as quickAddDailyActivity) - for reference only
  const colorPalette = [
    'hsl(220, 70%, 50%)', // blue
    'hsl(120, 60%, 50%)', // green
    'hsl(280, 60%, 50%)', // purple
    'hsl(0, 70%, 50%)',   // red
    'hsl(60, 80%, 50%)',  // yellow
    'hsl(320, 60%, 50%)', // pink
    'hsl(250, 70%, 50%)'  // indigo
  ];

  if (!isOpen) return null;

  const handleAdd = () => {
    let name = activityName.trim();
    let color = `hsl(${Math.floor(Math.random() * 360)}, 60%, 50%)`;
    let timeInSeconds = 0;
    
    if (selectedTemplate) {
      name = selectedTemplate.name;
      color = selectedTemplate.color; // ✅ Use template's saved color (like UI test 5)
      if (selectedTemplate.category) setSelectedCategory(selectedTemplate.category);
      if (selectedTemplate.tags) setSelectedTagIds(selectedTemplate.tags);
    } else if (!name) {
      name = "New Activity";
    }

    if (usePresetTime) {
      timeInSeconds = (presetMinutes * 60) + presetSeconds;
    }
    
  onAdd(name, color, timeInSeconds, useCountUp, selectedCategory, selectedTagIds);
    setActivityName("");
    setSelectedTemplate(null);
    setShowTemplates(false);
    setPresetMinutes(0);
    setPresetSeconds(0);
    setUsePresetTime(false);
    setUseCountUp(false);
  setSelectedCategory(undefined);
  setSelectedTagIds([]);
    onClose();
  };

  const handleSaveAsTemplate = () => {
    const name = activityName.trim();
    // Use the same random color logic as UI test 5
    const color = `hsl(${Math.floor(Math.random() * 360)}, 60%, 50%)`;
    if (name && onSaveTemplate) {
      onSaveTemplate(name, color, selectedCategory, selectedTagIds);
      setActivityName("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const handleClose = () => {
    setActivityName("");
    setSelectedTemplate(null);
    setShowTemplates(false);
    setPresetMinutes(0);
    setPresetSeconds(0);
    setUsePresetTime(false);
    setUseCountUp(false);
  setSelectedCategory(undefined);
  setSelectedTagIds([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-lg text-center">Add New Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {/* Template Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Quick Templates</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="h-6 px-2 text-xs"
                >
                  {showTemplates ? 'Hide' : 'Show'} ({templates.length})
                </Button>
              </div>
              
              {showTemplates && (
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {templates.map(template => (
                    <Button
                      key={template.id}
                      variant={selectedTemplate?.id === template.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setActivityName(template.name);
                        // Remove color selection - colors are now random
                        setSelectedCategory(template.category);
                        setSelectedTagIds(template.tags || []);
                      }}
                      className="h-8 text-xs justify-start"
                    >
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: template.color }}
                      />
                      {template.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Name Input */}
            <div className="space-y-2">
              <Label className="text-base">Or enter custom name:</Label>
              <Input 
                type="text" 
                placeholder="e.g., Study Math, Exercise, Reading..."
                value={activityName} 
                onChange={e => {
                  setActivityName(e.target.value);
                  setSelectedTemplate(null); // Clear template selection when typing
                  // Remove color clearing - colors are now random
                }}
                onKeyPress={handleKeyPress}
                autoFocus
                className="text-base py-3"
              />
            </div>

            {/* Category Selection with create option (typed input) */}
            <div className="space-y-2">
              <Label className="text-sm">Category</Label>
              <div className="flex items-center gap-2">
                <input
                  className="w-full border rounded-md h-9 px-2 text-sm"
                  placeholder="Type a category or leave blank"
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || undefined)}
                  list="manage-categories-list"
                />
                <datalist id="manage-categories-list">
                  {customCategories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    const v = (selectedCategory || '').trim().toLowerCase();
                    if (v) {
                      onAddCategory?.(v);
                      setSelectedCategory(v);
                    }
                  }}
                >
                  New
                </Button>
              </div>
            </div>

            {/* Tags multi-select with create option (using Manage Activities tags) */}
            <div className="space-y-2">
              <Label className="text-sm">Tags</Label>
              {customTags.length === 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">No tags yet.</span>
          <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => {
                      const name = prompt('New tag name?');
                      if (name) {
                        const nm = name.trim().toLowerCase();
                        if (nm) {
                          onAddCustomTag?.(nm);
                          setSelectedTagIds(prev => Array.from(new Set([...prev, nm])));
                        }
                      }
                    }}
                  >
                    Create one
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto">
                    {customTags.map(tagName => {
                      // use tagName as id since activities store strings for tags
                      const tagId = tagName;
                      const checked = selectedTagIds.includes(tagId);
                      return (
                        <label key={tagId} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedTagIds(prev => {
                                if (e.target.checked) return Array.from(new Set([...prev, tagId]));
                                return prev.filter(id => id !== tagId);
                              });
                            }}
                          />
                          <span className="inline-flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-gray-400" />
                            {tagName}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      className="flex-1 border rounded-md h-8 px-2 text-sm"
                      placeholder="Type new tag"
                      value={newTagText}
                      onChange={(e) => setNewTagText(e.target.value)}
                      list="manage-tags-list"
                    />
                    <datalist id="manage-tags-list">
                      {customTags.map(tag => (
                        <option key={tag} value={tag} />
                      ))}
                    </datalist>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        const nm = (newTagText || '').trim().toLowerCase();
                        if (nm) {
                          onAddCustomTag?.(nm);
                          setSelectedTagIds(prev => Array.from(new Set([...prev, nm])));
                          setNewTagText('');
                        }
                      }}
                    >
                      New
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Save as Template Option */}
            {activityName.trim() && !selectedTemplate && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Save this as a template?</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSaveAsTemplate}
                  className="h-6 px-2 text-xs"
                >
                  Save to List
                </Button>
              </div>
            )}

            {/* Preset Time Option */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Set preset time?</Label>
                <Switch
                  checked={usePresetTime}
                  onCheckedChange={setUsePresetTime}
                  id="use-preset-time"
                />
              </div>
              
              {usePresetTime && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center space-x-1">
                    <Input
                      type="number"
                      min="0"
                      max="999"
                      value={presetMinutes}
                      onChange={(e) => setPresetMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-16 text-center"
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-500">min</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      value={presetSeconds}
                      onChange={(e) => setPresetSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      className="w-16 text-center"
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-500">sec</span>
                  </div>
                  {(presetMinutes > 0 || presetSeconds > 0) && (
                    <span className="text-xs text-blue-600">
                      Total: {presetMinutes}:{presetSeconds.toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Count Up Option */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Count up timer?</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="use-count-up"
                    className="w-4 h-4"
                    checked={useCountUp}
                    onChange={(e) => setUseCountUp(e.target.checked)}
                  />
                  <label htmlFor="use-count-up" className="text-sm text-gray-600">
                    Count up
                  </label>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Count-up activities accumulate time instead of counting down
              </p>
            </div>

            {!activityName.trim() && !selectedTemplate && (
              <p className="text-sm text-gray-500 text-center">
                Choose a template or leave empty to use "New Activity"
              </p>
            )}
          </div>
          
          <div className="flex justify-end space-x-3 pt-2">
            <Button variant="outline" onClick={handleClose} className="px-6">
              Cancel
            </Button>
            <Button onClick={handleAdd} className="px-6">
              Add {selectedTemplate ? `"${selectedTemplate.name}"` : activityName.trim() ? `"${activityName.trim()}"` : '"New Activity"'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Activity Management Page Component
const ActivityManagementPage = ({ 
  activityTemplates, 
  setActivityTemplates, 
  activities, 
  setActivities, 
  onBackToTimer,
  onAddToSession,
  onAddToDaily,
  onAddToBoth,
  customCategories,
  setCustomCategories,
  customTags,
  setCustomTags,
}) => {
  try {
    const [editingTemplate, setEditingTemplate] = useState<ActivityTemplate | null>(null);
    const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [showTagManager, setShowTagManager] = useState(false);
  
  // Activity customization state
  const [editingActivity, setEditingActivity] = useState<any | null>(null);
  
  // Categories and tags are provided by parent and persisted globally

  // Only custom categories now
  const allCategories = [...customCategories];

  // Get all unique tags from templates and custom tags
  const allTags = [...new Set([
    ...customTags,
    ...activityTemplates.flatMap(template => template.tags || [])
  ])].sort();

  // Filter templates based on search query and category
  const filteredTemplates = activityTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.tags && template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleEditTemplate = (template: ActivityTemplate) => {
    setEditingTemplate(template);
  };

  const handleSaveTemplate = (templateData: { 
    name: string; 
    color: string; 
    category?: string; 
    tags?: string[];
    isAllDay?: boolean;
    startTime?: string;
    endTime?: string;
    presetDuration?: number;
    recurring?: {
      type: 'none' | 'every-day' | 'specific-days-week' | 'specific-days-month' | 'specific-days-year' | 'interval' | 'repeat';
      daysOfWeek?: number[];
      daysOfMonth?: number[];
      daysOfYear?: string[];
      intervalDays?: number;
      repeatDays?: number;
      isFlexible?: boolean;
      alternatesDays?: boolean;
    }
  }) => {
    if (editingTemplate && editingTemplate.id) {
      // Update existing template
      setActivityTemplates(prev => 
        prev.map(t => t.id === editingTemplate.id ? { ...t, ...templateData } : t)
      );
    } else {
      // Add new template
      const newTemplate = {
        id: Date.now().toString(),
        ...templateData
      };
      setActivityTemplates(prev => [...prev, newTemplate]);
    }
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (templateId: string) => {
    setActivityTemplates(prev => prev.filter(t => t.id !== templateId));
  };

  const handleAddNewTemplate = () => {
    setEditingTemplate({
      id: '',
      name: '',
      color: `hsl(${Math.floor(Math.random() * 360)}, 60%, 50%)`,
      category: undefined,
      tags: undefined,
      isAllDay: false,
      startTime: undefined,
      endTime: undefined,
      presetDuration: 60, // Default 1 hour
      recurring: {
        type: 'none',
        isFlexible: false,
        alternatesDays: false
      }
    });
  };

  const handleBulkDelete = () => {
    setActivityTemplates(prev => 
      prev.filter(t => !selectedTemplates.includes(t.id))
    );
    setSelectedTemplates([]);
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplates(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleRemoveFromSession = (activityId: string) => {
    setActivities(prev => prev.filter(a => a.id !== activityId));
  };

  const getUsageCount = (templateName: string) => {
    return activities.filter(a => a.name === templateName).length;
  };

  const handleAddCategory = (categoryName: string) => {
    const trimmedName = categoryName.trim().toLowerCase();
    if (trimmedName && !allCategories.includes(trimmedName)) {
      setCustomCategories(prev => [...prev, trimmedName]);
    }
  };

  const handleRemoveCategory = (categoryName: string) => {
    setCustomCategories(prev => prev.filter(c => c !== categoryName));
    // Also remove this category from any templates that use it
    setActivityTemplates(prev => 
      prev.map(template => 
        template.category === categoryName 
          ? { ...template, category: undefined }
          : template
      )
    );
  };

  const handleAddTag = (tagName: string) => {
    const trimmedName = tagName.trim().toLowerCase();
    if (trimmedName && !allTags.includes(trimmedName)) {
      setCustomTags(prev => [...prev, trimmedName]);
    }
  };

  const handleRemoveTag = (tagName: string) => {
    setCustomTags(prev => prev.filter(t => t !== tagName));
    // Also remove this tag from any templates that use it
    setActivityTemplates(prev => 
      prev.map(template => 
        template.tags 
          ? { ...template, tags: template.tags.filter(t => t !== tagName) }
          : template
      )
    );
  };

  // Activity customization handlers
  const handleEditActivity = (activity: any) => {
    setEditingActivity(activity);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 font-sans">
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onBackToTimer}
                  className="flex items-center space-x-1 sm:space-x-2 h-8 sm:h-9 text-xs sm:text-sm"
                >
                  <Icon name="rotateCcw" className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>Back to Timer</span>
                </Button>
                <CardTitle className="text-xl sm:text-2xl lg:text-3xl font-bold">Activity Management</CardTitle>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddNewTemplate}
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                >
                  <Icon name="plus" className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  New Template
                </Button>
                {selectedTemplates.length > 0 && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={handleBulkDelete}
                    className="h-8 sm:h-9 text-xs sm:text-sm"
                  >
                    <Icon name="trash2" className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Delete ({selectedTemplates.length})
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 p-3 sm:p-6">
            {/* Search and Stats */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-0 sm:justify-between">
              <div className="flex-1 w-full sm:max-w-md">
                <Input
                  placeholder="Search templates or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 sm:h-9 text-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-gray-600">
                <span>Templates: {activityTemplates.length}</span>
                <span>Session: {activities.length}</span>
              </div>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <span className="text-xs sm:text-sm font-medium">Filter by Category:</span>
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {['all', ...allCategories].map(category => (
                  <Button
                    key={category}
                    variant={categoryFilter === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategoryFilter(category)}
                    className="text-xs h-7 sm:h-8"
                  >
                    {category === 'all' ? 'All' : (typeof category === 'string' && category.length > 0) ? category.charAt(0).toUpperCase() + category.slice(1) : 'Unknown'}
                  </Button>
                ))})
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCategoryManager(true)}
                  className="text-xs h-7 sm:h-8"
                >
                  <Icon name="settings" className="h-3 w-3 mr-1" />
                  Manage
                </Button>
              </div>
            </div>

            {/* Tags Management */}
            <div className="space-y-2">
              <span className="text-xs sm:text-sm font-medium">All Tags:</span>
              <div className="flex flex-wrap gap-1">
                {allTags.slice(0, 10).map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
                {allTags.length > 10 && (
                  <span className="text-xs text-gray-500">+{allTags.length - 10} more</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTagManager(true)}
                  className="text-xs h-7 sm:h-8"
                >
                  <Icon name="settings" className="h-3 w-3 mr-1" />
                  Manage Tags
                </Button>
              </div>
            </div>

            {/* Activity Templates Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filteredTemplates.map(template => (
                <Card key={template.id} className="relative">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedTemplates.includes(template.id)}
                          onChange={() => handleSelectTemplate(template.id)}
                          className="rounded flex-shrink-0"
                        />
                        <div 
                          className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-gray-300 flex-shrink-0" 
                          style={{ backgroundColor: template.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm sm:text-lg truncate">{template.name}</h3>
                          {template.category && (
                            <div className="text-xs text-gray-500 mt-1">
                              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                                {template.category}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTemplate(template)}
                          className="h-8 w-8 sm:h-10 sm:w-10 p-1 hover:bg-gray-100 rounded-lg"
                          title="Edit template"
                        >
                          <Icon name="settings" className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="h-8 w-8 sm:h-10 sm:w-10 p-1 hover:bg-red-50 rounded-lg"
                          title="Delete template"
                        >
                          <Icon name="trash2" className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-xs sm:text-sm text-gray-600">
                        Used {getUsageCount(template.name)} times
                      </div>
                      {template.tags && template.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {template.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Time Window Indicator */}
                      {(template.isAllDay || (template.startTime && template.endTime)) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                            <Icon name="clock" className="h-3 w-3" />
                            {template.isAllDay ? (
                              <span>All Day</span>
                            ) : (
                              <span>{template.startTime} - {template.endTime}</span>
                            )}
                          </div>
                          {template.presetDuration && (
                            <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              <Icon name="timer" className="h-3 w-3" />
                              <span>Default: {Math.floor(template.presetDuration / 60)}h {template.presetDuration % 60}m</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Recurring Schedule Indicator */}
                      {template.recurring && template.recurring.type !== 'none' && (
                        <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          <Icon name="refresh-cw" className="h-3 w-3" />
                          <span>
                            {(() => {
                              switch (template.recurring.type) {
                                case 'every-day':
                                  return template.recurring.isFlexible ? 'Daily (Flexible)' : 'Every Day';
                                case 'specific-days-week':
                                  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                  const selectedDays = template.recurring.daysOfWeek
                                    ?.map(day => weekDays[day])
                                    .join(', ') || '';
                                  return `${selectedDays}${template.recurring.isFlexible ? ' (Flex)' : ''}`;
                                case 'specific-days-month':
                                  const monthDays = template.recurring.daysOfMonth?.slice(0, 3).join(', ') || '';
                                  const hasMore = (template.recurring.daysOfMonth?.length || 0) > 3;
                                  return `${monthDays}${hasMore ? '...' : ''}${template.recurring.isFlexible ? ' (Flex)' : ''}`;
                                case 'specific-days-year':
                                  return `Yearly${template.recurring.isFlexible ? ' (Flex)' : ''}`;
                                case 'interval':
                                  return `Every ${template.recurring.intervalDays}d${template.recurring.isFlexible ? ' (Flex)' : ''}`;
                                case 'repeat':
                                  return `${template.recurring.repeatCount}x${template.recurring.isFlexible ? ' (Flex)' : ''}`;
                                default:
                                  return 'Recurring';
                              }
                            })()}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2">
                        <AddActivityDropdown 
                          template={template}
                          onAddToSession={onAddToSession}
                          onAddToDaily={onAddToDaily}
                          onAddToBoth={onAddToBoth}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredTemplates.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">
                  {searchQuery ? 'No templates match your search' : 'No activity templates yet'}
                </p>
                <Button onClick={handleAddNewTemplate}>
                  <Icon name="plus" className="h-4 w-4 mr-2" />
                  Create your first template
                </Button>
              </div>
            )}

            {/* Current Session Activities */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Current Session Activities</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {activities.map(activity => (
                  <Card key={activity.id} className="border-blue-200">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <div 
                            className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: activity.color }}
                          />
                          <span className="font-medium text-sm sm:text-base truncate">{activity.name}</span>
                        </div>
                        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                          <Badge variant="secondary" className="text-xs px-1.5 py-0.5 sm:px-2.5 sm:py-0.5">
                            {activity.percentage}%
                          </Badge>
                          
                          {/* Edit Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditActivity(activity);
                            }}
                            className="h-8 w-8 sm:h-10 sm:w-10 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-300 rounded-lg"
                            title="Edit Activity"
                          >
                            <Icon name="settings" className="h-4 w-4 sm:h-5 sm:w-5" />
                          </Button>
                          
                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFromSession(activity.id)}
                            className="h-8 w-8 sm:h-10 sm:w-10 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-300 rounded-lg"
                            title="Delete Activity"
                          >
                            <Icon name="trash2" className="h-4 w-4 sm:h-5 sm:w-5" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">
                        {activity.isLocked && <Icon name="lock" className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />}
                        {activity.sharedId && (
                          <span className="inline-flex items-center gap-1 mr-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                            <span className="text-purple-600 font-medium">Shared</span>
                          </span>
                        )}
                        {activity.isCompleted ? 'Completed' : 'Active'}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {activities.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No activities in current session
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">
                {editingTemplate.id ? 'Edit Template' : 'New Template'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
              <div>
                <Label htmlFor="template-name" className="text-xs sm:text-sm">Template Name</Label>
                <Input
                  id="template-name"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                  placeholder="e.g., Deep Work, Exercise, Reading..."
                  className="h-8 sm:h-10 text-xs sm:text-sm mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="template-color" className="text-xs sm:text-sm">Color</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <div 
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-gray-300 flex-shrink-0" 
                    style={{ backgroundColor: editingTemplate.color }}
                  />
                  <Input
                    id="template-color"
                    value={editingTemplate.color}
                    onChange={(e) => setEditingTemplate(prev => prev ? ({ ...prev, color: e.target.value }) : null)}
                    placeholder="hsl(220, 70%, 50%)"
                    className="h-8 sm:h-10 text-xs sm:text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTemplate(prev => prev ? ({ 
                      ...prev, 
                      color: `hsl(${Math.floor(Math.random() * 360)}, 60%, 50%)` 
                    }) : null)}
                    className="h-8 w-8 sm:h-10 sm:w-10 p-0"
                  >
                    <Icon name="dice" className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="template-category" className="text-xs sm:text-sm">Category</Label>
                <select
                  id="template-category"
                  value={editingTemplate.category || ''}
                  onChange={(e) => setEditingTemplate(prev => prev ? ({ ...prev, category: e.target.value || undefined }) : null)}
                  className="flex h-8 sm:h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 sm:py-2 text-xs sm:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                >
                  <option value="">No Category</option>
                  {allCategories.map(category => (
                    <option key={category} value={category}>
                      {(typeof category === 'string' && category.length > 0) ? category.charAt(0).toUpperCase() + category.slice(1) : 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="template-tags" className="text-xs sm:text-sm">Tags</Label>
                <Input
                  id="template-tags"
                  value={editingTemplate.tags?.join(', ') || ''}
                  onChange={(e) => setEditingTemplate(prev => prev ? ({ 
                    ...prev, 
                    tags: e.target.value ? e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : undefined
                  }) : null)}
                  placeholder="e.g., urgent, important, project-a"
                  className="h-8 sm:h-10 text-xs sm:text-sm mt-1"
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  {allTags.slice(0, 8).map(tag => (
                    <Button
                      key={tag}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentTags = editingTemplate.tags || [];
                        if (!currentTags.includes(tag)) {
                          setEditingTemplate(prev => prev ? ({ 
                            ...prev, 
                            tags: [...currentTags, tag]
                          }) : null);
                        }
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      + {tag}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">Separate tags with commas or click suggestions above</p>
              </div>

              {/* Time Window Configuration */}
              <div className="border-t pt-4">
                <Label className="text-xs sm:text-sm font-medium">Time Window Scheduling</Label>
                <p className="text-xs text-gray-500 mb-3">Set when this activity should automatically appear in session and daily modes</p>
                
                <div className="space-y-3">
                  {/* All Day Toggle */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="template-allday"
                      checked={editingTemplate.isAllDay || false}
                      onChange={(e) => setEditingTemplate(prev => prev ? ({ 
                        ...prev, 
                        isAllDay: e.target.checked,
                        // Clear time windows if setting to all day
                        startTime: e.target.checked ? undefined : prev.startTime,
                        endTime: e.target.checked ? undefined : prev.endTime
                      }) : null)}
                      className="rounded"
                    />
                    <Label htmlFor="template-allday" className="text-xs sm:text-sm">
                      All Day Activity
                    </Label>
                  </div>

                  {/* Time Window Inputs */}
                  {!editingTemplate.isAllDay && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="template-starttime" className="text-xs">Start Time</Label>
                          <Input
                            id="template-starttime"
                            type="time"
                            value={editingTemplate.startTime || ''}
                            onChange={(e) => setEditingTemplate(prev => prev ? ({ 
                              ...prev, 
                              startTime: e.target.value || undefined
                            }) : null)}
                            className="h-8 text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="template-endtime" className="text-xs">End Time</Label>
                          <Input
                            id="template-endtime"
                            type="time"
                            value={editingTemplate.endTime || ''}
                            onChange={(e) => setEditingTemplate(prev => prev ? ({ 
                              ...prev, 
                              endTime: e.target.value || undefined
                            }) : null)}
                            className="h-8 text-xs mt-1"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        Activity will automatically appear when current time is within this window
                      </p>
                    </div>
                  )}

                  {editingTemplate.isAllDay && (
                    <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                      This activity will always appear in both session and daily modes
                    </p>
                  )}

                  {/* Preset Duration Setting */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label htmlFor="template-duration" className="text-xs sm:text-sm font-medium">Default Duration</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="template-duration"
                        type="number"
                        min="15"
                        max="480"
                        step="15"
                        value={editingTemplate.presetDuration || 60}
                        onChange={(e) => setEditingTemplate(prev => prev ? ({ 
                          ...prev, 
                          presetDuration: parseInt(e.target.value) || 60
                        }) : null)}
                        className="h-8 text-xs flex-1"
                      />
                      <span className="text-xs text-gray-500">minutes</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Duration for activities auto-created from this template 
                      ({Math.floor((editingTemplate.presetDuration || 60) / 60)}h {(editingTemplate.presetDuration || 60) % 60}m - {Math.round(((editingTemplate.presetDuration || 60) / (24 * 60)) * 100 * 10) / 10}% of day)
                    </p>
                  </div>

                  {/* Recurring Schedule Settings */}
                  <div className="space-y-3 pt-3 border-t">
                    <Label className="text-xs sm:text-sm font-medium">Recurring Schedule</Label>
                    <p className="text-xs text-gray-500 mb-3">Set how often this activity should automatically appear</p>
                    
                    <div className="space-y-2">
                      {/* Recurring Type Selection */}
                      <div className="space-y-2">
                        {[
                          { value: 'none', label: 'No repeat (manual only)' },
                          { value: 'every-day', label: 'Every day' },
                          { value: 'specific-days-week', label: 'Specific days of the week' },
                          { value: 'specific-days-month', label: 'Specific days of the month' },
                          { value: 'specific-days-year', label: 'Specific days of the year' },
                          { value: 'interval', label: 'Some days per period' },
                          { value: 'repeat', label: 'Repeat' }
                        ].map(option => (
                          <div key={option.value} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id={`recurring-${option.value}`}
                              name="recurringType"
                              value={option.value}
                              checked={(editingTemplate.recurring?.type || 'none') === option.value}
                              onChange={(e) => setEditingTemplate(prev => prev ? ({
                                ...prev,
                                recurring: {
                                  ...prev.recurring,
                                  type: e.target.value as any,
                                  // Reset other properties when type changes
                                  daysOfWeek: e.target.value === 'specific-days-week' ? [1, 2, 3, 4, 5] : undefined,
                                  daysOfMonth: e.target.value === 'specific-days-month' ? [1] : undefined,
                                  daysOfYear: e.target.value === 'specific-days-year' ? ['01-01'] : undefined,
                                  intervalDays: e.target.value === 'interval' ? 2 : undefined,
                                  repeatDays: e.target.value === 'repeat' ? 2 : undefined,
                                  isFlexible: false,
                                  alternatesDays: false
                                }
                              }) : null)}
                              className="rounded"
                            />
                            <Label htmlFor={`recurring-${option.value}`} className="text-xs sm:text-sm cursor-pointer">
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </div>

                      {/* Specific Days of Week */}
                      {editingTemplate.recurring?.type === 'specific-days-week' && (
                        <div className="space-y-2 pl-4 border-l-2 border-blue-200">
                          <Label className="text-xs font-medium">Days of the Week</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                              <div key={day} className="flex items-center space-x-1">
                                <input
                                  type="checkbox"
                                  id={`day-${index}`}
                                  checked={editingTemplate.recurring?.daysOfWeek?.includes(index) || false}
                                  onChange={(e) => {
                                    const currentDays = editingTemplate.recurring?.daysOfWeek || [];
                                    const newDays = e.target.checked 
                                      ? [...currentDays, index].sort()
                                      : currentDays.filter(d => d !== index);
                                    setEditingTemplate(prev => prev ? ({
                                      ...prev,
                                      recurring: { 
                                        type: prev.recurring?.type || 'specific-days-week',
                                        ...prev.recurring, 
                                        daysOfWeek: newDays 
                                      }
                                    }) : null);
                                  }}
                                  className="rounded"
                                />
                                <Label htmlFor={`day-${index}`} className="text-xs cursor-pointer">{day}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Repeat Interval */}
                      {editingTemplate.recurring?.type === 'repeat' && (
                        <div className="space-y-2 pl-4 border-l-2 border-green-200">
                          <Label className="text-xs font-medium">Repeat Interval</Label>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs">Every</span>
                            <Input
                              type="number"
                              min="1"
                              max="30"
                              value={editingTemplate.recurring?.repeatDays || 2}
                              onChange={(e) => setEditingTemplate(prev => prev ? ({
                                ...prev,
                                recurring: { 
                                  type: prev.recurring?.type || 'repeat',
                                  ...prev.recurring, 
                                  repeatDays: parseInt(e.target.value) || 2 
                                }
                              }) : null)}
                              className="h-6 w-16 text-xs"
                            />
                            <span className="text-xs">days</span>
                          </div>
                        </div>
                      )}

                      {/* Flexible Option */}
                      {editingTemplate.recurring?.type !== 'none' && (
                        <div className="space-y-2 pl-4 border-l-2 border-purple-200">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="flexible-recurring"
                              checked={editingTemplate.recurring?.isFlexible || false}
                              onChange={(e) => setEditingTemplate(prev => prev ? ({
                                ...prev,
                                recurring: { 
                                  type: prev.recurring?.type || 'none',
                                  ...prev.recurring, 
                                  isFlexible: e.target.checked 
                                }
                              }) : null)}
                              className="rounded"
                            />
                            <Label htmlFor="flexible-recurring" className="text-xs sm:text-sm cursor-pointer font-medium text-purple-700">
                              Flexible
                            </Label>
                          </div>
                          <p className="text-xs text-gray-500">
                            It will be shown each day until completed.
                          </p>
                          
                          {editingTemplate.recurring?.type === 'repeat' && (
                            <div className="flex items-center space-x-2 mt-2">
                              <input
                                type="checkbox"
                                id="alternate-days"
                                checked={editingTemplate.recurring?.alternatesDays || false}
                                onChange={(e) => setEditingTemplate(prev => prev ? ({
                                  ...prev,
                                  recurring: { 
                                    type: prev.recurring?.type || 'repeat',
                                    ...prev.recurring, 
                                    alternatesDays: e.target.checked 
                                  }
                                }) : null)}
                                className="rounded"
                              />
                              <Label htmlFor="alternate-days" className="text-xs cursor-pointer">
                                Alternate days
                              </Label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-2 sm:pt-4">
                <Button variant="outline" onClick={() => setEditingTemplate(null)} className="h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4">
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleSaveTemplate({
                    name: editingTemplate.name,
                    color: editingTemplate.color,
                    category: editingTemplate.category,
                    tags: editingTemplate.tags,
                    isAllDay: editingTemplate.isAllDay,
                    startTime: editingTemplate.startTime,
                    endTime: editingTemplate.endTime,
                    presetDuration: editingTemplate.presetDuration,
                    recurring: editingTemplate.recurring
                  })}
                  disabled={!editingTemplate.name.trim()}
                  className="h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4"
                >
                  {editingTemplate.id ? 'Update' : 'Create'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Manage Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
              {/* Categories */}
              <div>
                <Label className="text-xs sm:text-sm">Categories</Label>
                <div className="space-y-2 mt-1">
                  {customCategories.map(category => (
                    <div
                      key={category}
                      className="flex items-center justify-between p-2 bg-blue-50 rounded"
                    >
                      <span className="text-sm">{(typeof category === 'string' && category.length > 0) ? category.charAt(0).toUpperCase() + category.slice(1) : 'Unknown'}</span>
                      <button
                        onClick={() => handleRemoveCategory(category)}
                        className="h-6 w-6 text-red-600 hover:text-red-800 hover:bg-red-100 rounded border border-red-300 flex items-center justify-center"
                        title="Remove category"
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                  {customCategories.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No custom categories yet</p>
                  )}
                </div>
              </div>

              {/* Add New Category */}
              <div>
                <Label htmlFor="new-category" className="text-xs sm:text-sm">Add New Category</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    id="new-category"
                    placeholder="Enter category name"
                    className="h-8 sm:h-10 text-xs sm:text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const value = e.target.value.trim().toLowerCase();
                        if (value && !allCategories.includes(value)) {
                          handleAddCategory(value);
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8 w-8 sm:h-10 sm:w-10 p-0"
                    onClick={(e) => {
                      const input = e.target.parentElement.querySelector('input');
                      const value = input.value.trim().toLowerCase();
                      if (value && !allCategories.includes(value)) {
                        handleAddCategory(value);
                        input.value = '';
                      }
                    }}
                  >
                    <Icon name="plus" className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 sm:pt-4">
                <Button variant="outline" onClick={() => setShowCategoryManager(false)} className="h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4">
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tag Manager Modal */}
      {showTagManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Manage Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
              {/* Existing Tags */}
              <div>
                <Label className="text-xs sm:text-sm">Existing Tags</Label>
                <div className="flex flex-wrap gap-2 mt-1 max-h-32 sm:max-h-48 overflow-y-auto">
                  {allTags.map(tag => (
                    <div
                      key={tag}
                      className="flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs"
                    >
                      <span>{tag}</span>
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                        title="Remove tag"
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                  {allTags.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No tags yet</p>
                  )}
                </div>
              </div>

              {/* Add New Tag */}
              <div>
                <Label htmlFor="new-tag" className="text-xs sm:text-sm">Add New Tag</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    id="new-tag"
                    placeholder="Enter tag name"
                    className="h-8 sm:h-10 text-xs sm:text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const value = e.target.value.trim().toLowerCase();
                        if (value && !allTags.includes(value)) {
                          handleAddTag(value);
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8 w-8 sm:h-10 sm:w-10 p-0"
                    onClick={(e) => {
                      const input = e.target.parentElement.querySelector('input');
                      const value = input.value.trim().toLowerCase();
                      if (value && !allTags.includes(value)) {
                        handleAddTag(value);
                        input.value = '';
                      }
                    }}
                  >
                    <Icon name="plus" className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 sm:pt-4">
                <Button variant="outline" onClick={() => setShowTagManager(false)} className="h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4">
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Activity Modal */}
      {editingActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Edit Activity: {editingActivity.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
              <div>
                <Label htmlFor="activity-name" className="text-xs sm:text-sm">Activity Name</Label>
                <Input
                  id="activity-name"
                  value={editingActivity.name}
                  onChange={(e) => setEditingActivity(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                  placeholder="Activity name..."
                  className="h-8 sm:h-10 text-xs sm:text-sm mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="activity-percentage" className="text-xs sm:text-sm">Time Percentage</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    id="activity-percentage"
                    type="number"
                    min="0"
                    max="100"
                    value={editingActivity.percentage}
                    onChange={(e) => setEditingActivity(prev => prev ? ({ ...prev, percentage: parseInt(e.target.value) || 0 }) : null)}
                    className="flex-1 h-8 sm:h-10 text-xs sm:text-sm"
                  />
                  <span className="text-xs sm:text-sm text-gray-500">%</span>
                </div>
              </div>

              <div>
                <Label htmlFor="activity-duration" className="text-xs sm:text-sm">Exact Time Duration</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    id="activity-duration"
                    type="number"
                    min="0"
                    value={editingActivity.duration || 0}
                    onChange={(e) => setEditingActivity(prev => prev ? ({ ...prev, duration: parseInt(e.target.value) || 0 }) : null)}
                    className="flex-1 h-8 sm:h-10 text-xs sm:text-sm"
                    placeholder="Enter minutes"
                  />
                  <span className="text-xs sm:text-sm text-gray-500">minutes</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Set exact time in minutes (overrides percentage if set)</p>
              </div>

              <div>
                <Label htmlFor="activity-color" className="text-xs sm:text-sm">Color</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <div 
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-gray-300 flex-shrink-0" 
                    style={{ backgroundColor: editingActivity.color }}
                  />
                  <Input
                    id="activity-color"
                    value={editingActivity.color}
                    onChange={(e) => setEditingActivity(prev => prev ? ({ ...prev, color: e.target.value }) : null)}
                    placeholder="hsl(220, 70%, 50%)"
                    className="flex-1 h-8 sm:h-10 text-xs sm:text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingActivity(prev => prev ? ({ 
                      ...prev, 
                      color: `hsl(${Math.floor(Math.random() * 360)}, 60%, 50%)` 
                    }) : null)}
                    className="h-8 w-8 sm:h-10 sm:w-10 p-0"
                  >
                    <Icon name="dice" className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs sm:text-sm">Add Tags</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {allTags.slice(0, 8).map(tag => (
                    <Button
                      key={tag}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Add tag functionality here if needed
                        console.log('Add tag:', tag);
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      + {tag}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs sm:text-sm">Add Category</Label>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      // Add category functionality here if needed
                      console.log('Add category:', e.target.value);
                    }
                  }}
                  className="flex h-8 sm:h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 sm:py-2 text-xs sm:text-sm mt-1"
                >
                  <option value="">Select a category to add...</option>
                  {allCategories.map(category => (
                    <option key={category} value={category}>
                      {(typeof category === 'string' && category.length > 0) ? category.charAt(0).toUpperCase() + category.slice(1) : 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end space-x-2 pt-2 sm:pt-4">
                <Button variant="outline" onClick={() => setEditingActivity(null)} className="h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4">
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    // Save changes to the activity
                    setActivities(prev => 
                      prev.map(a => a.id === editingActivity.id ? editingActivity : a)
                    );
                    setEditingActivity(null);
                  }}
                  disabled={!editingActivity.name.trim()}
                  className="h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4"
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
  } catch (error) {
    console.error('ActivityManagementPage error:', error);
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 font-sans">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl text-red-600">Error in Activity Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p>There was an error rendering the Activity Management page:</p>
              <pre className="bg-red-50 p-2 mt-2 text-sm">{error.toString()}</pre>
              <Button 
                variant="outline" 
                onClick={onBackToTimer}
                className="mt-4"
              >
                Back to Timer
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
};

// FlowmodoroActivity component that behaves like other activities
const FlowmodoroActivity = ({ flowState, settings, onTakeBreak, onSkipBreak, onReset, isTimerActive, formatTime }) => {
  if (!settings.flowmodoroEnabled) return null;
  
  const availableMinutes = Math.floor(flowState.availableRestTime / 60);
  const availableSeconds = flowState.availableRestTime % 60;
  const breakMinutes = Math.floor(flowState.breakTimeRemaining / 60);
  const breakSeconds = flowState.breakTimeRemaining % 60;
  
  const totalEarnedMinutes = Math.floor(flowState.totalEarnedToday / 60);
  const totalEarnedSeconds = flowState.totalEarnedToday % 60;
  
  // Calculate progress for visual display - always show full bar that fills/drains
  const progressPercentage = flowState.isOnBreak 
    ? flowState.initialBreakDuration > 0 
      ? (flowState.breakTimeRemaining / flowState.initialBreakDuration) * 100
      : 0 // If no initial duration, show empty
    : 100; // Always full when not on break
  const displayProgress = settings.flowmodoroProgressType === 'fill' ? progressPercentage : 100 - progressPercentage;
  
  const handleFlowmodoroClick = () => {
    if (flowState.isOnBreak) {
      // Stop the break and return unused time to available rest time
      onSkipBreak();
    } else if (flowState.availableRestTime > 0) {
      // Start a break using all available time
      onTakeBreak(flowState.availableRestTime);
    }
    // If no rest time available, do nothing (button shows tooltip explaining why)
  };
  
  return (
    <div 
      className={`relative overflow-hidden flex items-center justify-between p-3 rounded-lg border-2 transition-colors mb-2 ${
        flowState.isOnBreak 
          ? "bg-purple-100 border-purple-300" 
          : flowState.availableRestTime > 0 
            ? "hover:bg-purple-50 border-purple-200 cursor-pointer" 
            : "bg-purple-25 border-purple-100 cursor-not-allowed opacity-70"
      }`}
      onClick={handleFlowmodoroClick}
      title={
        flowState.isOnBreak 
          ? "Click to skip break and return unused time" 
          : flowState.availableRestTime > 0 
            ? `Start ${Math.floor(flowState.availableRestTime / 60)}m ${flowState.availableRestTime % 60}s break`
            : "No rest time earned yet. Work on activities to earn break time."
      }
    >
      {/* Background progress bar like other activities */}
      {settings.flowmodoroShowProgress && (
        <div 
          className="absolute top-0 left-0 h-full opacity-20 transition-all duration-500" 
          style={{ 
            width: `${Math.max(0, Math.min(100, displayProgress))}%`, 
            backgroundColor: '#8b5cf6' // purple-500
          }}
        />
      )}
      
      <div className="flex items-center space-x-4 z-10">
        <div className={`w-4 h-4 rounded-full ${flowState.availableRestTime > 0 ? 'bg-purple-500' : 'bg-gray-300'}`} />
        <span className="font-semibold text-purple-800">
          {flowState.isOnBreak ? 'Flowmodoro Break' : 'Flowmodoro Rest'}
        </span>
        {!flowState.isOnBreak && flowState.availableRestTime === 0 && (
          <span className="text-xs text-gray-500">(Start timer to earn time)</span>
        )}
      </div>
      
      <div className="flex items-center space-x-2 z-10">
        {settings.showActivityTime && (
          <span className="text-sm font-mono">
            {flowState.isOnBreak 
              ? formatTime(flowState.breakTimeRemaining)
              : formatTime(flowState.availableRestTime)
            }
          </span>
        )}
      </div>
    </div>
  );
};

// Daily Activity Edit Modal Component
const DailyActivityEditModal = ({ isOpen, onClose, activity, onSave, onDelete, isNewActivity }) => {
  const [formData, setFormData] = useState({
    name: '',
    color: 'hsl(220, 70%, 50%)', // Use HSL instead of bg-classes
    duration: 60,
    percentage: 4.2,
    status: 'scheduled',
    subtasks: [] as Subtask[]
  });

  const [newSubtaskName, setNewSubtaskName] = useState('');

  useEffect(() => {
    if (activity) {
      setFormData({
        name: activity.name || '',
        color: activity.color || 'hsl(220, 70%, 50%)', // Use HSL
        duration: activity.duration || 60,
        percentage: activity.percentage || 4.2,
        status: activity.status || 'scheduled',
        subtasks: activity.subtasks || []
      });
    }
  }, [activity]);

  // Use HSL colors that match the system
  const colorOptions = [
    { name: 'Blue', value: 'hsl(220, 70%, 50%)' },
    { name: 'Green', value: 'hsl(120, 60%, 50%)' },
    { name: 'Purple', value: 'hsl(280, 60%, 50%)' },
    { name: 'Red', value: 'hsl(0, 70%, 50%)' },
    { name: 'Orange', value: 'hsl(30, 80%, 50%)' },
    { name: 'Pink', value: 'hsl(320, 60%, 50%)' },
    { name: 'Indigo', value: 'hsl(250, 70%, 50%)' },
    { name: 'Yellow', value: 'hsl(60, 80%, 50%)' },
    { name: 'Teal', value: 'hsl(180, 60%, 50%)' },
    { name: 'Gray', value: 'hsl(0, 0%, 50%)' }
  ];

  const handleDurationChange = (duration) => {
    const percentage = ((duration / (24 * 60)) * 100).toFixed(1);
    setFormData(prev => ({ 
      ...prev, 
      duration,
      percentage: parseFloat(percentage)
    }));
  };

  const addSubtask = () => {
    if (!newSubtaskName.trim()) return;
    
    const newSubtask = {
      id: `subtask-${Date.now()}`,
      name: newSubtaskName.trim(),
      completed: false,
      createdAt: new Date()
    };
    
    setFormData(prev => ({
      ...prev,
      subtasks: [...prev.subtasks, newSubtask]
    }));
    setNewSubtaskName('');
  };

  const removeSubtask = (subtaskId) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter(subtask => subtask.id !== subtaskId)
    }));
  };

  const toggleSubtask = (subtaskId) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.map(subtask =>
        subtask.id === subtaskId
          ? { ...subtask, completed: !subtask.completed }
          : subtask
      )
    }));
  };

  const handleSave = () => {
    const updatedActivity = {
      ...activity,
      ...formData,
      id: activity?.id || `activity-${Date.now()}`
    };
    onSave(updatedActivity);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isNewActivity ? 'Add New Activity' : 'Edit Activity'}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <Icon name="x" className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Activity Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Activity Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter activity name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color Theme
            </label>
            <div className="grid grid-cols-5 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.color === color.value
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div 
                    className="w-6 h-6 rounded-full mx-auto mb-1"
                    style={{ backgroundColor: color.value }}
                  ></div>
                  <div className="text-xs text-gray-600">{color.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Duration Settings */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => handleDurationChange(parseInt(e.target.value) || 60)}
                min="15"
                max="480"
                step="15"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-xs text-gray-500 mt-1">
                {Math.floor(formData.duration / 60)}h {formData.duration % 60}m 
                ({Math.round((formData.duration / (24 * 60)) * 100 * 10) / 10}% of day)
              </div>
            </div>
          </div>

          {/* Subtasks Management */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subtasks ({formData.subtasks.filter(s => s.completed).length}/{formData.subtasks.length} completed)
            </label>
            
            {/* Add new subtask */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newSubtaskName}
                onChange={(e) => setNewSubtaskName(e.target.value)}
                placeholder="Add a subtask..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
              />
              <Button
                onClick={addSubtask}
                disabled={!newSubtaskName.trim()}
                size="sm"
                className="px-4"
              >
                <Icon name="plus" className="h-4 w-4" />
              </Button>
            </div>

            {/* Subtasks list */}
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {formData.subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    subtask.completed
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={() => toggleSubtask(subtask.id)}
                    className="h-4 w-4 rounded text-green-600 focus:ring-green-500"
                  />
                  <span
                    className={`flex-1 text-sm ${
                      subtask.completed
                        ? 'line-through text-green-700'
                        : 'text-gray-700'
                    }`}
                  >
                    {subtask.name}
                  </span>
                  <button
                    onClick={() => removeSubtask(subtask.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Remove subtask"
                  >
                    <Icon name="x" className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {formData.subtasks.length === 0 && (
                <div className="text-sm text-gray-500 italic p-2 text-center">
                  No subtasks added yet
                </div>
              )}
            </div>
          </div>

          {/* Status (for existing activities) */}
          {!isNewActivity && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="overtime">Overtime</option>
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div>
            {!isNewActivity && (
              <Button
                variant="destructive"
                onClick={() => onDelete(activity.id)}
                className="mr-2"
              >
                <Icon name="trash" className="h-4 w-4 mr-2" />
                Delete Activity
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.name.trim()}
            >
              {isNewActivity ? 'Add Activity' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Standalone Flowmodoro Mode Component
const FlowmodoroMode = ({ 
  flowmodoroState,
  onTakeBreak,
  onSkipBreak,
  onReset,
  formatTime
}) => {
  const [customBreakMinutes, setCustomBreakMinutes] = useState(0);
  const [customBreakSeconds, setCustomBreakSeconds] = useState(0);
  const [showCustomInput, setShowCustomInput] = useState(false);

  const availableMinutes = Math.floor(flowmodoroState.availableRestTime / 60);
  const availableSeconds = flowmodoroState.availableRestTime % 60;
  const breakMinutes = Math.floor(flowmodoroState.breakTimeRemaining / 60);
  const breakSeconds = flowmodoroState.breakTimeRemaining % 60;
  
  const totalEarnedMinutes = Math.floor(flowmodoroState.totalEarnedToday / 60);
  const totalEarnedSeconds = flowmodoroState.totalEarnedToday % 60;

  const handleStartAllAvailableTime = () => {
    if (flowmodoroState.availableRestTime > 0) {
      onTakeBreak(flowmodoroState.availableRestTime);
    }
  };

  const handleStartCustomTime = () => {
    const customTime = (customBreakMinutes * 60) + customBreakSeconds;
    if (customTime > 0 && customTime <= flowmodoroState.availableRestTime) {
      onTakeBreak(customTime);
      setShowCustomInput(false);
      setCustomBreakMinutes(0);
      setCustomBreakSeconds(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-green-600 bg-clip-text text-transparent mb-2">
          🌟 Flowmodoro Mode
        </h2>
        <p className="text-gray-600 text-sm sm:text-base md:text-lg px-2">
          Dedicated timer for your earned break time. Use the rest time you've earned from working!
        </p>
      </div>

      {/* Current Break Timer */}
      {flowmodoroState.isOnBreak && (
        <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-green-50">
          <CardContent className="p-4 sm:p-6 md:p-8 text-center">
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Break in Progress</h3>
                <div className="text-4xl sm:text-6xl md:text-8xl font-mono font-bold text-purple-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(flowmodoroState.breakTimeRemaining)}
                </div>
                <div className="text-sm sm:text-base md:text-lg text-gray-600 mt-2">
                  Enjoy your well-earned break! 🌱
                </div>
              </div>
              
              <div className="flex justify-center">
                <Button 
                  onClick={onSkipBreak}
                  size="lg" 
                  className="w-full sm:w-auto sm:min-w-48 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                >
                  <Icon name="x" className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  <span className="hidden sm:inline">Skip Break & Return Time</span>
                  <span className="sm:hidden">Skip Break</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Time & Controls */}
      {!flowmodoroState.isOnBreak && (
        <Card className="border-2 border-green-200">
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
              <div className="text-center p-3 sm:p-4 md:p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                <div className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Available Break Time</div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-600">
                  {availableMinutes}m {availableSeconds}s
                </div>
                <div className="text-xs text-gray-500 mt-1">Ready to use</div>
              </div>
              <div className="text-center p-3 sm:p-4 md:p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
                <div className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Total Earned Today</div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-600">
                  {totalEarnedMinutes}m {totalEarnedSeconds}s
                </div>
                <div className="text-xs text-gray-500 mt-1">All work sessions</div>
              </div>
            </div>

            {flowmodoroState.availableRestTime > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:justify-center gap-2 md:gap-4">
                  <Button 
                    onClick={handleStartAllAvailableTime}
                    size="lg" 
                    className="w-full sm:w-auto sm:min-w-48 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    <Icon name="play" className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    <span className="hidden sm:inline">Use All Available Time</span>
                    <span className="sm:hidden">Use All Time</span>
                  </Button>
                  <Button 
                    onClick={() => setShowCustomInput(!showCustomInput)}
                    variant="outline"
                    size="lg" 
                    className="w-full sm:w-auto sm:min-w-48 border-2 border-blue-400 text-blue-600 hover:bg-blue-50"
                  >
                    <Icon name="settings" className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    <span className="hidden sm:inline">Custom Duration</span>
                    <span className="sm:hidden">Custom</span>
                  </Button>
                  <Button 
                    onClick={onReset}
                    variant="outline"
                    size="lg" 
                    className="w-full sm:w-auto sm:min-w-32 border-2 border-red-400 text-red-600 hover:bg-red-50 sm:col-span-2 md:col-span-1"
                    title="Reset all earned break time"
                  >
                    <Icon name="refresh" className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Reset
                  </Button>
                </div>

                {/* Custom Time Input */}
                {showCustomInput && (
                  <Card className="border-2 border-blue-300 bg-blue-50">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <h4 className="text-lg font-semibold text-blue-800">Custom Break Duration</h4>
                        <div className="flex items-center justify-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <label className="text-sm font-medium">Minutes:</label>
                            <Input
                              type="number"
                              min="0"
                              max={Math.floor(flowmodoroState.availableRestTime / 60)}
                              value={customBreakMinutes}
                              onChange={(e) => setCustomBreakMinutes(parseInt(e.target.value) || 0)}
                              className="w-16 text-center"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <label className="text-sm font-medium">Seconds:</label>
                            <Input
                              type="number"
                              min="0"
                              max="59"
                              value={customBreakSeconds}
                              onChange={(e) => setCustomBreakSeconds(parseInt(e.target.value) || 0)}
                              className="w-16 text-center"
                            />
                          </div>
                          <Button 
                            onClick={handleStartCustomTime}
                            disabled={customBreakMinutes === 0 && customBreakSeconds === 0}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Icon name="play" className="w-4 h-4 mr-2" />
                            Start
                          </Button>
                          <Button 
                            onClick={() => setShowCustomInput(false)}
                            variant="outline"
                            className="border-red-300 text-red-600"
                          >
                            <Icon name="x" className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-blue-600 text-center">
                          Maximum: {Math.floor(flowmodoroState.availableRestTime / 60)}m {flowmodoroState.availableRestTime % 60}s
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">⏰</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Break Time Available</h3>
                <p className="text-gray-600">
                  Work in Session, Daily, or Single mode to earn flowmodoro break time!
                </p>
                <div className="mt-4 text-sm text-gray-500">
                  Tip: The longer you work, the more break time you earn
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {!flowmodoroState.isOnBreak && (
        <Card className="border-2 border-gray-200 bg-gray-50">
          <CardContent className="p-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-3">How Flowmodoro Works</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div className="flex items-start space-x-2">
                <span className="text-green-600 font-bold">1.</span>
                <div>
                  <div className="font-medium">Earn Time</div>
                  <div>Work in any mode to accumulate break time based on your productivity</div>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-blue-600 font-bold">2.</span>
                <div>
                  <div className="font-medium">Use Time</div>
                  <div>Come here to take breaks using your earned time - all or custom amounts</div>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-purple-600 font-bold">3.</span>
                <div>
                  <div className="font-medium">Stay Fresh</div>
                  <div>Regular breaks help maintain focus and prevent burnout during long work sessions</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
const SingleActivityMode = ({ 
  singleState, 
  onStart, 
  onComplete, 
  onCancel, 
  flowmodoroState,
  formatTime,
  settings
}) => {
  const [activityName, setActivityName] = useState('');
  const [newActivityName, setNewActivityName] = useState('');
  const [currentElapsed, setCurrentElapsed] = useState(0);
  const [totalSessionTime, setTotalSessionTime] = useState(0); // Accumulated time across all chained activities
  const [currentChainLength, setCurrentChainLength] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showNewActivityInput, setShowNewActivityInput] = useState(false);

  // Update elapsed time in real-time
  useEffect(() => {
    if (singleState.isActive && singleState.startTime && !isPaused) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - singleState.startTime.getTime()) / 1000);
        setCurrentElapsed(elapsed);
        
        // Calculate total session time including previous activities in current chain
        const baseTime = singleState.chain.reduce((sum, activity, index) => {
          // Only count activities from current session (same chain streak)
          if (index >= singleState.chain.length - singleState.currentChainStreak) {
            return sum + activity.duration;
          }
          return sum;
        }, 0);
        setTotalSessionTime(baseTime + elapsed);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [singleState.isActive, singleState.startTime, isPaused, singleState.chain, singleState.currentChainStreak]);

  // Update current chain length
  useEffect(() => {
    setCurrentChainLength(singleState.currentChainStreak);
  }, [singleState.currentChainStreak]);

  // Calculate flowmodoro reward with chain multiplier and dynamic scaling
  const calculateFlowmodoroReward = (elapsedSeconds, chainMultiplier = 1) => {
    // Dynamic scaling based on task length - shorter tasks get better early rewards
    const taskLengthMinutes = Math.floor(elapsedSeconds / 60);
    
    // Base scaling from configured ratio to 1:1 over configured max progress time, but influenced by task patterns
    const maxSeconds = (settings?.flowmodoroMaxProgressMinutes || 30) * 60; // Configurable minutes cap
    const cappedSeconds = Math.min(elapsedSeconds, maxSeconds);
    
    // Calculate base reward with dynamic efficiency curve
    let totalReward = 0;
    for (let second = 1; second <= elapsedSeconds && second <= maxSeconds; second++) {
      const scaleFactor = second / maxSeconds;
      
      // Dynamic ratio based on task length patterns
      const baseConfigRatio = Math.max(1, Math.min(10, settings?.flowmodoroRatio || 5));
      let baseRatio = baseConfigRatio;
      if (taskLengthMinutes <= 5) {
        // Short tasks: Better early rewards (ratio-1:1 to 1:1)
        baseRatio = Math.max(1, (baseConfigRatio - 1) - ((baseConfigRatio - 2) * scaleFactor));
      } else if (taskLengthMinutes <= 15) {
        // Medium tasks: Standard scaling (ratio:1 to 1:1)
        baseRatio = Math.max(1, baseConfigRatio - ((baseConfigRatio - 1) * scaleFactor));
      } else {
        // Long tasks: Slower early rewards (ratio+1:1 to 1:1) 
        baseRatio = Math.max(1, (baseConfigRatio + 1) - (baseConfigRatio * scaleFactor));
      }
      
      totalReward += 1 / Math.max(baseRatio, 1.0);
    }
    
    // Add remaining seconds at 1:1 ratio if over 30 minutes
    if (elapsedSeconds > maxSeconds) {
      totalReward += (elapsedSeconds - maxSeconds);
    }
    
    // Chain multiplier with diminishing returns to prevent runaway accumulation
    const effectiveChain = Math.min(chainMultiplier, 10); // Cap chain at 10 for multiplier calculation
    const multiplier = 1 + (effectiveChain * 0.08 * Math.pow(0.95, effectiveChain)); // Diminishing returns
    
    // Additional bonus for chain diversity (different task lengths)
    const diversityBonus = chainMultiplier > 2 ? 1.1 : 1.0;
    
    return Math.floor(totalReward * multiplier * diversityBonus);
  };

  // Calculate current ratio with dynamic scaling
  const calculateCurrentRatio = (seconds, chainBonus = 0) => {
    const maxSeconds = (settings?.flowmodoroMaxProgressMinutes || 30) * 60; // Configurable minutes
    const cappedSeconds = Math.min(seconds, maxSeconds);
    const scaleFactor = cappedSeconds / maxSeconds;
    const taskLengthMinutes = Math.floor(seconds / 60);
    
    // Dynamic base ratio
    const baseConfigRatio = Math.max(1, Math.min(10, settings?.flowmodoroRatio || 5));
    let baseRatio = baseConfigRatio;
    if (taskLengthMinutes <= 5) {
      baseRatio = Math.max(1, (baseConfigRatio - 1) - ((baseConfigRatio - 2) * scaleFactor));
    } else if (taskLengthMinutes <= 15) {
      baseRatio = Math.max(1, baseConfigRatio - ((baseConfigRatio - 1) * scaleFactor));
    } else {
      baseRatio = Math.max(1, (baseConfigRatio + 1) - (baseConfigRatio * scaleFactor));
    }
    
    // Chain bonus with diminishing returns
    const effectiveChain = Math.min(chainBonus, 10);
    const improvement = effectiveChain * 0.05 * Math.pow(0.9, effectiveChain);
    
    return Math.max(baseRatio - improvement, 1.0);
  };

  const currentReward = calculateFlowmodoroReward(currentElapsed, currentChainLength);
  const currentRatio = calculateCurrentRatio(currentElapsed, currentChainLength);

  const handleStart = () => {
    if (activityName.trim()) {
      onStart(activityName.trim());
      setActivityName('');
    }
  };

  const handleNewActivity = () => {
    if (newActivityName.trim()) {
      // Complete current activity and immediately start new one (chaining)
      // IMPORTANT: Only reward the current activity's elapsed time, not the total session time
      const reward = calculateFlowmodoroReward(currentElapsed, currentChainLength); // Use current activity time only
      onComplete(reward, true, newActivityName.trim()); // Pass new activity name for chaining
      setNewActivityName('');
      setShowNewActivityInput(false);
      // Note: totalSessionTime continues accumulating, currentElapsed resets to 0 for new activity
    }
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleComplete = () => {
    const reward = calculateFlowmodoroReward(currentElapsed, currentChainLength);
    onComplete(reward);
    setIsPaused(false);
    setTotalSessionTime(0);
  };

  const handleCancel = () => {
    onCancel();
    setIsPaused(false);
    setTotalSessionTime(0);
  };

  const handleResetChain = () => {
    if (confirm('Reset flow chain? This will clear your current chain progress but keep any earned flowmodoro time.')) {
      // Reset chain but keep accumulated flowmodoro time
      onCancel(true); // Pass true to indicate chain reset only
      setIsPaused(false);
      setTotalSessionTime(0);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !singleState.isActive) {
      handleStart();
    }
  };

  const handleNewActivityKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleNewActivity();
    }
    if (e.key === 'Escape') {
      setShowNewActivityInput(false);
      setNewActivityName('');
    }
  };

  // Format time for display (hours:minutes:seconds for long durations)
  const formatElapsedTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  // Enhanced chain visualization with flow connection and task pattern analysis
  const renderEnhancedChain = () => {
    const recentChain = singleState.chain.slice(-8); // Show last 8 activities
    
    // Analyze task patterns for visual feedback
    const getTaskLengthCategory = (duration) => {
      const minutes = Math.floor(duration / 60);
      if (minutes <= 5) return { category: 'short', color: '#10b981', icon: '⚡' };
      if (minutes <= 15) return { category: 'medium', color: '#3b82f6', icon: '💎' };
      return { category: 'long', color: '#8b5cf6', icon: '🏆' };
    };
    
    return (
      <Card className="mt-4 sm:mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <CardTitle className="text-base sm:text-lg font-semibold">Flow Chain</CardTitle>
            <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
              <span>Chain: <span className="font-bold text-purple-600">{currentChainLength}</span></span>
              <span>Total: <span className="font-bold text-purple-600">{singleState.chain.length}</span></span>
              <span className="hidden sm:inline">Multiplier: <span className="font-bold text-green-600">{(1 + (Math.min(currentChainLength, 10) * 0.08 * Math.pow(0.95, currentChainLength))).toFixed(2)}x</span></span>
              {!singleState.isActive && singleState.chain.length > 0 && (
                <Button 
                  onClick={handleResetChain} 
                  variant="outline" 
                  size="sm"
                  className="border-purple-300 text-purple-600 hover:bg-purple-50 px-2 py-1 text-xs"
                  title="Reset chain but keep flowmodoro time"
                >
                  <Icon name="refresh" className="w-3 h-3 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="min-h-16 sm:min-h-20 p-2 sm:p-4 bg-gray-50 rounded-lg overflow-x-auto">
            {singleState.chain.length === 0 ? (
              <div className="text-center text-gray-500 italic py-4 sm:py-8">
                🔗 Start your first activity to begin building your Flow Chain!<br/>
                <span className="text-xs mt-2 block">Mix short & long tasks for optimal rewards</span>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-2">
                  {recentChain.map((activity, index) => {
                    const taskInfo = getTaskLengthCategory(activity.duration);
                    const isInCurrentChain = currentChainLength > index;
                    
                    return (
                      <div key={index} className="flex items-center flex-shrink-0">
                        <div
                          className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg transition-all duration-300 hover:scale-110 cursor-pointer relative"
                          style={{ 
                            background: `linear-gradient(135deg, ${taskInfo.color}, #06b6d4)`,
                            boxShadow: isInCurrentChain ? '0 0 15px rgba(139, 92, 246, 0.6)' : '0 0 8px rgba(139, 92, 246, 0.3)',
                            border: isInCurrentChain ? '2px solid #10b981' : '1px solid #e5e7eb'
                          }}
                          title={`${activity.name} - ${Math.floor(activity.duration / 60)}m ${activity.duration % 60}s (${taskInfo.category})`}
                        >
                          {taskInfo.icon}
                          {isInCurrentChain && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded-full text-[8px] sm:text-[10px] flex items-center justify-center">
                              ⚡
                            </div>
                          )}
                        </div>
                        {index < recentChain.length - 1 && (
                          <div 
                            className={`w-3 sm:w-4 md:w-6 h-0.5 sm:h-1 rounded mx-1 transition-all duration-300 ${
                              isInCurrentChain 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-400' 
                                : 'bg-gradient-to-r from-purple-300 to-blue-300'
                            }`} 
                          />
                        )}
                      </div>
                    );
                  })}
                  {singleState.chain.length > 8 && (
                    <div className="text-xs text-gray-500 ml-1 sm:ml-2 px-1 sm:px-2 py-1 bg-gray-200 rounded flex-shrink-0">
                      +{singleState.chain.length - 8}
                    </div>
                  )}
                </div>
                
                {/* Task pattern legend */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs text-gray-600 pt-2 border-t border-gray-200">
                  <div className="flex items-center gap-1 justify-center sm:justify-start">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500"></div>
                    <span className="text-[10px] sm:text-xs">⚡ Short (≤5m)</span>
                  </div>
                  <div className="flex items-center gap-1 justify-center sm:justify-start">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-blue-500"></div>
                    <span className="text-[10px] sm:text-xs">💎 Medium (6-15m)</span>
                  </div>
                  <div className="flex items-center gap-1 justify-center sm:justify-start">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-purple-500"></div>
                    <span className="text-[10px] sm:text-xs">🏆 Long (15m+)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
          Single Activity Mode
        </h2>
        <p className="text-gray-600 text-sm sm:text-base md:text-lg px-2">
          Continuous flow timer with activity chaining. Chain activities for better flowmodoro rewards!<br className="hidden sm:block"/>
          <span className="text-xs sm:text-sm text-green-600 font-medium">⚡ Dynamic scaling adapts to your task patterns!</span>
        </p>
      </div>

      {/* Task Input Section */}
      {!singleState.isActive && (
        <Card className="border-2 border-purple-200 hover:border-purple-300 transition-colors">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl text-gray-800">What are you working on?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <Input
                type="text"
                placeholder="Enter a quick task or activity..."
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 text-sm sm:text-base md:text-lg p-3 sm:p-4 border-2 focus:border-purple-400"
                maxLength={100}
                autoFocus
              />
              <Button 
                onClick={handleStart} 
                disabled={!activityName.trim()} 
                className="w-full sm:w-auto sm:min-w-36 text-sm sm:text-base md:text-lg px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                size="lg"
              >
                <Icon name="play" className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Start Activity
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timer Section */}
      {singleState.isActive && (
        <Card className="border-2 border-purple-300">
          <CardContent className="p-4 sm:p-6 md:p-8 text-center">
            <div className="space-y-4 sm:space-y-6 md:space-y-8">
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Current Activity</h3>
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600 min-h-8 sm:min-h-10 md:min-h-12 flex items-center justify-center px-2">
                  {singleState.activityName}
                </div>
                {currentChainLength > 0 && (
                  <div className="mt-2 text-xs sm:text-sm text-green-600 font-medium">
                    🔗 Chained #{currentChainLength + 1} • {(1 + (Math.min(currentChainLength, 10) * 0.08 * Math.pow(0.95, currentChainLength))).toFixed(2)}x Multiplier
                  </div>
                )}
              </div>
              
              <div className="relative">
                <div 
                  className={`text-4xl sm:text-6xl md:text-8xl font-mono font-bold transition-all duration-300 ${isPaused ? 'text-orange-500' : 'text-gray-900'}`}
                  style={{ 
                    fontVariantNumeric: 'tabular-nums',
                    textShadow: isPaused ? '0 0 20px rgba(249, 115, 22, 0.3)' : '0 0 20px rgba(139, 92, 246, 0.3)'
                  }}
                >
                  {formatElapsedTime(currentElapsed)}
                </div>
                {totalSessionTime > currentElapsed && (
                  <div className="text-sm sm:text-base md:text-lg text-purple-600 font-medium mt-2">
                    Total Flow: {formatElapsedTime(totalSessionTime)}
                  </div>
                )}
                {isPaused && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-orange-500 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-sm sm:text-base md:text-lg font-bold">
                      PAUSED
                    </div>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:justify-center gap-2 sm:gap-3">
                <Button 
                  onClick={handlePause} 
                  variant="outline" 
                  size="lg" 
                  className="w-full sm:w-auto sm:min-w-32 border-2 border-orange-400 text-orange-600 hover:bg-orange-50"
                >
                  <Icon name={isPaused ? "play" : "pause"} className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  {isPaused ? "Resume" : "Pause"}
                </Button>
                <Button 
                  onClick={() => setShowNewActivityInput(!showNewActivityInput)} 
                  variant="outline" 
                  size="lg" 
                  className="w-full sm:w-auto sm:min-w-48 border-2 border-blue-400 text-blue-600 hover:bg-blue-50"
                >
                  <Icon name="plus" className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  <span className="hidden sm:inline">Chain New Activity</span>
                  <span className="sm:hidden">Chain Activity</span>
                </Button>
                <Button 
                  onClick={handleComplete} 
                  size="lg" 
                  className="w-full sm:w-auto sm:min-w-48 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Icon name="check" className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  <span className="hidden sm:inline">Complete & Claim Reward</span>
                  <span className="sm:hidden">Complete</span>
                </Button>
                <Button 
                  onClick={handleResetChain} 
                  variant="outline" 
                  size="lg" 
                  className="w-full sm:w-auto sm:min-w-32 border-2 border-purple-400 text-purple-600 hover:bg-purple-50"
                  title="Reset chain progress but keep earned flowmodoro time"
                >
                  <Icon name="refresh" className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Reset Chain
                </Button>
                <Button 
                  onClick={handleCancel} 
                  variant="outline" 
                  size="lg" 
                  className="w-full sm:w-auto sm:min-w-32 border-2 border-red-400 text-red-600 hover:bg-red-50"
                >
                  <Icon name="x" className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Cancel
                </Button>
              </div>

              {/* New Activity Input (when chaining) */}
              {showNewActivityInput && (
                <Card className="border-2 border-blue-300 bg-blue-50">
                  <CardContent className="p-3 sm:p-4">
                    <div className="space-y-3">
                      <h4 className="text-base sm:text-lg font-semibold text-blue-800">Chain Next Activity</h4>
                      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                        <Input
                          type="text"
                          placeholder="Enter next activity..."
                          value={newActivityName}
                          onChange={(e) => setNewActivityName(e.target.value)}
                          onKeyPress={handleNewActivityKeyPress}
                          className="flex-1 border-2 border-blue-300 focus:border-blue-500"
                          maxLength={100}
                          autoFocus
                        />
                        <Button 
                          onClick={handleNewActivity} 
                          disabled={!newActivityName.trim()}
                          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                        >
                          <Icon name="arrowUpDown" className="w-4 h-4 mr-2" />
                          Chain
                        </Button>
                        <Button 
                          onClick={() => {
                            setShowNewActivityInput(false);
                            setNewActivityName('');
                          }} 
                          variant="outline"
                          className="w-full sm:w-auto border-red-300 text-red-600"
                        >
                          <Icon name="x" className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs sm:text-sm text-blue-600 text-center sm:text-left">
                        🔗 Chaining will keep your flow state and add a {(1 + ((Math.min(currentChainLength + 1, 10) * 0.08 * Math.pow(0.95, currentChainLength + 1)))).toFixed(2)}x multiplier bonus!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reward Progress Section */}
      <Card className="border-2 border-purple-200">
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="text-center p-3 sm:p-4 md:p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border-2 border-purple-200">
              <div className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Current Ratio</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600">{currentRatio.toFixed(1)}:1</div>
              <div className="text-xs text-gray-500 mt-1">Work : Rest</div>
              {currentChainLength > 0 && (
                <div className="text-xs text-green-600 font-bold mt-1">+Chain Bonus!</div>
              )}
            </div>
            <div className="text-center p-3 sm:p-4 md:p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
              <div className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Pending Reward</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">{Math.floor(currentReward / 60)}m {currentReward % 60}s</div>
              <div className="text-xs text-gray-500 mt-1">Flowmodoro time</div>
            </div>
            <div className="text-center p-3 sm:p-4 md:p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200 sm:col-span-2 md:col-span-1">
              <div className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Chain Multiplier</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-amber-600">
                {(1 + (Math.min(currentChainLength, 10) * 0.08 * Math.pow(0.95, currentChainLength))).toFixed(2)}x
              </div>
              <div className="text-xs text-gray-500 mt-1">Diminishing returns after 10</div>
              {currentChainLength > 2 && (
                <div className="text-xs text-green-600 font-bold mt-1">+Diversity Bonus!</div>
              )}
            </div>
          </div>
          
          <div className="space-y-2 sm:space-y-3">
            <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm text-gray-600 gap-1">
              <span className="font-medium">Flow Progress (Total: {formatElapsedTime(totalSessionTime)})</span>
              <span className="font-bold text-purple-600">{Math.min(100, (totalSessionTime / ((settings?.flowmodoroMaxProgressMinutes || 30) * 60)) * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 sm:h-4 overflow-hidden relative shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-green-400 rounded-full transition-all duration-500 relative"
                style={{ width: `${Math.min(100, (totalSessionTime / ((settings?.flowmodoroMaxProgressMinutes || 30) * 60)) * 100)}%` }}
              >
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-40"
                  style={{ 
                    animation: 'shimmer 2s infinite linear',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)'
                  }}
                />
              </div>
            </div>
            <div className="text-xs text-gray-500 text-center px-2">
              Chain activities to maintain flow state • Dynamic scaling adapts to task patterns • Progress reaches 100% at {settings?.flowmodoroMaxProgressMinutes || 30} minutes
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Flow Chain */}
      {renderEnhancedChain()}
      
      {/* Available Flowmodoro Time */}
      {flowmodoroState.availableRestTime > 0 && (
        <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardContent className="p-6 text-center">
            <div className="text-xl font-bold text-green-700 mb-2">
              🌟 Available Flowmodoro Time: {formatTime(flowmodoroState.availableRestTime)}
            </div>
            <p className="text-green-600">
              Switch to Session or Daily mode to use your earned break time
            </p>
          </CardContent>
        </Card>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `
      }} />
    </div>
  );
};

// --- Main Application Component ---
export default function App() {
  // Local date helper for rollover logic
  const getLocalDateStr = (d: Date = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const [activities, setActivities] = useState(() => {
    try {
      const savedActivities = localStorage.getItem('timeSliceActivities');
      if (savedActivities) {
        const parsed = JSON.parse(savedActivities);
        // Validate and sanitize loaded activities
        if (Array.isArray(parsed)) {
          return parsed.map(activity => ({
            ...activity,
            name: String(activity.name || "New Activity"), // Ensure name is always a string
            id: String(activity.id || Date.now()),
            percentage: Number(activity.percentage || 0),
            color: String(activity.color || "hsl(220, 70%, 50%)"),
            duration: Number(activity.duration || 0),
            timeRemaining: Number(activity.timeRemaining || 0),
            isCompleted: Boolean(activity.isCompleted),
            isLocked: Boolean(activity.isLocked),
            countUp: Boolean(activity.countUp || false),
            tags: activity.tags || [] // Ensure tags array exists
          }));
        }
      }
    } catch (e) {
      console.error("Failed to load activities from localStorage", e);
    }
    return [
      { id: "1", name: "Focus Work", percentage: 60, color: "hsl(220, 70%, 50%)", duration: 0, timeRemaining: 0, isCompleted: false, isLocked: false, countUp: false, tags: ['1'] },
      { id: "2", name: "Break", percentage: 40, color: "hsl(120, 60%, 50%)", duration: 0, timeRemaining: 0, isCompleted: false, isLocked: false, countUp: false, tags: ['2'] },
    ];
  });

  useEffect(() => {
    try {
      const inIframe = typeof window !== 'undefined' && window.top !== window.self;
  const isSecure = typeof window !== 'undefined' && Boolean(window.isSecureContext);
  const canUseSW = 'serviceWorker' in navigator && isSecure && !inIframe;
  const isProd = (import.meta as any)?.env?.PROD === true;

      if (canUseSW && isProd) {
        const swUrl = '/service-worker.js';
        navigator.serviceWorker.register(swUrl)
          .then(registration => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          })
          .catch(err => {
            console.log('ServiceWorker registration failed: ', err);
          });
      } else {
        console.log('Skipping ServiceWorker (prod only, secure context, not in iframe).', { canUseSW, isProd, inIframe, isSecure });
        // In dev or when embedded, proactively unregister any existing SW to avoid stale caches breaking preview
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations?.().then((regs) => {
            regs.forEach(reg => reg.unregister());
          }).catch(() => { /* noop */ });
        }
      }
    } catch (e) {
      console.log('Skipping ServiceWorker due to environment constraints.', e);
    }
  }, []);

  const [totalHours, setTotalHours] = useState(() => {
    try {
      const saved = localStorage.getItem('timeSliceTotalHours');
      return saved ? JSON.parse(saved) : 2;
    } catch (e) { return 2; }
  });

  const [totalMinutes, setTotalMinutes] = useState(() => {
    try {
      const saved = localStorage.getItem('timeSliceTotalMinutes');
      return saved ? JSON.parse(saved) : 0;
    } catch (e) { return 0; }
  });

  const [isTimerActive, setIsTimerActive] = useState(() => {
    try {
      const saved = localStorage.getItem('timeSliceSessionState');
      if (saved) {
        const sessionState = JSON.parse(saved);
        return sessionState.isTimerActive || false;
      }
    } catch (e) {
      console.error('Failed to load session state from localStorage:', e);
    }
    return false;
  });
  const [isPaused, setIsPaused] = useState(() => {
    try {
      const saved = localStorage.getItem('timeSliceSessionState');
      if (saved) {
        const sessionState = JSON.parse(saved);
        return sessionState.isPaused || false;
      }
    } catch (e) {
      console.error('Failed to load session state from localStorage:', e);
    }
    return false;
  });
  const [currentActivityIndex, setCurrentActivityIndex] = useState(() => {
    try {
      const saved = localStorage.getItem('timeSliceSessionState');
      if (saved) {
        const sessionState = JSON.parse(saved);
        return sessionState.currentActivityIndex || 0;
      }
    } catch (e) {
      console.error('Failed to load session state from localStorage:', e);
    }
    return 0;
  });
  const [showSettings, setShowSettings] = useState(false);
  // Removed colorPickerState - using simple random colors instead
  // Removed favoriteColors state - using simple random colors instead

  const [settings, setSettings] = useState(() => {
    const defaultValue = {
      showMainProgress: true,
      showOverallTime: true,
      showEndTime: true,
      showActivityTimer: true,
      showActivityProgress: false,
      activityProgressType: 'drain',
      keepScreenAwake: false,
      overtimeType: 'none',
      showAllocationPercentage: true,
      progressBarStyle: 'default',
      progressView: 'linear',
      showActivityTime: true, // NEW: toggle for activity time next to bar
      // Mobile optimization settings
      mobileZoomLevel: 'normal', // 'compact', 'normal', 'large'
      mobileCompactMode: false, // Show minimal UI for small screens
      // Simplified Flowmodoro settings
      flowmodoroEnabled: true,
      flowmodoroRatio: 5, // 5:1 ratio (5 minutes work = 1 minute rest)
      flowmodoroMaxProgressMinutes: 30, // Time in minutes for progress to reach maximum (default 30 minutes)
      flowmodoroShowProgress: true, // Toggle for flowmodoro progress bar
      flowmodoroProgressType: 'fill', // 'fill' or 'drain' like other activities
      flowmodoroResetStartTime: '06:00', // Daily reset at 6 AM
      flowmodoroResetEndTime: '23:59', // Daily reset at 11:59 PM
      // Daily Mode specific settings
      dailyShowActivityProgress: true, // Show progress bars in daily activity cards
      dailyActivityProgressType: 'fill', // 'fill' or 'drain'
      dailyTimelineAnimation: true, // Animate timeline activities (shrink/slide when running)
      // Auto-schedule settings
      autoScheduleBreakMinutes: 15, // Break time between auto-scheduled activities
  // UI toggles
  showTimeAllocationPanel: true,
  showTagChips: true,
  showRolloverIndicators: true,
    };
    try {
      const saved = localStorage.getItem('timeSliceSettings');
      return saved ? { ...defaultValue, ...JSON.parse(saved) } : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  });
  const [durationType, setDurationType] = useState('duration');
  const [endTime, setEndTime] = useState('23:30');
  const [vaultTime, setVaultTime] = useState(0);
  
  // Mode state - 'session', 'daily', 'single', or 'flowmodoro'
  const [currentMode, setCurrentMode] = useState('session');
  
  // Daily Mode State (Step 1: Basic daily activities) - Load from localStorage
  const [dailyActivities, setDailyActivities] = useState(() => {
    try {
      const saved = localStorage.getItem('timeSliceDailyActivities');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Restore Date objects for startedAt and ensure subtasks array exists
        return parsed.map((activity: any) => ({
          ...activity,
          startedAt: activity.startedAt ? new Date(activity.startedAt) : null,
          subtasks: activity.subtasks || [],
          tags: activity.tags || [] // Ensure tags array exists
        }));
      }
    } catch (e) {
      console.error('Failed to load daily activities from localStorage:', e);
    }
    
    // Default activities if nothing saved
    return [
      {
        id: 'work-1',
        name: 'Work',
        color: 'bg-blue-500',
        duration: 270, // minutes
        percentage: 18.8,
        status: 'scheduled', // 'scheduled', 'active', 'completed'
        isActive: false,
        timeSpent: 0,
        startedAt: null,
        subtasks: [],
        tags: ['1'] // Default to Work tag
      },
      {
        id: 'exercise-1', 
        name: 'Exercise',
        color: 'bg-green-500',
        duration: 105,
        percentage: 7.3,
        status: 'scheduled',
        isActive: false,
        timeSpent: 0,
        startedAt: null,
        subtasks: [],
        tags: ['2'] // Default to Health tag
      },
      {
        id: 'reading-1',
        name: 'Reading', 
        color: 'bg-purple-500',
        duration: 75,
        percentage: 5.2,
        status: 'scheduled',
        isActive: false,
        timeSpent: 0,
        startedAt: null,
        subtasks: [],
        tags: ['3'] // Default to Learning tag
      }
    ];
  });

  // Selected tag filters for list views
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState('');
  
  const [activeDailyActivity, setActiveDailyActivity] = useState(() => {
    try {
      const saved = localStorage.getItem('timeSliceActiveDailyActivity');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to load active daily activity from localStorage:', e);
      return null;
    }
  });
  
  // Timeline view toggle state
  const [timelineViewMode, setTimelineViewMode] = useState('scheduled'); // 'scheduled' or 'full'
  
  // Step 15: Activity Settings Modal State
  const [activitySettingsModal, setActivitySettingsModal] = useState({
    isOpen: false,
    activityId: null,
    activityData: null
  });

  // Daily Activity Edit Modal State
  const [dailyActivityEditModal, setDailyActivityEditModal] = useState({
    isOpen: false,
    activityId: null,
    activityData: null,
    isNewActivity: false
  });
  
  // Daily Mode Time State (Step 9: Live Time)
  const [currentTime, setCurrentTime] = useState(new Date());

  // Single Activity Mode State
  const [singleActivityState, setSingleActivityState] = useState(() => {
    try {
      const saved = localStorage.getItem('timeSliceSingleActivityState');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          startTime: parsed.startTime ? new Date(parsed.startTime) : null
        };
      }
    } catch (e) {
      console.error('Failed to load single activity state from localStorage:', e);
    }
    return {
      isActive: false,
      activityName: '',
      startTime: null,
      elapsedSeconds: 0,
      chain: [], // Array of completed activities with timestamps and rewards
      currentChainStreak: 0 // Current consecutive activities completed
    };
  });

  // Save single activity state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('timeSliceSingleActivityState', JSON.stringify(singleActivityState));
    } catch (e) {
      console.error('Failed to save single activity state to localStorage:', e);
    }
  }, [singleActivityState]);

  // Step 12: Update time spent for active activities
  useEffect(() => {
    if (currentMode === 'daily' && activeDailyActivity) {
      const interval = setInterval(() => {
        setDailyActivities(prev => prev.map(activity => {
          if (activity.isActive && activity.startedAt) {
            const timeSpentSeconds = Math.floor((Date.now() - (activity.startedAt as any).getTime()) / 1000);
            const currentSessionMinutes = Math.floor(timeSpentSeconds / 60);
            const totalTimeSpent = activity.timeSpent + currentSessionMinutes;
            
            // Check if activity has exceeded its planned duration
            if (totalTimeSpent >= activity.duration && activity.status !== 'overtime') {
              // Mark as overtime instead of auto-completing
              return { 
                ...activity, 
                status: 'overtime'
              };
            }
            
            // Just return activity without updating timeSpent until completion
            // The display will show totalTimeSpent but we won't save it until done
            return activity;
          }
          return activity;
        }));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [currentMode, activeDailyActivity]);

  // Helper function to get real-time timeSpent for display
  const getRealTimeSpent = (activity) => {
    if (activity.isActive && activity.startedAt) {
      const currentSessionSeconds = Math.floor((Date.now() - (activity.startedAt as any).getTime()) / 1000);
      const currentSessionMinutes = Math.floor(currentSessionSeconds / 60);
      return activity.timeSpent + currentSessionMinutes;
    }
    return activity.timeSpent;
  };

  // Helper function to get real-time timeSpent in seconds for countdown display
  const getRealTimeSpentInSeconds = (activity) => {
    if (activity.isActive && activity.startedAt) {
      const currentSessionSeconds = Math.floor((Date.now() - (activity.startedAt as any).getTime()) / 1000);
      return (activity.timeSpent * 60) + currentSessionSeconds;
    }
    return activity.timeSpent * 60; // Convert minutes to seconds
  };

  // Step 14: Calculate real-time timeline position for sliding animation
  const getActiveActivityTimelinePosition = () => {
    const activeActivity = dailyActivities.find(a => a.isActive && a.startedAt);
    
    // Calculate remaining minutes until day reset (0:30)
    const now = new Date();
    const totalRemainingMinutes = 24 * 60 - (now.getHours() * 60 + now.getMinutes()) + 30;
    
    if (!activeActivity || !activeActivity.startedAt) return { width: 0, consumed: 0, totalRemainingMinutes, consumedWidth: 0 };
    
    const currentSessionSeconds = Math.floor((Date.now() - (activeActivity.startedAt as any).getTime()) / 1000);
    const currentSessionMinutes = Math.floor(currentSessionSeconds / 60);
    const totalElapsed = activeActivity.timeSpent + currentSessionMinutes;
    const consumedPercentage = Math.min((totalElapsed / activeActivity.duration) * 100, 100);
    
    // Calculate width as percentage of total remaining day time
    const activityWidthInDay = (activeActivity.duration / totalRemainingMinutes) * 100;
    const consumedWidthInDay = (totalElapsed / totalRemainingMinutes) * 100;
    const remainingActivityWidth = Math.max(activityWidthInDay - consumedWidthInDay, 0);
    
    // Step 16: Handle overtime - extend beyond planned duration
    if (totalElapsed > activeActivity.duration) {
      const overtimeMinutes = totalElapsed - activeActivity.duration;
      const overtimeWidthInDay = (overtimeMinutes / totalRemainingMinutes) * 100;
      const totalWidthInDay = activityWidthInDay + overtimeWidthInDay;
      
      return { 
        width: Math.min(totalWidthInDay, 100), 
        consumed: 100,
        timeRemaining: 0,
        isOvertime: true,
        overtimeMinutes: overtimeMinutes,
        consumedWidth: activityWidthInDay,
        totalRemainingMinutes
      };
    }
    
    return { 
      width: remainingActivityWidth, 
      consumed: consumedPercentage,
      timeRemaining: Math.max(activeActivity.duration - totalElapsed, 0),
      isOvertime: false,
      overtimeMinutes: 0,
      consumedWidth: consumedWidthInDay,
      totalRemainingMinutes
    };
  };
  
  const [borrowModalState, setBorrowModalState] = useState({ isOpen: false, activityId: '' });
  
  // Siphon Modal State (NEW)
  const [siphonModalState, setSiphonModalState] = useState({ 
    isOpen: false, 
    sourceActivityId: '', 
    targetActivityId: '', 
    targetIsVault: false 
  });

  // Debug modal state changes
  useEffect(() => {
    console.log('Siphon modal state changed:', siphonModalState);
    if (siphonModalState.isOpen) {
      console.log('Modal should be visible now!');
    }
  }, [siphonModalState]);

  // Add Activity Modal State (NEW)
  const [addActivityModalState, setAddActivityModalState] = useState({ isOpen: false });

  // Navigation State for Activity Management Page
  const [currentPage, setCurrentPage] = useState('timer'); // 'timer', 'manage-activities', 'spider'

  // RPG Tags State (NEW)
  const [rpgTags, setRpgTags] = useState<RPGTag[]>(() => {
    const defaultTags: RPGTag[] = [
      { id: '1', name: 'Work', color: '#3b82f6', description: 'Professional development and career', createdAt: new Date(), overallProgress: 0, totalLifetimeMinutes: 0 },
      { id: '2', name: 'Health', color: '#10b981', description: 'Physical and mental wellbeing', createdAt: new Date(), overallProgress: 0, totalLifetimeMinutes: 0 },
      { id: '3', name: 'Learning', color: '#8b5cf6', description: 'Education and skill development', createdAt: new Date(), overallProgress: 0, totalLifetimeMinutes: 0 },
      { id: '4', name: 'Social', color: '#f59e0b', description: 'Relationships and social activities', createdAt: new Date(), overallProgress: 0, totalLifetimeMinutes: 0 },
      { id: '5', name: 'Creative', color: '#ef4444', description: 'Art, music, and creative pursuits', createdAt: new Date(), overallProgress: 0, totalLifetimeMinutes: 0 },
      { id: '6', name: 'Spiritual', color: '#06b6d4', description: 'Meditation, reflection, and spiritual growth', createdAt: new Date(), overallProgress: 0, totalLifetimeMinutes: 0 }
    ];
    
    try {
      const saved = localStorage.getItem('timeSliceRPGTags');
      return saved ? JSON.parse(saved).map(tag => ({
        ...tag,
        createdAt: new Date(tag.createdAt),
        overallProgress: tag.overallProgress || 0,
        totalLifetimeMinutes: tag.totalLifetimeMinutes || 0
      })) : defaultTags;
    } catch (e) {
      return defaultTags;
    }
  });

  // Activity Templates State (NEW)
  const [activityTemplates, setActivityTemplates] = useState<ActivityTemplate[]>(() => {
    const defaultTemplates: ActivityTemplate[] = [
      { id: '1', name: 'Focus Work', color: 'hsl(220, 70%, 50%)' },
      { id: '2', name: 'Break', color: 'hsl(120, 60%, 50%)' },
      { id: '3', name: 'Exercise', color: 'hsl(0, 70%, 50%)' },
      { id: '4', name: 'Reading', color: 'hsl(280, 60%, 50%)' },
      { id: '5', name: 'Meeting', color: 'hsl(40, 80%, 50%)' }
    ];
    
    try {
      const saved = localStorage.getItem('timeSliceActivityTemplates');
      return saved ? JSON.parse(saved) : defaultTemplates;
    } catch (e) {
      return defaultTemplates;
    }
  });

  // Save activity templates to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('timeSliceActivityTemplates', JSON.stringify(activityTemplates));
    } catch (e) {
      console.error('Failed to save activity templates to localStorage:', e);
    }
  }, [activityTemplates]);

  // Global Categories/Tags used across app (persisted)
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('timeSliceCustomCategories');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [customTags, setCustomTags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('timeSliceCustomTags');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try { localStorage.setItem('timeSliceCustomCategories', JSON.stringify(customCategories)); } catch {}
  }, [customCategories]);
  useEffect(() => {
    try { localStorage.setItem('timeSliceCustomTags', JSON.stringify(customTags)); } catch {}
  }, [customTags]);

  // Tag input autocomplete state (for pre-session panel)
  const [tagFocusId, setTagFocusId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState<string>('');
  const [tagActiveIndex, setTagActiveIndex] = useState<number>(0);
  const allKnownTags = React.useMemo(
    () => {
      // Merge tags from custom list, templates, and any activities to ensure full coverage
      const merged = [
        ...(customTags || []),
        ...activityTemplates.flatMap(t => t.tags || []),
        ...activities.flatMap(a => a.tags || []),
      ]
        .filter(Boolean)
        .map(t => (typeof t === 'string' ? t.trim().toLowerCase() : String(t)))
        .filter(Boolean);
      return Array.from(new Set(merged));
    },
    [customTags, activityTemplates, activities]
  );

  // Helpers
  const upsertCategory = useCallback((name: string) => {
    const v = name.trim().toLowerCase();
    if (!v) return;
    setCustomCategories(prev => prev.includes(v) ? prev : [...prev, v]);
  }, []);
  const upsertTag = useCallback((name: string) => {
    const v = name.trim().toLowerCase();
    if (!v) return;
    setCustomTags(prev => prev.includes(v) ? prev : [...prev, v]);
  }, []);
  const updateActivityCategory = useCallback((activityId: string, category?: string) => {
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, category } : a));
  }, [setActivities]);
  const updateActivityTags = useCallback((activityId: string, tags: string[]) => {
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, tags } : a));
  }, [setActivities]);

  const applyTagSuggestion = useCallback((activityId: string, suggestion: string) => {
    // Replace the last token with suggestion
    const raw = tagDraft;
    const parts = raw.split(',').map(s => s.trim()).filter(() => true);
    if (parts.length === 0) {
      setTagDraft(suggestion);
      updateActivityTags(activityId, [suggestion]);
      return;
    }
    parts[parts.length - 1] = suggestion;
    const cleaned = Array.from(new Set(parts.filter(Boolean).map(s => s.toLowerCase())));
    setTagDraft(cleaned.join(', '));
    updateActivityTags(activityId, cleaned);
  }, [tagDraft, updateActivityTags]);

  // Any time an activity gains category/tags, ensure there's a matching template for later reuse
  useEffect(() => {
    activities.forEach(a => {
      if ((a.category && a.category.length) || (a.tags && a.tags.length)) {
        const existing = activityTemplates.find(t => t.name.toLowerCase() === a.name.toLowerCase());
        const payload: ActivityTemplate = {
          id: existing?.id || `tpl-${a.name.toLowerCase()}`,
          name: a.name,
          color: a.color,
          category: a.category,
          tags: a.tags || [],
        };
        if (existing) {
          setActivityTemplates(prev => prev.map(t => t.id === existing.id ? { ...t, ...payload } : t));
        } else {
          setActivityTemplates(prev => [...prev, payload]);
        }
      }
    });
  }, [activities]);
  const saveActivityQuick = useCallback((activityId: string) => {
    const a = activities.find(x => x.id === activityId);
    if (!a) return;
    // Save as template for later reuse (include category/tags)
    const existing = activityTemplates.find(t => t.name.toLowerCase() === a.name.toLowerCase());
    const payload: ActivityTemplate = {
      id: existing?.id || Date.now().toString(),
      name: a.name,
      color: a.color,
      category: a.category,
      tags: a.tags || [],
    };
    if (existing) {
      setActivityTemplates(prev => prev.map(t => t.id === existing.id ? { ...t, ...payload } as ActivityTemplate : t));
    } else {
      setActivityTemplates(prev => [...prev, payload]);
    }
  }, [activities, activityTemplates, setActivityTemplates]);

  // Save RPG tags to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('timeSliceRPGTags', JSON.stringify(rpgTags));
    } catch (e) {
      console.error('Failed to save RPG tags to localStorage:', e);
    }
  }, [rpgTags]);

  // Helper function to sync progress between shared activities
  const syncSharedProgress = useCallback((updatedActivity: Activity, isSessionActivity: boolean) => {
    if (!updatedActivity.sharedId) return;
    const sharedId = updatedActivity.sharedId;

    if (isSessionActivity) {
      // Compute current total elapsed seconds across all session activities with this sharedId
      const totalSessionElapsedSec = activities
        .filter(sa => sa.sharedId === sharedId)
        .reduce((sum, sa) => {
          // If completed with preserved elapsed, prefer that for accuracy
          if (sa.isCompleted && Number.isFinite(sa.completedElapsedSeconds)) {
            return sum + Math.max(0, sa.completedElapsedSeconds || 0);
          }
          if (sa.countUp) {
            return sum + Math.max(0, sa.timeRemaining || 0);
          }
          // Compute planned seconds for this session based on current duration settings
          const sessionMinutes = (() => {
            if (durationType === 'endTime') {
              const now = new Date();
              const [endHour, endMinute] = endTime.split(':').map(Number);
              const endDate = new Date();
              endDate.setHours(endHour, endMinute, 0, 0);
              if (endDate < now) endDate.setDate(endDate.getDate() + 1);
              return Math.max(0, Math.round((endDate.getTime() - now.getTime()) / 60000));
            }
            return totalHours * 60 + totalMinutes;
          })();
          const totalSessionSeconds = sessionMinutes * 60;
          let planned = 0;
          if (sa.percentage && sa.percentage > 0) planned = (sa.percentage / 100) * totalSessionSeconds;
          else if (sa.duration && sa.duration > 0) planned = sa.duration * 60;
          const tr = sa.timeRemaining;
          if (typeof tr === 'number') {
            const elapsed = tr >= 0 ? Math.max(0, planned - tr) : planned + Math.abs(tr);
            return sum + elapsed;
          }
          return sum;
        }, 0);

      const prevSnapshot = sharedElapsedSnapshotRef.current[sharedId] || 0;
      const deltaSec = Math.max(0, Math.floor(totalSessionElapsedSec - prevSnapshot));
      // Update snapshot immediately to avoid double-adding
      sharedElapsedSnapshotRef.current[sharedId] = Math.max(prevSnapshot, totalSessionElapsedSec);

      if (deltaSec <= 0) return;

      const deltaMin = deltaSec / 60; // allow fractional minutes
      setDailyActivities(prev => prev.map(dailyActivity => {
        if (dailyActivity.sharedId !== sharedId) return dailyActivity;
        const targetDuration = Math.max(0, dailyActivity.duration || 0);
        const currentSpent = Number.isFinite(dailyActivity.timeSpent) ? (dailyActivity.timeSpent || 0) : 0;
        const newSpent = Math.min(targetDuration, currentSpent + deltaMin);
        return {
          ...dailyActivity,
          timeSpent: newSpent,
          status: newSpent >= targetDuration ? 'completed' : (newSpent > 0 ? 'active' : (dailyActivity.status || 'scheduled')),
        };
      }));
    } else {
      // Daily -> Session: only apply monotonic progress (never increase timeRemaining or clear session data)
      setActivities(prev => prev.map(sessionActivity => {
        if (sessionActivity.sharedId !== sharedId) return sessionActivity;
        const durationMin = Math.max(0, sessionActivity.duration || 0);
        const desiredProgressPct = durationMin > 0 ? ((updatedActivity.timeSpent || 0) / durationMin) * 100 : 0;
        const desiredRemainingSec = Math.max(0, Math.round((1 - Math.min(1, desiredProgressPct / 100)) * durationMin * 60));
        const currentRemainingSec = Math.max(0, Math.round(sessionActivity.timeRemaining || 0));
        const nextRemaining = Math.min(currentRemainingSec, desiredRemainingSec); // only move forward (reduce remaining)
        return {
          ...sessionActivity,
          isCompleted: updatedActivity.status === 'completed' || nextRemaining === 0 ? true : sessionActivity.isCompleted,
          timeRemaining: nextRemaining,
        };
      }));
    }
  }, [activities, durationType, endTime, totalHours, totalMinutes]);

  // Helper function to check if a template should be active based on recurring schedule
  const isTemplateActiveToday = useCallback((template: ActivityTemplate, currentDate: Date) => {
    // If no recurring schedule, only check time windows
    if (!template.recurring || template.recurring.type === 'none') {
      return false;
    }

    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    const dayOfMonth = currentDate.getDate();
    const monthDay = `${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;

    switch (template.recurring.type) {
      case 'every-day':
        return true;

      case 'specific-days-week':
        return template.recurring.daysOfWeek?.includes(dayOfWeek) || false;

      case 'specific-days-month':
        return template.recurring.daysOfMonth?.includes(dayOfMonth) || false;

      case 'specific-days-year':
        return template.recurring.daysOfYear?.includes(monthDay) || false;

      case 'interval':
        // Simple interval logic - could be enhanced with a start date
        const daysSinceEpoch = Math.floor(currentDate.getTime() / (1000 * 60 * 60 * 24));
        return daysSinceEpoch % (template.recurring.intervalDays || 1) === 0;

      case 'repeat':
        // Similar to interval but with different semantics
        const daysSinceEpoch2 = Math.floor(currentDate.getTime() / (1000 * 60 * 60 * 24));
        const interval = template.recurring.repeatDays || 2;
        
        if (template.recurring.alternatesDays) {
          // Alternate days logic
          return daysSinceEpoch2 % 2 === 0;
        }
        
        return daysSinceEpoch2 % interval === 0;

      default:
        return false;
    }
  }, []);

  // Time window activity syncing function
  const syncTimeWindowActivities = useCallback(() => {
    const now = new Date();
    const currentTimeStr = now.toTimeString().slice(0, 5); // HH:MM format
    
    // Check which templates should be active now based on both time windows and recurring schedules
    const activeTemplates = activityTemplates.filter(template => {
      // First check if it's scheduled for today based on recurring pattern
      const isScheduledToday = isTemplateActiveToday(template, now);
      
      // If it has time windows, also check if current time is within the window
      if (template.startTime && template.endTime && !template.isAllDay) {
        const start = template.startTime;
        const end = template.endTime;
        let isInTimeWindow = false;
        
        if (start <= end) {
          // Same day window (e.g., 09:00 - 17:00)
          isInTimeWindow = currentTimeStr >= start && currentTimeStr <= end;
        } else {
          // Overnight window (e.g., 22:00 - 06:00)
          isInTimeWindow = currentTimeStr >= start || currentTimeStr <= end;
        }
        
        return isScheduledToday && isInTimeWindow;
      }
      
      // For all-day activities or activities without time windows, just check if scheduled today
      if (template.isAllDay || (!template.startTime && !template.endTime)) {
        return isScheduledToday;
      }
      
      return false;
    });

    // For session mode - add missing templates to activities
    if (currentMode === 'session') {
      const existingActivityNames = activities.map(a => a.name.toLowerCase());
      
      activeTemplates.forEach(template => {
        const templateNameLower = template.name.toLowerCase();
        if (!existingActivityNames.includes(templateNameLower)) {
          // Add template as new activity to session
          const duration = template.presetDuration || 60; // Use preset duration or default 1 hour
          const newActivity = {
            id: `activity-${Date.now()}-${Math.random()}`,
            name: template.name,
            color: template.color,
            duration: duration,
            percentage: 0,
            timeRemaining: duration * 60, // Convert minutes to seconds
            isCompleted: false,
            isLocked: false,
            countUp: false,
            tags: template.tags
          };
          
          setActivities(prev => [...prev, newActivity]);
          console.log(`Auto-added recurring activity from template: ${template.name} (${duration}m)`);
        }
      });
    }

    // For daily mode - add missing templates to daily activities
    if (currentMode === 'daily') {
      const existingDailyActivityNames = dailyActivities.map(a => a.name.toLowerCase());
      
      activeTemplates.forEach(template => {
        const templateNameLower = template.name.toLowerCase();
        if (!existingDailyActivityNames.includes(templateNameLower)) {
          // Check if this is a flexible recurring activity that was already completed today
          const wasCompletedToday = template.recurring?.isFlexible && 
            dailyActivities.some(a => 
              a.name.toLowerCase() === templateNameLower && 
              a.status === 'completed'
            );
          
          // Skip adding if it was already completed today and is flexible
          if (wasCompletedToday) {
            return;
          }
          
          // Add template as new daily activity
          const duration = template.presetDuration || (template.isAllDay ? 120 : 60); // Use preset or smart default
          const percentage = (duration / (24 * 60)) * 100;
          
          const newDailyActivity = {
            id: `activity-${Date.now()}-${Math.random()}`,
            name: template.name,
            color: template.color,
            duration: duration,
            percentage: Math.round(percentage * 10) / 10,
            status: 'scheduled',
            isActive: false,
            timeSpent: 0,
            startedAt: null,
            subtasks: [],
            tags: template.tags
          };
          
          setDailyActivities(prev => [...prev, newDailyActivity]);
          console.log(`Auto-added recurring daily activity from template: ${template.name} (${duration}m)`);
        }
      });
    }
  }, [activityTemplates, activities, dailyActivities, currentMode, isTemplateActiveToday]);

  // Update current time every second for Daily Mode and sync time-window activities
  useEffect(() => {
    if (currentMode === 'daily') {
      const interval = setInterval(() => {
        setCurrentTime(new Date());
        // Check for time-window activities every minute (when seconds are 0)
        const now = new Date();
        if (now.getSeconds() === 0) {
          syncTimeWindowActivities();
        }
      }, 1000);
      return () => clearInterval(interval);
    } else if (currentMode === 'session') {
      // For session mode, check time-window activities once when switching to session mode
      // and then every 5 minutes
      syncTimeWindowActivities();
      const interval = setInterval(() => {
        syncTimeWindowActivities();
      }, 5 * 60 * 1000); // Every 5 minutes
      return () => clearInterval(interval);
    }
  }, [currentMode, syncTimeWindowActivities]);

  // Helper function to check if flowmodoro should reset
  const checkIfShouldReset = (currentTime, lastResetTime) => {
    const startTime = settings.flowmodoroResetStartTime.split(':').map(Number);
    const endTime = settings.flowmodoroResetEndTime.split(':').map(Number);
    
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    
    const startTotalMinutes = startTime[0] * 60 + startTime[1];
    const endTotalMinutes = endTime[0] * 60 + endTime[1];
    
    // Different day = reset
    if (currentTime.toDateString() !== lastResetTime.toDateString()) {
      return true;
    }
    
    // Check if current time is at reset boundaries
    if (currentTotalMinutes === startTotalMinutes || currentTotalMinutes === endTotalMinutes) {
      return true;
    }
    
    return false;
  };

  // Add flowmodoro state
  const [flowmodoroState, setFlowmodoroState] = useState(() => {
    try {
      const saved = localStorage.getItem('timeSliceFlowmodoro');
      const defaultState = {
        availableRestTime: 0, // in seconds
        availableRestMinutes: 0, // in minutes (calculated from availableRestTime)
        totalEarnedToday: 0, // Total earned rest time today
        cycleCount: 0,
        isOnBreak: false,
        breakTimeRemaining: 0,
        initialBreakDuration: 0, // Track original break duration for progress calculation
        lastResetDate: new Date().toDateString(), // Track when last reset occurred
        accumulatedFractionalTime: 0, // Track fractional seconds for accurate ratio calculation
      };
      
      if (saved) {
        const parsed = JSON.parse(saved);
        // Check if we need to reset based on time
        const now = new Date();
        const lastReset = new Date(parsed.lastResetDate || now.toDateString());
        const shouldReset = checkIfShouldReset(now, lastReset);
        
        if (shouldReset) {
          return {
            ...defaultState,
            lastResetDate: now.toDateString()
          };
        }
        
        return { ...defaultState, ...parsed };
      }
      
      return defaultState;
    } catch (e) {
      return {
        availableRestTime: 0,
        totalEarnedToday: 0,
        cycleCount: 0,
        isOnBreak: false,
        breakTimeRemaining: 0,
        initialBreakDuration: 0,
        lastResetDate: new Date().toDateString(),
        accumulatedFractionalTime: 0,
      };
    }
  });

  // Siphon Time functionality (NEW)
  const siphonTime = (sourceActivityId, targetActivityId, amount, targetIsVault = false) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    // Protect against modifying completed or count-up activities
    const src = activities.find(a => a.id === sourceActivityId);
    const tgt = activities.find(a => a.id === targetActivityId);

    if (!targetIsVault && targetActivityId !== 'vault') {
      if (tgt && (tgt.isCompleted || tgt.countUp)) return; // don't add to completed or count-up
    }
    if (sourceActivityId !== 'vault') {
      if (src && (src.isCompleted || src.countUp)) return; // don't siphon from completed or count-up
    }

    if (targetIsVault) {
      setActivities(prev => prev.map(act => {
        if (act.id === sourceActivityId) {
          if (act.isCompleted || act.countUp) return act; // Do not modify preserved or count-up
          return { ...act, timeRemaining: Math.max(0, (act.timeRemaining || 0) - amount) };
        }
        return act;
      }));
      setVaultTime(prev => prev + amount);
    } else if (sourceActivityId === 'vault') {
      const actualAmount = Math.min(amount, vaultTime);
      if (actualAmount <= 0) return;
      setVaultTime(prev => prev - actualAmount);
      setActivities(prev => prev.map(act => {
        if (act.id === targetActivityId) {
          if (act.isCompleted || act.countUp) return act; // Do not add to preserved or count-up
          return { ...act, timeRemaining: (act.timeRemaining || 0) + actualAmount };
        }
        return act;
      }));
    } else {
      setActivities(prev => prev.map(act => {
        if (act.id === sourceActivityId) {
          if (act.isCompleted || act.countUp) return act;
          return { ...act, timeRemaining: Math.max(0, (act.timeRemaining || 0) - amount) };
        }
        if (act.id === targetActivityId) {
          if (act.isCompleted || act.countUp) return act;
          return { ...act, timeRemaining: (act.timeRemaining || 0) + amount };
        }
        return act;
      }));
    }
  };

  // Simplified flowmodoro functions
  const takeFlowmodoroBreak = (duration) => {
    if (!settings.flowmodoroEnabled || flowmodoroState.availableRestTime <= 0) return;
    
    const breakDuration = Math.min(duration, flowmodoroState.availableRestTime);
    
    setFlowmodoroState(prev => ({
      ...prev,
      isOnBreak: true,
      breakTimeRemaining: breakDuration,
      initialBreakDuration: breakDuration, // Store initial duration for progress calculation
      availableRestTime: prev.availableRestTime - breakDuration
    }));
    
    // Don't stop the main timer - flowmodoro break runs alongside the session
    // The break timer is handled separately in handleTimerTick
  };

  const skipFlowmodoroBreak = () => {
    setFlowmodoroState(prev => ({
      ...prev,
      isOnBreak: false,
      availableRestTime: prev.availableRestTime + prev.breakTimeRemaining, // Return unused time
      breakTimeRemaining: 0,
      initialBreakDuration: 0
    }));
  };

  const resetFlowmodoroState = () => {
    setFlowmodoroState(prev => ({
      ...prev,
      availableRestTime: 0,
      cycleCount: 0,
      isOnBreak: false,
      breakTimeRemaining: 0,
      initialBreakDuration: 0,
      accumulatedFractionalTime: 0
    }));
  };

  // Single Activity Mode handlers
  const startSingleActivity = (activityName) => {
    setSingleActivityState(prev => ({
      ...prev,
      isActive: true,
      activityName,
      startTime: new Date(),
      elapsedSeconds: 0
    }));
  };

  const completeSingleActivity = (rewardSeconds, isChaining = false, newActivityName = '') => {
    const completedActivity = {
      name: singleActivityState.activityName,
      reward: rewardSeconds,
      completedAt: new Date(),
      duration: Math.floor((Date.now() - singleActivityState.startTime.getTime()) / 1000)
    };

    setSingleActivityState(prev => {
      const newChain = [...prev.chain, completedActivity];
      
      // Calculate streak (consecutive activities within reasonable time gaps)
      let streak = 1;
      for (let i = newChain.length - 2; i >= 0; i--) {
        const timeDiff = (new Date(newChain[i + 1].completedAt).getTime() - new Date(newChain[i].completedAt).getTime()) / (1000 * 60); // minutes
        if (timeDiff <= 120) { // Within 2 hours = continue streak
          streak++;
        } else {
          break;
        }
      }

      // If chaining, immediately start the new activity
      if (isChaining && newActivityName.trim()) {
        return {
          ...prev,
          isActive: true,
          activityName: newActivityName.trim(),
          startTime: new Date(), // Start new activity immediately
          elapsedSeconds: 0,
          chain: newChain,
          currentChainStreak: streak
        };
      }

      // If not chaining, complete the session
      return {
        ...prev,
        isActive: false,
        activityName: '',
        startTime: null,
        elapsedSeconds: 0,
        chain: newChain,
        currentChainStreak: streak
      };
    });

    // Add flowmodoro reward
    setFlowmodoroState(prev => ({
      ...prev,
      availableRestTime: prev.availableRestTime + rewardSeconds,
      totalEarnedToday: prev.totalEarnedToday + rewardSeconds
    }));
  };

  const cancelSingleActivity = (chainResetOnly = false) => {
    setSingleActivityState(prev => ({
      ...prev,
      isActive: false,
      activityName: '',
      startTime: null,
      elapsedSeconds: 0,
      // If chain reset only, reset current streak but keep chain history
      currentChainStreak: chainResetOnly ? 0 : prev.currentChainStreak,
      // If full cancel, reset everything
      ...(chainResetOnly ? {} : { chain: [], currentChainStreak: 0 })
    }));
  };

  // --- Start of State Saving Logic ---
  useEffect(() => {
    try {
      localStorage.setItem('timeSliceActivities', JSON.stringify(activities));
    } catch (e) {
      console.error("Failed to save activities", e);
    }
  }, [activities]);

  // Save session state to localStorage
  useEffect(() => {
    try {
      const sessionState = {
        isTimerActive,
        isPaused,
        currentActivityIndex,
        lastActiveTimestamp: isTimerActive && !isPaused ? Date.now() : null
      };
      localStorage.setItem('timeSliceSessionState', JSON.stringify(sessionState));
    } catch (e) {
      console.error('Failed to save session state to localStorage:', e);
    }
  }, [isTimerActive, isPaused, currentActivityIndex]);

  // Save flowmodoro state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('timeSliceFlowmodoro', JSON.stringify(flowmodoroState));
    } catch (e) {
      console.error('Failed to save flowmodoro state to localStorage:', e);
    }
  }, [flowmodoroState]);

  useEffect(() => {
    try {
      localStorage.setItem('timeSliceSettings', JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  }, [settings]);

  // Save daily activities to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('timeSliceDailyActivities', JSON.stringify(dailyActivities));
    } catch (e) {
      console.error('Failed to save daily activities to localStorage:', e);
    }
  }, [dailyActivities]);

  // Initialize scheduledDate and rollover flag for existing items on first load
  useEffect(() => {
    const today = getLocalDateStr();
    setDailyActivities(prev => prev.map(a => ({
      ...a,
      scheduledDate: a.scheduledDate || today,
      rolledOverFromYesterday: a.rolledOverFromYesterday || false,
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect day change and mark rollover for unfinished activities from yesterday
  const lastDateRef = useRef<string>(getLocalDateStr());
  useEffect(() => {
    const tick = () => {
      const today = getLocalDateStr();
      if (today !== lastDateRef.current) {
        setDailyActivities(prev => prev.map(a => {
          const wasYesterday = (a.scheduledDate && a.scheduledDate !== today);
          if (wasYesterday) {
            // Carry forward unfinished work and mark dashed
            if (a.status !== 'completed') {
              return {
                ...a,
                scheduledDate: today,
                rolledOverFromYesterday: true,
                // Reset accidental active/overtime states when rolling to a new day
                status: a.status === 'active' ? 'scheduled' : a.status,
                startedAt: null,
              };
            }
            // Completed yesterday: just reset date and clear rollover
            return { ...a, scheduledDate: today, rolledOverFromYesterday: false };
          }
          return a;
        }));
        lastDateRef.current = today;
      }
    };
    const id = setInterval(tick, 60 * 1000);
    tick();
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save active daily activity to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('timeSliceActiveDailyActivity', JSON.stringify(activeDailyActivity));
    } catch (e) {
      console.error('Failed to save active daily activity to localStorage:', e);
    }
  }, [activeDailyActivity]);

  // Restore active daily activity state on app load
  useEffect(() => {
    if (activeDailyActivity) {
      // Check if the saved active activity still exists and is actually active
      const activeActivity = dailyActivities.find(activity => 
        activity.id === activeDailyActivity && 
        (activity.status === 'active' || activity.status === 'overtime') && 
        activity.startedAt
      );
      
      if (!activeActivity) {
        // Clear the stale active activity reference
        setActiveDailyActivity(null);
      }
    }
  }, [dailyActivities, activeDailyActivity]);

  // Restore session state and handle time gap on app load
  useEffect(() => {
    try {
      const saved = localStorage.getItem('timeSliceSessionState');
      if (saved) {
        const sessionState = JSON.parse(saved);
        
        // If the session was active when the user left, handle the time gap
        if (sessionState.isTimerActive && !sessionState.isPaused && sessionState.lastActiveTimestamp) {
          // Populate baseline allocated seconds if missing
          try {
            const baseline = activities.reduce((sum, act) => sum + getAllocatedSeconds(act), 0);
            if (baseline > 0) initialTotalAllocatedRef.current = baseline;
          } catch {}
          const timeGapMs = Date.now() - sessionState.lastActiveTimestamp;
          const timeGapSeconds = Math.floor(timeGapMs / 1000);
          
          // Only process time gap if it's reasonable (less than 24 hours)
          if (timeGapSeconds > 0 && timeGapSeconds < 86400) {
            console.log(`Resuming session after ${Math.floor(timeGapSeconds / 60)}m ${timeGapSeconds % 60}s gap`);
            
            // Apply the time gap to activities
            setActivities(prev => {
              let remainingGapSeconds = timeGapSeconds;
              let newActivities = [...prev];
              let currentIndex = sessionState.currentActivityIndex || 0;
              
              while (remainingGapSeconds > 0 && currentIndex < newActivities.length) {
                const current = newActivities[currentIndex];
                
                if (!current || current.isCompleted) {
                  currentIndex++;
                  continue;
                }
                
                if (current.countUp) {
                  // For count-up activities, add all remaining time
                  current.timeRemaining += remainingGapSeconds;
                  remainingGapSeconds = 0;
                } else {
                  // For regular activities, subtract time
                  const timeToSubtract = Math.min(remainingGapSeconds, current.timeRemaining);
                  current.timeRemaining -= timeToSubtract;
                  remainingGapSeconds -= timeToSubtract;
                  
                  if (current.timeRemaining <= 0) {
                    current.isCompleted = true;
                    currentIndex++;
                  }
                }
              }
              
              // Update current activity index
              if (currentIndex !== sessionState.currentActivityIndex) {
                setTimeout(() => setCurrentActivityIndex(currentIndex), 0);
              }
              
              // If all activities are completed, stop the timer
              const allCompleted = newActivities.every(a => a.isCompleted);
              if (allCompleted) {
                setTimeout(() => setIsTimerActive(false), 0);
              }
              
              return newActivities;
            });
          }
        }
      }
    } catch (e) {
      console.error('Failed to restore session state:', e);
    }
  }, []); // Run only once on mount

  // Check if daily activities need to be reset for a new day
  useEffect(() => {
    try {
      const lastSavedDate = localStorage.getItem('timeSliceDailyActivitiesDate');
      const today = new Date().toDateString();
      
      if (lastSavedDate && lastSavedDate !== today) {
        // New day detected - reset all daily activities progress
        setDailyActivities(prev => prev.map(activity => ({
          ...activity,
          status: 'scheduled',
          isActive: false,
          timeSpent: 0,
          startedAt: null
        })));
        setActiveDailyActivity(null);
        console.log('Daily activities reset for new day');
      }
      
      // Save current date
      localStorage.setItem('timeSliceDailyActivitiesDate', today);
    } catch (e) {
      console.error('Failed to check/reset daily activities for new day:', e);
    }
  }, []); // Run only on mount

  useEffect(() => {
    try {
      localStorage.setItem('timeSliceTotalHours', JSON.stringify(totalHours));
    } catch (e) {
      console.error("Failed to save total hours", e);
    }
  }, [totalHours]);

  useEffect(() => {
    try {
      localStorage.setItem('timeSliceTotalMinutes', JSON.stringify(totalMinutes));
    } catch (e) {
      console.error("Failed to save total minutes", e);
    }
  }, [totalMinutes]);
  
  // --- End of State Saving Logic ---

  const lastTickTimestampRef = useRef(0);
  // Carry millisecond remainder between ticks to prevent ETA drift
  const tickRemainderMsRef = useRef(0);
  // Track total elapsed seconds per sharedId to sync only additive deltas to daily
  const sharedElapsedSnapshotRef = useRef<Record<string, number>>({});
  const lastDrainedIndex = useRef(-1);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // Stable baseline for overall progress (sum of allocated seconds at session start)
  const initialTotalAllocatedRef = useRef<number>(0);

  const calculateTotalSessionMinutes = useCallback(() => {
    if (durationType === 'endTime') {
      const now = new Date();
      const [endHour, endMinute] = endTime.split(':').map(Number);
      const endDate = new Date();
      endDate.setHours(endHour, endMinute, 0, 0);
      if (endDate < now) {
        endDate.setDate(endDate.getDate() + 1);
      }
      return Math.max(0, Math.round((endDate.getTime() - now.getTime()) / 60000));
    }
    return totalHours * 60 + totalMinutes;
  }, [durationType, endTime, totalHours, totalMinutes]);

  const totalSessionMinutes = calculateTotalSessionMinutes();
  const totalPercentage = activities.filter(activity => !activity.countUp).reduce((sum, activity) => sum + activity.percentage, 0);

  // Helper: allocated seconds for an activity based on session and its config
  const getAllocatedSeconds = useCallback((activity: Activity) => {
    const totalSeconds = calculateTotalSessionMinutes() * 60;
    const pct = Number(activity.percentage || 0);
    // Allocation for non-countUp activities is derived strictly from percentage.
    // If percentage is 0, this returns 0 and won't leak previous duration.
    if (!activity.countUp) {
      return Math.round((Math.max(0, pct) / 100) * totalSeconds);
    }
    return 0;
  }, [calculateTotalSessionMinutes]);

  // This effect keeps durations in sync with percentages and total time
  const activityPercentages = activities.map(a => a.percentage).join(',');
  useEffect(() => {
    console.log('Duration sync effect triggered:', { isTimerActive, totalSessionMinutes, activityPercentages });
    if (isTimerActive) return;
    const totalMins = calculateTotalSessionMinutes();
    const totalSeconds = totalMins * 60;

    setActivities(prev => {
      // Build allocation info for non-countUp activities based purely on percentages
      const alloc = prev.map((a, idx) => {
        if (!a.countUp) {
          const exact = Math.max(0, (a.percentage / 100) * totalSeconds);
          const floorSec = Math.floor(exact);
          return { idx, exact, floorSec, remainder: exact - floorSec, type: 'pct' as const };
        }
        // Count-up activities don't receive allocated time
        return { idx, exact: 0, floorSec: 0, remainder: 0, type: 'countUp' as const };
      });

      // Distribute remaining seconds so sum equals total session seconds
      const pctItems = alloc.filter(x => x.type === 'pct');
      const floorSum = pctItems.reduce((s, x) => s + x.floorSec, 0);
      let remainderToGive = Math.max(0, totalSeconds - floorSum);
      // Sort by largest fractional remainder
      pctItems.sort((a, b) => b.remainder - a.remainder);
      for (let i = 0; i < pctItems.length && remainderToGive > 0; i++, remainderToGive--) {
        pctItems[i].floorSec += 1;
      }

      // Map back: set duration to allocatedSeconds/60 (can be fractional minutes), timeRemaining to allocatedSeconds
      const pctMap = new Map(pctItems.map(x => [x.idx, x.floorSec]));
    const next = prev.map((activity, i) => {
        const allocatedSeconds = !activity.countUp ? (pctMap.get(i) ?? 0) : 0;
        const newDuration = allocatedSeconds / 60; // keep accurate, may be fractional minutes
        const newTimeRemaining = activity.countUp ? 0 : allocatedSeconds;
        console.log(`Activity ${activity.name}: pct=${activity.percentage}% -> ${newDuration.toFixed(2)}min = ${newTimeRemaining}s (countUp: ${activity.countUp})`);
        return {
          ...activity,
          duration: newDuration,
          timeRemaining: newTimeRemaining,
          isCompleted: false,
        };
      });
      return next;
    });
  }, [activityPercentages, totalSessionMinutes, isTimerActive, calculateTotalSessionMinutes]);

  const handleTimerTick = useCallback(() => {
    // Check for daily flowmodoro reset
    const now = new Date();
    const shouldReset = checkIfShouldReset(now, new Date(flowmodoroState.lastResetDate));
    if (shouldReset) {
      setFlowmodoroState(prev => ({
        availableRestTime: 0,
        totalEarnedToday: 0,
        cycleCount: 0,
        isOnBreak: false,
        breakTimeRemaining: 0,
        initialBreakDuration: 0,
        lastResetDate: now.toDateString(),
      }));
    }

    // Handle flowmodoro break countdown first
    if (settings.flowmodoroEnabled && flowmodoroState.isOnBreak && flowmodoroState.breakTimeRemaining > 0) {
      const now = Date.now();
      const last = lastTickTimestampRef.current || now;
      let diffMs = now - last;
      // Add remainder from previous cycles to avoid losing sub-second time
      diffMs += tickRemainderMsRef.current || 0;
      const elapsedSeconds = Math.floor(diffMs / 1000);
      tickRemainderMsRef.current = diffMs - (elapsedSeconds * 1000);
      // Advance anchor by the processed chunk
      lastTickTimestampRef.current = now;

      if (elapsedSeconds > 0) {
        setFlowmodoroState(prev => {
          const newBreakTimeRemaining = Math.max(0, prev.breakTimeRemaining - elapsedSeconds);
          if (newBreakTimeRemaining <= 0) {
            return {
              ...prev,
              isOnBreak: false,
              breakTimeRemaining: 0,
              initialBreakDuration: 0
            };
          }
          return {
            ...prev,
            breakTimeRemaining: newBreakTimeRemaining
          };
        });
      }
      return; // Don't process regular timer during break
    }

    // Calculate elapsed time with smoothing to avoid 2-second jumps from minor drift
  const nowMs = Date.now();
  const last = lastTickTimestampRef.current || nowMs;
  let diffMs = nowMs - last;
  // Accumulate remainder to prevent cumulative slip in ETA
  diffMs += tickRemainderMsRef.current || 0;
  const elapsedSeconds = Math.floor(diffMs / 1000);
  tickRemainderMsRef.current = diffMs - (elapsedSeconds * 1000);
  // Anchor to wall clock to avoid anchoring drift
  lastTickTimestampRef.current = nowMs;

    if (elapsedSeconds <= 0) return;

    // Accumulate flowmodoro rest time if enabled and timer is active (not during break)
    // This works for both session and daily modes
    if (settings.flowmodoroEnabled && !flowmodoroState.isOnBreak) {
      // Add elapsed seconds to fractional accumulator and calculate how much rest time to award
      const newAccumulated = flowmodoroState.accumulatedFractionalTime + elapsedSeconds;
      // For a 2:1 ratio, every 2 work seconds earns 1 rest second
      // For a 5:1 ratio, every 5 work seconds earns 1 rest second
      const workSecondsPerRestSecond = settings.flowmodoroRatio;
      const restSecondsToAdd = Math.floor(newAccumulated / workSecondsPerRestSecond);
      const remainingFractional = newAccumulated % workSecondsPerRestSecond;
      
      if (restSecondsToAdd > 0) {
        setFlowmodoroState(prevFlow => ({
          ...prevFlow,
          availableRestTime: prevFlow.availableRestTime + restSecondsToAdd,
          totalEarnedToday: prevFlow.totalEarnedToday + restSecondsToAdd,
          availableRestMinutes: Math.floor((prevFlow.availableRestTime + restSecondsToAdd) / 60),
          accumulatedFractionalTime: remainingFractional
        }));
      } else {
        setFlowmodoroState(prevFlow => ({
          ...prevFlow,
          accumulatedFractionalTime: newAccumulated
        }));
      }
    }

    setActivities(prev => {
      if (elapsedSeconds <= 0) return prev;

      let newActivities = [...prev];
      let secondsToProcess = elapsedSeconds;

      while (secondsToProcess > 0) {
        const current = newActivities[currentActivityIndex];
        if (!current) break;

        if (current.countUp) {
          // For count-up activities, we add time instead of subtracting
          current.timeRemaining += secondsToProcess;
          secondsToProcess = 0; // Count-up activities don't "complete" in the traditional sense
        } else {
          if (current.timeRemaining > 0) {
            const timeToTake = Math.min(secondsToProcess, current.timeRemaining);
            current.timeRemaining -= timeToTake;
            secondsToProcess -= timeToTake;
          }

          if (current.timeRemaining <= 0) {
            if (settings.overtimeType === 'drain') {
              const donors = newActivities.map((act, index) => ({ ...act, originalIndex: index }))
                .filter(act => act.originalIndex !== currentActivityIndex && !act.isLocked && !act.isCompleted && act.timeRemaining > 0);

              if (donors.length > 0) {
                const donorIndex = lastDrainedIndex.current = (lastDrainedIndex.current + 1) % donors.length;
                const donorToDrain = donors[donorIndex];
                newActivities[donorToDrain.originalIndex].timeRemaining -= 1;
              }
              current.timeRemaining -= 1;
              secondsToProcess -= 1;

            } else if (settings.overtimeType === 'postpone') {
              current.timeRemaining -= secondsToProcess;
              secondsToProcess = 0;
            } else { // 'none'
              if (!current.isCompleted) {
                // Preserve elapsed when auto-completing
                const plannedSec = (!current.countUp) ? Math.max(0, Math.round((Number(current.duration || 0)) * 60)) : 0;
                let elapsedSec = 0;
                if (current.countUp) {
                  elapsedSec = Math.max(0, current.timeRemaining || 0);
                } else {
                  const tr = typeof current.timeRemaining === 'number' ? current.timeRemaining : plannedSec;
                  if (tr >= 0) {
                    elapsedSec = Math.max(0, plannedSec - tr);
                  } else {
                    // include overtime on completion
                    elapsedSec = plannedSec + Math.abs(tr);
                  }
                }
                current.completedElapsedSeconds = Math.round(elapsedSec);
                current.isCompleted = true;

                const nextIndex = newActivities.findIndex(act => !act.isCompleted);
                if (nextIndex !== -1) {
                  setCurrentActivityIndex(nextIndex);
                } else {
                  setIsTimerActive(false);
                  // Clear session state when session ends naturally
                  try {
                    localStorage.removeItem('timeSliceSessionState');
                  } catch (e) {
                    console.error('Failed to clear session state:', e);
                  }
                }
              }
              secondsToProcess = 0; // Stop processing after completion
            }
          }
        }
      }
      return newActivities;
    });
  }, [currentActivityIndex, settings.overtimeType, settings.flowmodoroEnabled, settings.flowmodoroRatio, settings.flowmodoroMaxProgressMinutes, flowmodoroState.isOnBreak, flowmodoroState.breakTimeRemaining, flowmodoroState.lastResetDate, checkIfShouldReset]);

  // Sync shared progress when session activities change during active timer
  useEffect(() => {
    if (isTimerActive && !isPaused) {
      const currentActivity = activities[currentActivityIndex];
      if (currentActivity && currentActivity.sharedId) {
        syncSharedProgress(currentActivity, true);
      }
    }
  }, [activities, currentActivityIndex, isTimerActive, isPaused, syncSharedProgress]);

  // Sync shared progress for completed activities (separate from timer sync)
  useEffect(() => {
    activities.forEach(activity => {
      if (activity.sharedId && activity.isCompleted) {
        syncSharedProgress(activity, true);
      }
    });
  }, [activities, syncSharedProgress]);

  // Main timer loop - runs for session mode OR when daily activities are active OR during flowmodoro break
  useEffect(() => {
    const hasActiveDailyActivity = currentMode === 'daily' && dailyActivities.some(activity => activity.isActive);
    const hasActiveFlowmodoroBreak = flowmodoroState.isOnBreak && flowmodoroState.breakTimeRemaining > 0;
    const shouldRunTimer = (isTimerActive && !isPaused) || hasActiveDailyActivity || hasActiveFlowmodoroBreak;
    
    if (shouldRunTimer) {
      lastTickTimestampRef.current = Date.now();
      const interval = setInterval(handleTimerTick, 1000);
      return () => clearInterval(interval);
    }
  }, [
    isTimerActive,
    isPaused,
    handleTimerTick,
    currentMode,
    dailyActivities,
    flowmodoroState.isOnBreak,
    flowmodoroState.breakTimeRemaining,
    currentActivityIndex,
    settings.overtimeType,
    settings.flowmodoroEnabled,
    settings.flowmodoroRatio,
  ]);

  // Handle returning to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      const hasActiveDailyActivity = currentMode === 'daily' && dailyActivities.some(activity => activity.isActive);
      const hasActiveFlowmodoroBreak = flowmodoroState.isOnBreak && flowmodoroState.breakTimeRemaining > 0;
      const shouldHandleTick = (isTimerActive && !isPaused) || hasActiveDailyActivity || hasActiveFlowmodoroBreak;
      
      if (document.visibilityState === 'visible' && shouldHandleTick) {
        // On resume, compute wall-clock delta since last tick and process catch-up seconds
        const now = Date.now();
        const last = lastTickTimestampRef.current || now;
        let deltaMs = (now - last) + (tickRemainderMsRef.current || 0);
        const deltaSec = Math.floor(deltaMs / 1000);
        if (deltaSec > 0 && deltaSec < 86400) {
          // Temporarily apply catch-up by advancing anchor and running the same logic deltaSec times in batch
          lastTickTimestampRef.current = now;
          tickRemainderMsRef.current = deltaMs - (deltaSec * 1000);
          // Process catch-up by simulating a single batched tick
          setActivities(prev => {
            let newActivities = [...prev];
            let secondsToProcess = deltaSec;
            while (secondsToProcess > 0) {
              const current = newActivities[currentActivityIndex];
              if (!current) break;
              if (current.countUp) {
                current.timeRemaining += secondsToProcess;
                secondsToProcess = 0;
              } else {
                if (current.timeRemaining > 0) {
                  const timeToTake = Math.min(secondsToProcess, current.timeRemaining);
                  current.timeRemaining -= timeToTake;
                  secondsToProcess -= timeToTake;
                }
                if (current.timeRemaining <= 0) {
                  if (settings.overtimeType === 'drain') {
                    const donors = newActivities.map((act, index) => ({ ...act, originalIndex: index }))
                      .filter(act => act.originalIndex !== currentActivityIndex && !act.isLocked && !act.isCompleted && act.timeRemaining > 0);
                    if (donors.length > 0) {
                      const donorIndex = lastDrainedIndex.current = (lastDrainedIndex.current + 1) % donors.length;
                      const donorToDrain = donors[donorIndex];
                      newActivities[donorToDrain.originalIndex].timeRemaining -= 1;
                    }
                    current.timeRemaining -= 1;
                    secondsToProcess -= 1;
                  } else if (settings.overtimeType === 'postpone') {
                    current.timeRemaining -= secondsToProcess;
                    secondsToProcess = 0;
                  } else {
                    if (!current.isCompleted) {
                      const plannedSec = (!current.countUp) ? Math.max(0, Math.round((Number(current.duration || 0)) * 60)) : 0;
                      let elapsedSec = 0;
                      if (current.countUp) {
                        elapsedSec = Math.max(0, current.timeRemaining || 0);
                      } else {
                        const tr2 = typeof current.timeRemaining === 'number' ? current.timeRemaining : plannedSec;
                        if (tr2 >= 0) {
                          elapsedSec = Math.max(0, plannedSec - tr2);
                        } else {
                          elapsedSec = plannedSec + Math.abs(tr2);
                        }
                      }
                      current.completedElapsedSeconds = Math.round(elapsedSec);
                      current.isCompleted = true;
                      const nextIndex = newActivities.findIndex(act => !act.isCompleted);
                      if (nextIndex !== -1) {
                        setCurrentActivityIndex(nextIndex);
                      } else {
                        setIsTimerActive(false);
                        try { localStorage.removeItem('timeSliceSessionState'); } catch {}
                      }
                    }
                    secondsToProcess = 0;
                  }
                }
              }
            }
            return newActivities;
          });
          // Also advance flowmodoro if applicable
          if (settings.flowmodoroEnabled && !flowmodoroState.isOnBreak) {
            setFlowmodoroState(prevFlow => {
              const workSecondsPerRestSecond = settings.flowmodoroRatio;
              const newAccum = (prevFlow.accumulatedFractionalTime || 0) + deltaSec;
              const restSecondsToAdd = Math.floor(newAccum / workSecondsPerRestSecond);
              const remainingFractional = newAccum % workSecondsPerRestSecond;
              if (restSecondsToAdd > 0) {
                const updatedAvailable = (prevFlow.availableRestTime || 0) + restSecondsToAdd;
                return {
                  ...prevFlow,
                  availableRestTime: updatedAvailable,
                  totalEarnedToday: (prevFlow.totalEarnedToday || 0) + restSecondsToAdd,
                  availableRestMinutes: Math.floor(updatedAvailable / 60),
                  accumulatedFractionalTime: remainingFractional,
                };
              }
              return { ...prevFlow, accumulatedFractionalTime: newAccum };
            });
          }
        } else {
          // Nothing meaningful to catch up; just reset anchor
          lastTickTimestampRef.current = now;
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isTimerActive, isPaused, handleTimerTick, currentMode, dailyActivities, flowmodoroState.isOnBreak, flowmodoroState.breakTimeRemaining]);

  // Screen Wake Lock
  useEffect(() => {
    const acquireWakeLock = async () => {
      if ('wakeLock' in navigator && settings.keepScreenAwake) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          console.log('Screen Wake Lock is active.');
        } catch (err) {
          console.error(`${err.name}, ${err.message}`);
        }
      }
    };

    const releaseWakeLock = () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Screen Wake Lock released.');
      }
    };

    if (isTimerActive && !isPaused) {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      releaseWakeLock();
    };
  }, [isTimerActive, isPaused, settings.keepScreenAwake]);

  const formatTime = (seconds) => {
    if (seconds >= 0) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      }
      return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    } else {
      // Overtime formatting
      const positiveSeconds = Math.abs(seconds);
      const minutes = Math.floor(positiveSeconds / 60);
      const secs = positiveSeconds % 60;
      return `+${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
  };

  const getPredictedEndTime = () => {
    if (!isTimerActive) return "";
    const totalRemainingSeconds = getTotalRemainingTime();
    const endTime = new Date(Date.now() + totalRemainingSeconds * 1000);
    return endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  // Template-related activity creation functions
  const handleAddToCurrentSession = (template: ActivityTemplate) => {
    const newActivity = {
      id: Date.now().toString(),
      name: template.name,
      color: template.color,
      percentage: 10, // Default percentage
      duration: 0,
      timeRemaining: 0,
      isCompleted: false,
      isLocked: false,
      tags: template.tags || [],
      templateId: template.id // Link to template for shared progress
    };
    setActivities(prev => [...prev, newActivity]);
  };

  const handleAddToDaily = (template: ActivityTemplate) => {
    const newActivity = {
      id: `daily-${Date.now()}`,
      name: template.name,
      color: template.color,
      duration: template.presetDuration || 30, // Use preset duration or default
      percentage: 0,
      status: 'scheduled' as const,
      isActive: false,
      timeSpent: 0,
      startedAt: null,
      subtasks: [],
      tags: template.tags || [],
  templateId: template.id, // Link to template for shared progress
  scheduledDate: getLocalDateStr(),
  rolledOverFromYesterday: false,
    };
    setDailyActivities(prev => [...prev, newActivity]);
  };

  const handleAddToBoth = (template: ActivityTemplate) => {
    // Check if there's already a daily activity for this template
    const existingDailyActivity = dailyActivities.find(
      activity => activity.templateId === template.id && activity.sharedId
    );
    
    let sharedId: string;
    
    if (existingDailyActivity) {
      // Use existing shared activity
      sharedId = existingDailyActivity.sharedId!;
    } else {
      // Create new shared pair
      sharedId = `shared-${Date.now()}`;
      
      // Add to daily
      const dailyActivity = {
        id: sharedId + '-daily',
        name: template.name,
        color: template.color,
        duration: template.presetDuration || 30,
        percentage: 0,
        status: 'scheduled' as const,
        isActive: false,
        timeSpent: 0,
        startedAt: null,
        subtasks: [],
        tags: template.tags || [],
        templateId: template.id,
  sharedId: sharedId, // Link for shared progress
  scheduledDate: getLocalDateStr(),
  rolledOverFromYesterday: false,
      };
      
      setDailyActivities(prev => [...prev, dailyActivity]);
    }
    
    // Always add a new session activity that links to the shared daily activity
    const sessionActivity = {
      id: `${sharedId}-session-${Date.now()}`, // Unique session ID but same sharedId
      name: template.name,
      color: template.color,
      percentage: 10,
      duration: 0,
      timeRemaining: 0,
      isCompleted: false,
      isLocked: false,
      tags: template.tags || [],
      templateId: template.id,
      sharedId: sharedId // Link for shared progress
    };
    
    setActivities(prev => [...prev, sessionActivity]);
  };

  const addActivity = (
    customName: string | null = null,
    customColor: string | null = null,
    presetTime = 0,
    countUp = false,
    category?: string,
    tags?: string[]
  ) => {
    // Always open modal if no custom name provided - this ensures all activity creation goes through naming dialog
    // This is especially important for mobile users who shouldn't need to click into input fields to rename
    if (customName === null || customName === undefined || customName === '') {
      // Simple modal opening - no complex color conflicts to worry about
      setAddActivityModalState({ isOpen: true });
      return;
    }

    // Ensure the name is always a string and not an object
    let activityName = "New Activity";
    if (customName !== null && customName !== undefined) {
      // Convert to string and trim, handle any unexpected object types
      const nameStr = typeof customName === 'string' ? customName : String(customName);
      if (nameStr && nameStr.trim() && nameStr !== '[object Object]') {
        activityName = nameStr.trim();
      }
    }

    // Use provided color or generate random one (like UI test 5)
    const activityColor = customColor || `hsl(${Math.floor(Math.random() * 360)}, 60%, 50%)`;

    const newActivity = {
      id: Date.now().toString(),
      name: activityName,
      percentage: 0,
      color: activityColor,
      duration: presetTime > 0 ? Math.round(presetTime / 60) : 0, // Convert seconds to minutes
      timeRemaining: presetTime > 0 ? presetTime : (isTimerActive ? 0 : 0), // Use preset time or 0
      isCompleted: false,
      isLocked: false,
      countUp: countUp,
      category: category,
      tags: tags && tags.length ? tags : [],
    };
    
    setActivities(prev => {
      const updatedActivities = [...prev, newActivity];
      
      // If timer is not active, redistribute percentages equally
      if (!isTimerActive) {
        const lockedTotal = updatedActivities.filter(a => a.isLocked).reduce((sum, a) => sum + a.percentage, 0);
        const unlockedActivities = updatedActivities.filter(a => !a.isLocked);
        const remainingPercentage = 100 - lockedTotal;
        const equalPercentage = unlockedActivities.length > 0 ? remainingPercentage / unlockedActivities.length : 0;

        return updatedActivities.map(act => {
          if (act.isLocked) return act;
          return { ...act, percentage: equalPercentage };
        });
      }
      
      return updatedActivities;
    });
  };

  const handleAddActivityWithName = (name, color, presetTime = 0, countUp = false, category?: string, tags?: string[]) => {
    console.log('handleAddActivityWithName called with:', { name, color, presetTime, countUp, currentMode });
    
    if (currentMode === 'daily') {
      // Use the same working logic as quickAddDailyActivity but with custom parameters
      if (!name || !name.trim()) return;
      
      const colorPalette = [
        'hsl(220, 70%, 50%)', // blue
        'hsl(120, 60%, 50%)', // green
        'hsl(280, 60%, 50%)', // purple
        'hsl(0, 70%, 50%)',   // red
        'hsl(60, 80%, 50%)',  // yellow
        'hsl(320, 60%, 50%)', // pink
        'hsl(250, 70%, 50%)'  // indigo
      ];
      const activityColor = color || colorPalette[Math.floor(Math.random() * colorPalette.length)];
      
      // Smart duration based on preset time or default
      let smartDuration = presetTime > 0 ? Math.round(presetTime / 60) : 60; // Convert seconds to minutes or default 1 hour
      
      const percentage = (smartDuration / (24 * 60)) * 100;
      
      const newActivity = {
        id: `activity-${Date.now()}`,
        name: name.trim(),
        color: activityColor,
        duration: smartDuration,
        percentage: Math.round(percentage * 10) / 10,
        status: 'scheduled',
        isActive: false,
        timeSpent: 0,
  startedAt: null,
  scheduledDate: getLocalDateStr(),
  rolledOverFromYesterday: false,
        category: category,
        tags: tags && tags.length ? tags : [],
      };
      
      setDailyActivities(prev => [...prev, newActivity]);
      console.log('Added daily activity via modal:', newActivity);
    } else {
      // Session mode - use existing addActivity function
  addActivity(name, color, presetTime, countUp, category, tags);
    }
  };

  // Daily Mode Functions (Step 2: Quick Add)
  const quickAddDailyActivity = (name) => {
    if (!name || !name.trim()) return;
    
    // Smart duration based on activity name patterns
    let smartDuration = 60; // default 1 hour
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('meeting') || nameLower.includes('call')) {
      smartDuration = 30; // meetings are usually 30min
    } else if (nameLower.includes('workout') || nameLower.includes('exercise') || nameLower.includes('gym')) {
      smartDuration = 90; // workouts are usually 1.5h
    } else if (nameLower.includes('work') || nameLower.includes('focus') || nameLower.includes('study')) {
      smartDuration = 120; // work sessions are usually 2h
    } else if (nameLower.includes('break') || nameLower.includes('rest') || nameLower.includes('lunch')) {
      smartDuration = 30; // breaks are usually 30min
    } else if (nameLower.includes('commute') || nameLower.includes('travel')) {
      smartDuration = 45; // travel time usually 45min
    }
    
    const colors = [
      'hsl(220, 70%, 50%)', // blue
      'hsl(120, 60%, 50%)', // green
      'hsl(280, 60%, 50%)', // purple
      'hsl(0, 70%, 50%)',   // red
      'hsl(60, 80%, 50%)',  // yellow
      'hsl(320, 60%, 50%)', // pink
      'hsl(250, 70%, 50%)'  // indigo
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const percentage = (smartDuration / (24 * 60)) * 100;
    
    const newActivity = {
      id: `activity-${Date.now()}`,
      name: name.trim(),
      color: randomColor,
      duration: smartDuration,
      percentage: Math.round(percentage * 10) / 10,
      status: 'scheduled',
      isActive: false,
      timeSpent: 0,
      startedAt: null,
  subtasks: [], // Add subtasks array
  scheduledDate: getLocalDateStr(),
  rolledOverFromYesterday: false,
    };
    
    setDailyActivities(prev => [...prev, newActivity]);
    console.log('Smart scheduled daily activity:', newActivity);
  };

  const startDailyActivity = (activityId) => {
    console.log('Starting daily activity:', activityId);
    setDailyActivities((prev: any) => {
      const activities = prev.map((activity: any) => ({
        ...activity,
        isActive: activity.id === activityId,
        status: activity.id === activityId ? 'active' : (activity.status === 'active' ? 'scheduled' : activity.status),
        startedAt: activity.id === activityId ? new Date() : activity.startedAt
      }));
      
      // Move the selected activity to the front
      const selectedIndex = activities.findIndex(a => a.id === activityId);
      if (selectedIndex > 0) {
        const [selectedActivity] = activities.splice(selectedIndex, 1);
        activities.unshift(selectedActivity);
      }
      
      return activities;
    });
    setActiveDailyActivity(activityId);
  };

  const toggleDailyActivityCompletion = (activityId: string) => {
    setDailyActivities(prev => prev.map(activity => {
      if (activity.id === activityId) {
        let updatedActivity;
        // If currently completed, mark as scheduled and reset all subtasks
        if (activity.status === 'completed') {
          updatedActivity = { 
            ...activity, 
            status: 'scheduled',
            subtasks: (activity.subtasks || []).map(subtask => ({ ...subtask, completed: false }))
          };
        } else {
          // If not completed, mark as completed and complete all subtasks
          updatedActivity = { 
            ...activity, 
            status: 'completed',
            subtasks: (activity.subtasks || []).map(subtask => ({ ...subtask, completed: true }))
          };
        }
        
        // Sync progress with shared session activity if it exists
        if (updatedActivity.sharedId) {
          syncSharedProgress(updatedActivity, false);
        }
        
        return updatedActivity;
      }
      return activity;
    }));
  };

  const stopDailyActivity = () => {
    console.log('Stopping daily activity');
    setDailyActivities(prev => prev.map(activity => {
      if (activity.isActive && activity.startedAt) {
        const currentSessionSeconds = Math.floor((Date.now() - (activity.startedAt as any).getTime()) / 1000);
        const currentSessionMinutes = Math.floor(currentSessionSeconds / 60);
        const finalTimeSpent = activity.timeSpent + currentSessionMinutes;
        return {
          ...activity,
          isActive: false,
          status: 'scheduled',
          timeSpent: finalTimeSpent,
          startedAt: null
        };
      }
      return {
        ...activity,
        isActive: false,
        status: activity.status === 'active' ? 'scheduled' : activity.status
      };
    }));
    setActiveDailyActivity(null);
  };

  const removeDailyActivity = (activityId) => {
    console.log('Removing daily activity:', activityId);
    setDailyActivities(prev => prev.filter(activity => activity.id !== activityId));
    if (activeDailyActivity === activityId) {
      setActiveDailyActivity(null);
    }
  };

  // Subtask management functions
  const addSubtaskToActivity = (activityId: string, subtaskName: string) => {
    if (!subtaskName.trim()) return;
    
    const newSubtask: Subtask = {
      id: `subtask-${Date.now()}`,
      name: subtaskName.trim(),
      completed: false,
      createdAt: new Date()
    };
    
    setDailyActivities(prev => prev.map(activity => {
      if (activity.id === activityId) {
        return {
          ...activity,
          subtasks: [...(activity.subtasks || []), newSubtask]
        };
      }
      return activity;
    }));
  };

  // Helper function to check if all subtasks are completed
  const areAllSubtasksCompleted = (activity) => {
    if (!activity.subtasks || activity.subtasks.length === 0) return true; // No subtasks = can complete
    return activity.subtasks.every(subtask => subtask.completed);
  };

  const toggleSubtaskCompletion = (activityId: string, subtaskId: string) => {
    setDailyActivities(prev => prev.map(activity => {
      if (activity.id === activityId) {
        const updatedSubtasks = (activity.subtasks || []).map(subtask =>
          subtask.id === subtaskId
            ? { ...subtask, completed: !subtask.completed }
            : subtask
        );
        
        // REMOVED: Auto-completion logic - now user must manually complete main task
        // If the main task was completed but now subtasks are not all done, uncheck main task
        const allSubtasksCompleted = updatedSubtasks.length > 0 && 
          updatedSubtasks.every(subtask => subtask.completed);
        
        return {
          ...activity,
          subtasks: updatedSubtasks,
          // Only auto-uncheck main task if it was completed but subtasks are now incomplete
          status: (activity.status === 'completed' && !allSubtasksCompleted) ? 'scheduled' : activity.status
        };
      }
      return activity;
    }));
  };

  const removeSubtaskFromActivity = (activityId: string, subtaskId: string) => {
    setDailyActivities(prev => prev.map(activity => {
      if (activity.id === activityId) {
        const updatedSubtasks = (activity.subtasks || []).filter(subtask => subtask.id !== subtaskId);
        
        // REMOVED: Auto-completion logic when removing subtasks
        // If the main task was completed but now subtasks exist and aren't all done, uncheck main task
        const allSubtasksCompleted = updatedSubtasks.length > 0 && 
          updatedSubtasks.every(subtask => subtask.completed);
        
        return {
          ...activity,
          subtasks: updatedSubtasks,
          // Only auto-uncheck main task if it was completed but subtasks are now incomplete
          status: (activity.status === 'completed' && updatedSubtasks.length > 0 && !allSubtasksCompleted) ? 'scheduled' : activity.status
        };
      }
      return activity;
    }));
  };

  // Step 15: Activity Settings Functions
  const openActivitySettings = (activityId) => {
    const activity = dailyActivities.find(a => a.id === activityId);
    if (activity) {
      setActivitySettingsModal({
        isOpen: true,
        activityId,
        activityData: { ...activity } as any
      });
    }
  };

  const closeActivitySettings = () => {
    setActivitySettingsModal({
      isOpen: false,
      activityId: null,
      activityData: null
    });
  };

  const saveActivitySettings = (updatedActivity) => {
    setDailyActivities(prev => prev.map(activity => 
      activity.id === updatedActivity.id ? { ...activity, ...updatedActivity } : activity
    ));
    closeActivitySettings();
  };

  const deleteActivityFromSettings = (activityId) => {
    removeDailyActivity(activityId);
    closeActivitySettings();
  };

  // Daily Activity Edit Functions
  const openDailyActivityEdit = (activityId) => {
    const activity = dailyActivities.find(a => a.id === activityId);
    if (activity) {
      setDailyActivityEditModal({
        isOpen: true,
        activityId,
        activityData: { ...activity } as any,
        isNewActivity: false
      });
    }
  };

  const openDailyActivityAdd = () => {
    setDailyActivityEditModal({
      isOpen: true,
      activityId: null,
      activityData: {
        id: `activity-${Date.now()}`,
        name: '',
        color: 'hsl(220, 70%, 50%)',
        duration: 60,
        percentage: 4.2,
        status: 'scheduled',
        isActive: false,
        timeSpent: 0,
        startedAt: null
      } as any,
      isNewActivity: true
    });
  };

  const closeDailyActivityEdit = () => {
    setDailyActivityEditModal({
      isOpen: false,
      activityId: null,
      activityData: null,
      isNewActivity: false
    });
  };

  const saveDailyActivityEdit = (updatedActivity) => {
    if (dailyActivityEditModal.isNewActivity) {
      // Add new activity
      setDailyActivities(prev => [...prev, updatedActivity]);
    } else {
      // Update existing activity
      setDailyActivities(prev => prev.map(activity => 
        activity.id === updatedActivity.id ? { ...activity, ...updatedActivity } : activity
      ));
    }
    closeDailyActivityEdit();
  };

  const deleteDailyActivityFromEdit = (activityId) => {
    removeDailyActivity(activityId);
    closeDailyActivityEdit();
  };

  // Daily Mode Calculations (Step 10: Dynamic Summary)
  const getDailySummary = () => {
    const totalPlannedMinutes = dailyActivities.reduce((sum, activity) => sum + activity.duration, 0);
    const totalSpentMinutes = dailyActivities.reduce((sum, activity) => sum + activity.timeSpent, 0);
    const activeTimeMinutes = dailyActivities
      .filter(activity => activity.status === 'active' || activity.status === 'overtime')
      .reduce((sum, activity) => sum + activity.timeSpent, 0);
    const remainingMinutes = Math.max(0, totalPlannedMinutes - totalSpentMinutes);
    
    // Step 18: Enhanced Analytics
    const completedActivities = dailyActivities.filter(a => a.status === 'completed').length;
    const overtimeActivities = dailyActivities.filter(a => a.status === 'overtime').length;
    const totalOvertimeMinutes = dailyActivities
      .filter(a => a.status === 'overtime')
      .reduce((sum, activity) => sum + Math.max(0, activity.timeSpent - activity.duration), 0);
    const completionRate = dailyActivities.length > 0 ? (completedActivities / dailyActivities.length) * 100 : 0;
    const efficiency = totalPlannedMinutes > 0 ? Math.min(100, (totalSpentMinutes / totalPlannedMinutes) * 100) : 0;
    
    return {
      totalPlannedHours: Math.floor(totalPlannedMinutes / 60),
      totalPlannedMinutes: totalPlannedMinutes % 60,
      totalPlannedPercentage: Math.min(100, (totalPlannedMinutes / (24 * 60)) * 100),
      activeTimeMinutes,
      remainingMinutes,
      totalSpentMinutes,
      completedActivities,
      overtimeActivities,
      totalOvertimeMinutes,
      completionRate,
      efficiency,
      totalActivities: dailyActivities.length
    };
  };

  // RPG Stats Calculation Functions (driven by Manage Activities tags + actual usage)
  const calculateRPGStats = (): RPGStat[] => {
    // Build axes: only tags that exist in Manage Activities AND are actually used
    const manageSet = new Set((customTags || []).map(t => String(t).trim().toLowerCase()));
    const usedOnly = new Set<string>([
      ...activities.flatMap(a => a.tags || []),
      ...dailyActivities.flatMap(a => a.tags || []),
      ...activityTemplates.flatMap(t => t.tags || []),
    ].filter(Boolean).map(t => String(t).trim().toLowerCase()));

    const tagList = Array.from(usedOnly).filter(t => manageSet.has(t));
    if (tagList.length === 0) return [];

    // Local deterministic color from name (keeps UI consistent, no global sync required)
    const colorFor = (name: string) => {
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
        hash |= 0;
      }
      const hue = Math.abs(hash) % 360;
      return `hsl(${hue}, 65%, 50%)`;
    };

    // Initialize totals
    const totals = new Map<string, { totalMinutes: number; sessionMinutes: number; dailyMinutes: number }>();
    tagList.forEach(t => totals.set(t, { totalMinutes: 0, sessionMinutes: 0, dailyMinutes: 0 }));

    // Helper: compute elapsed minutes from session activity (supports count-up and overtime)
    const elapsedMinutesFromActivity = (a: any): number => {
      const durationSec = Math.max(0, (a.duration || 0) * 60);
      const tr = typeof a.timeRemaining === 'number' ? a.timeRemaining : undefined; // seconds
      if (a.countUp) {
        // For count-up timers, timeRemaining stores elapsed seconds
        return Math.max(0, Math.floor((a.timeRemaining || 0) / 60));
      }
      if (typeof tr === 'number') {
        // elapsed = planned - remaining; if negative remaining, include overtime
        const elapsedSec = tr >= 0 ? (durationSec - tr) : (durationSec + Math.abs(tr));
        return Math.max(0, Math.floor(elapsedSec / 60));
      }
      return 0;
    };

    // Session activities contribute ACTUAL elapsed minutes only
    activities.forEach(a => {
      const tags = (a.tags || []).map(x => String(x).toLowerCase());
      if (tags.length === 0) return;
      const sessionMinutes = elapsedMinutesFromActivity(a);
      if (sessionMinutes <= 0) return;
      tags.forEach(tag => {
        if (totals.has(tag)) {
          const cur = totals.get(tag)!;
          cur.sessionMinutes += sessionMinutes;
          cur.totalMinutes += sessionMinutes;
        }
      });
    });

    // Daily activities contribute timeSpent to dailyMinutes
    dailyActivities.forEach(a => {
      const tags = (a.tags || []).map(x => String(x).toLowerCase());
      if (tags.length === 0) return;
      const dailyMinutes = Math.max(0, a.timeSpent || 0);
      tags.forEach(tag => {
        if (totals.has(tag)) {
          const cur = totals.get(tag)!;
          cur.dailyMinutes += dailyMinutes;
          cur.totalMinutes += dailyMinutes;
        }
      });
    });

    // Map to RPGStat[]
    return tagList.map(name => {
      const key = name.toLowerCase();
      const stats = totals.get(key) || { totalMinutes: 0, sessionMinutes: 0, dailyMinutes: 0 };
      const level = Math.floor(stats.totalMinutes / 60) + 1;
      const experience = stats.totalMinutes % 60;
      return {
        tagId: key,
        tagName: name,
        totalMinutes: stats.totalMinutes,
        sessionMinutes: stats.sessionMinutes,
        dailyMinutes: stats.dailyMinutes,
        weeklyMinutes: stats.totalMinutes,
        level,
        experience,
        color: colorFor(name),
      };
    });
  };

  const calculateBalancedSuggestion = (currentStats: RPGStat[]): RPGStat[] => {
    // Calculate suggested balance based on creating harmony between all areas
    const totalMinutes = currentStats.reduce((sum, stat) => sum + stat.totalMinutes, 0);
    const averageMinutes = totalMinutes / currentStats.length;
    const targetMinutes = Math.max(averageMinutes, 120); // Minimum 2 hours per area
    
    return currentStats.map(stat => {
      const suggestedTotal = targetMinutes;
      const suggestedLevel = Math.floor(suggestedTotal / 60) + 1;
      const suggestedExperience = suggestedTotal % 60;
      
      return {
        ...stat,
        totalMinutes: suggestedTotal,
        level: suggestedLevel,
        experience: suggestedExperience
      };
    });
  };

  const calculateBalanceScore = (currentStats: RPGStat[]): number => {
    if (currentStats.length === 0) return 100;
    
    const levels = currentStats.map(stat => stat.level);
    const maxLevel = Math.max(...levels);
    const minLevel = Math.min(...levels);
    const variance = levels.reduce((sum, level) => {
      const avgLevel = levels.reduce((a, b) => a + b, 0) / levels.length;
      return sum + Math.pow(level - avgLevel, 2);
    }, 0) / levels.length;
    
    // Balance score: 100 = perfect balance, lower = more unbalanced
    const balanceScore = Math.max(0, 100 - variance * 10 - (maxLevel - minLevel) * 5);
    return Math.round(balanceScore);
  };

  const getRPGBalance = (): RPGBalance => {
    const current = calculateRPGStats();
    const suggested = calculateBalancedSuggestion(current);
    const balanceScore = calculateBalanceScore(current);
    
    return { current, suggested, balanceScore };
  };

  // RPG Tag Management Functions
  const addRPGTag = (name: string, color: string, description?: string, parentId?: string, isSubCategory: boolean = false) => {
    const newTag: RPGTag = {
      id: Date.now().toString(),
      name: name.trim(),
      color,
      description: description?.trim(),
      createdAt: new Date(),
      parentId,
      isSubCategory,
      overallProgress: 0,
      totalLifetimeMinutes: 0
    };
    
    setRpgTags(prev => [...prev, newTag]);
  };

  // Update overall progress for tags based on activity completion
  const updateTagProgress = useCallback((tagId: string, minutesSpent: number) => {
    setRpgTags(prev => prev.map(tag => {
      if (tag.id === tagId) {
        const newTotalMinutes = (tag.totalLifetimeMinutes || 0) + minutesSpent;
        // Simple progress calculation: every 60 hours = 1% progress (up to 100%)
        const newProgress = Math.min(100, Math.floor(newTotalMinutes / (60 * 60)));
        
        return {
          ...tag,
          totalLifetimeMinutes: newTotalMinutes,
          overallProgress: newProgress
        };
      }
      return tag;
    }));
  }, []);

  // Track activity completion and update tag progress
  useEffect(() => {
    // This effect will run when activities change - we can track completion here
    // For now, we'll update progress when activities are marked as completed
    const updateProgressFromActivities = () => {
      // Check daily activities for completion
      dailyActivities.forEach(activity => {
        if (activity.status === 'completed' && activity.tags && activity.tags.length > 0) {
          activity.tags.forEach(tagId => {
            // Only update if this activity wasn't already counted
            // We can use a flag or timestamp to track this
            const timeSpent = activity.timeSpent || 0;
            if (timeSpent > 0) {
              updateTagProgress(tagId, timeSpent);
            }
          });
        }
      });
    };

    // For this demo, we'll just run the update
    // In a real implementation, you'd want to track which activities have already been counted
    // updateProgressFromActivities();
  }, [dailyActivities, updateTagProgress]);

  const updateRPGTag = (tagId: string, updates: Partial<RPGTag>) => {
    setRpgTags(prev => prev.map(tag => 
      tag.id === tagId ? { ...tag, ...updates } : tag
    ));
  };

  const removeRPGTag = (tagId: string) => {
    // Remove tag from all activities first
    setActivities(prev => prev.map(activity => ({
      ...activity,
      tags: activity.tags?.filter(id => id !== tagId) || []
    })));
    
    setDailyActivities(prev => prev.map(activity => ({
      ...activity,
      tags: activity.tags?.filter(id => id !== tagId) || []
    })));
    
    // Remove the tag itself
    setRpgTags(prev => prev.filter(tag => tag.id !== tagId));
  };

  // Function to add tags to activities
  const addTagToActivity = (activityId: string, tagId: string, isDaily: boolean = false) => {
    if (isDaily) {
      setDailyActivities(prev => prev.map(activity => {
        if (activity.id === activityId) {
          const currentTags = activity.tags || [];
          if (!currentTags.includes(tagId)) {
            return { ...activity, tags: [...currentTags, tagId] };
          }
        }
        return activity;
      }));
    } else {
      setActivities(prev => prev.map(activity => {
        if (activity.id === activityId) {
          const currentTags = activity.tags || [];
          if (!currentTags.includes(tagId)) {
            return { ...activity, tags: [...currentTags, tagId] };
          }
        }
        return activity;
      }));
    }
  };

  const removeTagFromActivity = (activityId: string, tagId: string, isDaily: boolean = false) => {
    if (isDaily) {
      setDailyActivities(prev => prev.map(activity => 
        activity.id === activityId 
          ? { ...activity, tags: (activity.tags || []).filter(id => id !== tagId) }
          : activity
      ));
    } else {
      setActivities(prev => prev.map(activity => 
        activity.id === activityId 
          ? { ...activity, tags: (activity.tags || []).filter(id => id !== tagId) }
          : activity
      ));
    }
  };

  const saveActivityTemplate = (name, color, category?: string, tags?: string[]) => {
    const newTemplate = {
      id: Date.now().toString(),
      name: name.trim(),
      color: color,
      category: category,
      tags: tags && tags.length ? tags : undefined
    };
    
    // Check if template with same name already exists
  const existingTemplate = activityTemplates.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (!existingTemplate) {
      setActivityTemplates(prev => [...prev, newTemplate]);
    }
  };

  const removeActivity = (id) => {
    if (activities.length > 1) {
      setActivities(prev => {
        const filteredActivities = prev.filter((activity) => activity.id !== id);
        
        // If timer is not active, redistribute percentages equally
        if (!isTimerActive) {
          const lockedTotal = filteredActivities.filter(a => a.isLocked).reduce((sum, a) => sum + a.percentage, 0);
          const unlockedActivities = filteredActivities.filter(a => !a.isLocked);
          const remainingPercentage = 100 - lockedTotal;
          const equalPercentage = unlockedActivities.length > 0 ? remainingPercentage / unlockedActivities.length : 0;

          return filteredActivities.map(act => {
            if (act.isLocked) return act;
            return { ...act, percentage: equalPercentage };
          });
        }
        
        return filteredActivities;
      });
    }
  };

  const handleDistributeEqually = () => {
    const lockedTotal = activities.filter(a => a.isLocked && !a.countUp).reduce((sum, a) => sum + a.percentage, 0);
    const unlockedActivities = activities.filter(a => !a.isLocked && !a.countUp);
    const remainingPercentage = 100 - lockedTotal;
    
    if (unlockedActivities.length === 0) return;

    // Calculate base percentage for each unlocked activity
    const basePercentage = Math.floor(remainingPercentage / unlockedActivities.length);
    const remainder = remainingPercentage - (basePercentage * unlockedActivities.length);

    setActivities(prev => {
      let remainderToDistribute = remainder;
      
      return prev.map(act => {
        if (act.isLocked || act.countUp) return act;
        
        // Give base percentage to all unlocked, non-count-up activities
        let activityPercentage = basePercentage;
        
        // Give 1 extra percent to the first few activities until remainder is distributed
        if (remainderToDistribute > 0) {
          activityPercentage += 1;
          remainderToDistribute -= 1;
        }
        
        return { ...act, percentage: activityPercentage };
      });
    });
  };

  const updateAndScalePercentages = (idOfChangedActivity, newPercentage) => {
    setActivities(prev => {
      const lockedTotal = prev.filter(a => a.isLocked && !a.countUp).reduce((sum, a) => sum + a.percentage, 0);
      const maxAllowed = 100 - lockedTotal;
      const safeNewPercentage = Math.min(newPercentage, maxAllowed);

      const otherUnlockedActivities = prev.filter(a => !a.isLocked && !a.countUp && a.id !== idOfChangedActivity);
      const otherUnlockedTotal = otherUnlockedActivities.reduce((sum, a) => sum + a.percentage, 0);

      const remainingForOthers = maxAllowed - safeNewPercentage;
      
      // Handle special case where we need to distribute remaining percentage
      let scaleFactor = 0;
      if (otherUnlockedActivities.length > 0) {
        if (otherUnlockedTotal > 0) {
          // Normal case: scale existing percentages proportionally
          scaleFactor = remainingForOthers / otherUnlockedTotal;
        } else if (remainingForOthers > 0) {
          // Special case: other activities are at 0%, distribute equally
          const equalShare = remainingForOthers / otherUnlockedActivities.length;
          return prev.map(act => {
            if (act.id === idOfChangedActivity) {
              return { ...act, percentage: safeNewPercentage };
            }
            if (act.isLocked || act.countUp) {
              return act;
            }
            return { ...act, percentage: equalShare };
          });
        }
      }

      const updatedActivities = prev.map(act => {
        if (act.id === idOfChangedActivity) {
          return { ...act, percentage: safeNewPercentage };
        }
        if (act.isLocked || act.countUp) {
          return act;
        }
        // Scale other unlocked activities
        return { ...act, percentage: act.percentage * scaleFactor };
      });

      // Correct for rounding errors to ensure total is exactly 100
      const finalTotal = updatedActivities.filter(a => !a.countUp).reduce((sum, p) => sum + p.percentage, 0);
      const diff = 100 - finalTotal;
      if (Math.abs(diff) > 0.001) {
        const firstUnlocked = updatedActivities.find(a => !a.isLocked && !a.countUp && a.id !== idOfChangedActivity);
        if (firstUnlocked) {
          firstUnlocked.percentage += diff;
        } else {
          const changedActivity = updatedActivities.find(a => a.id === idOfChangedActivity && !a.countUp);
          if (changedActivity) changedActivity.percentage += diff;
        }
      }

      return updatedActivities;
    });
  };

  const toggleLockActivity = (id) => {
    setActivities(prev => prev.map(act => act.id === id ? { ...act, isLocked: !act.isLocked } : act));
  };

  const toggleCountUpActivity = (id) => {
    setActivities(prev => prev.map(act => {
      if (act.id === id) {
        const newCountUp = !act.countUp;
        if (newCountUp) {
          // When enabling count-up: set percentage to 0, lock it, reset time
          return { 
            ...act, 
            countUp: newCountUp, 
            percentage: 0, 
            isLocked: true,
            timeRemaining: 0,
            duration: 0
          };
        } else {
          // When disabling count-up: unlock it but keep percentage at 0 for manual adjustment
          return { 
            ...act, 
            countUp: newCountUp, 
            isLocked: false
          };
        }
      }
      return act;
    }));
  };

  const updateActivityName = (id, name) => {
    // Allow empty string during editing, only default when saving/blur
    console.log('Updating activity name:', id, 'to:', name);
    setActivities((prev) => prev.map((activity) => (activity.id === id ? { ...activity, name: name } : activity)));
  };

  const updateActivityColor = (id, color) => {
    console.log('updateActivityColor called with:', { id, color, currentMode });
    
    // Prevent multiple simultaneous updates
    if (!id || !color) {
      console.warn('Invalid parameters for updateActivityColor:', { id, color });
      return;
    }
    
    if (currentMode === 'daily') {
      // Update daily activities
      setDailyActivities((prev) => {
        const updated = prev.map((activity) => (activity.id === id ? { ...activity, color } : activity));
        console.log('Updated daily activities with new color:', updated.find(a => a.id === id));
        return updated;
      });
    } else {
      // Update session activities  
      setActivities((prev) => {
        const updated = prev.map((activity) => (activity.id === id ? { ...activity, color } : activity));
        console.log('Updated session activities with new color:', updated.find(a => a.id === id));
        return updated;
      });
    }
  };

  const startSession = () => {
    if (Math.abs(totalPercentage - 100) < 0.1 && activities.length > 0) {
      console.log('Starting session with activities:', activities);
      setIsTimerActive(true);
      setIsPaused(false);
      // Capture baseline allocated seconds at session start for stable progress calculations
      try {
        const baseline = activities.reduce((sum, act) => sum + getAllocatedSeconds(act), 0);
        initialTotalAllocatedRef.current = baseline;
        console.log('Session baseline (allocated seconds):', baseline);
      } catch (e) {
        initialTotalAllocatedRef.current = 0;
      }
      const firstIncompleteIndex = activities.findIndex(a => !a.isCompleted);
      const newIndex = firstIncompleteIndex !== -1 ? firstIncompleteIndex : 0;
      console.log('Setting current activity index to:', newIndex, 'activity:', activities[newIndex]);
      setCurrentActivityIndex(newIndex);
    } else {
      console.error('Cannot start session - invalid state:', { totalPercentage, activitiesLength: activities.length });
    }
  };

  const pauseResumeTimer = () => {
    setIsPaused(prev => !prev);
  };

  const resetSession = useCallback(() => {
    setIsTimerActive(false);
    setIsPaused(false);
    setVaultTime(0);
  initialTotalAllocatedRef.current = 0; // clear baseline on reset
    const totalMins = calculateTotalSessionMinutes();
    setActivities((prev) =>
      prev.map((activity) => ({
        ...activity,
        timeRemaining: activity.countUp ? 0 : Math.round((activity.percentage / 100) * totalMins) * 60,
        isCompleted: false,
        completedElapsedSeconds: 0,
      })),
    );
    setCurrentActivityIndex(0);
    
    // Clear session state from localStorage
    try {
      localStorage.removeItem('timeSliceSessionState');
    } catch (e) {
      console.error('Failed to clear session state from localStorage:', e);
    }
  }, [calculateTotalSessionMinutes]);

  const switchToActivity = (index) => {
    if (!activities[index].isCompleted) {
      setCurrentActivityIndex(index);
    }
  };

  const selectRandomActivity = useCallback(() => {
    const availableIndices = activities.reduce((acc, activity, index) => {
      if (!activity.isCompleted && index !== currentActivityIndex) {
        acc.push(index);
      }
      return acc;
    }, []);

    if (availableIndices.length > 0) {
      const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      setCurrentActivityIndex(randomIndex);
    }
  }, [activities, currentActivityIndex]);

  const handleCompleteActivity = (activityId: string) => {
    let timeToVault = 0;
    let completedActivity: Activity | null = null;
    const updatedActivities = activities.map(act => {
      if (act.id === activityId && !act.isCompleted) {
        // Compute actual elapsed seconds for this activity
        const plannedSec = (!act.countUp)
          ? Math.max(0, Math.round((Number(act.duration || 0)) * 60))
          : 0;
        let elapsedSec = 0;
        if (act.countUp) {
          elapsedSec = Math.max(0, act.timeRemaining || 0);
        } else {
          const tr = typeof act.timeRemaining === 'number' ? act.timeRemaining : plannedSec;
          // Include overtime if negative remaining
          elapsedSec = tr >= 0 ? Math.max(0, plannedSec - tr) : (plannedSec + Math.abs(tr));
        }

        // Preserve this elapsed for rendering after completion
        const preserved = Math.round(elapsedSec);

        // Vault only meaningful positive remaining for countdown; for count-up, don't siphon elapsed time to vault
        if (!act.countUp) {
          // Only vault positive remaining
          timeToVault = Math.max(0, act.timeRemaining || 0);
        }

        // For completed activities:
        // - freeze timeRemaining to 0 for countdown (already consumed)
        // - for count-up, keep timeRemaining as elapsed so dynamic modes still show contribution
        // - mark isCompleted
        completedActivity = {
          ...act,
          timeRemaining: act.countUp ? preserved : 0,
          isCompleted: true,
          completedElapsedSeconds: preserved,
        };
        return completedActivity;
      }
      return act;
    });

  if (timeToVault > 0) {
      setVaultTime(prev => prev + timeToVault);
    }

    setActivities(updatedActivities);

    // Shared progress sync will be handled by useEffect

    const allCompleted = updatedActivities.every(a => a.isCompleted);
    if (allCompleted) {
      setIsTimerActive(false);
      // Clear session state when all activities are completed
      try {
        localStorage.removeItem('timeSliceSessionState');
      } catch (e) {
        console.error('Failed to clear session state:', e);
      }
      return;
    }

  if (updatedActivities[currentActivityIndex].isCompleted) {
      const nextIndex = updatedActivities.findIndex((act) => !act.isCompleted);
      if (nextIndex !== -1) {
        setCurrentActivityIndex(nextIndex);
      } else {
        setIsTimerActive(false);
        // Clear session state when no more activities
        try {
          localStorage.removeItem('timeSliceSessionState');
        } catch (e) {
          console.error('Failed to clear session state:', e);
        }
      }
    }
  };

  const handleBorrowTime = (amountInSeconds) => {
    setVaultTime(prev => prev - amountInSeconds);
    setActivities(prev => prev.map(act => {
      if (act.id === borrowModalState.activityId) {
        return { ...act, timeRemaining: act.timeRemaining + amountInSeconds };
      }
      return act;
    }));
    setBorrowModalState({ isOpen: false, activityId: '' });
  };

  // Removed complex color picker system - using simple random colors like quick add works perfectly

  // Removed addFavoriteColor function - using simple random colors instead

  const handleBarDrag = useCallback((e) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();

    let segmentIndex = -1;
    let cumulativePercentage = 0;
    for (let i = 0; i < activities.length - 1; i++) {
      cumulativePercentage += activities[i].percentage;
      const handlePosition = rect.left + (cumulativePercentage / 100) * rect.width;
      if (Math.abs(e.clientX - handlePosition) < 8) {
        segmentIndex = i;
        break;
      }
    }

    if (segmentIndex === -1) return;

    const leftActivity = activities[segmentIndex];
    const rightActivity = activities[segmentIndex + 1];

    if (leftActivity.isLocked && rightActivity.isLocked) {
      return;
    }

    const handleMouseMove = (moveEvent) => {
      moveEvent.preventDefault();

      const mousePercentage = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const prefixPercentage = activities.slice(0, segmentIndex).reduce((sum, act) => sum + act.percentage, 0);

      if (!leftActivity.isLocked && !rightActivity.isLocked) {
        const newLeftPercentage = mousePercentage - prefixPercentage;
        const combinedOriginal = leftActivity.percentage + rightActivity.percentage;
        const newRightPercentage = combinedOriginal - newLeftPercentage;

        if (newLeftPercentage >= 0 && newRightPercentage >= 0) {
          setActivities(prev => prev.map(act => {
            if (act.id === leftActivity.id) return { ...act, percentage: newLeftPercentage };
            if (act.id === rightActivity.id) return { ...act, percentage: newRightPercentage };
            return act;
          }));
        }
      } else if (!leftActivity.isLocked) {
        const newLeftPercentage = mousePercentage - prefixPercentage;
        if (newLeftPercentage >= 0) {
          updateAndScalePercentages(leftActivity.id, newLeftPercentage);
        }
      } else { // !rightActivity.isLocked
        const newRightPercentage = prefixPercentage + leftActivity.percentage + rightActivity.percentage - mousePercentage;
        if (newRightPercentage >= 0) {
          updateAndScalePercentages(rightActivity.id, newRightPercentage);
        }
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [activities]);

  const getTotalRemainingTime = () => {
    // Predicted end time should be based on remaining planned work only.
    // - Ignore completed activities
    // - Ignore count-up activities (they represent elapsed, not remaining)
    // - Do NOT include vault time (banked time isn't a commitment)
    return activities.reduce((sum, activity) => {
      if (activity.isCompleted) return sum;
      if (activity.countUp) return sum;
      return sum + Math.max(0, activity.timeRemaining || 0);
    }, 0);
  };

  const getOverallProgress = () => {
    // Prefer stable baseline captured at session start
    const liveAllocated = activities.reduce((sum, act) => sum + getAllocatedSeconds(act), 0);
    const totalAllocatedSeconds = initialTotalAllocatedRef.current > 0 ? initialTotalAllocatedRef.current : liveAllocated;
  if (!Number.isFinite(totalAllocatedSeconds) || totalAllocatedSeconds <= 0) return 0;
    // Compute elapsed as baseline minus remaining to avoid drift from changing allocations
    const totalRemaining = activities.reduce((sum, act) => {
      if (act.countUp) return sum; // count-up doesn't contribute to baseline
      return sum + Math.max(0, act.timeRemaining || 0);
    }, 0);
    const totalElapsedSeconds = Math.max(0, totalAllocatedSeconds - totalRemaining);
    const pct = (totalElapsedSeconds / totalAllocatedSeconds) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  const getDailyOverallProgress = () => {
    if (dailyActivities.length === 0) return 0;
    
    const totalPlannedMinutes = dailyActivities.reduce((sum, activity) => sum + activity.duration, 0);
    if (totalPlannedMinutes === 0) return 0;
    
    const totalSpentMinutes = dailyActivities.reduce((sum, activity) => {
      // If activity is completed, count it as fully completed regardless of actual time spent
      if (activity.status === 'completed') {
        return sum + activity.duration;
      }
      // For other activities, use real time spent
      const realTimeSpent = getRealTimeSpent(activity);
      return sum + realTimeSpent;
    }, 0);
    
    return Math.min(100, (totalSpentMinutes / totalPlannedMinutes) * 100);
  };

  // Helper function to calculate remaining time for incomplete activities
  const getRemainingPlannedMinutes = () => {
    return dailyActivities.reduce((sum, activity) => {
      // Skip completed activities - they don't contribute to remaining time
      if (activity.status === 'completed') {
        return sum;
      }
      
      // For active or scheduled activities, calculate remaining time
      const realTimeSpent = getRealTimeSpent(activity);
      const remainingTime = Math.max(0, activity.duration - realTimeSpent);
      return sum + remainingTime;
    }, 0);
  };

  // Ensure currentActivityIndex is valid and currentActivity exists
  const validCurrentActivityIndex = Math.max(0, Math.min(currentActivityIndex, activities.length - 1));
  const currentActivity = activities[validCurrentActivityIndex] || null;

  // If no current activity exists, this indicates a serious state issue
  if (isTimerActive && !currentActivity) {
    console.error('Timer is active but no current activity found. Activities:', activities, 'currentActivityIndex:', currentActivityIndex);
    // Reset to first incomplete activity or first activity
    const firstIncompleteIndex = activities.findIndex(a => !a.isCompleted);
    if (firstIncompleteIndex !== -1) {
      setCurrentActivityIndex(firstIncompleteIndex);
    } else if (activities.length > 0) {
      setCurrentActivityIndex(0);
    } else {
      // No activities at all - this should never happen
      setIsTimerActive(false);
    }
    return <div className="text-center text-red-500">Loading...</div>;
  }

  const activityProgress = currentActivity?.duration > 0 ? ((currentActivity.duration * 60 - Math.max(0, currentActivity.timeRemaining)) / (currentActivity.duration * 60)) * 100 : 0;

  const mainContent = currentPage === 'manage-activities' ? (
    <ActivityManagementPage
      activityTemplates={activityTemplates}
      setActivityTemplates={setActivityTemplates}
      activities={activities}
      setActivities={setActivities}
      onBackToTimer={() => setCurrentPage('timer')}
      onAddToSession={handleAddToCurrentSession}
      onAddToDaily={handleAddToDaily}
      onAddToBoth={handleAddToBoth}
  customCategories={customCategories}
  setCustomCategories={setCustomCategories}
  customTags={customTags}
  setCustomTags={setCustomTags}
    />
  ) : currentPage === 'spider' ? (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <CardTitle className="text-2xl font-bold">RPG Balance</CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCurrentPage('timer')}>Back</Button>
        </div>
      </div>
      {(() => {
        const rpgBalance = getRPGBalance();
        // Determine which tags to show on the chart
        const usedTagIds = new Set<string>([
          ...activities.flatMap(a => a.tags || []),
          ...dailyActivities.flatMap(a => a.tags || []),
          ...activityTemplates.flatMap(t => t.tags || []),
        ]);
        const customTagNames = new Set((customTags || []).map(t => t.toLowerCase()));
        const hasAnyRelevantTags = rpgBalance.current.length > 0;
        // Filter by used tags if any; else fall back to tags that exist in Manage Activities
        const statsToUse = usedTagIds.size > 0
          ? rpgBalance.current.filter(s => rpgTags.find(rt => rt.name === s.tagName && usedTagIds.has(rt.id)))
          : rpgBalance.current.filter(s => customTagNames.has(s.tagName.toLowerCase()));
        const suggestedToUse = usedTagIds.size > 0
          ? rpgBalance.suggested.filter(s => rpgTags.find(rt => rt.name === s.tagName && usedTagIds.has(rt.id)))
          : rpgBalance.suggested.filter(s => customTagNames.has(s.tagName.toLowerCase()));
        if (!hasAnyRelevantTags) {
          return (
            <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-md">
              No tags yet. Create tags in Manage Activities or add some to activities to see the chart.
            </div>
          );
        }
  const finalStats = statsToUse.length ? statsToUse : rpgBalance.current;
  const finalSuggested = suggestedToUse.length ? suggestedToUse : rpgBalance.suggested;
        return (
          <RPGStatsChart 
            stats={finalStats}
            suggestedStats={finalSuggested}
            activities={activities}
            dailyActivities={dailyActivities}
            rpgTags={rpgTags}
            size={800}
          />
        );
      })()}
    </div>
  ) : isTimerActive ? (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg sm:text-xl">TimeSlice Timer</CardTitle>
            <div className="flex space-x-1 sm:space-x-2">
              <Button variant="outline" size="sm" onClick={pauseResumeTimer} className="h-7 w-16 sm:h-8 sm:w-20 text-xs">
                <Icon name={isPaused ? "play" : "pause"} className="h-3 w-3 mr-1" />
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button variant="outline" size="sm" onClick={resetSession} className="h-7 w-14 sm:h-8 sm:w-16 text-xs">
                <Icon name="rotateCcw" className="h-3 w-3 mr-1" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={selectRandomActivity}
                disabled={activities.filter(a => !a.isCompleted).length <= 1}
                className="h-7 w-16 sm:h-8 sm:w-20 text-xs"
              >
                <Icon name="dice" className="h-3 w-3 mr-1" />
                Random
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {settings.showMainProgress && (
            settings.progressView === 'circular' ? (
              <CircularProgress
                activities={activities}
                style={settings.progressBarStyle}
                totalProgress={getOverallProgress()}
                activityProgress={activityProgress}
                activityColor={currentActivity?.color}
                totalSessionMinutes={totalSessionMinutes}
                currentActivityIndex={currentActivityIndex}
              />
            ) : (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Overall Progress</span>
                  <span>{Math.round(getOverallProgress())}%</span>
                </div>
                <VisualProgress
                  activities={activities}
                  style={settings.progressBarStyle}
                  className="h-3"
                  overallProgress={getOverallProgress()}
                  currentActivityColor={currentActivity?.color}
                  totalSessionMinutes={totalSessionMinutes}
                  currentActivityIndex={currentActivityIndex}
                />
              </div>
            )
          )}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" style={{ backgroundColor: currentActivity?.color }} />
              <h2 className="text-xl sm:text-2xl font-bold">{currentActivity?.name}</h2>
            </div>
            {settings.showActivityTimer && (
              <div className="text-4xl sm:text-5xl font-mono font-bold text-slate-800">{currentActivity?.isCompleted ? "COMPLETED" : formatTime(currentActivity?.timeRemaining || 0)}</div>
            )}
            {isPaused && <Badge variant="secondary" className="text-sm sm:text-base px-3 py-1">PAUSED</Badge>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-center">
            <div className="space-y-0.5">
              <div className="text-xs text-gray-600">Time Vault</div>
              <div className="text-lg font-semibold text-green-600">{formatTime(vaultTime)}</div>
              {vaultTime > 0 && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-1 h-6 text-xs px-2" 
                  onClick={() => setBorrowModalState({ isOpen: true, activityId: currentActivity?.id || '' })}
                  title="Borrow time from vault"
                >
                  <Icon name="arrowUpDown" className="h-3 w-3 mr-1" />
                  Borrow
                </Button>
              )}
            </div>
            {settings.showEndTime && (
              <div className="space-y-0.5">
                <div className="text-xs text-gray-600">Predicted End</div>
                <div className="text-lg font-semibold">{getPredictedEndTime()}</div>
              </div>
            )}
          </div>
          <Separator />
          
          {/* Flowmodoro Rest Timer - now behaves like other activities */}
          <FlowmodoroActivity 
            flowState={flowmodoroState}
            settings={settings}
            onTakeBreak={takeFlowmodoroBreak}
            onSkipBreak={skipFlowmodoroBreak}
            onReset={resetFlowmodoroState}
            isTimerActive={isTimerActive}
            formatTime={formatTime}
          />
          
          <div className="space-y-1">
            <h3 className="font-semibold text-sm">Activities</h3>
            <div className="space-y-1">{activities.map((activity, index) => {
                const activityProgress = activity.duration > 0 ? ((activity.duration * 60 - Math.max(0, activity.timeRemaining)) / (activity.duration * 60)) * 100 : 0;
                const displayProgress = settings.activityProgressType === 'fill' ? activityProgress : 100 - activityProgress;
                const anyOvertime = activities.some(a => (a.timeRemaining ?? 0) < 0);
                const isNonCurrentWhileOvertime = anyOvertime && index !== currentActivityIndex;
                // Compute numeric time spent for completed items to show in the switcher
                const spentForCompleted = (() => {
                  if (!activity.isCompleted) return 0;
                  if (Number.isFinite(activity.completedElapsedSeconds)) return Math.max(0, activity.completedElapsedSeconds || 0);
                  if (activity.countUp) return Math.max(0, activity.timeRemaining || 0);
                  const plannedSec = Math.max(0, Math.round((Number(activity.duration || 0)) * 60));
                  const tr = typeof activity.timeRemaining === 'number' ? (activity.timeRemaining as number) : 0;
                  const elapsed = tr >= 0 ? Math.max(0, plannedSec - tr) : (plannedSec + Math.abs(tr));
                  return Math.max(0, Math.round(elapsed));
                })();
                return (
                  <div
                    key={activity.id}
                    className={`relative overflow-hidden flex items-center justify-between p-2 rounded-lg border transition-colors ${index === currentActivityIndex && !activity.isCompleted ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                      } ${activity.isCompleted ? 'bg-green-50 text-gray-500 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !activity.isCompleted && switchToActivity(index)}
                  >
        {settings.showActivityProgress && (
                      <div
                        className="absolute top-0 left-0 h-full"
                        style={{
          // Always show actual drain level here to reflect real progress per activity
          width: `${activity.isCompleted ? 100 : displayProgress}%`,
                          backgroundColor: activity.color,
          opacity: index === currentActivityIndex ? 0.25 : 0.18,
          transition: 'width 0.5s linear, opacity 0.25s linear'
                        }}
                      />
                    )}
                    <div className="flex items-center space-x-2 z-10">
                      <input type="checkbox" className="h-4 w-4 rounded text-slate-600 focus:ring-slate-500" checked={activity.isCompleted} disabled={activity.isCompleted} onChange={() => handleCompleteActivity(activity.id)} />
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activity.color }} />
                      <span className="font-semibold text-sm">{activity.name}</span>
                    </div>
                    <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                      {settings.showActivityTime && (
                        <span className="text-xs font-mono z-10">
                          {activity.isCompleted
                            ? formatTime(spentForCompleted)
                            : formatTime(activity.timeRemaining)}
                        </span>
                      )}
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSiphonModalState({
                            isOpen: true,
                            sourceActivityId: activity.id,
                            targetActivityId: 'vault',
                            targetIsVault: true
                          });
                        }}
                        disabled={activity.countUp || activity.timeRemaining <= 0}
                        title="Transfer time to vault"
                        className="bg-blue-100 hover:bg-blue-200 z-20 relative h-6 w-6 p-0"
                      >
                        <Icon name="arrowUpDown" className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" onClick={() => addActivity()} className="w-full mt-1 bg-blue-50 border-blue-200 hover:bg-blue-100 h-8 text-sm">
              <Icon name="plus" className="h-3 w-3 mr-2" />
              Add Activity
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  ) : (
    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
            <CardTitle className="text-2xl sm:text-3xl font-bold">TimeSlice</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage('manage-activities')} className="flex-1 sm:flex-none h-9 text-sm">
                <Icon name="settings" className="h-4 w-4 mr-2" />
                Manage Activities
              </Button>
              {/* Spider Chart button removed */}
              {/* RPG Stats button removed */}
              <Button variant="outline" size="sm" onClick={() => {
                console.log("showSettings before toggle:", showSettings);
                setShowSettings(!showSettings);
              }} className="flex-1 sm:flex-none h-9 text-sm">
                <Icon name="settings" className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-4 sm:p-6">
          {showSettings && (
            <Card className="bg-gray-50">
              <CardHeader>
                <CardTitle className="text-lg">Timer Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Overtime Behavior</Label>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={settings.overtimeType === 'none' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({ ...prev, overtimeType: 'none' }))}>Off</Button>
                    <Button size="sm" variant={settings.overtimeType === 'postpone' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({ ...prev, overtimeType: 'postpone' }))}>Postpone</Button>
                    <Button size="sm" variant={settings.overtimeType === 'drain' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({ ...prev, overtimeType: 'drain' }))}>Drain</Button>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Progress View</Label>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={settings.progressView === 'linear' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({ ...prev, progressView: 'linear' }))}>Linear</Button>
                    <Button size="sm" variant={settings.progressView === 'circular' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({ ...prev, progressView: 'circular' }))}>Circular</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Progress Bar Style</Label>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={settings.progressBarStyle === 'default' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({ ...prev, progressBarStyle: 'default' }))}>Default</Button>
                    <Button size="sm" variant={settings.progressBarStyle === 'dynamicColor' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({ ...prev, progressBarStyle: 'dynamicColor' }))}>Dynamic</Button>
                    <Button size="sm" variant={settings.progressBarStyle === 'segmented' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({ ...prev, progressBarStyle: 'segmented' }))}>Segmented</Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-allocation-percentage">Show allocation %</Label>
                  <Switch id="show-allocation-percentage" checked={settings.showAllocationPercentage} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, showAllocationPercentage: checked }))} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-progress">Show main progress bar</Label>
                  <Switch id="show-progress" checked={settings.showMainProgress} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, showMainProgress: checked }))} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-overall">Show overall remaining time</Label>
                  <Switch id="show-overall" checked={settings.showOverallTime} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, showOverallTime: checked }))} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-end">Show predicted end time</Label>
                  <Switch id="show-end" checked={settings.showEndTime} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, showEndTime: checked }))} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-activity-timer">Show activity timer display</Label>
                  <Switch id="show-activity-timer" checked={settings.showActivityTimer} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, showActivityTimer: checked }))} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-activity-progress">Show individual activity progress</Label>
                  <Switch id="show-activity-progress" checked={settings.showActivityProgress} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, showActivityProgress: checked }))} />
                </div>
                <div className="space-y-2">
                  <Label>Show Activity Time</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.showActivityTime}
                      onCheckedChange={checked => setSettings(s => ({ ...s, showActivityTime: checked }))}
                      id="show-activity-time-toggle"
                    />
                    <span className="text-sm">Show time remaining for each activity</span>
                  </div>
                </div>
                {settings.showActivityProgress && (
                  <div className="flex items-center justify-between pl-4">
                    <Label>Progress bar style</Label>
                    <div className="flex items-center gap-4">
                      <Button size="sm" variant={settings.activityProgressType === 'fill' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({ ...prev, activityProgressType: 'fill' }))}>Fill Up</Button>
                      <Button size="sm" variant={settings.activityProgressType === 'drain' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({ ...prev, activityProgressType: 'drain' }))}>Drain Down</Button>
                    </div>
                  </div>
                )}
                <Separator />
                <div className="space-y-2">
                  <Label>Mobile Zoom Level</Label>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={settings.mobileZoomLevel === 'compact' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({ ...prev, mobileZoomLevel: 'compact' }))}>Compact</Button>
                    <Button size="sm" variant={settings.mobileZoomLevel === 'normal' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({ ...prev, mobileZoomLevel: 'normal' }))}>Normal</Button>
                    <Button size="sm" variant={settings.mobileZoomLevel === 'large' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({ ...prev, mobileZoomLevel: 'large' }))}>Large</Button>
                  </div>
                  <p className="text-xs text-gray-500">Adjust interface size for better mobile experience</p>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold text-purple-700">Flowmodoro Rest Timer</Label>
                      <p className="text-sm text-gray-600">Automatically earn rest time while working</p>
                    </div>
                    <Switch 
                      id="flowmodoro-enabled"
                      checked={settings.flowmodoroEnabled} 
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, flowmodoroEnabled: checked }))}
                    />
                  </div>
                  
                  {settings.flowmodoroEnabled && (
                    <div className="pl-4 space-y-3 border-l-2 border-purple-200">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                          <Label>Work:Rest Ratio</Label>
                          <div className="flex items-center space-x-2">
                            <Input 
                              type="number" 
                              min="2" 
                              max="10" 
                              value={settings.flowmodoroRatio}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                  setSettings(prev => ({ ...prev, flowmodoroRatio: 5 }));
                                } else {
                                  setSettings(prev => ({ ...prev, flowmodoroRatio: Math.max(2, Math.min(10, Number(value) || 5)) }));
                                }
                              }}
                              onBlur={(e) => {
                                const value = Number(e.target.value) || 5;
                                setSettings(prev => ({ ...prev, flowmodoroRatio: Math.max(2, Math.min(10, value)) }));
                              }}
                              className="w-16"
                            />
                            <span className="text-sm text-gray-600">:1 (work:rest)</span>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <Label>Max Progress Time</Label>
                          <div className="flex items-center space-x-2">
                            <Input 
                              type="number" 
                              min="10" 
                              max="120" 
                              value={settings.flowmodoroMaxProgressMinutes}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                  setSettings(prev => ({ ...prev, flowmodoroMaxProgressMinutes: 30 }));
                                } else {
                                  setSettings(prev => ({ ...prev, flowmodoroMaxProgressMinutes: Math.max(10, Math.min(120, Number(value) || 30)) }));
                                }
                              }}
                              onBlur={(e) => {
                                const value = Number(e.target.value) || 30;
                                setSettings(prev => ({ ...prev, flowmodoroMaxProgressMinutes: Math.max(10, Math.min(120, value)) }));
                              }}
                              className="w-16"
                            />
                            <span className="text-sm text-gray-600">minutes (time for progress bar to reach 100%)</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Controls when dynamic scaling transitions from configured ratio to 1:1. Longer tasks benefit from higher values.</p>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label>Show Progress Bar</Label>
                          <Switch 
                            id="flowmodoro-show-progress"
                            checked={settings.flowmodoroShowProgress} 
                            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, flowmodoroShowProgress: checked }))}
                          />
                        </div>
                        
                        {settings.flowmodoroShowProgress && (
                          <div className="space-y-2">
                            <Label>Progress Bar Style</Label>
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm" 
                                variant={settings.flowmodoroProgressType === 'fill' ? 'default' : 'outline'} 
                                onClick={() => setSettings(prev => ({ ...prev, flowmodoroProgressType: 'fill' }))}
                              >
                                Fill Up
                              </Button>
                              <Button 
                                size="sm" 
                                variant={settings.flowmodoroProgressType === 'drain' ? 'default' : 'outline'} 
                                onClick={() => setSettings(prev => ({ ...prev, flowmodoroProgressType: 'drain' }))}
                              >
                                Drain Down
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        <Separator />
                        
                        <div className="space-y-2">
                          <Label>Daily Reset Times</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Start Time</Label>
                              <Input 
                                type="time" 
                                value={settings.flowmodoroResetStartTime}
                                onChange={(e) => setSettings(prev => ({ ...prev, flowmodoroResetStartTime: e.target.value }))}
                                className="text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">End Time</Label>
                              <Input 
                                type="time" 
                                value={settings.flowmodoroResetEndTime}
                                onChange={(e) => setSettings(prev => ({ ...prev, flowmodoroResetEndTime: e.target.value }))}
                                className="text-sm"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            Rest time resets at these times each day
                          </p>
                        </div>
                        
                        <div className="pt-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={resetFlowmodoroState}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            Reset Today's Rest Time
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold text-green-700">Daily Mode Settings</Label>
                      <p className="text-sm text-gray-600">Configure how daily activities are displayed</p>
                    </div>
                  </div>
                  
                  <div className="pl-4 space-y-3 border-l-2 border-green-200">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <Label className="text-sm font-medium">Show Activity Progress Bars</Label>
                        <p className="text-xs text-gray-500 mt-1">Display progress indicators on activity cards</p>
                      </div>
                      <Switch 
                        id="daily-show-activity-progress"
                        checked={settings.dailyShowActivityProgress} 
                        onCheckedChange={(checked) => setSettings(prev => ({ ...prev, dailyShowActivityProgress: checked }))}
                      />
                    </div>
                    
                    {settings.dailyShowActivityProgress && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Progress Bar Style</Label>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant={settings.dailyActivityProgressType === 'fill' ? 'default' : 'outline'} 
                            onClick={() => setSettings(prev => ({ ...prev, dailyActivityProgressType: 'fill' }))}
                            className="flex-1 h-9 text-sm"
                            style={{ touchAction: 'manipulation' }}
                          >
                            📈 Fill Up
                          </Button>
                          <Button 
                            size="sm" 
                            variant={settings.dailyActivityProgressType === 'drain' ? 'default' : 'outline'} 
                            onClick={() => setSettings(prev => ({ ...prev, dailyActivityProgressType: 'drain' }))}
                            className="flex-1 h-9 text-sm"
                            style={{ touchAction: 'manipulation' }}
                          >
                            📉 Drain Down
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          <strong>Fill Up:</strong> Progress bar fills as time is spent.<br/>
                          <strong>Drain Down:</strong> Progress bar drains showing time remaining.
                        </p>
                      </div>
                    )}
                    
                    {/* Timeline Animation Setting */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <Label className="text-sm font-medium">Timeline Animation</Label>
                        <p className="text-xs text-gray-500 mt-1">Activities shrink and slide when running (like session mode)</p>
                      </div>
                      <Switch 
                        id="daily-timeline-animation"
                        checked={settings.dailyTimelineAnimation} 
                        onCheckedChange={(checked) => setSettings(prev => ({ ...prev, dailyTimelineAnimation: checked }))}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {/* Mode Selector */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <span className="text-xs sm:text-sm font-medium">Mode:</span>
              <Button 
                size="sm" 
                variant={currentMode === 'session' ? 'default' : 'outline'}
                className={`h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3 ${currentMode === 'session' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                onClick={() => setCurrentMode('session')}
              >
                Session
              </Button>
              <Button 
                size="sm" 
                variant={currentMode === 'daily' ? 'default' : 'outline'}
                className={`h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3 ${currentMode === 'daily' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                onClick={() => setCurrentMode('daily')}
              >
                Daily
              </Button>
              <Button 
                size="sm" 
                variant={currentMode === 'single' ? 'default' : 'outline'}
                className={`h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3 ${currentMode === 'single' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                onClick={() => setCurrentMode('single')}
              >
                Single
              </Button>
              <Button 
                size="sm" 
                variant={currentMode === 'flowmodoro' ? 'default' : 'outline'}
                className={`h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3 ${currentMode === 'flowmodoro' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border-purple-400 text-purple-600 hover:bg-purple-50'}`}
                onClick={() => setCurrentMode('flowmodoro')}
                title="Standalone Flowmodoro timer - use your earned break time"
              >
                <span className="hidden sm:inline">🌟 Flowmodoro</span>
                <span className="sm:hidden">🌟 Flow</span>
              </Button>
            </div>

            {currentMode === 'session' ? (
              // Session Mode Content
              <>
                <h2 className="text-lg sm:text-xl font-semibold">Session Duration</h2>
                <div className="flex items-center gap-2 mb-2">
                  <Button size="sm" variant={durationType === 'duration' ? 'default' : 'outline'} onClick={() => setDurationType('duration')} className="h-9 text-sm flex-1 sm:flex-none">Set Duration</Button>
                  <Button size="sm" variant={durationType === 'endTime' ? 'default' : 'outline'} onClick={() => setDurationType('endTime')} className="h-9 text-sm flex-1 sm:flex-none">Set End Time</Button>
                </div>
              </>
            ) : currentMode === 'daily' ? (
              // Daily Mode Content
              <>
                <h2 className="text-lg sm:text-xl font-semibold">Daily Progress</h2>
                
                {/* Current Time Display */}
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-semibold text-blue-800">
                    Current Time: {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </div>
                  <div className="text-sm text-blue-600">Until Reset (00:30): {Math.floor((24 * 60 - (currentTime.getHours() * 60 + currentTime.getMinutes()) + 30) / 60)}h {(24 * 60 - (currentTime.getHours() * 60 + currentTime.getMinutes()) + 30) % 60}m remaining</div>
                </div>

                {/* Flowmodoro Rest Timer for Daily Mode */}
                {settings.flowmodoroEnabled && (
                  <FlowmodoroActivity 
                    flowState={flowmodoroState}
                    settings={settings}
                    onTakeBreak={takeFlowmodoroBreak}
                    onSkipBreak={skipFlowmodoroBreak}
                    onReset={resetFlowmodoroState}
                    isTimerActive={!!activeDailyActivity}
                    formatTime={formatTime}
                  />
                )}

                {/* Dynamic Timeline Bar */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-md font-semibold">Daily Timeline</h3>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-emerald-600">
                        {Math.round(getDailyOverallProgress())}%
                      </span>
                      <span className="ml-1">complete</span>
                    </div>
                  </div>
                  
                  {/* Improved Timeline Bar - Clickable */}
                  <div 
                    className="relative h-24 bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-gray-300 transition-colors"
                    onClick={() => setTimelineViewMode(prev => prev === 'scheduled' ? 'full' : 'scheduled')}
                    title={`Click to toggle view: ${timelineViewMode === 'scheduled' ? 'Show full day with unscheduled time' : 'Show only scheduled activities'}`}
                  >
                    {/* Overall Progress Overlay */}
                    <div 
                      className={`absolute top-0 left-0 h-full timeline-progress-overlay z-10 ${
                        activeDailyActivity ? 'active' : ''
                      }`}
                      style={{ 
                        width: `${getDailyOverallProgress()}%`
                      }}
                      title={`Daily Progress: ${Math.round(getDailyOverallProgress())}% complete`}
                    />

                    {/* NOW Indicator (Fixed at start) */}
                    <div 
                      className="absolute top-0 w-1 h-full bg-red-500 z-30 shadow-lg"
                      style={{ left: '0%' }}
                      title="NOW"
                    >
                      <div className="absolute -top-7 -left-3 text-xs font-bold text-red-600 bg-white px-1 rounded shadow">NOW</div>
                    </div>
                    
                    {/* Flowmodoro Rest Time Bar (if enabled) */}
                    {settings.flowmodoroEnabled && (
                      <div 
                        className="absolute bottom-0 left-0 h-2 bg-gradient-to-r from-purple-400 to-purple-600 z-15 rounded-b-lg"
                        style={{ 
                          width: `${(() => {
                            const now = new Date();
                            const totalRemainingMinutes = 24 * 60 - (now.getHours() * 60 + now.getMinutes()) + 30;
                            const availableRestPercentage = (flowmodoroState.availableRestMinutes / totalRemainingMinutes) * 100;
                            return Math.min(availableRestPercentage, 100);
                          })()}%` 
                        }}
                        title={`Available Rest Time: ${Math.floor(flowmodoroState.availableRestTime / 60)}m ${flowmodoroState.availableRestTime % 60}s earned`}
                      >
                        <div className="absolute -top-5 left-2 text-xs text-purple-600 font-medium">
                          {Math.floor(flowmodoroState.availableRestTime / 60)}m {flowmodoroState.availableRestTime % 60}s rest earned
                        </div>
                      </div>
                    )}

                    {/* Timeline Content */}
                    {(() => {
                      const now = new Date();
                      const totalRemainingMinutes = 24 * 60 - (now.getHours() * 60 + now.getMinutes()) + 30;
                      const totalPlannedMinutes = dailyActivities.reduce((sum, a) => sum + a.duration, 0);
                      
                      if (timelineViewMode === 'scheduled') {
                        // Show only scheduled activities, filling the entire bar
                        // Always show consistent view regardless of active state
                        let currentPosition = 0;
                        return dailyActivities.map((activity) => {
                          const activityWidth = (activity.duration / totalPlannedMinutes) * 100;
                          const isActive = activity.status === 'active' || activity.status === 'overtime';
                          const realTimeSpent = getRealTimeSpent(activity);
                          const progress = activity.duration > 0 ? Math.min(100, (realTimeSpent / activity.duration) * 100) : 0;
                          
                          const element = (
                            <div 
                              key={activity.id}
                              className={`absolute top-0 h-full border-r border-white z-15 ${
                                isActive ? 'ring-2 ring-yellow-300' : ''
                              }`}
                              style={{ 
                                left: `${currentPosition}%`, 
                                width: `${activityWidth}%`
                              }}
                              title={`${activity.name} - ${activity.duration}m planned${isActive ? ' (ACTIVE)' : ''}`}
                            >
                              {/* Background segment with reduced opacity */}
                              <div 
                                style={{ backgroundColor: activity.color }} 
                                className="h-full opacity-30"
                              />
                              
                              {/* Progress fill with full activity color */}
                              <div 
                                className={`absolute top-0 left-0 h-full smooth-progress ${
                                  isActive ? 'real-time-active' : ''
                                }`}
                                style={{ 
                                  width: `${progress}%`,
                                  backgroundColor: activity.color
                                }}
                              />
                              
                              {/* Activity label */}
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-xs font-medium z-10">
                                <div className="truncate px-1">{activity.name}</div>
                                <div className="text-xs opacity-75">
                                  {isActive && activity.status === 'overtime' ? 'OVERTIME' : 
                                   isActive ? 'ACTIVE' : 
                                   `${activity.duration}m`}
                                </div>
                              </div>
                            </div>
                          );
                          currentPosition += activityWidth;
                          return element;
                        });
                      } else {
                        // Show full day view with unscheduled time
                        const plannedPercentageOfDay = Math.min((totalPlannedMinutes / totalRemainingMinutes) * 100, 95);
                        const unscheduledPercentage = Math.max(100 - plannedPercentageOfDay, 5);
                        
                        return (
                          <>
                            {/* Planned Activities Section */}
                            <div 
                              className="absolute top-0 h-full bg-blue-50 border-r-2 border-blue-300 z-5"
                              style={{ left: '0%', width: `${plannedPercentageOfDay}%` }}
                              title={`Planned activities: ${Math.floor(totalPlannedMinutes / 60)}h ${totalPlannedMinutes % 60}m`}
                            >
                              <div className="absolute top-1 left-1 text-xs font-medium text-blue-700">
                                Scheduled ({Math.floor(totalPlannedMinutes / 60)}h {totalPlannedMinutes % 60}m)
                              </div>
                            </div>
                            
                            {/* Activities within planned section */}
                            {(() => {
                              // Always show consistent view regardless of active state
                              let currentPosition = 0;
                              return dailyActivities.map((activity) => {
                                const activityWidth = (activity.duration / totalPlannedMinutes) * plannedPercentageOfDay;
                                const isActive = activity.status === 'active' || activity.status === 'overtime';
                                const realTimeSpent = getRealTimeSpent(activity);
                                const progress = activity.duration > 0 ? Math.min(100, (realTimeSpent / activity.duration) * 100) : 0;
                                
                                const element = (
                                  <div 
                                    key={activity.id}
                                    className={`absolute top-0 h-full z-15 ${
                                      isActive ? 'ring-2 ring-yellow-300' : ''
                                    }`}
                                    style={{ 
                                      left: `${currentPosition}%`, 
                                      width: `${activityWidth}%`
                                    }}
                                    title={`${activity.name} - ${activity.duration}m planned${isActive ? ' (ACTIVE)' : ''}`}
                                  >
                                    {/* Background segment with reduced opacity */}
                                    <div 
                                      style={{ backgroundColor: activity.color }} 
                                      className="h-full opacity-30"
                                    />
                                    
                                    {/* Progress fill with full activity color */}
                                    <div 
                                      className={`absolute top-0 left-0 h-full smooth-progress ${
                                        isActive ? 'real-time-active' : ''
                                      }`}
                                      style={{ 
                                        width: `${progress}%`,
                                        backgroundColor: activity.color
                                      }}
                                    />
                                    
                                    {/* Activity label */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-xs font-medium z-10">
                                      <div className="font-medium">{activity.name}</div>
                                      <div className="text-xs">
                                        {isActive && activity.status === 'overtime' ? 'OVERTIME' : 
                                         isActive ? 'ACTIVE' : 
                                         `${activity.duration}m`}
                                      </div>
                                    </div>
                                  </div>
                                );
                                currentPosition += activityWidth;
                                return element;
                              });
                            })()}
                            
                            {/* Unscheduled Free Time Section */}
                            <div 
                              className="absolute top-0 h-full bg-gradient-to-r from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 text-sm font-medium z-5"
                              style={{ 
                                left: `${plannedPercentageOfDay}%`, 
                                width: `${unscheduledPercentage}%` 
                              }}
                              title={`Free time: ${Math.round((totalRemainingMinutes - totalPlannedMinutes) / 60 * 10) / 10}h until 0:30`}
                            >
                              <div className="text-center">
                                <div className="font-medium">Free Time</div>
                                <div className="text-xs opacity-75">
                                  {Math.round((totalRemainingMinutes - totalPlannedMinutes) / 60 * 10) / 10}h unscheduled
                                </div>
                              </div>
                            </div>
                            
                            {/* Visual separator between planned and free time */}
                            <div 
                              className="absolute top-0 w-1 h-full bg-blue-400 z-25"
                              style={{ left: `${plannedPercentageOfDay}%` }}
                              title="Scheduled | Free time boundary"
                            />
                          </>
                        );
                      }
                    })()}
                    
                    {/* Overall Progress Overlay when animation is disabled - show individual activity progress */}
                    {!settings.dailyTimelineAnimation && (() => {
                      const now = new Date();
                      const totalRemainingMinutes = 24 * 60 - (now.getHours() * 60 + now.getMinutes()) + 30;
                      const totalPlannedMinutes = dailyActivities.reduce((sum, a) => sum + a.duration, 0);
                      const plannedPercentageOfDay = (totalPlannedMinutes / totalRemainingMinutes) * 100;
                      let currentPosition = 0;
                      
                      return dailyActivities.map((activity) => {
                        const activityWidth = (activity.duration / totalPlannedMinutes) * plannedPercentageOfDay;
                        const realTimeSpent = getRealTimeSpent(activity);
                        const progress = activity.duration > 0 ? Math.min(100, (realTimeSpent / activity.duration) * 100) : 0;
                        const progressWidth = (progress / 100) * activityWidth;
                        
                        const element = (
                          <div 
                            key={`progress-${activity.id}`}
                            className="absolute top-0 h-full z-20 transition-all duration-1000"
                            style={{ 
                              left: `${currentPosition}%`, 
                              width: `${progressWidth}%`,
                              backgroundColor: activity.color,
                              opacity: 0.8
                            }}
                            title={`${activity.name}: ${Math.round(progress)}% complete`}
                          />
                        );
                        currentPosition += activityWidth;
                        return element;
                      });
                    })()}
                  </div>
                  
                  {/* Time Display below Timeline */}
                  <div className="flex justify-between items-center text-sm font-medium">
                    <div className="text-blue-600">
                      Current: {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </div>
                    <div className="text-gray-600">
                      {timelineViewMode === 'scheduled' ? (() => {
                        // For scheduled only mode: show predicted end time based on remaining activities
                        const remainingMinutes = getRemainingPlannedMinutes();
                        const endTime = new Date(currentTime.getTime() + remainingMinutes * 60000);
                        return `Predicted End: ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
                      })() : (() => {
                        // For full day mode: show end of activities and end of day
                        const remainingMinutes = getRemainingPlannedMinutes();
                        const activitiesEndTime = new Date(currentTime.getTime() + remainingMinutes * 60000);
                        const endOfDay = new Date();
                        endOfDay.setHours(0, 30, 0, 0);
                        endOfDay.setDate(endOfDay.getDate() + 1);
                        return `Activities End: ${activitiesEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} | Day End: ${endOfDay.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
                      })()}
                    </div>
                  </div>
                  
                  {/* Timeline Info */}
                  <div className="flex justify-between items-center text-xs text-gray-500 bg-blue-50 p-2 rounded">
                    <span>
                      {activeDailyActivity ? (() => {
                        const activeActivity = dailyActivities.find(a => a.id === activeDailyActivity);
                        const timelineData = getActiveActivityTimelinePosition();
                        return `▶ ${activeActivity?.name || 'Activity'} - ${timelineData.timeRemaining}m left (${Math.round(timelineData.consumed)}% done)`;
                      })() : `▶ Click "Start" to begin timeline tracking`}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="bg-blue-100 px-2 py-1 rounded text-blue-700 font-medium cursor-pointer" 
                            onClick={() => setTimelineViewMode(prev => prev === 'scheduled' ? 'full' : 'scheduled')}
                            title="Click timeline bar or here to toggle view">
                        📊 View: {timelineViewMode === 'scheduled' ? 'Scheduled Only' : 'Full Day + Free Time'}
                      </span>
                      <span>
                        {(() => {
                          const now = new Date();
                          const totalRemainingMinutes = 24 * 60 - (now.getHours() * 60 + now.getMinutes()) + 30;
                          const totalPlannedMinutes = dailyActivities.reduce((sum, a) => sum + a.duration, 0);
                          const utilizationRate = Math.round((totalPlannedMinutes / totalRemainingMinutes) * 100);
                          return `Day Utilization: ${utilizationRate}%`;
                        })()}
                      </span>
                      {settings.flowmodoroEnabled && (
                        <span className="text-purple-600">
                          Rest: {Math.floor(flowmodoroState.availableRestTime / 60)}m {flowmodoroState.availableRestTime % 60}s earned
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Activity Controls - Session Mode Style */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-md font-semibold">Today's Activities</h3>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-xs">Auto-Schedule</Button>
                      <Badge variant="default" className="text-xs">
                        Total: {(() => {
                          const summary = getDailySummary();
                          return `${summary.totalPlannedHours}h ${summary.totalPlannedMinutes}m (${Math.round(summary.totalPlannedPercentage)}%)`;
                        })()}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Tag filter/search */}
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={tagQuery}
                      onChange={(e) => setTagQuery(e.target.value)}
                      placeholder="Filter by tag..."
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <Button size="sm" variant="outline" onClick={() => {
                      const q = tagQuery.trim().toLowerCase();
                      if (!q) return;
                      if (!tagFilter.includes(q)) setTagFilter([...tagFilter, q]);
                      setTagQuery('');
                    }}>Add Filter</Button>
                    {tagFilter.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tagFilter.map(t => (
                          <span key={t} className="px-2 py-0.5 bg-slate-200 rounded-full text-xs flex items-center gap-1">
                            #{t}
                            <button onClick={() => setTagFilter(tagFilter.filter(x => x !== t))} className="text-slate-600 hover:text-slate-900">×</button>
                          </span>
                        ))}
                        <button className="text-xs text-blue-600" onClick={() => setTagFilter([])}>Clear</button>
                      </div>
                    )}
                  </div>
                  {/* Dynamic Activity Cards */}
                  <div className="space-y-2">
                    {(tagFilter.length ? dailyActivities.filter(a => (a.tags || []).some(t => tagFilter.includes(String(t).toLowerCase()))) : dailyActivities).map((activity) => {
                      // Calculate activity progress for daily mode with real-time updates
                      const realTimeSpent = getRealTimeSpent(activity);
                      
                      // Enhanced progress calculation with better persistence
                      let actualProgress = 0;
                      if (activity.duration > 0) {
                        if (activity.status === 'active' && activity.startedAt) {
                          // For active activities, include real-time seconds
                          const currentSessionSeconds = Math.floor((currentTime.getTime() - activity.startedAt) / 1000);
                          const totalSecondsSpent = currentSessionSeconds + (activity.timeSpent * 60);
                          actualProgress = (totalSecondsSpent / (activity.duration * 60)) * 100;
                        } else {
                          // For paused/completed activities, use accumulated timeSpent
                          actualProgress = (realTimeSpent / activity.duration) * 100;
                        }
                        actualProgress = Math.min(100, Math.max(0, actualProgress));
                      }
                      
                      // Fix: For drain mode, show remaining progress (100 - filled percentage)
                      const displayProgress = settings.dailyActivityProgressType === 'fill' ? 
                        actualProgress : 
                        Math.max(0, 100 - actualProgress);
                      
                      // Calculate earned rest time for this activity (if flowmodoro enabled)
                      const earnedRestMinutes = settings.flowmodoroEnabled ? 
                        Math.floor(realTimeSpent / settings.flowmodoroRatio) : 0;
                      
          return (
          <div key={activity.id} className={`relative overflow-hidden border rounded-lg p-3 transition-all duration-200 ${
                        activity.status === 'completed'
                          ? 'border-green-200 hover:bg-green-100 cursor-pointer completion-glow'
                          : activity.status === 'overtime'
                            ? 'border-red-300 shadow-md ring-1 ring-red-200 cursor-pointer'
                          : activity.status === 'active' 
                            ? 'border-blue-400 shadow-md ring-1 ring-blue-200 cursor-pointer' 
            : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                      } ${
                        // Add animation effects when enabled and activity is active
                        settings.dailyTimelineAnimation && activity.status === 'active' 
                          ? 'transform scale-90 -translate-x-4 shadow-xl transition-all duration-500' 
                          : 'transition-all duration-300'
          } ${settings.showRolloverIndicators && activity.rolledOverFromYesterday ? 'border-dashed border-2' : ''}`}
                      style={{
                        backgroundColor: activity.status === 'completed' ? '#f0fdf4' : 
                                       activity.status === 'overtime' ? '#fef2f2' :
               activity.status === 'active' ? '#eff6ff' : (activity.rolledOverFromYesterday ? '#fafafa' : '#ffffff'),
                        boxShadow: activity.status === 'completed' ? '0 0 15px rgba(34, 197, 94, 0.3)' : undefined
                      }}
                      onClick={() => {
                        if (activity.status === 'scheduled') {
                          startDailyActivity(activity.id);
                        } else if (activity.status === 'active' || activity.status === 'overtime') {
                          stopDailyActivity();
                        }
                      }}
                      >
                        {/* Enhanced Real-time Progress Bar */}
                        {settings.dailyShowActivityProgress && (
                          <div 
                            className={`absolute top-0 left-0 h-full rounded-lg smooth-progress ${
                              activity.status === 'active' ? 'real-time-fill progress-pulse' : 
                              activity.status === 'completed' ? 'completion-glow' : ''
                            }`}
                            style={{ 
                              width: `${Math.max(3, Math.min(100, activity.status === 'completed' ? 100 : displayProgress))}%`, 
                              backgroundColor: activity.status === 'completed' ? '#22c55e' : activity.color,
                              opacity: activity.status === 'completed' ? 0.9 : 
                                      activity.status === 'active' ? 0.85 : 0.8,
                              transition: activity.status === 'active' ? 'width 0.1s linear, opacity 0.3s ease' : 'all 0.3s ease'
                            }}
                          />
                        )}
                        
                        {/* Completion burst effect */}
                        {activity.status === 'completed' && settings.dailyShowActivityProgress && (
                          <div 
                            className="absolute inset-0 completion-burst rounded-lg pointer-events-none"
                            style={{ 
                              backgroundColor: 'transparent',
                              border: '2px solid #22c55e'
                            }}
                          />
                        )}
                        
                        {/* Real-time progress indicator for active activities */}
                        {activity.status === 'active' && activity.startedAt && (
                          <div className="absolute top-1 right-1 z-20">
                            <div className="flex items-center gap-1 bg-blue-600 bg-opacity-90 text-white text-xs px-2 py-1 rounded-md">
                              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                              <span className="font-mono">
                                {(() => {
                                  const currentSessionSeconds = Math.floor((currentTime.getTime() - activity.startedAt) / 1000);
                                  const totalSecondsSpent = currentSessionSeconds + (activity.timeSpent * 60);
                                  const progress = Math.min(100, (totalSecondsSpent / (activity.duration * 60)) * 100);
                                  return `${Math.round(progress)}%`;
                                })()}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Compact Card Content */}
                        <div className="relative z-10">
                          {/* Top row: Activity name, status badge, and action buttons */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: activity.color }}></div>
                              <span className="font-medium text-sm truncate flex-1">{activity.name}</span>
                              {activity.sharedId && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
                                  Shared
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Status badge */}
                              <Badge variant={
                                activity.status === 'completed' ? 'default' :
                                activity.status === 'overtime' ? 'destructive' :
                                activity.status === 'active' ? 'default' : 'secondary'
                              } className={`text-xs px-1.5 py-0.5 ${
                                activity.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' :
                                activity.status === 'overtime' ? 'bg-red-100 text-red-800 border-red-200' :
                                activity.status === 'active' ? 'bg-blue-100 text-blue-800 border-blue-200' : ''
                              }`}>
                                {activity.status === 'completed' ? '✓' : 
                                 activity.status === 'overtime' ? '⚠' :
                                 activity.status === 'active' ? '▶' : '⏸'}
                              </Badge>
                              
                              {/* Quick action buttons */}
                              <button 
                                className="h-6 w-6 text-blue-500 hover:bg-blue-100 rounded-md flex items-center justify-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDailyActivityEdit(activity.id);
                                }}
                                title="Edit"
                              >
                                <Icon name="edit" className="h-3 w-3" />
                              </button>
                              
                              <button 
                                className="h-6 w-6 text-red-500 hover:bg-red-50 rounded-md flex items-center justify-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeDailyActivity(activity.id);
                                }}
                                title="Delete"
                              >
                                <Icon name="x" className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          
                          {/* Bottom row: Compact info display */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              {/* Tags (chips) */}
                              {settings.showTagChips && activity.tags && activity.tags.length > 0 && (
                                <div className="hidden sm:flex flex-wrap items-center gap-1">
                                  {activity.tags.map((t, idx) => (
                                    <span key={idx} className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">#{String(t).toLowerCase()}</span>
                                  ))}
                                </div>
                              )}
                              {/* Duration */}
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">Duration:</span>
                                <span className="font-medium">
                                  {Math.floor(activity.duration / 60)}h {activity.duration % 60}m
                                </span>
                              </div>
                              
                              {/* Progress/Time spent */}
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">Progress:</span>
                                <span className={`font-medium ${
                                  activity.status === 'overtime' ? 'text-red-600' : 
                                  activity.status === 'active' ? 'text-blue-600' : 
                                  activity.status === 'completed' ? 'text-green-600' : 'text-gray-600'
                                }`}>
                                  {(() => {
                                    const realTimeSpent = getRealTimeSpent(activity);
                                    if (realTimeSpent > 0) {
                                      const progress = Math.round((realTimeSpent / activity.duration) * 100);
                                      return `${Math.floor(realTimeSpent / 60)}h ${realTimeSpent % 60}m (${progress}%)`;
                                    } else {
                                      return '0m (0%)';
                                    }
                                  })()}
                                </span>
                              </div>
                            </div>
                            
                            {/* Completion checkbox */}
                            <div className="flex items-center gap-1">
                              <input 
                                type="checkbox" 
                                className={`h-3 w-3 rounded text-green-600 focus:ring-green-500 ${
                                  !areAllSubtasksCompleted(activity) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                }`} 
                                checked={activity.status === 'completed'} 
                                disabled={!areAllSubtasksCompleted(activity)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (areAllSubtasksCompleted(activity)) {
                                    toggleDailyActivityCompletion(activity.id);
                                  }
                                }} 
                                title={
                                  !areAllSubtasksCompleted(activity) 
                                    ? "Complete all subtasks first to unlock main task completion" 
                                    : "Mark this activity as completed"
                                }
                              />
                              <span className={`text-gray-500 ${!areAllSubtasksCompleted(activity) ? 'opacity-50' : ''}`}>
                                Done {!areAllSubtasksCompleted(activity) && activity.subtasks && activity.subtasks.length > 0 ? 
                                  `(${activity.subtasks.filter(s => s.completed).length}/${activity.subtasks.length} subtasks)` : 
                                  ''
                                }
                              </span>
                            </div>
                          </div>
                          
                          {/* Real-time countdown for active activities */}
                          {activity.status === 'active' && activity.startedAt && (
                            <div className="mt-1 text-xs">
                              {(() => {
                                const totalSpentSeconds = getRealTimeSpentInSeconds(activity);
                                const remainingSeconds = (activity.duration * 60) - totalSpentSeconds;
                                
                                if (remainingSeconds > 0) {
                                  return (
                                    <span className="text-blue-600 font-mono">
                                      Time left: {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, '0')}
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span className="text-red-600 font-bold font-mono animate-pulse">
                                      OVERTIME: +{Math.floor(Math.abs(remainingSeconds) / 60)}:{(Math.abs(remainingSeconds) % 60).toString().padStart(2, '0')}
                                    </span>
                                  );
                                }
                              })()}
                            </div>
                          )}
                          
                          {/* Flowmodoro rest indicator */}
                          {settings.flowmodoroEnabled && earnedRestMinutes > 0 && (
                            <div className="mt-1 text-xs">
                              <span className="text-purple-600 font-medium">
                                Rest earned: +{earnedRestMinutes}m
                              </span>
                            </div>
                          )}

                          {/* Subtasks Display */}
                          {activity.subtasks && activity.subtasks.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="text-xs text-gray-500 mb-1">
                                Subtasks ({activity.subtasks.filter(s => s.completed).length}/{activity.subtasks.length})
                              </div>
                              <div className="space-y-1 max-h-20 overflow-y-auto">
                                {activity.subtasks.map((subtask) => (
                                  <div
                                    key={subtask.id}
                                    className="flex items-center gap-2 text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={subtask.completed}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        toggleSubtaskCompletion(activity.id, subtask.id);
                                      }}
                                      className="h-3 w-3 rounded text-green-600 focus:ring-green-500"
                                    />
                                    <span
                                      className={`flex-1 ${
                                        subtask.completed
                                          ? 'line-through text-green-600'
                                          : 'text-gray-700'
                                      }`}
                                    >
                                      {subtask.name}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeSubtaskFromActivity(activity.id, subtask.id);
                                      }}
                                      className="text-red-500 hover:text-red-700 p-0.5"
                                      title="Remove subtask"
                                    >
                                      <Icon name="x" className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Quick Add Subtask */}
                          <div className="mt-2 text-xs">
                            <div className="flex gap-1">
                              <input
                                type="text"
                                placeholder="Add subtask..."
                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.stopPropagation();
                                    const target = e.target as HTMLInputElement;
                                    if (target.value.trim()) {
                                      addSubtaskToActivity(activity.id, target.value);
                                      target.value = '';
                                    }
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                  if (input.value.trim()) {
                                    addSubtaskToActivity(activity.id, input.value);
                                    input.value = '';
                                  }
                                }}
                                className="px-2 py-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded"
                                title="Add subtask"
                              >
                                <Icon name="plus" className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })}

                    {/* Quick Add New Activity Card */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 p-3 hover:bg-gray-100 cursor-pointer transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <button 
                          onClick={openDailyActivityAdd}
                          className="w-6 h-6 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center hover:border-blue-500 hover:bg-blue-50 transition-colors"
                          title="Add Activity"
                        >
                          <Icon name="plus" className="h-3 w-3 text-gray-500 hover:text-blue-500" />
                        </button>
                        <input 
                          type="text" 
                          placeholder="Quick add activity (press Enter)" 
                          className="font-medium bg-transparent border-none outline-none flex-1 text-gray-700 placeholder-gray-500"
                          onKeyPress={(e) => {
                            const target = e.target as HTMLInputElement;
                            if (e.key === 'Enter' && target.value.trim()) {
                              quickAddDailyActivity(target.value);
                              target.value = '';
                            }
                          }}
                        />
                        <button 
                          onClick={openDailyActivityAdd}
                          className="text-blue-500 hover:text-blue-700 transition-colors text-sm"
                        >
                          Advanced
                        </button>
                        <Badge variant="outline" className="text-xs text-gray-500">Smart-schedule</Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        Type activity name and press Enter to smart-schedule, or click Advanced for detailed setup
                      </div>
                    </div>
                  </div>
                </div>

                {/* Today's Summary */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-3">Today's Analytics</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <div className="text-blue-600">Total Planned</div>
                      <div className="font-semibold text-blue-800">
                        {(() => {
                          const summary = getDailySummary();
                          return `${summary.totalPlannedHours}h ${summary.totalPlannedMinutes}m (${Math.round(summary.totalPlannedPercentage)}%)`;
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-blue-600">Time Spent</div>
                      <div className="font-semibold text-blue-800">
                        {(() => {
                          const summary = getDailySummary();
                          const hours = Math.floor(summary.totalSpentMinutes / 60);
                          const minutes = summary.totalSpentMinutes % 60;
                          return summary.totalSpentMinutes > 0 ? `${hours}h ${minutes}m` : 'None';
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-blue-600">Completion Rate</div>
                      <div className="font-semibold text-blue-800">
                        {(() => {
                          const summary = getDailySummary();
                          return `${Math.round(summary.completionRate)}% (${summary.completedActivities}/${summary.totalActivities})`;
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-blue-600">Efficiency</div>
                      <div className="font-semibold text-blue-800">
                        {(() => {
                          const summary = getDailySummary();
                          return `${Math.round(summary.efficiency)}%`;
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Overtime Warning (if any) */}
                  {(() => {
                    const summary = getDailySummary();
                    if (summary.overtimeActivities > 0) {
                      return (
                        <div className="bg-red-100 border border-red-200 rounded-lg p-3 mb-3">
                          <div className="flex items-center gap-2 text-red-800">
                            <Icon name="alertTriangle" className="h-4 w-4" />
                            <span className="font-medium">Overtime Alert</span>
                          </div>
                          <div className="text-sm text-red-700 mt-1">
                            {summary.overtimeActivities} activities went overtime by {Math.floor(summary.totalOvertimeMinutes / 60)}h {summary.totalOvertimeMinutes % 60}m total
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-blue-600">
                      <span>Daily Progress</span>
                      <span>{(() => {
                        const summary = getDailySummary();
                        return `${Math.round(summary.efficiency)}%`;
                      })()}</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(() => {
                          const summary = getDailySummary();
                          return Math.min(100, summary.efficiency);
                        })()}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </>
            ) : currentMode === 'single' ? (
              // Single Activity Mode Content
              <SingleActivityMode 
                singleState={singleActivityState}
                onStart={startSingleActivity}
                onComplete={completeSingleActivity}
                onCancel={cancelSingleActivity}
                flowmodoroState={flowmodoroState}
                formatTime={formatTime}
                settings={settings}
              />
            ) : currentMode === 'flowmodoro' ? (
              // Standalone Flowmodoro Mode Content
              <FlowmodoroMode 
                flowmodoroState={flowmodoroState}
                onTakeBreak={takeFlowmodoroBreak}
                onSkipBreak={skipFlowmodoroBreak}
                onReset={resetFlowmodoroState}
                formatTime={formatTime}
              />
            ) : null}
          </div>

          {currentMode === 'session' && (
            <>
              <div className="space-y-4">
                {durationType === 'duration' ? (
              <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:items-center sm:gap-6">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="hours" className="text-sm font-medium">Hours:</Label>
                  <Input 
                    id="hours" 
                    type="number" 
                    min="0" 
                    max="12" 
                    value={totalHours} 
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty string during editing
                      if (value === '') {
                        setTotalHours(0);
                      } else {
                        setTotalHours(Number.parseInt(value) || 0);
                      }
                    }}
                    onBlur={(e) => {
                      // Ensure valid value on blur
                      const value = Number.parseInt(e.target.value) || 0;
                      setTotalHours(Math.max(0, Math.min(12, value)));
                    }}
                    className="w-20 h-9 text-sm" 
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="minutes" className="text-sm font-medium">Minutes:</Label>
                  <Input 
                    id="minutes" 
                    type="number" 
                    min="0" 
                    max="59" 
                    value={totalMinutes} 
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty string during editing
                      if (value === '') {
                        setTotalMinutes(0);
                      } else {
                        setTotalMinutes(Number.parseInt(value) || 0);
                      }
                    }}
                    onBlur={(e) => {
                      // Ensure valid value on blur
                      const value = Number.parseInt(e.target.value) || 0;
                      setTotalMinutes(Math.max(0, Math.min(59, value)));
                    }}
                    className="w-20 h-9 text-sm" 
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Label htmlFor="end-time" className="text-sm font-medium">End Time:</Label>
                <Input id="end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-32 h-9 text-sm" />
              </div>
            )}
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              Total session will be <span className="font-semibold">{totalSessionMinutes} minutes</span>.
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-semibold">Time Allocation</h2>
              <Button size="sm" variant="outline" onClick={() => setSettings(s => ({ ...s, showTimeAllocationPanel: !s.showTimeAllocationPanel}))} className="h-8 text-xs">
                {settings.showTimeAllocationPanel ? 'Hide' : 'Show'}
              </Button>
            </div>
            {settings.showTimeAllocationPanel && (
            <>
            {/* RPG Balance Chart button removed for simplified UI */}
            {(() => {
              const rpgBalance = getRPGBalance();
              const usedTagIds = new Set<string>([
                ...activities.flatMap(a => a.tags || []),
                ...dailyActivities.flatMap(a => a.tags || []),
                ...activityTemplates.flatMap(t => t.tags || []),
              ]);
              const customTagNames = new Set((customTags || []).map(t => t.toLowerCase()));
              const hasAnyRelevantTags = rpgBalance.current.length > 0;
              const statsToUse = usedTagIds.size > 0
                ? rpgBalance.current.filter(s => rpgTags.find(rt => rt.name === s.tagName && usedTagIds.has(rt.id)))
                : rpgBalance.current.filter(s => customTagNames.has(s.tagName.toLowerCase()));
              const suggestedToUse = usedTagIds.size > 0
                ? rpgBalance.suggested.filter(s => rpgTags.find(rt => rt.name === s.tagName && usedTagIds.has(rt.id)))
                : rpgBalance.suggested.filter(s => customTagNames.has(s.tagName.toLowerCase()));
              if (!hasAnyRelevantTags) {
                return (
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                    No tags yet. Create tags in Manage Activities or add some to activities to see the chart.
                  </div>
                );
              }
              const finalStats = statsToUse.length ? statsToUse : rpgBalance.current;
              const finalSuggested = suggestedToUse.length ? suggestedToUse : rpgBalance.suggested;
              return (
                <RPGStatsChart 
                  stats={finalStats}
                  suggestedStats={finalSuggested}
                  activities={activities}
                  dailyActivities={dailyActivities}
                  rpgTags={rpgTags}
                  size={600}
                />
              );
            })()}
            </>
            )}
            <div
              className="relative h-16 sm:h-12 bg-gray-200 rounded-lg overflow-hidden flex"
              onMouseDown={handleBarDrag}
            >
              {activities.filter(activity => !activity.countUp).map((activity) => (
                <div
                  key={activity.id}
                  className="h-full flex items-center justify-center text-white font-medium text-sm transition-all duration-200 pointer-events-none"
                  style={{ width: `${activity.percentage}%`, backgroundColor: activity.color }}
                >
                  {settings.showAllocationPercentage && activity.percentage > 10 && `${Math.round(activity.percentage)}%`}
                </div>
              ))}
              {activities.filter(activity => !activity.countUp).slice(0, -1).map((_, index) => {
                const nonCountUpActivities = activities.filter(activity => !activity.countUp);
                const position = nonCountUpActivities.slice(0, index + 1).reduce((sum, a) => sum + a.percentage, 0);
                const isDividerLocked = nonCountUpActivities[index].isLocked && (nonCountUpActivities[index + 1] && nonCountUpActivities[index + 1].isLocked);
                return (
                  <div
                    key={index}
                    className={`absolute top-0 w-2 h-full transform -translate-x-1/2  
                            ${isDividerLocked
                        ? 'bg-slate-600/75 cursor-not-allowed'
                        : 'bg-white/50 border-x border-slate-400/50 cursor-col-resize'
                      }`}
                    style={{ left: `${position}%` }}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-semibold">Activities</h2>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleDistributeEqually} className="h-8 text-xs">Distribute</Button>
                <Badge variant={Math.abs(totalPercentage -  100) < 0.1 ? 'default' : 'destructive'} className="text-xs">
                  Total: {Math.round(totalPercentage)}%
                </Badge>
                <Button size="sm" variant="outline" onClick={() => setCurrentPage('spider')} className="h-8 text-xs">Spider</Button>
              </div>
            </div>
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="border rounded-lg bg-white p-3">
                  {/* First Row: Color + Name + Lock + Delete */}
                  <div className="flex items-center gap-3 mb-3">
                    <button 
                      className="w-8 h-8 rounded-full border-2 border-gray-300 hover:scale-110 transition-transform flex-shrink-0" 
                      style={{ backgroundColor: activity.color }} 
                      onClick={() => {
                        // Simple random color change - no complex picker
                        const colorPalette = [
                          'hsl(220, 70%, 50%)', // blue
                          'hsl(120, 60%, 50%)', // green
                          'hsl(280, 60%, 50%)', // purple
                          'hsl(0, 70%, 50%)',   // red
                          'hsl(60, 80%, 50%)',  // yellow
                          'hsl(320, 60%, 50%)', // pink
                          'hsl(250, 70%, 50%)'  // indigo
                        ];
                        const newColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
                        updateActivityColor(activity.id, newColor);
                      }} 
                    />

                    <Input 
                      value={activity.name} 
                      onChange={(e) => updateActivityName(activity.id, e.target.value)} 
                      onBlur={(e) => {
                        // If name is empty on blur, set default
                        if (!e.target.value.trim()) {
                          updateActivityName(activity.id, "New Activity");
                        }
                      }}
                      className="flex-1 h-9 text-sm" 
                      placeholder="Activity name" 
                    />

                    <Button variant="ghost" size="sm" onClick={() => toggleLockActivity(activity.id)} className="h-9 w-9 p-0 flex-shrink-0">
                      <Icon name={activity.isLocked ? 'lock' : 'unlock'} className={`h-4 w-4 ${activity.isLocked ? 'text-red-500' : ''}`} />
                    </Button>

                    <Button variant="outline" size="sm" onClick={() => removeActivity(activity.id)} disabled={activities.length === 1} className="h-9 w-9 p-0 flex-shrink-0">
                      <Icon name="trash2" className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Second Row: Percentage + Minutes */}
                  <div className="flex items-center justify-center gap-6">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0" max="100" step="1"
                        value={Math.round(activity.percentage)}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Allow empty string during editing
                          if (value === '') {
                            updateAndScalePercentages(activity.id, 0);
                          } else {
                            updateAndScalePercentages(activity.id, Number.parseFloat(value) || 0);
                          }
                        }}
                        onBlur={(e) => {
                          // Ensure valid value on blur
                          const value = Number.parseFloat(e.target.value) || 0;
                          updateAndScalePercentages(activity.id, Math.max(0, Math.min(100, value)));
                        }}
                        className="w-20 h-9 text-sm text-center"
                        disabled={activity.isLocked || activity.countUp}
                      />
                      <span className="text-sm text-gray-600 font-medium">%</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0" step="1"
                        value={activity.duration}
                        onChange={(e) => {
                          const totalMins = calculateTotalSessionMinutes();
                          if (totalMins > 0) {
                            const newDur = Number.parseInt(e.target.value) || 0;
                            const cappedDur = Math.min(newDur, totalMins);
                            const newPerc = (cappedDur / totalMins) * 100;
                            updateAndScalePercentages(activity.id, newPerc);
                          }
                        }}
                        className="w-20 h-9 text-sm text-center"
                        disabled={activity.isLocked || activity.countUp}
                      />
                      <span className="text-sm text-gray-600 font-medium">min</span>
                    </div>
                  </div>

                  {/* Category/Tags/Save controls removed; use Add New Activity modal instead */}

                  {/* Third Row: Count Up Timer Checkbox */}
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <input
                      type="checkbox"
                      id={`countup-${activity.id}`}
                      className="w-4 h-4"
                      checked={activity.countUp || false}
                      onChange={() => toggleCountUpActivity(activity.id)}
                    />
                    <label htmlFor={`countup-${activity.id}`} className="text-sm text-gray-600 font-medium">
                      Count up
                    </label>
                    {activity.countUp && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full ml-2">
                        Excluded from % calculation
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={() => addActivity()} className="w-full bg-transparent h-10 text-sm">
              <Icon name="plus" className="h-5 w-5 mr-2" />
              Add Activity
            </Button>
          </div>

          <div className="flex justify-center pt-6">
            <Button 
              size="lg" 
              onClick={startSession} 
              disabled={Math.abs(totalPercentage - 100) > 0.1} 
              className="w-full sm:w-auto px-8 py-4 text-lg h-12"
            >
              <Icon name="play" className="h-6 w-6 mr-3" />
              Start Session
            </Button>
          </div>
              </>
            )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 font-sans">
      {mainContent}
      {/* Removed ColorPicker - using simple random colors instead */}
      {borrowModalState.isOpen && (
        <BorrowTimeModal
          isOpen={borrowModalState.isOpen}
          onClose={() => setBorrowModalState({ isOpen: false, activityId: '' })}
          onBorrow={handleBorrowTime}
          maxTime={vaultTime}
          activityName={activities.find(a => a.id === borrowModalState.activityId)?.name || ''}
        />
      )}
      {siphonModalState.isOpen && (
        <SiphonTimeModal
          isOpen={siphonModalState.isOpen}
          onClose={() => setSiphonModalState({ isOpen: false, sourceActivityId: '', targetActivityId: '', targetIsVault: false })}
          onSiphon={siphonTime}
          activities={activities}
          vaultTime={vaultTime}
          sourceActivityId={siphonModalState.sourceActivityId}
          targetActivityId={siphonModalState.targetActivityId}
          targetIsVault={siphonModalState.targetIsVault}
        />
      )}
      {addActivityModalState.isOpen && (
        <AddActivityModal
          isOpen={addActivityModalState.isOpen}
          onClose={() => setAddActivityModalState({ isOpen: false })}
          onAdd={handleAddActivityWithName}
          templates={activityTemplates}
          onSaveTemplate={saveActivityTemplate}
          customCategories={customCategories}
          customTags={customTags}
          onAddCategory={(name) => upsertCategory(name)}
          rpgTags={rpgTags}
          onAddRPGTag={(name, color) => {
            // Reuse addRPGTag with generated color if not supplied
            const c = color || `hsl(${Math.floor(Math.random()*360)}, 70%, 50%)`;
            addRPGTag(name, c);
          }}
          onAddCustomTag={(nm) => upsertTag(nm)}
        />
      )}
      
      {/* Step 15: Activity Settings Modal */}
      {activitySettingsModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Activity Settings</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0"
                  onClick={closeActivitySettings}
                >
                  <Icon name="x" className="h-4 w-4" />
                </Button>
              </div>
              
              {activitySettingsModal.activityData && (
                <ActivitySettingsForm 
                  activity={activitySettingsModal.activityData}
                  onSave={saveActivitySettings}
                  onDelete={deleteActivityFromSettings}
                  onCancel={closeActivitySettings}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Daily Activity Edit Modal */}
      {dailyActivityEditModal.isOpen && (
        <DailyActivityEditModal
          isOpen={dailyActivityEditModal.isOpen}
          onClose={closeDailyActivityEdit}
          activity={dailyActivityEditModal.activityData}
          onSave={saveDailyActivityEdit}
          onDelete={deleteDailyActivityFromEdit}
          isNewActivity={dailyActivityEditModal.isNewActivity}
        />
      )}
    </div>
  );
}

// Step 15: Activity Settings Form Component
const ActivitySettingsForm = ({ activity, onSave, onDelete, onCancel }) => {
  const [formData, setFormData] = useState({
    name: activity.name || '',
    color: activity.color || 'hsl(220, 70%, 50%)', // Use HSL like the activities
    duration: activity.duration || 60
  });

  // Use HSL colors that match the system
  const colorOptions = [
    { name: 'Blue', value: 'hsl(220, 70%, 50%)' },
    { name: 'Green', value: 'hsl(120, 60%, 50%)' },
    { name: 'Purple', value: 'hsl(280, 60%, 50%)' },
    { name: 'Red', value: 'hsl(0, 70%, 50%)' },
    { name: 'Yellow', value: 'hsl(60, 80%, 50%)' },
    { name: 'Pink', value: 'hsl(320, 60%, 50%)' },
    { name: 'Indigo', value: 'hsl(250, 70%, 50%)' },
    { name: 'Orange', value: 'hsl(30, 80%, 50%)' },
    { name: 'Teal', value: 'hsl(180, 60%, 50%)' },
    { name: 'Cyan', value: 'hsl(200, 70%, 50%)' },
    { name: 'Lime', value: 'hsl(90, 60%, 50%)' },
    { name: 'Emerald', value: 'hsl(160, 60%, 50%)' }
  ];

  const handleSave = () => {
    if (!formData.name.trim()) return;
    
    // Calculate new percentage based on duration
    const newPercentage = (formData.duration / (24 * 60)) * 100;
    
    onSave({
      ...activity,
      ...formData,
      percentage: Math.round(newPercentage * 10) / 10,
      name: formData.name.trim()
    });
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${activity.name}"?`)) {
      onDelete(activity.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Activity Name */}
      <div>
        <Label htmlFor="activity-name" className="text-sm font-medium">Activity Name</Label>
        <Input
          id="activity-name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter activity name"
          className="mt-1"
        />
      </div>

      {/* Color Selection */}
      <div>
        <Label className="text-sm font-medium">Color</Label>
        <div className="grid grid-cols-6 gap-2 mt-2">
          {colorOptions.map((colorOption) => (
            <button
              key={colorOption.value}
              className={`w-8 h-8 rounded-full border-2 hover:scale-110 transition-transform ${
                formData.color === colorOption.value ? 'border-gray-600 ring-2 ring-blue-200' : 'border-gray-300'
              }`}
              style={{ backgroundColor: colorOption.value }}
              onClick={() => setFormData(prev => ({ ...prev, color: colorOption.value }))}
              title={colorOption.name}
            />
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <Label htmlFor="activity-duration" className="text-sm font-medium">Duration (minutes)</Label>
        <Input
          id="activity-duration"
          type="number"
          min="5"
          max="720"
          value={formData.duration}
          onChange={(e) => setFormData(prev => ({ ...prev, duration: Number(e.target.value) || 60 }))}
          className="mt-1"
        />
        <div className="text-xs text-gray-500 mt-1">
          {Math.floor(formData.duration / 60)}h {formData.duration % 60}m 
          ({Math.round((formData.duration / (24 * 60)) * 100 * 10) / 10}% of day)
        </div>
      </div>

      {/* Activity Status Info */}
      <div className="bg-gray-50 p-3 rounded-lg">
        <div className="text-sm text-gray-600">Current Status</div>
        <div className="flex items-center gap-2 mt-1">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: activity.color }}
          ></div>
          <span className="font-medium">
            {activity.status === 'completed' ? '✓ Completed' : 
             activity.status === 'active' ? 'Currently Active' : 'Scheduled'}
          </span>
        </div>
        {activity.timeSpent > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            Time spent: {Math.floor(activity.timeSpent / 60)}h {activity.timeSpent % 60}m
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleDelete}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          <Icon name="trash2" className="h-4 w-4 mr-2" />
          Delete Activity
        </Button>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={!formData.name.trim()}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};
