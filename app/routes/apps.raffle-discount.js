import { authenticate } from "../shopify.server";

/**
 * App Proxy endpoint for raffle discount generation
 * URL: https://{shop}.myshopify.com/apps/raffle/raffle-discount
 *
 * This endpoint:
 * 1. Authenticates requests using authenticate.public.appProxy()
 * 2. Generates random discount between 5-10%
 * 3. Returns JSON response with discount amount
 */
export async function loader({ request }) {
  try {
    // Authenticate the app proxy request
    // This validates the request signature and ensures it's from Shopify
    const { liquid, shop } = await authenticate.public.appProxy(request);

    // Generate random discount (5-10%)
    const discountAmount = Math.floor(Math.random() * 6) + 5;

    // Return JSON response for the theme app extension
    return new Response(
      JSON.stringify({
        success: true,
        discount: discountAmount,
        message: `Congratulations! You won ${discountAmount}% off your order!`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    );
  } catch (error) {
    // Silent failure as requested - return error but don't expose details
    console.error("App proxy authentication failed:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Authentication failed",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

// Handle preflight OPTIONS requests for CORS
export async function action({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // For POST requests, use the same logic as loader
  return loader({ request });
}
