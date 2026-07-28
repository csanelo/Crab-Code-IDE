import { useCallback, useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { asset } from "../../lib/asset";
import "./Welcome.css";

const SEEN_KEY = "crabcode.welcomeSeen";

/** True once the intro has been dismissed, so it only ever shows on first launch. */
export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Storage blocked: never block startup behind the intro.
    return true;
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Ignored: the intro simply shows again next launch.
  }
}

export function Welcome({ onStart }: { onStart: () => void }): JSX.Element {
  const [closing, setClosing] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    void window.api.window.isMaximized().then(setMaximized);
    const off = window.api.window.onMaximizedChange(setMaximized);
    return () => off?.();
  }, []);

  const start = useCallback(() => {
    setClosing((wasClosing) => {
      if (wasClosing) return wasClosing;
      markWelcomeSeen();
      window.setTimeout(onStart, 260);
      return true;
    });
  }, [onStart]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [start]);

  return (
    <div
      className={`welcome${closing ? " welcome--closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to CrabCode"
    >
      <div className="welcome__winbtns">
        <button
          type="button"
          className="welcome__win-btn"
          aria-label="Minimize"
          onClick={() => void window.api.window.minimize()}
        >
          <Minus size={15} />
        </button>
        <button
          type="button"
          className="welcome__win-btn"
          aria-label={maximized ? "Restore" : "Maximize"}
          onClick={() =>
            void window.api.window.toggleMaximize().then(setMaximized)
          }
        >
          {maximized ? <Copy size={13} /> : <Square size={12} />}
        </button>
        <button
          type="button"
          className="welcome__win-btn welcome__win-btn--close"
          aria-label="Close"
          onClick={() => void window.api.window.close()}
        >
          <X size={15} />
        </button>
      </div>

      <div className="welcome__inner">
        <video
          className="welcome__video"
          src={asset("crab-intro.webm")}
          autoPlay
          loop
          muted
          playsInline
          disablePictureInPicture
        />
        <h1 className="welcome__title">Welcome to CrabCode</h1>
        <button
          type="button"
          className="welcome__start"
          onClick={start}
        >
          Start
        </button>
      </div>
    </div>
  );
}
