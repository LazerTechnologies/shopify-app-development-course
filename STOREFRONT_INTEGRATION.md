# FAQ Manager - Storefront Integration Guide

This document explains how to access and display FAQ data in your Shopify theme after using the FAQ Manager app.

## How FAQ Data is Stored

The FAQ Manager app creates:
1. **FAQ Metaobjects**: Individual FAQ entries with question and answer fields
2. **Product Metafields**: References to FAQ metaobjects attached to products

## Accessing FAQ Data in Liquid

### Get Product FAQs

```liquid
{% comment %} Get the FAQ metafield for a product {% endcomment %}
{% assign product_faqs = product.metafields.app.faqs %}

{% if product_faqs %}
  <div class="product-faqs">
    <h3>Frequently Asked Questions</h3>
    
    {% for faq_reference in product_faqs.value %}
      {% assign faq = faq_reference %}
      
      <div class="faq-item">
        <h4 class="faq-question">{{ faq.question.value }}</h4>
        <div class="faq-answer">{{ faq.answer.value | newline_to_br }}</div>
      </div>
    {% endfor %}
  </div>
{% endif %}
```

### Styled FAQ Section

```liquid
<div class="faq-section">
  {% assign product_faqs = product.metafields.app.faqs %}
  
  {% if product_faqs %}
    <h3>Frequently Asked Questions</h3>
    
    <div class="faq-list">
      {% for faq_reference in product_faqs.value %}
        {% assign faq = faq_reference %}
        
        <details class="faq-item">
          <summary class="faq-question">
            {{ faq.question.value }}
          </summary>
          <div class="faq-answer">
            {{ faq.answer.value | newline_to_br }}
          </div>
        </details>
      {% endfor %}
    </div>
  {% endif %}
</div>

<style>
.faq-section {
  margin: 2rem 0;
}

.faq-list {
  border: 1px solid #e1e1e1;
  border-radius: 8px;
  overflow: hidden;
}

.faq-item {
  border-bottom: 1px solid #e1e1e1;
}

.faq-item:last-child {
  border-bottom: none;
}

.faq-question {
  padding: 1rem;
  background: #f8f8f8;
  cursor: pointer;
  font-weight: 600;
  margin: 0;
}

.faq-question:hover {
  background: #f0f0f0;
}

.faq-answer {
  padding: 1rem;
  background: white;
}
</style>
```

## Using with Storefront API

### GraphQL Query for Product FAQs

```graphql
query getProductWithFAQs($handle: String!) {
  product(handle: $handle) {
    id
    title
    faqs: metafield(namespace: "app", key: "faqs") {
      references(first: 20) {
        nodes {
          ... on Metaobject {
            id
            handle
            question: field(key: "question") {
              value
            }
            answer: field(key: "answer") {
              value
            }
          }
        }
      }
    }
  }
}
```

### JavaScript Implementation

```javascript
// Fetch product FAQs using Storefront API
async function getProductFAQs(productHandle) {
  const query = `
    query getProductWithFAQs($handle: String!) {
      product(handle: $handle) {
        id
        title
        faqs: metafield(namespace: "app", key: "faqs") {
          references(first: 20) {
            nodes {
              ... on Metaobject {
                id
                question: field(key: "question") { value }
                answer: field(key: "answer") { value }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch('/api/2024-01/graphql.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': 'your-storefront-access-token'
    },
    body: JSON.stringify({
      query,
      variables: { handle: productHandle }
    })
  });

  const data = await response.json();
  return data.data.product.faqs?.references?.nodes || [];
}

// Render FAQs on page
function renderFAQs(faqs) {
  const container = document.getElementById('product-faqs');
  
  if (faqs.length === 0) {
    container.style.display = 'none';
    return;
  }

  const faqHtml = faqs.map(faq => `
    <details class="faq-item">
      <summary class="faq-question">${faq.question.value}</summary>
      <div class="faq-answer">${faq.answer.value.replace(/\n/g, '<br>')}</div>
    </details>
  `).join('');

  container.innerHTML = `
    <h3>Frequently Asked Questions</h3>
    <div class="faq-list">${faqHtml}</div>
  `;
}
```

## Template Files to Modify

Add FAQ sections to these common template files:

### Product Template (`sections/product-form.liquid` or `templates/product.liquid`)
```liquid
{% comment %} Add after product description {% endcomment %}
{% render 'product-faqs', product: product %}
```

### Product Card Snippet (`snippets/product-card.liquid`)
```liquid
{% comment %} Add FAQ count indicator {% endcomment %}
{% assign faq_count = product.metafields.app.faqs.value.size %}
{% if faq_count > 0 %}
  <div class="product-faq-indicator">
    {{ faq_count }} FAQ{{ faq_count | pluralize }}
  </div>
{% endif %}
```

## Notes

- FAQ data is automatically available in both admin and storefront contexts
- No additional API configuration needed
- FAQs are reusable across multiple products
- All FAQ content is searchable by Shopify's search functionality
- FAQ data persists even if the app is uninstalled (standard Shopify behavior for metaobjects)

## Need Help?

If you need assistance integrating FAQs into your theme, consult:
- [Shopify Liquid Documentation](https://shopify.dev/docs/api/liquid)
- [Metaobject Liquid Reference](https://shopify.dev/docs/api/liquid/objects/metaobject)
- [Storefront API Documentation](https://shopify.dev/docs/api/storefront)
