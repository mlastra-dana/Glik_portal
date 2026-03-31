import { PropsWithChildren } from 'react';
import Footer from './Footer';
import Header from './Header';

const MainLayout = ({ children }: PropsWithChildren) => {
  return (
    <div className="flex min-h-screen flex-col bg-glik-primary">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
};

export default MainLayout;
