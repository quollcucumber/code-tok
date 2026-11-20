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
           && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
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
       match /admins/{uid} {
         allow read: if true;
         allow write: if false;
       }
       match /profiles/{uid} {
         allow read: if true;
         allow create: if request.auth != null && request.auth.uid == uid
           && request.resource.data.keys().hasOnly(['name', 'nameLower', 'photo', 'createdAt', 'seenCount', 'solvedCount'])
           && request.resource.data.name is string
           && request.resource.data.name.size() > 0
           && request.resource.data.name.size() <= 60
           && request.resource.data.nameLower == request.resource.data.name.lower()
           && !request.resource.data.name.matches('[^\\s@]+@[^\\s@]+\\.[^\\s@]+')
           && (isAdmin() || !request.resource.data.name.matches('(?s).*\\x{1F6E1}.*'))
           && request.resource.data.get('seenCount', 0) == 0
           && request.resource.data.get('solvedCount', 0) == 0;
         allow update: if request.auth != null && request.auth.uid == uid
           && request.resource.data.keys().hasOnly(['name', 'nameLower', 'photo', 'createdAt', 'seenCount', 'solvedCount'])
           && request.resource.data.get('seenCount', 0) is int
           && request.resource.data.get('seenCount', 0) >= resource.data.get('seenCount', 0)
           && request.resource.data.get('solvedCount', 0) is int
           && request.resource.data.get('solvedCount', 0) >= 0
           && request.resource.data.get('solvedCount', 0) - resource.data.get('solvedCount', 0) <= 1
           && resource.data.get('solvedCount', 0) - request.resource.data.get('solvedCount', 0) <= 1
           && (!('name' in request.resource.data)
             || (request.resource.data.name is string
               && request.resource.data.name.size() > 0
               && request.resource.data.name.size() <= 60))
           && request.resource.data.get('nameLower', '') == request.resource.data.get('name', '').lower()
           && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['name'])
             || (!request.resource.data.name.matches('[^\\s@]+@[^\\s@]+\\.[^\\s@]+')
               && (isAdmin() || !request.resource.data.name.matches('(?s).*\\x{1F6E1}.*'))))
           && (request.resource.data.get('photo', null) == null
             || (request.resource.data.photo is string
               && request.resource.data.photo.size() <= 300000));
       }
       // Email lookup for friend search: emailIndex/{sha256(email)} = { uid }.
       // Only the verified owner of an email can claim its entry, and entries
       // can be fetched by exact hash but never listed.
       match /emailIndex/{hash} {
         allow get: if request.auth != null;
         allow list: if false;
         allow create, update: if request.auth != null
           && request.auth.token.email_verified == true
           && request.auth.token.email is string
           && hash == hashing.sha256(request.auth.token.email.lower()).toHexString().lower()
           && request.resource.data.keys().hasOnly(['uid'])
           && request.resource.data.uid == request.auth.uid;
         allow delete: if request.auth != null && resource.data.uid == request.auth.uid;
       }
       // A friendship's id is always from_to, and only `to` can accept it.
       function isAcceptedFriendship(from, to) {
         let path = /databases/$(database)/documents/friendships/$(from + '_' + to);
         return exists(path)
           && get(path).data.status == 'accepted'
           && get(path).data.from == from
           && get(path).data.to == to;
       }
       match /friendships/{pairId} {
         allow read: if request.auth != null && request.auth.uid in resource.data.members;
         allow create: if notBanned()
           && request.resource.data.keys().hasOnly(['from', 'to', 'members', 'status', 'createdAt'])
           && request.resource.data.from == request.auth.uid
           && request.resource.data.to is string
           && request.resource.data.to != request.auth.uid
           && pairId == request.auth.uid + '_' + request.resource.data.to
           && request.resource.data.members == [request.auth.uid, request.resource.data.to]
           && request.resource.data.status == 'pending'
           && request.resource.data.createdAt == request.time
           && !exists(/databases/$(database)/documents/friendships/$(request.resource.data.to + '_' + request.auth.uid));
         allow update: if notBanned()
           && request.auth.uid == resource.data.to
           && resource.data.from != resource.data.to
           && resource.data.status == 'pending'
           && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])
           && request.resource.data.status == 'accepted';
         allow delete: if notBanned() && request.auth.uid in resource.data.members;
       }
       match /chats/{pairId}/messages/{msgId} {
         allow read: if request.auth != null && pairId.split('_').hasAny([request.auth.uid]);
         allow create: if notBanned()
           && pairId.split('_').size() == 2
           && pairId.split('_')[0] < pairId.split('_')[1]
           && pairId.split('_').hasAny([request.auth.uid])
           && (isAcceptedFriendship(pairId.split('_')[0], pairId.split('_')[1])
             || isAcceptedFriendship(pairId.split('_')[1], pairId.split('_')[0]))
           && request.resource.data.keys().hasOnly(['from', 'text', 'image', 'blog', 'createdAt'])
           && request.resource.data.from == request.auth.uid
           && request.resource.data.createdAt == request.time
           && request.resource.data.text is string
           && request.resource.data.text.size() > 0
           && request.resource.data.text.size() <= 2000
           && (!('image' in request.resource.data)
             || (request.resource.data.image is string
               && request.resource.data.image.size() <= 500000
               && request.resource.data.image.matches('data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+')))
           && (!('blog' in request.resource.data)
             || (request.resource.data.blog is map
               && request.resource.data.blog.keys().hasOnly(['id', 'title', 'authorHandle', 'url'])
               && request.resource.data.blog.id is int
               && request.resource.data.blog.id > 0
               && request.resource.data.blog.title is string
               && request.resource.data.blog.title.size() <= 300
               && request.resource.data.blog.authorHandle is string
               && request.resource.data.blog.authorHandle.size() <= 100
               && request.resource.data.blog.get('url', '') is string));
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
         allow read: if true;
         allow write: if isAdmin();
       }
       match /removedBlogs/{blogId} {
         allow read: if true;
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
