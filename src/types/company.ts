export interface PriceIndexPoint {
  id: string;
  material_category: string;
  fred_series_id: string;
  date: string;
  index_value: number;
  related_event_id: string | null;
  notes: string | null;
}

export type ContactCompanyType =
  | "church"
  | "hotel"
  | "apartment"
  | "office"
  | "mixed_use"
  | "contractor"
  | "restoration_company"
  | "property_management";

export type TargetCompany = "supplyx" | "interserv" | "insurance_claims" | "all";
export type ContactStatus = "not_contacted" | "contacted" | "engaged" | "referred" | "closed";

export interface EventContact {
  id: string;
  event_id: string;
  company_type: ContactCompanyType;
  name: string;
  address: string | null;
  state: string | null;
  city: string | null;
  county: string | null;
  lat: number | null;
  lng: number | null;
  google_place_id: string | null;
  target_company: TargetCompany;
  status: ContactStatus;
  notes: string | null;
}

export interface ReferralPartner {
  id: string;
  firm_name: string;
  states: string[];
  specialties: string[];
  contact_info: string | null;
  referral_permitted: boolean | null;
  notes: string | null;
}

export interface EventReferral {
  id: string;
  event_id: string;
  referral_partner_id: string;
  status: ContactStatus;
  notes: string | null;
}

export interface StateRegulatoryInfo {
  state_code: string;
  referral_fee_permitted: "yes" | "no" | "restricted" | null;
  referral_fee_note: string | null;
  statute_of_limitations_years: number | null;
  statute_of_limitations_note: string | null;
  doi_contact: string | null;
}
