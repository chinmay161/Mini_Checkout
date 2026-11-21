// Products Catalog (fixed, synthetic)
const PRODUCTS = {
  notebook: {
    id: 'notebook',
    name: 'Canvas Notebook',
    priceCents: 1250,
  },
  pens: {
    id: 'pens',
    name: 'Gel Pen Set',
    priceCents: 499,
  },
};

const REF_CHARS = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

// Intl Currency Formatter
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function formatCents(cents) {
  return currencyFormatter.format(cents / 100);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Generate Order Reference: "ORD-" + 8 uppercase chars using crypto.getRandomValues
function generateOrderReference() {
  const randomBytes = new Uint8Array(8);
  window.crypto.getRandomValues(randomBytes);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += REF_CHARS[randomBytes[i] % REF_CHARS.length];
  }
  return `ORD-${code}`;
}

// Strictly validate integer 1-99
function parseValidQuantity(val) {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num < 1 || num > 99) return null;
  return num;
}

// State
let cart = {}; // { [id]: { id, name, priceCents, quantity } }
let orderPlaced = false;
let isSubmitting = false;

window.orderPlaced = false;
window.isSubmitting = false;

// DOM Elements
const cartItemsContainer = document.getElementById('cart-items');
const orderTotalEl = document.getElementById('order-total');
const cartErrorContainer = document.getElementById('cart-error-container');
const nameErrorContainer = document.getElementById('name-error-container');
const confirmationContainer = document.getElementById('confirmation-container');
const checkoutForm = document.getElementById('checkout-form');
const checkoutView = document.getElementById('checkout-view');
const nameInput = document.getElementById('name-input');
const placeOrderBtn = document.getElementById('place-order');
const cartSection = document.getElementById('cart-section');
const checkoutSection = document.getElementById('checkout-section');
const addNotebookBtn = document.getElementById('add-notebook');
const addPensBtn = document.getElementById('add-pens');

// Calculate and update order total
function updateOrderTotal() {
  let totalCents = 0;
  for (const id in cart) {
    totalCents += cart[id].quantity * cart[id].priceCents;
  }
  orderTotalEl.textContent = formatCents(totalCents);
}

// Update line total element for a product
function updateLineTotal(productId) {
  const lineTotalEl = document.querySelector(`[data-testid="line-total-${productId}"]`);
  if (lineTotalEl && cart[productId]) {
    lineTotalEl.textContent = formatCents(cart[productId].quantity * cart[productId].priceCents);
  }
}

// Update + and - buttons disabled states
function updateButtonStates(productId) {
  const decBtn = document.querySelector(`[data-testid="qty-dec-${productId}"]`);
  const incBtn = document.querySelector(`[data-testid="qty-inc-${productId}"]`);
  if (!cart[productId]) return;
  const qty = cart[productId].quantity;
  if (decBtn) {
    decBtn.disabled = (qty <= 1);
  }
  if (incBtn) {
    incBtn.disabled = (qty >= 99);
  }
}

// Clear cart error
function clearCartError() {
  cartErrorContainer.replaceChildren();
}

// Show cart error
function showCartError() {
  if (!document.getElementById('cart-error')) {
    const errorEl = document.createElement('div');
    errorEl.id = 'cart-error';
    errorEl.setAttribute('data-testid', 'cart-error');
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('tabindex', '-1');
    errorEl.className = 'error-message';
    errorEl.textContent = 'Your cart is empty. Add at least one item before placing your order.';
    cartErrorContainer.replaceChildren(errorEl);
  }
}

// Clear name error
function clearNameError() {
  nameErrorContainer.replaceChildren();
  nameInput.removeAttribute('aria-invalid');
  nameInput.removeAttribute('aria-describedby');
}

// Show name error
function showNameError() {
  if (!document.getElementById('name-error')) {
    const errorEl = document.createElement('div');
    errorEl.id = 'name-error';
    errorEl.setAttribute('data-testid', 'name-error');
    errorEl.setAttribute('role', 'alert');
    errorEl.className = 'error-message';
    errorEl.textContent = 'Please enter your full name.';
    nameErrorContainer.replaceChildren(errorEl);
  }
  nameInput.setAttribute('aria-invalid', 'true');
  nameInput.setAttribute('aria-describedby', 'name-error');
}

// Focus cart error
function focusCartError() {
  const err = document.getElementById('cart-error');
  if (err) {
    err.focus();
  }
}

