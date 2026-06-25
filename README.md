This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Signed macOS releases

Public macOS builds require a `Developer ID Application` certificate and Apple notarization credentials. An `Apple Development` certificate is not valid for distribution.

For a local release, either install the Developer ID certificate and its private key in the login keychain, or set `CSC_LINK` to a `.p12` path and `CSC_KEY_PASSWORD` to its password. The release script automatically loads the ignored `.env.signing.local` file when present. Then provide one notarization credential set:

```bash
# Preferred: App Store Connect API key
export APPLE_API_KEY="$HOME/private_keys/AuthKey_KEYID.p8"
export APPLE_API_KEY_ID="KEYID"
export APPLE_API_ISSUER="ISSUER_UUID"

# Or: Apple ID credentials
export APPLE_ID="developer@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ABCDE12345"

npm run electron:release:mac
```

The release command refuses to continue without Developer ID signing, verifies the complete app bundle, submits it to Apple, staples the ticket, runs Gatekeeper assessment, and only then creates the DMG and ZIP.

GitHub Actions uses the same checks. Configure `CSC_LINK` and `CSC_KEY_PASSWORD` in the `Production` environment, plus either `APPLE_API_KEY_BASE64`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`, or the three Apple ID secrets above. `CSC_LINK` must contain a base64-encoded `.p12` exported with the private key and the `Developer ID Application` certificate—not an `Apple Development` certificate.
