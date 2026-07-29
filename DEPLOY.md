# Nivasa — Deployment Guide

## Prerequisites
- GitHub account with the nivasa repo pushed
- Vercel account (free tier works)
- Firebase project (nivasa-d0f78) already set up
- (Optional) Gemini API key for vision meter scanning

## Step 1: Push to GitHub
```bash
cd nivasa
git add .
git commit -m "Ready for deployment"
git push origin main
```

## Step 2: Import to Vercel
1. Go to https://vercel.com/new
2. Import your `nivasa` GitHub repo
3. Framework: **Vite** (auto-detected)
4. Build command: `npm run build`
5. Output directory: `dist`

## Step 3: Environment Variables (Vercel → Settings → Environment Variables)
Add these 6 variables (values from your `.env` file):

| Variable | Value |
|---|---|
| `VITE_FB_API_KEY` | AIzaSyDk6h4TSZrJR3X2_BiSF1OFStdq-G7Jcqo |
| `VITE_FB_AUTH_DOMAIN` | nivasa-d0f78.firebaseapp.com |
| `VITE_FB_PROJECT_ID` | nivasa-d0f78 |
| `VITE_FB_STORAGE_BUCKET` | nivasa-d0f78.firebasestorage.app |
| `VITE_FB_SENDER_ID` | 881804067639 |
| `VITE_FB_APP_ID` | 1:881804067639:web:8fa42de4284b80027150b2 |

For Gemini meter scanning (optional):
| `GEMINI_API_KEY` | (get from https://aistudio.google.com/apikey) |

## Step 4: Firebase Configuration
1. **Firestore Rules**: Publish the `firestore.rules` file
   - Firebase Console → Firestore → Rules → paste contents → Publish
2. **Auth Domains**: Add your Vercel domain
   - Firebase Console → Authentication → Settings → Authorized domains
   - Add: `your-project.vercel.app` (and any custom domain)

## Step 5: Deploy
Click "Deploy" in Vercel. Future deploys: just `git push` — Vercel auto-deploys.

## Step 6: Verify
1. Open your Vercel URL
2. Sign in with your credentials
3. Check: Overview loads, Water tab works, History shows data
4. Test on phone: camera capture, WhatsApp share

## Serverless Function
The `/api/read-meter.js` file is a Vercel serverless function.
- It's auto-deployed when the `api/` folder is in the repo
- It needs `GEMINI_API_KEY` env var to work
- Without the key, meter scanning falls back to client-side Tesseract OCR

## SPA Routing
`vercel.json` has the rewrite rule for client-side routing:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

## Custom Domain (optional)
Vercel → Project → Settings → Domains → Add your domain
Then add the Vercel-provided DNS records to your domain registrar.
