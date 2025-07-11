import React, { useState, useEffect, useRef, useCallback } from "react";

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
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {icons[name]}
    </svg>
  );
};

const Button = ({ variant = 'default', size = 'default', className = '', children, ...props }) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  const sizeClasses = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
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
  <input className={`flex h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />
);

const Card = ({ className = '', children }) => <div className={`rounded-lg border bg-white text-slate-950 shadow-sm ${className}`}>{children}</div>;
const CardHeader = ({ className = '', children }) => <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>;
const CardTitle = ({ className = '', children }) => <h3 className={`text-2xl font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
const CardContent = ({ className = '', children }) => <div className={`p-6 pt-0 ${className}`}>{children}</div>;

const Separator = ({ className = '' }) => <hr className={`-mx-6 border-slate-200 ${className}`} />;

const Badge = ({ variant = 'default', className = '', children }) => {
    const variantClasses = {
        default: "border-transparent bg-slate-900 text-slate-50",
        secondary: "border-transparent bg-slate-100 text-slate-900",
        destructive: "border-transparent bg-red-500 text-slate-50",
    };
    return <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variantClasses[variant]} ${className}`}>{children}</div>;
};

const VisualProgress = ({ activities, style, className, overallProgress, currentActivityColor }) => {
    const totalDuration = activities.reduce((sum, act) => sum + act.duration * 60, 0);
    if (totalDuration === 0) {
        return <div className={`relative h-4 w-full overflow-hidden rounded-full bg-slate-100 ${className}`} />;
    }

    if (style === 'segmented') {
        return (
            <div className={`relative h-4 w-full overflow-hidden rounded-full flex bg-slate-100 ${className}`}>
                {activities.map((activity) => {
                    const segmentWidth = (activity.duration * 60 / totalDuration) * 100;
                    let fillWidth = 0;
                    if (activity.isCompleted) {
                        fillWidth = 100;
                    } else {
                        const elapsed = (activity.duration * 60) - activity.timeRemaining;
                        fillWidth = (elapsed / (activity.duration * 60)) * 100;
                    }

                    return (
                        <div key={activity.id} style={{ width: `${segmentWidth}%` }} className="h-full bg-slate-200 border-r-2 border-slate-500 last:border-r-0">
                            <div style={{ width: `${Math.max(0, fillWidth)}%`, backgroundColor: activity.color }} className="h-full" />
                        </div>
                    );
                })}
            </div>
        );
    }
    
    if (style === 'dynamicColor') {
        return (
            <div className={`relative h-4 w-full overflow-hidden rounded-full flex bg-slate-200 ${className}`}>
                {activities.map(activity => {
                    const elapsed = (activity.duration * 60) - Math.max(0, activity.timeRemaining);
                    const widthPercentage = (elapsed / totalDuration) * 100;
                    
                    if (widthPercentage === 0) return null;

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
        </div>
    );
};

const CircularProgress = ({ activities, style, totalProgress, activityProgress, activityColor }) => {
    const size = 200;
    const strokeWidth = 12;
    const center = size / 2;
    const radius = center - strokeWidth;
    const activityRadius = radius - strokeWidth - 4;
    const circumference = 2 * Math.PI * radius;
    const activityCircumference = 2 * Math.PI * activityRadius;
    const totalDuration = activities.reduce((sum, act) => sum + act.duration * 60, 0);

    const activityOffset = activityCircumference - (activityProgress / 100) * activityCircumference;

    // --- Divider lines for segmented style ---
    const renderSegmentDividers = () => {
        if (style !== 'segmented' || activities.length <= 1 || totalDuration === 0) return null;
        let accAngle = 0;
        const lines: React.ReactNode[] = [];
        for (let i = 0; i < activities.length - 1; i++) {
            const segmentAngle = (activities[i].duration * 60 / totalDuration) * 360;
            accAngle += segmentAngle;
            const angleRad = ((accAngle - 90) * Math.PI) / 180;
            const r0 = radius - strokeWidth / 2;
            const r1 = radius + strokeWidth / 2;
            const x0 = center + r0 * Math.cos(angleRad);
            const y0 = center + r0 * Math.sin(angleRad);
            const x1 = center + r1 * Math.cos(angleRad);
            const y1 = center + r1 * Math.sin(angleRad);
            lines.push(
                <path
                    key={`divider-${i}`}
                    d={`M${x0},${y0} L${x1},${y1}`}
                    stroke="#64748b"
                    strokeWidth={2}
                    opacity={0.85}
                    shapeRendering="crispEdges"
                />
            );
        }
        return <g id="segment-dividers">{lines}</g>;
    };

    const renderOuterRing = () => {
        if (totalDuration === 0) return null;

        if (style === 'dynamicColor') {
            let cumulativeRotation = -90;
            return activities.map(activity => {
                const elapsed = (activity.duration * 60) - Math.max(0, activity.timeRemaining);
                if (elapsed <= 0) return null;

                const progressAngle = (elapsed / totalDuration) * 360;
                const arcLength = (progressAngle / 360) * circumference;
                
                const rotation = cumulativeRotation;
                cumulativeRotation += progressAngle;

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
            let cumulativeRotation = -90;
            return activities.map(activity => {
                const segmentAngle = (activity.duration * 60 / totalDuration) * 360;
                const segmentArcLength = (segmentAngle / 360) * circumference;
                
                const elapsed = (activity.duration * 60) - Math.max(0, activity.timeRemaining);
                const progressWithinSegment = activity.duration > 0 ? (elapsed / (activity.duration * 60)) : 0;
                const fillAngle = segmentAngle * progressWithinSegment;
                const fillArcLength = (fillAngle / 360) * circumference;

                const rotation = cumulativeRotation;
                cumulativeRotation += segmentAngle;

                return (
                    <g key={`segment-${activity.id}`} transform={`rotate(${rotation} ${center} ${center})`}>
                        <circle
                            stroke="#e2e8f0"
                            fill="transparent"
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${segmentArcLength} ${circumference}`}
                            r={radius}
                            cx={center}
                            cy={center}
                            strokeLinecap="butt"
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Color Picker</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
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
                            <Input id="borrow-minutes" type="number" min="0" max={maxMinutes} value={minutes} onChange={e => setMinutes(Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="borrow-seconds">Seconds</Label>
                            <Input id="borrow-seconds" type="number" min="0" max="59" value={seconds} onChange={e => setSeconds(Number(e.target.value))} />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleBorrow}>Borrow</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};


