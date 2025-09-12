import {
  reactExtension,
  Banner,
  BlockStack,
  DateField,
  Text,
  useApi,
  useApplyAttributeChange,
  useInstructions,
  useTranslate,
  useBuyerJourneyIntercept,
  useExtensionCapability,
} from "@shopify/ui-extensions-react/checkout";
import { useState } from "react";

// 1. Choose an extension target
export default reactExtension("purchase.checkout.block.render", () => (
  <Extension />
));

function Extension() {
  const translate = useTranslate();
  const { extension } = useApi();
  const instructions = useInstructions();
  const applyAttributeChange = useApplyAttributeChange();
  const canBlockProgress = useExtensionCapability("block_progress");

  // State for date of birth and validation
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [validationError, setValidationError] = useState("");

  // Age calculation function
  const calculateAge = (birthDate) => {
    if (!birthDate) return 0;

    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Format date for MM/DD/YYYY display
  const formatDateForDisplay = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Buyer journey intercept for validation and blocking
  useBuyerJourneyIntercept(({ canBlockProgress }) => {
    // Clear any existing field-level errors when validation runs
    setValidationError("");

    // Check if date of birth is required and filled
    if (canBlockProgress && !dateOfBirth) {
      return {
        behavior: "block",
        reason: "Date of birth is required",
        perform: (result) => {
          if (result.behavior === "block") {
            setValidationError("Please enter your date of birth");
          }
        },
      };
    }

    // Check age requirement (must be 18 or older)
    if (canBlockProgress && dateOfBirth) {
      const age = calculateAge(dateOfBirth);
      if (age < 18) {
        return {
          behavior: "block",
          reason: "Must be 18 or older to complete purchase",
          errors: [
            {
              message: "You must be 18 years of age or older to complete this purchase.",
            },
          ],
        };
      }
    }

    return {
      behavior: "allow",
      perform: () => {
        // Clear any validation errors when validation passes
        setValidationError("");
      },
    };
  });

  // Handle date change
  const handleDateChange = async (newDate) => {
    setDateOfBirth(newDate);
    setValidationError(""); // Clear field-level errors immediately

    // Update cart attribute with the selected date
    if (newDate) {
      const result = await applyAttributeChange({
        key: "date_of_birth",
        type: "updateAttribute",
        value: newDate,
      });
      console.log("Date of birth updated:", result);
    }
  };

  // Clear validation errors when user starts typing
  const handleDateInput = () => {
    setValidationError("");
  };

  // Check instructions for feature availability
  if (!instructions.attributes.canUpdateAttributes) {
    return (
      <Banner title="Date of Birth Verification" status="warning">
        Date of birth verification is not available for this checkout type.
      </Banner>
    );
  }

  // Determine field label based on blocking capability
  const fieldLabel = canBlockProgress ? "Date of Birth" : "Date of Birth (optional)";

  // Render the date of birth verification UI
  return (
    <BlockStack spacing="base">
      <DateField
        label={fieldLabel}
        value={dateOfBirth}
        onChange={handleDateChange}
        onInput={handleDateInput}
        required={canBlockProgress}
        error={validationError}
      />
      {dateOfBirth && (
        <Text size="small" appearance="subdued">
          Date entered: {formatDateForDisplay(dateOfBirth)}
        </Text>
      )}
    </BlockStack>
  );
}
