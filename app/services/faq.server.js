import { authenticate } from "../shopify.server";
import {
  GET_FAQ_METAOBJECT_DEFINITION,
  GET_PRODUCT_FAQ_METAFIELD_DEFINITION,
  CREATE_FAQ_METAOBJECT_DEFINITION,
  CREATE_PRODUCT_FAQ_METAFIELD_DEFINITION,
  CREATE_FAQ_ENTRY,
  UPDATE_FAQ_ENTRY,
  DELETE_FAQ_ENTRY,
  GET_FAQ_ENTRIES,
  GET_FAQ_ENTRY,
  ASSIGN_FAQS_TO_PRODUCT,
  GET_PRODUCT_WITH_FAQS,
  SEARCH_PRODUCTS,
  GET_PRODUCTS,
} from "../graphql/faq";

// Initialize FAQ system - creates metaobject and metafield definitions
export async function initializeFAQSystem(request) {
  const { admin } = await authenticate.admin(request);

  try {
    let faqDefinition = null;
    let productMetafieldDefinition = null;

    // Check if FAQ metaobject definition already exists
    const existingFaqDefResult = await admin.graphql(
      GET_FAQ_METAOBJECT_DEFINITION,
      {
        variables: {
          type: "$app:faq",
        },
      },
    );

    const existingFaqDefData = await existingFaqDefResult.json();
    faqDefinition = existingFaqDefData.data?.metaobjectDefinitionByType;

    // Create FAQ metaobject definition only if it doesn't exist
    if (!faqDefinition) {
      const faqMetaobjectResult = await admin.graphql(
        CREATE_FAQ_METAOBJECT_DEFINITION,
        {
          variables: {
            definition: {
              name: "FAQ",
              type: "$app:faq",
              access: {
                admin: "MERCHANT_READ_WRITE",
                storefront: "PUBLIC_READ",
              },
              displayNameKey: "question",
              fieldDefinitions: [
                {
                  key: "question",
                  name: "Question",
                  type: "single_line_text_field",
                  required: true,
                  validations: [
                    {
                      name: "max",
                      value: "200",
                    },
                  ],
                },
                {
                  key: "answer",
                  name: "Answer",
                  type: "multi_line_text_field",
                  required: true,
                  validations: [
                    {
                      name: "max",
                      value: "1000",
                    },
                  ],
                },
              ],
            },
          },
        },
      );

      const faqMetaobjectData = await faqMetaobjectResult.json();

      if (
        faqMetaobjectData.data?.metaobjectDefinitionCreate?.userErrors?.length >
        0
      ) {
        console.log(
          "FAQ Metaobject Definition errors:",
          faqMetaobjectData.data.metaobjectDefinitionCreate.userErrors,
        );
        return {
          success: false,
          error: "Failed to create FAQ metaobject definition",
          errors: faqMetaobjectData.data.metaobjectDefinitionCreate.userErrors,
        };
      }

      faqDefinition =
        faqMetaobjectData.data?.metaobjectDefinitionCreate
          ?.metaobjectDefinition;
    }

    // Check if product FAQ metafield definition already exists
    const existingMetafieldDefResult = await admin.graphql(
      GET_PRODUCT_FAQ_METAFIELD_DEFINITION,
      {
        variables: {
          namespace: "$app",
          key: "faqs",
          ownerType: "PRODUCT",
        },
      },
    );

    const existingMetafieldDefData = await existingMetafieldDefResult.json();
    productMetafieldDefinition =
      existingMetafieldDefData.data?.metafieldDefinitions?.nodes?.[0];

    // Create product metafield definition only if it doesn't exist
    if (!productMetafieldDefinition && faqDefinition) {
      const productMetafieldResult = await admin.graphql(
        CREATE_PRODUCT_FAQ_METAFIELD_DEFINITION,
        {
          variables: {
            definition: {
              name: "Product FAQs",
              key: "faqs",
              description: "FAQs associated with this product",
              type: "list.metaobject_reference",
              ownerType: "PRODUCT",
              access: {
                admin: "MERCHANT_READ_WRITE",
                storefront: "PUBLIC_READ",
              },
              validations: [
                {
                  name: "metaobject_definition_id",
                  value: faqDefinition.id,
                },
              ],
            },
          },
        },
      );

      const productMetafieldData = await productMetafieldResult.json();

      if (
        productMetafieldData.data?.metafieldDefinitionCreate?.userErrors
          ?.length > 0
      ) {
        console.log(
          "Product Metafield Definition errors:",
          productMetafieldData.data.metafieldDefinitionCreate.userErrors,
        );
        return {
          success: false,
          error: "Failed to create product metafield definition",
          errors:
            productMetafieldData.data.metafieldDefinitionCreate.userErrors,
        };
      }

      productMetafieldDefinition =
        productMetafieldData.data?.metafieldDefinitionCreate?.createdDefinition;
    }

    return {
      success: true,
      faqDefinition,
      productMetafieldDefinition,
      message: "FAQ system initialized successfully",
    };
  } catch (error) {
    console.error("Error initializing FAQ system:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Create a new FAQ entry
export async function createFAQEntry(request, { question, answer }) {
  const { admin } = await authenticate.admin(request);

  try {
    const result = await admin.graphql(CREATE_FAQ_ENTRY, {
      variables: {
        metaobject: {
          type: "$app:faq",
          fields: [
            {
              key: "question",
              value: question,
            },
            {
              key: "answer",
              value: answer,
            },
          ],
        },
      },
    });

    const data = await result.json();

    if (data.data?.metaobjectCreate?.userErrors?.length > 0) {
      throw new Error(data.data.metaobjectCreate.userErrors[0].message);
    }

    return {
      success: true,
      faq: data.data?.metaobjectCreate?.metaobject,
    };
  } catch (error) {
    console.error("Error creating FAQ:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Update an existing FAQ entry
export async function updateFAQEntry(request, { id, question, answer }) {
  const { admin } = await authenticate.admin(request);

  try {
    const result = await admin.graphql(UPDATE_FAQ_ENTRY, {
      variables: {
        id,
        metaobject: {
          fields: [
            {
              key: "question",
              value: question,
            },
            {
              key: "answer",
              value: answer,
            },
          ],
        },
      },
    });

    const data = await result.json();

    if (data.data?.metaobjectUpdate?.userErrors?.length > 0) {
      throw new Error(data.data.metaobjectUpdate.userErrors[0].message);
    }

    return {
      success: true,
      faq: data.data?.metaobjectUpdate?.metaobject,
    };
  } catch (error) {
    console.error("Error updating FAQ:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Delete an FAQ entry
export async function deleteFAQEntry(request, id) {
  const { admin } = await authenticate.admin(request);

  try {
    const result = await admin.graphql(DELETE_FAQ_ENTRY, {
      variables: { id },
    });

    const data = await result.json();

    if (data.data?.metaobjectDelete?.userErrors?.length > 0) {
      throw new Error(data.data.metaobjectDelete.userErrors[0].message);
    }

    return {
      success: true,
      deletedId: data.data?.metaobjectDelete?.deletedId,
    };
  } catch (error) {
    console.error("Error deleting FAQ:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Get all FAQ entries with pagination
export async function getFAQEntries(
  request,
  { first = 20, after = null } = {},
) {
  const { admin } = await authenticate.admin(request);

  try {
    const result = await admin.graphql(GET_FAQ_ENTRIES, {
      variables: { first, after },
    });

    const data = await result.json();

    return {
      success: true,
      faqs: data.data?.metaobjects?.edges?.map((edge) => edge.node) || [],
      pageInfo: data.data?.metaobjects?.pageInfo,
    };
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    return {
      success: false,
      error: error.message,
      faqs: [],
    };
  }
}

// Get a single FAQ entry
export async function getFAQEntry(request, id) {
  const { admin } = await authenticate.admin(request);

  try {
    const result = await admin.graphql(GET_FAQ_ENTRY, {
      variables: { id },
    });

    const data = await result.json();

    return {
      success: true,
      faq: data.data?.metaobject,
    };
  } catch (error) {
    console.error("Error fetching FAQ:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Assign FAQs to a product
export async function assignFAQsToProduct(request, { productId, faqIds }) {
  const { admin } = await authenticate.admin(request);

  try {
    // Convert FAQ IDs to JSON array string format
    const faqIdsJson = JSON.stringify(faqIds);

    const result = await admin.graphql(ASSIGN_FAQS_TO_PRODUCT, {
      variables: {
        productId,
        faqIdsJson,
      },
    });

    const data = await result.json();

    if (data.data?.metafieldsSet?.userErrors?.length > 0) {
      throw new Error(data.data.metafieldsSet.userErrors[0].message);
    }

    return {
      success: true,
      metafield: data.data?.metafieldsSet?.metafields?.[0],
    };
  } catch (error) {
    console.error("Error assigning FAQs to product:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Get a product with its FAQs
export async function getProductWithFAQs(request, productId) {
  const { admin } = await authenticate.admin(request);

  try {
    const result = await admin.graphql(GET_PRODUCT_WITH_FAQS, {
      variables: { id: productId },
    });

    const data = await result.json();

    return {
      success: true,
      product: data.data?.product,
    };
  } catch (error) {
    console.error("Error fetching product with FAQs:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Search products
export async function searchProducts(request, { query, first = 20 }) {
  const { admin } = await authenticate.admin(request);

  try {
    const result = await admin.graphql(SEARCH_PRODUCTS, {
      variables: { query, first },
    });

    const data = await result.json();

    return {
      success: true,
      products: data.data?.products?.edges?.map((edge) => edge.node) || [],
    };
  } catch (error) {
    console.error("Error searching products:", error);
    return {
      success: false,
      error: error.message,
      products: [],
    };
  }
}

// Get products with pagination and FAQ info
export async function getProducts(request, { first = 20, after = null } = {}) {
  const { admin } = await authenticate.admin(request);

  try {
    const result = await admin.graphql(GET_PRODUCTS, {
      variables: { first, after },
    });

    const data = await result.json();

    return {
      success: true,
      products: data.data?.products?.edges?.map((edge) => edge.node) || [],
      pageInfo: data.data?.products?.pageInfo,
    };
  } catch (error) {
    console.error("Error fetching products:", error);
    return {
      success: false,
      error: error.message,
      products: [],
    };
  }
}
