/**
 * Branding Service - Handle font uploads and checkout branding
 */

/**
 * Get the active (published) checkout profile
 */
export async function getActiveCheckoutProfile(admin) {
  try {
    console.log("🔍 Fetching active checkout profile...");

    const response = await admin.graphql(`
      #graphql
      query checkoutProfiles {
        checkoutProfiles(first: 1, query: "is_published:true") {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `);

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const profile = data.data?.checkoutProfiles?.edges?.[0]?.node;

    if (!profile) {
      throw new Error("No published checkout profile found");
    }

    console.log("✅ Found checkout profile:", profile.id);
    return profile;
  } catch (error) {
    console.error("❌ Failed to get checkout profile:", error);
    throw error;
  }
}

/**
 * Create staged upload target for font file
 */
export async function createStagedUpload(admin, filename, fileSize) {
  try {
    console.log("📤 Creating staged upload for:", filename);

    // Validate file extension first
    const isWoff = filename.toLowerCase().endsWith(".woff");
    const isWoff2 = filename.toLowerCase().endsWith(".woff2");

    if (!isWoff && !isWoff2) {
      throw new Error("Only .woff and .woff2 font files are supported");
    }

    // Determine MIME type based on extension
    const mimeType = isWoff2 ? "font/woff2" : "font/woff";

    console.log(
      `📝 File validation: ${filename}, MIME: ${mimeType}, Size: ${fileSize} bytes`,
    );

    const response = await admin.graphql(
      `
      #graphql
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
      {
        variables: {
          input: [
            {
              filename,
              mimeType,
              resource: "FILE",
              httpMethod: "POST",
              fileSize: fileSize.toString(),
            },
          ],
        },
      },
    );

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    if (data.data.stagedUploadsCreate.userErrors?.length > 0) {
      throw new Error(
        `Staged upload errors: ${JSON.stringify(data.data.stagedUploadsCreate.userErrors)}`,
      );
    }

    const target = data.data.stagedUploadsCreate.stagedTargets[0];
    console.log("✅ Staged upload created:", target.resourceUrl);

    return target;
  } catch (error) {
    console.error("❌ Failed to create staged upload:", error);
    throw error;
  }
}

/**
 * Create file record from staged upload
 */
export async function createFileFromStaged(admin, stagedResourceUrl, filename) {
  try {
    console.log("📄 Creating file record from staged upload...");

    const response = await admin.graphql(
      `
      #graphql
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            fileStatus
            ... on GenericFile {
              url
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `,
      {
        variables: {
          files: [
            {
              alt: `Custom checkout font: ${filename}`,
              contentType: "FILE",
              originalSource: stagedResourceUrl,
              filename,
            },
          ],
        },
      },
    );

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    if (data.data.fileCreate.userErrors?.length > 0) {
      throw new Error(
        `File creation errors: ${JSON.stringify(data.data.fileCreate.userErrors)}`,
      );
    }

    const file = data.data.fileCreate.files[0];
    console.log("✅ File created:", file.id, "Status:", file.fileStatus);

    return file;
  } catch (error) {
    console.error("❌ Failed to create file:", error);
    throw error;
  }
}

/**
 * Wait for file to be in READY status
 */
export async function waitForFileReady(admin, fileId, maxAttempts = 20) {
  try {
    console.log("⏳ Waiting for file to be ready...", fileId);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await admin.graphql(
        `
          #graphql
          query getFileStatus($id: ID!) {
            node(id: $id) {
              ... on File {
                id
                fileStatus
                ... on GenericFile {
                  url
                }
              }
            }
          }
        `,
        {
          variables: {
            id: fileId,
          },
        },
      );

      const data = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      const file = data.data.node;
      console.log(`🔄 Attempt ${attempt}: File status is ${file.fileStatus}`);

      if (file.fileStatus === "READY") {
        console.log("✅ File is ready for use!");
        return file;
      }

      if (file.fileStatus === "FAILED") {
        throw new Error("File processing failed");
      }

      // Wait 1 second before next attempt
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(
      `File did not become ready after ${maxAttempts} attempts. Status may still be PROCESSING.`,
    );
  } catch (error) {
    console.error("❌ Failed to wait for file ready:", error);
    throw error;
  }
}

/**
 * Apply font to ALL checkout typography (primary, secondary, buttons)
 */
export async function applyFontToCheckout(
  admin,
  checkoutProfileId,
  fontFileId,
) {
  try {
    console.log("🎨 Applying font to checkout typography...", {
      checkoutProfileId,
      fontFileId,
    });

    const response = await admin.graphql(
      `
      #graphql
      mutation checkoutBrandingUpsert($checkoutBrandingInput: CheckoutBrandingInput!, $checkoutProfileId: ID!) {
        checkoutBrandingUpsert(checkoutBrandingInput: $checkoutBrandingInput, checkoutProfileId: $checkoutProfileId) {
          checkoutBranding {
            designSystem {
              typography {
                primary {
                  name
                  base {
                    sources
                    weight
                  }
                  bold {
                    sources
                    weight
                  }
                }
                secondary {
                  name
                  base {
                    sources
                    weight
                  }
                  bold {
                    sources
                    weight
                  }
                }
              }
            }
            customizations {
              primaryButton {
                typography {
                  font
                }
              }
              secondaryButton {
                typography {
                  font
                }
              }
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `,
      {
        variables: {
          checkoutProfileId,
          checkoutBrandingInput: {
            designSystem: {
              typography: {
                // Set custom font as PRIMARY typography
                primary: {
                  customFontGroup: {
                    base: {
                      genericFileId: fontFileId,
                      weight: 400,
                    },
                    bold: {
                      genericFileId: fontFileId,
                      weight: 700,
                    },
                  },
                },
                // Set same font as SECONDARY typography
                secondary: {
                  customFontGroup: {
                    base: {
                      genericFileId: fontFileId,
                      weight: 400,
                    },
                    bold: {
                      genericFileId: fontFileId,
                      weight: 700,
                    },
                  },
                },
              },
            },
            customizations: {
              // Apply PRIMARY font to buttons (which will use our custom font)
              primaryButton: {
                typography: {
                  font: "PRIMARY",
                },
              },
              secondaryButton: {
                typography: {
                  font: "PRIMARY",
                },
              },
            },
          },
        },
      },
    );

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    if (data.data.checkoutBrandingUpsert.userErrors?.length > 0) {
      throw new Error(
        `Branding update errors: ${JSON.stringify(data.data.checkoutBrandingUpsert.userErrors)}`,
      );
    }

    const branding = data.data.checkoutBrandingUpsert.checkoutBranding;
    console.log("✅ Checkout branding updated successfully");

    return branding;
  } catch (error) {
    console.error("❌ Failed to apply font to checkout:", error);
    throw error;
  }
}

/**
 * Complete font upload and branding process
 */
export async function uploadFontAndApplyBranding(admin, fontFile, fileBuffer) {
  try {
    console.log("🚀 Starting complete font upload process...", {
      filename: fontFile.name,
      size: fontFile.size,
    });

    // Step 1: Get active checkout profile
    const checkoutProfile = await getActiveCheckoutProfile(admin);

    // Step 2: Create staged upload
    const stagedTarget = await createStagedUpload(
      admin,
      fontFile.name,
      fontFile.size,
    );

    // Step 3: Upload file to staged URL
    console.log("📤 Uploading font file to staged URL...");

    // Determine correct MIME type based on file extension
    const isWoff2 = fontFile.name.toLowerCase().endsWith(".woff2");
    const correctMimeType = isWoff2 ? "font/woff2" : "font/woff";

    console.log(
      `📝 Using MIME type: ${correctMimeType} for file: ${fontFile.name}`,
    );

    const formData = new FormData();

    // Add all required parameters from Shopify
    stagedTarget.parameters.forEach((param) => {
      formData.append(param.name, param.value);
    });

    // Add the actual file with correct MIME type
    formData.append(
      "file",
      new Blob([fileBuffer], { type: correctMimeType }),
      fontFile.name,
    );

    const uploadResponse = await fetch(stagedTarget.url, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(
        `File upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`,
      );
    }

    console.log("✅ File uploaded to staging area");

    // Step 4: Create file record
    const file = await createFileFromStaged(
      admin,
      stagedTarget.resourceUrl,
      fontFile.name,
    );

    // Step 5: Wait for file to be ready
    const readyFile = await waitForFileReady(admin, file.id);

    // Step 6: Apply font to checkout
    const branding = await applyFontToCheckout(
      admin,
      checkoutProfile.id,
      readyFile.id,
    );

    console.log("🎉 Font upload and branding complete!");

    return {
      success: true,
      data: {
        file,
        branding,
        checkoutProfile,
      },
    };
  } catch (error) {
    console.error("💥 Complete font upload process failed:", {
      message: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}
