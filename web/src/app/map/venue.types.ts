import { vendorKinds, vendorTiers, venueAreaKindDisplay, venueAreaKinds } from './venue.constants';

export type VenueAreaKind = (typeof venueAreaKinds)[number];

export type VendorKind = (typeof vendorKinds)[number];

export type VendorTier = (typeof vendorTiers)[number];

export type VenueAreaPattern = (typeof venueAreaKindDisplay)[VenueAreaKind]['pattern'];

export type VenueMapViewMode = 'map' | 'list';

export type MapPinKind = 'you' | 'quest';
