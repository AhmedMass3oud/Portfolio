import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { SECTIONS } from './constants';
import { AboutVideoBackground } from './components/AboutTransition';

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

const SECTION_VIDEOS: Record<string, string> = {
  hero: '/hero.mp4',
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

/* ─── Video panel ──────────────────────────────────────────────────── */
const SectionVideo = React.memo<{ src: string; isActive: boolean }>(({ src, isActive }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Perfect seamless loop — seek manually 0.15s before end instead of relying
  // on the browser's native loop which has a small compositor gap in Chromium.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onTimeUpdate = () => {
      if (v.duration && v.currentTime >= v.duration - 0.15) {
        v.currentTime = 0;
      }
    };
    v.addEventListener('timeupdate', onTimeUpdate);
    return () => v.removeEventListener('timeupdate', onTimeUpdate);
  }, []);

  useLayoutEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (isActive) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
      timerRef.current = setTimeout(() => { if (v) v.currentTime = 0; }, 80);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isActive]);

  return (
    <video
      ref={ref}
      src={src}
      muted playsInline preload="auto"
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', objectPosition: 'center',
        opacity: isActive ? 1 : 0,
        transition: isActive ? 'opacity 0.18s ease' : 'opacity 0.08s ease',
        willChange: 'opacity',
        transform: 'translateZ(0)',
      }}
    />
  );
});

