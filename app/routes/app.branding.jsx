import { json } from "@remix-run/node";
import { useActionData, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  DropZone,
  Banner,
  Spinner,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useState, useCallback, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { uploadFontAndApplyBranding } from "../services/branding.server";

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);

    const formData = await request.formData();
    const fontFile = formData.get('fontFile');

    if (!fontFile || !fontFile.size) {
      return json({
        success: false,
        error: "No font file provided"
      }, { status: 400 });
    }

    // Convert file to buffer for upload
    const fileBuffer = await fontFile.arrayBuffer();

    // Process the font upload and apply to checkout
    const result = await uploadFontAndApplyBranding(admin, {
      name: fontFile.name,
      size: fontFile.size,
      type: fontFile.type
    }, fileBuffer);

    return json(result);

  } catch (error) {
    console.error('Branding action error:', error);
    return json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
};

export default function BrandingPage() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  // Handle successful upload
  useEffect(() => {
    if (actionData?.success) {
      shopify.toast.show("✅ Checkout font updated successfully!");
      setFiles([]);
      setIsProcessing(false);
    } else if (actionData?.error) {
      shopify.toast.show(`❌ Error: ${actionData.error}`, { isError: true });
      setIsProcessing(false);
    }
  }, [actionData, shopify]);

  // Validate font file
  const customValidator = useCallback((file) => {
    const validExtensions = ['.woff', '.woff2'];
    const validMimeTypes = ['font/woff', 'font/woff2', 'application/font-woff', 'application/font-woff2'];

    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    const hasValidMimeType = validMimeTypes.includes(file.type);

    return hasValidExtension || hasValidMimeType;
  }, []);

  // Handle file drop - immediately upload
  const handleDropZoneDrop = useCallback(async (dropFiles, acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      shopify.toast.show("❌ Please upload only .woff or .woff2 font files", { isError: true });
      return;
    }

    if (acceptedFiles.length === 0) {
      return;
    }

    const fontFile = acceptedFiles[0];
    setFiles([fontFile]);
    setIsProcessing(true);

    // Immediately submit the form
    const formData = new FormData();
    formData.append('fontFile', fontFile);

    try {
      const response = await fetch('/app/branding', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        shopify.toast.show("🎨 Checkout font updated successfully!");
        setFiles([]);
      } else {
        shopify.toast.show(`❌ Error: ${result.error}`, { isError: true });
        setFiles([]);
      }
    } catch (error) {
      shopify.toast.show(`❌ Upload failed: ${error.message}`, { isError: true });
      setFiles([]);
    } finally {
      setIsProcessing(false);
    }
  }, [shopify]);

  // Render uploaded files
  const uploadedFiles = files.length > 0 && (
    <BlockStack gap="200">
      {files.map((file, index) => (
        <InlineStack key={index} align="space-between" blockAlign="center">
          <Text as="span" variant="bodyMd">
            📄 {file.name}
          </Text>
          <Text as="span" variant="bodySm" tone="subdued">
            {Math.round(file.size / 1024)} KB
          </Text>
        </InlineStack>
      ))}
    </BlockStack>
  );

  const fileUpload = !files.length && !isProcessing && (
    <DropZone.FileUpload
      actionTitle="Drop font file here"
      actionHint="Only .woff and .woff2 files supported"
    />
  );

  const processingIndicator = isProcessing && (
    <InlineStack gap="200" align="center">
      <Spinner size="small" />
      <Text as="span" variant="bodyMd">
        Uploading font and updating checkout...
      </Text>
    </InlineStack>
  );

  return (
    <Page>
      <TitleBar title="Checkout Branding" />

      <BlockStack gap="500">
        {/* Instructions */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              🎨 Custom Checkout Fonts
            </Text>
            <Text as="p" variant="bodyMd">
              Upload a custom font file to instantly change the typography across your entire checkout experience.
              The font will be applied to all text, headings, and buttons.
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Supported formats: .woff and .woff2 files only
            </Text>
          </BlockStack>
        </Card>

        {/* Error Banner */}
        {actionData?.error && (
          <Banner tone="critical">
            <Text as="p">Upload failed: {actionData.error}</Text>
          </Banner>
        )}

        {/* Font Upload Drop Zone */}
        <Card>
          <BlockStack gap="400">
            <Text as="h3" variant="headingMd">
              Upload Font File
            </Text>

            <DropZone
              accept=".woff,.woff2"
              type="file"
              allowMultiple={false}
              customValidator={customValidator}
              onDrop={handleDropZoneDrop}
              disabled={isProcessing || isSubmitting}
            >
              {processingIndicator}
              {uploadedFiles}
              {fileUpload}
            </DropZone>

            <Text as="p" variant="bodySm" tone="subdued">
              💡 Tip: Changes are applied immediately when you drop a font file.
              Visit your store's checkout to see the new typography in action.
            </Text>
          </BlockStack>
        </Card>

        {/* Success State */}
        {actionData?.success && (
          <Banner tone="success">
            <BlockStack gap="200">
              <Text as="p">
                🎉 Font successfully uploaded and applied to checkout!
              </Text>
              <Text as="p" variant="bodySm">
                Your checkout now uses the custom font for all typography including text, headings, and buttons.
              </Text>
            </BlockStack>
          </Banner>
        )}
      </BlockStack>
    </Page>
  );
}
