import { MarketingNav } from "./_components/marketing-nav";
import { Access } from "./_components/landing/access";
import { Capabilities } from "./_components/landing/capabilities";
import { FinalCta, Footer } from "./_components/landing/cta-footer";
import { Formats } from "./_components/landing/formats";
import { Hero } from "./_components/landing/hero";
import { HowItWorks } from "./_components/landing/how-it-works";
import { ModelsDeploy } from "./_components/landing/models-deploy";
import { Reliability } from "./_components/landing/reliability";

export default function LandingPage() {
  return (
    <div className="text-fg">
      <MarketingNav />
      <Hero />
      <Capabilities />
      <Formats />
      <Access />
      <Reliability />
      <ModelsDeploy />
      <HowItWorks />
      <FinalCta />
      <Footer />
    </div>
  );
}
