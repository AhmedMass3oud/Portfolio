import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { SECTIONS } from './constants';

interface ProjectItem {
  name: string;
  category: string;
  description: string;
  image?: string;
  video?: string;
}

interface SectionData {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  items?: { company: string; role: string; period: string; logo?: string }[];
  projects?: ProjectItem[];
  email?: string;
  whatsapp?: string;
  socials?: string[];
}

/* ─── Orange scroll-progress bar ────────────────────────────────────── */
const ScrollProgressBar: React.FC<{ containerRef: React.RefObject<HTMLDivElement | null> }> = ({ containerRef }) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const max = scrollHeight - clientHeight;
      setProgress(max > 0 ? scrollTop / max : 0);
    };
    container.addEventListener('scroll', update, { passive: true });
    return () => container.removeEventListener('scroll', update);
  }, []);
  return (
    <div className="fixed right-0 top-0 h-full w-[3px] z-[150] pointer-events-none" style={{ background: 'rgba(0,0,0,0.06)' }}>
      <div className="w-full" style={{ height: `${progress * 100}%`, background: '#FF4E00' }} />
    </div>
  );
};

/* ─── useInView — drives CSS class toggling via IntersectionObserver ── */
function useInView(
  ref: React.RefObject<Element | null>,
  { threshold = 0.2, once = false }: { threshold?: number; once?: boolean } = {}
) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) obs.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, once]);
  return visible;
}

/* ─── All-in-one video controller ───────────────────────────────────────
 *  0 – 8s  : hero loop
 *  8 – 9s  : hero→about transition (forward) / about→hero transition (reverse)
 *  9 – 15s : about loop
 * ─────────────────────────────────────────────────────────────────────── */
/* ─── All-in-one video controller ───────────────────────────────────────
 *  0 – 8s  : hero loop
 *  8 – 10s : hero→about transition (forward) / about→hero transition (reverse)
 *  10 – 17s: about loop
 * ─────────────────────────────────────────────────────────────────────── */
type AVState = 'hero-loop' | 'to-about' | 'about-loop' | 'to-hero';

const HERO_END  = 8;
const TRANS_END = 10;
const ABOUT_END = 17;

const HeroAboutVideo: React.FC<{ activeSection: string; src?: string; notifyReady?: boolean }> = ({
  activeSection,
  src = '/all-in-one.mp4',
  notifyReady = true,
}) => {
  const vidRef     = useRef<HTMLVideoElement>(null);
  const vstateRef  = useRef<AVState>('hero-loop');
  const rafRef     = useRef(0);
  const prevSecRef = useRef(activeSection);
  const reverseRef = useRef(false); // guards the reverse seek chain

  // ── rAF control loop ─────────────────────────────────────────────
  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});

    // Tell loading screen when this video is ready (desktop video only)
    if (notifyReady) {
      const fire = () => window.dispatchEvent(new Event('portfolio-video-ready'));
      if (v.readyState >= 3) fire();
      else v.addEventListener('canplaythrough', fire, { once: true });
    }

    const tick = () => {
      const s = vstateRef.current;

      if (s === 'hero-loop') {
        if (v.currentTime >= HERO_END - 0.12) {
          v.currentTime = 0;
          if (v.paused) v.play().catch(() => {});
        }
      } else if (s === 'to-about') {
        if (v.currentTime >= TRANS_END - 0.05) {
          vstateRef.current = 'about-loop';
          v.currentTime = TRANS_END;
          if (v.paused) v.play().catch(() => {});
        }
      } else if (s === 'about-loop') {
        if (v.currentTime >= ABOUT_END - 0.12) {
          v.currentTime = TRANS_END;
        }
      }
      // 'to-hero' reverse is driven by seeked-chain below, not rAF

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      reverseRef.current = false;
      v.pause();
    };
  }, []);

  // ── Section-change transitions ────────────────────────────────────
  useLayoutEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    const prev = prevSecRef.current;
    prevSecRef.current = activeSection;

    if (activeSection === 'about' && prev === 'hero') {
      reverseRef.current = false;
      vstateRef.current = 'to-about';
      v.currentTime = HERO_END;
      v.play().catch(() => {});

    } else if (activeSection === 'hero' && prev === 'about') {
      // Reverse playback: step from TRANS_END (10s) back to HERO_END (8s),
      // then jump to 0 and start the hero loop.
      // seeked-event chaining: only issue the next seek once the browser
      // has finished decoding the previous frame — no rAF overload.
      vstateRef.current = 'to-hero';
      reverseRef.current = true;
      v.pause();

      const FPS  = 30;
      const step = 1 / FPS;

      const reverseStep = () => {
        if (!reverseRef.current || vstateRef.current !== 'to-hero') return;
        const vid = vidRef.current;
        if (!vid) return;

        const next = vid.currentTime - step;
        if (next <= HERO_END) {
          // Transition complete — jump to hero start and loop
          reverseRef.current = false;
          vid.currentTime = 0;
          vid.play().catch(() => {});
          vstateRef.current = 'hero-loop';
          return;
        }

        vid.currentTime = next;
        vid.addEventListener('seeked', reverseStep, { once: true });
      };

      // Clamp into the transition segment, then kick off the chain
      v.currentTime = Math.min(v.currentTime, TRANS_END);
      v.addEventListener('seeked', reverseStep, { once: true });

    } else if (activeSection === 'hero' && prev !== 'hero') {
      reverseRef.current = false;
      vstateRef.current = 'hero-loop';
      v.currentTime = 0;
      v.play().catch(() => {});

    } else if (activeSection === 'about' && prev !== 'about') {
      reverseRef.current = false;
      vstateRef.current = 'about-loop';
      v.currentTime = TRANS_END;
      v.play().catch(() => {});
    }
  }, [activeSection]);

  return (
    <video
      ref={vidRef}
      src={src}
      muted playsInline preload="auto"
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', objectPosition: 'center', transform: 'translateZ(0)',
      }}
    />
  );
};

