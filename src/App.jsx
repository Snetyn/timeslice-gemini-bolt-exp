import React, { useState, useEffect, useRef, useCallback } from "react";

// --- Self-Contained UI Components ---

const Icon = ({ name, className }) => {
  const icons = {
    plus: <path d="M5 12h14m-7-7v14" />,
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
    bell: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M13.73 21a2 2 0 0 1-3.46 0" />,
    volume2: (
      <>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
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

const Progress = ({ value, className = '' }) => (
  <div className={`relative h-4 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
    <div className="h-full w-full flex-1 bg-slate-900 transition-all" style={{ transform: `translateX(-${100 - (value || 0)}%)` }} />
  </div>
);

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

// --- Interfaces ---
interface Activity {
  id: string;
  name: string;
  percentage: number;
  color: string;
  duration: number; // in minutes
  timeRemaining: number; // in seconds
  isCompleted: boolean;
}

interface TimerSettings {
  showMainProgress: boolean;
  showOverallTime: boolean;
  showEndTime: boolean;
  showActivityTimer: boolean;
  showActivityProgress: boolean;
  activityProgressType: 'fill' | 'drain';
  enableNotifications: boolean;
  playSoundOnEnd: boolean;
}

interface ColorPickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  favorites: string[];
  onAddFavorite: (color: string) => void;
}

// Notification sound - using a data URL for a simple beep sound
const notificationSound = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT";

// --- Modals ---
const ColorPicker = ({ isOpen, onClose, currentColor, onColorChange, favorites, onAddFavorite }: ColorPickerProps) => {
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
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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

const DistributeTimeModal = ({ isOpen, onClose, bankedTime, onDistribute }) => {
    const [newActivityName, setNewActivityName] = useState("Banked Time Activity");

    if (!isOpen) return null;

    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    };

    const handleDistribute = () => {
        if (newActivityName.trim()) {
            onDistribute(newActivityName.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-lg">Distribute Banked Time</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p>You have <span className="font-bold text-green-600">{formatTime(bankedTime)}</span> of banked time.</p>
                    <p>Create a new activity with this time.</p>
                    <div className="space-y-2">
                        <Label htmlFor="new-activity-name">New Activity Name</Label>
                        <Input
                            id="new-activity-name"
                            value={newActivityName}
                            onChange={(e) => setNewActivityName(e.target.value)}
                            placeholder="e.g., Review, Extra Break"
                        />
                    </div>
                    <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleDistribute}>Create Activity</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};


// --- Main Application Component ---
export default function App() {
  const [activities, setActivities] = useState<Activity[]>([
    { id: "1", name: "Focus Work", percentage: 60, color: "hsl(220, 70%, 50%)", duration: 0, timeRemaining: 0, isCompleted: false },
    { id: "2", name: "Break", percentage: 40, color: "hsl(120, 60%, 50%)", duration: 0, timeRemaining: 0, isCompleted: false },
  ]);

  const [totalHours, setTotalHours] = useState(2);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [colorPickerState, setColorPickerState] = useState({ isOpen: false, activityId: "", currentColor: "" });
  const [favoriteColors, setFavoriteColors] = useState<string[]>([
    "hsl(220, 70%, 50%)", "hsl(120, 60%, 50%)", "hsl(0, 70%, 50%)", "hsl(280, 60%, 50%)", "hsl(40, 80%, 50%)",
  ]);
  const [settings, setSettings] = useState<TimerSettings>({
    showMainProgress: true, 
    showOverallTime: true, 
    showEndTime: true, 
    showActivityTimer: true,
    showActivityProgress: false, 
    activityProgressType: 'drain',
    enableNotifications: false,
    playSoundOnEnd: false
  });
  const [durationType, setDurationType] = useState<'duration' | 'endTime'>('duration');
  const [endTime, setEndTime] = useState('23:30');
  const [bankedTime, setBankedTime] = useState(0);
  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
  const prevIsTimerActive = useRef(false);

  // Request notification permission
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support notifications");
      setSettings(prev => ({ ...prev, enableNotifications: false }));
      return;
    }

    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setSettings(prev => ({ ...prev, enableNotifications: false }));
      }
    } else if (Notification.permission === "denied") {
      alert("Notifications are blocked. Please enable them in your browser settings.");
      setSettings(prev => ({ ...prev, enableNotifications: false }));
    }
  };

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio(notificationSound);
      audio.volume = 0.7;
      audio.play().catch(error => {
        console.warn("Could not play notification sound:", error);
      });
    } catch (error) {
      console.warn("Error creating audio:", error);
    }
  };

  // Send notification
  const sendNotification = (title: string, body: string) => {
    if (settings.enableNotifications && Notification.permission === "granted") {
      try {
        const notification = new Notification(title, {
          body,
          icon: "/vite.svg",
          badge: "/vite.svg",
          tag: "timeslice-timer",
          requireInteraction: true,
          silent: !settings.playSoundOnEnd
        });

        // Auto-close notification after 10 seconds
        setTimeout(() => {
          notification.close();
        }, 10000);

        // Handle notification click
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.warn("Could not send notification:", error);
      }
    }
  };

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


  // Effect 1: Handles the 1-second timer tick down
  useEffect(() => {
    if (!isTimerActive || isPaused) return;

    const interval = window.setInterval(() => {
      setActivities(prev => {
        const current = prev[currentActivityIndex];
        // Only tick if the activity exists and has time remaining
        if (current && current.timeRemaining > 0) {
          return prev.map((act, index) =>
            index === currentActivityIndex
              ? { ...act, timeRemaining: act.timeRemaining - 1 }
              : act
          );
        }
        return prev; // No change if timer is at 0 or activity is invalid
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerActive, isPaused, currentActivityIndex]);

  // Effect 2: Handles the moment an activity finishes
  useEffect(() => {
    if (!isTimerActive) return;

    const currentActivity = activities[currentActivityIndex];
    if (currentActivity && currentActivity.timeRemaining === 0 && !currentActivity.isCompleted) {
      // Mark as complete
      setActivities(prev =>
        prev.map((act) =>
          act.id === currentActivity.id ? { ...act, isCompleted: true } : act
        )
      );

      sendNotification(
        "Activity Completed!",
        `${currentActivity.name} has finished. Time for the next one!`
      );
      if (settings.playSoundOnEnd) {
        playNotificationSound();
      }
    }
  }, [activities, isTimerActive, currentActivityIndex, settings.playSoundOnEnd, settings.enableNotifications]);

  // Effect 3: Moves to the next activity or ends the session
  useEffect(() => {
    if (!isTimerActive) return;
    
    const currentActivity = activities[currentActivityIndex];
    if (currentActivity && currentActivity.isCompleted) {
      const nextIndex = activities.findIndex(act => !act.isCompleted);
      if (nextIndex !== -1) {
        setCurrentActivityIndex(nextIndex);
      } else {
        // All activities are completed
        setIsTimerActive(false);
      }
    }
  }, [activities, isTimerActive, currentActivityIndex]);
  
  useEffect(() => {
    if (prevIsTimerActive.current && !isTimerActive) {
      // Timer has stopped - check if session is complete
      const allActivitiesCompleted = activities.every(activity => activity.isCompleted);
      
      if (allActivitiesCompleted && bankedTime === 0) {
        // Complete session without banked time
        sendNotification(
          "Session Complete!",
          "All activities have been completed. Great work!"
        );
        
        if (settings.playSoundOnEnd) {
          playNotificationSound();
        }
      } else if (bankedTime > 0) {
        // Session ended with banked time
        setIsDistributeModalOpen(true);
        sendNotification(
          "Session Complete!",
          `You have ${Math.round(bankedTime / 60)} minutes of banked time to distribute.`
        );
      }
    }
    prevIsTimerActive.current = isTimerActive;
  }, [isTimerActive, bankedTime, activities, settings.enableNotifications, settings.playSoundOnEnd]);

  const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getPredictedEndTime = () => {
    if (!isTimerActive) return "";
    const totalRemainingSeconds = getTotalRemainingTime();
    const endTime = new Date(Date.now() + totalRemainingSeconds * 1000);
    return endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const addActivity = () => {
    const newActivity: Activity = {
      id: Date.now().toString(),
      name: "New Activity",
      percentage: 0,
      color: `hsl(${Math.floor(Math.random() * 360)}, 60%, 50%)`,
      duration: 0,
      timeRemaining: 0,
      isCompleted: false,
    };
    setActivities([...activities, newActivity]);
  };

  const removeActivity = (id: string) => {
    if (activities.length > 1) {
      setActivities(activities.filter((activity) => activity.id !== id));
    }
  };

  const updateAndScalePercentages = (id: string, newPercentage: number) => {
    setActivities(prev => {
        const activityToUpdate = prev.find(a => a.id === id);
        if (!activityToUpdate) return prev;

        const otherActivities = prev.filter(a => a.id !== id);
        const otherTotalPercentage = otherActivities.reduce((sum, a) => sum + a.percentage, 0);

        const safeNewPercentage = Math.min(100, Math.max(0, newPercentage));
        
        if (otherActivities.length === 0 || otherTotalPercentage === 0) {
            return prev.map(a => a.id === id ? { ...a, percentage: safeNewPercentage } : a);
        }
        
        const remainingPercentage = 100 - safeNewPercentage;
        const scaleFactor = remainingPercentage / otherTotalPercentage;

        if (scaleFactor < 0) {
            return prev.map(a => a.id === id ? { ...a, percentage: safeNewPercentage } : a);
        }

        const updatedActivities = prev.map(act => {
            if (act.id === id) {
                return { ...act, percentage: safeNewPercentage };
            } else {
                return { ...act, percentage: act.percentage * scaleFactor };
            }
        });

        // Correct for rounding errors
        const finalTotalPercentage = updatedActivities.reduce((sum, p) => sum + p.percentage, 0);
        const diff = 100 - finalTotalPercentage;
        if (Math.abs(diff) > 0.001) {
            const targetIndex = updatedActivities.findIndex(a => a.id === id);
            if (targetIndex !== -1) {
                updatedActivities[targetIndex].percentage += diff;
            }
        }
        return updatedActivities;
    });
  };

  const updateActivityName = (id: string, name: string) => {
    setActivities((prev) => prev.map((activity) => (activity.id === id ? { ...activity, name } : activity)));
  };

  const updateActivityColor = (id: string, color: string) => {
    setActivities((prev) => prev.map((activity) => (activity.id === id ? { ...activity, color } : activity)));
  };

  const startSession = () => {
    if (Math.abs(totalPercentage - 100) < 0.1) {
      setIsTimerActive(true);
      setIsPaused(false);
      setCurrentActivityIndex(activities.findIndex(a => !a.isCompleted) ?? 0);
      
      // Send session start notification
      sendNotification(
        "Session Started!",
        `Starting with ${activities[0]?.name}. Focus time begins now!`
      );
    }
  };

  const pauseResumeTimer = () => {
      setIsPaused(prev => !prev);
  };

  const resetSession = useCallback(() => {
    setIsTimerActive(false);
    setIsPaused(false);
    setBankedTime(0);
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

  const switchToActivity = (index: number) => {
    if (!activities[index].isCompleted) {
        setCurrentActivityIndex(index);
    }
  };

  const handleCompleteActivity = (activityId: string) => {
    let timeToBank = 0;
    const updatedActivities = activities.map(act => {
        if (act.id === activityId && !act.isCompleted) {
            timeToBank = act.timeRemaining;
            return { ...act, timeRemaining: 0, isCompleted: true };
        }
        return act;
    });

    if (timeToBank > 0) {
        setBankedTime(prev => prev + timeToBank);
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

  const handleDistributeTime = (newActivityName: string) => {
    const newActivity: Activity = {
        id: Date.now().toString(),
        name: newActivityName,
        percentage: 100,
        color: `hsl(${Math.floor(Math.random() * 360)}, 60%, 50%)`,
        duration: Math.round(bankedTime / 60),
        timeRemaining: bankedTime,
        isCompleted: false,
    };
    const totalMins = newActivity.duration;
    setTotalHours(Math.floor(totalMins / 60));
    setTotalMinutes(totalMins % 60);
    setActivities([newActivity]);
    setBankedTime(0);
    setIsDistributeModalOpen(false);
    setIsTimerActive(false);
  };

  const handleCloseDistributeModal = () => {
    setIsDistributeModalOpen(false);
    setBankedTime(0);
    resetSession();
  }

  const openColorPicker = (activityId: string, currentColor: string) => {
    setColorPickerState({ isOpen: true, activityId, currentColor });
  };

  const closeColorPicker = () => {
    setColorPickerState({ isOpen: false, activityId: "", currentColor: "" });
  };

  const handleColorChange = React.useCallback((color: string) => {
    if (colorPickerState.activityId) {
      updateActivityColor(colorPickerState.activityId, color);
    }
  }, [colorPickerState.activityId]);

  const addFavoriteColor = (color: string) => {
    if (!favoriteColors.includes(color)) {
      setFavoriteColors([...favoriteColors, color]);
    }
  };
  
  const handleBarDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const startX = e.clientX;
    const startPercentages = activities.map(a => a.percentage);

    let segmentIndex = -1;
    let cumulativePercentage = 0;
    for (let i = 0; i < activities.length - 1; i++) {
        cumulativePercentage += activities[i].percentage;
        const handlePosition = rect.left + (cumulativePercentage / 100) * rect.width;
        if (Math.abs(startX - handlePosition) < 8) {
            segmentIndex = i;
            break;
        }
    }

    if (segmentIndex === -1) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        const deltaX = moveEvent.clientX - startX;
        const deltaPercentage = (deltaX / rect.width) * 100;

        const newPercentages = [...startPercentages];
        const originalLeft = startPercentages[segmentIndex];
        const originalRight = startPercentages[segmentIndex + 1];

        let newLeft = originalLeft + deltaPercentage;
        let newRight = originalRight - deltaPercentage;
        
        if (newLeft < 0) {
            newRight += newLeft;
            newLeft = 0;
        }
        if (newRight < 0) {
            newLeft += newRight;
            newRight = 0;
        }

        newPercentages[segmentIndex] = newLeft;
        newPercentages[segmentIndex + 1] = newRight;
        
        setActivities(prev => prev.map((activity, index) => ({
            ...activity,
            percentage: newPercentages[index]
        })));
    };

    const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        setActivities(prev => {
            const roundedPercentages = prev.map(a => Math.round(a.percentage));
            const roundedTotal = roundedPercentages.reduce((sum, p) => sum + p, 0);
            const diff = 100 - roundedTotal;

            if (diff !== 0) {
                let maxIndex = 0;
                roundedPercentages.forEach((p, i) => {
                    if (p > roundedPercentages[maxIndex]) {
                        maxIndex = i;
                    }
                });
                roundedPercentages[maxIndex] += diff;
            }
            
            return prev.map((activity, index) => ({
                ...activity,
                percentage: roundedPercentages[index]
            }));
        });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [activities]);
  
  const getTotalRemainingTime = () => {
    return activities.reduce((sum, activity) => sum + activity.timeRemaining, 0) + bankedTime;
  };

  const getOverallProgress = () => {
    const completedPercentage = activities
        .filter(act => act.isCompleted)
        .reduce((sum, act) => sum + act.percentage, 0);

    let currentActivityProgressPercentage = 0;
    const currentActivity = activities[currentActivityIndex];
    if (currentActivity && !currentActivity.isCompleted && isTimerActive) {
        const durationSeconds = currentActivity.duration * 60;
        if (durationSeconds > 0) {
            const elapsedSecondsInCurrent = durationSeconds - currentActivity.timeRemaining;
            const progressRatio = elapsedSecondsInCurrent / durationSeconds;
            currentActivityProgressPercentage = currentActivity.percentage * progressRatio;
        }
    }

    return completedPercentage + currentActivityProgressPercentage;
  };

  const handleNotificationToggle = async (checked: boolean) => {
    if (checked) {
      await requestNotificationPermission();
      // Only update if permission was granted or already granted
      if (Notification.permission === "granted") {
        setSettings(prev => ({ ...prev, enableNotifications: true }));
      }
    } else {
      setSettings(prev => ({ ...prev, enableNotifications: false }));
    }
  };

  const testNotification = () => {
    sendNotification("Test Notification", "This is a test notification from TimeSlice!");
    if (settings.playSoundOnEnd) {
      playNotificationSound();
    }
  };
  
  const currentActivity = activities[currentActivityIndex];

  if (isTimerActive) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 font-sans">
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
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings.showMainProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Overall Progress</span>
                    <span>{Math.round(getOverallProgress())}%</span>
                  </div>
                  <Progress value={getOverallProgress()} className="h-2" />
                </div>
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
                {settings.showOverallTime && (
                  <div className="space-y-1">
                    <div className="text-sm text-gray-600">Total Remaining</div>
                    <div className="text-xl font-semibold">
                        {formatTime(getTotalRemainingTime())}
                        {bankedTime > 0 && <span className="text-sm text-green-600 ml-2">(+{formatTime(bankedTime)} banked)</span>}
                    </div>
                  </div>
                )}
                {settings.showEndTime && (
                  <div className="space-y-1">
                    <div className="text-sm text-gray-600">Predicted End</div>
                    <div className="text-xl font-semibold">{getPredictedEndTime()}</div>
                  </div>
                )}
              </div>
              <Separator />
              <div className="space-y-2">
                <h3 className="font-semibold">Activities</h3>
                <div className="space-y-2">
                  {activities.map((activity, index) => {
                    const activityProgress = activity.duration > 0 ? ((activity.duration * 60 - activity.timeRemaining) / (activity.duration * 60)) * 100 : 0;
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
                          <div className="text-sm text-gray-600 z-10">{activity.duration} min</div>
                        </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
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
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Icon name="bell" className="h-4 w-4" />
                      Notification Settings
                    </h3>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="enable-notifications">Enable browser notifications</Label>
                        <p className="text-xs text-gray-500">Get notified when activities complete</p>
                      </div>
                      <Switch 
                        id="enable-notifications" 
                        checked={settings.enableNotifications} 
                        onCheckedChange={handleNotificationToggle} 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="play-sound">Play sound on timer end</Label>
                        <p className="text-xs text-gray-500">Audio alert when activities finish</p>
                      </div>
                      <Switch 
                        id="play-sound" 
                        checked={settings.playSoundOnEnd} 
                        onCheckedChange={(checked) => setSettings(prev => ({ ...prev, playSoundOnEnd: checked }))} 
                      />
                    </div>
                    
                    {(settings.enableNotifications || settings.playSoundOnEnd) && (
                      <div className="pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={testNotification}
                          className="w-full"
                        >
                          <Icon name="volume2" className="h-4 w-4 mr-2" />
                          Test Notification & Sound
                        </Button>
                      </div>
                    )}
                  </div>
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
                className="relative h-12 bg-gray-200 rounded-lg overflow-hidden flex cursor-col-resize"
                onMouseDown={handleBarDrag}
              >
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="h-full flex items-center justify-center text-white font-medium text-sm transition-all duration-200 pointer-events-none"
                      style={{ width: `${activity.percentage}%`, backgroundColor: activity.color }}
                    >
                      {activity.percentage > 10 && `${Math.round(activity.percentage)}%`}
                    </div>
                  ))}
                {activities.slice(0, -1).map((_, index) => {
                  const position = activities.slice(0, index + 1).reduce((sum, a) => sum + a.percentage, 0);
                  return (
                    <div key={index} className="absolute top-0 w-2 h-full bg-white/50 border-x border-gray-600/50 hover:bg-white transition-colors transform -translate-x-1/2 pointer-events-none" style={{ left: `${position}%` }} />
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Activities</h2>
                <Badge variant={Math.abs(totalPercentage - 100) < 0.1 ? 'default' : 'destructive'} className="text-sm">
                  Total: {Math.round(totalPercentage)}%
                </Badge>
              </div>
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="grid grid-cols-1 sm:grid-cols-12 items-center gap-x-4 gap-y-2 p-3 border rounded-lg">
                    <button className="sm:col-span-1 w-8 h-8 rounded-full border-2 border-gray-300 hover:scale-110 transition-transform flex-shrink-0" style={{ backgroundColor: activity.color }} onClick={() => openColorPicker(activity.id, activity.color)} />
                    
                    <Input value={activity.name} onChange={(e) => updateActivityName(activity.id, e.target.value)} className="sm:col-span-5" placeholder="Activity name" />
                    
                    <div className="sm:col-span-2 flex items-center space-x-2">
                      <Input 
                          type="number" 
                          min="0" max="100" step="1" 
                          value={Math.round(activity.percentage)} 
                          onChange={(e) => updateAndScalePercentages(activity.id, Number.parseFloat(e.target.value) || 0)} 
                          className="w-full" 
                      />
                      <span className="text-sm text-gray-600">%</span>
                    </div>

                    <div className="sm:col-span-3 flex items-center space-x-2">
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
                      />
                      <span className="text-sm text-gray-600">min</span>
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
      <ColorPicker isOpen={colorPickerState.isOpen} onClose={closeColorPicker} currentColor={colorPickerState.currentColor} onColorChange={handleColorChange} favorites={favoriteColors} onAddFavorite={addFavoriteColor} />
      <DistributeTimeModal isOpen={isDistributeModalOpen} onClose={handleCloseDistributeModal} bankedTime={bankedTime} onDistribute={handleDistributeTime} />
    </div>
  );
}
