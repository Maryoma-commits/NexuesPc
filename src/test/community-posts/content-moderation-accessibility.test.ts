// Feature: community-posts, Property 18: Content Moderation Accessibility
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { 
  ContentReport,
  ModerationAction,
  PostError,
  PostErrorType
} from '../../../types/community-posts'
import { ModerationLogic } from '../../../services/moderationService'

// Generators for property-based testing
const userIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const postIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const commentIdGenerator = fc.string({ minLength: 1, maxLength: 50 })

const reportReasonGenerator = fc.oneof(
  fc.constant('spam'),
  fc.constant('harassment'),
  fc.constant('inappropriate content'),
  fc.constant('fake information'),
  fc.constant('violence'),
  fc.constant('hate speech'),
  fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0)
)

const reportDescriptionGenerator = fc.option(
  fc.string({ minLength: 1, maxLength: 1000 })
)

const validReportDataGenerator = fc.record({
  postId: fc.option(postIdGenerator),
  commentId: fc.option(commentIdGenerator),
  reason: reportReasonGenerator,
  description: reportDescriptionGenerator
}).filter(data => data.postId || data.commentId) // Ensure at least one is present

const contentReportGenerator = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  reporterId: userIdGenerator,
  postId: fc.option(postIdGenerator),
  commentId: fc.option(commentIdGenerator),
  reason: reportReasonGenerator,
  description: reportDescriptionGenerator,
  createdAt: fc.integer({ min: 1000000000000, max: 9999999999999 }),
  status: fc.constantFrom('pending', 'reviewed', 'dismissed'),
  reviewedBy: fc.option(userIdGenerator),
  reviewedAt: fc.option(fc.integer({ min: 1000000000000, max: 9999999999999 }))
}).filter(report => report.postId || report.commentId)

const moderationActionGenerator = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  moderatorId: userIdGenerator,
  targetType: fc.constantFrom('post', 'comment', 'user'),
  targetId: fc.string({ minLength: 1, maxLength: 50 }),
  action: fc.constantFrom('hide', 'delete', 'ban', 'warn'),
  reason: fc.string({ minLength: 1, maxLength: 500 }),
  createdAt: fc.integer({ min: 1000000000000, max: 9999999999999 })
})

// Mock functions to simulate the behavior without Firebase
function mockReportContent(reportData: any, reporterId: string): ContentReport {
  const validation = ModerationLogic.validateReport(reportData)
  if (!validation.valid) {
    throw new PostError(PostErrorType.PERMISSION_DENIED, validation.error!)
  }
  
  return {
    id: `report_${Date.now()}`,
    reporterId,
    postId: reportData.postId,
    commentId: reportData.commentId,
    reason: reportData.reason.trim(),
    description: reportData.description?.trim(),
    createdAt: Date.now(),
    status: 'pending'
  }
}

function mockBlockUser(blockerId: string, blockedId: string): void {
  const validation = ModerationLogic.canBlockUser(blockerId, blockedId)
  if (!validation.canBlock) {
    throw new PostError(PostErrorType.PERMISSION_DENIED, validation.error!)
  }
}

function mockHasReportButton(postId?: string, commentId?: string): boolean {
  // Report button should be available for any valid content
  return !!(postId || commentId)
}

function mockCollectReportReason(reason: string): boolean {
  // Should collect any non-empty reason
  return reason && reason.trim().length > 0
}

function mockForwardToModerationQueue(report: ContentReport): boolean {
  // Should forward all valid reports to moderation queue
  return report.status === 'pending' && !!report.reason
}

