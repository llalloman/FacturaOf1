import LandingHeader from './components/LandingHeader';
import HeroSection from './components/HeroSection';
import FeaturesSection from './components/FeaturesSection';
import ForWhoSection from './components/ForWhoSection';
import PricingSection from './components/PricingSection';
import CtaDemoSection from './components/CtaDemoSection';
import TrustSection from './components/TrustSection';
import LandingFooter from './components/LandingFooter';

export default function LandingPage() {
  return (
    <div className="min-h-screen font-sans antialiased">
      <LandingHeader />
      <main>
        <HeroSection />
        <FeaturesSection />
        <ForWhoSection />
        <PricingSection />
        <CtaDemoSection />
        <TrustSection />
      </main>
      <LandingFooter />
    </div>
  );
}
