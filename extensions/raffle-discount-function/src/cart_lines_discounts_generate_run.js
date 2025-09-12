import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
} from "../generated/api";

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */

export function cartLinesDiscountsGenerateRun(input) {
  // Early return if no cart lines
  if (!input.cart.lines.length) {
    return { operations: [] };
  }

  // Only process ORDER discount class for order-level discounts
  const hasOrderDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Order,
  );

  if (!hasOrderDiscountClass) {
    return { operations: [] };
  }

  // Extract raffle_discount_amount from cart attribute
  const raffleDiscountAmount = getRaffleDiscountAmount(
    input.cart.raffleDiscountAmount,
  );

  // Silent failure if no valid discount amount found
  if (raffleDiscountAmount === null) {
    return { operations: [] };
  }

  // Apply the percentage discount to the entire order
  const operations = [
    {
      orderDiscountsAdd: {
        candidates: [
          {
            message: `${raffleDiscountAmount}% OFF - Raffle Discount`,
            targets: [
              {
                orderSubtotal: {
                  excludedCartLineIds: [],
                },
              },
            ],
            value: {
              percentage: {
                value: raffleDiscountAmount,
              },
            },
          },
        ],
        selectionStrategy: OrderDiscountSelectionStrategy.First,
      },
    },
  ];

  return {
    operations,
  };
}

/**
 * Extract and validate raffle discount amount from cart attribute
 * @param {Object} raffleAttribute - Cart attribute object with value field
 * @returns {number|null} - Valid discount percentage (5-10) or null
 */
function getRaffleDiscountAmount(raffleAttribute) {
  // Graceful fallback if no attribute or no value
  if (!raffleAttribute || !raffleAttribute.value) {
    return null;
  }

  // Parse and validate the discount amount
  const discountAmount = parseFloat(raffleAttribute.value);

  // Validate range: must be number between 5 and 10 (inclusive)
  if (isNaN(discountAmount) || discountAmount < 5 || discountAmount > 10) {
    return null;
  }

  return discountAmount;
}
