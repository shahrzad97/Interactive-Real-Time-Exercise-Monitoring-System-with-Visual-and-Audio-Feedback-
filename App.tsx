import { useEffect, useRef, useState } from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'animate.css';

const Notification = ({ message, duration = 2000 }: { message: string; duration?: number }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  if (!isVisible) return null;

  return (
    <div className="position-fixed top-50 start-50 translate-middle animate__animated animate__fadeIn animate__faster" style={{ zIndex: 2000 }}>
      <div
        style={{
          background: "#fff",
          color: "#1e293b",
          padding: "2.5rem 4rem",
          borderRadius: "2rem",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          fontSize: "2.5rem",
          fontWeight: 700,
          border: "2px solid #a855f7",
          textAlign: "center",
          minWidth: "350px",
          maxWidth: "90vw",
          letterSpacing: "0.03em",
          transition: "all 0.2s",
          position: "relative",
        }}
      >
        {/* ActionQ Logo */}
        <div style={{
          position: "absolute",
          top: "15px",
          right: "15px",
          width: "40px",
          height: "40px",
          background: "linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: "bold",
          fontSize: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
        }}>
          AQ
        </div>
        {message}
      </div>
    </div>
  );
};

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const referenceVideoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const exerciseIdRef = useRef<string>("");
  const lastAudioRef = useRef<string | null>(null);
  const audioInstanceRef = useRef<HTMLAudioElement | null>(null);
  const lastAudioTimestampRef = useRef<number>(0);
  const nextAudioToPlayRef = useRef<string | null>(null); // queue the next audio to play
const nextAudioExerciseIdRef = useRef<string | null>(null); // queue also the exerciseId




  const [repetitions, setRepetitions] = useState(0);
  const [status, setStatus] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [helpText, setHelpText] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [notification, setNotification] = useState<{message: string, key: number} | null>(null);

  // New session metadata
  const [sessionMeta, setSessionMeta] = useState<{
    exercises_count?: number;
    exercise_ids?: string[];
    resolution?: [number, number];
    frame_rate?: number;
  }>({});

  // --- NEW: Store pending ExerciseEnd notification ---
