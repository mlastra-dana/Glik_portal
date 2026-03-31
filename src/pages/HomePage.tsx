import BenefitsSection from '../components/ui/BenefitsSection';
import FAQSection from '../components/ui/FAQSection';
import HeroSection from '../components/ui/HeroSection';
import HowItWorksSection from '../components/ui/HowItWorksSection';

const HomePage = () => {
  return (
    <>
      <HeroSection />
      <BenefitsSection />
      <HowItWorksSection />
      <FAQSection />
    </>
  );
};

export default HomePage;
