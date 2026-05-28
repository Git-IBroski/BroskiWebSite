import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTransition } from '../context/TransitionContext';

interface TransitionLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: React.ReactNode;
}

const TransitionLink: React.FC<TransitionLinkProps> = ({ to, children, onClick, ...props }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { playExitAnimation } = useTransition();

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (onClick) onClick(e);

    // If already on the same page, do nothing
    if (location.pathname === to) return;

    // Play the exit animation
    await playExitAnimation();

    // Then navigate
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} {...props}>
      {children}
    </a>
  );
};

export default TransitionLink;
