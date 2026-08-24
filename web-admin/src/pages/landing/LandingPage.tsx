import LandingHeader from './components/LandingHeader';
import HeroSection from './components/HeroSection';
import FeaturesSection from './components/FeaturesSection';
import FirmadorSection from './components/FirmadorSection';
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
        <FirmadorSection />
        <ForWhoSection />
        <PricingSection />
        <CtaDemoSection />
        <TrustSection />
      </main>
      <LandingFooter />
    </div>
  );
}
