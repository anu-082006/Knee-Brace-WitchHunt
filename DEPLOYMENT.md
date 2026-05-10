# PhysioTrack - Firebase Deployment Guide

This guide explains how to deploy your PhysioTrack application to Firebase.

## Prerequisites

1. Node.js 18+ installed
2. Firebase CLI installed (`npm install -g firebase-tools`)
3. A Firebase project created (see Setup below)

## Initial Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `physiotrack` (or your preferred name)
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click "Get started"
3. Enable **Email/Password** sign-in method
4. Click "Save"

### 3. Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Start in **Test mode** (we'll deploy security rules later)
4. Select your preferred location
5. Click "Enable"

### 4. Register Web App

1. In Firebase Console, go to **Project settings** (gear icon)
2. Scroll to "Your apps" section
3. Click the Web icon (`</>`)
4. Register app name: "PhysioTrack"
5. Copy the config values (you've already added these as Replit secrets):
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `appId`

### 5. Update .firebaserc

Edit `.firebaserc` and replace `your-firebase-project-id` with your actual Firebase project ID:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

## Deployment Steps

### 1. Login to Firebase

```bash
firebase login
```

This will open a browser window for authentication.

### 2. Deploy Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

This deploys the role-based security rules from `firestore.rules`.

### 3. Deploy Cloud Functions

First, install function dependencies:

```bash
cd functions
npm install
cd ..
```

Then deploy:

```bash
firebase deploy --only functions
```

**Important:** Configure the n8n webhook URL:

```bash
firebase functions:config:set n8n.webhook_url="https://orthoconnect.app.n8n.cloud/webhook/patient-query"
```

Redeploy functions after configuration:

```bash
firebase deploy --only functions
```

### 4. Build and Deploy Frontend

Build the production bundle:

```bash
npm run build
```

Deploy to Firebase Hosting:

```bash
firebase deploy --only hosting
```

### 5. Add Authorized Domains

1. Go to Firebase Console → **Authentication** → **Settings**
2. Scroll to "Authorized domains"
3. Add your domains:
   - Your Replit dev URL (e.g., `https://your-repl.replit.dev`)
   - Your Firebase hosting URL (will be shown after deployment)
   - Any custom domains you plan to use

## Complete Deployment (All at Once)

To deploy everything in one command:

```bash
npm run build && firebase deploy
```

## Testing the Deployment

### 1. Create Test Users

1. Go to your deployed app URL
2. Click "Sign up"
3. Create a physiotherapist account
4. Create a patient account (in a different browser or incognito window)

### 2. Test Physiotherapist Flow

1. Login as physiotherapist
2. Verify dashboard loads
3. Check patient list (should be empty initially)

### 3. Test Patient Flow

1. Login as patient
2. Verify dashboard loads
3. Test Arduino connection (if device available)
4. Check assigned exercises (should be empty initially)

### 4. Assign Patient to Physiotherapist

Since we don't have a UI for this yet, use Firebase Console:

1. Go to Firestore Database
2. Find the patient's user document
3. Add field `assignedPhysioId` with the physiotherapist's UID
4. Save

Now the physiotherapist should see this patient in their dashboard!

## Post-Deployment Configuration

### Set Production Security Rules

After initial testing, update Firestore to use production mode:

1. Go to Firestore Database → Rules
2. Verify the rules match `firestore.rules`
3. Publish if needed

### Monitor Cloud Functions

View function logs:

```bash
firebase functions:log
```

Or in Firebase Console → **Functions** → Select function → View logs

### Monitor n8n Webhook Calls

Check your n8n workflow to see incoming webhook calls from the Cloud Function.

## Updating the Application

### Update Frontend Only

```bash
npm run build
firebase deploy --only hosting
```

### Update Functions Only

```bash
firebase deploy --only functions
```

### Update Rules Only

```bash
firebase deploy --only firestore:rules
```

## Troubleshooting

### Issue: "Missing or insufficient permissions"

**Solution:** Check Firestore security rules are deployed correctly:

```bash
firebase deploy --only firestore:rules
```

### Issue: Cloud Function not triggering

**Solution:**
1. Check function deployment: `firebase functions:log`
2. Verify the function is deployed: Check Firebase Console → Functions
3. Check Firestore path matches exactly: `readings/{patientId}/events/{readingId}`

### Issue: n8n webhook not receiving data

**Solution:**
1. Check function logs: `firebase functions:log`
2. Verify webhook URL is configured: `firebase functions:config:get`
3. Test webhook URL directly with curl/Postman

### Issue: Authentication not working

**Solution:**
1. Check authorized domains in Firebase Console
2. Verify environment variables in Replit are set correctly
3. Clear browser cache and try again

## Cost Estimation

Firebase offers a generous free tier:

- **Authentication:** 10k verifications/month free
- **Firestore:** 50k reads, 20k writes, 1GB storage free
- **Cloud Functions:** 2M invocations/month free
- **Hosting:** 10GB storage, 360MB/day bandwidth free

For a small-to-medium deployment (10-50 users), you should stay within the free tier.

## Next Steps

1. Implement exercise assignment UI
2. Add patient-physiotherapist assignment in the app
3. Create exercise template library
4. Add progress charts and analytics
5. Implement notifications
6. Add offline support
7. Create mobile PWA

## Support

For issues or questions:
- Check Firebase Console logs
- Review function logs: `firebase functions:log`
- Check browser console for frontend errors
