import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import HeroSection from "@/features/landing/HeroSection";
import BiographySection from "@/features/landing/BiographySection";
import SpecializationsSection from "@/features/landing/SpecializationsSection";
//import ConsultingSection from "@/features/landing/ConsultingSection";
import InteractiveShell from "@/features/booking/InteractiveShell";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "#131315", position: "relative", zIndex: 1 }}
        >
          <Spinner />
        </div>
      }
    >
      <Navbar />

      <main style={{ position: "relative", zIndex: 1 }}>
        <div
          className="landing-column"
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          <HeroSection />
          <BiographySection />
          <SpecializationsSection />

          <InteractiveShell />

          {/*
            <div
              style={{
                height: 1,
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
                margin: "64px 0",
              }}
            />

            <ConsultingSection /> 
          */}
        </div>

        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>
      </main>

      <Footer />
    </Suspense>
  );
}
