# code-tok

Scroll Codeforces blogs like reels. A TikTok-style vertical feed of recent Codeforces blog posts, with accounts, likes, and saves powered by Firebase.

## Features

- **Reels-style feed** — full-screen cards with snap scrolling, one blog per screen
- **Live Codeforces content** — recent blogs fetched from the [Codeforces API](https://codeforces.com/apiHelp), full blog HTML rendered in-card (sanitized with DOMPurify)
- **Author info** — handle colored by rating, rank, and avatar
- **Accounts** — email/password and Google sign-in via Firebase Auth
- **Likes & saves** — stored per-user in Firestore when signed in, in localStorage otherwise
- **Saved view** — browse everything you've bookmarked from the ⭐ Saved tab
- **Score filter** — hide blogs whose Codeforces score (upvotes − downvotes) is below a threshold you pick
- **Comments** — per-blog comment threads stored in Firestore (sign in to post)

## Getting started

```bash
npm install
npm run dev
```

The feed works immediately with no configuration (likes/saves fall back to localStorage).

## Enabling accounts (Firebase)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add a **Web app** and copy its config
3. Enable **Authentication** → sign-in methods: Email/Password and Google
4. Create a **Firestore** database, with rules like:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{collection}/{docId} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
       match /blogs/{blogId}/comments/{commentId} {
         allow read: if true;
         allow create: if request.auth != null
           && request.resource.data.uid == request.auth.uid
           && request.resource.data.text is string
           && request.resource.data.text.size() > 0
           && request.resource.data.text.size() <= 2000;
         allow delete: if request.auth != null && request.auth.uid == resource.data.uid;
       }
     }
   }
   ```

5. Copy `.env.example` to `.env` and fill in the config values, then restart the dev server

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — oxlint
