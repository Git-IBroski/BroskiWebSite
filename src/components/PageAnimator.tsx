import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useTransition } from '../context/TransitionContext';

interface PageAnimatorProps {
  children: React.ReactNode;
  className?: string;
}

const PageAnimator: React.FC<PageAnimatorProps> = ({ children, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { registerExitAnimation } = useTransition();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Simple fade in
    gsap.set(el, { opacity: 0 });
    
    const enterAnimation = gsap.to(el, {
      opacity: 1,
      duration: 0.4,
      ease: 'power2.out',
    });

    // Register exit animation - simple fade out
    registerExitAnimation(() => {
      return new Promise<void>((resolve) => {
        gsap.to(el, {
          opacity: 0,
          duration: 0.3,
          ease: 'power2.in',
          onComplete: resolve,
        });
      });
    });

    return () => {
      enterAnimation.kill();
    };
  }, [registerExitAnimation]);

  return (
    <div ref={containerRef} className={`w-full ${className}`}>
      {children}
    </div>
  );
};

export default PageAnimator;
