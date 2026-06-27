import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { 
  Pencil, Play, Trash2, Sparkles, Eraser, Printer, Highlighter, ZoomIn, ZoomOut, Maximize, Download,
  Type, Baseline, CarFront, Star, Cloud, Moon, Sun, Truck, Heart, Plane, Rocket,  
  Bird, Home, Key, Music, Smile, Umbrella, Zap, FileText, Volume2, VolumeX, Settings, BookOpen, Hash,
  ShoppingCart, Coins, BarChart, Award, Trophy, Medal, Gift, Bot, Gamepad2, Ghost, Eye, Mic,
  ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Move, RotateCcw, Info,
  PenTool, Palette, Paintbrush, MoreHorizontal, Minus, CloudRain, Lock, Droplets,
  Compass, Crown, Shield, Flame, Shapes,
  Square, Triangle, Circle, RectangleHorizontal, Hexagon, Diamond
} from 'lucide-react';
import Confetti from 'react-confetti';
import { puter } from '@heyputer/puter.js';
import Draggable from 'react-draggable';
import PrintableWorksheet from './components/PrintableWorksheet';
import VoiceSettingsModal from './components/VoiceSettingsModal';
import { generateTracingStrokes } from './utils/VectorEngine';
import { analyzeTelemetry } from './services/lexiService';
import { 
  DUMMY_USERS, saveUserScore, getUserHistory, calculateStreak, 
  getPracticeWords, savePracticeWords,
  getPracticeSentences, savePracticeSentences,
  getUserCoins, addCoins, deductCoins, getPurchasedColors, purchaseColor,
  getPurchasedGifts, purchaseGift
} from './data/users';
import { speakText, playVictorySound, setMuted, getMuted, playWhooshSound } from './services/audioService';
const lexiAvatarUrl = '/lexi-avatar.png';
import './index.css';

const GIFTS = [
  { id: 'robot', name: 'Bot Buddy', icon: Bot, price: 50, color: '#3b82f6' },
  { id: 'gamepad', name: 'Gamer Pad', icon: Gamepad2, price: 100, color: '#ef4444' },
  { id: 'ghost', name: 'Friendly Ghost', icon: Ghost, price: 200, color: '#8b5cf6' }
];

const tracingShapes = [
  { id: 'car', icon: CarFront, name: 'Car' },
  { id: 'star', icon: Star, name: 'Star' },
  { id: 'cloud', icon: Cloud, name: 'Cloud' },
  { id: 'moon', icon: Moon, name: 'Moon' },
  { id: 'sun', icon: Sun, name: 'Sun' },
  { id: 'truck', icon: Truck, name: 'Truck' },
  { id: 'heart', icon: Heart, name: 'Heart' },
  { id: 'plane', icon: Plane, name: 'Plane' },
  { id: 'rocket', icon: Rocket, name: 'Rocket' },
  { id: 'bird', icon: Bird, name: 'Bird' },
  { id: 'home', icon: Home, name: 'Home' },
  { id: 'key', icon: Key, name: 'Key' },
  { id: 'music', icon: Music, name: 'Music' },
  { id: 'smile', icon: Smile, name: 'Smile' },
  { id: 'umbrella', icon: Umbrella, name: 'Umbrella' },
  { id: 'zap', icon: Zap, name: 'Lightning' }
];

const DrawingCanvas = forwardRef(({ onDrawEnd, color, isEraser, penWidth, penStyle, expectedStrokes, onStrokeQuality, forgivingHitbox }, ref) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef([]);
  const accuracyStatsRef = useRef({ onTrack: 0, offTrack: 0 });
  const expectedPointsCoveredRef = useRef(new Set());
  const replayIdRef = useRef(0);
  
  const lastPos = useRef(null);
  const lastQuality = useRef(null);

  useEffect(() => {
    expectedPointsCoveredRef.current.clear();
  }, [expectedStrokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = 3000;
    canvas.height = 3000;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
      time: performance.now()
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y, time } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    currentStrokeRef.current = [{ x, y, time }];
    lastPos.current = { x, y, time };
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y, time } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    
    let currentWidth = penWidth;
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 100;
      
      // Physically delete points from the telemetry memory array (using line segment distance)
      const eraserRadius = Math.max(100, penWidth * 1.5); 
      const newStrokes = [];
      const prevX = lastPos.current ? lastPos.current.x : x;
      const prevY = lastPos.current ? lastPos.current.y : y;
      
      const distToSegmentSq = (px, py, x1, y1, x2, y2) => {
        const l2 = (x2 - x1)**2 + (y2 - y1)**2;
        if (l2 === 0) return (px - x1)**2 + (py - y1)**2;
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return (px - (x1 + t * (x2 - x1)))**2 + (py - (y1 + t * (y2 - y1)))**2;
      };

      strokesRef.current.forEach(stroke => {
        let currentNewStroke = [];
        stroke.forEach(pt => {
           const dist = Math.sqrt(distToSegmentSq(pt.x, pt.y, prevX, prevY, x, y));
           if (dist > eraserRadius) {
               currentNewStroke.push(pt);
           } else {
               if (currentNewStroke.length > 0) {
                   newStrokes.push(currentNewStroke);
                   currentNewStroke = [];
               }
           }
        });
        if (currentNewStroke.length > 0) {
            newStrokes.push(currentNewStroke);
        }
      });
      strokesRef.current = newStrokes;

    } else {
      let isOffTrack = false;
      let minDistance = Infinity;
      let isFreeDrawing = !expectedStrokes || expectedStrokes.length === 0;

      if (!isFreeDrawing) {
        let globalIdx = 0;
        for (const stroke of expectedStrokes) {
          for (const pt of stroke.points) {
            const distX = x - pt[0];
            const distY = y - pt[1];
            const dist = Math.sqrt(distX*distX + distY*distY);
            if (dist < minDistance) minDistance = dist;
            if (dist < 150) {
              expectedPointsCoveredRef.current.add(globalIdx);
            }
            globalIdx++;
          }
        }
        // 150px on a 3000x3000 canvas is roughly 40px on an 800x800 screen
        let hitThreshold = Math.max(120, penWidth * 5); // Dynamic Hitbox based on pen size
        if (forgivingHitbox) {
           hitThreshold = Math.max(300, penWidth * 10);
        }
        if (minDistance > hitThreshold) {
          isOffTrack = true;
        }
      }

      // Fairy dust for perfect tracing or free drawing
      let fairyDustThreshold = forgivingHitbox ? 250 : 80;
      if (isFreeDrawing || minDistance < fairyDustThreshold) {
        if (onStrokeQuality && lastQuality.current !== 'good') {
          onStrokeQuality('good');
          lastQuality.current = 'good';
        }
        if (Math.random() > 0.4) {
          const pX = x + (Math.random() - 0.5) * 80;
          const pY = y + (Math.random() - 0.5) * 80;
          ctx.beginPath();
          ctx.arc(pX, pY, Math.random() * 4 + 2, 0, Math.PI * 2);
          ctx.fillStyle = ['#fde047', '#67e8f9', '#a78bfa', '#f472b6', '#ffffff'][Math.floor(Math.random() * 5)];
          ctx.fill();
        }
      }

      ctx.strokeStyle = isOffTrack ? '#ef4444' : color;
      
      if (!isEraser) {
        if (isOffTrack) accuracyStatsRef.current.offTrack++;
        else accuracyStatsRef.current.onTrack++;
      }
      
      if (isOffTrack && onStrokeQuality && lastQuality.current !== 'bad') {
        onStrokeQuality('bad');
        lastQuality.current = 'bad';
      }
      
      if (penStyle === 'highlighter') {
        ctx.globalAlpha = 0.4;
        currentWidth = penWidth * 2;
        ctx.lineCap = 'round';
      } 
      else if (penStyle === 'neon') {
        ctx.shadowBlur = 15;
        ctx.shadowColor = ctx.strokeStyle;
      }
      else if (penStyle === 'rainbow') {
        const hue = (time / 10) % 360;
        ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
        if (isOffTrack) ctx.strokeStyle = '#ef4444'; // Red overrides rainbow
      }
      else if (penStyle === 'fountain' && lastPos.current) {
        const dx = x - lastPos.current.x;
        const dy = y - lastPos.current.y;
        const dt = time - lastPos.current.time;
        const distance = Math.sqrt(dx*dx + dy*dy);
        const speed = distance / (dt || 1);
        
        const maxSpeed = 3.0; 
        const speedFactor = Math.max(0.15, 1 - (speed / maxSpeed));
        currentWidth = Math.max(2, penWidth * speedFactor * 1.8);
      }
      else if (penStyle === 'dotted') {
        ctx.setLineDash([currentWidth / 2, currentWidth * 2]);
        ctx.lineCap = 'round';
      }
      else if (penStyle === 'dashed') {
        ctx.setLineDash([currentWidth * 3, currentWidth * 2]);
        ctx.lineCap = 'square';
      }
      else if (penStyle === 'brush') {
        ctx.globalAlpha = 0.5;
        ctx.shadowBlur = Math.random() * 4;
        ctx.shadowColor = ctx.strokeStyle;
      }
      else if (penStyle === 'spray' && lastPos.current) {
        ctx.fillStyle = ctx.strokeStyle;
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * currentWidth * 1.5;
          ctx.beginPath();
          ctx.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, Math.random() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        if (!isEraser) {
          currentStrokeRef.current.push({ x, y, time });
        }
        lastPos.current = { x, y, time };
        return;
      }
      
      ctx.lineWidth = currentWidth;
    }

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    if (!isEraser) {
      currentStrokeRef.current.push({ x, y, time });
    }
    
    lastPos.current = { x, y, time };
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPos.current = null;
      if (!isEraser) {
        if (currentStrokeRef.current.length > 0) {
          strokesRef.current.push(currentStrokeRef.current);
          currentStrokeRef.current = [];
        }
      }
      
      // Recompute accuracy and coverage from the exact remaining memory (solves eraser ghost points)
      let onTrack = 0;
      let offTrack = 0;
      expectedPointsCoveredRef.current.clear();
        
      const hitThreshold = Math.max(120, penWidth * 5);
        
      strokesRef.current.forEach(stroke => {
           stroke.forEach(pt => {
              let minDistance = Infinity;
              let globalIdx = 0;
              if (expectedStrokes) {
                 expectedStrokes.forEach(ts => {
                    ts.points.forEach(tp => {
                       const dist = Math.sqrt((pt.x - tp[0])**2 + (pt.y - tp[1])**2);
                       if (dist < minDistance) minDistance = dist;
                       // Tightened coverage check so a single point doesn't cover half the screen
                       if (dist < 50) expectedPointsCoveredRef.current.add(globalIdx);
                       globalIdx++;
                    });
                 });
              }
              if (minDistance > hitThreshold) offTrack++;
              else onTrack++;
           });
        });
        
        accuracyStatsRef.current.onTrack = onTrack;
        accuracyStatsRef.current.offTrack = offTrack;

        const total = onTrack + offTrack;
        const ratio = total > 0 ? (onTrack / total) : 1;
        
        const totalTargetPoints = expectedStrokes ? expectedStrokes.reduce((acc, stroke) => acc + stroke.points.length, 0) : 0;
        const coverageRatio = totalTargetPoints > 0 ? (expectedPointsCoveredRef.current.size / totalTargetPoints) : 1;
        const expectedStrokeCount = expectedStrokes ? expectedStrokes.length : 1;
        
        let expectedStartPoint = null;
        if (expectedStrokes && expectedStrokes.length > 0 && expectedStrokes[0].points.length > 0) {
           expectedStartPoint = expectedStrokes[0].points[0];
        }

        let targetMinX = Infinity, targetMaxX = -Infinity, targetMinY = Infinity, targetMaxY = -Infinity;
        let targetDistance = 0;
        if (expectedStrokes) {
           expectedStrokes.forEach(stroke => {
              stroke.points.forEach(p => {
                 const px = Array.isArray(p) ? p[0] : p.x;
                 const py = Array.isArray(p) ? p[1] : p.y;
                 if (px < targetMinX) targetMinX = px;
                 if (px > targetMaxX) targetMaxX = px;
                 if (py < targetMinY) targetMinY = py;
                 if (py > targetMaxY) targetMaxY = py;
              });
              for(let i=1; i<stroke.points.length; i++) {
                 const px1 = Array.isArray(stroke.points[i]) ? stroke.points[i][0] : stroke.points[i].x;
                 const py1 = Array.isArray(stroke.points[i]) ? stroke.points[i][1] : stroke.points[i].y;
                 const px0 = Array.isArray(stroke.points[i-1]) ? stroke.points[i-1][0] : stroke.points[i-1].x;
                 const py0 = Array.isArray(stroke.points[i-1]) ? stroke.points[i-1][1] : stroke.points[i-1].y;
                 const dx = px1 - px0;
                 const dy = py1 - py0;
                 targetDistance += Math.sqrt(dx*dx + dy*dy);
              }
           });
        }
        
        if (onDrawEnd) {
          onDrawEnd({
            strokes: strokesRef.current,
            accuracyRatio: ratio,
            coverageRatio: coverageRatio,
            expectedStrokeCount: expectedStrokeCount,
            expectedStartPoint: expectedStartPoint,
            expectedStrokes: expectedStrokes,
            targetDistance: targetDistance,
            targetBoundingBox: targetMinX !== Infinity ? { minX: targetMinX, maxX: targetMaxX, minY: targetMinY, maxY: targetMaxY } : null
          });
        }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current = [];
    currentStrokeRef.current = [];
    accuracyStatsRef.current = { onTrack: 0, offTrack: 0 };
    expectedPointsCoveredRef.current.clear();
    replayIdRef.current++; // Cancel any active replays
    onDrawEnd({ strokes: [], accuracyRatio: 1, coverageRatio: 0, expectedStrokeCount: 1 });
  };

  const replayStroke = (strokesArray) => {
    if (!strokesArray || strokesArray.length === 0) return;
    clearCanvas();
    const currentReplayId = replayIdRef.current;
    
    const ctx = canvasRef.current.getContext('2d');
    
    // Ghost pen style
    ctx.strokeStyle = '#a855f7'; // purple ghost line
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.5;

    let strokeIndex = 0;
    let pointIndex = 0;

    const drawStep = () => {
      if (replayIdRef.current !== currentReplayId) return; // Cancel if cleared
      if (strokeIndex >= strokesArray.length) return;
      
      const currentStroke = strokesArray[strokeIndex];
      if (pointIndex >= currentStroke.length - 1) {
         // Move to next stroke
         strokeIndex++;
         pointIndex = 0;
         if (strokeIndex < strokesArray.length) {
            const nextStroke = strokesArray[strokeIndex];
            const timeDiff = nextStroke[0].time - currentStroke[currentStroke.length - 1].time;
            setTimeout(drawStep, Math.min(1000, Math.max(16, timeDiff)));
         }
         return;
      }
      
      const p1 = currentStroke[pointIndex];
      const p2 = currentStroke[pointIndex + 1];
      
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      
      pointIndex++;
      
      const timeDiff = p2.time - p1.time;
      setTimeout(drawStep, Math.min(1000, Math.max(16, timeDiff)));
    };
    
    drawStep();
  };

  useImperativeHandle(ref, () => ({
    clearCanvas,
    replayStroke
  }));

  return (
    <canvas
      ref={canvasRef}
      className="drawing-canvas"
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseOut={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
    />
  );
});

