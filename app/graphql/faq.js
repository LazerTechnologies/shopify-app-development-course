// GraphQL operations for FAQ management

// Check if FAQ metaobject definition exists
export const GET_FAQ_METAOBJECT_DEFINITION = `
  query GetFAQMetaobjectDefinition($type: String!) {
    metaobjectDefinitionByType(type: $type) {
      id
      type
      name
    }
  }
`;

// Check if product FAQ metafield definition exists
export const GET_PRODUCT_FAQ_METAFIELD_DEFINITION = `
  query GetProductFAQMetafieldDefinition($namespace: String!, $key: String!, $ownerType: MetafieldOwnerType!) {
    metafieldDefinitions(first: 1, ownerType: $ownerType, namespace: $namespace, key: $key) {
      nodes {
        id
        namespace
        key
        name
      }
    }
  }
`;

// Create FAQ metaobject definition
export const CREATE_FAQ_METAOBJECT_DEFINITION = `
  mutation CreateFAQMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition {
        id
        type
        name
      fieldDefinitions {
        key
        name
        type {
          name
          category
        }
      }
        access {
          admin
          storefront
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

// Create product FAQ metafield definition
export const CREATE_PRODUCT_FAQ_METAFIELD_DEFINITION = `
  mutation CreateProductFAQMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
        namespace
        key
        name
        type {
          name
          category
        }
        ownerType
        access {
          admin
          storefront
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

// Create FAQ metaobject entry
export const CREATE_FAQ_ENTRY = `
  mutation CreateFAQEntry($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject {
        id
        handle
        displayName
        question: field(key: "question") { value }
        answer: field(key: "answer") { value }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

// Update FAQ metaobject entry
export const UPDATE_FAQ_ENTRY = `
  mutation UpdateFAQEntry($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject {
        id
        handle
        displayName
        question: field(key: "question") { value }
        answer: field(key: "answer") { value }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

// Delete FAQ metaobject entry
export const DELETE_FAQ_ENTRY = `
  mutation DeleteFAQEntry($id: ID!) {
    metaobjectDelete(id: $id) {
      deletedId
      userErrors {
        field
        message
        code
      }
    }
  }
`;

// Get all FAQ entries
export const GET_FAQ_ENTRIES = `
  query GetFAQEntries($first: Int!, $after: String) {
    metaobjects(type: "$app:faq", first: $first, after: $after) {
      edges {
        node {
          id
          handle
          displayName
          question: field(key: "question") { value }
          answer: field(key: "answer") { value }
          updatedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

// Get single FAQ entry
export const GET_FAQ_ENTRY = `
  query GetFAQEntry($id: ID!) {
    metaobject(id: $id) {
      id
      handle
      displayName
      question: field(key: "question") { value }
      answer: field(key: "answer") { value }
      updatedAt
    }
  }
`;

// Assign FAQs to product
export const ASSIGN_FAQS_TO_PRODUCT = `
  mutation AssignFAQsToProduct($productId: ID!, $faqIdsJson: String!) {
    metafieldsSet(metafields: [{
      ownerId: $productId
      namespace: "$app"
      key: "faqs"
      type: "list.metaobject_reference"
      value: $faqIdsJson
    }]) {
      metafields {
        id
        key
        namespace
        value
        references(first: 20) {
          nodes {
            ... on Metaobject {
              id
              handle
              question: field(key: "question") { value }
              answer: field(key: "answer") { value }
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
`;

// Get product with FAQs
export const GET_PRODUCT_WITH_FAQS = `
  query GetProductWithFAQs($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      faqs: metafield(namespace: "$app", key: "faqs") {
        value
        references(first: 20) {
          nodes {
            ... on Metaobject {
              id
              handle
              question: field(key: "question") { value }
              answer: field(key: "answer") { value }
            }
          }
        }
      }
    }
  }
`;

// Search products
export const SEARCH_PRODUCTS = `
  query SearchProducts($query: String!, $first: Int!) {
    products(query: $query, first: $first) {
      edges {
        node {
          id
          title
          handle
          featuredImage {
            altText
            url
          }
        }
      }
    }
  }
`;

// Get products with pagination
export const GET_PRODUCTS = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          title
          handle
          featuredImage {
            altText
            url
          }
          faqs: metafield(namespace: "$app", key: "faqs") {
            value
            references(first: 5) {
              nodes {
                ... on Metaobject {
                  id
                  question: field(key: "question") { value }
                }
              }
            }
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;