const LeftVideoPanel = React.memo<{
  activeSection: string;
  scrollDirRef: React.MutableRefObject<'down' | 'up'>;
}>(({ activeSection, scrollDirRef }) => (
  <div className="fixed inset-0 z-0 overflow-hidden bg-black" aria-hidden="true">
    {Object.entries(SECTION_VIDEOS).map(([id, src]) => (
      <SectionVideo key={id} src={src} isActive={activeSection === id} />
    ))}
    <AboutVideoBackground isActive={activeSection === 'about'} scrollDirRef={scrollDirRef} />
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
  const [copied, setCopied] = useState(false);
  const email = section.email ?? 'a7medmass3oud@gmail.com';
  const handleCopy = () => {
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <InteractiveTitle text={section.title} isHero />
      <div className="flex flex-col gap-3 max-w-2xl">
        <FadeIn delay={0.35}><p className="text-fluid-subtitle text-gray-600 font-light leading-tight">{section.subtitle}</p></FadeIn>
        {section.description && (
          <FadeIn delay={0.2}><p className="text-xl font-light text-gray-600 leading-relaxed">{section.description}</p></FadeIn>
        )}
        <FadeIn delay={0.45}>
          <button
            type="button"
            onClick={handleCopy}
            aria-live="polite"
            aria-label="Copy Email"
            style={{
              fontFamily: '"Almarai", var(--font-sans, "Space Grotesk")',
              fontWeight: 500, fontSize: '16px', lineHeight: '1em',
              display: 'inline-flex', position: 'relative',
              placeItems: 'center', placeContent: 'center',
              whiteSpace: 'nowrap', backgroundColor: '#ffffff', color: '#FF4E00',
              borderRadius: '50px', padding: '14px 24px',
              border: '1px solid rgba(0,0,0,0.15)', cursor: 'pointer', userSelect: 'none',
              transition: 'transform 0.18s ease, background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease',
            }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.transform = 'scale(1.04)'; b.style.backgroundColor = '#FF4E00'; b.style.color = '#ffffff'; b.style.borderColor = 'rgba(255,255,255,0.5)'; }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.transform = 'scale(1)'; b.style.backgroundColor = '#ffffff'; b.style.color = '#FF4E00'; b.style.borderColor = 'rgba(0,0,0,0.15)'; }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1.04)')}
          >
            <span aria-hidden="true" style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none' }}>Copy Email</span>
            <span style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
              <span style={{ gridArea: '1/1', whiteSpace: 'nowrap', opacity: copied ? 0 : 1, transition: 'opacity 0.2s ease' }}>Copy Email</span>
              <span aria-hidden="true" style={{ gridArea: '1/1', whiteSpace: 'nowrap', opacity: copied ? 1 : 0, transition: 'opacity 0.2s ease' }}>Copied!</span>
            </span>
          </button>
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
    const AUTO_SPEED = 0.6;
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
      <div className="shrink-0 pt-28 pb-6 px-8 md:px-12">
        <FadeIn>
          <h2
            className="font-display font-black uppercase whitespace-nowrap text-gray-900"
            style={{ fontSize: 'clamp(1.25rem, 2.5vw, 2.25rem)', lineHeight: 1, letterSpacing: '-0.01em' }}
          >
            Featured <span style={{ color: '#FF4E00' }}>Projects</span>
          </h2>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className="text-sm font-mono text-gray-400 tracking-[0.05em] mt-3">{section.subtitle}</p>
        </FadeIn>
      </div>

      <div className="flex-1 relative min-h-0">
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
          <div className="flex gap-6 h-full w-max py-6 px-8">
            {projects.map((p, i) => (
              <div
                key={i}
                className="project-card-flat group flex-shrink-0 h-full flex flex-col bg-white border border-gray-100 rounded-[28px] overflow-hidden"
                style={{ width: 'calc((100vw - 4rem - 1.5rem) / 1.7)', pointerEvents: 'none' }}
              >
                <div className="flex-1 overflow-hidden bg-gray-100 min-h-0">
                  {p.video ? (
                    <video src={p.video} autoPlay loop muted playsInline preload="metadata" className="w-full h-full object-cover" />
                  ) : (
                    <img src={p.image} alt={p.name} loading="lazy" decoding="async" draggable={false} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="shrink-0 p-6 flex flex-col gap-1">
                  <span className="text-[11px] font-mono text-gray-400 tracking-[0.05em]">{p.category}</span>
                  <h3 className="font-display font-black text-gray-900 text-lg leading-tight">{p.name}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
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
      className="anim-fade group flex items-center gap-12 py-8 border-b border-black/[0.05] last:border-0 px-4 -mx-4"
      style={{
        transitionDelay: `${0.06 * index}s`,
        ...(visible ? { opacity: 1, transform: 'translateY(0) translateZ(0)' } : {}),
      }}
    >
      <div className="flex-1 flex flex-col gap-2">
        {item.logo
          ? <img src={item.logo} alt={item.company} className="h-10 w-auto object-contain object-left" draggable={false} />
          : <p className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{item.company}</p>
        }
        <p className="text-gray-500 font-mono text-xs tracking-[0.05em]">{item.role}</p>
      </div>
      <span className="font-mono text-xs text-gray-500 shrink-0">{item.period}</span>
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
      className="h-screen w-full flex snap-start snap-always"
      style={{ position: 'relative' }}
    >
      {section.id === 'contact' && (
        <video
          src="https://d8j0ntlcm91z4.cloudfront.net/user_2zvTR2NOoUjz8SC8aobXQUJkAIB/hf_20260423_205014_a0d40d02-37ca-462a-9f5b-b7f789e2515f.mp4"
          autoPlay loop muted playsInline preload="auto"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
        />
      )}
      <div
        className={`relative z-[1] flex flex-col overflow-hidden ${
          isHero ? 'w-full justify-center px-10 md:px-20' : 'px-8 md:px-12'
        }`}
        style={!isHero ? { width: section.id === 'contact' ? '52%' : '50%' } : undefined}
      >
        {isHero ? (
          <HeroContent section={section} />
        ) : (
          <>
            <div className="shrink-0 pt-28 pb-6 border-b border-black/5">
              <InteractiveTitle text={section.title} isHero={false} />
              {section.subtitle && (
                <FadeIn delay={0.2}>
                  <p className="text-fluid-subtitle text-gray-600 font-light leading-tight mt-4">{section.subtitle}</p>
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
                      { label: 'LinkedIn', href: '#' },
                      { label: 'Dribbble', href: '#' },
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
                    <div className="h-px w-full bg-black/10 mt-6" />
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
      // Map cursor offset → max ±2px
      targetRef.current = {
        x: ((e.clientX - cx) / (rect.width / 2)) * 2,
        y: ((e.clientY - cy) / (rect.height / 2)) * 2,
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
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center pt-16">
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
            <p className="font-light tracking-tight mb-8 text-white font-sans" style={{ fontSize: '32px', lineHeight: 1.2 }}>
              Let's build something that looks great,<br />works flawlessly, and drives real results.
            </p>
            <a
              href="#contact"
              className="inline-block px-10 py-5 bg-white rounded-full font-black tracking-widest text-sm"
              style={{ color: '#FF4E00', transition: 'transform 0.2s ease' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              onClick={e => { e.preventDefault(); document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }); }}
            >
              Start Collaboration
            </a>
          </div>

        </div>
      </div>

      {/* Footer bar — absolutely pinned so it's always visible */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.25)' }}
      >
        <p className="text-xs font-mono tracking-[0.05em]" style={{ color: 'rgba(255,255,255,0.9)' }}>© 2026 Ahmed Massoud</p>
        <nav aria-label="Social links">
          <ul role="list" className="flex gap-8">
            {['LinkedIn', 'Dribbble', 'Behance'].map(name => (
              <li key={name}><a href="#" className="text-xs font-mono font-bold tracking-[0.05em] text-white hover:underline">{name}</a></li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
};

/* ─── App ────────────────────────────────────────────────────────────── */
export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState('hero');
  const scrollDirRef = useRef<'down' | 'up'>('down');

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); }),
      { root: containerRef.current, rootMargin: '-25% 0px -25% 0px', threshold: 0 }
    );
    SECTIONS.forEach(s => { const el = document.getElementById(s.id); if (el) observer.observe(el); });

    const container = containerRef.current;
    let lastTop = container?.scrollTop ?? 0;
    const onScroll = () => {
      const cur = container?.scrollTop ?? 0;
      scrollDirRef.current = cur > lastTop ? 'down' : 'up';
      lastTop = cur;
    };
    container?.addEventListener('scroll', onScroll, { passive: true });
    return () => { observer.disconnect(); container?.removeEventListener('scroll', onScroll); };
  }, []);


  return (
    <div className="selection:bg-black selection:text-white grain antialiased">
      <a href="#hero" className="sr-only focus:not-sr-only fixed top-4 left-4 z-[200] bg-black text-white px-4 py-2 rounded-full font-bold">
        Skip to content
      </a>
      <div className="fixed top-0 left-0 w-full h-px bg-black/10 z-[110]" aria-hidden="true" />
      <div className="fixed bottom-0 left-0 w-full h-px bg-black/5 z-[110]" aria-hidden="true" />

      <LeftVideoPanel activeSection={activeSection} scrollDirRef={scrollDirRef} />

      <header aria-label="Site header" className="fixed top-6 left-0 right-0 z-[100] flex justify-center px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.33, 1, 0.68, 1] }}
          className="flex items-center gap-2"
        >
          <nav
            aria-label="Primary Navigation"
            className="flex items-center gap-1 px-2 h-12 rounded-[40px]"
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
                  className="nav-pill-item px-4 h-8 flex items-center rounded-[32px] text-xs font-mono font-bold tracking-[0.05em] whitespace-nowrap capitalize"
                  style={{
                    color: active ? '#ffffff' : 'rgba(0,0,0,0.65)',
                    backgroundColor: active ? '#FF4E00' : 'transparent',
                  }}
                  onClick={e => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }); }}
                >
                  {s.id}
                </a>
              );
            })}
          </nav>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            aria-label="Jump to contact section"
            className="cta-btn flex items-center gap-2 px-5 h-12 rounded-[40px] text-white font-mono text-xs tracking-[0.05em] font-black"
            style={{
              background: 'rgba(255,78,0,0.88)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border: '1px solid rgba(255,110,50,0.45)',
            }}
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
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
