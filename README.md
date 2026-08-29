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
- **Announcement filter** — a checkbox in the Filter menu hides contest announcement blogs
- **Light mode** — toggle between dark and light themes from the top bar (remembered per browser)
- **Comments** — per-blog comment threads stored in Firestore (sign in to post)
- **LaTeX math** — Codeforces' `$$$...$$$` formulas are rendered with KaTeX
- **Infinite feed** — when the recent blogs run out, older blogs keep loading as you scroll
- **Seen tracking** — blogs you've viewed are skipped on your next visit (synced to your account when signed in, localStorage otherwise)
- **Friends & messages** — send friend requests by email or display name, accept/decline, and chat 1-on-1
- **Message notifications** — a pop-up toast (and a browser notification when the tab is hidden) when a friend messages you, plus unread badges
- **Friend likes** — each blog shows which of your friends liked it
- **Profiles** — display name and profile picture (avatars are compressed in the browser and stored in Firestore, so no paid Cloud Storage plan is needed)

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
       function isAdmin() {
         return request.auth != null
          && request.auth.token.email in ['rcodetok@greatcactus.org', 'justinzhu2011@gmail.com'];
       }
       function notBanned() {
         return request.auth != null
           && !exists(/databases/$(database)/documents/bans/$(request.auth.uid));
       }
       match /users/{uid}/{collection}/{docId} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
       match /blogs/{blogId}/comments/{commentId} {
         allow read: if true;
         allow create: if notBanned()
           && request.resource.data.uid == request.auth.uid
           && request.resource.data.text is string
           && request.resource.data.text.size() > 0
           && request.resource.data.text.size() <= 2000;
         allow delete: if isAdmin()
           || (request.auth != null && request.auth.uid == resource.data.uid);
       }
       match /profiles/{uid} {
         allow read: if true;
         allow write: if request.auth != null && request.auth.uid == uid;
       }
       match /friendships/{pairId} {
         allow read: if request.auth != null && request.auth.uid in resource.data.members;
         allow create: if notBanned()
           && request.resource.data.from == request.auth.uid
           && request.resource.data.status == 'pending'
           && request.auth.uid in request.resource.data.members
           && request.resource.data.members.size() == 2;
         allow update: if request.auth != null
           && request.auth.uid == resource.data.to
           && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])
           && request.resource.data.status == 'accepted';
         allow delete: if request.auth != null && request.auth.uid in resource.data.members;
       }
       match /chats/{pairId}/messages/{msgId} {
         allow read: if request.auth != null && pairId.split('_').hasAny([request.auth.uid]);
         allow create: if notBanned()
           && request.resource.data.from == request.auth.uid
           && pairId.split('_').hasAny([request.auth.uid])
           && request.resource.data.text is string
           && request.resource.data.text.size() > 0
           && request.resource.data.text.size() <= 2000
           && (!('image' in request.resource.data)
             || (request.resource.data.image is string
               && request.resource.data.image.size() <= 500000));
         allow delete: if request.auth != null
           && pairId.split('_').hasAny([request.auth.uid])
           && request.auth.uid == resource.data.from;
       }
       match /blogLikes/{blogId}/likers/{uid} {
         allow read: if true;
         allow write: if notBanned() && request.auth.uid == uid;
       }
       match /groups/{groupId} {
         allow read: if request.auth != null && request.auth.uid in resource.data.members;
         allow create: if notBanned()
           && request.resource.data.createdBy == request.auth.uid
           && request.auth.uid in request.resource.data.members
           && request.resource.data.name is string
           && request.resource.data.name.size() > 0
           && request.resource.data.name.size() <= 50;
         allow update: if notBanned()
           && request.auth.uid in resource.data.members
           && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['members']);
         allow delete: if isAdmin()
           || (request.auth != null && request.auth.uid == resource.data.createdBy);
       }
       match /groups/{groupId}/messages/{msgId} {
         allow read: if request.auth != null
           && request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.members;
         allow create: if notBanned()
           && request.resource.data.from == request.auth.uid
           && request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.members
           && request.resource.data.text is string
           && request.resource.data.text.size() > 0
           && request.resource.data.text.size() <= 2000
           && (!('image' in request.resource.data)
             || (request.resource.data.image is string
               && request.resource.data.image.size() <= 500000));
         allow delete: if isAdmin()
           || (request.auth != null && request.auth.uid == resource.data.from);
       }
       match /bans/{uid} {
         allow read: if isAdmin() || (request.auth != null && request.auth.uid == uid);
         allow write: if isAdmin();
       }
     }
   }
   ```

5. Copy `.env.example` to `.env` and fill in the config values, then restart the dev server

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — oxlint
