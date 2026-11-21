export type Deliverable = "IG Collab Reel" | "TikTok Post" | "Pure UGC";
export type CampaignStatus = "Outreach" | "Negotiating" | "Address Received" | "Package Shipped" | "Content Pending" | "Completed";
export type PaymentStatus = "Pending" | "Paid via Zelle";

export type Creator = {
  id: string; name: string; handle: string; platform: "Instagram" | "TikTok"; followers: number; profileUrl: string;
  deliverable: Deliverable; status: CampaignStatus; rate: number; payment: PaymentStatus; zelle: string;
  address: string; tracking: string; contents: string; assetUrl?: string; concept: string; date: string;
};
