/**
 * Metafield management utilities for Order metafield definitions
 */

/**
 * Check if required Order metafield definitions already exist
 * @param {Object} admin - Authenticated admin GraphQL client
 * @returns {Promise<Object>} Object with boolean flags for existing definitions
 */
export async function checkExistingOrderMetafieldDefinitions(admin) {
  try {
    const response = await admin.graphql(`
      #graphql
      query CheckExistingMetafieldDefinitions {
        metafieldDefinitions(first: 20, ownerType: ORDER) {
          edges {
            node {
              id
              name
              namespace
              key
              type {
                name
              }
            }
          }
        }
      }
    `);

    const data = await response.json();
    const definitions = data.data?.metafieldDefinitions?.edges || [];

    const existing = {
      date_of_birth: false,
      verified_at: false,
    };

    definitions.forEach(({ node }) => {
      if (
        node.namespace.startsWith("app--") &&
        node.namespace.includes("app")
      ) {
        if (node.key === "date_of_birth") {
          existing.date_of_birth = true;
        }
        if (node.key === "verified_at") {
          existing.verified_at = true;
        }
      }
    });
    return existing;
  } catch (error) {
    console.error("Error checking existing metafield definitions:", error);
    throw error;
  }
}

/**
 * Creates a single Order metafield definition.
 * @param {Object} admin - Authenticated admin GraphQL client
 * @param {Object} definitionInput - The input for the metafield definition.
 * @returns {Promise<Object>} The created metafield definition or user errors.
 */
async function createOrderMetafieldDefinition(admin, definitionInput) {
  const response = await admin.graphql(
    `
    #graphql
    mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
          id
          name
          namespace
          key
          type {
            name
          }
          ownerType
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `,
    {
      variables: {
        definition: definitionInput,
      },
    },
  );

  const data = await response.json();
  if (data.errors) {
    console.error("GraphQL errors:", data.errors);
    throw new Error("GraphQL errors during metafield definition creation.");
  }
  return data.data.metafieldDefinitionCreate;
}

/**
 * Ensures that the required Order metafield definitions exist, creating them if necessary.
 * @param {Object} admin - Authenticated admin GraphQL client
 */
export async function ensureOrderMetafieldDefinitions(admin) {
  const existingDefinitions =
    await checkExistingOrderMetafieldDefinitions(admin);
  const definitionsToCreate = [];

  const commonDefinitionProps = {
    ownerType: "ORDER",
    // Using $app namespace for app-owned metafields
    access: {
      admin: "MERCHANT_READ_WRITE",
      storefront: "PUBLIC_READ",
    },
    type: "date",
  };

  if (!existingDefinitions.date_of_birth) {
    definitionsToCreate.push({
      ...commonDefinitionProps,
      key: "date_of_birth",
      name: "Date of Birth",
      description: "Customer's date of birth associated with this order",
    });
  }

  if (!existingDefinitions.verified_at) {
    definitionsToCreate.push({
      ...commonDefinitionProps,
      key: "verified_at",
      name: "Verified At",
      description: "Date when the order was verified",
    });
  }

  for (const definitionInput of definitionsToCreate) {
    try {
      const result = await createOrderMetafieldDefinition(
        admin,
        definitionInput,
      );
      if (result.userErrors && result.userErrors.length > 0) {
        console.error(
          `Error creating metafield definition for ${definitionInput.key}:`,
          result.userErrors,
        );
      } else {
        console.log(
          `Metafield definition '${definitionInput.name}' created successfully with namespace: ${result.createdDefinition?.namespace}`,
        );
      }
    } catch (error) {
      console.error(
        `Failed to create metafield definition for ${definitionInput.key}:`,
        error,
      );
    }
  }
}