const pendingExerciseEndRef = useRef<string | null>(null);


  const showNotification = (message: string) => {
    setNotification({ message, key: Date.now() });
  };

  useEffect(() => {
    const socket = new WebSocket("ws://127.0.0.1:8080");
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    socket.addEventListener("open", () => console.log("Connected to WebSocket server"));
    socket.onerror = (error) => console.error("WebSocket Error:", error);
    socket.onclose = () => console.log("WebSocket Disconnected");

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log(msg);
        if (msg.exercise_id) {
  setExerciseId(msg.exercise_id);
  exerciseIdRef.current = msg.exercise_id;
  console.log("Updated exerciseId to", msg.exercise_id);
}

        // Handle SessionStart
        if (msg.type === "SessionStart") {
          setSessionActive(true);

          // Store session metadata
          setSessionMeta({
            exercises_count: msg.exercises_count,
            exercise_ids: msg.exercise_ids,
            resolution: msg.resolution,
            frame_rate: msg.frame_rate,
          });

          // Fade out overlay
          if (overlayRef.current) {
            overlayRef.current.classList.remove("animate__fadeIn");
            overlayRef.current.classList.add("animate__fadeOut");
            setTimeout(() => {
              if (overlayRef.current) {
                overlayRef.current.style.display = "none";
              }
            }, 500);
          }

          // Show notification for exercise start
          showNotification("🟢start!");
          return;
        }

        // Handle SessionEnd
if (msg.type === "SessionEnd") {
  setSessionActive(false);

  // --- NEW: discard pending ExerciseEnd notification ---
  pendingExerciseEndRef.current = null;

  // Fade in overlay
  if (overlayRef.current) {
    overlayRef.current.style.display = "flex";
    overlayRef.current.classList.remove("animate__fadeOut");
    overlayRef.current.classList.add("animate__fadeIn");
  }

  // Show notification for session end
  showNotification("you finished the exercise for today! well done🎉");
  return;
}


       // Handle ExerciseStart
if (msg.type === "ExerciseStart") {
  setRepetitions(0);
  setStatus("Exercise started");
  if (msg.exercise_id) setExerciseId(msg.exercise_id);
  exerciseIdRef.current = msg.exercise_id;

  setTimeout(() => {
    if (referenceVideoRef.current) {
      referenceVideoRef.current.play().catch(e =>
        console.warn("Reference video autoplay blocked:", e)
      );
    }
  }, 500);
  // --- NEW: show pending ExerciseEnd notification if there is one ---
  if (pendingExerciseEndRef.current) {
    showNotification(pendingExerciseEndRef.current);
    pendingExerciseEndRef.current = null;
  }
  // No notification here, as it's shown on SessionStart
  return;
}


       // Handle ExerciseEnd
if (msg.type === "ExerciseEnd") {
  setStatus("Exercise completed.");
  // NEW: store notification instead of showing it immediately
  pendingExerciseEndRef.current = "great! let's go to the next one";
  if (referenceVideoRef.current) {
    referenceVideoRef.current.pause();
  }
  return;
}


        // Handle ExerciseUpdate
        if (typeof msg.repetitions === "number") {
          setRepetitions(msg.repetitions);
        }

        // Show notification if ExerciseUpdate event is "start"
        if (msg.type === "ExerciseUpdate" && msg.metadata && msg.metadata.event === "start") {
          showNotification("exercise start!");
        }

        // Draw frame and overlays
        const byteArray = new Uint8Array(msg.frame);
        const blob = new Blob([byteArray], { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);

        const currentExerciseId = msg.exercise_id || (msg.metadata && msg.metadata.exercise_id) || exerciseIdRef.current;

        const img = new Image();
        img.onload = () => {
          const metadata = msg.metadata || {};
const MIN_AUDIO_DELAY_MS = 2000;
const now = Date.now();

console.log(
  "DEBUG - audio playback check",
  "currentExerciseId:", currentExerciseId,
  "metadata.audio:", metadata.audio
);

if (
  currentExerciseId &&
  metadata.audio &&
  typeof metadata.audio === "string"
) {
  // Check if audio is already playing
  if (
    (!audioInstanceRef.current || audioInstanceRef.current.ended) &&
    (metadata.audio !== lastAudioRef.current) &&
    now - lastAudioTimestampRef.current > MIN_AUDIO_DELAY_MS
  ) {
    // Play immediately
    const audioPath = `/exercises1/${currentExerciseId}/audio/${metadata.audio}`;
    const audio = new Audio(audioPath);
    audio.onplay = () => console.log("DEBUG - audio started", audioPath);
    audio.onended = () => {
      audioInstanceRef.current = null;
      lastAudioRef.current = null;
      lastAudioTimestampRef.current = Date.now();
      console.log("DEBUG - audio ended", audioPath);

      // If there is a queued audio, play it now
      if (nextAudioToPlayRef.current && nextAudioToPlayRef.current !== metadata.audio) {
        console.log("DEBUG - found queued audio:", nextAudioToPlayRef.current);
        // Play queued audio (recursively trigger your logic)
        const nextAudioPath = `/exercises1/${nextAudioExerciseIdRef.current}/audio/${nextAudioToPlayRef.current}`;
        const nextAudio = new Audio(nextAudioPath);
        nextAudio.onplay = () => console.log("DEBUG - audio started (queued)", nextAudioPath);
        nextAudio.onended = () => {
          audioInstanceRef.current = null;
          lastAudioRef.current = null;
          lastAudioTimestampRef.current = Date.now();
          nextAudioToPlayRef.current = null;
          nextAudioExerciseIdRef.current = null;
          console.log("DEBUG - queued audio ended", nextAudioPath);
        };
        nextAudio.onerror = (e) => console.error("DEBUG - audio error (queued)", nextAudioPath, e);
        nextAudio.play().catch(e => {
          console.warn("DEBUG - audio playback error (queued catch):", e);
        });
        audioInstanceRef.current = nextAudio;
        lastAudioRef.current = nextAudioToPlayRef.current;
        lastAudioTimestampRef.current = Date.now();
        nextAudioToPlayRef.current = null; // Clear queue after playing
        nextAudioExerciseIdRef.current = null;
      }
    };
    audio.onerror = (e) => console.error("DEBUG - audio error", audioPath, e);
    audio.play().catch(e => {
      console.warn("DEBUG - audio playback error (catch):", e);
    });
    audioInstanceRef.current = audio;
    lastAudioRef.current = metadata.audio;
    lastAudioTimestampRef.current = now;
    nextAudioToPlayRef.current = null;
    nextAudioExerciseIdRef.current = null;
    console.log("DEBUG - will try to play:", audioPath, "at", now);
  } else {
    // If another audio is currently playing, queue this one to play next
    if (metadata.audio !== lastAudioRef.current) {
      nextAudioToPlayRef.current = metadata.audio;
      nextAudioExerciseIdRef.current = currentExerciseId;
      console.log("DEBUG - audio queued for next:", metadata.audio);
    } else if (audioInstanceRef.current && !audioInstanceRef.current.ended) {
      console.log("DEBUG - skipping play: audio is still playing");
    } else {
      console.log("DEBUG - skipping play: too soon since last audio");
    }
  }
}



          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);

          const skeleton = msg.skeleton || {};
          ctx.strokeStyle = "white";
          ctx.lineWidth = 1;

          const connections = [
            ["left_shoulder", "right_shoulder"],
            ["left_shoulder", "left_elbow"],
            ["right_shoulder", "right_elbow"],
            ["left_elbow", "left_wrist"],
            ["right_elbow", "right_wrist"],
            ["left_shoulder", "left_hip"],
            ["right_shoulder", "right_hip"],
            ["left_hip", "right_hip"],
            ["left_hip", "left_knee"],
            ["left_knee", "left_ankle"],
            ["right_hip", "right_knee"],
            ["right_knee", "right_ankle"],
            ["nose", "left_eye"],
            ["nose", "right_eye"],
            ["left_eye", "left_ear"],
            ["right_eye", "right_ear"]
          ];

          for (const [p1, p2] of connections) {
            if (skeleton[p1] && skeleton[p2]) {
              const [x1, y1] = skeleton[p1];
              const [x2, y2] = skeleton[p2];
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            }
          }

          ctx.shadowBlur = 6;
          ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;

          ctx.fillStyle = "white";
          for (const key in skeleton) {
            const [x, y] = skeleton[key];
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
          }
          
          ctx.shadowBlur = 0;
          ctx.shadowColor = "transparent";

          setHelpText(metadata.help || "");

          const widgets = metadata.widgets || [];
          widgets.forEach((w: any) => {
            if (w.Circle) {
              const { position, text } = w.Circle;
              const [x, y] = position;
              ctx.fillStyle = "white";
              ctx.strokeStyle = "black";
              ctx.beginPath();
              ctx.arc(x, y, 15, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = "black";
              ctx.font = "bold 14px Arial";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(text, x, y);
            }

            if (w.Segment) {
              const [x1, y1] = w.Segment.from;
              const [x2, y2] = w.Segment.to;
              ctx.strokeStyle = "orange";
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            }

            if (w.HLine) {
              const y = w.HLine.y;
              ctx.strokeStyle = "green";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(canvas.width, y);
              ctx.stroke();
            }

            if (w.VLine) {
              const x = w.VLine.x;
              ctx.strokeStyle = "green";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, canvas.height);
              ctx.stroke();
            }

            if (w.Arc) {
              const { center, radius, from, to } = w.Arc;
              const [x, y] = center;
              ctx.strokeStyle = "purple";
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(x, y, radius, from, to);
              ctx.stroke();
            }
          });
        };

        img.src = url;
      } catch (err) {
        console.error("Error processing WebSocket message:", err);
      }
    };
  }, []);

  const heroStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #4c1d95 0%, #1e3a8a 50%, #312e81 100%)',
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  };

  const textContainerStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    padding: '3rem 4rem',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
    position: 'relative',
    zIndex: 10
  };

  const gradientTextStyle: React.CSSProperties = {
    background: 'linear-gradient(45deg, #ffffff, #a855f7, #ec4899, #06b6d4, #ffffff)',
    backgroundSize: '300% 300%',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontSize: '8rem',
    fontWeight: 900,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    marginBottom: 0,
    textShadow: '0 0 30px rgba(255, 255, 255, 0.8), 0 0 60px rgba(168, 85, 247, 0.6), 0 0 90px rgba(236, 72, 153, 0.4)',
    animation: 'gradientShift 3s ease-in-out infinite'
  };

  const shapeStyles = {
    shape1: {
      position: 'absolute' as const,
      top: '10%',
      left: '10%',
      width: '8rem',
      height: '8rem',
      backgroundColor: '#a855f7',
      borderRadius: '50%',
      filter: 'blur(40px)',
      opacity: 0.2,
      animation: 'pulse 3s infinite'
    },
    shape2: {
      position: 'absolute' as const,
      top: '20%',
      right: '15%',
      width: '12rem',
      height: '12rem',
      backgroundColor: '#3b82f6',
      borderRadius: '50%',
      filter: 'blur(40px)',
      opacity: 0.2,
      animation: 'bounce 4s infinite'
    },
    shape3: {
      position: 'absolute' as const,
      bottom: '15%',
      left: '25%',
      width: '10rem',
      height: '10rem',
      backgroundColor: '#6366f1',
      borderRadius: '50%',
      filter: 'blur(40px)',
      opacity: 0.2,
      animation: 'pulse 2.5s infinite'
    },
    shape4: {
      position: 'absolute' as const,
      bottom: '25%',
      right: '30%',
      width: '6rem',
      height: '6rem',
      backgroundColor: '#06b6d4',
      borderRadius: '50%',
      filter: 'blur(40px)',
      opacity: 0.2,
      animation: 'bounce 3.5s infinite'
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.1)',
    top: 0,
    left: 0,
    zIndex: 1
  };

  // Exercise page background style
  const exerciseBackgroundStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #1e293b 0%, #334155 25%, #475569 50%, #1e293b 100%)',
    minHeight: '100vh',
    position: 'relative'
  };

  return (
    <>
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.05); }
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        
        @media (max-width: 768px) {
          .responsive-text {
            font-size: 4rem !important;
          }
          .responsive-container {
            padding: 2rem 2.5rem !important;
          }
        }
        
        @media (max-width: 576px) {
          .responsive-text {
            font-size: 3rem !important;
          }
          .responsive-container {
            padding: 1.5rem 2rem !important;
          }
        }

        /* Exercise page subtle pattern overlay */
        .exercise-background::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            radial-gradient(circle at 25% 25%, rgba(168, 85, 247, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 75% 75%, rgba(59, 130, 246, 0.1) 0%, transparent 50%);
          pointer-events: none;
          z-index: 1;
        }

        .exercise-content {
          position: relative;
          z-index: 2;
        }
      `}</style>

      {/* Homepage Overlay */}
      <div 
        ref={overlayRef}
        style={heroStyle} 
        className="animate__animated animate__fadeIn"
      >
        <div style={shapeStyles.shape1}></div>
        <div style={shapeStyles.shape2}></div>
        <div style={shapeStyles.shape3}></div>
        <div style={shapeStyles.shape4}></div>
        
        <div className="text-center">
          <div style={textContainerStyle} className="responsive-container">
            <h1 style={gradientTextStyle} className="responsive-text">
              ActionQ
            </h1>
          </div>
        </div>
        
        <div style={overlayStyle}></div>
      </div>

      {/* Exercise Monitoring Layout */}
      <div 
        className="exercise-background"
        style={{
          ...exerciseBackgroundStyle,
          display: sessionActive ? 'block' : 'none'
        }}

      >
        <div className="container-fluid vh-100 p-0 m-0 d-flex flex-column flex-md-row exercise-content">
          <div className="col-12 col-md-9 position-relative d-flex align-items-center justify-content-center" style={{ background: 'rgba(30, 41, 59, 0.3)' }}>
            <div
              key={helpText}
              className="position-absolute top-0 mt-3 text-white fw-bold px-4 py-2 rounded-pill animate__animated animate__fadeIn fs-1"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.9) 0%, rgba(59, 130, 246, 0.9) 100%)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                maxWidth: "90%",
                textAlign: "center",
                zIndex: 10,
                textShadow: "0 2px 8px rgba(0,0,0,0.45), 0 0 2px #222",
              }}
            >
              {helpText}
            </div>

            <div className="position-relative">
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="rounded shadow-lg mw-100 mh-100"
                style={{
                  border: '2px solid rgba(168, 85, 247, 0.3)',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)'
                }}
              />
              
              <div
                className="position-absolute bottom-0 start-0 mb-3 ms-2 text-white fw-bold px-3 py-2 rounded-pill fs-1"
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.9) 0%, rgba(59, 130, 246, 0.9) 100%)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  zIndex: 10,
                  textShadow: "0 2px 8px rgba(0,0,0,0.45), 0 0 2px #222",
                }}
              >
                {repetitions}
              </div>
            </div>
          </div>
          
          <div 
            className="col-12 col-md-3 d-flex flex-column justify-content-center align-items-center p-0"
            style={{ 
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(51, 65, 85, 0.4) 100%)',
              backdropFilter: 'blur(5px)'
            }}
          >
            {exerciseId && (
              <video
                ref={referenceVideoRef}
                className="w-100 rounded"
                autoPlay
                loop
                muted
                playsInline
                style={{ 
                  maxHeight: "480px",
                  border: '2px solid rgba(168, 85, 247, 0.3)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
                }}
                src={`/exercises1/${exerciseId}/reference.mp4`}
                onLoadedData={() => {
                  if (referenceVideoRef.current) {
                    referenceVideoRef.current.play().catch(e => 
                      console.warn("Reference video autoplay blocked:", e)
                    );
                  }
                }}
                onEnded={() => {
                  if (referenceVideoRef.current && status !== "Exercise completed.") {
                    referenceVideoRef.current.currentTime = 0;
                    referenceVideoRef.current.play().catch(e => 
                      console.warn("Reference video restart error:", e)
                    );
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Notification Component */}
      {notification && (
        <Notification 
          key={notification.key}
          message={notification.message} 
        />
      )}

    </>
  );
};

export default App;