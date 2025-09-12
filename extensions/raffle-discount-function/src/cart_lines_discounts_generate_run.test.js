import { describe, it, expect } from "vitest";

import { cartLinesDiscountsGenerateRun } from "./cart_lines_discounts_generate_run";
import {
  OrderDiscountSelectionStrategy,
  DiscountClass,
} from "../generated/api";

/**
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

describe("cartLinesDiscountsGenerateRun", () => {
  const baseInput = {
    cart: {
      lines: [
        {
          id: "gid://shopify/CartLine/0",
          cost: {
            subtotalAmount: {
              amount: 100,
            },
          },
        },
      ],
      raffleDiscountAmount: null,
    },
    discount: {
      discountClasses: [],
    },
  };

  it("returns empty operations when no ORDER discount class is present", () => {
    const input = {
      ...baseInput,
      cart: {
        ...baseInput.cart,
        raffleDiscountAmount: { value: "8" },
      },
      discount: {
        discountClasses: [DiscountClass.Product], // Not ORDER
      },
    };

    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toHaveLength(0);
  });

  it("returns empty operations when no raffle discount attribute is present", () => {
    const input = {
      ...baseInput,
      discount: {
        discountClasses: [DiscountClass.Order],
      },
    };

    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toHaveLength(0);
  });

  it("returns empty operations when raffle discount amount is invalid", () => {
    const input = {
      ...baseInput,
      cart: {
        ...baseInput.cart,
        raffleDiscountAmount: { value: "15" }, // Outside 5-10 range
      },
      discount: {
        discountClasses: [DiscountClass.Order],
      },
    };

    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toHaveLength(0);
  });

  it("applies 8% order discount when valid raffle attribute is present", () => {
    const input = {
      ...baseInput,
      cart: {
        ...baseInput.cart,
        raffleDiscountAmount: { value: "8" },
      },
      discount: {
        discountClasses: [DiscountClass.Order],
      },
    };

    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toMatchObject({
      orderDiscountsAdd: {
        candidates: [
          {
            message: "8% OFF - Raffle Discount",
            targets: [
              {
                orderSubtotal: {
                  excludedCartLineIds: [],
                },
              },
            ],
            value: {
              percentage: {
                value: 8,
              },
            },
          },
        ],
        selectionStrategy: OrderDiscountSelectionStrategy.First,
      },
    });
  });

  it("applies 5% order discount at minimum range", () => {
    const input = {
      ...baseInput,
      cart: {
        ...baseInput.cart,
        raffleDiscountAmount: { value: "5" },
      },
      discount: {
        discountClasses: [DiscountClass.Order],
      },
    };

    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toHaveLength(1);
    expect(
      result.operations[0].orderDiscountsAdd.candidates[0].value.percentage
        .value,
    ).toBe(5);
  });

  it("applies 10% order discount at maximum range", () => {
    const input = {
      ...baseInput,
      cart: {
        ...baseInput.cart,
        raffleDiscountAmount: { value: "10" },
      },
      discount: {
        discountClasses: [DiscountClass.Order],
      },
    };

    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toHaveLength(1);
    expect(
      result.operations[0].orderDiscountsAdd.candidates[0].value.percentage
        .value,
    ).toBe(10);
  });
});
