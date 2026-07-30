import { useEffect, useState } from "react";
import "./SpecialText.css";

interface SpecialTextProps {
  children: string;
  /** Milliseconds between animation frames. */
  speed?: number;
  /** Seconds to wait before the animation starts. */
  delay?: number;
  className?: string;
}

const RANDOM_CHARS = "_!X$0-+*#";
const NBSP = "\u00A0";

function getRandomChar(prevChar?: string): string {
  let char: string;
  do {
    char = RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)];
  } while (char === prevChar);
  return char;
}

/**
 * Decrypting/typing text effect: first the line fills up with random glyphs,
 * then the real characters are revealed one by one behind a blinking cursor.
 *
 * The whole animation is driven by one interval and plain local variables
 * instead of per-step state, so a long title does not re-create its timer on
 * every frame.
 */
export function SpecialText({
  children,
  speed = 20,
  delay = 0,
  className = "",
}: SpecialTextProps): JSX.Element {
  const text = children;
  const [displayText, setDisplayText] = useState<string>(() =>
    NBSP.repeat(text.length),
  );

  useEffect(() => {
    setDisplayText(NBSP.repeat(text.length));

    let step = 0;
    let phase: "scramble" | "reveal" = "scramble";
    let interval = 0;

    const tick = (): void => {
      if (phase === "scramble") {
        const filled = Math.min(step + 1, text.length);
        const chars: string[] = [];
        for (let i = 0; i < filled; i++) {
          chars.push(getRandomChar(i > 0 ? chars[i - 1] : undefined));
        }
        for (let i = filled; i < text.length; i++) chars.push(NBSP);
        setDisplayText(chars.join(""));

        if (step < text.length * 2 - 1) {
          step += 1;
        } else {
          phase = "reveal";
          step = 0;
        }
        return;
      }

      const revealed = Math.floor(step / 2);
      const chars: string[] = [];
      for (let i = 0; i < revealed && i < text.length; i++) chars.push(text[i]);
      if (revealed < text.length) {
        chars.push(step % 2 === 0 ? "_" : getRandomChar());
      }
      for (let i = chars.length; i < text.length; i++) {
        chars.push(getRandomChar());
      }
      setDisplayText(chars.join(""));

      if (step < text.length * 2 - 1) {
        step += 1;
      } else {
        setDisplayText(text);
        window.clearInterval(interval);
      }
    };

    const startTimer = window.setTimeout(
      () => {
        interval = window.setInterval(tick, speed);
      },
      Math.max(0, delay * 1000),
    );

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(interval);
    };
  }, [text, speed, delay]);

  return (
    <span className={`special-text ${className}`.trim()} aria-label={text}>
      {displayText}
    </span>
  );
}