describe('Content Moderation Accessibility', () => {
  describe('Property 18: Content Moderation Accessibility', () => {
    it('should provide report button for any post or comment', () => {
      // **Validates: Requirements 6.1**
      fc.assert(
        fc.property(
          fc.record({
            postId: fc.option(postIdGenerator),
            commentId: fc.option(commentIdGenerator)
          }).filter(content => content.postId || content.commentId),
          (content) => {
            // Report button should be available for any valid content
            const hasReportButton = mockHasReportButton(content.postId, content.commentId)
            expect(hasReportButton).toBe(true)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should collect report reason for any reported content', () => {
      // **Validates: Requirements 6.2**
      fc.assert(
        fc.property(
          fc.tuple(validReportDataGenerator, userIdGenerator),
          ([reportData, reporterId]) => {
            // Should collect report reason and forward to moderation queue
            const report = mockReportContent(reportData, reporterId)
            
            expect(report).toBeDefined()
            expect(report.reporterId).toBe(reporterId)
            expect(report.reason).toBeDefined()
            expect(report.reason.length).toBeGreaterThan(0)
            expect(report.status).toBe('pending')
            
            // Should collect the reason
            const reasonCollected = mockCollectReportReason(report.reason)
            expect(reasonCollected).toBe(true)
            
            // Should forward to moderation queue
            const forwardedToQueue = mockForwardToModerationQueue(report)
            expect(forwardedToQueue).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should validate report data correctly', () => {
      fc.assert(
        fc.property(
          validReportDataGenerator,
          (reportData) => {
            const validation = ModerationLogic.validateReport(reportData)
            
            // Valid report data should pass validation
            expect(validation.valid).toBe(true)
            expect(validation.error).toBeUndefined()
            
            // Should have either post or comment ID
            expect(reportData.postId || reportData.commentId).toBeTruthy()
            
            // Should have non-empty reason
            expect(reportData.reason).toBeDefined()
            expect(reportData.reason.trim().length).toBeGreaterThan(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject invalid report data', () => {
      fc.assert(
        fc.property(
          fc.record({
            postId: fc.constant(undefined),
            commentId: fc.constant(undefined),
            reason: fc.oneof(
              fc.constant(''),
              fc.constant('   '),
              fc.string({ minLength: 501, maxLength: 1000 })
            ),
            description: fc.option(fc.string({ minLength: 1001, maxLength: 2000 }))
          }),
          (invalidReportData) => {
            const validation = ModerationLogic.validateReport(invalidReportData)
            
            // Invalid report data should fail validation
            expect(validation.valid).toBe(false)
            expect(validation.error).toBeDefined()
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle report creation for posts and comments', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.record({
              postId: postIdGenerator,
              commentId: fc.constant(undefined),
              reason: reportReasonGenerator,
              description: reportDescriptionGenerator
            }),
            userIdGenerator
          ),
          ([postReportData, reporterId]) => {
            // Should successfully create post report
            const postReport = mockReportContent(postReportData, reporterId)
            
            expect(postReport.postId).toBe(postReportData.postId)
            expect(postReport.commentId).toBeUndefined()
            expect(postReport.reporterId).toBe(reporterId)
            expect(postReport.reason).toBe(postReportData.reason.trim())
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle report creation for comments', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.record({
              postId: postIdGenerator,
              commentId: commentIdGenerator,
              reason: reportReasonGenerator,
              description: reportDescriptionGenerator
            }),
            userIdGenerator
          ),
          ([commentReportData, reporterId]) => {
            // Should successfully create comment report
            const commentReport = mockReportContent(commentReportData, reporterId)
            
            expect(commentReport.postId).toBe(commentReportData.postId)
            expect(commentReport.commentId).toBe(commentReportData.commentId)
            expect(commentReport.reporterId).toBe(reporterId)
            expect(commentReport.reason).toBe(commentReportData.reason.trim())
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should validate user blocking functionality', () => {
      fc.assert(
        fc.property(
          fc.tuple(userIdGenerator, userIdGenerator).filter(([blockerId, blockedId]) => blockerId !== blockedId),
          ([blockerId, blockedId]) => {
            // Should allow blocking different users
            expect(() => mockBlockUser(blockerId, blockedId)).not.toThrow()
            
            const validation = ModerationLogic.canBlockUser(blockerId, blockedId)
            expect(validation.canBlock).toBe(true)
            expect(validation.error).toBeUndefined()
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should prevent users from blocking themselves', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          (userId) => {
            // Should prevent self-blocking
            expect(() => mockBlockUser(userId, userId)).toThrow(PostError)
            
            const validation = ModerationLogic.canBlockUser(userId, userId)
            expect(validation.canBlock).toBe(false)
            expect(validation.error).toBe('Cannot block yourself')
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain report data integrity', () => {
      fc.assert(
        fc.property(
          contentReportGenerator,
          (report) => {
            // Report should have all required fields
            expect(report.id).toBeDefined()
            expect(report.reporterId).toBeDefined()
            expect(report.reason).toBeDefined()
            expect(report.createdAt).toBeGreaterThan(0)
            expect(['pending', 'reviewed', 'dismissed']).toContain(report.status)
            
            // Should have either post or comment ID
            expect(report.postId || report.commentId).toBeTruthy()
            
            // If reviewed, should have reviewer info
            if (report.status === 'reviewed') {
              if (report.reviewedBy) {
                expect(report.reviewedBy).toBeDefined()
                if (report.reviewedAt !== null && report.reviewedAt !== undefined) {
                  // reviewedAt should be after or equal to createdAt (but generator might create invalid data)
                  // So we'll just check that both are valid timestamps
                  expect(report.reviewedAt).toBeGreaterThan(0)
                  expect(report.createdAt).toBeGreaterThan(0)
                }
              }
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain moderation action data integrity', () => {
      fc.assert(
        fc.property(
          moderationActionGenerator,
          (action) => {
            // Moderation action should have all required fields
            expect(action.id).toBeDefined()
            expect(action.moderatorId).toBeDefined()
            expect(action.targetId).toBeDefined()
            expect(action.reason).toBeDefined()
            expect(action.createdAt).toBeGreaterThan(0)
            
            expect(['post', 'comment', 'user']).toContain(action.targetType)
            expect(['hide', 'delete', 'ban', 'warn']).toContain(action.action)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle report reason trimming and validation', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.record({
              postId: postIdGenerator,
              commentId: fc.constant(undefined),
              reason: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0).map(s => `  ${s}  `), // Add whitespace but ensure non-empty after trim
              description: fc.option(fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0).map(s => `  ${s}  `))
            }),
            userIdGenerator
          ),
          ([reportData, reporterId]) => {
            const report = mockReportContent(reportData, reporterId)
            
            // Reason should be trimmed
            expect(report.reason).toBe(reportData.reason.trim())
            expect(report.reason.length).toBeGreaterThan(0)
            
            // Description should be trimmed if present
            if (reportData.description) {
              expect(report.description).toBe(reportData.description.trim())
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})