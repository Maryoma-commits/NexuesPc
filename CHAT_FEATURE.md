# 💬 NexusPC Community Chat Feature

## Overview
Full-featured real-time chat system for NexusPC users powered by Firebase.

## Features

### ✅ Authentication
- **Google Sign-In** - Quick OAuth login
- **Email/Password** - Traditional registration
- **User Profiles** - Avatar, display name, bio

### ✅ Global Chat
- Real-time messaging for all users
- Message history (last 100 messages)
- Emoji picker support
- Delete own messages
- Report inappropriate messages
- Timestamps and online indicators

### ✅ Direct Messages (DMs)
- Private one-on-one conversations
- User search functionality
- Conversation list with unread counts
- Message history per conversation
- Block/unblock users
- Report messages

### ✅ UI/UX
- **Floating chat bubble** (bottom-right corner)
- Minimize/maximize functionality
- Unread message badges
- Dark/Light mode support
- Smooth animations
- Mobile-responsive design

### ✅ Moderation
- Report messages (with reason)
- Block users
- Delete own messages
- Admin notification system (reports stored in Firebase)

## Tech Stack

- **Firebase Authentication** - User management
- **Firebase Realtime Database** - Message storage & real-time sync
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Lucide React** - Icons
- **emoji-picker-react** - Emoji support

## File Structure

```
├── firebase.config.ts              # Firebase initialization
├── services/
│   ├── authService.ts              # Authentication logic
│   └── chatService.ts              # Chat & messaging logic
├── components/
│   ├── auth/
│   │   ├── AuthModal.tsx           # Sign in/up modal
│   │   └── UserProfile.tsx         # Profile editor
│   └── chat/
│       ├── ChatBubble.tsx          # Floating chat button
│       ├── ChatWindow.tsx          # Main chat container
│       ├── GlobalChat.tsx          # Global chat room
│       └── DirectMessages.tsx      # DM interface
```

## Firebase Database Structure

```
nexuspc-a9df6/
├── users/
│   └── {userId}/
│       ├── uid
│       ├── displayName
│       ├── email
│       ├── photoURL
│       ├── bio
│       ├── createdAt
│       ├── lastOnline
│       ├── isOnline
│       └── blockedUsers/
│           └── {blockedUserId}: true
├── globalChat/
│   └── messages/
│       └── {messageId}/
│           ├── text
│           ├── senderId
│           ├── senderName
│           ├── senderPhoto
│           ├── timestamp
│           └── type: "global"
├── directMessages/
│   └── {userId1}_{userId2}/
│       └── messages/
│           └── {messageId}/
│               ├── text
│               ├── senderId
│               ├── senderName
│               ├── senderPhoto
│               ├── recipientId
│               ├── timestamp
│               └── type: "dm"
├── conversations/
│   └── {userId1}_{userId2}/
│       ├── participants: [userId1, userId2]
│       ├── participantNames: {userId1: name, userId2: name}
│       ├── participantPhotos: {userId1: photo, userId2: photo}
│       ├── lastMessage
│       ├── lastMessageTime
│       └── unreadCount: {userId1: 0, userId2: 5}
└── reports/
    └── {messageId}/
        ├── messageId
        ├── reportedBy
        ├── reason
        └── timestamp
```

## Usage

### For Users

1. **Click the blue chat bubble** (bottom-right corner)
2. **Sign in** with Google, Facebook, or Email
3. **Global Chat** - Chat with all NexusPC users
4. **Direct Messages** - Search for users and send private messages
5. **Profile** - Click avatar to edit profile

### For Developers

```tsx
// Chat is automatically included in App.tsx
import ChatBubble from './components/chat/ChatBubble';

// Use in any component
<ChatBubble />
```

## Firebase Setup (Already Configured)

- **Project ID:** nexuspc-a9df6
- **Region:** Europe West (Belgium)
- **Authentication:** Google, Facebook, Email/Password ✅
- **Realtime Database:** europe-west1 ✅
- **Security Rules:** Test mode (update for production!)

## Security Rules (TODO for Production)

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": true,
        ".write": "$uid === auth.uid"
      }
    },
    "globalChat": {
      ".read": "auth != null",
      "messages": {
        "$messageId": {
          ".write": "auth != null && (!data.exists() || data.child('senderId').val() === auth.uid)"
        }
      }
    },
    "directMessages": {
      "$conversationId": {
        ".read": "auth != null && $conversationId.contains(auth.uid)",
        ".write": "auth != null && $conversationId.contains(auth.uid)"
      }
    },
    "conversations": {
      "$conversationId": {
        ".read": "auth != null && $conversationId.contains(auth.uid)",
        ".write": "auth != null && $conversationId.contains(auth.uid)"
      }
    },
    "reports": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

## Future Enhancements

- [ ] Image/file sharing in chat
- [ ] Voice messages
- [ ] Typing indicators
- [ ] Read receipts
- [ ] Multiple chat rooms (by category)
- [ ] Admin dashboard for moderation
- [ ] Push notifications
- [ ] Message reactions (like/emoji)
- [ ] Message search
- [ ] User status (online/away/busy)

## Testing

1. **Local testing:**
   ```bash
   npm run dev
   ```

2. **Sign up with test accounts:**
   - Create 2+ accounts
   - Test global chat
   - Test DMs between accounts
   - Test blocking/reporting

3. **Check Firebase Console:**
   - Verify users are created
   - Check messages are stored
   - Monitor real-time updates

## Deployment

Already integrated with Vercel auto-deploy:
```bash
git add .
git commit -m "feat: Add community chat feature"
git push
```

## Support

For issues or questions:
- Check Firebase Console for errors
- Review browser console for client-side errors
- Verify Firebase config in `firebase.config.ts`

---

**Built with ❤️ for NexusPC Community**
