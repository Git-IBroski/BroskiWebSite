import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Forza lo scroll in cima alla pagina ogni volta che cambia il percorso
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
