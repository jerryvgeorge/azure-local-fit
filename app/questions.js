// Scoring model:
// Each option has a `lean` from -2 (favors public Azure) to +2 (favors Azure Local).
// Each question has a `weight` (relative importance). Weighted sum is normalized to a
// -100..+100 "signal" score. See app.js for bucketing into a verdict.

const QUESTIONS = [
  {
    id: "connectivity",
    weight: 3,
    title: "How reliable is internet connectivity at the site(s)?",
    help: "Azure Local tolerates brief outages, but the case gets much stronger the less dependable the link is.",
    options: [
      { label: "Always-on, reliable high-speed connection", lean: -2 },
      { label: "Generally reliable, occasional short outages", lean: 0 },
      { label: "Frequently intermittent or slow", lean: 2 },
      { label: "No consistent internet -- often fully isolated", lean: 2 }
    ]
  },
  {
    id: "sovereignty",
    weight: 3,
    title: "How strict are the data residency or compliance requirements?",
    help: "Think regulated industries, government, or contractual data-locality clauses.",
    options: [
      { label: "None in particular", lean: -2 },
      { label: "Some -- general privacy best practice", lean: 0 },
      { label: "Strict -- data must stay within specific borders/premises", lean: 2 },
      { label: "Mandated disconnected or air-gapped operation", lean: 2 }
    ]
  },
  {
    id: "latency",
    weight: 3,
    title: "How latency-sensitive are the core workloads?",
    help: "Real-time control systems and transactional floors benefit most from local compute.",
    options: [
      { label: "Latency tolerant (web apps, batch jobs, reporting)", lean: -2 },
      { label: "Moderate -- noticeable but not mission-critical", lean: 0 },
      { label: "Critical -- real-time control, trading, or industrial automation", lean: 2 }
    ]
  },
  {
    id: "sites",
    weight: 2,
    title: "How many distributed sites need infrastructure?",
    help: "Azure Local shines when you need a standardized platform repeated across many edge locations.",
    options: [
      { label: "One centralized location", lean: -1 },
      { label: "A handful of branch sites", lean: 0 },
      { label: "Many distributed edge sites (factories, stores, clinics)", lean: 2 }
    ]
  },
  {
    id: "existing-infra",
    weight: 2,
    title: "What's the state of their existing infrastructure?",
    help: "Aging on-prem virtualization (especially VMware) nearing end-of-life is a classic Azure Local trigger.",
    options: [
      { label: "Already cloud-native, little to no on-prem footprint", lean: -1 },
      { label: "Modern virtualization, no urgent refresh need", lean: 0 },
      { label: "Aging on-prem gear or legacy VMware needing replacement", lean: 2 }
    ]
  },
  {
    id: "it-capability",
    weight: 2,
    title: "What IT operational capability exists on-site (or via a partner/MSP)?",
    help: "Azure Local still means real hardware -- firmware, lifecycle, physical maintenance -- someone has to own that.",
    options: [
      { label: "No IT staff or MSP support available at all", lean: -2 },
      { label: "Small IT team or a supporting MSP relationship", lean: 1 },
      { label: "Dedicated, capable infrastructure team", lean: 2 }
    ]
  },
  {
    id: "budget",
    weight: 2,
    title: "What's their preferred spending model?",
    help: "Azure Local requires validated hardware -- a CapEx layer on top of the usual Azure OpEx billing.",
    options: [
      { label: "Strongly prefers pure OpEx, no hardware ownership", lean: -2 },
      { label: "Open to a hybrid of CapEx and OpEx", lean: 1 },
      { label: "Already planning a hardware refresh cycle", lean: 2 }
    ]
  },
  {
    id: "elasticity",
    weight: 3,
    title: "How much do workloads need global elasticity or the broad Azure PaaS catalog?",
    help: "If they need to burst globally or lean on many first-party Azure services, public cloud still wins.",
    options: [
      { label: "Frequently -- needs to scale globally and use many PaaS services", lean: -2 },
      { label: "Occasionally -- mostly stable, predictable demand", lean: 1 },
      { label: "Rarely -- workload is fixed and local by nature (edge/IoT/control)", lean: 2 }
    ]
  }
];
