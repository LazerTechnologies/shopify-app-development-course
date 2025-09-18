import { useState, useEffect } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    // Check if web pixel exists
    const response = await admin.graphql(`
      #graphql
      query GetWebPixel {
        webPixel {
          id
          settings
        }
      }
    `);

    const data = await response.json();
    return {
      pixel: data.data?.webPixel || null
    };
  } catch (error) {
    // If no pixel exists, the API throws an error
    // This is expected behavior when no pixel has been created yet
    console.log("No web pixel found (expected when no pixel is installed):", error.message);
    return {
      pixel: null
    };
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  const accountID = formData.get("accountID");
  const pixelId = formData.get("pixelId");

  try {
    if (action === "create") {
      const response = await admin.graphql(`
        #graphql
        mutation CreateWebPixel($webPixel: WebPixelInput!) {
          webPixelCreate(webPixel: $webPixel) {
            userErrors {
              field
              message
              code
            }
            webPixel {
              id
              settings
            }
          }
        }
      `, {
        variables: {
          webPixel: {
            settings: { accountID }
          }
        }
      });

      const data = await response.json();
      console.log("Create pixel response:", data);
      return { success: true, pixel: data.data.webPixelCreate.webPixel };
    }

    if (action === "update") {
      const response = await admin.graphql(`
        #graphql
        mutation UpdateWebPixel($id: ID!, $webPixel: WebPixelInput!) {
          webPixelUpdate(id: $id, webPixel: $webPixel) {
            userErrors {
              field
              message
              code
            }
            webPixel {
              id
              settings
            }
          }
        }
      `, {
        variables: {
          id: pixelId,
          webPixel: {
            settings: { accountID }
          }
        }
      });

      const data = await response.json();
      console.log("Update pixel response:", data);
      return { success: true, pixel: data.data.webPixelUpdate.webPixel };
    }

    if (action === "delete") {
      const response = await admin.graphql(`
        #graphql
        mutation DeleteWebPixel($id: ID!) {
          webPixelDelete(id: $id) {
            userErrors {
              field
              message
              code
            }
            deletedWebPixelId
          }
        }
      `, {
        variables: {
          id: pixelId
        }
      });

      const data = await response.json();
      console.log("Delete pixel response:", data);
      return { success: true, deleted: true };
    }
  } catch (error) {
    console.error("Error in analytics action:", error);
    return { error: true };
  }

  return { error: true };
};

export default function Analytics() {
  const fetcher = useFetcher();
  const loaderData = useLoaderData();
  const [accountID, setAccountID] = useState("");

  const pixel = fetcher.data?.pixel || loaderData?.pixel;
  const isLoading = fetcher.state !== "idle";

  // Update accountID when pixel data loads
  useEffect(() => {
    if (pixel?.settings) {
      try {
        const settings = typeof pixel.settings === 'string' ?
          JSON.parse(pixel.settings) : pixel.settings;
        setAccountID(settings.accountID || "");
      } catch (error) {
        console.error("Error parsing pixel settings:", error);
      }
    }
  }, [pixel]);

  const handleCreate = () => {
    const formData = new FormData();
    formData.append("action", "create");
    formData.append("accountID", accountID);
    fetcher.submit(formData, { method: "POST" });
  };

  const handleUpdate = () => {
    const formData = new FormData();
    formData.append("action", "update");
    formData.append("accountID", accountID);
    formData.append("pixelId", pixel.id);
    fetcher.submit(formData, { method: "POST" });
  };

  const handleDelete = () => {
    const formData = new FormData();
    formData.append("action", "delete");
    formData.append("pixelId", pixel.id);
    fetcher.submit(formData, { method: "POST" });
  };

  const isConnected = pixel && !fetcher.data?.deleted;

  return (
    <Page>
      <TitleBar title="Analytics Pixel Management" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  📊 Web Pixel Status
                </Text>
                <InlineStack gap="200" align="start">
                  <Badge tone={isConnected ? "success" : "critical"}>
                    {isConnected ? "Connected" : "Disconnected"}
                  </Badge>
                  {isConnected && (
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Pixel ID: {pixel.id.replace("gid://shopify/WebPixel/", "")}
                    </Text>
                  )}
                </InlineStack>
              </BlockStack>

              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">
                  Configuration
                </Text>
                <TextField
                  label="Account ID"
                  value={accountID}
                  onChange={setAccountID}
                  placeholder="Enter your tracking account ID"
                  disabled={isLoading}
                />

                <InlineStack gap="200">
                  {!isConnected ? (
                    <Button
                      primary
                      onClick={handleCreate}
                      loading={isLoading}
                      disabled={!accountID.trim()}
                    >
                      Install Pixel
                    </Button>
                  ) : (
                    <>
                      <Button
                        primary
                        onClick={handleUpdate}
                        loading={isLoading}
                      >
                        Update Settings
                      </Button>
                      <Button
                        destructive
                        onClick={handleDelete}
                        loading={isLoading}
                      >
                        Delete Pixel
                      </Button>
                    </>
                  )}
                </InlineStack>
              </BlockStack>

              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  About Analytics Pixel
                </Text>
                <Text as="p" variant="bodyMd">
                  This pixel extension listens to all Shopify events and logs them to the browser console.
                  Check your browser's developer console to see the captured events and data.
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
