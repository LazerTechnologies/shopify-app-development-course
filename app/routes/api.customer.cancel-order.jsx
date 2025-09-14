import { json } from "@remix-run/node";
import { authenticate, sessionStorage } from "../shopify.server";

export async function loader({ request }) {
  // Handle preflight requests for CORS
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function action({ request }) {
  try {
    // Authenticate the customer account request and get CORS headers
    const { sessionToken, cors } = await authenticate.public.customerAccount(
      request,
      {
        corsHeaders: ["Content-Type", "Authorization"],
      }
    );

    if (request.method !== "POST") {
      return cors(
        json({ error: "Method not allowed" }, { status: 405 })
      );
    }

    const { orderId } = await request.json();

    if (!orderId) {
      return cors(
        json({ error: "Order ID is required" }, { status: 400 })
      );
    }

    // Get the shop domain from the session token
    const shop = sessionToken.dest;

    // Get the stored admin session for this shop
    const sessions = await sessionStorage.findSessionsByShop(shop);

    if (!sessions || sessions.length === 0) {
      return cors(
        json({ error: "No admin session found for shop" }, { status: 401 })
      );
    }

    // Get the most recent valid session
    const adminSession = sessions[0];

    // Create a GraphQL client using the admin session directly
    const adminClient = {
      graphql: async (query, options = {}) => {
        const response = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': adminSession.accessToken,
          },
          body: JSON.stringify({
            query,
            variables: options.variables || {},
          }),
        });
        return response;
      }
    };

    // Call the orderCancel GraphQL mutation - simplified version
    const ORDER_CANCEL_MUTATION = `
      mutation OrderCancel($orderId: ID!, $notifyCustomer: Boolean, $refundMethod: OrderCancelRefundMethodInput!, $restock: Boolean!, $reason: OrderCancelReason!, $staffNote: String) {
        orderCancel(orderId: $orderId, notifyCustomer: $notifyCustomer, refundMethod: $refundMethod, restock: $restock, reason: $reason, staffNote: $staffNote) {
          job {
            id
            done
          }
          orderCancelUserErrors {
            field
            message
            code
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await adminClient.graphql(ORDER_CANCEL_MUTATION, {
      variables: {
        orderId,
        notifyCustomer: true,
        refundMethod: {
          originalPaymentMethodsRefund: true
        },
        restock: true,
        reason: "CUSTOMER",
        staffNote: "Customer cancelled the order"
      },
    });

    const responseJson = await response.json();

    if (responseJson.data?.orderCancel?.orderCancelUserErrors?.length > 0) {
      const errors = responseJson.data.orderCancel.orderCancelUserErrors;
      return cors(
        json(
          {
            error: "Failed to cancel order",
            details: errors.map(err => err.message).join(", ")
          },
          { status: 400 }
        )
      );
    }

    if (responseJson.errors) {
      console.error("GraphQL errors:", responseJson.errors);
      return cors(
        json(
          {
            error: "Failed to cancel order",
            details: responseJson.errors.map(err => err.message).join(", ")
          },
          { status: 500 }
        )
      );
    }

    return cors(
      json({
        success: true,
        job: responseJson.data?.orderCancel?.job,
        message: "Order cancellation request submitted successfully"
      })
    );

  } catch (error) {
    console.error("Error in cancel order endpoint:", error);

    // If we can't establish CORS, return a basic response
    if (error.message?.includes("authenticate")) {
      return new Response(
        JSON.stringify({
          error: "Authentication failed",
          details: error.message
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  }
}
