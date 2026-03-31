import { PropsWithChildren } from 'react';
import Footer from './Footer';
import Header from './Header';

const MainLayout = ({ children }: PropsWithChildren) => {
  return (
    <div className="flex min-h-screen flex-col bg-[#2A1460]">
      <Header />
      <main className="flex-1 bg-gradient-to-b from-[#2A1460] via-[#4A2D8F] to-[#5E49A7]">{children}</main>
      <Footer />
    </div>
  );
};

export default MainLayout;
