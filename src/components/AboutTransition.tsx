import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const HERO_TO_ABOUT_VIDEO = '/hero-to-about.mp4';
const ABOUT_LOOP_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_2zvTR2NOoUjz8SC8aobXQUJkAIB/hf_20260422_214230_34fad34c-5bf4-4ae0-92fa-252b01f17086.mp4';
const ABOUT_TO_HERO_VIDEO = '/about-to-hero.mp4';

type State = 'idle' | 'landing' | 'looping' | 'exit-up';

interface AboutVideoBackgroundProps {
  isActive: boolean;
  scrollDirRef: React.MutableRefObject<'down' | 'up'>;
  onIdle?: () => void;
}

// No CSS opacity transition on transition videos — the video content itself IS the visual
// transition. Fading them in/out creates a soft start/end that looks like lag.
// Loop video gets a very short fade so it doesn't hard-cut in.
const VIDEO_BASE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
  willChange: 'opacity',
  transform: 'translateZ(0)',  // promote to own GPU layer → compositor-only opacity changes
};

export const AboutVideoBackground: React.FC<AboutVideoBackgroundProps> = ({
  isActive,
  scrollDirRef,
  onIdle,
}) => {
  const [state, setState] = useState<State>('idle');
  const prevIsActive = useRef(isActive);
  const wasNonIdleRef = useRef(false);

  const landingRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);
  const exitUpRef = useRef<HTMLVideoElement>(null);

  // Fire onIdle after returning from a non-idle state
  useEffect(() => {
    if (state !== 'idle') { wasNonIdleRef.current = true; return; }
    if (wasNonIdleRef.current) { wasNonIdleRef.current = false; onIdle?.(); }
  }, [state]);

  // Section activation → state transitions
  useEffect(() => {
    const wasActive = prevIsActive.current;
    prevIsActive.current = isActive;
    if (isActive && !wasActive) setState('landing');
    else if (!isActive && wasActive) {
      setState(scrollDirRef.current === 'up' ? 'exit-up' : 'idle');
    }
  }, [isActive]);

  // Drive video play/pause from state — useLayoutEffect fires before paint (no 1-frame delay)
  useLayoutEffect(() => {
    const landing = landingRef.current;
    const loop = loopRef.current;
    const exitUp = exitUpRef.current;

    if (state === 'landing') {
      // Stop & reset others while hidden
      if (loop)   { loop.pause();   loop.currentTime = 0; }
      if (exitUp) { exitUp.pause(); exitUp.currentTime = 0; }
      // landing is already at 0 (reset after last stop) — instant play
      if (landing) { landing.playbackRate = 1.2; landing.play().catch(() => {}); }

    } else if (state === 'looping') {
      // Landing just ended — reset it for next use
      if (landing) { landing.currentTime = 0; }
      if (exitUp)  { exitUp.pause(); exitUp.currentTime = 0; }
      if (loop)    { loop.currentTime = 0; loop.play().catch(() => {}); }

    } else if (state === 'exit-up') {
      if (landing) { landing.pause(); landing.currentTime = 0; }
      if (loop)    { loop.pause();    loop.currentTime = 0; }
      // exitUp is already at 0 — instant play
      if (exitUp) { exitUp.playbackRate = 1.2; exitUp.play().catch(() => {}); }

    } else {
      // idle — stop & reset all
      if (landing) { landing.pause(); landing.currentTime = 0; }
      if (loop)    { loop.pause();    loop.currentTime = 0; }
      if (exitUp)  { exitUp.pause();  exitUp.currentTime = 0; }
    }
  }, [state]);

  return (
    <>
      {/* Landing: instant cut — video content itself is the visual transition */}
      <video
        ref={landingRef}
        src={HERO_TO_ABOUT_VIDEO}
        muted playsInline preload="auto"
        onEnded={() => setState('looping')}
        style={{ ...VIDEO_BASE, opacity: state === 'landing' ? 1 : 0, transition: 'opacity 0s' }}
      />
      {/* Loop: tiny 80ms fade so it doesn't hard-cut after landing ends */}
      <video
        ref={loopRef}
        src={ABOUT_LOOP_VIDEO}
        loop muted playsInline preload="auto"
        style={{ ...VIDEO_BASE, opacity: state === 'looping' ? 1 : 0, transition: 'opacity 0.08s ease' }}
      />
      {/* Exit-up: instant cut — video content itself is the visual transition */}
      <video
        ref={exitUpRef}
        src={ABOUT_TO_HERO_VIDEO}
        muted playsInline preload="auto"
        onEnded={() => setState('idle')}
        style={{ ...VIDEO_BASE, opacity: state === 'exit-up' ? 1 : 0, transition: 'opacity 0s' }}
      />
    </>
  );
};
