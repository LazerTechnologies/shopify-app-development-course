import { useState, useCallback } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  Modal,
  TextField,
  FormLayout,
  Toast,
  Frame,
  Banner,
  Text,
  Badge,
  EmptyState,
  Spinner,
} from "@shopify/polaris";
import { PlusIcon, EditIcon, DeleteIcon } from "@shopify/polaris-icons";

// Server imports moved to loader/action functions to avoid client-side bundling

export const meta = () => {
  return [{ title: "FAQs | FAQ Manager" }];
};

export async function loader({ request }) {
  try {
    // Import server functions locally to avoid client-side bundling
    const { initializeFAQSystem, getFAQEntries } = await import("../services/faq.server");

    // Initialize FAQ system if needed
    const initResult = await initializeFAQSystem(request);

    // Get all FAQ entries
    const faqsResult = await getFAQEntries(request);

    return json({
      faqs: faqsResult.faqs || [],
      initResult: initResult,
      success: faqsResult.success,
      error: faqsResult.error,
    });
  } catch (error) {
    return json({
      faqs: [],
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
    const { createFAQEntry, updateFAQEntry, deleteFAQEntry } = await import("../services/faq.server");

    switch (action) {
      case "create": {
        const question = formData.get("question");
        const answer = formData.get("answer");

        if (!question || !answer) {
          return json({
            success: false,
            error: "Question and answer are required",
          });
        }

        const result = await createFAQEntry(request, { question, answer });
        return json(result);
      }

      case "update": {
        const id = formData.get("id");
        const question = formData.get("question");
        const answer = formData.get("answer");

        if (!id || !question || !answer) {
          return json({
            success: false,
            error: "ID, question and answer are required",
          });
        }

        const result = await updateFAQEntry(request, { id, question, answer });
        return json(result);
      }

      case "delete": {
        const id = formData.get("id");

        if (!id) {
          return json({
            success: false,
            error: "FAQ ID is required",
          });
        }

        const result = await deleteFAQEntry(request, id);
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

export default function FAQsPage() {
  const { faqs, initResult, success, error } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [modalActive, setModalActive] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);

  const isLoading = navigation.state === "submitting";

  // Handle action results
  if (actionData?.success) {
    if (toastActive === false) {
      setToastActive(true);
      setToastMessage(editingFAQ ? "FAQ updated successfully" : "FAQ created successfully");
      setToastError(false);
      setModalActive(false);
      setEditingFAQ(null);
      setQuestion("");
      setAnswer("");
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
    setEditingFAQ(null);
    setQuestion("");
    setAnswer("");
  }, []);

  const handleNewFAQ = useCallback(() => {
    setEditingFAQ(null);
    setQuestion("");
    setAnswer("");
    setModalActive(true);
  }, []);

  const handleEditFAQ = useCallback((faq) => {
    setEditingFAQ(faq);
    setQuestion(faq.question?.value || "");
    setAnswer(faq.answer?.value || "");
    setModalActive(true);
  }, []);

  const handleDeleteFAQ = useCallback((faq) => {
    if (confirm(`Are you sure you want to delete "${faq.question?.value}"?`)) {
      const formData = new FormData();
      formData.append("action", "delete");
      formData.append("id", faq.id);
      submit(formData, { method: "post" });
    }
  }, [submit]);

  const handleSubmit = useCallback(() => {
    if (!question.trim() || !answer.trim()) {
      setToastMessage("Question and answer are required");
      setToastError(true);
      setToastActive(true);
      return;
    }

    const formData = new FormData();
    formData.append("action", editingFAQ ? "update" : "create");
    formData.append("question", question.trim());
    formData.append("answer", answer.trim());

    if (editingFAQ) {
      formData.append("id", editingFAQ.id);
    }

    submit(formData, { method: "post" });
  }, [question, answer, editingFAQ, submit]);

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      error={toastError}
      onDismiss={() => setToastActive(false)}
    />
  ) : null;

  // Prepare data for DataTable
  const rows = faqs.map((faq) => [
    faq.question?.value || "",
    faq.answer?.value || "",
    <div key={faq.id} style={{ display: "flex", gap: "8px" }}>
      <Button
        size="micro"
        icon={EditIcon}
        onClick={() => handleEditFAQ(faq)}
        accessibilityLabel={`Edit ${faq.question?.value}`}
      />
      <Button
        size="micro"
        icon={DeleteIcon}
        tone="critical"
        onClick={() => handleDeleteFAQ(faq)}
        accessibilityLabel={`Delete ${faq.question?.value}`}
      />
    </div>,
  ]);

  const headings = ["Question", "Answer", "Actions"];

  return (
    <Frame>
      <Page
        title="FAQ Management"
        primaryAction={{
          content: "Add FAQ",
          icon: PlusIcon,
          onAction: handleNewFAQ,
          disabled: isLoading,
        }}
      >
        <Layout>
          <Layout.Section>
            {!success && error && (
              <Banner tone="critical" title="Error loading FAQs">
                <p>{error}</p>
              </Banner>
            )}

            {initResult && !initResult.success && (
              <Banner tone="warning" title="FAQ System Initialization">
                <p>There was an issue setting up the FAQ system: {initResult.error}</p>
              </Banner>
            )}

            <Card>
              {faqs.length === 0 ? (
                <EmptyState
                  heading="No FAQs yet"
                  action={{
                    content: "Add your first FAQ",
                    onAction: handleNewFAQ,
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Start building your FAQ collection to help customers find answers quickly.</p>
                </EmptyState>
              ) : (
                <>
                  <div style={{ padding: "16px" }}>
                    <Text variant="bodyMd" as="p" color="subdued">
                      {faqs.length} FAQ{faqs.length !== 1 ? "s" : ""} created
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
          title={editingFAQ ? "Edit FAQ" : "Add New FAQ"}
          primaryAction={{
            content: editingFAQ ? "Update FAQ" : "Create FAQ",
            onAction: handleSubmit,
            loading: isLoading,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: handleModalClose,
            },
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <TextField
                label="Question"
                value={question}
                onChange={setQuestion}
                placeholder="What would you like to know?"
                maxLength={200}
                showCharacterCount
                autoComplete="off"
                disabled={isLoading}
              />
              <TextField
                label="Answer"
                value={answer}
                onChange={setAnswer}
                placeholder="Provide a helpful answer..."
                multiline={4}
                maxLength={1000}
                showCharacterCount
                autoComplete="off"
                disabled={isLoading}
              />
            </FormLayout>
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
