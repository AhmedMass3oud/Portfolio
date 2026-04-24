import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const HERO_TO_ABOUT_VIDEO = '/hero-to-about.mp4';
const ABOUT_LOOP_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_2zvTR2NOoUjz8SC8aobXQUJkAIB/hf_20260422_214230_34fad34c-5bf4-4ae0-92fa-252b01f17086.mp4';
const ABOUT_TO_HERO_VIDEO = '/about-to-hero.mp4';

type State = 'idle' | 'landing' | 'landing-ready' | 'looping' | 'fading-down' | 'exit-up' | 'exit-ready';

interface AboutVideoBackgroundProps {
  isActive: boolean;
  scrollDirRef: React.MutableRefObject<'down' | 'up'>;
  onIdle?: () => void;
}

const VIDEO_BASE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
  willChange: 'opacity',
  transform: 'translateZ(0)',
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
  const loopRef    = useRef<HTMLVideoElement>(null);
  const exitUpRef  = useRef<HTMLVideoElement>(null);

  // ── Prime all decoders on mount so first play has zero startup lag ───
  useEffect(() => {
    const prime = (v: HTMLVideoElement | null) => {
      if (!v) return;
      v.play().then(() => { v.pause(); v.currentTime = 0; }).catch(() => {});
    };
    const t = setTimeout(() => {
      prime(landingRef.current);
      prime(loopRef.current);
      prime(exitUpRef.current);
    }, 150);
    return () => clearTimeout(t);
  }, []);

  // ── Perfect seamless loop for the about loop video ───────────────────
  useEffect(() => {
    const v = loopRef.current;
    if (!v) return;
    const onTimeUpdate = () => {
      if (v.duration && v.currentTime >= v.duration - 0.15) {
        v.currentTime = 0;
      }
    };
    v.addEventListener('timeupdate', onTimeUpdate);
    return () => v.removeEventListener('timeupdate', onTimeUpdate);
  }, []);

  // ── Fire onIdle after returning from a non-idle state ────────────────
  useEffect(() => {
    if (state !== 'idle') { wasNonIdleRef.current = true; return; }
    if (wasNonIdleRef.current) { wasNonIdleRef.current = false; onIdle?.(); }
  }, [state]);

  // ── Section activation → state transitions ───────────────────────────
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const wasActive = prevIsActive.current;
    prevIsActive.current = isActive;
    if (isActive && !wasActive) {
      if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
      setState('landing');
    } else if (!isActive && wasActive) {
      if (scrollDirRef.current === 'up') {
        setState('exit-up');
      } else {
        // Scrolling down to projects — fade loop out gracefully, then idle
        setState('fading-down');
        fadeTimerRef.current = setTimeout(() => setState('idle'), 400);
      }
    }
    return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current); };
  }, [isActive]);

  // ── Drive video play/pause from state ────────────────────────────────
  useLayoutEffect(() => {
    const landing = landingRef.current;
    const loop    = loopRef.current;
    const exitUp  = exitUpRef.current;

    if (state === 'landing') {
      if (loop)   { loop.pause();   loop.currentTime = 0; }
      if (exitUp) { exitUp.pause(); exitUp.currentTime = 0; }
      if (landing) {
        landing.playbackRate = 1;
        // Wait for 'playing' event — guarantees first frame is painted before showing
        const onPlaying = () => { setState('landing-ready'); landing.removeEventListener('playing', onPlaying); };
        landing.addEventListener('playing', onPlaying);
        landing.play().catch(() => landing.removeEventListener('playing', onPlaying));
      }

    } else if (state === 'landing-ready') {
      // no-op — video is already playing, opacity now 1 via render

    } else if (state === 'looping') {
      if (landing) { landing.currentTime = 0; }
      if (exitUp)  { exitUp.pause(); exitUp.currentTime = 0; }
      if (loop)    { loop.currentTime = 0; loop.play().catch(() => {}); }

    } else if (state === 'fading-down') {
      // Keep loop playing — CSS opacity transition handles the fade, then idle stops it
      // no-op here

    } else if (state === 'exit-up') {
      if (landing) { landing.pause(); landing.currentTime = 0; }
      if (loop)    { loop.pause();    loop.currentTime = 0; }
      if (exitUp) {
        exitUp.playbackRate = 1;
        // Wait for 'playing' event before showing — same as landing
        const onPlaying = () => { setState('exit-ready'); exitUp.removeEventListener('playing', onPlaying); };
        exitUp.addEventListener('playing', onPlaying);
        exitUp.play().catch(() => exitUp.removeEventListener('playing', onPlaying));
      }

    } else if (state === 'exit-ready') {
      // no-op — video is already playing, opacity now 1 via render

    } else {
      // idle — stop & reset all
      if (landing) { landing.pause(); landing.currentTime = 0; }
      if (loop)    { loop.pause();    loop.currentTime = 0; }
      if (exitUp)  { exitUp.pause();  exitUp.currentTime = 0; }
    }
  }, [state]);

  return (
    <>
      {/* Landing: hero → about transition, shown only after first frame is painted */}
      <video
        ref={landingRef}
        src={HERO_TO_ABOUT_VIDEO}
        muted playsInline preload="auto"
        onEnded={() => setState('looping')}
        style={{ ...VIDEO_BASE, opacity: state === 'landing-ready' ? 1 : 0, transition: 'opacity 0s' }}
      />
      {/* Loop: about background loop, seamless via timeupdate seek */}
      <video
        ref={loopRef}
        src={ABOUT_LOOP_VIDEO}
        muted playsInline preload="auto"
        style={{
          ...VIDEO_BASE,
          opacity: (state === 'looping' || state === 'fading-down') ? 1 : 0,
          transition: state === 'fading-down' ? 'opacity 0.4s ease' : 'opacity 0.08s ease',
        }}
      />
      {/* Exit-up: about → hero transition, shown only after first frame is painted */}
      <video
        ref={exitUpRef}
        src={ABOUT_TO_HERO_VIDEO}
        muted playsInline preload="auto"
        onEnded={() => setState('idle')}
        style={{ ...VIDEO_BASE, opacity: state === 'exit-ready' ? 1 : 0, transition: 'opacity 0s' }}
      />
    </>
  );
};
