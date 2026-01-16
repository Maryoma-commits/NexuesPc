# Firebase Database Schema - Community Posts

This document describes the Firebase Realtime Database structure for the Community Posts feature.

## Database Structure

```
firebase/
├── posts/
│   └── {postId}/
│       ├── authorId: string
│       ├── content: string
│       ├── images: string[] (ImgBB URLs)
│       ├── taggedProducts: ProductReference[]
│       ├── privacy: "public" | "friends" | "private"
│       ├── createdAt: timestamp
│       ├── editedAt?: timestamp
│       ├── likeCount: number
│       └── commentCount: number
├── comments/
│   └── {postId}/
│       └── {commentId}/
│           ├── authorId: string
│           ├── content: string
│           ├── parentId?: string (for replies)
│           ├── createdAt: timestamp
│           ├── editedAt?: timestamp
│           ├── mentions: string[] (user IDs)
│           └── likeCount: number
├── likes/
│   └── {postId}/
│       └── {userId}: timestamp
├── commentLikes/
│   └── {commentId}/
│       └── {userId}: timestamp
├── reactions/
│   └── {postId}/
│       └── {reactionType}/
│           └── {userId}: timestamp
├── userFollows/
│   └── {userId}/
│       ├── following/
│       │   └── {followedUserId}: timestamp
│       └── followers/
│           └── {followerId}: timestamp
├── userFeed/
│   └── {userId}/
│       └── {postId}: timestamp (for personalized feeds)
├── communityNotifications/
│   └── {userId}/
│       └── {notificationId}/
│           ├── type: string
│           ├── fromUserId: string
│           ├── postId?: string
│           ├── commentId?: string
│           ├── createdAt: timestamp
│           ├── read: boolean
│           └── message: string
├── contentReports/
│   └── {reportId}/
│       ├── reporterId: string
│       ├── postId?: string
│       ├── commentId?: string
│       ├── reason: string
│       ├── description?: string
│       ├── createdAt: timestamp
│       ├── status: "pending" | "reviewed" | "dismissed"
│       ├── reviewedBy?: string
│       └── reviewedAt?: timestamp
├── moderationActions/
│   └── {actionId}/
│       ├── moderatorId: string
│       ├── targetType: "post" | "comment" | "user"
│       ├── targetId: string
│       ├── action: "hide" | "delete" | "ban" | "warn"
│       ├── reason: string
│       └── createdAt: timestamp
├── trendingTopics/
│   └── {hashtag}/
│       ├── postCount: number
│       └── lastUsed: timestamp
└── savedSearches/
    └── {userId}/
        └── {searchId}/
            ├── userId: string
            ├── query: string
            ├── filters: SearchFilters
            ├── createdAt: timestamp
            └── notificationsEnabled: boolean
```

## Security Rules

### Posts
- **Read**: Any authenticated user
- **Write**: Post author or admin
- **Validation**: 
  - Content: 1-5000 characters
  - Images: Max 10 images
  - Privacy: Must be 'public', 'friends', or 'private'

### Comments
- **Read**: Any authenticated user
- **Write**: Comment author or admin
- **Validation**:
  - Content: 1-1000 characters
  - Nested replies: Up to 3 levels deep

### Likes & Reactions
- **Read**: Any authenticated user
- **Write**: Only the user themselves can like/react
- **Validation**: Timestamp must be valid number

### User Follows
- **Read**: Any authenticated user
- **Write**: Only the follower can create/remove follows
- **Validation**: Timestamp must be valid number

### Notifications
- **Read**: Only the notification recipient
- **Write**: Any authenticated user (for creating notifications)
- **Validation**: userId must match the path parameter

### Content Reports
- **Read**: Admin only
- **Write**: Reporter (for creation) or admin (for updates)
- **Validation**: Reason must be non-empty string

### Moderation Actions
- **Read**: Admin only
- **Write**: Admin only
- **Validation**: Action must be valid type, reason required

## Database Indexes

The following indexes are configured for optimal query performance:

### Posts
- `createdAt` - For chronological feeds
- `authorId` - For user-specific posts
- `privacy` - For filtering by visibility

### Comments
- `createdAt` - For chronological comment display
- `authorId` - For user-specific comments
- `parentId` - For threaded replies

### Likes & Reactions
- `.value` - For counting and user lookup

### User Follows
- `.value` - For follower/following counts and lookup

### Notifications
- `createdAt` - For chronological notification display
- `read` - For filtering unread notifications
- `type` - For grouping by notification type

### Content Reports
- `createdAt` - For chronological report display
- `status` - For filtering by review status
- `reporterId` - For user-specific reports

### Trending Topics
- `postCount` - For ranking trending topics
- `lastUsed` - For freshness filtering

## Data Validation Rules

### Content Limits
- **Post content**: 5,000 characters maximum
- **Comment content**: 1,000 characters maximum
- **Images per post**: 10 maximum
- **Image size**: 10MB maximum (enforced client-side)

### Privacy Levels
- **Public**: Visible to all users
- **Friends**: Visible to followers only
- **Private**: Visible to author only

### Comment Threading
- **Maximum depth**: 3 levels
- **Parent validation**: parentId must reference existing comment

### Reaction Types
- **Supported reactions**: like, love, wow, helpful, inspiring
- **One per user**: Users can only have one reaction per post

### Notification Types
- **Supported types**: like, comment, mention, follow, reaction
- **Auto-cleanup**: Read notifications older than 30 days can be cleaned up

## Performance Considerations

### Query Optimization
- Use indexes for all time-based queries
- Limit query results (default: 20 items per page)
- Use pagination with `startAfter` for large datasets

### Data Denormalization
- Store counts (likeCount, commentCount) for quick access
- Cache user profiles to reduce lookups
- Maintain separate feed collections for performance

### Real-time Updates
- Use Firebase listeners for live updates
- Implement proper cleanup to prevent memory leaks
- Batch writes for multiple related operations

## Migration Notes

When deploying this schema:

1. **Update Firebase Rules**: Deploy the new security rules
2. **Configure Indexes**: Apply the database indexes configuration
3. **Test Permissions**: Verify all CRUD operations work correctly
4. **Monitor Performance**: Watch for slow queries and optimize as needed

## Backup Strategy

- **Daily backups**: Automated Firebase backups
- **Export format**: JSON for easy restoration
- **Retention**: 30 days for regular backups, 1 year for monthly snapshots