import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
  Button,
  TextField,
  Form,
} from '@shopify/ui-extensions-react/admin';
import { useState, useEffect } from 'react';

// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)
const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data } = useApi(TARGET);

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState("");

  // Get the order ID from the current page context
  const orderId = data?.selected?.[0]?.id;

  // Client-side date validation function
  const validateDate = (date) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return "Please enter date in YYYY-MM-DD format";
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return "Please enter a valid date";
    }

    // Check if date is not in the future
    const today = new Date();
    if (parsedDate > today) {
      return "Date of birth cannot be in the future";
    }

    return null;
  };

  // Fetch current order metafields to check verification status
  useEffect(() => {
    if (!orderId) return;

    const fetchOrderMetafields = async () => {
      try {
        const graphQLQuery = {
          query: `query GetOrderMetafields($id: ID!) {
            order(id: $id) {
              id
              metafields(namespace: "$app", first: 10) {
                edges {
                  node {
                    id
                    key
                    value
                    namespace
                  }
                }
              }
            }
          }`,
          variables: { id: orderId }
        };

        const response = await fetch("shopify:admin/api/graphql.json", {
          method: "POST",
          body: JSON.stringify(graphQLQuery),
        });

        if (!response.ok) {
          throw new Error("Network error");
        }

        const result = await response.json();
        const metafields = result.data?.order?.metafields?.edges || [];
        const dobMetafield = metafields.find(
          edge => edge.node.key === "date_of_birth"
        );

        // If date_of_birth metafield exists and has a value, mark as verified
        if (dobMetafield?.node?.value) {
          setIsVerified(true);
        }
      } catch (err) {
        console.error("Error fetching order metafields:", err);
        setError("Failed to load verification status");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderMetafields();
  }, [orderId]);

  // Handle form submission
  const handleSubmit = async () => {
    if (!orderId || !dateOfBirth.trim()) return;

    // Client-side validation
    const validationError = validateDate(dateOfBirth);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const currentTimestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      const graphQLMutation = {
        query: `mutation SetOrderMetafields($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              key
              value
              namespace
            }
            userErrors {
              field
              message
              code
            }
          }
        }`,
        variables: {
          metafields: [
            {
              ownerId: orderId,
              namespace: "$app",
              key: "date_of_birth",
              value: dateOfBirth,
              type: "date"
            },
            {
              ownerId: orderId,
              namespace: "$app",
              key: "verified_at",
              value: currentTimestamp,
              type: "date"
            }
          ]
        }
      };

      const response = await fetch("shopify:admin/api/graphql.json", {
        method: "POST",
        body: JSON.stringify(graphQLMutation),
      });

      if (!response.ok) {
        throw new Error("Network error");
      }

      const result = await response.json();

      if (result.data?.metafieldsSet?.userErrors?.length > 0) {
        const errorMessage = result.data.metafieldsSet.userErrors
          .map(err => err.message)
          .join(", ");
        setError(`Failed to save: ${errorMessage}`);
      } else {
        // Success - immediately update UI
        setIsVerified(true);
        setDateOfBirth("");
      }
    } catch (err) {
      console.error("Error setting metafields:", err);
      setError("Failed to save verification data");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <AdminBlock title="Age Verification">
        <BlockStack>
          <Text>Loading verification status...</Text>
        </BlockStack>
      </AdminBlock>
    );
  }

  // Already verified state
  if (isVerified) {
    return (
      <AdminBlock title="Age Verification">
        <BlockStack>
          <Text tone="success">Age verification completed ✓</Text>
        </BlockStack>
      </AdminBlock>
    );
  }

  // Verification form
  return (
    <AdminBlock title="Age Verification">
      <BlockStack gap="base">
        <Text>Please enter the customer's date of birth to complete age verification for this order.</Text>

        <Form onSubmit={handleSubmit}>
          <BlockStack gap="base">
            <TextField
              label="Date of Birth"
              value={dateOfBirth}
              onChange={setDateOfBirth}
              placeholder="YYYY-MM-DD"
              helpText="Enter date in YYYY-MM-DD format (e.g., 1990-12-25)"
              disabled={isSubmitting}
              error={error}
            />

            <Button
              variant="primary"
              onPress={handleSubmit}
              disabled={!dateOfBirth.trim() || isSubmitting}
              loading={isSubmitting}
            >
              {isSubmitting ? "Verifying..." : "Complete Verification"}
            </Button>
          </BlockStack>
        </Form>
      </BlockStack>
    </AdminBlock>
  );
}
