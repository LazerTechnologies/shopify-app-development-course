/**
 * Service functions for managing discount functions
 */

/**
 * Ensures that the raffle discount function is registered in the store
 * @param {Object} admin - Authenticated admin GraphQL client
 */
export async function ensureRaffleDiscountFunction(admin) {
  try {
    // First, check if we already have a raffle discount registered
    const existingDiscount = await findExistingRaffleDiscount(admin);

    if (existingDiscount) {
      console.log(
        "Raffle discount function already registered:",
        existingDiscount.id,
      );
      return existingDiscount;
    }

    // Get the function ID for our raffle discount function
    const functionId = await getRaffleDiscountFunctionId(admin);

    if (!functionId) {
      console.error(
        "Raffle discount function not found - ensure the app is deployed",
      );
      return null;
    }

    // Register the discount function
    const newDiscount = await registerRaffleDiscountFunction(admin, functionId);

    if (newDiscount) {
      console.log(
        "Successfully registered raffle discount function:",
        newDiscount.id,
      );
      return newDiscount;
    }

    return null;
  } catch (error) {
    console.error("Error in ensureRaffleDiscountFunction:", error);
    throw error;
  }
}

/**
 * Finds existing raffle discount registrations
 */
async function findExistingRaffleDiscount(admin) {
  const query = `#graphql
    query GetExistingRaffleDiscount {
      automaticDiscountNodes(first: 25) {
        edges {
          node {
            id
            automaticDiscount {
              ... on DiscountAutomaticApp {
                title
                status
                appDiscountType {
                  functionId
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query);
    const result = await response.json();

    if (result.data?.automaticDiscountNodes?.edges) {
      // Look for our raffle discount by title
      const raffleDiscount = result.data.automaticDiscountNodes.edges.find(
        (edge) => {
          const discount = edge.node.automaticDiscount;
          return discount && discount.title === "Raffle Discount";
        },
      );

      return raffleDiscount?.node || null;
    }

    return null;
  } catch (error) {
    console.error("Error finding existing raffle discount:", error);
    return null;
  }
}

/**
 * Gets the function ID for our raffle discount function
 */
async function getRaffleDiscountFunctionId(admin) {
  const query = `#graphql
    query GetRaffleFunctionId {
      shopifyFunctions(first: 25, apiType: "discount") {
        nodes {
          id
          title
          app {
            title
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query);
    const result = await response.json();

    if (result.data?.shopifyFunctions?.nodes) {
      // Find our function by looking for the raffle-discount-function
      const raffleFunction = result.data.shopifyFunctions.nodes.find(
        (func) =>
          func.title === "raffle-discount-function" ||
          func.id.includes("raffle-discount-function"),
      );

      return raffleFunction?.id || null;
    }

    return null;
  } catch (error) {
    console.error("Error getting raffle function ID:", error);
    return null;
  }
}

/**
 * Registers the raffle discount function as an automatic discount
 */
async function registerRaffleDiscountFunction(admin, functionId) {
  const mutation = `#graphql
    mutation CreateRaffleDiscount($automaticAppDiscount: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
        automaticAppDiscount {
          discountId
          title
          status
          appDiscountType {
            functionId
          }
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const variables = {
    automaticAppDiscount: {
      title: "Raffle Discount",
      functionId: functionId,
      discountClasses: ["ORDER"], // Order-level discount only
      appliesOnOneTimePurchase: true,
      appliesOnSubscription: false,
      startsAt: "2025-02-02T17:09:21Z",
      combinesWith: {
        orderDiscounts: true,
        productDiscounts: true,
        shippingDiscounts: true,
      },
    },
  };

  try {
    const response = await admin.graphql(mutation, { variables });
    const result = await response.json();

    if (result.data?.discountAutomaticAppCreate?.userErrors?.length > 0) {
      console.error(
        "Error creating raffle discount:",
        result.data.discountAutomaticAppCreate.userErrors,
      );
      return null;
    }

    return (
      result.data?.discountAutomaticAppCreate?.automaticAppDiscount || null
    );
  } catch (error) {
    console.error("Error registering raffle discount function:", error);
    return null;
  }
}
