// Runtime feature flags — read from Vite env vars
// Set in .env.local (never committed — covered by *.local in .gitignore)

/** True only when VITE_TEST_MODE=true is set in .env.local */
export const TEST_MODE = import.meta.env.VITE_TEST_MODE === 'true';