// ========== LANDING PAGE ==========
function LandingPage({ onGetStarted, onTryDemo }) {
  return (
    <div className="landing-container">
      <nav className="landing-nav">
        <div className="landing-nav-brand">
          <img src={lexiAvatarUrl} style={{width: 40, height: 40, borderRadius: '50%'}} alt="Lexi" />
          <span className="lexi-logo" style={{fontSize: '1.5rem', margin: 0}}>Le<span className="xi-text">xi</span></span>
        </div>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#tech">Technology</a>
          <button className="landing-cta-small" onClick={onGetStarted}>Log In</button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-badge">🧠 AI-Powered Dyslexia Support</div>
          <h1 className="landing-title">
            Meet <span className="landing-highlight">Lexi</span> — Your Child's AI Writing Coach
          </h1>
          <p className="landing-subtitle">
            A multi-sensory, gamified handwriting therapy platform that uses real-time clinical telemetry 
            to help children with dyslexia and dysgraphia build confidence in writing.
          </p>
          <div className="landing-cta-group">
            <button className="landing-cta-primary" onClick={onTryDemo}>
              <Sparkles size={20} /> Try Live Demo
            </button>
            <button className="landing-cta-secondary" onClick={onGetStarted}>
              Log In →
            </button>
          </div>
          <div className="landing-stats">
            <div className="landing-stat">
              <span className="landing-stat-value">13</span>
              <span className="landing-stat-label">Clinical Metrics</span>
            </div>
            <div className="landing-stat">
              <span className="landing-stat-value">6</span>
              <span className="landing-stat-label">Learning Modes</span>
            </div>
            <div className="landing-stat">
              <span className="landing-stat-value">5</span>
              <span className="landing-stat-label">Languages</span>
            </div>
          </div>
        </div>
        <div className="landing-hero-visual">
          <img src={lexiAvatarUrl} className="landing-hero-avatar" alt="Lexi AI Coach" />
        </div>
      </section>

      <section className="landing-features" id="features">
        <h2 className="landing-section-title">Why Lexi is Different</h2>
        <div className="landing-features-grid">
          <div className="landing-feature-card">
            <div className="landing-feature-icon">✍️</div>
            <h3>Kinesthetic Learning</h3>
            <p>Unlike text-based tools, Lexi focuses on the physical act of writing — building muscle memory through guided tracing with real-time stroke analysis.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon">🧠</div>
            <h3>13 Clinical Metrics</h3>
            <p>Every stroke is analyzed for tremor, fluidity, cognitive load, motor planning, and 9 more clinical indicators used by occupational therapists.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon">💖</div>
            <h3>Emotional AI Companion</h3>
            <p>Lexi isn't a cold diagnostic tool. She celebrates wins, encourages through struggles, and builds confidence — reducing anxiety around writing.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon">🎮</div>
            <h3>Gamified Motivation</h3>
            <p>Coins, streaks, mastery stars, a rewards store, and achievement certificates keep children engaged and coming back every day.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon">📊</div>
            <h3>Clinical Dashboard</h3>
            <p>Parents and teachers get detailed analytics, trend graphs for each metric, and CSV export for therapist reports.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon">🌍</div>
            <h3>Multilingual Engine</h3>
            <p>Supports English, Spanish, French, German, and Italian — with the Orton-Gillingham multi-sensory approach adapted for each language.</p>
          </div>
        </div>
      </section>

      <section className="landing-how" id="how-it-works">
        <h2 className="landing-section-title">How It Works</h2>
        <div className="landing-steps">
          <div className="landing-step">
            <div className="landing-step-number">1</div>
            <h3>Choose a Mission</h3>
            <p>Pick from letters, words, sentences, numbers, shapes, or drawings.</p>
          </div>
          <div className="landing-step-arrow">→</div>
          <div className="landing-step">
            <div className="landing-step-number">2</div>
            <h3>Trace & Draw</h3>
            <p>Follow the gray template on screen. Lexi watches every stroke in real-time.</p>
          </div>
          <div className="landing-step-arrow">→</div>
          <div className="landing-step">
            <div className="landing-step-number">3</div>
            <h3>Get AI Feedback</h3>
            <p>Tap Lexi for instant scoring, personalized tips, and clinical analysis.</p>
          </div>
        </div>
      </section>

      <section className="landing-tech" id="tech">
        <h2 className="landing-section-title">Built With</h2>
        <div className="landing-tech-grid">
          <div className="landing-tech-pill">React</div>
          <div className="landing-tech-pill">Custom Canvas Vector Engine</div>
          <div className="landing-tech-pill">Web Audio API</div>
          <div className="landing-tech-pill">Speech Synthesis</div>
          <div className="landing-tech-pill">Client-Side AI (No APIs)</div>
          <div className="landing-tech-pill">Orton-Gillingham Method</div>
          <div className="landing-tech-pill">localStorage Persistence</div>
          <div className="landing-tech-pill">Glassmorphism UI</div>
        </div>
      </section>

      <footer className="landing-footer">
        <button className="landing-cta-primary" onClick={onTryDemo} style={{fontSize: '1.2rem', padding: '16px 40px'}}>
          <Sparkles size={20} /> Launch Demo Now
        </button>
        <p style={{marginTop: '1rem', color: '#94a3b8', fontSize: '0.9rem'}}>Built by Team CI at Youth Code x AI 2026 💜</p>
      </footer>
    </div>
  );
}

