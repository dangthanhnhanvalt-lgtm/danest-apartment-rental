import { Hero } from "~/components/home/hero";
import { TrustSection } from "~/components/home/trust";
import { FeaturedApartments } from "~/components/home/featured";
import { NeighborhoodsSection } from "~/components/home/neighbourhoods";
import { HowItWorksSection } from "~/components/home/how-it-works";
import { LandlordCtaSection } from "~/components/home/landlord-cta";

export function HomePage() {
  return (
    <main className="danest-public-home danest-public-surface">
      <Hero />
      <TrustSection />
      <FeaturedApartments />
      <NeighborhoodsSection />
      <HowItWorksSection />
      <LandlordCtaSection />
    </main>
  );
}
