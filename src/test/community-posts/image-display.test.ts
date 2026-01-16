// Feature: community-posts, Property 7: Image Display Consistency
// **Validates: Requirements 2.3, 2.6**
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { PostDisplayLogic } from '../../../utils/postDisplayUtils'

// Generators for property-based testing
const imageUrlGenerator = fc.webUrl()
const imageArrayGenerator = fc.array(imageUrlGenerator, { minLength: 0, maxLength: 15 })

describe('Image Display Consistency - Property 7', () => {
  describe('Requirement 2.3: Display image thumbnails with lightbox functionality', () => {
    it('should validate all image URLs for any array of images', () => {
      fc.assert(
        fc.property(imageArrayGenerator, (images) => {
          const validation = PostDisplayLogic.validateImages(images)
          
          // Validation should return correct counts
          expect(validation.validCount + validation.invalidCount).toBe(images.length)
          expect(validation.validCount).toBeGreaterThanOrEqual(0)
          expect(validation.invalidCount).toBeGreaterThanOrEqual(0)
          
          // If all images are valid URLs, allValid should be true
          const allHttpUrls = images.every(url => url && url.startsWith('http'))
          if (allHttpUrls && images.length > 0) {
            expect(validation.allValid).toBe(true)
          }
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should detect invalid image URLs', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom('', 'invalid', 'ftp://example.com', 'file:///path'), { minLength: 1, maxLength: 5 }),
          (invalidUrls) => {
            const validation = PostDisplayLogic.validateImages(invalidUrls)
            
            // All URLs should be invalid
            expect(validation.allValid).toBe(false)
            expect(validation.invalidCount).toBe(invalidUrls.length)
            expect(validation.validCount).toBe(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle mixed valid and invalid URLs', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
            fc.array(fc.constantFrom('', 'invalid'), { minLength: 1, maxLength: 3 })
          ),
          ([validUrls, invalidUrls]) => {
            const mixedUrls = [...validUrls, ...invalidUrls]
            const validation = PostDisplayLogic.validateImages(mixedUrls)
            
            // Should correctly count valid and invalid
            expect(validation.validCount).toBe(validUrls.length)
            expect(validation.invalidCount).toBe(invalidUrls.length)
            expect(validation.allValid).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Requirement 2.6: Display multiple images in responsive grid layout', () => {
    it('should calculate correct grid layout for any number of images', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 20 }),
          (imageCount) => {
            const layout = PostDisplayLogic.calculateImageGridLayout(imageCount)
            
            // Display count should never exceed 4
            expect(layout.displayCount).toBeLessThanOrEqual(4)
            
            // Display count should match image count for <= 4 images
            if (imageCount <= 4) {
              expect(layout.displayCount).toBe(imageCount)
              expect(layout.hasOverflow).toBe(false)
              expect(layout.overflowCount).toBe(0)
            }
            
            // For > 4 images, should show overflow
            if (imageCount > 4) {
              expect(layout.displayCount).toBe(4)
              expect(layout.hasOverflow).toBe(true)
              expect(layout.overflowCount).toBe(imageCount - 4)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should use grid layout only for multiple images', () => {
      fc.assert(
        fc.property(imageArrayGenerator, (images) => {
          const shouldUseGrid = PostDisplayLogic.shouldUseGridLayout(images)
          
          // Grid should only be used for 2+ images
          if (images.length <= 1) {
            expect(shouldUseGrid).toBe(false)
          } else {
            expect(shouldUseGrid).toBe(true)
          }
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should return correct column count based on image count', () => {
      // 0 images = 0 columns
      expect(PostDisplayLogic.calculateImageGridLayout(0).columns).toBe(0)
      
      // 1 image = 1 column
      expect(PostDisplayLogic.calculateImageGridLayout(1).columns).toBe(1)
      
      // 2+ images = 2 columns
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 20 }),
          (imageCount) => {
            const layout = PostDisplayLogic.calculateImageGridLayout(imageCount)
            expect(layout.columns).toBe(2)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return correct row count based on image count', () => {
      // 0 images = 0 rows
      expect(PostDisplayLogic.calculateImageGridLayout(0).rows).toBe(0)
      
      // 1 image = 1 row
      expect(PostDisplayLogic.calculateImageGridLayout(1).rows).toBe(1)
      
      // 2 images = 1 row
      expect(PostDisplayLogic.calculateImageGridLayout(2).rows).toBe(1)
      
      // 3-4+ images = 2 rows
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 20 }),
          (imageCount) => {
            const layout = PostDisplayLogic.calculateImageGridLayout(imageCount)
            expect(layout.rows).toBe(2)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Image Grid Layout Invariants', () => {
    it('should maintain displayCount + overflowCount = total images for overflow cases', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 100 }),
          (imageCount) => {
            const layout = PostDisplayLogic.calculateImageGridLayout(imageCount)
            
            // displayCount + overflowCount should equal total
            expect(layout.displayCount + layout.overflowCount).toBe(imageCount)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should never have negative values in layout', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          (imageCount) => {
            const layout = PostDisplayLogic.calculateImageGridLayout(imageCount)
            
            expect(layout.columns).toBeGreaterThanOrEqual(0)
            expect(layout.rows).toBeGreaterThanOrEqual(0)
            expect(layout.displayCount).toBeGreaterThanOrEqual(0)
            expect(layout.overflowCount).toBeGreaterThanOrEqual(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should have consistent hasOverflow flag', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          (imageCount) => {
            const layout = PostDisplayLogic.calculateImageGridLayout(imageCount)
            
            // hasOverflow should be true iff overflowCount > 0
            expect(layout.hasOverflow).toBe(layout.overflowCount > 0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty image array', () => {
      const layout = PostDisplayLogic.calculateImageGridLayout(0)
      const validation = PostDisplayLogic.validateImages([])
      const shouldUseGrid = PostDisplayLogic.shouldUseGridLayout([])
      
      expect(layout.displayCount).toBe(0)
      expect(layout.hasOverflow).toBe(false)
      expect(validation.allValid).toBe(true) // Empty array is considered valid
      expect(validation.validCount).toBe(0)
      expect(shouldUseGrid).toBe(false)
    })

    it('should handle single image', () => {
      const layout = PostDisplayLogic.calculateImageGridLayout(1)
      const shouldUseGrid = PostDisplayLogic.shouldUseGridLayout(['https://example.com/image.jpg'])
      
      expect(layout.columns).toBe(1)
      expect(layout.rows).toBe(1)
      expect(layout.displayCount).toBe(1)
      expect(layout.hasOverflow).toBe(false)
      expect(shouldUseGrid).toBe(false)
    })

    it('should handle exactly 4 images (boundary case)', () => {
      const layout = PostDisplayLogic.calculateImageGridLayout(4)
      
      expect(layout.columns).toBe(2)
      expect(layout.rows).toBe(2)
      expect(layout.displayCount).toBe(4)
      expect(layout.hasOverflow).toBe(false)
      expect(layout.overflowCount).toBe(0)
    })

    it('should handle exactly 5 images (first overflow case)', () => {
      const layout = PostDisplayLogic.calculateImageGridLayout(5)
      
      expect(layout.columns).toBe(2)
      expect(layout.rows).toBe(2)
      expect(layout.displayCount).toBe(4)
      expect(layout.hasOverflow).toBe(true)
      expect(layout.overflowCount).toBe(1)
    })
  })
})
