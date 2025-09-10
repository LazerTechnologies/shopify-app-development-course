import { useState, useCallback } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  Modal,
  FormLayout,
  Toast,
  Frame,
  Banner,
  Text,
  Badge,
  EmptyState,
  Spinner,
  TextField,
  Listbox,
  Combobox,
  Tag,
  InlineStack,
  BlockStack,
} from "@shopify/polaris";
import { EditIcon, SearchIcon } from "@shopify/polaris-icons";

// Server imports moved to loader/action functions to avoid client-side bundling

export const meta = () => {
  return [{ title: "Products | FAQ Manager" }];
};

export async function loader({ request }) {
  try {
    // Import server functions locally to avoid client-side bundling
    const { getProducts, searchProducts, getFAQEntries } = await import("../services/faq.server");

    const url = new URL(request.url);
    const search = url.searchParams.get("search");

    let productsResult;
    if (search) {
      productsResult = await searchProducts(request, { query: search });
    } else {
      productsResult = await getProducts(request);
    }

    const faqsResult = await getFAQEntries(request, { first: 100 });

    return json({
      products: productsResult.products || [],
      faqs: faqsResult.faqs || [],
      search: search || "",
      success: productsResult.success && faqsResult.success,
      error: productsResult.error || faqsResult.error,
    });
  } catch (error) {
    return json({
      products: [],
      faqs: [],
      search: "",
      success: false,
      error: error.message,
    });
  }
}

export async function action({ request }) {
  const formData = await request.formData();
  const action = formData.get("action");

  try {
    // Import server functions locally to avoid client-side bundling
    const { assignFAQsToProduct } = await import("../services/faq.server");

    switch (action) {
      case "assign_faqs": {
        const productId = formData.get("productId");
        const faqIdsString = formData.get("faqIds");

        if (!productId) {
          return json({
            success: false,
            error: "Product ID is required",
          });
        }

        const faqIds = faqIdsString ? JSON.parse(faqIdsString) : [];
        const result = await assignFAQsToProduct(request, { productId, faqIds });
        return json(result);
      }

      default:
        return json({
          success: false,
          error: "Invalid action",
        });
    }
  } catch (error) {
    return json({
      success: false,
      error: error.message,
    });
  }
}

