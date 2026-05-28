import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface HorizontalParallaxRevealProps {
  children: React.ReactNode;
  className?: string;
  index?: number; // Used to determine if even or odd (left or right entrance)
  staggerChildren?: boolean; // Whether to stagger internal children
}

const HorizontalParallaxReveal: React.FC<HorizontalParallaxRevealProps> = ({ 
  children, 
  className = '', 
  index = 0,
  staggerChildren = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const triggerEl = containerRef.current;
    const animateEl = wrapperRef.current;
    if (!triggerEl || !animateEl) return;

    // Determine direction based on index (even = right, odd = left)
    // Left entrance means it starts from x: -100 and goes to x: 0
    // Right entrance means it starts from x: 100 and goes to x: 0
    const isEven = index % 2 === 0;
    const initialX = isEven ? 100 : -100;
    const initialRotation = isEven ? 5 : -5; // Slight rotation depending on side

    // Setup elements to animate
    let elementsToAnimate: HTMLElement | HTMLElement[] = animateEl;

    if (staggerChildren) {
      // Find children that are direct descendants of the wrapper
      const children = animateEl.children;
      if (children.length > 0) {
        elementsToAnimate = Array.from(children) as HTMLElement[];
      }
    }

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: triggerEl,
        start: 'top 90%', // Starts animating when the top of the element hits 90% down the viewport
        end: 'top 40%',   // Ends animating when the top hits 40% down the viewport
        scrub: true,      // Links animation progress to scroll position directly
      }
    });

    // Animate from state
    tl.fromTo(elementsToAnimate, 
      { 
        x: initialX, 
        opacity: 0, 
        rotation: initialRotation 
      },
      { 
        x: 0, 
        opacity: 1, 
        rotation: 0, 
        ease: 'power2.out', 
        stagger: staggerChildren ? 0.1 : 0 
      }
    );

    return () => {
      tl.kill();
      ScrollTrigger.getAll().forEach(t => {
        if (t.vars.trigger === triggerEl) t.kill();
      });
    };
  }, [index, staggerChildren]);

  return (
    <div ref={containerRef} className={`page-animate-item will-change-transform ${className}`}>
      <div ref={wrapperRef} className="will-change-transform w-full h-full">
        {children}
      </div>
    </div>
  );
};

export default HorizontalParallaxReveal;
