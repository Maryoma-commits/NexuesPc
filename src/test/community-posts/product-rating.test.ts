// Feature: community-posts, Property 17: Product Rating System
// **Validates: Requirements 5.6, 5.7**
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { 
  ProductRatingLogic,
  ProductRating
} from '../../../services/productIntegrationService'

// Generators for property-based testing
const validRatingGenerator = fc.integer({ min: 1, max: 5 })
const invalidRatingGenerator = fc.oneof(
  fc.integer({ min: -100, max: 0 }),
  fc.integer({ min: 6, max: 100 }),
  fc.double({ min: 1.1, max: 4.9 }) // Non-integer ratings
)
const productIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const userIdGenerator = fc.string({ minLength: 1, maxLength: 50 })

// Product rating generator
const productRatingGenerator = fc.record({
  productId: productIdGenerator,
  userId: userIdGenerator,
  rating: validRatingGenerator,
  createdAt: fc.integer({ min: 0, max: Date.now() })
})

// Array of ratings generator
const ratingsArrayGenerator = fc.array(validRatingGenerator, { minLength: 1, maxLength: 100 })

describe('Product Rating System - Property 17', () => {
  describe('Requirement 5.6: Rate shared products on a 1-5 star scale', () => {
    it('should accept all valid ratings (1-5)', () => {
      fc.assert(
        fc.property(
          validRatingGenerator,
          (rating) => {
            const isValid = ProductRatingLogic.isValidRating(rating)
            
            // All ratings 1-5 should be valid
            expect(isValid).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject ratings outside 1-5 range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 0 }),
          (invalidRating) => {
            const isValid = ProductRatingLogic.isValidRating(invalidRating)
            
            // Ratings <= 0 should be invalid
            expect(isValid).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject ratings above 5', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 6, max: 100 }),
          (invalidRating) => {
            const isValid = ProductRatingLogic.isValidRating(invalidRating)
            
            // Ratings > 5 should be invalid
            expect(isValid).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject non-integer ratings', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1.1, max: 4.9, noNaN: true }),
          (nonIntegerRating) => {
            // Skip if it happens to be an integer
            if (Number.isInteger(nonIntegerRating)) return true
            
            const isValid = ProductRatingLogic.isValidRating(nonIntegerRating)
            
            // Non-integer ratings should be invalid
            expect(isValid).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should validate all boundary values correctly', () => {
      // Test boundary values explicitly
      expect(ProductRatingLogic.isValidRating(0)).toBe(false)
      expect(ProductRatingLogic.isValidRating(1)).toBe(true)
      expect(ProductRatingLogic.isValidRating(2)).toBe(true)
      expect(ProductRatingLogic.isValidRating(3)).toBe(true)
      expect(ProductRatingLogic.isValidRating(4)).toBe(true)
      expect(ProductRatingLogic.isValidRating(5)).toBe(true)
      expect(ProductRatingLogic.isValidRating(6)).toBe(false)
    })
  })

  describe('Requirement 5.7: Display average community rating', () => {
    it('should calculate correct average for any set of valid ratings', () => {
      fc.assert(
        fc.property(
          ratingsArrayGenerator,
          (ratings) => {
            const average = ProductRatingLogic.calculateAverageRating(ratings)
            
            // Average should be within valid range
            expect(average).toBeGreaterThanOrEqual(1)
            expect(average).toBeLessThanOrEqual(5)
            
            // Verify calculation
            const expectedSum = ratings.reduce((acc, r) => acc + r, 0)
            const expectedAverage = Math.round((expectedSum / ratings.length) * 10) / 10
            expect(average).toBe(expectedAverage)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return 0 for empty ratings array', () => {
      const average = ProductRatingLogic.calculateAverageRating([])
      expect(average).toBe(0)
    })

    it('should return the rating itself for single rating', () => {
      fc.assert(
        fc.property(
          validRatingGenerator,
          (rating) => {
            const average = ProductRatingLogic.calculateAverageRating([rating])
            
            // Single rating should equal the average
            expect(average).toBe(rating)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should round average to 1 decimal place', () => {
      fc.assert(
        fc.property(
          ratingsArrayGenerator,
          (ratings) => {
            const average = ProductRatingLogic.calculateAverageRating(ratings)
            
            // Check that average has at most 1 decimal place
            const decimalPlaces = (average.toString().split('.')[1] || '').length
            expect(decimalPlaces).toBeLessThanOrEqual(1)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Rating Distribution Calculation', () => {
    it('should correctly distribute ratings across all star levels', () => {
      fc.assert(
        fc.property(
          ratingsArrayGenerator,
          (ratings) => {
            const distribution = ProductRatingLogic.calculateRatingDistribution(ratings)
            
            // Distribution should have all 5 star levels
            expect(Object.keys(distribution)).toHaveLength(5)
            expect(distribution[1]).toBeDefined()
            expect(distribution[2]).toBeDefined()
            expect(distribution[3]).toBeDefined()
            expect(distribution[4]).toBeDefined()
            expect(distribution[5]).toBeDefined()
            
            // Sum of distribution should equal total ratings
            const totalInDistribution = Object.values(distribution).reduce((a, b) => a + b, 0)
            expect(totalInDistribution).toBe(ratings.length)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should count each rating correctly', () => {
      fc.assert(
        fc.property(
          validRatingGenerator,
          fc.integer({ min: 1, max: 50 }),
          (rating, count) => {
            // Create array with 'count' copies of 'rating'
            const ratings = Array(count).fill(rating)
            const distribution = ProductRatingLogic.calculateRatingDistribution(ratings)
            
            // The specific rating should have the correct count
            expect(distribution[rating]).toBe(count)
            
            // Other ratings should be 0
            for (let i = 1; i <= 5; i++) {
              if (i !== rating) {
                expect(distribution[i]).toBe(0)
              }
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return all zeros for empty ratings', () => {
      const distribution = ProductRatingLogic.calculateRatingDistribution([])
      
      expect(distribution[1]).toBe(0)
      expect(distribution[2]).toBe(0)
      expect(distribution[3]).toBe(0)
      expect(distribution[4]).toBe(0)
      expect(distribution[5]).toBe(0)
    })
  })

  describe('Rating Summary Calculation', () => {
    it('should calculate complete rating summary correctly', () => {
      fc.assert(
        fc.property(
          productIdGenerator,
          fc.array(productRatingGenerator, { minLength: 1, maxLength: 50 }),
          (productId, ratings) => {
            const summary = ProductRatingLogic.calculateRatingSummary(productId, ratings)
            
            // Summary should have correct product ID
            expect(summary.productId).toBe(productId)
            
            // Total ratings should match
            expect(summary.totalRatings).toBe(ratings.length)
            
            // Average should be within valid range
            expect(summary.averageRating).toBeGreaterThanOrEqual(1)
            expect(summary.averageRating).toBeLessThanOrEqual(5)
            
            // Distribution sum should equal total
            const distributionSum = Object.values(summary.ratingDistribution).reduce((a, b) => a + b, 0)
            expect(distributionSum).toBe(ratings.length)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle empty ratings in summary', () => {
      const summary = ProductRatingLogic.calculateRatingSummary('test-product', [])
      
      expect(summary.productId).toBe('test-product')
      expect(summary.totalRatings).toBe(0)
      expect(summary.averageRating).toBe(0)
    })
  })

  describe('New Average Calculation', () => {
    it('should correctly calculate new average when adding a rating', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 5, noNaN: true }),
          fc.integer({ min: 1, max: 1000 }),
          validRatingGenerator,
          (currentAverage, currentCount, newRating) => {
            const newAverage = ProductRatingLogic.calculateNewAverage(
              currentAverage, 
              currentCount, 
              newRating
            )
            
            // New average should be within valid range
            expect(newAverage).toBeGreaterThanOrEqual(1)
            expect(newAverage).toBeLessThanOrEqual(5)
            
            // New average should be between current average and new rating
            const minExpected = Math.min(currentAverage, newRating)
            const maxExpected = Math.max(currentAverage, newRating)
            expect(newAverage).toBeGreaterThanOrEqual(minExpected - 0.1) // Allow for rounding
            expect(newAverage).toBeLessThanOrEqual(maxExpected + 0.1)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return the new rating when count is 0', () => {
      fc.assert(
        fc.property(
          validRatingGenerator,
          (newRating) => {
            const newAverage = ProductRatingLogic.calculateNewAverage(0, 0, newRating)
            
            // First rating should be the average
            expect(newAverage).toBe(newRating)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should move average towards new rating', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 5, noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          validRatingGenerator,
          (currentAverage, currentCount, newRating) => {
            const newAverage = ProductRatingLogic.calculateNewAverage(
              currentAverage, 
              currentCount, 
              newRating
            )
            
            // If new rating is higher than current average, new average should be higher
            if (newRating > currentAverage) {
              expect(newAverage).toBeGreaterThanOrEqual(currentAverage - 0.1) // Allow for rounding
            }
            // If new rating is lower than current average, new average should be lower
            if (newRating < currentAverage) {
              expect(newAverage).toBeLessThanOrEqual(currentAverage + 0.1) // Allow for rounding
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Rating System Invariants', () => {
    it('should maintain rating count invariant in distribution', () => {
      fc.assert(
        fc.property(
          ratingsArrayGenerator,
          (ratings) => {
            const distribution = ProductRatingLogic.calculateRatingDistribution(ratings)
            
            // Sum of all distribution counts should equal total ratings
            const totalFromDistribution = Object.values(distribution).reduce((a, b) => a + b, 0)
            expect(totalFromDistribution).toBe(ratings.length)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain average within bounds invariant', () => {
      fc.assert(
        fc.property(
          ratingsArrayGenerator,
          (ratings) => {
            const average = ProductRatingLogic.calculateAverageRating(ratings)
            
            // Average should always be between min and max of ratings
            const minRating = Math.min(...ratings)
            const maxRating = Math.max(...ratings)
            
            expect(average).toBeGreaterThanOrEqual(minRating)
            expect(average).toBeLessThanOrEqual(maxRating)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain non-negative counts invariant', () => {
      fc.assert(
        fc.property(
          ratingsArrayGenerator,
          (ratings) => {
            const distribution = ProductRatingLogic.calculateRatingDistribution(ratings)
            
            // All counts should be non-negative
            for (const count of Object.values(distribution)) {
              expect(count).toBeGreaterThanOrEqual(0)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
