﻿import React, { useState, useEffect, useRef, useCallback } from "react";

interface ActivityTemplate {
  id: string;
  name: string;
  color: string;
  category?: string;
  tags?: string[];
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
    arrowUpDown: <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />,
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

const VisualProgress = ({ activities, style, className, overallProgress, currentActivityColor, totalSessionMinutes = 0 }) => {
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

  if (totalTime === 0) {
    return <div className={`relative h-4 w-full overflow-hidden rounded-full bg-slate-100 ${className}`} />;
  }

  if (style === 'segmented') {
    return (
      <div className={`relative h-4 w-full overflow-hidden rounded-full flex bg-slate-100 ${className}`}>
        {activities.map((activity) => {
          // Calculate segment width based on allocated or actual duration
          let activityTime = 0;
          if (activity.percentage > 0) {
            activityTime = (activity.percentage / 100) * totalSessionSeconds;
          } else if (activity.duration > 0) {
            activityTime = activity.duration * 60;
          }
          
          const segmentWidth = (activityTime / totalTime) * 100;
          let fillWidth = 0;
          
          if (activity.isCompleted) {
            fillWidth = 100;
          } else if (activityTime > 0) {
            const elapsed = activityTime - Math.max(0, activity.timeRemaining);
            fillWidth = (elapsed / activityTime) * 100;
          }

          if (segmentWidth === 0) return null;

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
          let activityTime = 0;
          if (activity.percentage > 0) {
            activityTime = (activity.percentage / 100) * totalSessionSeconds;
          } else if (activity.duration > 0) {
            activityTime = activity.duration * 60;
          }
          
          const elapsed = activityTime - Math.max(0, activity.timeRemaining);
          const widthPercentage = (elapsed / totalTime) * 100;

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
      <div className="h-full transition-all" style={{ width: `${overallProgress}%`, backgroundColor: '#0f172a' }} />
    </div>
  );
};

const CircularProgress = ({ activities, style, totalProgress, activityProgress, activityColor, totalSessionMinutes = 0 }) => {
  const size = 200;
  const strokeWidth = 12;
  const center = size / 2;
  const radius = center - strokeWidth;
  const activityRadius = radius - strokeWidth - 4;
  const circumference = 2 * Math.PI * radius;
  const activityCircumference = 2 * Math.PI * activityRadius;
  
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
    if (style !== 'segmented' || activities.length <= 1 || totalTime === 0) return null;
    let accAngle = 0;
    const lines: React.ReactNode[] = [];
    for (let i = 0; i < activities.length - 1; i++) {
      const segmentAngle = ((activities[i].percentage > 0 ? (activities[i].percentage / 100) * totalSessionSeconds : activities[i].duration * 60) / totalTime) * 360;
      accAngle += segmentAngle;
      const angleRad = ((accAngle - 90) * Math.PI) / 180;
      // Draw from inner edge to outer edge of the ring for maximum visibility
      const rInner = radius - strokeWidth / 2 - 2; // slightly inside
      const rOuter = radius + strokeWidth / 2 + 2; // slightly outside
      const x0 = center + rInner * Math.cos(angleRad);
      const y0 = center + rInner * Math.sin(angleRad);
      const x1 = center + rOuter * Math.cos(angleRad);
      const y1 = center + rOuter * Math.sin(angleRad);
      lines.push(
        <path
          key={`divider-${i}`}
          d={`M${x0},${y0} L${x1},${y1}`}
          stroke="#222"
          strokeWidth={3}
          opacity={0.95}
          style={{ filter: 'drop-shadow(0 0 2px #fff)' }}
          shapeRendering="crispEdges"
        />
      );
    }
    return <g id="segment-dividers">{lines}</g>;
  };

  const renderOuterRing = () => {
    if (totalTime === 0) return null;

    if (style === 'dynamicColor') {
      let cumulativeRotation = -90;
      return activities.map(activity => {
        const activityDuration = activity.percentage > 0 ? (activity.percentage / 100) * totalSessionSeconds : activity.duration * 60;
        const elapsed = activityDuration - Math.max(0, activity.timeRemaining);
        if (elapsed <= 0) return null;

        const progressAngle = (elapsed / totalTime) * 360;
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
        const activityDuration = activity.percentage > 0 ? (activity.percentage / 100) * totalSessionSeconds : activity.duration * 60;
        const segmentAngle = (activityDuration / totalTime) * 360;
        const segmentArcLength = (segmentAngle / 360) * circumference;

        const elapsed = activityDuration - Math.max(0, activity.timeRemaining);
        const progressWithinSegment = activityDuration > 0 ? (elapsed / activityDuration) : 0;
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
  onAdd: (name: string, color: string, presetTime?: number) => void;
  templates: ActivityTemplate[];
  onSaveTemplate: (name: string) => void;
}

const AddActivityModal = ({ isOpen, onClose, onAdd, templates = [], onSaveTemplate }: AddActivityModalProps) => {
  const [activityName, setActivityName] = React.useState("");
  const [selectedTemplate, setSelectedTemplate] = React.useState<ActivityTemplate | null>(null);
  const [showTemplates, setShowTemplates] = React.useState(false);
  const [presetMinutes, setPresetMinutes] = React.useState(0);
  const [presetSeconds, setPresetSeconds] = React.useState(0);
  const [usePresetTime, setUsePresetTime] = React.useState(false);

  if (!isOpen) return null;

  const handleAdd = () => {
    let name = activityName.trim();
    let color = `hsl(${Math.floor(Math.random() * 360)}, 60%, 50%)`;
    let timeInSeconds = 0;
    
    if (selectedTemplate) {
      name = selectedTemplate.name;
      color = selectedTemplate.color;
    } else if (!name) {
      name = "New Activity";
    }

    if (usePresetTime) {
      timeInSeconds = (presetMinutes * 60) + presetSeconds;
    }
    
    onAdd(name, color, timeInSeconds);
    setActivityName("");
    setSelectedTemplate(null);
    setShowTemplates(false);
    setPresetMinutes(0);
    setPresetSeconds(0);
    setUsePresetTime(false);
    onClose();
  };

  const handleSaveAsTemplate = () => {
    const name = activityName.trim();
    if (name && onSaveTemplate) {
      onSaveTemplate(name);
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
                }}
                onKeyPress={handleKeyPress}
                autoFocus
                className="text-base py-3"
              />
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
  onBackToTimer 
}) => {
  const [editingTemplate, setEditingTemplate] = useState<ActivityTemplate | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  
  // Activity customization state
  const [editingActivity, setEditingActivity] = useState<any | null>(null);
  
  // Custom categories and tags management
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('timeSliceCustomCategories');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  
  const [customTags, setCustomTags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('timeSliceCustomTags');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Save custom categories and tags to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('timeSliceCustomCategories', JSON.stringify(customCategories));
    } catch (e) {
      console.error('Failed to save custom categories:', e);
    }
  }, [customCategories]);

  useEffect(() => {
    try {
      localStorage.setItem('timeSliceCustomTags', JSON.stringify(customTags));
    } catch (e) {
      console.error('Failed to save custom tags:', e);
    }
  }, [customTags]);

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

  const handleSaveTemplate = (templateData: { name: string; color: string; category?: string; tags?: string[] }) => {
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
      tags: undefined
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

  const handleAddToCurrentSession = (template: ActivityTemplate) => {
    const newActivity = {
      id: Date.now().toString(),
      name: template.name,
      color: template.color,
      percentage: 10, // Default percentage
      duration: 0,
      timeRemaining: 0,
      isCompleted: false,
      isLocked: false
    };
    setActivities(prev => [...prev, newActivity]);
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
                    {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
                  </Button>
                ))}
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
                          className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                        >
                          <Icon name="settings" className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                        >
                          <Icon name="trash2" className="h-3 w-3 sm:h-4 sm:w-4" />
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
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddToCurrentSession(template)}
                          className="flex-1 h-8 text-xs sm:text-sm"
                        >
                          <Icon name="plus" className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          Add to Session
                        </Button>
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
                            className="h-6 w-6 sm:h-8 sm:w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-300"
                            title="Edit Activity"
                          >
                            <span className="text-xs sm:text-sm">⚙️</span>
                          </Button>
                          
                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFromSession(activity.id)}
                            className="h-6 w-6 sm:h-8 sm:w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-300"
                            title="Delete Activity"
                          >
                            <span className="text-xs sm:text-sm">❌</span>
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">
                        {activity.isLocked && <Icon name="lock" className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />}
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
                      {category.charAt(0).toUpperCase() + category.slice(1)}
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
              
              <div className="flex justify-end space-x-2 pt-2 sm:pt-4">
                <Button variant="outline" onClick={() => setEditingTemplate(null)} className="h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4">
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleSaveTemplate({
                    name: editingTemplate.name,
                    color: editingTemplate.color,
                    category: editingTemplate.category,
                    tags: editingTemplate.tags
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
                      <span className="text-sm">{category.charAt(0).toUpperCase() + category.slice(1)}</span>
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
                      {category.charAt(0).toUpperCase() + category.slice(1)}
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
    // If no rest time available, do nothing (can't be selected)
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
        <div className="w-4 h-4 rounded-full bg-purple-500" />
        <span className="font-semibold text-purple-800">
          {flowState.isOnBreak ? 'Flowmodoro Break' : 'Flowmodoro Rest'}
        </span>
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

// --- Main Application Component ---
export default function App() {
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
            isLocked: Boolean(activity.isLocked)
          }));
        }
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
      showActivityTime: true, // NEW: toggle for activity time next to bar
      // Simplified Flowmodoro settings
      flowmodoroEnabled: true,
      flowmodoroRatio: 5, // 5:1 ratio (5 minutes work = 1 minute rest)
      flowmodoroShowProgress: true, // Toggle for flowmodoro progress bar
      flowmodoroProgressType: 'fill', // 'fill' or 'drain' like other activities
      flowmodoroResetStartTime: '06:00', // Daily reset at 6 AM
      flowmodoroResetEndTime: '23:59', // Daily reset at 11:59 PM
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
  const [currentPage, setCurrentPage] = useState('timer'); // 'timer' or 'manage-activities'

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
    if (targetIsVault) {
      setActivities(prev => prev.map(act => {
        if (act.id === sourceActivityId) {
          return { ...act, timeRemaining: Math.max(0, act.timeRemaining - amount) };
        }
        return act;
      }));
      setVaultTime(prev => prev + amount);
    } else if (sourceActivityId === 'vault') {
      const actualAmount = Math.min(amount, vaultTime);
      setVaultTime(prev => prev - actualAmount);
      setActivities(prev => prev.map(act => {
        if (act.id === targetActivityId) {
          return { ...act, timeRemaining: act.timeRemaining + actualAmount };
        }
        return act;
      }));
    } else {
      setActivities(prev => prev.map(act => {
        if (act.id === sourceActivityId) {
          return { ...act, timeRemaining: Math.max(0, act.timeRemaining - amount) };
        }
        if (act.id === targetActivityId) {
          return { ...act, timeRemaining: act.timeRemaining + amount };
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

  // --- Start of State Saving Logic ---
  useEffect(() => {
    try {
      localStorage.setItem('timeSliceActivities', JSON.stringify(activities));
    } catch (e) {
      console.error("Failed to save activities", e);
    }
  }, [activities]);

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
    console.log('Duration sync effect triggered:', { isTimerActive, totalSessionMinutes, activityPercentages });
    if (isTimerActive) return;
    const totalMins = calculateTotalSessionMinutes();
    console.log('Calculated total minutes:', totalMins);
    setActivities(prev => prev.map(activity => {
      const newDuration = Math.round((activity.percentage / 100) * totalMins);
      const newTimeRemaining = newDuration * 60;
      console.log(`Activity ${activity.name}: ${activity.percentage}% = ${newDuration}min = ${newTimeRemaining}sec`);
      return {
        ...activity,
        duration: newDuration,
        timeRemaining: newTimeRemaining,
        isCompleted: false,
      };
    }));
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
      setFlowmodoroState(prev => {
        const newBreakTimeRemaining = prev.breakTimeRemaining - 1;
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
      return; // Don't process regular timer during break
    }

    setActivities(prev => {
      const now = Date.now();
      const elapsedSeconds = Math.round((now - lastTickTimestampRef.current) / 1000);
      lastTickTimestampRef.current = now;

      if (elapsedSeconds <= 0) return prev;

      // Accumulate flowmodoro rest time if enabled and timer is active (not during break)
      if (settings.flowmodoroEnabled && !flowmodoroState.isOnBreak) {
        // Add elapsed seconds to fractional accumulator and calculate how much rest time to award
        const newAccumulated = flowmodoroState.accumulatedFractionalTime + elapsedSeconds;
        const restTimeToAdd = Math.floor(newAccumulated / settings.flowmodoroRatio);
        const remainingFractional = newAccumulated % settings.flowmodoroRatio;
        
        if (restTimeToAdd > 0) {
          setFlowmodoroState(prevFlow => ({
            ...prevFlow,
            availableRestTime: prevFlow.availableRestTime + restTimeToAdd,
            totalEarnedToday: prevFlow.totalEarnedToday + restTimeToAdd,
            accumulatedFractionalTime: remainingFractional
          }));
        } else {
          // Just update the fractional accumulator
          setFlowmodoroState(prevFlow => ({
            ...prevFlow,
            accumulatedFractionalTime: remainingFractional
          }));
        }
      }

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
  }, [currentActivityIndex, settings.overtimeType, settings.flowmodoroEnabled, settings.flowmodoroRatio, flowmodoroState.isOnBreak, flowmodoroState.breakTimeRemaining, flowmodoroState.lastResetDate, checkIfShouldReset]);

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

  const addActivity = (customName = null, customColor = null, presetTime = 0) => {
    // Always open modal if no custom name provided - this ensures all activity creation goes through naming dialog
    // This is especially important for mobile users who shouldn't need to click into input fields to rename
    if (customName === null || customName === undefined || customName === '') {
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

    // Use provided color or generate random one
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

  const handleAddActivityWithName = (name, color, presetTime = 0) => {
    addActivity(name, color, presetTime);
  };

  const saveActivityTemplate = (name) => {
    const newTemplate = {
      id: Date.now().toString(),
      name: name.trim(),
      color: `hsl(${Math.floor(Math.random() * 360)}, 60%, 50%)`
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
          if (changedActivity) changedActivity.percentage += diff;
        }
      }

      return updatedActivities;
    });
  };

  const toggleLockActivity = (id) => {
    setActivities(prev => prev.map(act => act.id === id ? { ...act, isLocked: !act.isLocked } : act));
  };

  const updateActivityName = (id, name) => {
    // Allow empty string during editing, only default when saving/blur
    console.log('Updating activity name:', id, 'to:', name);
    setActivities((prev) => prev.map((activity) => (activity.id === id ? { ...activity, name: name } : activity)));
  };

  const updateActivityColor = (id, color) => {
    setActivities((prev) => prev.map((activity) => (activity.id === id ? { ...activity, color } : activity)));
  };

  const startSession = () => {
    if (Math.abs(totalPercentage - 100) < 0.1 && activities.length > 0) {
      console.log('Starting session with activities:', activities);
      setIsTimerActive(true);
      setIsPaused(false);
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
    // Calculate total allocated time based on percentages and session duration
    const totalSessionSeconds = calculateTotalSessionMinutes() * 60;
    if (totalSessionSeconds === 0) return 0;

    const totalElapsedSeconds = activities.reduce((sum, act) => {
      // For activities with allocated time (percentage > 0)
      if (act.percentage > 0) {
        const allocatedSeconds = (act.percentage / 100) * totalSessionSeconds;
        const elapsed = allocatedSeconds - Math.max(0, act.timeRemaining);
        return sum + elapsed;
      }
      // For activities added during session (percentage = 0), use duration if available
      else if (act.duration > 0) {
        const elapsed = (act.duration * 60) - Math.max(0, act.timeRemaining);
        return sum + elapsed;
      }
      return sum;
    }, 0);

    // Calculate total possible time (allocated + added activities)
    const totalAllocatedSeconds = activities.reduce((sum, act) => {
      if (act.percentage > 0) {
        return sum + (act.percentage / 100) * totalSessionSeconds;
      } else if (act.duration > 0) {
        return sum + (act.duration * 60);
      }
      return sum;
    }, 0);

    if (totalAllocatedSeconds === 0) return 0;
    return (totalElapsedSeconds / totalAllocatedSeconds) * 100;
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
    />
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
                return (
                  <div
                    key={activity.id}
                    className={`relative overflow-hidden flex items-center justify-between p-2 rounded-lg border transition-colors ${index === currentActivityIndex && !activity.isCompleted ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                      } ${activity.isCompleted ? 'bg-green-50 text-gray-500 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !activity.isCompleted && switchToActivity(index)}
                  >
                    {settings.showActivityProgress && (
                      <div className="absolute top-0 left-0 h-full opacity-20" style={{ width: `${activity.isCompleted ? 100 : displayProgress}%`, backgroundColor: activity.color, transition: 'width 0.5s linear' }}></div>
                    )}
                    <div className="flex items-center space-x-2 z-10">
                      <input type="checkbox" className="h-4 w-4 rounded text-slate-600 focus:ring-slate-500" checked={activity.isCompleted} disabled={activity.isCompleted} onChange={() => handleCompleteActivity(activity.id)} />
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activity.color }} />
                      <span className="font-semibold text-sm">{activity.name}</span>
                    </div>
                    <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                      {settings.showActivityTime && (
                        <span className="text-xs font-mono z-10">{formatTime(activity.timeRemaining)}</span>
                      )}
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={(e) => {
                          console.log('Transfer button clicked - preventing all propagation');
                          e.preventDefault();
                          e.stopPropagation();
                          e.nativeEvent.stopImmediatePropagation();
                          console.log('Activity:', activity.id, 'timeRemaining:', activity.timeRemaining);
                          
                          console.log('Setting siphon modal state...');
                          setSiphonModalState({
                            isOpen: true,
                            sourceActivityId: activity.id,
                            targetActivityId: 'vault',
                            targetIsVault: true
                          });
                          console.log('Siphon modal state set');
                          return false;
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        disabled={false} // TEMPORARILY DISABLED THE DISABLE CONDITION
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
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold">Session Duration</h2>
            <div className="flex items-center gap-2 mb-2">
              <Button size="sm" variant={durationType === 'duration' ? 'default' : 'outline'} onClick={() => setDurationType('duration')} className="h-9 text-sm flex-1 sm:flex-none">Set Duration</Button>
              <Button size="sm" variant={durationType === 'endTime' ? 'default' : 'outline'} onClick={() => setDurationType('endTime')} className="h-9 text-sm flex-1 sm:flex-none">Set End Time</Button>
            </div>
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
            <h2 className="text-lg sm:text-xl font-semibold">Time Allocation</h2>
            <div
              className="relative h-16 sm:h-12 bg-gray-200 rounded-lg overflow-hidden flex"
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-semibold">Activities</h2>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleDistributeEqually} className="h-8 text-xs">Distribute</Button>
                <Badge variant={Math.abs(totalPercentage -  100) < 0.1 ? 'default' : 'destructive'} className="text-xs">
                  Total: {Math.round(totalPercentage)}%
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-2 p-3 border rounded-lg bg-white">
                  <button 
                    className="w-8 h-8 rounded-full border-2 border-gray-300 hover:scale-110 transition-transform flex-shrink-0" 
                    style={{ backgroundColor: activity.color }} 
                    onClick={() => openColorPicker(activity.id, activity.color)} 
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
                    className="flex-1 h-8 text-sm min-w-0" 
                    placeholder="Activity name" 
                  />

                  <div className="flex items-center gap-1 flex-shrink-0">
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
                      className="w-14 h-8 text-sm text-center"
                      disabled={activity.isLocked}
                    />
                    <span className="text-sm text-gray-600 min-w-[8px]">%</span>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
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
                      className="w-14 h-8 text-sm text-center"
                      disabled={activity.isLocked}
                    />
                    <span className="text-sm text-gray-600 min-w-[24px]">min</span>
                  </div>

                  <Button variant="ghost" size="sm" onClick={() => toggleLockActivity(activity.id)} className="h-8 w-8 p-0 flex-shrink-0">
                    <Icon name={activity.isLocked ? 'lock' : 'unlock'} className={`h-4 w-4 ${activity.isLocked ? 'text-red-500' : ''}`} />
                  </Button>

                  <Button variant="outline" size="sm" onClick={() => removeActivity(activity.id)} disabled={activities.length === 1} className="h-8 w-8 p-0 flex-shrink-0">
                    <Icon name="trash2" className="h-4 w-4" />
                  </Button>
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
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 font-sans">
      {mainContent}
      <ColorPicker isOpen={colorPickerState.isOpen} onClose={closeColorPicker} currentColor={colorPickerState.currentColor} onColorChange={handleColorChange} favorites={favoriteColors} onAddFavorite={addFavoriteColor} />
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
        />
      )}
    </div>
  );
}