// ========== ONBOARDING OVERLAY ==========
function OnboardingOverlay({ onComplete }) {
  const [step, setStep] = useState(0);
  
  const steps = [
    {
      title: "Pick a Letter!",
      description: "Use the sidebar on the left to choose what you want to practice — letters, words, numbers, or shapes!",
      icon: "🔤",
      target: "sidebar"
    },
    {
      title: "Trace the Template!",
      description: "See the gray letter on the canvas? Trace over it carefully with your mouse or finger. Stay on the lines!",
      icon: "✍️",
      target: "canvas"
    },
    {
      title: "Ask Lexi for a Score!",
      description: "When you're done drawing, click on Lexi at the top. She'll analyze your drawing and give you tips!",
      icon: "🤖",
      target: "lexi"
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('lexi_onboarded', 'true');
      onComplete();
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-progress">
          {steps.map((_, i) => (
            <div key={i} className={`onboarding-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
          ))}
        </div>
        <div className="onboarding-icon">{steps[step].icon}</div>
        <h2 className="onboarding-title">{steps[step].title}</h2>
        <p className="onboarding-desc">{steps[step].description}</p>
        <button className="onboarding-btn" onClick={handleNext}>
          {step < steps.length - 1 ? 'Next →' : "Let's Go! 🚀"}
        </button>
        <button className="onboarding-skip" onClick={() => { localStorage.setItem('lexi_onboarded', 'true'); onComplete(); }}>
          Skip Tutorial
        </button>
      </div>
    </div>
  );
}

// ========== ABOUT / TECH MODAL ==========
function AboutModal({ onClose }) {
  return (
    <div className="portal-overlay" onClick={onClose}>
      <div className="portal-box" onClick={e => e.stopPropagation()} style={{ width: '700px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="portal-header" style={{flexDirection: 'column', textAlign: 'center'}}>
          <img src={lexiAvatarUrl} style={{width: 80, height: 80, borderRadius: '50%', border: '3px solid #ec4899', boxShadow: '0 0 15px rgba(236,72,153,0.5)'}} alt="Lexi" />
          <h2 style={{fontSize: '2rem', margin: '10px 0 5px 0'}}>About Lexi</h2>
          <p style={{color: '#64748b', margin: 0}}>AI-Powered Dyslexia & Dysgraphia Writing Coach</p>
        </div>

        <div style={{ padding: '20px', lineHeight: 1.8, color: '#475569' }}>
          <h3 style={{color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px'}}>🧠 The Problem</h3>
          <p>Dyslexia affects 15-20% of the population. Most AI tools focus on <em>reading</em> assistance (text-to-speech, font changes). But children with dyslexia often also struggle with <strong>dysgraphia</strong> — difficulty with the physical act of writing.</p>

          <h3 style={{color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px'}}>💡 Our Approach</h3>
          <p>Lexi uses the <strong>Orton-Gillingham multi-sensory methodology</strong> — a proven, evidence-based approach that builds neural pathways through kinesthetic (touch), visual, and auditory feedback simultaneously.</p>

          <h3 style={{color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px'}}>⚙️ Technical Architecture</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
            {[
              { label: 'Frontend', value: 'React + Vite' },
              { label: 'Drawing Engine', value: 'Custom Canvas Vector Engine' },
              { label: 'AI Analysis', value: 'Client-side (Zero API calls)' },
              { label: 'Audio', value: 'Web Audio API + Speech Synthesis' },
              { label: 'Data Persistence', value: 'localStorage (offline-first)' },
              { label: 'Real-time Metrics', value: '13 clinical indicators tracking speed, pressure & tremors' },
              { label: 'Accessibility', value: 'OpenDyslexic font, high contrast' },
              { label: 'Languages', value: 'English, Spanish, French, German, Italian' }
            ].map((item, i) => (
              <div key={i} style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', fontSize: '0.9rem' }}>
                <strong style={{color: '#0ea5e9'}}>{item.label}:</strong> {item.value}
              </div>
            ))}
          </div>

          <h3 style={{color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px', marginTop: '20px'}}>📊 13 Clinical Telemetry Features</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
            {['Geometric Accuracy', 'Stroke Coverage', 'Motor Planning', 'Orthographic Recall', 'Start Point Accuracy', 'Fluidity', 'Tremor Detection', 'Cognitive Load', 'Proportionality', 'Size Control', 'Directionality', 'Biomechanics', 'Stroke Order & Proximity'].map((f, i) => (
              <span key={i} style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>{f}</span>
            ))}
          </div>
        </div>

        <button className="portal-close-btn" onClick={onClose} style={{marginTop: '1rem'}}>Close</button>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    const user = DUMMY_USERS.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (user) {
      setError('');
      onLogin(user);
    } else {
      setError('Incorrect username or password. Ask your teacher for help!');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="lexi-logo-container">
          <img src={lexiAvatarUrl} className="lexi-avatar" alt="Lexi" />
          <h1 className="lexi-logo">Le<span className="xi-text">xi</span></h1>
        </div>
        <p>Log in to access your drawing board!</p>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleLogin}>
          <input 
            type="text" 
            className="login-input" 
            placeholder="Username (e.g. alex)" 
            value={username} 
            onChange={e => setUsername(e.target.value)}
          />
          <input 
            type="password" 
            className="login-input" 
            placeholder="Password (e.g. password123)" 
            value={password} 
            onChange={e => setPassword(e.target.value)}
          />
          <button type="submit" className="login-btn">Start Drawing!</button>
        </form>
      </div>
    </div>
  );
}

function StudentPortal({ user, onClose, onLogout }) {
  const history = getUserHistory(user.username);
  const streak = calculateStreak(history);
  const averageScore = history.length > 0 
    ? Math.round(history.reduce((acc, curr) => acc + curr.score, 0) / history.length) 
    : 0;

  const [activeTab, setActiveTab] = useState('progress');
  const [expandedDates, setExpandedDates] = useState({});
  const [selectedClinicalFeature, setSelectedClinicalFeature] = useState('Geometric Accuracy');

  const toggleDate = (dateStr) => {
    setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  const groupedHistory = history.reduce((acc, curr) => {
    const dateObj = new Date(curr.date);
    const dateStr = dateObj.toLocaleDateString();
    if (!acc[dateStr]) {
       acc[dateStr] = {
           label: dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }),
           items: [],
           timestamp: dateObj.setHours(0,0,0,0)
       };
    }
    acc[dateStr].items.push(curr);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedHistory).sort((a, b) => groupedHistory[b].timestamp - groupedHistory[a].timestamp);

  useEffect(() => {
    if (sortedDates.length > 0) {
      setExpandedDates({ [sortedDates[0]]: true });
    }
  }, []);

  const recentHistory = history.slice(-10);

  const getMasteryGroups = () => {
    // Initialize with all possible items
    const groups = {
      'Capital Alphabets': Array.from({length: 26}, (_, i) => ({ target: String.fromCharCode(65 + i), count: 0 })),
      'Small Alphabets': Array.from({length: 26}, (_, i) => ({ target: String.fromCharCode(97 + i), count: 0 })),
      'Numbers': Array.from({length: 10}, (_, i) => ({ target: i.toString(), count: 0 })),
      'Words': getPracticeWords().map(w => ({ target: w, count: 0 })),
      'Sentences': getPracticeSentences().map(s => ({ target: s, count: 0 })),
      'Shapes': ['Square', 'Triangle', 'Circle', 'Star', 'Rectangle', 'Heart', 'Diamond', 'Oval', 'Hexagon'].map(shape => ({ target: shape, count: 0 })),
      'Drawings': tracingShapes.map(s => ({ target: s.name, count: 0 }))
    };
    
    // Fast lookup
    const itemMap = {};
    Object.values(groups).forEach(arr => {
      arr.forEach(item => {
        itemMap[item.target] = item;
      });
    });

    history.forEach(item => {
      let target = item.targetItem;
      let mode = item.mode;

      if (!target && item.mission) {
        const match = item.mission.match(/["']([^"']+)["']/);
        if (match) {
           target = match[1];
           mode = item.mission.toLowerCase().includes('letter') ? 'letters' :
                  item.mission.toLowerCase().includes('number') ? 'numbers' :
                  item.mission.toLowerCase().includes('word') ? 'spelling' :
                  item.mission.toLowerCase().includes('sentence') ? 'sentences' : mode;
        }
      }

      if (!target || typeof target !== 'string' || target.trim() === '') return;
      
      if (!itemMap[target]) {
        // dynamically append old or custom items not in current arrays
        const newItem = { target: target, count: 0 };
        itemMap[target] = newItem;
        if (mode === 'letters' || target.length === 1) {
          if (target === target.toUpperCase()) groups['Capital Alphabets'].push(newItem);
          else groups['Small Alphabets'].push(newItem);
        } else if (mode === 'numbers' || !isNaN(target)) {
          groups['Numbers'].push(newItem);
        } else if (mode === 'sentences' || target.includes(' ')) {
          groups['Sentences'].push(newItem);
        } else if (mode === 'games') {
          groups['Shapes'].push(newItem);
        } else if (mode === 'tracing') {
          groups['Drawings'].push(newItem);
        } else {
          groups['Words'].push(newItem);
        }
      }

      if (item.score >= 80) itemMap[target].count++;
    });

    return groups;
  };

  const renderMasteryStar = (count) => {
    if (count >= 7) return <Star className="star-gold" />;
    if (count >= 4) return <Star className="star-silver" />;
    if (count >= 2) return <Star className="star-bronze" />;
    return <Star className="star-locked" />;
  };

  const masteryGroups = getMasteryGroups();

  const getActivityData = () => {
    const data = {};
    history.forEach(item => {
      const dateStr = new Date(item.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
      if (!data[dateStr]) data[dateStr] = { date: dateStr, count: 0 };
      data[dateStr].count++;
    });
    return Object.values(data).slice(-14);
  };

  const getTrendData = () => {
    const data = {};
    history.forEach(item => {
      const dateStr = new Date(item.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
      if (!data[dateStr]) data[dateStr] = { date: dateStr, totalScore: 0, count: 0 };
      data[dateStr].totalScore += item.score;
      data[dateStr].count++;
    });
    return Object.values(data).map(d => ({
      date: d.date,
      score: Math.round(d.totalScore / d.count)
    })).slice(-14);
  };

  const getCategoryPerformanceData = () => {
    const groups = getMasteryGroups();
    
    return [
      { subject: 'Caps', data: groups['Capital Alphabets'] },
      { subject: 'Smalls', data: groups['Small Alphabets'] },
      { subject: 'Nums', data: groups['Numbers'] },
      { subject: 'Words', data: groups['Words'] },
      { subject: 'Sentences', data: groups['Sentences'] },
      { subject: 'Shapes', data: groups['Shapes'] },
      { subject: 'Drawings', data: groups['Drawings'] },
    ].map(cat => {
      const totalItems = cat.data ? cat.data.length : 0;
      // An item has reached at least Bronze if count >= 2
      const masteredItems = cat.data ? cat.data.filter(item => item.count >= 2).length : 0;
      
      return {
        subject: cat.subject,
        A: totalItems > 0 ? Math.round((masteredItems / totalItems) * 100) : 0,
        fullMark: 100
      };
    });
  };

  const getInsights = () => {
    const stats = {};
    history.forEach(item => {
      let target = item.targetItem;
      if (!target && item.mission) {
        const match = item.mission.match(/["']([^"']+)["']/);
        if (match) target = match[1];
      }
      if (!target || typeof target !== 'string' || target.trim() === '') return;
      
      if (!stats[target]) stats[target] = { target, totalScore: 0, count: 0 };
      stats[target].totalScore += item.score;
      stats[target].count++;
    });
    
    const arr = Object.values(stats)
      .filter(s => s.count >= 2) 
      .map(s => ({ target: s.target, avg: Math.round(s.totalScore / s.count) }));
      
    arr.sort((a, b) => b.avg - a.avg);
    
    return {
      best: arr.slice(0, 3),
      needsPractice: arr.slice(-3).reverse().filter(a => a.avg < 80)
    };
  };

  const getTelemetryFeatureAverages = () => {
    const featureStats = {};
    history.forEach(item => {
      if (item.factors && Array.isArray(item.factors)) {
        item.factors.forEach(f => {
          if (!featureStats[f.category]) featureStats[f.category] = { total: 0, count: 0 };
          featureStats[f.category].total += f.score;
          featureStats[f.category].count++;
        });
      }
    });
    return Object.keys(featureStats).map(key => ({
      category: key,
      avg: Math.round(featureStats[key].total / featureStats[key].count)
    })).sort((a, b) => b.avg - a.avg);
  };

  const getFeatureTrendData = (featureCategory) => {
    const data = {};
    history.forEach(item => {
      if (item.factors && Array.isArray(item.factors)) {
        const factor = item.factors.find(f => f.category === featureCategory);
        if (factor) {
          const dateStr = new Date(item.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
          if (!data[dateStr]) data[dateStr] = { date: dateStr, totalScore: 0, count: 0 };
          data[dateStr].totalScore += factor.score;
          data[dateStr].count++;
        }
      }
    });
    return Object.values(data).map(d => ({
      date: d.date,
      score: Math.round(d.totalScore / d.count)
    })).slice(-14);
  };

  const downloadCSV = () => {
    if (history.length === 0) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Mission,Target,Overall Score,Geometric Accuracy,Stroke Coverage,Motor Planning,Orthographic Recall,Start Point,Fluidity,Tremor,Cognitive Load,Proportionality,Size Control,Directionality,Biomechanics,Stroke Order & Proximity\n";
    
    history.forEach(item => {
      const date = new Date(item.date).toLocaleDateString() + " " + new Date(item.date).toLocaleTimeString();
      const mission = `"${item.mission || ''}"`;
      const target = `"${item.targetItem || ''}"`;
      const score = item.score;
      
      let row = `${date},${mission},${target},${score}`;
      
      const getFactor = (cat) => {
        if (!item.factors) return "";
        const f = item.factors.find(x => x.category === cat);
        return f ? f.score : "";
      };
      
      row += `,${getFactor("Geometric Accuracy")}`;
      row += `,${getFactor("Stroke Coverage")}`;
      row += `,${getFactor("Motor Planning")}`;
      row += `,${getFactor("Orthographic Recall")}`;
      row += `,${getFactor("Start Point")}`;
      row += `,${getFactor("Fluidity")}`;
      row += `,${getFactor("Tremor")}`;
      row += `,${getFactor("Cognitive Load")}`;
      row += `,${getFactor("Proportionality")}`;
      row += `,${getFactor("Size Control")}`;
      row += `,${getFactor("Directionality")}`;
      row += `,${getFactor("Biomechanics")}`;
      row += `,${getFactor("Stroke Order & Proximity")}`;
      
      csvContent += row + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${user.name.replace(/ /g, '_')}_clinical_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activityData = getActivityData();
  const trendData = getTrendData();
  const categoryData = getCategoryPerformanceData();
  const insights = getInsights();
  const featureAverages = getTelemetryFeatureAverages();
  const featureTrendData = getFeatureTrendData(selectedClinicalFeature);

  return (
    <div className="portal-overlay" onClick={onClose}>
      <div className="portal-box" onClick={e => e.stopPropagation()} style={{ width: '900px', maxWidth: '95vw' }}>
        <div className="portal-header">
          <div className="portal-avatar">{user.avatar}</div>
          <h2>{user.name}'s Dashboard</h2>
        </div>
        
        <div className="portal-stats">
          <div className="stat-card">
            <div className="stat-value">{streak} 🔥</div>
            <div className="stat-label">Day Streak</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{history.length}</div>
            <div className="stat-label">Exercises</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{averageScore}</div>
            <div className="stat-label">Avg Score</div>
          </div>
        </div>

        <div className="dashboard-tabs">
          <div className={`dashboard-tab ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>Progress & Mastery</div>
          <div className={`dashboard-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>History</div>
          <div className={`dashboard-tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>Analytics</div>
        </div>

        <div className="history-list" style={{ padding: '0.5rem', border: 'none', height: '400px', overflowY: 'auto' }}>
          
          {activeTab === 'history' && (
            sortedDates.length === 0 ? (
              <p style={{textAlign: 'center', color: '#94a3b8'}}>No exercises completed yet. Start drawing!</p>
            ) : (
              sortedDates.map((dateStr) => (
                <div key={dateStr} className="history-folder">
                  <div className="history-folder-header" onClick={() => toggleDate(dateStr)}>
                    <span>📁 {groupedHistory[dateStr].label}</span>
                    <span>{expandedDates[dateStr] ? '▼' : '▶'}</span>
                  </div>
                  {expandedDates[dateStr] && (
                    <div className="history-folder-content">
                      {groupedHistory[dateStr].items.sort((a, b) => new Date(b.date) - new Date(a.date)).map((item, i) => (
                        <div key={i} className="history-item">
                          <div>
                            <span className="history-mission">{item.mission}</span>
                            <span className="history-date">{new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <div className="history-score">{item.score}/100</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )
          )}

          {activeTab === 'analytics' && (
            history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '15px' }}>
                <p>No data yet. Complete some tracing missions to see your progress!</p>
              </div>
            ) : (
              <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '10px' }}>
                
                {/* Accuracy Trend (Line Chart) */}
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '15px', gridColumn: '1 / -1' }}>
                  <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', color: '#475569' }}>Accuracy Trend (Last 14 Days)</h3>
                  
                  <div style={{ position: 'relative', height: '180px', padding: '10px 10px 30px 10px' }}>
                    {/* Y-Axis lines */}
                    <div style={{ position: 'absolute', top: '10px', left: 0, right: 0, borderTop: '1px dashed #cbd5e1' }}></div>
                    <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed #cbd5e1' }}></div>
                    <div style={{ position: 'absolute', bottom: '30px', left: 0, right: 0, borderTop: '1px dashed #cbd5e1' }}></div>

                    {/* The Line Graph */}
                    <svg width="100%" height="100%" style={{ overflow: 'visible', position: 'relative', zIndex: 1 }}>
                      {trendData.map((d, i) => {
                        if (i === 0) return null;
                        const prev = trendData[i - 1];
                        const x1 = ((i - 1) / Math.max(trendData.length - 1, 1)) * 100;
                        const y1 = 100 - prev.score;
                        const x2 = (i / Math.max(trendData.length - 1, 1)) * 100;
                        const y2 = 100 - d.score;
                        return (
                          <line 
                            key={`line-${i}`}
                            x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} 
                            stroke="#3b82f6" strokeWidth="3" 
                          />
                        );
                      })}
                      {trendData.map((d, i) => {
                        const x = (i / Math.max(trendData.length - 1, 1)) * 100;
                        const y = 100 - d.score;
                        return (
                          <g key={`point-${i}`}>
                            <circle 
                              cx={`${x}%`} cy={`${y}%`} r="6" 
                              fill="#ffffff" stroke="#3b82f6" strokeWidth="3" 
                            />
                            <text 
                              x={`${x}%`} y={`${y}%`} 
                              dy="-15" textAnchor="middle" 
                              fontSize="12" fontWeight="bold" fill="#3b82f6"
                            >
                              {d.score}%
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    {/* X-Axis Labels */}
                    <div style={{ position: 'absolute', bottom: '0', left: '10px', right: '10px', display: 'flex', justifyContent: 'space-between' }}>
                      {trendData.map((d, i) => (
                        <div key={`label-${i}`} style={{ fontSize: '0.65rem', color: '#64748b', transform: 'translateX(-50%)' }}>
                          {d.date}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Category Performance (Horizontal Bars) */}
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '15px' }}>
                  <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', color: '#475569' }}>Category Performance</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {categoryData.map(cat => (
                      <div key={cat.subject}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px', color: '#475569', fontWeight: 'bold' }}>
                          <span>{cat.subject}</span>
                          <span style={{ color: '#10b981' }}>{cat.A}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${cat.A}%`, height: '100%', background: '#10b981', borderRadius: '4px' }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity (Vertical Bars) */}
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '15px' }}>
                  <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', color: '#475569' }}>Activity (Exercises)</h3>
                  <div style={{ display: 'flex', alignItems: 'flex-end', height: '120px', gap: '6px', overflowX: 'auto' }}>
                    {activityData.map((item, idx) => {
                      const maxCount = Math.max(...activityData.map(d => d.count), 1);
                      const heightPct = (item.count / maxCount) * 100;
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', flex: 1, minWidth: '30px', height: '100%' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '2px' }}>{item.count}</span>
                          <div style={{ 
                            width: '100%', 
                            height: `${heightPct}%`, 
                            background: '#8b5cf6',
                            borderRadius: '4px 4px 0 0',
                            opacity: 0.9
                          }}></div>
                          <span style={{ fontSize: '0.65rem', marginTop: '4px', color: '#64748b', whiteSpace: 'nowrap' }}>{item.date.split(' ')[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Insights Panel */}
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '15px', gridColumn: '1 / -1', display: 'flex', gap: '20px' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: '10px', fontSize: '1.1rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}><Sparkles size={18}/> Top Mastered</h3>
                    {insights.best.length > 0 ? (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {insights.best.map((item, i) => (
                          <div key={i} className="mastery-card gold" style={{ padding: '0.5rem', minWidth: '60px' }}>
                            <span className="mastery-item-label" style={{ fontSize: '1.2rem' }}>{item.target}</span>
                            <div style={{ fontSize: '0.7rem' }}>{item.avg}% Avg</div>
                          </div>
                        ))}
                      </div>
                    ) : <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Practice more to unlock!</p>}
                  </div>
                  
                  <div style={{ flex: 1, borderLeft: '2px dashed #cbd5e1', paddingLeft: '20px' }}>
                    <h3 style={{ marginBottom: '10px', fontSize: '1.1rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px' }}><Highlighter size={18}/> Needs Practice</h3>
                    {insights.needsPractice.length > 0 ? (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {insights.needsPractice.map((item, i) => (
                          <div key={i} className="mastery-card" style={{ padding: '0.5rem', minWidth: '60px', borderColor: '#ef4444', background: '#fef2f2' }}>
                            <span className="mastery-item-label" style={{ fontSize: '1.2rem', color: '#ef4444' }}>{item.target}</span>
                            <div style={{ fontSize: '0.7rem' }}>{item.avg}% Avg</div>
                          </div>
                        ))}
                      </div>
                    ) : <p style={{ fontSize: '0.9rem', color: '#64748b' }}>No weak areas found! Great job!</p>}
                  </div>
                </div>

                {/* --- NEW CLINICAL TELEMETRY GRAPHS --- */}
                {featureAverages.length > 0 ? (
                  <>
                    {/* 13 Features Average Performance */}
                    <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '15px', gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ fontSize: '1.1rem', color: '#475569', margin: 0 }}>Clinical Metrics Overview (All-Time Average)</h3>
                        <button onClick={downloadCSV} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>
                          <Download size={14}/> Export CSV
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                        {featureAverages.map(feat => {
                          // Color coding based on score
                          let color = '#10b981'; // green
                          if (feat.avg < 60) color = '#ef4444'; // red
                          else if (feat.avg < 80) color = '#eab308'; // yellow

                          return (
                            <div key={feat.category}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px', color: '#475569', fontWeight: 'bold' }}>
                                <span>{feat.category}</span>
                                <span style={{ color }}>{feat.avg}%</span>
                              </div>
                              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${feat.avg}%`, height: '100%', background: color, borderRadius: '3px' }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Specific Feature Trend Chart */}
                    <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '15px', gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ fontSize: '1.1rem', color: '#475569', margin: 0 }}>Specific Metric Trend (Last 14 Days)</h3>
                        <select 
                          value={selectedClinicalFeature} 
                          onChange={(e) => setSelectedClinicalFeature(e.target.value)}
                          style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#475569', background: 'white' }}
                        >
                          {featureAverages.map(feat => (
                            <option key={feat.category} value={feat.category}>{feat.category}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div style={{ position: 'relative', height: '180px', padding: '10px 10px 30px 10px' }}>
                        {featureTrendData.length === 0 ? (
                           <p style={{textAlign: 'center', color: '#94a3b8', paddingTop: '50px'}}>Not enough data for this metric yet.</p>
                        ) : (
                          <>
                            <div style={{ position: 'absolute', top: '10px', left: 0, right: 0, borderTop: '1px dashed #cbd5e1' }}></div>
                            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed #cbd5e1' }}></div>
                            <div style={{ position: 'absolute', bottom: '30px', left: 0, right: 0, borderTop: '1px dashed #cbd5e1' }}></div>

                            <svg width="100%" height="100%" style={{ overflow: 'visible', position: 'relative', zIndex: 1 }}>
                              {featureTrendData.map((d, i) => {
                                if (i === 0) return null;
                                const prev = featureTrendData[i - 1];
                                const x1 = ((i - 1) / Math.max(featureTrendData.length - 1, 1)) * 100;
                                const y1 = 100 - prev.score;
                                const x2 = (i / Math.max(featureTrendData.length - 1, 1)) * 100;
                                const y2 = 100 - d.score;
                                return (
                                  <line 
                                    key={`f-line-${i}`}
                                    x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} 
                                    stroke="#8b5cf6" strokeWidth="3" 
                                  />
                                );
                              })}
                              {featureTrendData.map((d, i) => {
                                const x = (i / Math.max(featureTrendData.length - 1, 1)) * 100;
                                const y = 100 - d.score;
                                return (
                                  <g key={`f-point-${i}`}>
                                    <circle 
                                      cx={`${x}%`} cy={`${y}%`} r="6" 
                                      fill="#ffffff" stroke="#8b5cf6" strokeWidth="3" 
                                    />
                                    <text 
                                      x={`${x}%`} y={`${y}%`} 
                                      dy="-15" textAnchor="middle" 
                                      fontSize="12" fontWeight="bold" fill="#8b5cf6"
                                    >
                                      {d.score}%
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>

                            <div style={{ position: 'absolute', bottom: '0', left: '10px', right: '10px', display: 'flex', justifyContent: 'space-between' }}>
                              {featureTrendData.map((d, i) => (
                                <div key={`f-label-${i}`} style={{ fontSize: '0.65rem', color: '#64748b', transform: 'translateX(-50%)' }}>
                                  {d.date}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '15px', gridColumn: '1 / -1', textAlign: 'center', color: '#64748b' }}>
                    <h3 style={{ marginBottom: '10px', fontSize: '1.1rem', color: '#475569' }}>Clinical Metrics Overview</h3>
                    <p>No clinical telemetry found yet. Complete a new tracing exercise to start gathering detailed AI metrics!</p>
                  </div>
                )}
              </div>
            )
          )}

          {activeTab === 'progress' && (
            <div>
              {Object.entries(masteryGroups).map(([groupName, items]) => {
                if (items.length === 0) return null;
                return (
                  <div key={groupName} style={{ marginBottom: '2rem' }}>
                    <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', color: '#475569' }}>{groupName}</h3>
                    <div className="mastery-grid">
                      {items.map(stat => {
                        let cardClass = "mastery-card";
                        if (stat.count >= 7) cardClass += " gold";
                        else if (stat.count >= 4) cardClass += " silver";
                        else if (stat.count >= 2) cardClass += " bronze";
                        
                        return (
                          <div key={stat.target} className={cardClass}>
                            <span className="mastery-item-label">{stat.target}</span>
                            {renderMasteryStar(stat.count)}
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>{stat.count} Successes</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {Object.values(masteryGroups).every(arr => arr.length === 0) && (
                <p style={{textAlign: 'center', color: '#94a3b8', padding: '2rem'}}>No progress yet. Complete exercises to earn stars!</p>
              )}
            </div>
          )}

        </div>

        <button className="portal-close-btn" style={{ width: '100%' }} onClick={onClose}>Close Dashboard</button>
        <button className="portal-logout-btn" style={{ width: '100%' }} onClick={onLogout}>Log Out</button>
      </div>
    </div>
  );
}

function ListEditorModal({ items, title, placeholder, onClose, onSave }) {
  const [list, setList] = useState(items);
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    if (newItem.trim() && !list.includes(newItem.trim())) {
      setList([...list, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemove = (item) => {
    setList(list.filter(i => i !== item));
  };

  const handleSave = () => {
    onSave(list);
    onClose();
  };

  return (
    <div className="portal-overlay" onClick={onClose}>
      <div className="word-editor-box" onClick={e => e.stopPropagation()}>
        <div className="word-editor-header">
          <h2>{title}</h2>
        </div>
        
        <div className="word-editor-add">
          <input 
            type="text" 
            className="word-editor-input" 
            placeholder={placeholder}
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button className="word-editor-add-btn" onClick={handleAdd}>Add</button>
        </div>

        <div className="word-editor-list">
          {list.map(item => (
            <div key={item} className="word-editor-item">
              {item}
              <button className="word-editor-delete" onClick={() => handleRemove(item)}>
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>

        <button className="login-btn" onClick={handleSave}>Save Changes</button>
        <button className="portal-close-btn" style={{marginTop: '0.5rem'}} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

const STORE_ITEMS = [
  { id: 'color_green', type: 'color', name: 'Lime Green', value: '#22c55e', cost: 0 },
  { id: 'color_pink', type: 'color', name: 'Neon Pink', value: '#ec4899', cost: 50 },
  { id: 'color_gold', type: 'color', name: 'Shiny Gold', value: '#eab308', cost: 100 },
  { id: 'color_purple', type: 'color', name: 'Royal Purple', value: '#a855f7', cost: 150 },
  { id: 'style_spray', type: 'style', name: 'Spray Paint Pen', value: 'spray', cost: 100 },
  { id: 'style_dotted', type: 'style', name: 'Dotted Pen', value: 'dotted', cost: 100 },
  { id: 'style_dashed', type: 'style', name: 'Dashed Pen', value: 'dashed', cost: 100 },
  { id: 'style_neon', type: 'style', name: 'Neon Glow Pen', value: 'neon', cost: 200 },
  { id: 'style_rainbow', type: 'style', name: 'Rainbow Pen', value: 'rainbow', cost: 300 },
];

const STREAK_TITLES = [
  { days: 1, title: 'Starter', icon: Star, color: '#f59e0b', bg: '#fffbeb', border: '#fbbf24' },
  { days: 5, title: 'Learner', icon: Award, color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd' },
  { days: 10, title: 'Explorer', icon: Compass, color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7' },
  { days: 20, title: 'Scholar', icon: BookOpen, color: '#8b5cf6', bg: '#f5f3ff', border: '#c4b5fd' },
  { days: 30, title: 'Ranger', icon: Zap, color: '#06b6d4', bg: '#ecfeff', border: '#67e8f9' },
  { days: 40, title: 'Knight', icon: Shield, color: '#6366f1', bg: '#eef2ff', border: '#a5b4fc' },
  { days: 50, title: 'Champion', icon: Trophy, color: '#ec4899', bg: '#fdf2f8', border: '#f9a8d4' },
  { days: 60, title: 'Master', icon: Crown, color: '#eab308', bg: '#fefce8', border: '#fde047' },
  { days: 75, title: 'Grandmaster', icon: Medal, color: '#f43f5e', bg: '#fff1f2', border: '#fda4af' },
  { days: 100, title: 'Legend', icon: Flame, color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' },
];

function StoreModal({ user, coins, purchasedColors, purchasedGifts, onBuy, onBuyGift, onClaim, onClose }) {
  const history = getUserHistory(user.username);
  const streak = calculateStreak(history);
  
  const hasBronze = streak >= 1;
  const hasSilver = streak >= 3;
  const hasGold = streak >= 5;

  return (
    <div className="portal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="store-box" onClick={e => e.stopPropagation()}>
        <div className="word-editor-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{margin:0, display:'flex', alignItems:'center', gap:'10px'}}><Trophy color="#eab308"/> Rewards & Trophies</h2>
          <button onClick={onClose} style={{background:'none', border:'none', fontSize:'1.5rem', cursor:'pointer'}}>&times;</button>
        </div>

        {/* Top Header: Streak & Coins */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fefce8', padding: '1rem', borderRadius: '10px', border: '2px solid #fef08a' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#854d0e' }}>Current Streak: {streak} 🔥</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ca8a04', display: 'flex', alignItems: 'center', gap: '5px' }}><Coins size={20}/> {coins} Coins</span>
        </div>

        {/* Streak Titles */}
        <h3 style={{ margin: '2rem 0 1rem 0', display: 'flex', alignItems: 'center', gap: '10px' }}><Medal color="#64748b"/> Streak Titles</h3>
        <div style={{ display: 'flex', overflowX: 'auto', gap: '1rem', paddingBottom: '1rem', msOverflowStyle: 'none', scrollbarWidth: 'none' }} className="hide-scrollbar">
          {STREAK_TITLES.map((title, index) => {
            const hasTitle = streak >= title.days;
            const TitleIcon = title.icon;
            const isClickable = hasTitle && title.days >= 5;
            
            return (
              <div 
                key={title.days} 
                onClick={isClickable ? onClaim : undefined}
                className={isClickable ? 'hover-scale' : ''}
                style={{ 
                  minWidth: '120px', 
                  padding: '1rem', 
                  background: hasTitle ? title.bg : '#f8fafc', 
                  border: `2px solid ${hasTitle ? title.border : '#e2e8f0'}`, 
                  borderRadius: '10px', 
                  textAlign: 'center', 
                  opacity: hasTitle ? 1 : 0.5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: isClickable ? 'pointer' : 'default',
                  transition: 'transform 0.2s'
                }}
              >
                <TitleIcon size={40} color={hasTitle ? title.color : '#94a3b8'} style={{ marginBottom: '0.5rem' }}/>
                <h4 style={{ margin: '0 0 0.25rem 0', color: hasTitle ? title.color : '#94a3b8', fontSize: '1rem' }}>{title.title}</h4>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>{title.days} {title.days === 1 ? 'Day' : 'Days'}</span>
                {isClickable && (
                  <div style={{ marginTop: '0.5rem', background: title.color, color: 'white', padding: '0.25rem', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    Claim Cert!
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Virtual Gifts */}
        <h3 style={{ margin: '2rem 0 1rem 0', display: 'flex', alignItems: 'center', gap: '10px' }}><Gift color="#ec4899"/> Virtual Toys</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          {GIFTS.map(gift => {
            const isPurchased = purchasedGifts.includes(gift.id);
            const canAfford = coins >= gift.price;
            const Icon = gift.icon;

            return (
              <div key={gift.id} style={{ padding: '1rem', background: isPurchased ? '#f0fdf4' : 'transparent', border: `2px solid ${isPurchased ? '#22c55e' : '#e2e8f0'}`, borderRadius: '10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Icon size={48} color={isPurchased ? gift.color : '#94a3b8'} style={{ marginBottom: '0.5rem' }}/>
                <h4 style={{ margin: '0', color: isPurchased ? gift.color : '#64748b', fontSize: '1rem' }}>{gift.name}</h4>
                {isPurchased ? (
                  <span style={{ marginTop: 'auto', paddingTop: '0.5rem', color: '#22c55e', fontWeight: 'bold' }}>Owned!</span>
                ) : (
                  <button 
                    onClick={() => onBuyGift(gift)}
                    disabled={!canAfford}
                    style={{ marginTop: 'auto', background: canAfford ? '#ec4899' : '#cbd5e1', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold', cursor: canAfford ? 'pointer' : 'not-allowed', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}
                  >
                    <Coins size={16}/> {gift.price}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Marker Styles */}
        <h3 style={{ margin: '2rem 0 1rem 0', display: 'flex', alignItems: 'center', gap: '10px' }}><Pencil color="#3b82f6"/> Magic Pens</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {STORE_ITEMS.map(item => {
            const isPurchased = purchasedColors.includes(item.value);
            const canAfford = coins >= item.cost;
            return (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: isPurchased ? '#f0fdf4' : 'transparent', border: `2px solid ${isPurchased ? '#22c55e' : '#e2e8f0'}`, borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {item.type === 'color' ? (
                    <div style={{ width: '30px', height: '30px', background: item.value, borderRadius: '50%' }}></div>
                  ) : item.value === 'rainbow' ? (
                    <div style={{ width: '30px', height: '30px', background: 'linear-gradient(90deg, #ef4444, #eab308, #22c55e, #3b82f6, #a855f7)', borderRadius: '50%' }}></div>
                  ) : item.value === 'neon' ? (
                    <div style={{ width: '30px', height: '30px', background: '#1e293b', border: '2px solid #0ea5e9', borderRadius: '50%', boxShadow: '0 0 5px #0ea5e9' }}></div>
                  ) : (
                    <div style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', borderRadius: '50%' }}>
                       <Pencil size={16} />
                    </div>
                  )}
                  <span style={{ fontWeight: 'bold', fontFamily: "'Fredoka One', cursive" }}>{item.name}</span>
                </div>
                {isPurchased ? (
                  <span style={{ color: '#22c55e', fontWeight: 'bold' }}>Owned</span>
                ) : (
                  <button 
                    disabled={!canAfford}
                    onClick={() => onBuy(item)}
                    style={{ 
                      background: canAfford ? '#3b82f6' : '#e2e8f0', 
                      color: canAfford ? 'white' : '#94a3b8',
                      border: 'none', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold', cursor: canAfford ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '5px'
                    }}>
                    <Coins size={16}/> {item.cost}
                  </button>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

function CertificateModal({ user, onClose }) {
  return (
    <div className="portal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="certificate-box" onClick={e => e.stopPropagation()}>
        <div style={{ border: '10px solid #eab308', padding: '2rem', borderRadius: '10px', textAlign: 'center', background: 'transparent' }}>
          <Award size={64} color="#eab308" />
          <h1 style={{ fontFamily: "'Fredoka One', cursive", color: '#334155', fontSize: '3rem', margin: '1rem 0' }}>Certificate of Achievement</h1>
          <p style={{ fontSize: '1.5rem', color: '#64748b' }}>This certificate is proudly presented to</p>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', margin: '2rem 0' }}>
            <span style={{ fontSize: '4rem' }}>{user.avatar}</span>
            <h2 style={{ fontSize: '3.5rem', margin: 0, color: '#0ea5e9', borderBottom: '3px solid #0ea5e9' }}>{user.name}</h2>
          </div>
          <p style={{ fontSize: '1.5rem', color: '#64748b', fontStyle: 'italic' }}>for outstanding dedication and progress in tracing and writing!</p>
          
          <div className="no-print" style={{ marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="button button-success" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 2rem', fontSize: '1.2rem', fontWeight: 'bold' }}>
              <Printer size={24}/> Print Certificate
            </button>
            <button className="button button-danger" onClick={onClose} style={{ padding: '1rem 2rem', fontSize: '1.2rem', fontWeight: 'bold' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeacherDashboard({ user, onClose }) {
  const history = getUserHistory(user.username);
  const totalAttempts = history.length;
  const avgScore = totalAttempts > 0 
    ? Math.round(history.reduce((sum, item) => sum + item.score, 0) / totalAttempts) 
    : 0;
  const streak = calculateStreak(history);

  return (
    <div className="portal-overlay" onClick={onClose}>
      <div className="word-editor-box" onClick={e => e.stopPropagation()} style={{ width: '600px', maxWidth: '90vw' }}>
        <div className="word-editor-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{margin:0}}>Teacher Dashboard</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={() => window.print()}
              style={{ background: '#0ea5e9', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Print Worksheet
            </button>
            <button onClick={onClose} style={{background:'none', border:'none', fontSize:'1.5rem', cursor:'pointer'}}>&times;</button>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ flex: 1, background: '#f8fafc', padding: '1rem', borderRadius: '10px', textAlign: 'center' }}>
            <h3 style={{ margin: 0, color: '#64748b' }}>Total Attempts</h3>
            <p style={{ fontSize: '2rem', margin: '0.5rem 0 0 0', fontWeight: 'bold', color: '#0ea5e9' }}>{totalAttempts}</p>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', padding: '1rem', borderRadius: '10px', textAlign: 'center' }}>
            <h3 style={{ margin: 0, color: '#64748b' }}>Average Score</h3>
            <p style={{ fontSize: '2rem', margin: '0.5rem 0 0 0', fontWeight: 'bold', color: '#22c55e' }}>{avgScore}</p>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', padding: '1rem', borderRadius: '10px', textAlign: 'center' }}>
            <h3 style={{ margin: 0, color: '#64748b' }}>Current Streak</h3>
            <p style={{ fontSize: '2rem', margin: '0.5rem 0 0 0', fontWeight: 'bold', color: '#ef4444' }}>{streak} <span style={{fontSize:'1.2rem'}}>Days</span></p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ color: '#334155' }}>Recent Activity</h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              {history.slice().reverse().map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderBottom: idx < history.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#334155' }}>{item.mode.toUpperCase()}: {item.target || item.mission || 'Drawing'}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{new Date(item.date).toLocaleString()}</div>
                  </div>
                  <div style={{ fontWeight: 'bold', color: item.score >= 80 ? '#22c55e' : '#eab308', display: 'flex', alignItems: 'center' }}>
                    {item.score}/100
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No activity yet!</div>
              )}
            </div>
          </div>
          
          <div style={{ flex: 1 }}>
            <h3 style={{ color: '#334155' }}>Progress Chart</h3>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', height: '300px', display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
              {history.length < 2 ? (
                <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', alignSelf: 'center' }}>Need at least 2 attempts to show progress graph.</div>
              ) : (
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible', padding: '10px 0' }}>
                  <polyline
                    fill="none"
                    stroke="#ec4899"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={history.map((item, i) => {
                      const x = (i / (history.length - 1)) * 100;
                      const y = 100 - item.score; // Invert Y because SVG 0 is at the top
                      return `${x},${y}`;
                    }).join(' ')}
                  />
                  {history.map((item, i) => {
                    const x = (i / (history.length - 1)) * 100;
                    const y = 100 - item.score;
                    return (
                      <circle key={i} cx={x} cy={y} r="3" fill="#ec4899" />
                    );
                  })}
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
const ALPHABET_LOWER = "abcdefghijklmnopqrstuvwxyz".split('');
const NUMBERS = "0123456789+-=".split('');

const TracingPet = ({ state }) => {
  let emoji = '🐕';
  let face = '👀';
  let animation = '';
  let text = "I'm watching!";
  
  if (state === 'good') {
    emoji = '🐕';
    face = '✨';
    animation = 'bounce';
    text = "Great tracing!";
  } else if (state === 'bad') {
    emoji = '🐕';
    face = '💦';
    animation = 'shake';
    text = "Stay on track!";
  } else if (state === 'celebrating') {
    emoji = '🐩';
    face = '🎉';
    animation = 'dance';
    text = "You did it!!";
  }

  return (
    <div className={`tracing-pet ${animation}`}>
      <div className="pet-bubble">{text}</div>
      <div className="pet-body">
        <span className="pet-emoji">{emoji}</span>
        <span className="pet-face">{face}</span>
      </div>
    </div>
  );
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showLanding, setShowLanding] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [fadeClass, setFadeClass] = useState('fade-in');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [drawingToolsMinimized, setDrawingToolsMinimized] = useState(false);
  const [showStudentPortal, setShowStudentPortal] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [isLowercase, setIsLowercase] = useState(false);
  const [language, setLanguage] = useState('en'); // 'en', 'es', 'fr', 'zh', 'ja', 'ko'
  const [showLangMenu, setShowLangMenu] = useState(false);

  const [telemetryData, setTelemetryData] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [currentMission, setCurrentMission] = useState('Draw a big letter "A"!');
  const [isMuted, setIsMuted] = useState(getMuted());
  const drawingCanvasRef = useRef(null);

  const [penColor, setPenColor] = useState('#0ea5e9'); 
  const [penColor2, setPenColor2] = useState('#f97316');
  const [activeColorIndex, setActiveColorIndex] = useState(1);
  const [penWidth, setPenWidth] = useState(12);
  const [penStyle, setPenStyle] = useState('marker'); 
  const [isEraser, setIsEraser] = useState(false);
  const [isGuiding, setIsGuiding] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  // Minimization States
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [shapesMinimized, setShapesMinimized] = useState(false);
  const [toolbarMinimized, setToolbarMinimized] = useState(false);
  
  // Draggable Node Refs
  const sidebarRef = useRef(null);
  const shapesRef = useRef(null);
  const toolbarRef = useRef(null);

  const buttonThemes = [
    { bg: '#fefce8', color: '#eab308', activeBg: '#eab308' }, // Yellow
    { bg: '#fdf2f8', color: '#ec4899', activeBg: '#ec4899' }, // Pink
    { bg: '#eff6ff', color: '#3b82f6', activeBg: '#3b82f6' }, // Blue
    { bg: '#f0fdf4', color: '#22c55e', activeBg: '#22c55e' }, // Green
    { bg: '#fef2f2', color: '#ef4444', activeBg: '#ef4444' }, // Red
    { bg: '#faf5ff', color: '#a855f7', activeBg: '#a855f7' }, // Purple
    { bg: '#fff7ed', color: '#f97316', activeBg: '#f97316' }, // Orange
    { bg: '#ecfeff', color: '#06b6d4', activeBg: '#06b6d4' }  // Cyan
  ];

  const getButtonTheme = (index, isActive) => {
    const theme = buttonThemes[index % buttonThemes.length];
    if (isActive) {
      return { background: theme.activeBg, color: 'white' };
    }
    return { background: theme.bg, color: theme.color };
  };
  
  // Pen Menu State
  const [showPenMenu, setShowPenMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  
  const [therapyMode, setTherapyMode] = useState('letters'); // 'letters', 'words', 'sentences', 'tracing', 'numbers'
  const [selectedShapeId, setSelectedShapeId] = useState('car');
  const [selectedLetter, setSelectedLetter] = useState('A');
  const [selectedNumber, setSelectedNumber] = useState('0');
  const [practiceWords, setPracticeWords] = useState(getPracticeWords('en'));
  const [selectedWord, setSelectedWord] = useState(practiceWords[0] || 'Cat');
  const [showWordEditor, setShowWordEditor] = useState(false);
  const [practiceSentences, setPracticeSentences] = useState(getPracticeSentences('en'));
  const [selectedSentence, setSelectedSentence] = useState(practiceSentences[0] || 'I love learning to write!');
  const [showSentenceEditor, setShowSentenceEditor] = useState(false);

  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => setShowSplash(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  const transitionTo = (callback) => {
    setFadeClass('fade-out');
    setTimeout(() => {
      callback();
      setFadeClass('fade-in');
    }, 300);
  };

  useEffect(() => {
    const newWords = getPracticeWords(language);
    setPracticeWords(newWords);
    setSelectedWord(newWords[0] || 'Cat');
    
    const newSentences = getPracticeSentences(language);
    setPracticeSentences(newSentences);
    setSelectedSentence(newSentences[0] || 'I love learning to write!');
  }, [language]);

  // Pinch-to-zoom effect
  useEffect(() => {
    let initialDistance = null;

    const handleTouchMove = (e) => {
      if (e.touches.length === 2) {
        // Prevent default browser zoom
        if (e.cancelable) e.preventDefault();
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
        const cx = (touch1.clientX + touch2.clientX) / 2;
        const cy = (touch1.clientY + touch2.clientY) / 2;
        
        if (initialDistance === null) {
          initialDistance = dist;
        } else {
          const delta = dist - initialDistance;
          if (Math.abs(delta) > 5) { 
            const zoomDelta = delta > 0 ? 0.05 : -0.05;
            
            setZoom(oldZoom => {
              const newZoom = Math.min(Math.max(oldZoom + zoomDelta, 0.5), 3.0);
              if (newZoom !== oldZoom) {
                const container = document.querySelector('.canvas-container');
                if (container) {
                  // Point on unscaled canvas under the pinch center
                  const px = (container.scrollLeft + cx) / oldZoom;
                  const py = (container.scrollTop + cy) / oldZoom;
                  
                  // Instantly align the point to the same screen position
                  requestAnimationFrame(() => {
                    container.scrollLeft = px * newZoom - cx;
                    container.scrollTop = py * newZoom - cy;
                  });
                }
              }
              return newZoom;
            });
            initialDistance = dist; 
          }
        }
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length < 2) {
        initialDistance = null;
      }
    };

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        if (e.cancelable) e.preventDefault();
        const zoomDelta = e.deltaY > 0 ? -0.05 : 0.05;
        
        setZoom(oldZoom => {
          const newZoom = Math.min(Math.max(oldZoom + zoomDelta, 0.5), 3.0);
          if (newZoom !== oldZoom) {
            const container = document.querySelector('.canvas-container');
            if (container) {
              // Point on unscaled canvas under the mouse pointer
              const px = (container.scrollLeft + e.clientX) / oldZoom;
              const py = (container.scrollTop + e.clientY) / oldZoom;
              
              requestAnimationFrame(() => {
                container.scrollLeft = px * newZoom - e.clientX;
                container.scrollTop = py * newZoom - e.clientY;
              });
            }
          }
          return newZoom;
        });
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);
  const [selectedSpellingWord, setSelectedSpellingWord] = useState('CAT');
  const [selectedMath, setSelectedMath] = useState('1 + 1 = 2');
  const [selectedGameShape, setSelectedGameShape] = useState('Square');
  const [dyslexiaTheme, setDyslexiaTheme] = useState(false);
  const [petState, setPetState] = useState('idle');
  
  // Gamification state
  const [coins, setCoins] = useState(0);
  const [purchasedColors, setPurchasedColors] = useState(['#0ea5e9', '#f97316']);
  const [purchasedGifts, setPurchasedGifts] = useState([]);
  const [showStore, setShowStore] = useState(false);
  const [justEarnedCoins, setJustEarnedCoins] = useState(0);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showLexiAnalysis, setShowLexiAnalysis] = useState(false);
  const [showDetailedModal, setShowDetailedModal] = useState(false);
  const [isIslandHovered, setIsIslandHovered] = useState(false);

  const expectedStrokesData = useMemo(() => {
    let text = '';
    let scale = 700;
    if (therapyMode === 'letters') { text = selectedLetter; scale = 700; }
    if (therapyMode === 'words') { text = selectedWord; scale = 500; }
    if (therapyMode === 'sentences') { text = selectedSentence; scale = 250; }
    if (therapyMode === 'numbers') { text = selectedNumber; scale = 700; }
    if (therapyMode === 'math') { text = selectedMath; scale = 500; }
    if (therapyMode === 'games') { text = selectedGameShape; scale = 700; }
    if (therapyMode === 'spelling') { return []; }
    if (!text) return [];
    return generateTracingStrokes(text, 1500, 1500, scale);
  }, [therapyMode, selectedLetter, selectedWord, selectedSentence, selectedNumber, selectedMath, selectedGameShape]);

  // Auto-tracing engine for text elements
  useEffect(() => {
    if (isGuiding && therapyMode === 'tracing') {
      // Auto-stop tracing mode after 15 seconds to allow the user to draw
      const timer = setTimeout(() => setIsGuiding(false), 15000);
      return () => clearTimeout(timer);
    }

    if (isGuiding && therapyMode !== 'tracing') {
      const overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = 3000;
      overlayCanvas.height = 3000;
      overlayCanvas.style.position = 'absolute';
      overlayCanvas.style.top = '0';
      overlayCanvas.style.left = '0';
      overlayCanvas.style.pointerEvents = 'none';
      overlayCanvas.style.zIndex = '10';
      
      const container = document.querySelector('.zoom-wrapper');
      if (container) container.appendChild(overlayCanvas);
      
      const ctx = overlayCanvas.getContext('2d');
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      let text = '';
      let scale = 700;
      
      if (therapyMode === 'letters') { text = selectedLetter; scale = 700; }
      if (therapyMode === 'words') { text = selectedWord; scale = 500; }
      if (therapyMode === 'sentences') { text = selectedSentence; scale = 250; }
      if (therapyMode === 'numbers') { text = selectedNumber; scale = 700; }
      if (therapyMode === 'math') { text = selectedMath; scale = 500; }
      if (therapyMode === 'games') { text = selectedGameShape; scale = 700; }
      
      if (!text) return;

      const strokes = generateTracingStrokes(text, 1500, 1500, scale);
      
      strokes.forEach(stroke => {
        if (stroke.points.length === 0) return;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
        }
        ctx.lineWidth = 40; 
        ctx.strokeStyle = '#e2e8f0'; 
        ctx.stroke();
      });
      
      let animationId;
      let currentStrokeIndex = 0;
      let currentPointIndex = 0;

      const animate = () => {
        if (currentStrokeIndex >= strokes.length) {
          setTimeout(() => setIsGuiding(false), 1500);
          return;
        }

        const stroke = strokes[currentStrokeIndex];
        const points = stroke.points;

        if (currentPointIndex === 0) {
          ctx.beginPath();
          ctx.moveTo(points[0][0], points[0][1]);
        } else if (currentPointIndex < points.length) {
          ctx.lineTo(points[currentPointIndex][0], points[currentPointIndex][1]);
          ctx.lineWidth = 15;
          ctx.strokeStyle = '#ec4899';
          ctx.stroke();
        }

        currentPointIndex++;

        if (currentPointIndex < points.length) {
          ctx.lineTo(points[currentPointIndex][0], points[currentPointIndex][1]);
          currentPointIndex++;
        }
        if (currentPointIndex < points.length) {
          ctx.lineTo(points[currentPointIndex][0], points[currentPointIndex][1]);
          currentPointIndex++;
        }

        ctx.stroke();

        if (currentPointIndex >= points.length) {
          currentStrokeIndex++;
          currentPointIndex = 0;
          
          if (currentStrokeIndex < strokes.length) {
            setTimeout(() => {
               animationId = requestAnimationFrame(animate);
            }, 300);
            return;
          }
        }

        animationId = requestAnimationFrame(animate);
      };
      
      animate();
      
      return () => {
        cancelAnimationFrame(animationId);
        if (overlayCanvas.parentNode) overlayCanvas.parentNode.removeChild(overlayCanvas);
      };
    }
  }, [isGuiding, therapyMode, selectedLetter, selectedWord, selectedSentence, selectedNumber, selectedMath, selectedGameShape]);

  const centerCanvas = useCallback(() => {
    setZoom(currentZoom => {
      const container = document.querySelector('.canvas-container');
      if (container) {
        container.scrollTo({
          left: (3000 * currentZoom - window.innerWidth) / 2,
          top: (3000 * currentZoom - window.innerHeight) / 2,
          behavior: 'instant'
        });
      }
      return currentZoom;
    });
  }, []);

  useEffect(() => {
    centerCanvas();
  }, [therapyMode, currentUser, selectedLetter, selectedWord, selectedSentence, selectedNumber, selectedMath, selectedShapeId, centerCanvas]);

  useEffect(() => {
    window.addEventListener('resize', centerCanvas);
    return () => window.removeEventListener('resize', centerCanvas);
  }, [centerCanvas]);

  const hasGreetedRef = useRef(false);
  useEffect(() => {
    if (currentUser) {
      if (!hasGreetedRef.current) {
        hasGreetedRef.current = true;
        return;
      }
      speakText(currentMission);
    } else {
      hasGreetedRef.current = false;
    }
  }, [currentMission, currentUser]);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setMuted(newMuted);
  };

  const handleModeChange = (mode) => {
    setTherapyMode(mode);
    drawingCanvasRef.current?.clearCanvas();
    setFeedback(null);
    setTelemetryData(null);
    if (mode === 'letters') {
      setSelectedLetter('A');
      setCurrentMission(`Draw a big letter "A"!`);
    } else if (mode === 'words') {
      const firstWord = practiceWords[0] || 'Cat';
      setCurrentMission(`Write the word "${selectedWord}"!`);
    } else if (mode === 'sentences') {
      setCurrentMission(`Write the sentence!`);
    } else if (mode === 'tracing' || mode === 'games') {
      const activeShape = tracingShapes.find(s => s.id === selectedShapeId);
      setCurrentMission(`Trace the ${activeShape?.name.toLowerCase() || 'shape'} perfectly!`);
    } else if (mode === 'spelling') {
      setCurrentMission(`Listen carefully and spell the word!`);
      speakWord(selectedSpellingWord);
    }
    
    drawingCanvasRef.current?.clearCanvas();
  };

  const speakWord = (word) => {
    if (!isMuted) {
      speakText(`Spell the word... ${word}`);
    }
  };

  const handleSpellingChange = (word) => {
    setSelectedSpellingWord(word);
    setCurrentMission(`Listen carefully and spell the word!`);
    drawingCanvasRef.current?.clearCanvas();
    setFeedback(null);
    setTelemetryData(null);
    setIsGuiding(false);
    speakWord(word);
  };

  const handleShapeChange = (shapeId, shapeName) => {
    setSelectedShapeId(shapeId);
    setCurrentMission(`Trace the ${shapeName.toLowerCase()} perfectly!`);
    drawingCanvasRef.current?.clearCanvas();
    setFeedback(null);
    setTelemetryData(null);
    setIsGuiding(false);
  };

  const handleLetterChange = (letter) => {
    setSelectedLetter(letter);
    const caseText = letter === letter.toLowerCase() ? 'small' : 'big';
    setCurrentMission(`Draw a ${caseText} letter "${letter}"!`);
    drawingCanvasRef.current?.clearCanvas();
    setFeedback(null);
    setTelemetryData(null);
    setIsGuiding(false);
  };

  const handleNumberChange = (num) => {
    setSelectedNumber(num);
    setCurrentMission(`Draw the number "${num}"!`);
    drawingCanvasRef.current?.clearCanvas();
    setFeedback(null);
    setTelemetryData(null);
    setIsGuiding(false);
  };

  const handleWordChange = (word) => {
    setSelectedWord(word);
    setCurrentMission(`Write the word "${word}"!`);
    drawingCanvasRef.current?.clearCanvas();
    setFeedback(null);
    setTelemetryData([]);
    setIsGuiding(false);
  };

  const handleMathChange = (eqn) => {
    setSelectedMath(eqn);
    setCurrentMission(`Solve: "${eqn}"`);
    drawingCanvasRef.current?.clearCanvas();
    setFeedback(null);
    setTelemetryData([]);
    setIsGuiding(false);
  };

  const handleGameShapeChange = (shape) => {
    setSelectedGameShape(shape);
    setCurrentMission(`Draw a ${shape}!`);
    drawingCanvasRef.current?.clearCanvas();
    setFeedback(null);
    setTelemetryData([]);
    setIsGuiding(false);
  };

  const handleSentenceChange = (sentence) => {
    setSelectedSentence(sentence);
    setCurrentMission(`Write the sentence: "${sentence}"`);
    drawingCanvasRef.current?.clearCanvas();
    setFeedback(null);
    setTelemetryData([]);
    setIsGuiding(false);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setFeedback(null);
    let targetItem = null;
    if (therapyMode === 'letters') targetItem = selectedLetter;
    else if (therapyMode === 'words') targetItem = selectedWord;
    else if (therapyMode === 'sentences') targetItem = selectedSentence;
    else if (therapyMode === 'numbers') targetItem = selectedNumber;
    else if (therapyMode === 'tracing') targetItem = tracingShapes.find(s => s.id === selectedShapeId)?.name || 'drawing';
    else if (therapyMode === 'games') targetItem = selectedGameShape;

    const result = await analyzeTelemetry(telemetryData, therapyMode, targetItem, language);
    
    if (result.score && currentUser) {
      if (result.score >= 80) setPetState('celebrating');
      if (result.score >= 80) {
        let earnedCoins = 0;
        if (result.score >= 91) earnedCoins = 15;
        else if (result.score >= 86) earnedCoins = 10;
        else if (result.score >= 80) earnedCoins = 5;

        addCoins(currentUser.username, earnedCoins);
        setCoins(prev => prev + earnedCoins);
        setJustEarnedCoins(earnedCoins);
        setTimeout(() => setJustEarnedCoins(0), 3000);
      }

      let targetItem = null;
      if (therapyMode === 'letters') targetItem = selectedLetter;
      if (therapyMode === 'spelling') targetItem = selectedSpellingWord;
      if (therapyMode === 'numbers') targetItem = selectedNumber;
      if (therapyMode === 'sentences') targetItem = selectedSentence;

      saveUserScore(currentUser.username, {
        score: result.score,
        mode: therapyMode,
        mission: currentMission,
        targetItem: targetItem,
        factors: result.factors
      });
      if (result.score >= 70) {
        playVictorySound();
      }
    }

    setFeedback(result);
    setAnalyzing(false);
  };

  const handleNextMission = () => {
    if (feedback?.nextMission || feedback?.exerciseRecommendation) {
      setCurrentMission(feedback.nextMission || feedback.exerciseRecommendation);
    } else {
      handleModeChange(therapyMode);
    }
    setFeedback(null);
    setTelemetryData([]);
    if (drawingCanvasRef.current) {
      drawingCanvasRef.current.clearCanvas();
    }
  };

  if (showSplash) {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <img src={lexiAvatarUrl} alt="Lexi" className="splash-avatar" />
          <h1 className="splash-logo">Le<span className="xi-text">xi</span></h1>
          <p className="splash-tagline">Your AI Writing Coach</p>
          <div className="splash-bar-container">
            <div className="splash-bar"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    if (showLanding) {
      return (
        <div className={`page-transition ${fadeClass}`}>
          <LandingPage 
            onGetStarted={() => transitionTo(() => setShowLanding(false))} 
            onTryDemo={() => {
              transitionTo(() => {
                // Auto-login as Alex for demo
                const demoUser = DUMMY_USERS[0];
                setCurrentUser(demoUser);
                setTherapyMode('letters');
                setCoins(getUserCoins(demoUser.username));
                setPurchasedColors(getPurchasedColors(demoUser.username));
                setPurchasedGifts(getPurchasedGifts(demoUser.username));
                setShowLanding(false);
                
                setTimeout(() => {
                  speakText(`Welcome back, ${demoUser.name || demoUser.username}! I am Lexi. Let's start practicing!`);
                }, 500);

                // Check if needs onboarding
                if (!localStorage.getItem('lexi_onboarded')) {
                  setShowOnboarding(true);
                }
              });
            }}
          />
        </div>
      );
    }
    return (
      <div className={`page-transition ${fadeClass}`}>
        <LoginScreen onLogin={(user) => {
          transitionTo(() => {
            setCurrentUser(user);
            setTherapyMode('letters');
            setCoins(getUserCoins(user.username));
            setPurchasedColors(getPurchasedColors(user.username));
            setPurchasedGifts(getPurchasedGifts(user.username));
            
            setTimeout(() => {
              speakText(`Welcome back, ${user.name || user.username}! I am Lexi. Let's start practicing!`);
            }, 500);

            // Check if needs onboarding
            if (!localStorage.getItem('lexi_onboarded')) {
              setShowOnboarding(true);
            }
          });
        }} />
      </div>
    );
  }

  const handleBuyGift = (gift) => {
    if (coins >= gift.price && !purchasedGifts.includes(gift.id)) {
      const newCoins = deductCoins(currentUser.username, gift.price);
      setCoins(newCoins);
      const newGifts = purchaseGift(currentUser.username, gift.id);
      setPurchasedGifts(newGifts);
      playVictorySound();
    }
  };

  const ActiveShapeIcon = tracingShapes.find(s => s.id === selectedShapeId)?.icon || CarFront;

  const generateReport = () => {
    window.print();
  };

  // Calculate historical average for the Teacher Report
  const userHistory = getUserHistory(currentUser.username);
  const averageScore = userHistory.length > 0 
    ? Math.round(userHistory.reduce((acc, curr) => acc + curr.score, 0) / userHistory.length) 
    : 'No history yet';

  const strokes = telemetryData?.strokes || [];
  const points = strokes.reduce((acc, curr) => acc + curr.length, 0);
  const firstPoint = strokes[0]?.[0];
  const lastStroke = strokes[strokes.length - 1];
  const lastPoint = lastStroke?.[lastStroke.length - 1];
  const duration = points > 0 && firstPoint && lastPoint ? (lastPoint.time - firstPoint.time) / 1000 : 0;

  return (
    <div className={`app-container bg-mode-${therapyMode} page-transition ${fadeClass}`} style={{ filter: dyslexiaTheme ? 'contrast(1.2)' : 'none' }}>
      <div className="print-only">
        {currentUser && <PrintableWorksheet history={getUserHistory(currentUser.username)} user={currentUser} />}
      </div>

      {feedback && feedback.score >= 80 && (
        <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={800} />
      )}
      
      <div className={`canvas-container bg-mode-${therapyMode} ${dyslexiaTheme ? 'theme-dyslexia' : ''}`}>
        <div className="zoom-wrapper" style={{ transform: `scale(${zoom})` }}>
          
          {therapyMode === 'tracing' && (
            <>
              <ActiveShapeIcon 
                className="tracing-template" 
                size={1200} 
                strokeWidth={0.5} 
                color="#94a3b8"
                style={{
                  opacity: 0.15,
                  zIndex: 0
                }}
              />
              {isGuiding && (
                <ActiveShapeIcon 
                  className="tracing-template animate-svg-trace" 
                  size={1200} 
                  strokeWidth={0.5} 
                  color="#ec4899"
                  style={{
                    opacity: 0.8,
                    zIndex: 10
                  }}
                />
              )}
            </>
          )}

          {therapyMode === 'games' && (() => {
             const style = {
               opacity: isGuiding ? 0.8 : 0.15,
               zIndex: isGuiding ? 10 : 0,
               width: '700px',
               height: '700px',
               transform: selectedGameShape === 'Oval' ? 'translate(-50%, -50%) scaleX(1.5)' : 'translate(-50%, -50%)'
             };
             const props = { fill: 'none', stroke: '#94a3b8', strokeWidth: '3.5', strokeLinejoin: 'miter', strokeLinecap: 'butt' };
             
             let shapeInner;
             switch(selectedGameShape) {
               case 'Square':
                 shapeInner = <rect x="12.5" y="12.5" width="75" height="75" rx="8.3" {...props} />;
                 break;
               case 'Triangle':
                 shapeInner = <polygon points="50,16.7 83.3,87.5 16.7,87.5" {...props} />;
                 break;
               case 'Circle':
               case 'Oval':
                 shapeInner = <circle cx="50" cy="50" r="41.7" {...props} />;
                 break;
               case 'Star':
                 shapeInner = <polygon points="50,10 60,35 90,35 65,55 75,90 50,70 25,90 35,55 10,35 40,35" {...props} />;
                 break;
               case 'Rectangle':
                 shapeInner = <rect x="8.3" y="25" width="83.4" height="50" rx="8.3" {...props} />;
                 break;
               case 'Heart':
                 // Matching VectorEngine heart exactly:
                 shapeInner = <path d="M 50 33.3 A 20.8 20.8 0 0 0 8.3 33.3 L 20.8 58.3 L 50 87.5 L 79.2 58.3 L 91.7 33.3 A 20.8 20.8 0 0 0 50 33.3 Z" {...props} />;
                 break;
               case 'Diamond':
                 shapeInner = <polygon points="50,10 90,50 50,90 10,50" {...props} />;
                 break;
               case 'Hexagon':
                 shapeInner = <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" {...props} />;
                 break;
               default:
                 shapeInner = <rect x="12.5" y="12.5" width="75" height="75" rx="8.3" {...props} />;
             }

             return (
               <svg 
                 className="tracing-template" 
                 viewBox="0 0 100 100" 
                 style={style}
               >
                 {shapeInner}
               </svg>
             );
          })()}

          {therapyMode === 'letters' && (
            <div className="letter-template" style={{ opacity: isGuiding ? 0 : 0.15 }}>
              {selectedLetter}
            </div>
          )}

          {therapyMode === 'words' && (
            <div className="word-template" style={{ opacity: isGuiding ? 0 : 0.15 }}>
              {selectedWord}
            </div>
          )}

          {therapyMode === 'sentences' && (
            <div className="sentence-template" style={{ opacity: isGuiding ? 0 : 0.15 }}>
              {selectedSentence}
            </div>
          )}

          {therapyMode === 'numbers' && (
            <div className="number-template" style={{ opacity: isGuiding ? 0 : 0.15 }}>
              {selectedNumber}
            </div>
          )}

          {therapyMode === 'math' && (
             <div className="math-template" style={{ opacity: isGuiding ? 0 : 0.15 }}>
              {selectedMath}
             </div>
          )}

          <DrawingCanvas 
            ref={drawingCanvasRef} 
            onDrawEnd={(data) => {
              setTelemetryData(data);
              setTimeout(() => {
                setPetState(prev => prev === 'celebrating' ? 'celebrating' : 'idle');
              }, 1500);
            }}
            onStrokeQuality={(q) => setPetState(q)}
            color={activeColorIndex === 1 ? penColor : penColor2} 
            isEraser={isEraser}
            penWidth={penWidth}
            penStyle={penStyle}
            expectedStrokes={expectedStrokesData}
            forgivingHitbox={therapyMode === 'words' || therapyMode === 'sentences'}
          />
        </div>
      </div>

      <div className="floating-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', pointerEvents: 'auto' }}>

          <div 
            className={`lexi-logo-container ${analyzing ? 'pulsing' : ''} ${points > 0 && !feedback && !analyzing ? 'ready' : ''} ${feedback ? 'has-feedback' : ''}`}
            onMouseEnter={() => setIsIslandHovered(true)}
            onMouseLeave={() => setIsIslandHovered(false)}
            onClick={() => {
              if (points > 0 && !feedback && !analyzing) {
                handleAnalyze();
              } else if (feedback) {
                setShowLexiAnalysis(true);
              }
            }}
            style={{ cursor: (points > 0 || feedback) ? 'pointer' : 'default', margin: 0, pointerEvents: 'auto', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            <img src={lexiAvatarUrl} className="lexi-avatar" alt="Lexi" />
            
            {/* Dynamic Content */}
            <div className="dynamic-island-content" style={{ transition: 'all 0.3s ease' }}>
              {analyzing ? (
                <span className="island-text">Thinking...</span>
              ) : feedback ? (
                <span className="island-text island-feedback">
                  Score: {feedback.score}/100! Click to see details!
                </span>
              ) : points > 0 ? (
                <span className="island-text island-ready">
                  Are you done? Let's check!
                </span>
              ) : isIslandHovered ? (
                <button 
                  style={{ background: 'transparent', border: 'none', color: '#f43f5e', fontWeight: 'bold', fontSize: '1.2rem', fontFamily: "'Fredoka One', cursive", cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', outline: 'none' }}
                  onClick={(e) => {
                    e.stopPropagation(); // Don't trigger the island click
                    try { playWhooshSound(); } catch (err) { console.error(err); }
                    setIsGuiding(true);
                  }}
                >
                  <Sparkles size={20} /> Help me draw!
                </button>
              ) : (
                <h1 className="lexi-logo" style={{margin:0}}>Le<span className="xi-text">xi</span></h1>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="audio-toggle" onClick={toggleMute} title={isMuted ? "Unmute Audio" : "Mute Audio"}>
        {isMuted ? <VolumeX size={24} color="#94a3b8" /> : <Volume2 size={24} color="#f43f5e" />}
      </div>

      <div 
        className="audio-toggle" 
        onClick={() => setShowAbout(true)} 
        title="About Lexi"
        style={{ position: 'absolute', top: '1.5rem', left: '5.5rem', right: 'auto', zIndex: 1000 }}
      >
        <Info size={24} color="#0ea5e9" />
      </div>


      <div className="profile-badge">
        <select 
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="profile-badge-btn"
          title="Change Language"
          style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '1rem', fontWeight: 'bold', color: '#64748b', cursor: 'pointer', appearance: 'none', padding: '0 10px' }}
        >
          <option value="en">🇬🇧 EN</option>
          <option value="es">🇪🇸 ES</option>
          <option value="fr">🇫🇷 FR</option>
          <option value="de">🇩🇪 DE</option>
          <option value="it">🇮🇹 IT</option>
        </select>
        <div className="profile-badge-divider"></div>
        <div 
          className="profile-badge-btn" 
          onClick={() => setShowStore(true)} 
          title="Reward Store"
          style={{ color: '#eab308' }}
        >
          <Coins size={20} /> {coins}
        </div>
        <div className="profile-badge-divider"></div>
        <div 
          className="profile-badge-btn" 
          onClick={() => setShowStudentPortal(true)} 
          title="View Student Portal"
        >
          <span style={{fontSize: '1.5rem'}}>{currentUser.avatar}</span>
          {currentUser.name}
        </div>
      </div>

      {showStudentPortal && (
        <StudentPortal 
          user={currentUser} 
          onClose={() => setShowStudentPortal(false)} 
          onLogout={() => {
            setCurrentUser(null);
            setShowStudentPortal(false);
          }} 
        />
      )}

      {showVoiceSettings && (
        <VoiceSettingsModal onClose={() => setShowVoiceSettings(false)} />
      )}

      {/* Main Mode Sidebar */}
      <Draggable nodeRef={sidebarRef} handle=".drag-handle" defaultPosition={{x: 20, y: window.innerHeight/2}}>
        <div ref={sidebarRef} className="draggable-wrapper" style={{ zIndex: 100 }}>
          <div style={{ transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column' }}>
            {sidebarMinimized ? (
            <div className="minimized-btn drag-handle" onClick={() => setSidebarMinimized(false)} title="Click to Expand, Drag to Move">
              <ChevronDown size={24} color="#f43f5e" />
            </div>
          ) : (
            <div className="mode-sidebar">
              <div className="drag-header">
                <div className="drag-handle" title="Drag to Move"><Move size={16}/></div>
                <button onClick={() => setSidebarMinimized(true)} title="Minimize Menu" style={{background:'transparent', border:'none', cursor:'pointer', color:'#94a3b8'}}><ChevronUp size={20}/></button>
              </div>
              <button 
                className={`mode-btn ${therapyMode === 'letters' ? 'active' : ''}`}
                onClick={() => handleModeChange('letters')}
                title="Letter Writing"
              >
                <Type size={28} /> Letters
              </button>
              <button 
                className={`mode-btn ${therapyMode === 'words' ? 'active' : ''}`}
                onClick={() => handleModeChange('words')}
                title="Word Writing"
              >
                <FileText size={28} /> Words
              </button>
              <button 
                className={`mode-btn ${therapyMode === 'sentences' ? 'active' : ''}`}
                onClick={() => handleModeChange('sentences')}
                title="Sentence Writing"
              >
                <Baseline size={28} /> Sentences
              </button>
              <button 
                className={`mode-btn ${therapyMode === 'numbers' ? 'active' : ''}`}
                onClick={() => handleModeChange('numbers')}
                title="Number Writing"
              >
                <Hash size={28} /> Numbers
              </button>
              <button 
                className={`mode-btn ${therapyMode === 'games' ? 'active' : ''}`}
                onClick={() => handleModeChange('games')}
                title="Fun Shapes"
              >
                <Shapes size={28} /> Shapes
              </button>
              <button 
                className={`mode-btn ${therapyMode === 'tracing' ? 'active' : ''}`}
                onClick={() => handleModeChange('tracing')}
                title="Fun Drawing"
              >
                <Paintbrush size={28} /> Drawing
              </button>

            </div>
          )}
          </div>
        </div>
      </Draggable>

      {(therapyMode === 'letters' || therapyMode === 'words' || therapyMode === 'sentences' || therapyMode === 'numbers' || therapyMode === 'math' || therapyMode === 'games' || therapyMode === 'tracing') && (
        <Draggable nodeRef={shapesRef} handle=".drag-handle" defaultPosition={{x: window.innerWidth/2, y: window.innerHeight - 180}}>
          <div ref={shapesRef} className="draggable-wrapper" style={{ zIndex: 10 }}>
            <div style={{ transform: 'translateX(-50%)', display: 'flex' }}>
              {shapesMinimized ? (
                <div className="minimized-btn drag-handle" onClick={() => setShapesMinimized(false)} title="Click to Expand, Drag to Move" style={{border: '2px solid #3b82f6'}}>
                  <ChevronRight size={24} color="#3b82f6" />
                </div>
              ) : (
                <div className="shape-selector">
                <div className="drag-handle" title="Drag to Move" style={{marginRight: '10px'}}><Move size={16}/></div>
                <button onClick={() => setShapesMinimized(true)} title="Minimize Menu" style={{background:'transparent', border:'none', cursor:'pointer', color:'#94a3b8', marginRight: '10px'}}><ChevronLeft size={20}/></button>
                <div style={{ width: '2px', height: '30px', background: '#cbd5e1', marginRight: '10px' }}></div>
      {therapyMode === 'tracing' && (
        <>
          {tracingShapes.map((shape, index) => {
            const Icon = shape.icon;
            const isActive = selectedShapeId === shape.id;
            return (
              <button 
                key={shape.id}
                className={`shape-btn ${isActive ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleShapeChange(shape.id, shape.name)}
                title={`Trace ${shape.name}`}
                style={getButtonTheme(index, isActive)}
              >
                <Icon size={24} />
              </button>
            );
          })}
        </>
      )}
      {therapyMode === 'letters' && (
        <>
          <button
            className="shape-btn"
            style={{ marginRight: '10px', background: '#e0f2fe', color: '#0ea5e9', fontWeight: 'bold' }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
               const newCase = !isLowercase;
               setIsLowercase(newCase);
               handleLetterChange(newCase ? selectedLetter.toLowerCase() : selectedLetter.toUpperCase());
            }}
            title="Toggle Uppercase/Lowercase"
          >
            Aa
          </button>
          {(isLowercase ? ALPHABET_LOWER : ALPHABET).map((letter, index) => {
            const isActive = selectedLetter === letter;
            return (
              <button 
                key={letter}
                className={`shape-btn ${isActive ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleLetterChange(letter)}
                title={`Practice Letter ${letter}`}
                style={{ 
                  fontFamily: dyslexiaTheme ? 'OpenDyslexic' : "'Fredoka One', cursive", 
                  fontSize: '1.2rem',
                  ...getButtonTheme(index, isActive)
                }}
              >
                {letter}
              </button>
            );
          })}
        </>
      )}

      {therapyMode === 'numbers' && (
        <>
          {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num, index) => {
            const isActive = selectedNumber === num;
            return (
              <button 
                key={num}
                className={`shape-btn ${isActive ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleNumberChange(num)}
                title={`Practice Number ${num}`}
                style={{ 
                  fontFamily: dyslexiaTheme ? 'OpenDyslexic' : "'Fredoka One', cursive", 
                  fontSize: '1.2rem',
                  ...getButtonTheme(index, isActive)
                }}
              >
                {num}
              </button>
            );
          })}
        </>
      )}

      {therapyMode === 'words' && (
        <>
          <button 
            className="shape-btn" 
            onClick={() => setShowWordEditor(true)}
            title="Edit Word List"
            style={{ fontFamily: dyslexiaTheme ? 'OpenDyslexic' : "'Fredoka One', cursive", fontSize: '1rem', background: '#e0f2fe' }}
          >
            ⚙️ Edit
          </button>
          <div style={{width: '2px', height: '30px', background: '#cbd5e1', margin: '0 0.5rem'}}></div>
          {practiceWords.map((word, index) => {
            const isActive = selectedWord === word;
            return (
              <button 
                key={word}
                className={`shape-btn ${isActive ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleWordChange(word)}
                title={`Practice Word ${word}`}
                style={{ 
                  fontFamily: dyslexiaTheme ? 'OpenDyslexic' : "'Fredoka One', cursive", 
                  fontSize: '1rem', 
                  ...getButtonTheme(index, isActive)
                }}
              >
                {word}
              </button>
            );
          })}
        </>
      )}

      {therapyMode === 'sentences' && (
        <>
          <button 
            className="shape-btn" 
            onClick={() => setShowSentenceEditor(true)}
            title="Edit Sentence List"
            style={{ fontFamily: dyslexiaTheme ? 'OpenDyslexic' : "'Fredoka One', cursive", fontSize: '1rem', background: '#e0f2fe' }}
          >
            ⚙️ Edit
          </button>
          <div style={{width: '2px', height: '30px', background: '#cbd5e1', margin: '0 0.5rem'}}></div>
          {practiceSentences.map((sentence, index) => {
            const isActive = selectedSentence === sentence;
            return (
              <button 
                key={sentence}
                className={`shape-btn ${isActive ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSentenceChange(sentence)}
                title={`Practice Sentence`}
                style={{ 
                  fontFamily: dyslexiaTheme ? 'OpenDyslexic' : "'Fredoka One', cursive", 
                  fontSize: '1rem', 
                  padding: '0 1rem', 
                  whiteSpace: 'nowrap',
                  ...getButtonTheme(index, isActive)
                }}
              >
                {sentence.length > 20 ? sentence.substring(0, 20) + '...' : sentence}
              </button>
            );
          })}
        </>
      )}

      {therapyMode === 'math' && (
        <>
          {['1 + 1 = 2', '2 + 2 = 4', '3 + 1 = 4', '5 - 1 = 4', '10 - 5 = 5'].map((eqn, index) => {
            const isActive = selectedMath === eqn;
            return (
              <button 
                key={eqn}
                className={`shape-btn ${isActive ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleMathChange(eqn)}
                title={`Practice Equation ${eqn}`}
                style={{ 
                  fontFamily: dyslexiaTheme ? 'OpenDyslexic' : "'Fredoka One', cursive", 
                  fontSize: '1rem', 
                  ...getButtonTheme(index, isActive)
                }}
              >
                {eqn}
              </button>
            );
          })}
        </>
      )}

      {therapyMode === 'games' && (
        <>
          {['Square', 'Triangle', 'Circle', 'Star', 'Rectangle', 'Heart', 'Diamond', 'Oval', 'Hexagon'].map((shape, index) => {
            const isActive = selectedGameShape === shape;
            return (
              <button 
                key={shape}
                className={`shape-btn ${isActive ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleGameShapeChange(shape)}
                title={`Draw a ${shape}`}
                style={{ 
                  fontFamily: dyslexiaTheme ? 'OpenDyslexic' : "'Fredoka One', cursive", 
                  fontSize: '1rem', 
                  padding: '0 1rem',
                  ...getButtonTheme(index, isActive)
                }}
              >
                {shape}
              </button>
            );
          })}
        </>
      )}
              </div>
            )}
            </div>
          </div>
        </Draggable>
      )}

      {/* Floating Bottom Toolbar Overlay */}
      <Draggable nodeRef={toolbarRef} handle=".drag-handle" defaultPosition={{x: window.innerWidth/2, y: window.innerHeight - 100}}>
        <div ref={toolbarRef} className="draggable-wrapper" style={{ zIndex: 100 }}>
          <div style={{ transform: 'translateX(-50%)', display: 'flex' }}>
            {toolbarMinimized ? (
              <div className="minimized-btn drag-handle" onClick={() => setToolbarMinimized(false)} title="Click to Expand, Drag to Move" style={{border: '2px solid #10b981'}}>
                <ChevronRight size={24} color="#10b981" />
              </div>
            ) : (
              <div className="toolbar">
              <div className="drag-handle" title="Drag to Move" style={{ cursor: 'grab' }}><Move size={16} color="#94a3b8" /></div>
              <button onClick={() => setToolbarMinimized(true)} title="Minimize Toolbar" style={{background:'transparent', border:'none', cursor:'pointer', color:'#94a3b8'}}><ChevronLeft size={20}/></button>
              <div style={{ width: '2px', height: '30px', background: '#cbd5e1' }}></div>
              <div className="tool-group" style={{ gap: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <button 
                    className={`pen-toggle ${!isEraser ? 'active' : ''}`}
                    onClick={() => { setIsEraser(false); setShowPenMenu(!showPenMenu); }}
                    title="Select Pen Type"
                    style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {penStyle === 'marker' ? <Pencil size={20} /> : 
                     penStyle === 'fountain' ? <PenTool size={20} /> : 
                     penStyle === 'highlighter' ? <Highlighter size={20} /> : 
                     penStyle === 'brush' ? <Paintbrush size={20} /> : 
                     penStyle === 'spray' ? <CloudRain size={20} /> : 
                     penStyle === 'dotted' ? <MoreHorizontal size={20} /> : 
                     penStyle === 'dashed' ? <Minus size={20} /> : 
                     penStyle === 'neon' ? <Sparkles size={20} /> : 
                     penStyle === 'rainbow' ? <Palette size={20} /> : 
                     <Pencil size={20} />}
                  </button>
                  
                  {showPenMenu && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: '10px',
                      background: 'rgba(255, 255, 255, 0.45)',
                      backdropFilter: 'blur(30px)',
                      borderRadius: '16px',
                      padding: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(255,255,255,0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.8)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      minWidth: '160px',
                      zIndex: 110,
                      maxHeight: '350px',
                      overflowY: 'auto'
                    }}>
                      <button className={`pen-toggle ${penStyle === 'marker' ? 'active' : ''}`} style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }} onClick={() => { setPenStyle('marker'); setIsEraser(false); setShowPenMenu(false); }}>
                        <Pencil size={18} /> Marker
                      </button>
                      <button className={`pen-toggle ${penStyle === 'fountain' ? 'active' : ''}`} style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }} onClick={() => { setPenStyle('fountain'); setIsEraser(false); setShowPenMenu(false); }}>
                        <PenTool size={18} /> Fountain
                      </button>
                      <button className={`pen-toggle ${penStyle === 'highlighter' ? 'active' : ''}`} style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }} onClick={() => { setPenStyle('highlighter'); setIsEraser(false); setShowPenMenu(false); }}>
                        <Highlighter size={18} /> Highlighter
                      </button>
                      <button className={`pen-toggle ${penStyle === 'brush' ? 'active' : ''}`} style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }} onClick={() => { setPenStyle('brush'); setIsEraser(false); setShowPenMenu(false); }}>
                        <Paintbrush size={18} /> Brush
                      </button>
                      <button className={`pen-toggle ${penStyle === 'spray' ? 'active' : ''}`} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', opacity: purchasedColors.includes('spray') ? 1 : 0.5 }} onClick={() => { if (purchasedColors.includes('spray')) { setPenStyle('spray'); setIsEraser(false); setShowPenMenu(false); } else { setShowPenMenu(false); setShowStore(true); } }}>
                        {purchasedColors.includes('spray') ? <CloudRain size={18} /> : <Lock size={18} />} Spray Paint
                      </button>
                      <button className={`pen-toggle ${penStyle === 'dotted' ? 'active' : ''}`} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', opacity: purchasedColors.includes('dotted') ? 1 : 0.5 }} onClick={() => { if (purchasedColors.includes('dotted')) { setPenStyle('dotted'); setIsEraser(false); setShowPenMenu(false); } else { setShowPenMenu(false); setShowStore(true); } }}>
                        {purchasedColors.includes('dotted') ? <MoreHorizontal size={18} /> : <Lock size={18} />} Dotted
                      </button>
                      <button className={`pen-toggle ${penStyle === 'dashed' ? 'active' : ''}`} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', opacity: purchasedColors.includes('dashed') ? 1 : 0.5 }} onClick={() => { if (purchasedColors.includes('dashed')) { setPenStyle('dashed'); setIsEraser(false); setShowPenMenu(false); } else { setShowPenMenu(false); setShowStore(true); } }}>
                        {purchasedColors.includes('dashed') ? <Minus size={18} /> : <Lock size={18} />} Dashed
                      </button>
                    </div>
                  )}
                </div>
                
                <button 
                  className={`eraser-btn ${isEraser ? 'active' : ''}`}
                  onClick={() => setIsEraser(true)}
                  title="Eraser"
                  style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Eraser size={20} />
                </button>
                <div style={{ width: '2px', height: '30px', background: '#cbd5e1', marginLeft: '4px', marginRight: '4px' }}></div>
                <input 
                  type="range" 
                  className="width-slider" 
                  min="4" 
                  max="60" 
                  value={penWidth} 
                  onChange={(e) => setPenWidth(Number(e.target.value))} 
                  title="Pen Thickness"
                  style={{ width: '80px' }}
                />
              </div>

              <div className="tool-group" style={{ gap: '8px' }}>

                <div style={{ position: 'relative', display: 'flex', gap: '4px' }}>
                  {/* Primary Color Button */}
                  <button 
                    onClick={() => { 
                      if (activeColorIndex === 1) setShowColorMenu(!showColorMenu); 
                      else { 
                        setActiveColorIndex(1); 
                        setShowColorMenu(false); 
                        if (penColor === 'neon' || penColor === 'rainbow') setPenStyle(penColor);
                        else if (['neon', 'rainbow'].includes(penStyle)) setPenStyle('marker');
                      }
                      setShowPenMenu(false); setIsEraser(false); 
                    }}
                    title="Primary Ink Color"
                    style={{ 
                      width: '36px', height: '36px', borderRadius: '50%', 
                      background: penColor === 'rainbow' ? 'linear-gradient(90deg, #ef4444, #eab308, #22c55e, #3b82f6, #a855f7)' : (penColor === 'neon' ? '#1e293b' : penColor), 
                      border: activeColorIndex === 1 ? '3px solid #334155' : '2px solid transparent',
                      boxShadow: penColor === 'neon' ? '0 0 5px #0ea5e9' : 'none',
                      cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: penColor === 'neon' ? '#0ea5e9' : 'white',
                      transition: 'all 0.2s',
                      transform: activeColorIndex === 1 ? 'scale(1.1)' : 'scale(0.9)',
                      zIndex: activeColorIndex === 1 ? 2 : 1
                    }}
                  >
                    {penColor === 'rainbow' ? <Palette size={16} /> : (penColor === 'neon' ? <Sparkles size={16} /> : null)}
                  </button>

                  {/* Secondary Color Button */}
                  <button 
                    onClick={() => { 
                      if (activeColorIndex === 2) setShowColorMenu(!showColorMenu); 
                      else { 
                        setActiveColorIndex(2); 
                        setShowColorMenu(false); 
                        if (penColor2 === 'neon' || penColor2 === 'rainbow') setPenStyle(penColor2);
                        else if (['neon', 'rainbow'].includes(penStyle)) setPenStyle('marker');
                      }
                      setShowPenMenu(false); setIsEraser(false); 
                    }}
                    title="Secondary Ink Color"
                    style={{ 
                      width: '36px', height: '36px', borderRadius: '50%', 
                      background: penColor2 === 'rainbow' ? 'linear-gradient(90deg, #ef4444, #eab308, #22c55e, #3b82f6, #a855f7)' : (penColor2 === 'neon' ? '#1e293b' : penColor2), 
                      border: activeColorIndex === 2 ? '3px solid #334155' : '2px solid transparent',
                      boxShadow: penColor2 === 'neon' ? '0 0 5px #0ea5e9' : 'none',
                      cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: penColor2 === 'neon' ? '#0ea5e9' : 'white',
                      transition: 'all 0.2s',
                      transform: activeColorIndex === 2 ? 'scale(1.1)' : 'scale(0.9)',
                      zIndex: activeColorIndex === 2 ? 2 : 1
                    }}
                  >
                    {penColor2 === 'rainbow' ? <Palette size={16} /> : (penColor2 === 'neon' ? <Sparkles size={16} /> : null)}
                  </button>
                  
                  {showColorMenu && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: '10px',
                      background: 'rgba(255, 255, 255, 0.45)',
                      backdropFilter: 'blur(30px)',
                      borderRadius: '16px',
                      padding: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(255,255,255,0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.8)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '8px',
                      minWidth: '200px',
                      zIndex: 110,
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}>
                      {purchasedColors.filter(c => !['spray', 'dotted', 'dashed'].includes(c)).map(color => (
                        <button 
                          key={color}
                          onClick={() => { 
                            if (color === 'neon' || color === 'rainbow') {
                              setPenStyle(color);
                            } else if (['neon', 'rainbow'].includes(penStyle)) {
                              setPenStyle('marker');
                            }
                            if (activeColorIndex === 1) setPenColor(color);
                            else setPenColor2(color);
                            setIsEraser(false); 
                            setShowColorMenu(false); 
                          }}
                          style={{ 
                            width: '36px', height: '36px', borderRadius: '50%', 
                            background: color === 'rainbow' ? 'linear-gradient(90deg, #ef4444, #eab308, #22c55e, #3b82f6, #a855f7)' : (color === 'neon' ? '#1e293b' : color), 
                            border: (activeColorIndex === 1 ? penColor : penColor2) === color && !isEraser ? '3px solid #334155' : (color === 'neon' ? '2px solid #0ea5e9' : '2px solid transparent'),
                            boxShadow: color === 'neon' ? '0 0 5px #0ea5e9' : 'none',
                            cursor: 'pointer', padding: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: color === 'neon' ? '#0ea5e9' : 'white'
                          }}
                          title={color === 'neon' ? 'Neon Glow' : (color === 'rainbow' ? 'Rainbow' : 'Ink Color')}
                        >
                          {color === 'rainbow' && <Palette size={16} />}
                          {color === 'neon' && <Sparkles size={16} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>


              </div>
        <div className="tool-group" style={{border: 'none'}}>
          <button 
            className="clear-btn" 
            onClick={() => {
              drawingCanvasRef.current?.clearCanvas();
              setFeedback(null);
              setTelemetryData(null);
              setShowLexiAnalysis(false);
              setShowDetailedModal(false);
            }} 
            style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
            title="Restart Mission"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>
            )}
          </div>
        </div>
      </Draggable>

      {showLexiAnalysis && feedback && (
        <div className="portal-overlay" onClick={() => setShowLexiAnalysis(false)}>
          <div className="portal-box" style={{ width: '600px', maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div className="portal-header">
              <img src={lexiAvatarUrl} style={{width: 80, height: 80, borderRadius: '50%', border: '3px solid #ec4899', boxShadow: '0 0 15px rgba(236,72,153,0.5)'}} alt="Lexi" />
              <h2 style={{fontSize: '2.5rem', margin: '10px 0'}}>AI Coach Analysis</h2>
            </div>
            
            {feedback.error ? (
              <div style={{ color: '#ef4444', textAlign: 'center', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div><strong>Oops!</strong> {feedback.error}</div>
                {feedback.error.includes('Unauthorized') && (
                  <button className="button" style={{ background: '#ec4899', width: '100%' }} onClick={() => puter.auth.signIn()}>
                    Sign In to Unlock AI
                  </button>
                )}
              </div>
            ) : (
              <>
                <h3 className="score-text" style={{ fontSize: '3rem', textAlign: 'center', margin: '0 0 20px 0' }}>Score: {feedback.score}/100</h3>
                {justEarnedCoins > 0 && (
                  <div className="earned-coins-toast animate-bounce" style={{ color: '#eab308', fontWeight: 'bold', fontSize: '1.5rem', textAlign: 'center', marginBottom: '1rem' }}>
                    <Coins size={24} style={{verticalAlign: 'middle', marginRight: 5}}/> +{justEarnedCoins} Coins!
                  </div>
                )}
                <div className="feedback-box" style={{fontSize: '1.2rem', padding: '20px'}}>
                  <p style={{margin:0}}><strong>Coach Says:</strong> {feedback.kidFeedback || feedback.feedback || feedback.analysis}</p>
                </div>
                
                {feedback.nextMission && (
                  <div className="mission-box" style={{fontSize: '1.2rem', padding: '15px', marginTop: '15px'}}>
                    <p style={{margin:0}}>
                      <Sparkles size={20} style={{marginRight: '8px', color: '#0ea5e9', verticalAlign: 'text-bottom'}}/>
                      <strong>Next Mission:</strong> {feedback.nextMission || feedback.exerciseRecommendation}
                    </p>
                  </div>
                )}

              </>
            )}

            {!feedback.error && feedback.kidTips && (
              <div style={{ marginTop: '15px', padding: '15px', background: '#f1f5f9', borderRadius: '10px', textAlign: 'left' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} color="#eab308" /> Tips to Improve!
                </h4>
                <ul style={{ margin: 0, paddingLeft: '0', listStyleType: 'none', color: '#334155', lineHeight: '1.6' }}>
                  {feedback.kidTips.map((tip, i) => (
                    <li key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <span>{tip.icon}</span> <span>{tip.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!feedback.error && feedback.detailedScores && (
              <button className="button" onClick={() => setShowDetailedModal(true)} style={{background: 'transparent', color: '#94a3b8', border: '1px solid #cbd5e1', width: '100%', marginTop: '15px', padding: '8px', fontSize: '0.9rem'}}>
                Teacher & Parent Dashboard (Clinical Analysis)
              </button>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="button button-success" onClick={() => { handleNextMission(); setShowLexiAnalysis(false); }} style={{flex: 1}}>
                Start Next Mission
              </button>
              <button className="button" onClick={() => { setShowLexiAnalysis(false); drawingCanvasRef.current?.replayStroke(strokes); }} style={{flex: 1, background: '#a855f7'}}>
                Watch Replay
              </button>
            </div>
            
            <button className="portal-close-btn" onClick={() => setShowLexiAnalysis(false)} style={{marginTop: '1rem'}}>
              Close Analysis
            </button>
          </div>
        </div>
      )}
      {showDetailedModal && feedback && feedback.detailedScores && (
        <div className="portal-overlay" onClick={() => setShowDetailedModal(false)} style={{zIndex: 9999}}>
          <div className="portal-box" style={{ width: '800px', maxWidth: '95vw', background: '#f8fafc', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="portal-header" style={{flexDirection: 'column', textAlign: 'center'}}>
              <h2 style={{fontSize: '2rem', margin: '0 0 5px 0', color: '#0f172a'}}>Teacher & Parent Analysis</h2>
              <p style={{margin: 0, color: '#64748b', fontSize: '1rem'}}>Detailed clinical breakdown of the student's drawing telemetry</p>
            </div>
            
            <div style={{ padding: '20px 10px' }}>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px'}}>
                {feedback.detailedScores.map((factor, i) => (
                  <div key={i} style={{ 
                    background: 'white', 
                    padding: '15px', 
                    borderRadius: '10px', 
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ flex: 1, paddingRight: '15px' }}>
                      <h4 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#1e293b' }}>{factor.category}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>{factor.description}</p>
                    </div>
                    <div style={{ 
                      fontSize: '1.2rem', 
                      fontWeight: 'bold', 
                      color: factor.score >= 80 ? '#22c55e' : factor.score >= 50 ? '#eab308' : '#ef4444',
                      background: '#f1f5f9',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      minWidth: '50px',
                      textAlign: 'center'
                    }}>
                      {factor.score}/100
                    </div>
                  </div>
                ))}
              </div>

              {(feedback.clinicalAnalysis) && (
                <div className="teacher-report" style={{ marginTop: '30px', background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  <h4 style={{margin: '0 0 15px 0', fontSize: '1.2rem', color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px'}}>Clinical Markers Detected</h4>
                  <p style={{margin: '0 0 15px 0', color: '#475569', fontSize: '0.95rem'}}><strong>Student:</strong> {currentUser?.name || "Guest"} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Historical Average Score:</strong> {averageScore}</p>
                  <ul style={{fontSize: '0.95rem', paddingLeft: '20px', color: '#334155', margin:0, lineHeight: 1.6}}>
                    {Array.isArray(feedback.clinicalAnalysis) ? (
                      feedback.clinicalAnalysis.map((point, index) => (
                        <li key={index} style={{marginBottom: '8px'}}>{point}</li>
                      ))
                    ) : (
                      <li>{feedback.clinicalAnalysis}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            
            <button className="portal-close-btn" onClick={() => setShowDetailedModal(false)} style={{marginTop: '1rem', background: '#334155'}}>
              Close Detailed Analysis
            </button>
          </div>
        </div>
      )}




      {showStore && (
        <StoreModal 
          user={currentUser}
          coins={coins}
          purchasedColors={purchasedColors}
          purchasedGifts={purchasedGifts}
          onBuy={(item) => {
            if (coins >= item.cost) {
              deductCoins(currentUser.username, item.cost);
              setCoins(prev => prev - item.cost);
              const newColors = purchaseColor(currentUser.username, item.value);
              setPurchasedColors(newColors);
              setPenColor(item.value);
            }
          }}
          onBuyGift={handleBuyGift}
          onClaim={() => {
            setShowStore(false);
            setShowCertificate(true);
          }}
          onClose={() => setShowStore(false)}
        />
      )}

      {showDashboard && (
        <TeacherDashboard 
          user={currentUser}
          coins={coins}
          onShowCertificate={() => setShowCertificate(true)}
          onClose={() => setShowDashboard(false)}
        />
      )}

      {showCertificate && (
        <CertificateModal 
          user={currentUser}
          onClose={() => setShowCertificate(false)}
        />
      )}



      {showOnboarding && (
        <OnboardingOverlay onComplete={() => setShowOnboarding(false)} />
      )}

      {showAbout && (
        <AboutModal onClose={() => setShowAbout(false)} />
      )}

    </div>
  );
}

export default App;