export default function ProductsPage() {
  const { products, faqs, search, success, error } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [modalActive, setModalActive] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedFAQs, setSelectedFAQs] = useState([]);
  const [searchValue, setSearchValue] = useState(search);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);

  const isLoading = navigation.state === "submitting";

  // Handle action results
  if (actionData?.success) {
    if (toastActive === false) {
      setToastActive(true);
      setToastMessage("FAQs assigned successfully");
      setToastError(false);
      setModalActive(false);
      setSelectedProduct(null);
      setSelectedFAQs([]);
    }
  } else if (actionData?.error) {
    if (toastActive === false) {
      setToastActive(true);
      setToastMessage(actionData.error);
      setToastError(true);
    }
  }

  const handleModalClose = useCallback(() => {
    setModalActive(false);
    setSelectedProduct(null);
    setSelectedFAQs([]);
  }, []);

  const handleEditProduct = useCallback((product) => {
    setSelectedProduct(product);

    // Pre-populate with existing FAQs
    const existingFAQs = product.faqs?.references?.nodes || [];
    setSelectedFAQs(existingFAQs.map(faq => faq.id));

    setModalActive(true);
  }, []);

  const handleSearch = useCallback(() => {
    const formData = new FormData();
    formData.append("search", searchValue);
    submit(formData, { method: "get" });
  }, [searchValue, submit]);

  const handleSubmit = useCallback(() => {
    if (!selectedProduct) return;

    const formData = new FormData();
    formData.append("action", "assign_faqs");
    formData.append("productId", selectedProduct.id);
    formData.append("faqIds", JSON.stringify(selectedFAQs));

    submit(formData, { method: "post" });
  }, [selectedProduct, selectedFAQs, submit]);

  const handleFAQToggle = useCallback((faqId) => {
    setSelectedFAQs(prev => {
      if (prev.includes(faqId)) {
        return prev.filter(id => id !== faqId);
      } else {
        return [...prev, faqId];
      }
    });
  }, []);

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      error={toastError}
      onDismiss={() => setToastActive(false)}
    />
  ) : null;

  // Prepare data for DataTable
  const rows = products.map((product) => {
    const faqCount = product.faqs?.references?.nodes?.length || 0;
    const faqPreview = product.faqs?.references?.nodes
      ?.slice(0, 2)
      .map(faq => faq.question?.value)
      .join(", ") || "";

    return [
      <div key={product.id}>
        <Text variant="bodyMd" fontWeight="medium">
          {product.title}
        </Text>
        <Text variant="bodySm" color="subdued">
          {product.handle}
        </Text>
      </div>,
      faqCount > 0 ? (
        <div>
          <Badge tone="info">{faqCount} FAQ{faqCount !== 1 ? "s" : ""}</Badge>
          {faqPreview && (
            <Text variant="bodySm" color="subdued" as="div" truncate>
              {faqPreview}
              {faqCount > 2 && "..."}
            </Text>
          )}
        </div>
      ) : (
        <Text variant="bodySm" color="subdued">No FAQs assigned</Text>
      ),
      <Button
        key={product.id}
        size="micro"
        icon={EditIcon}
        onClick={() => handleEditProduct(product)}
        accessibilityLabel={`Manage FAQs for ${product.title}`}
      >
        Manage FAQs
      </Button>,
    ];
  });

  const headings = ["Product", "FAQs", "Actions"];

  return (
    <Frame>
      <Page
        title="Product FAQ Management"
        subtitle="Assign FAQs to your products"
      >
        <Layout>
          <Layout.Section>
            {!success && error && (
              <Banner tone="critical" title="Error loading data">
                <p>{error}</p>
              </Banner>
            )}

            <Card>
              <div style={{ padding: "16px" }}>
                <FormLayout>
                  <TextField
                    label="Search products"
                    value={searchValue}
                    onChange={setSearchValue}
                    placeholder="Search by product title..."
                    prefix={<SearchIcon />}
                    connectedRight={
                      <Button onClick={handleSearch} disabled={isLoading}>
                        Search
                      </Button>
                    }
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleSearch();
                      }
                    }}
                  />
                </FormLayout>
              </div>
            </Card>

            <Card>
              {products.length === 0 ? (
                <EmptyState
                  heading={search ? "No products found" : "No products"}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    {search
                      ? `No products found for "${search}". Try a different search term.`
                      : "You don't have any products yet. Create some products first to assign FAQs to them."
                    }
                  </p>
                </EmptyState>
              ) : (
                <>
                  <div style={{ padding: "16px" }}>
                    <Text variant="bodyMd" as="p" color="subdued">
                      {products.length} product{products.length !== 1 ? "s" : ""}
                      {search && ` found for "${search}"`}
                    </Text>
                  </div>
                  <DataTable
                    columnContentTypes={["text", "text", "text"]}
                    headings={headings}
                    rows={rows}
                    verticalAlign="top"
                  />
                </>
              )}
            </Card>
          </Layout.Section>
        </Layout>

        <Modal
          open={modalActive}
          onClose={handleModalClose}
          title={`Manage FAQs for ${selectedProduct?.title}`}
          primaryAction={{
            content: "Save FAQ Assignment",
            onAction: handleSubmit,
            loading: isLoading,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: handleModalClose,
            },
          ]}
          large
        >
          <Modal.Section>
            {faqs.length === 0 ? (
              <EmptyState
                heading="No FAQs available"
                action={{
                  content: "Create FAQs",
                  url: "/app/faqs",
                  external: false,
                }}
              >
                <p>You need to create some FAQs first before you can assign them to products.</p>
              </EmptyState>
            ) : (
              <BlockStack gap="400">
                <Text variant="headingMd" as="h3">
                  Select FAQs to assign to this product
                </Text>

                <Text variant="bodyMd" color="subdued">
                  {selectedFAQs.length} of {faqs.length} FAQs selected
                </Text>

                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                  <BlockStack gap="200">
                    {faqs.map((faq) => {
                      const isSelected = selectedFAQs.includes(faq.id);
                      return (
                        <Card
                          key={faq.id}
                          background={isSelected ? "surface-selected" : "surface"}
                        >
                          <div
                            style={{
                              padding: "16px",
                              cursor: "pointer",
                              border: isSelected ? "2px solid #008060" : "2px solid transparent",
                              borderRadius: "8px",
                            }}
                            onClick={() => handleFAQToggle(faq.id)}
                          >
                            <BlockStack gap="200">
                              <InlineStack align="space-between">
                                <Text variant="bodyMd" fontWeight="medium">
                                  {faq.question?.value}
                                </Text>
                                {isSelected && (
                                  <Badge tone="success">Selected</Badge>
                                )}
                              </InlineStack>
                              <Text variant="bodySm" color="subdued">
                                {faq.answer?.value}
                              </Text>
                            </BlockStack>
                          </div>
                        </Card>
                      );
                    })}
                  </BlockStack>
                </div>
              </BlockStack>
            )}
          </Modal.Section>
        </Modal>

        {isLoading && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}>
            <Spinner size="large" />
          </div>
        )}

        {toastMarkup}
      </Page>
    </Frame>
  );
}
