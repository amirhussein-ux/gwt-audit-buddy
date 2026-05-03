import { motion, useReducedMotion } from 'framer-motion';

interface LogoSplashProps {
  size?: number;
  className?: string;
  onComplete?: () => void;
}

export default function LogoSplash({
  size = 320,
  className = '',
  onComplete,
}: LogoSplashProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-[#F7F7F7] ${className}`}
    >
      {/* soft ambient glow */}
      <motion.div
        className="absolute w-72 h-72 rounded-full bg-blue-100 blur-3xl opacity-40"
        animate={
          reducedMotion
            ? { opacity: 0.3 }
            : {
                scale: [0.95, 1.05, 1],
                opacity: [0.25, 0.4, 0.3],
              }
        }
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.img
        src="/bluetsekify.png"
        alt="TSEKIFY"
        style={{ width: size }}
        initial={
          reducedMotion
            ? false
            : {
                opacity: 0,
                scale: 0.9,
                y: 8,
              }
        }
        animate={
          reducedMotion
            ? {
                opacity: 1,
                scale: 1,
              }
            : {
                opacity: [0, 1, 1, 0],
                scale: [0.9, 1, 1.02, 1],
                y: [8, 0, 0, -4],
              }
        }
        transition={
          reducedMotion
            ? undefined
            : {
                duration: 3.4,
                times: [0, 0.25, 0.75, 1],
                ease: 'easeInOut',
            }
        }
        onAnimationComplete={onComplete}
        className="relative z-10 select-none"
        draggable={false}
      />
    </div>
  );
}