// --- Main Application Component ---
export default function App() {
  const [activities, setActivities] = useState(() => {
    try {
      const savedActivities = localStorage.getItem('timeSliceActivities');
      if (savedActivities) {
        return JSON.parse(savedActivities);
      }
    } catch (e) {
      console.error("Failed to load activities from localStorage", e);
    }
    return [
      { id: "1", name: "Focus Work", percentage: 60, color: "hsl(220, 70%, 50%)", duration: 0, timeRemaining: 0, isCompleted: false, isLocked: false },
      { id: "2", name: "Break", percentage: 40, color: "hsl(120, 60%, 50%)", duration: 0, timeRemaining: 0, isCompleted: false, isLocked: false },
    ];
  });

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const swUrl = '/service-worker.js'; // Use absolute path
      navigator.serviceWorker.register(swUrl)
        .then(registration => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        })
        .catch(err => {
          console.log('ServiceWorker registration failed: ', err);
        });
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

  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [colorPickerState, setColorPickerState] = useState({ isOpen: false, activityId: "", currentColor: "" });
  const [favoriteColors, setFavoriteColors] = useState(() => {
  const defaultValue = [
    "hsl(220, 70%, 50%)", "hsl(120, 60%, 50%)", "hsl(0, 70%, 50%)", "hsl(280, 60%, 50%)", "hsl(40, 80%, 50%)",
  ];
  try {
    const saved = localStorage.getItem('timeSliceFavColors');
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
});

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
  const [borrowModalState, setBorrowModalState] = useState({ isOpen: false, activityId: '' });

// --- Start of State Saving Logic ---
useEffect(() => {
  try {
    localStorage.setItem('timeSliceActivities', JSON.stringify(activities));
  } catch (e) {
    console.error("Failed to save activities", e);
  }
}, [activities]);

useEffect(() => {
  try {
    localStorage.setItem('timeSliceSettings', JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings", e);
  }
}, [settings]);

useEffect(() => {
  try {
    localStorage.setItem('timeSliceFavColors', JSON.stringify(favoriteColors));
  } catch (e) {
    console.error("Failed to save favorite colors", e);
  }
}, [favoriteColors]);

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
  const lastDrainedIndex = useRef(-1);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

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
  const totalPercentage = activities.reduce((sum, activity) => sum + activity.percentage, 0);

  // This effect keeps durations in sync with percentages and total time
  const activityPercentages = activities.map(a => a.percentage).join(',');
  useEffect(() => {
    if (isTimerActive) return;
    const totalMins = calculateTotalSessionMinutes();
    setActivities(prev => prev.map(activity => {
        const newDuration = Math.round((activity.percentage / 100) * totalMins);
        return {
            ...activity,
            duration: newDuration,
            timeRemaining: newDuration * 60,
            isCompleted: false,
        };
    }));
  }, [activityPercentages, totalSessionMinutes, isTimerActive]);

  const handleTimerTick = useCallback(() => {
    setActivities(prev => {
        const now = Date.now();
        const elapsedSeconds = Math.round((now - lastTickTimestampRef.current) / 1000);
        lastTickTimestampRef.current = now;

        if (elapsedSeconds <= 0) return prev;

        let newActivities = [...prev];
        let secondsToProcess = elapsedSeconds;

        while (secondsToProcess > 0) {
            const current = newActivities[currentActivityIndex];
            if (!current) break;

            if (current.timeRemaining > 0) {
                const timeToTake = Math.min(secondsToProcess, current.timeRemaining);
                current.timeRemaining -= timeToTake;
                secondsToProcess -= timeToTake;
            }

            if (current.timeRemaining <= 0) {
                if (settings.overtimeType === 'drain') {
                    const donors = newActivities.map((act, index) => ({...act, originalIndex: index}))
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
                        current.isCompleted = true;
                        
                        const nextIndex = newActivities.findIndex(act => !act.isCompleted);
                        if (nextIndex !== -1) {
                            setCurrentActivityIndex(nextIndex);
                        } else {
                            setIsTimerActive(false);
                        }
                    }
                    secondsToProcess = 0; // Stop processing after completion
                }
            }
        }
        return newActivities;
    });
  }, [currentActivityIndex, settings.overtimeType]);

  // Main timer loop
  useEffect(() => {
    if (isTimerActive && !isPaused) {
        lastTickTimestampRef.current = Date.now();
        const interval = setInterval(handleTimerTick, 1000);
        return () => clearInterval(interval);
    }
  }, [isTimerActive, isPaused, handleTimerTick]);

  // Handle returning to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && isTimerActive && !isPaused) {
            handleTimerTick();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isTimerActive, isPaused, handleTimerTick]);
  
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
    return endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const addActivity = () => {
    const newActivity = {
      id: Date.now().toString(),
      name: "New Activity",
      percentage: 0,
      color: `hsl(${Math.floor(Math.random() * 360)}, 60%, 50%)`,
      duration: 0,
      timeRemaining: 0,
      isCompleted: false,
      isLocked: false,
    };
    setActivities(prev => [...prev, newActivity]);
  };

  const removeActivity = (id) => {
    if (activities.length > 1) {
      setActivities(activities.filter((activity) => activity.id !== id));
    }
  };

  const handleDistributeEqually = () => {
    const lockedTotal = activities.filter(a => a.isLocked).reduce((sum, a) => sum + a.percentage, 0);
    const unlockedActivities = activities.filter(a => !a.isLocked);
    const remainingPercentage = 100 - lockedTotal;
    const equalPercentage = unlockedActivities.length > 0 ? remainingPercentage / unlockedActivities.length : 0;
    
    setActivities(prev => prev.map(act => {
        if (act.isLocked) return act;
        return { ...act, percentage: equalPercentage };
    }));
  };

  const updateAndScalePercentages = (idOfChangedActivity, newPercentage) => {
    setActivities(prev => {
        const lockedTotal = prev.filter(a => a.isLocked).reduce((sum, a) => sum + a.percentage, 0);
        const maxAllowed = 100 - lockedTotal;
        const safeNewPercentage = Math.min(newPercentage, maxAllowed);

        const otherUnlockedActivities = prev.filter(a => !a.isLocked && a.id !== idOfChangedActivity);
        const otherUnlockedTotal = otherUnlockedActivities.reduce((sum, a) => sum + a.percentage, 0);
        
        const remainingForOthers = maxAllowed - safeNewPercentage;
        const scaleFactor = otherUnlockedTotal > 0 ? remainingForOthers / otherUnlockedTotal : 0;

        const updatedActivities = prev.map(act => {
            if (act.id === idOfChangedActivity) {
                return { ...act, percentage: safeNewPercentage };
            }
            if (act.isLocked) {
                return act;
            }
            // It's another unlocked activity, scale it
            return { ...act, percentage: act.percentage * scaleFactor };
        });

        // Correct for rounding errors to ensure total is exactly 100
        const finalTotal = updatedActivities.reduce((sum, p) => sum + p.percentage, 0);
        const diff = 100 - finalTotal;
        if (Math.abs(diff) > 0.001) {
            const firstUnlocked = updatedActivities.find(a => !a.isLocked && a.id !== idOfChangedActivity);
            if (firstUnlocked) {
                firstUnlocked.percentage += diff;
            } else {
                 const changedActivity = updatedActivities.find(a => a.id === idOfChangedActivity);
                 if(changedActivity) changedActivity.percentage += diff;
            }
        }

        return updatedActivities;
    });
  };

  const toggleLockActivity = (id) => {
    setActivities(prev => prev.map(act => act.id === id ? { ...act, isLocked: !act.isLocked } : act));
  };

  const updateActivityName = (id, name) => {
    setActivities((prev) => prev.map((activity) => (activity.id === id ? { ...activity, name } : activity)));
  };

  const updateActivityColor = (id, color) => {
    setActivities((prev) => prev.map((activity) => (activity.id === id ? { ...activity, color } : activity)));
  };

  const startSession = () => {
    if (Math.abs(totalPercentage - 100) < 0.1) {
      setIsTimerActive(true);
      setIsPaused(false);
      setCurrentActivityIndex(activities.findIndex(a => !a.isCompleted) ?? 0);
    }
  };

  const pauseResumeTimer = () => {
      setIsPaused(prev => !prev);
  };

  const resetSession = useCallback(() => {
    setIsTimerActive(false);
    setIsPaused(false);
    setVaultTime(0);
    const totalMins = calculateTotalSessionMinutes();
    setActivities((prev) =>
      prev.map((activity) => ({
        ...activity,
        timeRemaining: Math.round((activity.percentage / 100) * totalMins) * 60,
        isCompleted: false,
      })),
    );
    setCurrentActivityIndex(0);
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

  const handleCompleteActivity = (activityId) => {
    let timeToVault = 0;
    const updatedActivities = activities.map(act => {
        if (act.id === activityId && !act.isCompleted) {
            timeToVault = act.timeRemaining;
            return { ...act, timeRemaining: 0, isCompleted: true };
        }
        return act;
    });

    if (timeToVault > 0) {
        setVaultTime(prev => prev + timeToVault);
    }
    
    setActivities(updatedActivities);

    const allCompleted = updatedActivities.every(a => a.isCompleted);
    if (allCompleted) {
        setIsTimerActive(false);
        return;
    }

    if (updatedActivities[currentActivityIndex].isCompleted) {
        const nextIndex = updatedActivities.findIndex((act) => !act.isCompleted);
        if (nextIndex !== -1) {
            setCurrentActivityIndex(nextIndex);
        } else {
            setIsTimerActive(false);
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

  const openColorPicker = (activityId, currentColor) => {
    setColorPickerState({ isOpen: true, activityId, currentColor });
  };

  const closeColorPicker = () => {
    setColorPickerState({ isOpen: false, activityId: "", currentColor: "" });
  };

  const handleColorChange = React.useCallback((color) => {
    if (colorPickerState.activityId) {
      updateActivityColor(colorPickerState.activityId, color);
    }
  }, [colorPickerState.activityId]);

  const addFavoriteColor = (color) => {
    if (!favoriteColors.includes(color)) {
      setFavoriteColors([...favoriteColors, color]);
    }
  };
  
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
    return activities.reduce((sum, activity) => {
        if (activity.isCompleted) return sum;
        return sum + Math.max(0, activity.timeRemaining);
    }, 0) + vaultTime;
  };

  const getOverallProgress = () => {
    const totalDurationSeconds = activities.reduce((sum, act) => sum + (act.duration * 60), 0);
    if (totalDurationSeconds === 0) return 0;
    
    const totalElapsedSeconds = activities.reduce((sum, act) => {
        const elapsed = (act.duration * 60) - Math.max(0, act.timeRemaining);
        return sum + elapsed;
    }, 0);

    return (totalElapsedSeconds / totalDurationSeconds) * 100;
  };

  const currentActivity = activities[currentActivityIndex];
  
  const activityProgress = currentActivity?.duration > 0 ? ((currentActivity.duration * 60 - Math.max(0, currentActivity.timeRemaining)) / (currentActivity.duration * 60)) * 100 : 0;

  const mainContent = isTimerActive ? (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">TimeSlice Timer</CardTitle>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={pauseResumeTimer} className="w-24">
                <Icon name={isPaused ? "play" : "pause"} className="h-4 w-4 mr-2" />
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button variant="outline" size="sm" onClick={resetSession} className="w-24">
                <Icon name="rotateCcw" className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={selectRandomActivity}
                disabled={activities.filter(a => !a.isCompleted).length <= 1}
                className="w-24"
              >
                <Icon name="dice" className="h-4 w-4 mr-2" />
                Random
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {settings.showMainProgress && (
             settings.progressView === 'circular' ? (
                <CircularProgress 
                    activities={activities}
                    style={settings.progressBarStyle}
                    totalProgress={getOverallProgress()}
                    activityProgress={activityProgress}
                    activityColor={currentActivity?.color}
                />
             ) : (
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Overall Progress</span>
                        <span>{Math.round(getOverallProgress())}%</span>
                    </div>
                    <VisualProgress
                        activities={activities}
                        style={settings.progressBarStyle}
                        className="h-4"
                        overallProgress={getOverallProgress()}
                        currentActivityColor={currentActivity?.color}
                    />
                </div>
             )
          )}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-3">
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: currentActivity?.color }} />
              <h2 className="text-3xl font-bold">{currentActivity?.name}</h2>
            </div>
            {settings.showActivityTimer && (
                <div className="text-6xl font-mono font-bold text-slate-800">{currentActivity?.isCompleted ? "COMPLETED" : formatTime(currentActivity?.timeRemaining || 0)}</div>
            )}
            {isPaused && <Badge variant="secondary" className="text-lg px-4 py-2">PAUSED</Badge>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
            <div className="space-y-1">
                <div className="text-sm text-gray-600">Time Vault</div>
                <div className="text-xl font-semibold text-green-600">{formatTime(vaultTime)}</div>
            </div>
            <div className="space-y-1">
                <div className="text-sm text-gray-600">Predicted End</div>
                <div className="text-xl font-semibold">{getPredictedEndTime()}</div>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <h3 className="font-semibold">Activities</h3>
            <div className="space-y-2">
              {activities.map((activity, index) => {
                const activityProgress = activity.duration > 0 ? ((activity.duration * 60 - Math.max(0, activity.timeRemaining)) / (activity.duration * 60)) * 100 : 0;
                const displayProgress = settings.activityProgressType === 'fill' ? activityProgress : 100 - activityProgress;
                
                return (
                    <div
                      key={activity.id}
                      className={`relative overflow-hidden flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        index === currentActivityIndex && !activity.isCompleted ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                      } ${activity.isCompleted ? 'bg-green-50 text-gray-500 cursor-not-allowed' : 'cursor-pointer'}`}
                      onClick={() => !activity.isCompleted && switchToActivity(index)}
                    >
                      {settings.showActivityProgress && (
                          <div className="absolute top-0 left-0 h-full opacity-20" style={{width: `${activity.isCompleted ? 100 : displayProgress}%`, backgroundColor: activity.color, transition: 'width 0.5s linear'}}></div>
                      )}
                      <div className="flex items-center space-x-4 z-10">
                        <input type="checkbox" className="h-5 w-5 rounded text-slate-600 focus:ring-slate-500" checked={activity.isCompleted} disabled={activity.isCompleted} onChange={() => handleCompleteActivity(activity.id)} />
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: activity.color }} />
                        <span className={`font-medium ${activity.isCompleted ? 'line-through' : ''}`}>{activity.name}</span>
                      </div>
                      <div className="flex items-center gap-2 z-10">
                        <span className="text-sm text-gray-600">{formatTime(activity.timeRemaining)}</span>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setBorrowModalState({ isOpen: true, activityId: activity.id })}} disabled={vaultTime <= 0}>
                            <Icon name="plusCircle" className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  ) : (
    <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-3xl font-bold">TimeSlice</CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                console.log("showSettings before toggle:", showSettings);
                setShowSettings(!showSettings);
              }}>
                <Icon name="settings" className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {showSettings && (
              <Card className="bg-gray-50">
                <CardHeader>
                  <CardTitle className="text-lg">Timer Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Overtime Behavior</Label>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant={settings.overtimeType === 'none' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({...prev, overtimeType: 'none'}))}>Off</Button>
                        <Button size="sm" variant={settings.overtimeType === 'postpone' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({...prev, overtimeType: 'postpone'}))}>Postpone</Button>
                        <Button size="sm" variant={settings.overtimeType === 'drain' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({...prev, overtimeType: 'drain'}))}>Drain</Button>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Progress View</Label>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant={settings.progressView === 'linear' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({...prev, progressView: 'linear'}))}>Linear</Button>
                        <Button size="sm" variant={settings.progressView === 'circular' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({...prev, progressView: 'circular'}))}>Circular</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Progress Bar Style</Label>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant={settings.progressBarStyle === 'default' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({...prev, progressBarStyle: 'default'}))}>Default</Button>
                        <Button size="sm" variant={settings.progressBarStyle === 'dynamicColor' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({...prev, progressBarStyle: 'dynamicColor'}))}>Dynamic</Button>
                        <Button size="sm" variant={settings.progressBarStyle === 'segmented' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({...prev, progressBarStyle: 'segmented'}))}>Segmented</Button>
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
                  {settings.showActivityProgress && (
                    <div className="flex items-center justify-between pl-4">
                        <Label>Progress bar style</Label>
                        <div className="flex items-center gap-4">
                            <Button size="sm" variant={settings.activityProgressType === 'fill' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({...prev, activityProgressType: 'fill'}))}>Fill Up</Button>
                            <Button size="sm" variant={settings.activityProgressType === 'drain' ? 'default' : 'outline'} onClick={() => setSettings(prev => ({...prev, activityProgressType: 'drain'}))}>Drain Down</Button>
                        </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Session Duration</h2>
               <div className="flex items-center gap-4 mb-2">
                    <Button size="sm" variant={durationType === 'duration' ? 'default' : 'outline'} onClick={() => setDurationType('duration')}>Set Duration</Button>
                    <Button size="sm" variant={durationType === 'endTime' ? 'default' : 'outline'} onClick={() => setDurationType('endTime')}>Set End Time</Button>
                </div>
              {durationType === 'duration' ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="hours">Hours:</Label>
                      <Input id="hours" type="number" min="0" max="12" value={totalHours} onChange={(e) => setTotalHours(Number.parseInt(e.target.value) || 0)} className="w-20" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="minutes">Minutes:</Label>
                      <Input id="minutes" type="number" min="0" max="59" value={totalMinutes} onChange={(e) => setTotalMinutes(Number.parseInt(e.target.value) || 0)} className="w-20" />
                    </div>
                  </div>
              ) : (
                  <div className="flex flex-wrap items-center gap-4">
                       <div className="flex items-center space-x-2">
                           <Label htmlFor="end-time">End Time:</Label>
                           <Input id="end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-32" />
                    </div>
                  </div>
              )}
               <div className="text-sm text-gray-600">Total session will be {totalSessionMinutes} minutes.</div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Time Allocation</h2>
              <div 
                className="relative h-12 bg-gray-200 rounded-lg overflow-hidden flex"
                onMouseDown={handleBarDrag}
              >
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="h-full flex items-center justify-center text-white font-medium text-sm transition-all duration-200 pointer-events-none"
                      style={{ width: `${activity.percentage}%`, backgroundColor: activity.color }}
                    >
                      {settings.showAllocationPercentage && activity.percentage > 10 && `${Math.round(activity.percentage)}%`}
                    </div>
                  ))}
                {activities.slice(0, -1).map((_, index) => {
                  const position = activities.slice(0, index + 1).reduce((sum, a) => sum + a.percentage, 0);
                  const isDividerLocked = activities[index].isLocked && (activities[index + 1] && activities[index + 1].isLocked);
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
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Activities</h2>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handleDistributeEqually}>Distribute</Button>
                    <Badge variant={Math.abs(totalPercentage - 100) < 0.1 ? 'default' : 'destructive'} className="text-sm">
                      Total: {Math.round(totalPercentage)}%
                    </Badge>
                </div>
              </div>
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="grid grid-cols-1 sm:grid-cols-12 items-center gap-x-4 gap-y-2 p-3 border rounded-lg">
                    <button className="sm:col-span-1 w-8 h-8 rounded-full border-2 border-gray-300 hover:scale-110 transition-transform flex-shrink-0" style={{ backgroundColor: activity.color }} onClick={() => openColorPicker(activity.id, activity.color)} />
                    
                    <Input value={activity.name} onChange={(e) => updateActivityName(activity.id, e.target.value)} className="sm:col-span-4" placeholder="Activity name" />
                    
                    <div className="sm:col-span-2 flex items-center space-x-2">
                      <Input 
                          type="number" 
                          min="0" max="100" step="1" 
                          value={Math.round(activity.percentage)} 
                          onChange={(e) => updateAndScalePercentages(activity.id, Number.parseFloat(e.target.value) || 0)} 
                          className="w-full"
                          disabled={activity.isLocked}
                      />
                      <span className="text-sm text-gray-600">%</span>
                    </div>

                    <div className="sm:col-span-2 flex items-center space-x-2">
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
                          className="w-full"
                          disabled={activity.isLocked}
                      />
                      <span className="text-sm text-gray-600">min</span>
                    </div>
                    
                    <div className="sm:col-span-1 flex justify-center">
                        <Button variant="ghost" size="sm" onClick={() => toggleLockActivity(activity.id)}>
                          <Icon name={activity.isLocked ? 'lock' : 'unlock'} className={`h-4 w-4 ${activity.isLocked ? 'text-red-500' : ''}`} />
                        </Button>
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => removeActivity(activity.id)} disabled={activities.length === 1}>
                          <Icon name="trash2" className="h-4 w-4" />
                        </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={addActivity} className="w-full bg-transparent">
                <Icon name="plus" className="h-4 w-4 mr-2" />
                Add Activity
              </Button>
            </div>

            <div className="flex justify-center pt-4">
              <Button size="lg" onClick={startSession} disabled={Math.abs(totalPercentage - 100) > 0.1} className="px-8 py-3 text-lg">
                <Icon name="play" className="h-5 w-5 mr-2" />
                Start Session
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
      {mainContent}
      <ColorPicker isOpen={colorPickerState.isOpen} onClose={closeColorPicker} currentColor={colorPickerState.currentColor} onColorChange={handleColorChange} favorites={favoriteColors} onAddFavorite={addFavoriteColor} />
      {borrowModalState.isOpen && (
        <BorrowTimeModal 
            isOpen={borrowModalState.isOpen}
            onClose={() => setBorrowModalState({ isOpen: false, activityId: ''})}
            onBorrow={handleBorrowTime}
            maxTime={vaultTime}
            activityName={activities.find(a => a.id === borrowModalState.activityId)?.name || ''}
        />
      )}
    </div>
  );
}