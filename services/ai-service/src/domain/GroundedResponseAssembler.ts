/**
 * GroundedResponseAssembler — WO-060: Grounded response assembly with offer provenance tags.
 *
 * Ensures AI responses are grounded in real offers:
 * - Extracts offer references from LLM output
 * - Validates each referenced offer exists and is bookable
 * - Attaches provenance metadata to offer citations
 * - Strips any hallucinated offers (not in the offer index)
 */

import { isBookableProvenance } from "@travel/contracts/provenance";

export interface OfferCitation {
  offerId: string;
  provenance: string;
  title: string;
  price: number;
  currency: string;
  bookable: boolean;
}

export interface GroundedResponse {
  text: string;
  citations: OfferCitation[];
  hallucinationsStripped: number;
}

export interface OfferIndexPort {
  lookup(offerId: string): Promise<OfferCitation | null>;
}

const OFFER_REF_PATTERN = /\[OFFER:([a-zA-Z0-9_-]+)\]/g;

export class GroundedResponseAssembler {
  constructor(private readonly offerIndex: OfferIndexPort) {}

  async assemble(rawText: string): Promise<GroundedResponse> {
    const offerIds = new Set<string>();
    for (const match of rawText.matchAll(OFFER_REF_PATTERN)) {
      offerIds.add(match[1]!);
    }

    const citations: OfferCitation[] = [];
    let hallucinationsStripped = 0;
    let text = rawText;

    for (const offerId of offerIds) {
      const offer = await this.offerIndex.lookup(offerId);
      if (!offer) {
        // Strip hallucinated reference from text
        text = text.replace(new RegExp(`\\[OFFER:${offerId}\\]`, "g"), "[unavailable offer]");
        hallucinationsStripped++;
      } else {
        citations.push({
          ...offer,
          bookable: isBookableProvenance(offer.provenance),
        });
      }
    }

    return { text, citations, hallucinationsStripped };
  }
}
