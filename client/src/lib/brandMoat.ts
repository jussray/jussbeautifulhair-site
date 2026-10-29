export type BrandMoatPillar = {
  id: "story" | "quality" | "care" | "proof";
  label: string;
  title: string;
  body: string;
};

export const BRAND_MOAT = {
  eyebrow: "The Crown Standard",
  heading: "Story. Quality. Care. Proof.",
  body:
    "Find a look that fits your next chapter, with clear product details, practical care guidance, and a way to reach us when you need help.",
  promise:
    "Lawless And Flawless should mean the story is honored, the facts are clear, care continues after checkout, and trust is earned one verified detail at a time.",
  pillars: [
    {
      id: "story",
      label: "Story",
      title: "Beauty can mark a chapter",
      body:
        "A new look can carry celebration, reset, confidence, or everyday expression. The brand makes room for that meaning without defining the person wearing it.",
    },
    {
      id: "quality",
      label: "Quality",
      title: "Facts before adjectives",
      body:
        "Compare materials, texture, length, available options, and care details on each product page before choosing your look.",
    },
    {
      id: "care",
      label: "Care",
      title: "Support is part of the product",
      body:
        "Customers should be able to understand fit, upkeep, policies, and how to reach support before and after checkout.",
    },
    {
      id: "proof",
      label: "Proof",
      title: "Trust needs receipts",
      body:
        "Check product details and policies before you buy. If a detail you need is missing, ask us before placing your order.",
    },
  ] satisfies BrandMoatPillar[],
};
