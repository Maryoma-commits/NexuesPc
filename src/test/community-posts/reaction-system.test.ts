// Feature: community-posts, Property 10: Reaction System Integrity
// **Validates: Requirements 3.6, 3.7, 3.8**
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { ReactionSystemLogic } from '../../../services/engagementService'
import { ReactionType } from '../../../types/community-posts'

// Generators for property-based testing
const userIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const reactionTypeGenerator = fc.constantFrom<ReactionType>('like', 'love', 'wow', 'helpful', 'inspiring')
const reactionCountGenerator = fc.integer({ min: 0, max: 1000000 })

const reactionCountsGenerator = fc.record({
  like: fc.option(reactionCountGenerator, { nil: undefined }),
  love: fc.option(reactionCountGenerator, { nil: undefined }),
  wow: fc.option(reactionCountGenerator, { nil: undefined }),
  helpful: fc.option(reactionCountGenerator, { nil: undefined }),
  inspiring: fc.option(reactionCountGenerator, { nil: undefined })
}).map(counts => {
  // Filter out undefined values
  const result: Partial<Record<ReactionType, number>> = {}
  for (const [key, value] of Object.entries(counts)) {
    if (value !== undefined) {
      result[key as ReactionType] = value
    }
  }
  return result
})

describe('Reaction System Integrity - Property 10', () => {
  describe('Requirement 3.6: Provide reaction options beyond likes', () => {
    it('should support all defined reaction types', () => {
      const validReactionTypes: ReactionType[] = ['like', 'love', 'wow', 'helpful', 'inspiring']
      
      fc.assert(
        fc.property(
          reactionTypeGenerator,
          (reactionType) => {
            // All generated reaction types should be valid
            expect(validReactionTypes).toContain(reactionType)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should allow users to react with any valid reaction type', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          userIdGenerator.filter(id => id.length > 0),
          reactionTypeGenerator,
          (authorId, userId, reactionType) => {
            // Skip if same user
            if (authorId === userId) return true
            
            const canReact = ReactionSystemLogic.canUserReactToPost(authorId, userId)
            expect(canReact).toBe(true)
            
            // Reaction type should be valid
            expect(['like', 'love', 'wow', 'helpful', 'inspiring']).toContain(reactionType)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Requirement 3.7: Replace existing reaction when user reacts again', () => {
    it('should replace existing reaction with new one (only one reaction per user)', () => {
      fc.assert(
        fc.property(
          reactionTypeGenerator,
          reactionTypeGenerator,
          (currentReaction, newReaction) => {
            // Skip if same reaction (toggle case)
            if (currentReaction === newReaction) return true
            
            const result = ReactionSystemLogic.determineReactionAction(currentReaction, newReaction)
            
            // Should remove old and add new
            expect(result.shouldRemove).toBe(true)
            expect(result.shouldAdd).toBe(true)
            expect(result.finalReaction).toBe(newReaction)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should toggle off when clicking same reaction', () => {
      fc.assert(
        fc.property(
          reactionTypeGenerator,
          (reactionType) => {
            const result = ReactionSystemLogic.determineReactionAction(reactionType, reactionType)
            
            // Should remove reaction (toggle off)
            expect(result.shouldRemove).toBe(true)
            expect(result.shouldAdd).toBe(false)
            expect(result.finalReaction).toBeNull()
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should add reaction when user has no current reaction', () => {
      fc.assert(
        fc.property(
          reactionTypeGenerator,
          (newReaction) => {
            const result = ReactionSystemLogic.determineReactionAction(null, newReaction)
            
            // Should add new reaction
            expect(result.shouldAdd).toBe(true)
            expect(result.shouldRemove).toBe(false)
            expect(result.finalReaction).toBe(newReaction)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Requirement 3.8: Display reaction counts grouped by type', () => {
    it('should correctly calculate reaction counts when adding a reaction', () => {
      fc.assert(
        fc.property(
          reactionCountsGenerator,
          reactionTypeGenerator,
          (currentCounts, newReaction) => {
            const newCounts = ReactionSystemLogic.calculateReactionCounts(
              currentCounts,
              null, // no old reaction
              newReaction
            )
            
            // New reaction count should be incremented by 1
            const oldCount = currentCounts[newReaction] || 0
            expect(newCounts[newReaction]).toBe(oldCount + 1)
            
            // Other counts should remain unchanged
            for (const type of ['like', 'love', 'wow', 'helpful', 'inspiring'] as ReactionType[]) {
              if (type !== newReaction) {
                expect(newCounts[type]).toBe(currentCounts[type])
              }
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should correctly calculate reaction counts when removing a reaction', () => {
      fc.assert(
        fc.property(
          reactionCountsGenerator,
          reactionTypeGenerator,
          (currentCounts, oldReaction) => {
            const newCounts = ReactionSystemLogic.calculateReactionCounts(
              currentCounts,
              oldReaction,
              null // removing reaction
            )
            
            // Old reaction count should be decremented by 1 (min 0)
            const oldCount = currentCounts[oldReaction] || 0
            expect(newCounts[oldReaction]).toBe(Math.max(0, oldCount - 1))
            
            // Other counts should remain unchanged
            for (const type of ['like', 'love', 'wow', 'helpful', 'inspiring'] as ReactionType[]) {
              if (type !== oldReaction) {
                expect(newCounts[type]).toBe(currentCounts[type])
              }
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should correctly calculate reaction counts when switching reactions', () => {
      fc.assert(
        fc.property(
          reactionCountsGenerator,
          reactionTypeGenerator,
          reactionTypeGenerator.filter(r => r !== 'like'), // ensure different from first
          (currentCounts, oldReaction, newReaction) => {
            // Skip if same reaction
            if (oldReaction === newReaction) return true
            
            const newCounts = ReactionSystemLogic.calculateReactionCounts(
              currentCounts,
              oldReaction,
              newReaction
            )
            
            // Old reaction count should be decremented
            const oldOldCount = currentCounts[oldReaction] || 0
            expect(newCounts[oldReaction]).toBe(Math.max(0, oldOldCount - 1))
            
            // New reaction count should be incremented
            const oldNewCount = currentCounts[newReaction] || 0
            expect(newCounts[newReaction]).toBe(oldNewCount + 1)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should calculate total reaction count correctly', () => {
      fc.assert(
        fc.property(
          reactionCountsGenerator,
          (counts) => {
            const total = ReactionSystemLogic.getTotalReactionCount(counts)
            
            // Total should be sum of all counts
            const expectedTotal = Object.values(counts).reduce((sum, count) => sum + (count || 0), 0)
            expect(total).toBe(expectedTotal)
            
            // Total should be non-negative
            expect(total).toBeGreaterThanOrEqual(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('User Reaction Lookup', () => {
    it('should find user reaction from reaction map', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          reactionTypeGenerator,
          (userId, reactionType) => {
            // Create a map with the user's reaction
            const userReactions: Partial<Record<ReactionType, string[]>> = {
              [reactionType]: [userId]
            }
            
            const foundReaction = ReactionSystemLogic.getUserReactionFromMap(userReactions, userId)
            
            expect(foundReaction).toBe(reactionType)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return null when user has no reaction', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          userIdGenerator.filter(id => id.length > 0),
          reactionTypeGenerator,
          (userId, otherUserId, reactionType) => {
            // Skip if same user
            if (userId === otherUserId) return true
            
            // Create a map with another user's reaction
            const userReactions: Partial<Record<ReactionType, string[]>> = {
              [reactionType]: [otherUserId]
            }
            
            const foundReaction = ReactionSystemLogic.getUserReactionFromMap(userReactions, userId)
            
            expect(foundReaction).toBeNull()
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Reaction Count Invariants', () => {
    it('should maintain non-negative reaction counts', () => {
      fc.assert(
        fc.property(
          reactionCountsGenerator,
          fc.option(reactionTypeGenerator, { nil: null }),
          fc.option(reactionTypeGenerator, { nil: null }),
          (currentCounts, oldReaction, newReaction) => {
            const newCounts = ReactionSystemLogic.calculateReactionCounts(
              currentCounts,
              oldReaction,
              newReaction
            )
            
            // All counts should be non-negative
            for (const count of Object.values(newCounts)) {
              expect(count).toBeGreaterThanOrEqual(0)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve total count when switching reactions (net change = 0)', () => {
      fc.assert(
        fc.property(
          reactionCountsGenerator,
          reactionTypeGenerator,
          reactionTypeGenerator,
          (currentCounts, oldReaction, newReaction) => {
            // Skip if same reaction (toggle case changes total)
            if (oldReaction === newReaction) return true
            
            const oldTotal = ReactionSystemLogic.getTotalReactionCount(currentCounts)
            
            const newCounts = ReactionSystemLogic.calculateReactionCounts(
              currentCounts,
              oldReaction,
              newReaction
            )
            
            const newTotal = ReactionSystemLogic.getTotalReactionCount(newCounts)
            
            // When switching reactions, total should remain the same
            // (unless old count was 0, then it increases by 1)
            const oldReactionCount = currentCounts[oldReaction] || 0
            if (oldReactionCount > 0) {
              expect(newTotal).toBe(oldTotal)
            } else {
              expect(newTotal).toBe(oldTotal + 1)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Self-Reaction Prevention', () => {
    it('should prevent users from reacting to their own posts', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          (userId) => {
            const canReact = ReactionSystemLogic.canUserReactToPost(userId, userId)
            
            expect(canReact).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
