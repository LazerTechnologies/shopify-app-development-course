import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  try {
    const { topic, shop, payload, admin } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}, Order ID: ${payload.id}`);

    // Extract date_of_birth from note_attributes
    const dateOfBirthRaw = extractDateOfBirth(payload.note_attributes);

    if (!dateOfBirthRaw) {
      console.log(`No date_of_birth found in note_attributes for order ${payload.id}`);
      return new Response("OK", { status: 200 });
    }

    // Validate and convert date format to YYYY-MM-DD (ISO 8601) for Shopify date metafields
    const dateOfBirth = validateAndFormatDate(dateOfBirthRaw);
    if (!dateOfBirth) {
      console.error(`Invalid date format for order ${payload.id}: ${dateOfBirthRaw}`);
      return new Response("OK", { status: 200 }); // Skip silently
    }

    // Log guest orders for manual review
    if (!payload.customer?.id) {
      logGuestOrderForManualReview(payload.id, dateOfBirth, payload.email);
    }

    // Update order metafields
    await updateOrderMetafields(admin, payload.id, dateOfBirth);

    console.log(`Successfully processed order ${payload.id} with DOB ${dateOfBirth}`);
    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("Order webhook processing error:", error);
    return new Response("OK", { status: 200 }); // Skip silently on errors
  }
};

/**
 * Extract date_of_birth from note_attributes array
 */
function extractDateOfBirth(noteAttributes) {
  if (!Array.isArray(noteAttributes)) return null;

  const dobAttribute = noteAttributes.find(attr =>
    attr.name === 'date_of_birth' || attr.name === 'Date of Birth'
  );

  return dobAttribute?.value || null;
}

/**
 * Validate and convert date to YYYY-MM-DD format (ISO 8601) for Shopify date metafields
 */
function validateAndFormatDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;

  try {
    // Handle various input formats and convert to YYYY-MM-DD
    let date;

    // Check if already in MM/DD/YYYY format
    const usFormatRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    if (usFormatRegex.test(dateString)) {
      date = new Date(dateString);
    } else {
      // Try to parse other formats
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) return null;

    // Convert to YYYY-MM-DD format (ISO 8601) as required by Shopify date metafields
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error(`Date validation error for: ${dateString}`, error);
    return null;
  }
}

/**
 * Log guest orders for manual review
 */
function logGuestOrderForManualReview(orderId, dateOfBirth, orderEmail) {
  console.log(`MANUAL_REVIEW_REQUIRED: Guest order ${orderId}`, {
    date_of_birth: dateOfBirth,
    customer_email: orderEmail,
    timestamp: new Date().toISOString(),
    reason: "Guest checkout - no customer ID"
  });
}

/**
 * Update order metafields using the $app namespace
 */
async function updateOrderMetafields(admin, orderId, dateOfBirth) {
  const currentDate = new Date();
  // Generate verification timestamp in YYYY-MM-DD format (ISO 8601) for Shopify date metafields
  const verifiedAt = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;

  const mutation = `
    #graphql
    mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          namespace
          value
          type
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
    metafields: [
      {
        ownerId: `gid://shopify/Order/${orderId}`,
        namespace: "$app", // Using $app namespace as per metafield.server.js
        key: "date_of_birth",
        type: "date",
        value: dateOfBirth
      },
      {
        ownerId: `gid://shopify/Order/${orderId}`,
        namespace: "$app",
        key: "verified_at",
        type: "date",
        value: verifiedAt
      }
    ]
  };

  const response = await admin.graphql(mutation, { variables });
  const data = await response.json();

  if (data.errors) {
    console.error("GraphQL errors updating order metafields:", data.errors);
    throw new Error("Failed to update order metafields");
  }

  if (data.data.metafieldsSet.userErrors?.length > 0) {
    console.error("User errors updating order metafields:", data.data.metafieldsSet.userErrors);
    throw new Error("User errors in metafield update");
  }

  console.log(`Order metafields updated successfully for order ${orderId}`);
  return data.data.metafieldsSet;
}
