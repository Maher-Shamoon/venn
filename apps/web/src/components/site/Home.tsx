import { Hero, LiveBar } from "./Hero"
import { DarkPanel, FinalCta, Platform, PricingBand, Systems, TwoUp } from "./Sections"
import { Engine, Orbit, Roles, Trust } from "./Showcase"
import { FlowFilm, Statement, Steps, Voices } from "./Motion"

export function Home() {
  return (
    <main>
      <Hero />
      <LiveBar />
      <Statement />
      <Steps />
      <FlowFilm />
      <Platform />
      <Engine />
      <Systems />
      <DarkPanel />
      <Roles />
      <TwoUp />
      <Orbit />
      <Trust />
      <Voices />
      <PricingBand />
      <FinalCta />
    </main>
  )
}
