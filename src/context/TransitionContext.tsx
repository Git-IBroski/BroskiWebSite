/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useRef } from 'react';

interface TransitionContextType {
  registerExitAnimation: (anim: () => Promise<void>) => void;
  playExitAnimation: () => Promise<void>;
}

const TransitionContext = createContext<TransitionContextType | null>(null);

export const TransitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const exitAnimationRef = useRef<() => Promise<void>>(async () => {});

  const registerExitAnimation = (anim: () => Promise<void>) => {
    exitAnimationRef.current = anim;
  };

  const playExitAnimation = async () => {
    if (exitAnimationRef.current) {
      await exitAnimationRef.current();
    }
  };

  return (
    <TransitionContext.Provider value={{ registerExitAnimation, playExitAnimation }}>
      {children}
    </TransitionContext.Provider>
  );
};

// Custom hook per utilizzare la timeline di transizione
export function useTransition() {
  const context = useContext(TransitionContext);
  if (!context) {
    throw new Error('useTransition deve essere usato all\'interno di un TransitionProvider');
  }
  return context;
}