// Render cart DOM based on current cart state
function renderCart() {
  cartItemsContainer.replaceChildren();
  const productIds = Object.keys(cart);

  if (productIds.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.setAttribute('data-testid', 'cart-empty-message');
    emptyMsg.id = 'cart-empty-message';
    emptyMsg.textContent = 'Your cart is empty';
    cartItemsContainer.appendChild(emptyMsg);
    updateOrderTotal();
    return;
  }

  for (const id of productIds) {
    const item = cart[id];
    const lineEl = document.createElement('div');
    lineEl.className = 'cart-line';
    lineEl.id = `cart-line-${id}`;
    lineEl.setAttribute('data-testid', `cart-line-${id}`);

    lineEl.innerHTML = `
      <div class="cart-line-main">
        <span class="cart-line-name">${escapeHtml(item.name)}</span>
        <span class="cart-line-unit-price">${formatCents(item.priceCents)}</span>
      </div>
      <div class="cart-line-qty-controls">
        <button
          type="button"
          class="btn-qty"
          id="qty-dec-${id}"
          data-testid="qty-dec-${id}"
          aria-label="Decrease quantity of ${escapeHtml(item.name)}"
          ${item.quantity <= 1 ? 'disabled' : ''}
        >-</button>
        <label for="qty-${id}" class="visually-hidden">Quantity of ${escapeHtml(item.name)}</label>
        <input
          type="number"
          class="qty-input"
          id="qty-${id}"
          data-testid="qty-${id}"
          min="1"
          max="99"
          step="1"
          value="${item.quantity}"
          aria-label="Quantity of ${escapeHtml(item.name)}"
        />
        <button
          type="button"
          class="btn-qty"
          id="qty-inc-${id}"
          data-testid="qty-inc-${id}"
          aria-label="Increase quantity of ${escapeHtml(item.name)}"
          ${item.quantity >= 99 ? 'disabled' : ''}
        >+</button>
      </div>
      <div class="cart-line-right">
        <span class="cart-line-total" id="line-total-${id}" data-testid="line-total-${id}">${formatCents(item.quantity * item.priceCents)}</span>
        <button
          type="button"
          class="btn-remove"
          id="remove-${id}"
          data-testid="remove-${id}"
          aria-label="Remove ${escapeHtml(item.name)} from cart"
        >Remove</button>
      </div>
    `;

    cartItemsContainer.appendChild(lineEl);
    attachCartLineListeners(id, lineEl);
  }

  updateOrderTotal();
}

// Attach listeners for a single cart line
function attachCartLineListeners(productId, lineEl) {
  const decBtn = lineEl.querySelector(`[data-testid="qty-dec-${productId}"]`);
  const incBtn = lineEl.querySelector(`[data-testid="qty-inc-${productId}"]`);
  const qtyInput = lineEl.querySelector(`[data-testid="qty-${productId}"]`);
  const removeBtn = lineEl.querySelector(`[data-testid="remove-${productId}"]`);

  // Decrement button
  decBtn.addEventListener('click', () => {
    if (orderPlaced || !cart[productId]) return;
    if (cart[productId].quantity > 1) {
      cart[productId].quantity -= 1;
      qtyInput.value = cart[productId].quantity;
      updateLineTotal(productId);
      updateOrderTotal();
      updateButtonStates(productId);
    }
  });

  // Increment button
  incBtn.addEventListener('click', () => {
    if (orderPlaced || !cart[productId]) return;
    if (cart[productId].quantity < 99) {
      cart[productId].quantity += 1;
      qtyInput.value = cart[productId].quantity;
      updateLineTotal(productId);
      updateOrderTotal();
      updateButtonStates(productId);
    }
  });

  // Quantity input: on input event
  qtyInput.addEventListener('input', () => {
    if (orderPlaced || !cart[productId]) return;
    const parsed = parseValidQuantity(qtyInput.value);
    if (parsed !== null) {
      cart[productId].quantity = parsed;
      updateLineTotal(productId);
      updateOrderTotal();
      updateButtonStates(productId);
    }
    // If invalid mid-typing, do not update cart or show NaN
  });

  // Quantity input: revert on change or blur if invalid
  function handleRevertIfInvalid() {
    if (orderPlaced || !cart[productId]) return;
    const parsed = parseValidQuantity(qtyInput.value);
    if (parsed === null) {
      // Revert field to last valid quantity
      qtyInput.value = cart[productId].quantity;
      updateButtonStates(productId);
    } else {
      qtyInput.value = parsed;
      cart[productId].quantity = parsed;
      updateLineTotal(productId);
      updateOrderTotal();
      updateButtonStates(productId);
    }
  }

  qtyInput.addEventListener('change', handleRevertIfInvalid);
  qtyInput.addEventListener('blur', handleRevertIfInvalid);

  // Blur and commit on Enter key
  qtyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      qtyInput.blur();
    }
  });

  // Remove button
  removeBtn.addEventListener('click', () => {
    if (orderPlaced) return;
    delete cart[productId];
    renderCart();
  });
}

// Add item to cart
function addToCart(productId) {
  if (orderPlaced) return;
  const product = PRODUCTS[productId];
  if (!product) return;

  if (cart[productId]) {
    cart[productId].quantity = Math.min(99, cart[productId].quantity + 1);
    const qtyInput = document.querySelector(`[data-testid="qty-${productId}"]`);
    if (qtyInput) {
      qtyInput.value = cart[productId].quantity;
    }
    updateLineTotal(productId);
    updateOrderTotal();
    updateButtonStates(productId);
  } else {
    cart[productId] = {
      id: product.id,
      name: product.name,
      priceCents: product.priceCents,
      quantity: 1,
    };
    renderCart();
  }

  // Clear cart error as soon as an item is added
  clearCartError();
}

