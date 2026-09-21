/**
 * A small SI and draft BL for the "Use example documents" button. Written in the same layout as the
 * organisers' sample files, with two deliberate differences (consignee and gross weight) so the
 * comparison has something to find.
 */
const SI_TEXT = `SHIPPING INSTRUCTION
========================================

Shipper: PACIFIC FINE PAPER LTD
  88 MARINA BOULEVARD; SINGAPORE 018983
Consignee (Non-Negotiable): NORTHWIND TRADING GMBH
  HAFENSTRASSE 12; 20457 HAMBURG, GERMANY
Notify: NORTHWIND LOGISTICS
Port of Loading (POL): SINGAPORE (SGSIN)
POD: HAMBURG, GERMANY (DEHAM)
Total Containers: 3 x 40'HC
Gross Wt (kgs): 71,240 KG
Vessel: EVER ACME V.211W
Booking Ref: 4471
Freight: PREPAID
`;

const BL_TEXT = `BILL OF LADING (DRAFT)
========================================

SHIPPER: PACIFIC FINE PAPER LTD
  88 MARINA BOULEVARD; SINGAPORE 018983
To the Order of: HANSEATIC IMPORTS GMBH
  HAFENSTRASSE 12; 20457 HAMBURG, GERMANY
Notify Party: NORTHWIND LOGISTICS
Port of Loading (POL): SINGAPORE (SGSIN)
POD: HAMBURG, GERMANY (DEHAM)
Container Count: 3 x 40'HC
Gross Weight (KG): 74,120 KG
Export Carrier (vessel, voyage): EVER ACME V.211W
Booking Ref: 4471
Freight: PREPAID
`;

export const EXAMPLE_SUBJECT = "Please check draft BL for booking 4471";
export const EXAMPLE_BODY = "Hi, attached are the SI and the draft BL for booking 4471. Please check the details and confirm.";

export function exampleFiles(): { si: File; bl: File } {
  return {
    si: new File([SI_TEXT], "example_SI.txt", { type: "text/plain" }),
    bl: new File([BL_TEXT], "example_BL.txt", { type: "text/plain" }),
  };
}
