// Runtime feature flags — read from Vite env vars
// Set in .env.local (never committed — covered by *.local in .gitignore)

/** True only in DEV server AND VITE_TEST_MODE=true in .env.local.
 *  import.meta.env.DEV is false in production builds, so this is always
 *  false after `npm run build` regardless of .env.local contents. */
export const TEST_MODE = import.meta.env.DEV && import.meta.env.VITE_TEST_MODE === 'true';

/** True only when VITE_ENABLE_BEAM=true is set in .env.local */
export const ENABLE_BEAM = import.meta.env.VITE_ENABLE_BEAM === 'true';

/** When true, curbside orders are locked to PromptPay only (cash hidden).
 *  Change this single flag to re-enable cash for curbside. */
export const CURBSIDE_PROMPTPAY_ONLY = true;

/** When true, shows the "I'm here" arrival button on the curbside Track page.
 *  Keep false until the curbside arrival flow is implemented. */
export const CURBSIDE_ARRIVAL_ENABLED = false;
