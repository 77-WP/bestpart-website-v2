// All external URLs — set to null while placeholder, real URL string when live.
// Setting a value from null → URL string makes its button appear automatically.

export const LINKS: {
  grab:         string | null;
  lineman:      string | null;
  shopeeFood:   string | null;
  googleMaps:   string | null;
  line:         string | null;
  facebook:     string | null;
  googleReview: string | null;
} = {
  grab:         null,  // TODO: Grab Food deep link for this branch
  lineman:      null,  // TODO: LINE MAN deep link for this branch
  shopeeFood:   null,  // TODO: Shopee Food deep link for this branch
  googleMaps:   null,  // TODO: Google Maps pin for Thonglor Soi 13
  line:         null,  // TODO: LINE OA link
  facebook:     null,  // TODO: Facebook page URL
  googleReview: null,  // TODO: Google review link
};
