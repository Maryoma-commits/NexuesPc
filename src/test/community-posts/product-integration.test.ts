// Feature: community-posts, Property 16: Product Integration Completeness
// **Validates: Requirements 5.2, 5.5**
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { 
  ProductDisplayLogic,
  ProductPriceLogic
} from '../../../services/productIntegrationService'
import { ProductReference } from '../../../types/community-posts'
import { Product } from '../../../types'

// Generators for property-based testing
const productIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const productTitleGenerator = fc.string({ minLength: 1, maxLength: 200 })
const priceGenerator = fc.integer({ min: 0, max: 100000000 }) // Up to 100M IQD
const retailerGenerator = fc.constantFrom(
  'GlobalIraq', 'Alityan', 'Kolshzin', '3D-Iraq', 
  'JokerCenter', 'GalaxyIQ', 'Almanjam', 'Spniq', 'Altajit'
)
const categoryGenerator = fc.constantFrom(
  'CPU', 'GPU', 'RAM', 'Storage', 'Motherboard', 
  'PSU', 'Case', 'Cooling', 'Peripherals', 'Other'
)
const imageUrlGenerator = fc.oneof(
  fc.constant(''),
  fc.webUrl()
)

// Product reference generator
const productReferenceGenerator = fc.record({
  productId: productIdGenerator,
  title: productTitleGenerator,
  imageUrl: imageUrlGenerator,
  price: priceGenerator,
  retailer: retailerGenerator,
  category: categoryGenerator
})

// Valid product reference generator (all required fields present)
const validProductReferenceGenerator = fc.record({
  productId: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  imageUrl: imageUrlGenerator,
  price: fc.integer({ min: 0, max: 100000000 }),
  retailer: fc.string({ minLength: 1, maxLength: 100 }),
  category: categoryGenerator
})

// Product generator
const productGenerator = fc.record({
  id: productIdGenerator,
  title: productTitleGenerator,
  price: priceGenerator,
  retailer: retailerGenerator,
  url: fc.webUrl(),
  imageUrl: imageUrlGenerator,
  category: categoryGenerator,
  inStock: fc.boolean()
})

