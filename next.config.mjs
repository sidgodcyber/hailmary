/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We deliberately do not wire ESLint into the build for v1 (fewer moving parts,
  // no lint-config churn). Type safety is enforced via `npm run typecheck`.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
