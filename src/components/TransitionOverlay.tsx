import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TransitionOverlayProps {
  activeSection: string;
}

const VIDEO_GENERIC = "https://d8j0ntlcm91z4.cloudfront.net/user_2zvTR2NOoUjz8SC8aobXQUJkAIB/hf_20260422_210850_afbd23fc-ad87-4641-86b5-3b445dce5521.mp4";

export const TransitionOverlay: React.FC<TransitionOverlayProps> = ({ activeSection }) => {
  const [show, setShow] = useState(false);
  const [videoSrc, setVideoSrc] = useState(VIDEO_GENERIC);
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevSectionRef = useRef(activeSection);

  useEffect(() => {
    if (prevSectionRef.current !== activeSection) {
      const from = prevSectionRef.current;
      const to = activeSection;
      prevSectionRef.current = activeSection;

      // About section transitions are handled by AboutTransition
      if (from === 'about' || to === 'about') return;

      setVideoSrc(VIDEO_GENERIC);
      setShow(true);

      const timer = setTimeout(() => setShow(false), 500);
      return () => clearTimeout(timer);
    }
  }, [activeSection]);

  useEffect(() => {
    if (show && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [show, videoSrc]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="fixed inset-0 z-[1000] overflow-hidden pointer-events-none"
        >
          <video
            ref={videoRef}
            src={videoSrc}
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