describe('Product Integration Completeness - Property 16', () => {
  describe('Requirement 5.2: Display current price, availability, and retailer information', () => {
    it('should validate that all product references have price information', () => {
      fc.assert(
        fc.property(
          validProductReferenceGenerator,
          (productRef) => {
            const validation = ProductDisplayLogic.validateDisplayFields(productRef)
            
            // Valid product references should have price
            expect(validation.hasPrice).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should validate that all product references have retailer information', () => {
      fc.assert(
        fc.property(
          validProductReferenceGenerator,
          (productRef) => {
            const validation = ProductDisplayLogic.validateDisplayFields(productRef)
            
            // Valid product references should have retailer
            expect(validation.hasRetailer).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should mark incomplete product references as invalid', () => {
      fc.assert(
        fc.property(
          fc.record({
            productId: fc.constant(''), // Empty product ID
            title: productTitleGenerator,
            imageUrl: imageUrlGenerator,
            price: priceGenerator,
            retailer: retailerGenerator,
            category: categoryGenerator
          }),
          (incompleteRef) => {
            const validation = ProductDisplayLogic.validateDisplayFields(incompleteRef)
            
            // Should not be complete without product ID (needed for purchase link)
            expect(validation.hasPurchaseLink).toBe(false)
            expect(validation.isComplete).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should correctly identify complete product references', () => {
      fc.assert(
        fc.property(
          validProductReferenceGenerator,
          (productRef) => {
            const validation = ProductDisplayLogic.validateDisplayFields(productRef)
            
            // A valid product reference should be complete
            const expectedComplete = 
              validation.hasPrice && 
              validation.hasRetailer && 
              validation.hasPurchaseLink
            
            expect(validation.isComplete).toBe(expectedComplete)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Requirement 5.5: Provide direct links to purchase from retailers', () => {
    it('should generate purchase links for all valid product references', () => {
      fc.assert(
        fc.property(
          validProductReferenceGenerator,
          (productRef) => {
            const purchaseLink = ProductDisplayLogic.generatePurchaseLink(productRef)
            
            // Purchase link should be generated
            expect(purchaseLink).toBeTruthy()
            expect(purchaseLink.length).toBeGreaterThan(0)
            
            // Purchase link should contain the product ID
            expect(purchaseLink).toContain(productRef.productId)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should generate purchase links with custom base URL', () => {
      fc.assert(
        fc.property(
          validProductReferenceGenerator,
          fc.webUrl(),
          (productRef, baseUrl) => {
            const purchaseLink = ProductDisplayLogic.generatePurchaseLink(productRef, baseUrl)
            
            // Purchase link should start with base URL
            expect(purchaseLink.startsWith(baseUrl)).toBe(true)
            
            // Purchase link should contain the product ID
            expect(purchaseLink).toContain(productRef.productId)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should validate purchase link availability for complete products', () => {
      fc.assert(
        fc.property(
          validProductReferenceGenerator,
          (productRef) => {
            const validation = ProductDisplayLogic.validateDisplayFields(productRef)
            
            // If product has ID, it should have purchase link capability
            if (productRef.productId && productRef.productId.length > 0) {
              expect(validation.hasPurchaseLink).toBe(true)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Price Display Consistency', () => {
    it('should format prices consistently for any valid price', () => {
      fc.assert(
        fc.property(
          priceGenerator,
          (price) => {
            const formatted = ProductDisplayLogic.formatPrice(price)
            
            // Formatted price should be a non-empty string
            expect(formatted).toBeTruthy()
            expect(typeof formatted).toBe('string')
            expect(formatted.length).toBeGreaterThan(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle zero price correctly', () => {
      const formatted = ProductDisplayLogic.formatPrice(0)
      expect(formatted).toBeTruthy()
      expect(formatted.length).toBeGreaterThan(0)
    })
  })

  describe('Product Display Completeness Invariants', () => {
    it('should maintain consistency between validation fields and isComplete', () => {
      fc.assert(
        fc.property(
          productReferenceGenerator,
          (productRef) => {
            const validation = ProductDisplayLogic.validateDisplayFields(productRef)
            
            // isComplete should be true only if all required fields are present
            const allFieldsPresent = 
              validation.hasPrice && 
              validation.hasRetailer && 
              validation.hasPurchaseLink
            
            expect(validation.isComplete).toBe(allFieldsPresent)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should correctly identify display completeness', () => {
      fc.assert(
        fc.property(
          validProductReferenceGenerator,
          (productRef) => {
            const isComplete = ProductDisplayLogic.isDisplayComplete(productRef)
            const validation = ProductDisplayLogic.validateDisplayFields(productRef)
            
            // isDisplayComplete should match validation.isComplete
            expect(isComplete).toBe(validation.isComplete)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Price Update Detection', () => {
    it('should detect price changes between old and new product data', () => {
      fc.assert(
        fc.property(
          validProductReferenceGenerator,
          priceGenerator,
          (oldProduct, newPrice) => {
            // Skip if prices are the same
            if (oldProduct.price === newPrice) return true
            
            const newProduct: Product = {
              id: oldProduct.productId,
              title: oldProduct.title,
              price: newPrice,
              retailer: oldProduct.retailer,
              url: 'https://example.com',
              imageUrl: oldProduct.imageUrl,
              category: oldProduct.category
            }
            
            const notification = ProductPriceLogic.checkPriceUpdate(oldProduct, newProduct)
            
            // Should create notification for price change
            expect(notification).not.toBeNull()
            expect(notification!.oldPrice).toBe(oldProduct.price)
            expect(notification!.newPrice).toBe(newPrice)
            expect(notification!.priceChange).toBe(newPrice - oldProduct.price)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not create notification when price is unchanged', () => {
      fc.assert(
        fc.property(
          validProductReferenceGenerator,
          (productRef) => {
            const newProduct: Product = {
              id: productRef.productId,
              title: productRef.title,
              price: productRef.price, // Same price
              retailer: productRef.retailer,
              url: 'https://example.com',
              imageUrl: productRef.imageUrl,
              category: productRef.category
            }
            
            const notification = ProductPriceLogic.checkPriceUpdate(productRef, newProduct)
            
            // Should not create notification for unchanged price
            expect(notification).toBeNull()
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
