import { ReactNode } from 'react';
import Navigation from './Navigation';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

const Layout = ({ children, className = '' }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-dark scientific-grid">
      <Navigation />
      <main className={`pt-16 ${className}`}>
        {children}
      </main>
    </div>
  );
};

export default Layout;