/* Only one panel mounts at a time — prevents both videos loading simultaneously */
function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

const LeftVideoPanel = React.memo<{
  activeSection: string;
  scrollDirRef: React.MutableRefObject<'down' | 'up'>;
}>(({ activeSection }) => (
  <div className="fixed inset-0 z-0 overflow-hidden bg-white" aria-hidden="true">
    <HeroAboutVideo activeSection={activeSection} src="/all-in-one.mp4" notifyReady={true} />
  </div>
));

/* Mobile video panel — full-screen fixed, same transition logic as desktop */
const MobileVideoPanel = React.memo<{ activeSection: string }>(({ activeSection }) => (
  <div className="fixed inset-0 z-0 overflow-hidden bg-black" aria-hidden="true">
    <HeroAboutVideo activeSection={activeSection} src="/hero-mobile.mp4" notifyReady={true} />
  </div>
));

/* ─── InteractiveTitle — blur + rise reveal ─────────────────────────── */
// Each line animates: translateY(40px) + blur(14px) + opacity(0) → clear, up, visible.
// filter + transform are compositor-only → no paint cost.
const InteractiveTitle = React.memo<{ text: string; isHero: boolean }>(({ text, isHero }) => {
  const ref = useRef<HTMLElement>(null);
  const visible = useInView(ref as React.RefObject<Element>, { threshold: 0.15 });
  const Tag = isHero ? 'h1' : 'h2';
  const lines = text.split('\n');

  return (
    <Tag
      ref={ref as React.RefObject<HTMLHeadingElement>}
      className={`font-display leading-[0.85] mb-0 uppercase font-black ${
        isHero ? 'text-fluid-display text-gray-900' : 'text-fluid-section-title text-gray-900'
      }`}
    >
      {lines.map((line, li) => {
        const words = line.split(' ');
        const isOrangeLine = isHero && li === 1;
        const delay = `${li * 0.12}s`;

        return (
          <div key={li} style={{ display: 'block', lineHeight: 'inherit' }}>
            <div
              style={{
                display: 'inline-block',
                opacity: visible ? 1 : 0,
                transform: visible
                  ? 'translateY(0) translateZ(0)'
                  : 'translateY(40px) translateZ(0)',
                filter: visible ? 'blur(0px)' : 'blur(14px)',
                transition: [
                  `opacity 0.75s ease ${delay}`,
                  `transform 0.75s cubic-bezier(0.16, 1, 0.3, 1) ${delay}`,
                  `filter 0.75s ease ${delay}`,
                ].join(', '),
                willChange: 'transform, opacity, filter',
                color: isOrangeLine ? '#FF4E00' : undefined,
              }}
            >
              {isHero ? line : words.map((word, wi) => (
                <span
                  key={wi}
                  style={{
                    color: (!isHero && wi === words.length - 1) ? '#FF4E00' : undefined,
                    marginRight: wi < words.length - 1 ? '0.22em' : 0,
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </Tag>
  );
});

/* ─── FadeIn — CSS anim-fade, zero JS per frame ─────────────────────── */
const FadeIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
  once?: boolean;
}> = ({ children, delay = 0, className = '', once = false }) => {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref as React.RefObject<Element>, { threshold: 0.15, once });
  return (
    <div
      ref={ref}
      className={`anim-fade${visible ? ' visible' : ''} ${className}`}
      style={{ transitionDelay: delay ? `${delay}s` : undefined }}
    >
      {children}
    </div>
  );
};

/* ─── Hero section content ─────────────────────────────────────────── */
const HeroContent: React.FC<{ section: SectionData }> = ({ section }) => {
  const email = section.email ?? 'a7medmass3oud@gmail.com';

  return (
    <div className="flex flex-col gap-3 w-full">
      <InteractiveTitle text={section.title} isHero />
      <div className="flex flex-col gap-3 max-w-2xl">
        <FadeIn delay={0.35}><p className="text-fluid-subtitle text-gray-600 font-normal leading-tight">{section.subtitle}</p></FadeIn>
        {section.description && (
          <FadeIn delay={0.2}><p className="text-xl font-normal text-gray-600 leading-relaxed">{section.description}</p></FadeIn>
        )}
        <FadeIn delay={0.45}>
          <a
            href={`mailto:${email}`}
            aria-label="Send Email"
            style={{
              fontFamily: 'var(--font-sans, "IBM Plex Sans")',
              fontWeight: 500, fontSize: '18px', lineHeight: '1em',
              display: 'inline-flex', position: 'relative',
              placeItems: 'center', placeContent: 'center',
              whiteSpace: 'nowrap', backgroundColor: '#ffffff', color: '#FF4E00',
              borderRadius: '50px', padding: '18px 32px', textDecoration: 'none',
              border: '1px solid rgba(0,0,0,0.15)', cursor: 'pointer', userSelect: 'none',
              transition: 'transform 0.18s ease, background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease',
            }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.transform = 'scale(1.04)'; b.style.backgroundColor = '#FF4E00'; b.style.color = '#ffffff'; b.style.borderColor = 'rgba(255,255,255,0.5)'; }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.transform = 'scale(1)'; b.style.backgroundColor = '#ffffff'; b.style.color = '#FF4E00'; b.style.borderColor = 'rgba(0,0,0,0.15)'; }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1.04)')}
          >
            Send Email
          </a>
        </FadeIn>
      </div>
    </div>
  );
};

/* ─── Projects section — drag + momentum + auto-scroll ──────────────── */
const ProjectsSection: React.FC<{ section: SectionData }> = ({ section }) => {
  const projects = section.projects
    ? [...section.projects, ...section.projects, ...section.projects]
    : [];
  const trackRef = useRef<HTMLDivElement>(null);
  const velocityRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTRef = useRef(0);
  const draggingRef = useRef(false);
  const rafRef = useRef(0);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const AUTO_SPEED = 1.4;
    let halfWidth = 0;
    const measure = () => { halfWidth = el.scrollWidth / 3; };
    measure();
    el.scrollLeft = halfWidth;
    const tick = () => {
      if (!halfWidth) measure();
      if (!draggingRef.current) {
        if (Math.abs(velocityRef.current) > 0.05) {
          el.scrollLeft += velocityRef.current;
          velocityRef.current *= 0.94;
        } else {
          el.scrollLeft += AUTO_SPEED;
        }
      }
      if (halfWidth > 0) {
        if (el.scrollLeft >= halfWidth * 2) el.scrollLeft -= halfWidth;
        else if (el.scrollLeft < halfWidth) el.scrollLeft += halfWidth;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', onResize); };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current; if (!el) return;
    draggingRef.current = true; velocityRef.current = 0;
    lastXRef.current = e.clientX; lastTRef.current = performance.now();
    el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing';
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const el = trackRef.current; if (!el) return;
    const now = performance.now();
    const dx = e.clientX - lastXRef.current;
    const dt = Math.max(1, now - lastTRef.current);
    el.scrollLeft -= dx;
    velocityRef.current = -dx * (16.67 / dt);
    lastXRef.current = e.clientX; lastTRef.current = now;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    const el = trackRef.current; if (!el) return;
    try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    el.style.cursor = 'grab';
  };
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = trackRef.current; if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); }
  };

  return (
    <div className="relative z-[1] w-full flex flex-col overflow-hidden">
      <div className="shrink-0 pt-20 md:pt-28 pb-6 px-6 md:px-20">
        <FadeIn>
          <h2 className="font-display font-black uppercase text-gray-900 text-fluid-section-title">
            Featured <span style={{ color: '#FF4E00' }}>Projects</span>
          </h2>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className="text-base font-sans text-gray-400 tracking-[0.04em] mt-3">{section.subtitle}</p>
        </FadeIn>
      </div>

      {/* ── Desktop: single auto-scrolling row ─────────────────────── */}
      <div className="hidden md:flex flex-1 relative min-h-0">
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          className="h-full w-full overflow-x-auto overflow-y-hidden scrollbar-hide select-none"
          style={{ cursor: 'grab', touchAction: 'pan-y' }}
        >
          <div className="flex gap-6 h-full w-max py-6 px-20">
            {projects.map((p, i) => (
              <div
                key={i}
                className="project-card-flat group flex-shrink-0 h-full flex flex-col bg-white border border-gray-100 rounded-[28px] overflow-hidden"
                style={{ width: 'calc((100vw - 4rem - 1.5rem) / 1.7)', pointerEvents: 'none' }}
              >
                <div className="flex-1 overflow-hidden bg-gray-100 min-h-0">
                  {p.video ? (
                    <video src={p.video} autoPlay loop muted playsInline preload="metadata" className="w-full h-full object-cover object-top" />
                  ) : (
                    <img src={p.image} alt={p.name} loading="lazy" decoding="async" draggable={false} className="w-full h-full object-cover object-top" />
                  )}
                </div>
                <div className="shrink-0 p-6 flex flex-col gap-1">
                  <span className="text-[11px] font-sans text-gray-400 tracking-[0.05em]">{p.category}</span>
                  <h3 className="font-sans font-black text-gray-900 text-lg leading-tight">{p.name}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile: 2 infinite horizontal ticker rows — fill remaining height */}
      <div className="md:hidden flex-1 flex flex-col gap-3 overflow-hidden pb-6 min-h-0">
        {[
          { items: section.projects?.slice(0, 7) ?? [], cls: 'ticker-left'  },
          { items: section.projects?.slice(7)    ?? [], cls: 'ticker-right' },
        ].map(({ items, cls }, rowIdx) => (
          <div key={rowIdx} className="flex-1 overflow-hidden min-h-0">
            <div className={`flex gap-3 h-full w-max ${cls}`}>
              {[...items, ...items].map((p, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 h-full flex flex-col bg-white border border-gray-100 rounded-[16px] overflow-hidden"
                  style={{ width: '100vw' }}
                >
                  <div className="flex-1 overflow-hidden bg-gray-100 min-h-0">
                    {p.video ? (
                      <video src={p.video} autoPlay loop muted playsInline preload="metadata"
                        className="w-full h-full object-cover object-top" />
                    ) : (
                      <img src={p.image} alt={p.name} loading="lazy" decoding="async" draggable={false}
                        className="w-full h-full object-cover object-top" />
                    )}
                  </div>
                  <div className="shrink-0 p-2.5 flex flex-col gap-0.5">
                    <span className="text-[9px] font-sans text-gray-400 tracking-[0.04em] uppercase">{p.category}</span>
                    <h3 className="font-sans font-black text-gray-900 text-xs leading-tight">{p.name}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── About row — CSS animation ─────────────────────────────────────── */
const AboutRow: React.FC<{ item: NonNullable<SectionData['items']>[0]; index: number }> = ({ item, index }) => {
  const ref = useRef<HTMLLIElement>(null);
  const visible = useInView(ref as React.RefObject<Element>, { threshold: 0.2, once: true });
  return (
    <li
      ref={ref}
      className="anim-fade group flex items-center gap-6 md:gap-12 py-4 md:py-8 border-b border-black/[0.05] last:border-0 px-4 -mx-4"
      style={{
        transitionDelay: `${0.06 * index}s`,
        ...(visible ? { opacity: 1, transform: 'translateY(0) translateZ(0)' } : {}),
      }}
    >
      <div className="flex-1 flex flex-col gap-2">
        {item.logo
          ? <img src={item.logo} alt={item.company} className={`${item.logo.includes('tremoloo') ? 'h-6 md:h-9' : 'h-8 md:h-12'} w-auto object-contain object-left`} draggable={false} />
          : <p className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">{item.company}</p>
        }
        <p className="text-gray-500 font-sans text-sm tracking-[0.05em]">{item.role}</p>
      </div>
      <span className="font-sans text-sm text-gray-500 shrink-0">{item.period}</span>
    </li>
  );
};

/* ─── Section ────────────────────────────────────────────────────────── */
const Section = React.memo<{ section: SectionData }>(({ section }) => {
  const isHero = section.id === 'hero';

  if (section.id === 'projects') {
    return (
      <section id="projects" aria-label="Featured Projects" className="h-screen w-full flex snap-start snap-always bg-white">
        <ProjectsSection section={section} />
      </section>
    );
  }

  return (
    <section
      id={section.id}
      aria-label={section.title.replace('\n', ' ')}
      className={`h-screen w-full flex snap-start snap-always${section.id === 'contact' ? ' bg-white' : ''}${section.id === 'about' ? ' items-center' : ''}`}
      style={{ position: 'relative' }}
    >
      {section.id === 'contact' && (
        <video
          src="https://d8j0ntlcm91z4.cloudfront.net/user_2zvTR2NOoUjz8SC8aobXQUJkAIB/hf_20260423_205014_a0d40d02-37ca-462a-9f5b-b7f789e2515f.mp4"
          autoPlay loop muted playsInline preload="auto"
          aria-hidden="true"
          className="hidden md:block"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'right center', zIndex: 0 }}
        />
      )}
      {/* Mobile hero: content at bottom, video behind from MobileVideoPanel */}
      {isHero && (
        <div className="md:hidden absolute inset-0 z-[1] flex flex-col justify-end">
          <div
            className="px-6 pt-32 pb-12"
            style={{ background: 'linear-gradient(to top, #ffffff 52%, rgba(255,255,255,0.7) 76%, transparent 100%)' }}
          >
            <HeroContent section={section} />
          </div>
        </div>
      )}

      {/* Mobile about: content pushed to bottom ~60%, top 40% shows video */}
      {section.id === 'about' && (
        <div className="md:hidden absolute inset-0 z-[1] flex flex-col justify-end">
          <div
            className="px-6 pt-16 pb-6 overflow-y-auto scrollbar-hide"
            style={{
              maxHeight: '62vh',
              background: 'linear-gradient(to top, #ffffff 68%, rgba(255,255,255,0.85) 86%, transparent 100%)',
            }}
          >
            <InteractiveTitle text={section.title} isHero={false} />
            {section.items && (
              <ul role="list" className="mt-4 grid grid-cols-1">
                {section.items.map((item, i) => <AboutRow key={i} item={item} index={i} />)}
              </ul>
            )}
          </div>
        </div>
      )}

      <div
        className={`relative z-[1] flex flex-col overflow-hidden ${
          isHero
            ? 'hidden md:flex w-full justify-center px-20'
            : section.id === 'contact'
              ? 'w-full md:w-[52%] px-6 md:px-20'
              : 'hidden md:flex w-full md:w-1/2 px-6 md:px-20'
        }`}
      >
        {isHero ? (
          <HeroContent section={section} />
        ) : (
          <>
            <div className={`shrink-0 pb-6 ${section.id === 'about' ? 'pt-0' : 'pt-20 md:pt-28'} ${section.id === 'contact' ? '' : ''}`}>
              <InteractiveTitle text={section.title} isHero={false} />
              {section.subtitle && (
                <FadeIn delay={0.2}>
                  <p className={`text-gray-600 font-normal leading-tight mt-4 ${section.id === 'contact' ? 'text-lg' : 'text-fluid-subtitle'}`}>{section.subtitle}</p>
                </FadeIn>
              )}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide py-10 min-h-0">
              {section.id === 'about' && section.items && (
                <ul role="list" className="grid grid-cols-1 gap-1">
                  {section.items.map((item, i) => <AboutRow key={i} item={item} index={i} />)}
                </ul>
              )}

              {section.id === 'contact' && (
                <div className="space-y-10">
                  <ul role="list" className="flex flex-col">
                    {[
                      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/mass3oudui/' },
                      { label: 'Dribbble', href: 'https://dribbble.com/ahmedmassoud' },
                      { label: 'WhatsApp', href: `https://wa.me/${section.whatsapp}` },
                    ].map((s) => (
                      <li key={s.label}>
                        <a
                          href={s.href}
                          target={s.href.startsWith('http') ? '_blank' : undefined}
                          rel={s.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className="group flex items-center justify-between py-8 border-b border-black/10 text-gray-900"
                        >
                          <span className="text-3xl md:text-4xl font-semibold tracking-tighter text-gray-900 group-hover:italic transition-all">{s.label}</span>
                          <ArrowRight className="w-6 h-6" style={{ color: '#FF4E00', transform: 'rotate(-45deg)' }} aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                  <div>
                    <p className="text-fluid-subtitle font-bold tracking-tighter text-gray-900">
                      <a href={`mailto:${section.email}`} className="hover:italic transition-all break-all">{section.email}</a>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
});

/* ─── Orange footer ──────────────────────────────────────────────────── */
const ROW1 = ['Riyadh Holding','Ministry of Media','PIF','Ejar','SEEC','SIB','MOI','Adam.ai','Tamara','Alinma Pay','Absher','Tawakkalna','Nifaz','Nafath'];
const ROW2 = ['Sinai.ai','Lisan.ai','arrw','GS1','Tremoloo','Anspire','Tawuniya','NEOM','stc pay','Tabby','Foodics','Lean','Sary','Mozn'];

const OrangeFooter: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref as React.RefObject<Element>, { threshold: 0.1, once: true });
  const footerRef = useRef<HTMLElement>(null);
  const [avatarOffset, setAvatarOffset] = useState({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;

    const onMove = (e: MouseEvent) => {
      const rect = footer.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // Map cursor offset → max ±8px
      targetRef.current = {
        x: ((e.clientX - cx) / (rect.width / 2)) * 8,
        y: ((e.clientY - cy) / (rect.height / 2)) * 8,
      };
    };

    // Smooth lerp loop so motion is buttery, not instant
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const tick = () => {
      currentRef.current.x = lerp(currentRef.current.x, targetRef.current.x, 0.08);
      currentRef.current.y = lerp(currentRef.current.y, targetRef.current.y, 0.08);
      setAvatarOffset({ x: currentRef.current.x, y: currentRef.current.y });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    footer.addEventListener('mousemove', onMove);
    return () => {
      footer.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <footer ref={footerRef} className="h-screen w-full relative flex flex-col overflow-hidden" style={{ backgroundColor: '#FF4E00' }}>
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center pt-16">
        <div
          ref={ref}
          className="anim-fade"
          style={visible ? { opacity: 1, transform: 'translateY(0) translateZ(0)' } : {}}
        >

          {/* Name + avatar layered block */}
          <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', width: 'clamp(400px, 70vw, 900px)' }}>

            {/* Big name — slightly bigger, width locked to photo width */}
            <h2
              className="font-display font-black uppercase text-white text-center w-full"
              style={{
                fontSize: '8.5rem',
                lineHeight: 0.82,
                letterSpacing: '-0.02em',
                marginBottom: 0,
                position: 'relative',
                zIndex: 0,
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>AHMED</span><br />
              MASSOUD
            </h2>

            {/* Avatar — cursor-parallax, floats centered, overlaps name */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: '-15%',
                left: '50%',
                width: 'clamp(400px, 70vw, 900px)',
                zIndex: 2,
                pointerEvents: 'none',
                transform: `translateX(calc(-50% + ${avatarOffset.x}px)) translateY(${avatarOffset.y}px) translateZ(0)`,
                willChange: 'transform',
              }}
            >
              <div style={{ position: 'relative' }}>
                <img
                  src="/footer-avatar.png"
                  alt=""
                  draggable={false}
                  style={{
                    width: '100%',
                    display: 'block',
                    mixBlendMode: 'screen',
                    userSelect: 'none',
                  }}
                />
                {/* Orange gradient fade at bottom — blends avatar into footer */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '50%',
                    background: 'linear-gradient(to top, #FF4E00 0%, transparent 100%)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>

          </div>{/* end name+avatar block */}

          {/* CTA below */}
          <div className="max-w-lg mx-auto mt-10">
            <p
              className="font-normal tracking-tight mb-8 text-white font-sans"
              style={{ fontSize: 'clamp(1.35rem, 2vw, 1.85rem)', lineHeight: 1.3 }}
            >
              Let's build something that looks great,<br />works flawlessly, and drives real results.
            </p>
            <a
              href="mailto:a7medmass3oud@gmail.com"
              className="inline-block px-10 py-5 bg-white rounded-full font-sans font-black tracking-widest text-sm"
              style={{ color: '#FF4E00', transition: 'transform 0.2s ease' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Start Collaboration
            </a>
          </div>

        </div>
      </div>

      {/* Footer bar — absolutely pinned so it's always visible */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.25)' }}
      >
        <p className="text-xs font-sans tracking-[0.05em]" style={{ color: 'rgba(255,255,255,0.9)' }}>© 2026 Ahmed Massoud</p>
        <nav aria-label="Social links">
          <ul role="list" className="flex gap-8">
            {[
              { name: 'LinkedIn', href: 'https://www.linkedin.com/in/mass3oudui/' },
              { name: 'Dribbble', href: 'https://dribbble.com/ahmedmassoud' },
            ].map(({ name, href }) => (
              <li key={name}><a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-sans font-bold tracking-[0.05em] text-white hover:underline">{name}</a></li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
};


/* ─── Loading screen ────────────────────────────────────────────────── */
const LoadingScreen: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const doneRef = useRef(false);

  const finish = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setProgress(100);
    setTimeout(() => {
      setFading(true);
      setTimeout(onDone, 600);
    }, 300);
  }, [onDone]);

  useEffect(() => {
    // Animate progress bar to ~85% while the real video (in HeroAboutVideo) loads
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 9 + 3;
      if (p >= 85) { p = 85; clearInterval(iv); }
      setProgress(Math.round(p));
    }, 120);

    // Listen for the event dispatched by HeroAboutVideo when canplaythrough fires
    const onReady = () => { clearInterval(iv); finish(); };
    window.addEventListener('portfolio-video-ready', onReady, { once: true });

    // Fallback: max 6 s (slow connection)
    const t = setTimeout(onReady, 6000);

    return () => { clearInterval(iv); clearTimeout(t); window.removeEventListener('portfolio-video-ready', onReady); };
  }, [finish]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: '#ffffff',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.6s ease',
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      <h1
        className="font-display font-black text-gray-900 uppercase text-center"
        style={{ fontSize: 'clamp(2.2rem, 6vw, 4rem)', lineHeight: 0.88, letterSpacing: '-0.02em', marginBottom: '3rem' }}
      >
        Ahmed<br />Massoud
      </h1>

      {/* Progress bar */}
      <div style={{ width: 180, height: 2, background: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%', background: '#FF4E00', borderRadius: 2,
            width: `${progress}%`, transition: 'width 0.14s ease',
          }}
        />
      </div>
      <p
        className="font-sans text-gray-400 text-xs mt-3"
        style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}
      >
        {progress < 100 ? 'Loading' : 'Ready'}
      </p>
    </div>
  );
};

/* ─── Mobile "better on desktop" bottom sheet ────────────────────────── */
const MobileDesktopPrompt: React.FC = () => {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="md:hidden fixed inset-0 z-[900] flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={() => setVisible(false)}
      />
      {/* Sheet */}
      <div
        className="relative w-full px-6 pt-5 pb-10 flex flex-col items-center text-center"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          borderRadius: '28px 28px 0 0',
          border: '1px solid rgba(255,255,255,0.5)',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.08)',
        }}
      >
        {/* Handle */}
        <div className="w-10 h-[3px] bg-gray-300 rounded-full mb-6" />

        {/* Monitor icon */}
        <div
          className="w-14 h-14 flex items-center justify-center rounded-2xl mb-4"
          style={{ background: 'rgba(255,78,0,0.08)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF4E00" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="13" rx="2" />
            <path d="M8 21h8M12 16v5" />
          </svg>
        </div>

        <h2 className="font-display font-black text-gray-900 uppercase mb-2" style={{ fontSize: '1.5rem', letterSpacing: '-0.01em' }}>
          Better on Desktop
        </h2>
        <p className="font-sans text-gray-500 text-sm leading-relaxed mb-8 max-w-xs">
          This portfolio is crafted for desktop. Open it on a laptop or desktop for the full experience.
        </p>

        <button
          onClick={() => setVisible(false)}
          className="w-full py-4 rounded-2xl font-sans font-medium text-sm text-gray-600"
          style={{ background: 'rgba(0,0,0,0.06)' }}
        >
          Continue Anyway
        </button>
      </div>
    </div>
  );
};

/* ─── App ────────────────────────────────────────────────────────────── */
export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState('hero');
  const scrollDirRef = useRef<'down' | 'up'>('down');
  const [appReady, setAppReady] = useState(false);
  const isMobile = useIsMobile();

  // Disable right-click and common devtools shortcuts
  useEffect(() => {
    const noContext = (e: MouseEvent) => e.preventDefault();
    const noKeys = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (
        e.key === 'F12' ||
        (ctrl && e.shiftKey && ['i','I','j','J','c','C'].includes(e.key)) ||
        (ctrl && ['u','U'].includes(e.key)) ||
        (e.metaKey && e.altKey && ['i','I'].includes(e.key))
      ) e.preventDefault();
    };
    document.addEventListener('contextmenu', noContext);
    document.addEventListener('keydown', noKeys);
    return () => {
      document.removeEventListener('contextmenu', noContext);
      document.removeEventListener('keydown', noKeys);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // All sections in scroll order: hero, about, projects, contact, footer
    const sectionIds = [...SECTIONS.map(s => s.id), 'footer-section'];
    let lastTop = container.scrollTop;

    const onScroll = () => {
      const cur = container.scrollTop;
      scrollDirRef.current = cur > lastTop ? 'down' : 'up';
      lastTop = cur;

      // Determine active section from scroll position (reliable with snap scrolling)
      const h = container.clientHeight;
      if (h > 0) {
        const idx = Math.min(Math.round(cur / h), sectionIds.length - 1);
        setActiveSection(sectionIds[idx]);
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);


  return (
    <div className="grain antialiased w-screen h-screen overflow-hidden bg-white">
      {!appReady && <LoadingScreen onDone={() => setAppReady(true)} />}
      <MobileDesktopPrompt />
      <a href="#hero" className="sr-only focus:not-sr-only fixed top-4 left-4 z-[200] bg-black text-white px-4 py-2 rounded-full font-bold">
        Skip to content
      </a>
      <div className="fixed top-0 left-0 w-full h-px bg-black/10 z-[110]" aria-hidden="true" />
      <div className="fixed bottom-0 left-0 w-full h-px bg-black/5 z-[110]" aria-hidden="true" />

      {isMobile
        ? <MobileVideoPanel activeSection={activeSection} />
        : <LeftVideoPanel activeSection={activeSection} scrollDirRef={scrollDirRef} />
      }
      <ScrollProgressBar containerRef={containerRef} />

      <header aria-label="Site header" className="fixed top-6 left-0 right-0 z-[100] flex justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.33, 1, 0.68, 1] }}
          className="hidden md:flex items-center gap-2"
        >
          <nav
            aria-label="Primary Navigation"
            className="flex items-stretch gap-1 px-[4px] py-[4px] h-12 rounded-[40px]"
            style={{
              background: 'rgba(255,255,255,0.4)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border: '1px solid rgba(209,211,214,0.5)',
            }}
          >
            {SECTIONS.map(s => {
              const active = activeSection === s.id;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`nav-pill-item relative px-4 flex items-center rounded-[32px] text-xs font-sans tracking-[0.05em] whitespace-nowrap capitalize ${active ? 'font-bold' : 'font-normal'} ${active ? 'flex' : 'hidden md:flex'}`}
                  style={{ color: active ? '#ffffff' : 'rgba(0,0,0,0.65)', zIndex: 0 }}
                  onClick={e => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }); }}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-[32px]"
                      style={{ backgroundColor: '#FF4E00', zIndex: -1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{s.id}</span>
                </a>
              );
            })}
          </nav>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            aria-label="Jump to contact section"
            className="cta-btn flex items-center gap-2 px-5 h-12 rounded-[40px] text-white font-sans text-xs tracking-[0.05em] font-normal"
            style={{
              background: '#FF4E00',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border: '1px solid rgba(255,110,50,0.45)',
            }}
            onClick={() => { window.location.href = 'mailto:a7medmass3oud@gmail.com'; }}
          >
            <span>Collaborate</span>
          </motion.button>
        </motion.div>
      </header>

      <main
        ref={containerRef}
        id="main-content"
        className="relative z-[1] h-screen overflow-y-auto scroll-smooth snap-y snap-mandatory scrollbar-hide"
      >
        {SECTIONS.map(s => <Section key={s.id} section={s} />)}
        <section id="footer-section" aria-label="Footer" className="w-full h-screen snap-start snap-always">
          <OrangeFooter />
        </section>
      </main>
    </div>
  );
}