// Disable all cart controls and form inputs when order placed
function disableAllControls() {
  placeOrderBtn.disabled = true;
  nameInput.disabled = true;
  addNotebookBtn.disabled = true;
  addPensBtn.disabled = true;

  const cartButtons = cartSection.querySelectorAll('button');
  cartButtons.forEach(btn => {
    btn.disabled = true;
  });

  const cartInputs = cartSection.querySelectorAll('input');
  cartInputs.forEach(input => {
    input.disabled = true;
  });
}

// Enable all controls when starting a new order
function enableAllControls() {
  placeOrderBtn.disabled = false;
  nameInput.disabled = false;
  addNotebookBtn.disabled = false;
  addPensBtn.disabled = false;
}

// Render confirmation block
function renderConfirmation(orderRef, customerName) {
  let totalCents = 0;
  const items = [];
  for (const id in cart) {
    const item = cart[id];
    totalCents += item.quantity * item.priceCents;
    items.push({
      name: item.name,
      quantity: item.quantity,
    });
  }
  const formattedTotal = formatCents(totalCents);

  const confirmationEl = document.createElement('section');
  confirmationEl.id = 'confirmation';
  confirmationEl.setAttribute('data-testid', 'confirmation');
  confirmationEl.setAttribute('role', 'status');
  confirmationEl.className = 'confirmation-card';

  confirmationEl.innerHTML = `
    <h2 tabindex="-1">Order confirmed</h2>
    <p class="confirmation-detail">Order reference: <strong id="order-reference" data-testid="order-reference">${escapeHtml(orderRef)}</strong></p>
    <p class="confirmation-detail">Customer: <strong id="confirmation-name" data-testid="confirmation-name">${escapeHtml(customerName)}</strong></p>
    <div class="confirmation-items-box">
      <h3>Ordered Items</h3>
      <ul class="confirmation-items-list">
        ${items.map(item => `<li>${escapeHtml(item.name)} × ${item.quantity}</li>`).join('')}
      </ul>
    </div>
    <p class="confirmation-total-box">Total: <strong id="confirmation-total" data-testid="confirmation-total">${formattedTotal}</strong></p>
    <div>
      <button type="button" class="btn btn-primary" id="new-order" data-testid="new-order">Start new order</button>
    </div>
  `;

  confirmationContainer.replaceChildren(confirmationEl);

  const headingEl = confirmationEl.querySelector('h2');
  if (headingEl) {
    headingEl.focus();
  }

  const newOrderBtn = confirmationEl.querySelector('#new-order');
  newOrderBtn.addEventListener('click', handleNewOrder);
}

// Start new order reset
function handleNewOrder() {
  orderPlaced = false;
  isSubmitting = false;
  window.orderPlaced = false;
  window.isSubmitting = false;

  cart = {};
  nameInput.value = '';

  clearCartError();
  clearNameError();

  enableAllControls();
  renderCart();

  confirmationContainer.replaceChildren();

  checkoutView.hidden = false;
  cartSection.hidden = false;
  checkoutSection.hidden = false;
  checkoutForm.hidden = false;

  addNotebookBtn.focus();
}

// Event Listeners for Add to Cart buttons
addNotebookBtn.addEventListener('click', () => {
  addToCart('notebook');
});

addPensBtn.addEventListener('click', () => {
  addToCart('pens');
});

// Guard Place Order button direct clicks if order already placed
placeOrderBtn.addEventListener('click', (event) => {
  if (orderPlaced || isSubmitting) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});

// Clear name error as soon as name becomes non-blank
nameInput.addEventListener('input', () => {
  if (nameInput.value.trim().length > 0) {
    clearNameError();
  }
});

// Checkout Form Submission
checkoutForm.addEventListener('submit', (event) => {
  event.preventDefault();

  // If already placed, return immediately (double-submit guard)
  if (orderPlaced || isSubmitting) {
    return;
  }

  // Validate
  const hasCartItems = Object.keys(cart).length > 0;
  const rawName = nameInput.value;
  const trimmedName = rawName.trim();
  const hasValidName = trimmedName.length > 0;

  let hasError = false;

  if (!hasCartItems) {
    showCartError();
    hasError = true;
  } else {
    clearCartError();
  }

  if (!hasValidName) {
    showNameError();
    hasError = true;
  } else {
    clearNameError();
  }

  if (hasError) {
    // Focus first invalid field/area
    if (!hasCartItems) {
      focusCartError();
    } else if (!hasValidName) {
      nameInput.focus();
    }
    return;
  }

  // FIRST SYNCHRONOUS ACTION AFTER VALIDATION PASSES:
  orderPlaced = true;
  isSubmitting = true;
  window.orderPlaced = true;
  window.isSubmitting = true;

  // Disable Place Order button, name input, and all cart controls
  disableAllControls();

  // Hide entire checkout view (products + cart + form)
  checkoutView.hidden = true;
  cartSection.hidden = true;
  checkoutSection.hidden = true;
  checkoutForm.hidden = true;

  // Generate order reference and render confirmation
  const orderRef = generateOrderReference();
  renderConfirmation(orderRef, trimmedName);
});
