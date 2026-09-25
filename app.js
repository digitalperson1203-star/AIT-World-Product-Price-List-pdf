/* global CATALOG_DATA */
const catalog = document.querySelector('#catalog');
const searchInput = document.querySelector('#search');
const collectionFilter = document.querySelector('#collection-filter');
const selectionCount = document.querySelector('#selection-count');
const selectionValue = document.querySelector('#selection-value');
const selectedDownload = document.querySelector('#download-selected');
const allDownload = document.querySelector('#download-all');
const toast = document.querySelector('#toast');

// Map stores: productId => { quantity: number, color?: string }
const selections = new Map();
const collections = CATALOG_DATA.collections;
const products = collections.flatMap((collection) =>
  collection.products.map((product) => ({
    ...product,
    collection: collection.name,
    collectionId: collection.id,
    technology: collection.technology || product.technology || null
  }))
);

// Switch panel collection IDs
const SWITCH_PANEL_COLLECTION_IDS = new Set([
  'azure-series',
  'elite-series',
  'glance-series',
  'elegance-series'
]);

// 6 switch panel colors with clearly isolated configuration
// 1. Black, 2. White, 3. Grey, 4. Royal Blue, 5. Dark Grey, 6. Gold (derived from Elite Series GL / AIT-EL-2M4GL.png)
const SWITCH_PANEL_COLORS = [
  { name: 'Black', hex: '#18181b', border: '#3f3f46' },
  { name: 'White', hex: '#ffffff', border: '#cbd5e1' },
  { name: 'Grey', hex: '#9ca3af', border: '#6b7280' },
  { name: 'Royal Blue', hex: '#1d4ed8', border: '#1e40af' },
  { name: 'Dark Grey', hex: '#374151', border: '#1f2937' },
  { name: 'Gold', hex: '#d4af37', border: '#b8860b' }
];

// Color image lookup for switch panel variants
const COLOR_IMAGE_MAP = {
  'elite-series': {
    'Black': 'assets/product-images/AIT-EL-2M4BK.png',
    'White': 'assets/product-images/AIT-EL-2M4WT.png',
    'Grey': 'assets/product-images/AIT-EL-2M4GR.png',
    'Royal Blue': 'assets/product-images/AIT-EL-2M4BL.png',
    'Dark Grey': 'assets/product-images/AIT-EL-2M4BK_SL.png',
    'Gold': 'assets/product-images/AIT-EL-2M4GL.png'
  },
  'azure-series': {
    'Black': 'assets/product-images/AIT-AZP-2M4S-BB.png',
    'White': 'assets/product-images/AIT-AZP-2M4S-WG.png',
    'Grey': 'assets/product-images/AIT-AZP-2M4S-SS.png',
    'Dark Grey': 'assets/product-images/AIT-AZP-2M4S-GG.png',
    'Gold': 'assets/product-images/AIT-AZP-2M4S-RS.png'
  },
  'glance-series': {
    'Black': 'assets/product-images/AIT-GL-2M4BB.png',
    'White': 'assets/product-images/AIT-GL-2M4WB.png',
    'Grey': 'assets/product-images/AIT-GL-2M4BS.png',
    'Dark Grey': 'assets/product-images/AIT-GL-2M4BS.png',
    'Gold': 'assets/product-images/AIT-GL-2M4BG.png'
  }
};

function isSwitchPanelProduct(product) {
  if (!product) return false;
  if (product.collectionId && SWITCH_PANEL_COLLECTION_IDS.has(product.collectionId)) return true;
  if (product.collection && (
    product.collection.toLowerCase().includes('touch panel') ||
    SWITCH_PANEL_COLLECTION_IDS.has(product.collection.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
  )) {
    return true;
  }
  return false;
}

function getDefaultColor(product) {
  if (!product) return SWITCH_PANEL_COLORS[1].name; // White
  const str = `${product.name} ${product.model || ''}`.toUpperCase();
  if (/\b(BK|BLACK)\b/.test(str)) return 'Black';
  if (/\b(WT|WHITE)\b/.test(str)) return 'White';
  if (/\b(GR|GREY|GRAY)\b/.test(str)) return 'Grey';
  if (/\b(BL|BLUE)\b/.test(str)) return 'Royal Blue';
  if (/\b(SL|DARK GREY|DARK GRAY)\b/.test(str)) return 'Dark Grey';
  if (/\b(GL|GOLD)\b/.test(str)) return 'Gold';
  if (str.endsWith('-BB')) return 'Black';
  if (str.endsWith('-WG')) return 'White';
  if (str.endsWith('-SS')) return 'Grey';
  if (str.endsWith('-RS')) return 'Gold';
  if (str.endsWith('-GG')) return 'Gold';
  if (str.endsWith('-BG')) return 'Gold';
  if (str.endsWith('-BS')) return 'Dark Grey';
  if (str.endsWith('-WB')) return 'White';
  if (str.endsWith('-WS')) return 'White';
  return 'White';
}

function getColorImage(product, colorName) {
  if (!product || !colorName) return product?.image || null;
  const collKey = product.collectionId || (
    product.collection?.toLowerCase().includes('elite') ? 'elite-series' :
    product.collection?.toLowerCase().includes('azure') ? 'azure-series' :
    product.collection?.toLowerCase().includes('glance') ? 'glance-series' : ''
  );
  if (COLOR_IMAGE_MAP[collKey] && COLOR_IMAGE_MAP[collKey][colorName]) {
    return COLOR_IMAGE_MAP[collKey][colorName];
  }
  return product.image;
}

function getColorHex(colorName) {
  const found = SWITCH_PANEL_COLORS.find(c => c.name.toLowerCase() === (colorName || '').toLowerCase());
  return found ? found.hex : '#ffffff';
}

const formatMoney = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
  }).format(amount);
};

const productById = (id) => products.find((product) => product.id === id);

function getProductUnitPrice(product) {
  if (!product) return null;
  return product.discountedPrice ?? product.price ?? product.unitPrice ?? null;
}

function getProductLineTotal(product, quantity = 1) {
  const unit = getProductUnitPrice(product);
  if (unit === null || unit === undefined || isNaN(unit)) return null;
  const validQty = Math.max(1, parseInt(quantity, 10) || 1);
  return unit * validQty;
}

function getSelection(productId) {
  return selections.get(productId) || null;
}

function hasSelection(productId) {
  return selections.has(productId);
}

function setSelection(productId, { quantity = 1, color = undefined } = {}) {
  const product = productById(productId);
  if (!product) return;
  const validQty = Math.max(1, parseInt(quantity, 10) || 1);
  const data = { quantity: validQty };
  if (isSwitchPanelProduct(product)) {
    data.color = color || (getSelection(productId)?.color) || getDefaultColor(product);
  }
  selections.set(productId, data);
}

function removeSelection(productId) {
  selections.delete(productId);
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

function visibleProducts() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedCollection = collectionFilter.value;
  return products.filter((product) => {
    const text = `${product.name} ${product.model || ''} ${product.module || ''} ${product.collection} ${product.series || ''}`.toLowerCase();
    return (!query || text.includes(query)) && (!selectedCollection || product.collection === selectedCollection);
  });
}

function priceMarkup(product) {
  const priceVal = product.price ?? product.unitPrice;
  const unitSuffix = product.priceUnit ? ` / ${product.priceUnit}` : '';
  if (product.discountPercent !== null && product.discountPercent !== undefined) {
    const discounted = product.discountedPrice ?? priceVal;
    return `
      <div class="detail"><span>Unit price</span><strong>${formatMoney(priceVal)}${unitSuffix}</strong></div>
      <div class="detail"><span>Discounted price</span><strong class="price">${formatMoney(discounted)}${unitSuffix}</strong></div>
      <div class="detail"><span>Discount</span><strong class="discount">${product.discountPercent}%</strong></div>
    `;
  }
  if (priceVal !== null && priceVal !== undefined) {
    return `
      <div class="detail"><span>Price</span><strong class="price">${formatMoney(priceVal)}${unitSuffix}</strong></div>
    `;
  }
  const additional = product.sourcePrices && product.sourcePrices.length ? `<p class="source-prices">Prices shown in source: ${product.sourcePrices.map(formatMoney).join(' / ')}</p>` : '';
  return `<p class="unavailable">Price not available in source.</p>${additional}`;
}

function renderCatalog() {
  const visible = visibleProducts();
  document.querySelector('#catalog-summary').textContent = `${visible.length} of ${products.length} products shown`;
  if (!visible.length) {
    catalog.innerHTML = '<div class="empty">No products match the current search or collection filter.</div>';
    return;
  }
  catalog.innerHTML = visible.map((product) => {
    const sel = selections.get(product.id);
    const isSelected = Boolean(sel);
    const isSwitchPanel = isSwitchPanelProduct(product);
    const displayImage = isSelected && sel.color ? getColorImage(product, sel.color) : product.image;
    const lineTotal = isSelected ? getProductLineTotal(product, sel.quantity) : null;
    const swatchHex = isSelected && sel.color ? getColorHex(sel.color) : '#ffffff';

    return `
      <article class="product-card ${isSelected ? 'is-selected' : ''}" data-product-id="${product.id}">
        <div class="product-card__top">
          ${displayImage ? `<img class="product-card__image" src="${displayImage}" alt="${product.name}" loading="lazy" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{className:'product-card__placeholder',textContent:'Product image unavailable'}))" />` : '<span class="product-card__placeholder">Product image unavailable</span>'}
          <button type="button" class="product-card__preview-btn" data-preview-trigger="${product.id}" title="Preview product" aria-label="Preview ${product.name}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>Preview</span>
          </button>
          <label class="product-card__check" title="Select ${product.name}">
            <span class="sr-only">Select ${product.name}</span>
            <input type="checkbox" ${isSelected ? 'checked' : ''} data-select="${product.id}" />
          </label>
        </div>
        <div class="product-card__body">
          <div class="product-card__meta"><span class="collection-tag">${product.collection}</span><span>Item ${product.number}</span></div>
          <h3 data-preview-trigger="${product.id}">${product.name}</h3>
          <div class="product-card__details">
            ${product.model ? `<div class="detail"><span>Model No</span><strong>${product.model}</strong></div>` : ''}
            <div class="detail"><span>Module / Spec</span><strong>${product.module || '—'}</strong></div>
            ${priceMarkup(product)}
          </div>
          ${isSelected ? `
            <div class="product-card__selection-info" data-stop-propagation="true">
              ${isSwitchPanel && sel.color ? `
                <div class="product-card__color-badge">
                  <span class="color-dot" style="background-color: ${swatchHex};"></span>
                  <span>Color: <strong>${sel.color}</strong></span>
                </div>
              ` : ''}
              <div class="card-qty-row">
                <span class="card-qty-label">Quantity</span>
                <div class="qty-control" role="group" aria-label="Quantity for ${product.name}">
                  <button type="button" class="qty-btn" data-action="card-decrement" data-product-id="${product.id}" aria-label="Decrease quantity" title="Decrease quantity">−</button>
                  <input type="number" class="qty-input" value="${sel.quantity}" min="1" step="1" inputmode="numeric" data-card-qty-input="${product.id}" aria-label="Quantity for ${product.name}" />
                  <button type="button" class="qty-btn" data-action="card-increment" data-product-id="${product.id}" aria-label="Increase quantity" title="Increase quantity">+</button>
                </div>
              </div>
              ${lineTotal !== null ? `
                <div class="card-line-total">
                  <span>Selected Total:</span>
                  <strong>${formatMoney(lineTotal)}</strong>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function updateSelection() {
  const selectedEntries = [...selections.entries()]
    .map(([id, sel]) => ({ product: productById(id), selection: sel }))
    .filter((item) => Boolean(item.product));

  let totalPrice = 0;
  let hasAnyPriced = false;

  for (const item of selectedEntries) {
    const lineTotal = getProductLineTotal(item.product, item.selection.quantity);
    if (lineTotal !== null) {
      totalPrice += lineTotal;
      hasAnyPriced = true;
    }
  }

  const count = selectedEntries.length;
  const totalUnits = selectedEntries.reduce((sum, item) => sum + (item.selection.quantity || 1), 0);

  selectionCount.textContent = `${count} product${count === 1 ? '' : 's'} selected${count > 0 ? ` (${totalUnits} unit${totalUnits === 1 ? '' : 's'})` : ''}`;
  selectionValue.textContent = hasAnyPriced ? `Selected total: ${formatMoney(totalPrice)}` : '';
  selectedDownload.disabled = count === 0;
}

function selectProduct(id, checked) {
  if (checked) {
    if (!selections.has(id)) {
      setSelection(id, { quantity: 1 });
    }
  } else {
    removeSelection(id);
  }
  renderCatalog();
  updateSelection();
}

function setupFilters() {
  collectionFilter.innerHTML = '<option value="">All collections</option>' + collections.map((collection) => `<option value="${collection.name}">${collection.name}</option>`).join('');
  searchInput.addEventListener('input', renderCatalog);
  collectionFilter.addEventListener('change', renderCatalog);

  // Checkbox toggle handler
  catalog.addEventListener('change', (event) => {
    if (event.target.matches('[data-select]')) {
      selectProduct(event.target.dataset.select, event.target.checked);
    }
    // Direct input change on card quantity
    if (event.target.matches('[data-card-qty-input]')) {
      const pid = event.target.dataset.cardQtyInput;
      const newQty = Math.max(1, parseInt(event.target.value, 10) || 1);
      const sel = getSelection(pid);
      if (sel) {
        sel.quantity = newQty;
        renderCatalog();
        updateSelection();
      }
    }
  });

  // Card click handling: open preview (ignoring interactive controls) and card quantity buttons
  catalog.addEventListener('click', (event) => {
    // 1. Quantity button increment on card
    const incBtn = event.target.closest('[data-action="card-increment"]');
    if (incBtn) {
      const pid = incBtn.dataset.productId;
      const sel = getSelection(pid);
      if (sel) {
        sel.quantity = (sel.quantity || 1) + 1;
        renderCatalog();
        updateSelection();
      }
      return;
    }

    // 2. Quantity button decrement on card
    const decBtn = event.target.closest('[data-action="card-decrement"]');
    if (decBtn) {
      const pid = decBtn.dataset.productId;
      const sel = getSelection(pid);
      if (sel && sel.quantity > 1) {
        sel.quantity -= 1;
        renderCatalog();
        updateSelection();
      }
      return;
    }

    // 3. Ignore checkbox, labels, interactive card controls
    if (
      event.target.closest('input') ||
      event.target.closest('label') ||
      event.target.closest('[data-stop-propagation]')
    ) {
      return;
    }

    // 4. Open preview modal if preview button, title, image, or card clicked
    const card = event.target.closest('.product-card');
    if (card && card.dataset.productId) {
      openPreviewModal(card.dataset.productId);
    }
  });

  document.querySelector('#select-visible').addEventListener('click', () => {
    const visible = visibleProducts();
    visible.forEach((product) => {
      if (!selections.has(product.id)) {
        setSelection(product.id, {
          quantity: 1,
          color: isSwitchPanelProduct(product) ? getDefaultColor(product) : undefined
        });
      }
    });
    renderCatalog();
    updateSelection();
    notify(`Selected ${visible.length} visible product${visible.length === 1 ? '' : 's'}.`);
  });

  document.querySelector('#clear-selection').addEventListener('click', () => {
    selections.clear();
    renderCatalog();
    updateSelection();
    notify('All selections cleared.');
  });
}

function loadPdfLibrary() {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'assets/vendor/jspdf.umd.min.js';
    script.onload = () => {
      if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
      else reject(new Error('jsPDF loaded but window.jspdf.jsPDF is unavailable.'));
    };
    script.onerror = () => {
      const cdn = document.createElement('script');
      cdn.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      cdn.onload = () => resolve(window.jspdf.jsPDF);
      cdn.onerror = () => reject(new Error('The PDF library could not be loaded. Please check your internet connection and try again.'));
      document.head.append(cdn);
    };
    document.head.append(script);
  });
}

function loadImage(path) {
  return new Promise((resolve) => {
    if (!path) return resolve(null);
    const image = new Image();
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(null);
      }
    }, 2500);
    image.onload = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(image);
      }
    };
    image.onerror = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(null);
      }
    };
    image.src = path;
  });
}

function canvasImage(image) {
  if (!image || !image.width || !image.height) return null;
  try {
    const side = 300;
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f5f7f8';
    context.fillRect(0, 0, side, side);
    const scale = Math.min((side - 18) / image.width, (side - 18) / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, (side - width) / 2, (side - height) / 2, width, height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (err) {
    console.warn('Canvas export failed:', err);
    return null;
  }
}

async function getProductImageData(imagePath) {
  if (!imagePath) return null;
  // 1. Instant pre-optimized high-resolution white-canvas JPEG (100% offline & reliable)
  if (window.PDF_IMAGES && window.PDF_IMAGES[imagePath]) {
    return window.PDF_IMAGES[imagePath];
  }
  // 2. Fetch as Blob + FileReader (avoid canvas tainting on localhost/server)
  try {
    const res = await fetch(imagePath);
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {}
  // 3. Fallback: Image + Canvas
  try {
    const img = await loadImage(imagePath);
    if (img) return canvasImage(img);
  } catch (e) {}
  return null;
}

function addWrapped(doc, text, x, y, width, size, options = {}) {
  doc.setFontSize(size);
  doc.setTextColor(...(options.color || [19, 35, 52]));
  doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  const cleanText = String(text || '').replace(/[^\x00-\x7F\u00A0-\u00FF\u20B9]/g, ' ');
  const lines = doc.splitTextToSize(cleanText, width);
  doc.text(lines, x, y);
  return y + lines.length * (size * .45);
}

function truncateText(doc, text, maxWidth, size) {
  doc.setFontSize(size);
  let str = String(text || '').trim().replace(/[^\x00-\x7F\u00A0-\u00FF\u20B9]/g, ' ');
  if (doc.getTextWidth(str) <= maxWidth) return str;
  while (str.length > 3 && doc.getTextWidth(str + '...') > maxWidth) {
    str = str.slice(0, -1);
  }
  return str + '...';
}

/* Product Preview Modal Elements & State */
const previewModalBackdrop = document.querySelector('#preview-modal-backdrop');
const previewModal = document.querySelector('#preview-modal');
const previewCloseBtn = document.querySelector('#preview-close-btn');
const previewCancelBtn = document.querySelector('#preview-cancel-btn');
const previewActionBtn = document.querySelector('#preview-action-btn');
const previewImage = document.querySelector('#preview-image');
const previewBadgeCollection = document.querySelector('#preview-badge-collection');
const previewBadgeTech = document.querySelector('#preview-badge-tech');
const previewCollection = document.querySelector('#preview-collection');
const previewItemNumber = document.querySelector('#preview-item-number');
const previewModalTitle = document.querySelector('#preview-modal-title');
const previewModel = document.querySelector('#preview-model');
const previewModule = document.querySelector('#preview-module');
const previewTech = document.querySelector('#preview-tech');
const previewSpecTechWrap = document.querySelector('#preview-spec-tech-wrap');
const previewPage = document.querySelector('#preview-page');
const previewSpecPageWrap = document.querySelector('#preview-spec-page-wrap');
const previewPricing = document.querySelector('#preview-pricing');
const previewColorSection = document.querySelector('#preview-color-section');
const previewColorName = document.querySelector('#preview-color-name');
const previewColorSwatches = document.querySelector('#preview-color-swatches');
const previewQtyDecrement = document.querySelector('#preview-qty-decrement');
const previewQtyIncrement = document.querySelector('#preview-qty-increment');
const previewQtyInput = document.querySelector('#preview-qty-input');
const previewLineTotal = document.querySelector('#preview-line-total');

// Temporary preview state (does not mutate quotation until confirmed)
let currentPreviewProduct = null;
let previewQty = 1;
let previewColor = 'White';

function updatePreviewDisplay() {
  if (!currentPreviewProduct) return;
  previewQtyInput.value = previewQty;

  // Calculate dynamic line total
  const unitPrice = getProductUnitPrice(currentPreviewProduct);
  if (unitPrice !== null && !isNaN(unitPrice)) {
    previewLineTotal.textContent = formatMoney(unitPrice * previewQty);
  } else {
    previewLineTotal.textContent = '—';
  }

  // Update image and swatch selection for switch panels
  if (isSwitchPanelProduct(currentPreviewProduct)) {
    const matchingImage = getColorImage(currentPreviewProduct, previewColor);
    previewImage.src = matchingImage || currentPreviewProduct.image || '';
    previewColorName.textContent = previewColor;

    const swatches = previewColorSwatches.querySelectorAll('.color-swatch');
    swatches.forEach((swatch) => {
      const isSel = swatch.dataset.color === previewColor;
      swatch.classList.toggle('is-selected', isSel);
      swatch.setAttribute('aria-checked', isSel ? 'true' : 'false');
    });
  } else {
    previewImage.src = currentPreviewProduct.image || '';
  }
}

function openPreviewModal(productId) {
  const product = productById(productId);
  if (!product) return;
  currentPreviewProduct = product;

  const existing = getSelection(productId);
  if (existing) {
    previewQty = existing.quantity || 1;
    previewColor = existing.color || getDefaultColor(product);
    previewActionBtn.textContent = 'Update selection';
  } else {
    previewQty = 1;
    previewColor = getDefaultColor(product);
    previewActionBtn.textContent = 'Add to quotation';
  }

  // Populate text fields
  previewModalTitle.textContent = product.name;
  previewCollection.textContent = product.collection;
  previewItemNumber.textContent = product.number ? `Item ${product.number}` : '';
  previewBadgeCollection.textContent = product.collection;

  if (product.technology) {
    previewBadgeTech.hidden = false;
    previewBadgeTech.textContent = product.technology;
    previewTech.textContent = product.technology;
    previewSpecTechWrap.hidden = false;
  } else {
    previewBadgeTech.hidden = true;
    previewSpecTechWrap.hidden = true;
  }

  previewModel.textContent = product.model || '—';
  previewModule.textContent = product.module || '—';

  if (product.pdfPage) {
    previewPage.textContent = `Page ${product.pdfPage}`;
    previewSpecPageWrap.hidden = false;
  } else {
    previewSpecPageWrap.hidden = true;
  }

  // Pricing markup
  const priceVal = product.price ?? product.unitPrice;
  const unitSuffix = product.priceUnit ? ` / ${product.priceUnit}` : '';
  if (product.discountPercent !== null && product.discountPercent !== undefined) {
    const discounted = product.discountedPrice ?? priceVal;
    previewPricing.innerHTML = `
      <div class="preview-price-item is-original">
        <span class="preview-price-label">Original Price</span>
        <span class="preview-price-val">${formatMoney(priceVal)}${unitSuffix}</span>
      </div>
      <div class="preview-price-item">
        <span class="preview-price-label">Discounted Price</span>
        <span class="preview-price-val">${formatMoney(discounted)}${unitSuffix}</span>
      </div>
      <span class="preview-price-discount">${product.discountPercent}% OFF</span>
    `;
  } else if (priceVal !== null && priceVal !== undefined) {
    previewPricing.innerHTML = `
      <div class="preview-price-item">
        <span class="preview-price-label">Unit Price</span>
        <span class="preview-price-val">${formatMoney(priceVal)}${unitSuffix}</span>
      </div>
    `;
  } else {
    previewPricing.innerHTML = `<p class="unavailable">Price not available in source.</p>`;
  }

  // Switch panel colors section
  if (isSwitchPanelProduct(product)) {
    previewColorSection.hidden = false;
    previewColorSwatches.innerHTML = SWITCH_PANEL_COLORS.map((c) => `
      <button type="button"
        class="color-swatch ${c.name === previewColor ? 'is-selected' : ''}"
        data-color="${c.name}"
        role="radio"
        aria-checked="${c.name === previewColor ? 'true' : 'false'}"
        aria-label="${c.name}"
        title="${c.name}">
        <span class="color-swatch__circle" style="background-color: ${c.hex}; border-color: ${c.border};"></span>
        <span class="color-swatch__label">${c.name}</span>
      </button>
    `).join('');
  } else {
    previewColorSection.hidden = true;
  }

  updatePreviewDisplay();

  previewModalBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => previewCloseBtn.focus(), 50);
}

function closePreviewModal() {
  previewModalBackdrop.hidden = true;
  document.body.style.overflow = '';
  currentPreviewProduct = null;
}

// Preview Modal Event Listeners
previewCloseBtn.addEventListener('click', closePreviewModal);
previewCancelBtn.addEventListener('click', closePreviewModal);
previewModalBackdrop.addEventListener('click', (e) => {
  if (e.target === previewModalBackdrop) closePreviewModal();
});

previewQtyDecrement.addEventListener('click', () => {
  if (previewQty > 1) {
    previewQty -= 1;
    updatePreviewDisplay();
  }
});

previewQtyIncrement.addEventListener('click', () => {
  previewQty += 1;
  updatePreviewDisplay();
});

previewQtyInput.addEventListener('input', () => {
  const val = parseInt(previewQtyInput.value, 10);
  if (!isNaN(val) && val >= 1) {
    previewQty = val;
    updatePreviewDisplay();
  }
});

previewQtyInput.addEventListener('blur', () => {
  const val = parseInt(previewQtyInput.value, 10);
  previewQty = Math.max(1, !isNaN(val) ? val : 1);
  updatePreviewDisplay();
});

previewColorSwatches.addEventListener('click', (e) => {
  const swatch = e.target.closest('.color-swatch');
  if (swatch && swatch.dataset.color) {
    previewColor = swatch.dataset.color;
    updatePreviewDisplay();
  }
});

previewActionBtn.addEventListener('click', () => {
  if (!currentPreviewProduct) return;
  const isSwitch = isSwitchPanelProduct(currentPreviewProduct);
  const existing = hasSelection(currentPreviewProduct.id);

  setSelection(currentPreviewProduct.id, {
    quantity: previewQty,
    color: isSwitch ? previewColor : undefined
  });

  renderCatalog();
  updateSelection();
  const summaryMsg = `${existing ? 'Updated' : 'Added'} ${currentPreviewProduct.name} (Qty: ${previewQty}${isSwitch ? `, ${previewColor}` : ''})`;
  closePreviewModal();
  notify(summaryMsg);
});

/* Visitor Details Management */
const visitorModalBackdrop = document.querySelector('#visitor-modal-backdrop');
const visitorForm = document.querySelector('#visitor-form');
const companyInput = document.querySelector('#visitor-company');
const nameInput = document.querySelector('#visitor-name');
const phoneInput = document.querySelector('#visitor-phone');
const gstInput = document.querySelector('#visitor-gst');
const rememberInput = document.querySelector('#remember-visitor');
const modalCloseBtn = document.querySelector('#modal-close-btn');
const modalCancelBtn = document.querySelector('#modal-cancel-btn');
const visitorBadge = document.querySelector('#visitor-badge');
const visitorBadgeText = document.querySelector('#visitor-badge-text');
const visitorBadgeEdit = document.querySelector('#visitor-badge-edit');

let currentVisitor = loadVisitorDetails();
let pendingDownloadAction = null;

function loadVisitorDetails() {
  try {
    const raw = localStorage.getItem('ait_visitor_details');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (err) {
    console.warn('Could not read saved visitor details:', err);
  }
  return null;
}

function saveVisitorDetails(details, remember) {
  currentVisitor = details;
  if (remember) {
    try {
      localStorage.setItem('ait_visitor_details', JSON.stringify(details));
    } catch (err) {
      console.warn('Could not save to localStorage:', err);
    }
  } else {
    try {
      localStorage.removeItem('ait_visitor_details');
    } catch (err) {}
  }
  updateVisitorBadge();
}

function updateVisitorBadge() {
  if (isVisitorComplete(currentVisitor)) {
    visitorBadge.hidden = false;
    visitorBadgeText.textContent = `${currentVisitor.company} (${currentVisitor.name})`;
  } else {
    visitorBadge.hidden = true;
    visitorBadgeText.textContent = '';
  }
}

function isVisitorComplete(visitor) {
  return Boolean(
    visitor &&
    typeof visitor.company === 'string' && visitor.company.trim().length >= 2 &&
    typeof visitor.name === 'string' && visitor.name.trim().length >= 2 &&
    typeof visitor.phone === 'string' && visitor.phone.trim().length >= 10 &&
    typeof visitor.gst === 'string' && visitor.gst.trim().length >= 2
  );
}

function clearFormErrors() {
  [companyInput, nameInput, phoneInput, gstInput].forEach((input) => {
    input.classList.remove('is-invalid');
  });
  ['error-company', 'error-name', 'error-phone', 'error-gst'].forEach((id) => {
    const el = document.querySelector(`#${id}`);
    if (el) el.textContent = '';
  });
}

function openVisitorModal(callback = null) {
  pendingDownloadAction = callback;
  clearFormErrors();
  if (currentVisitor) {
    companyInput.value = currentVisitor.company || '';
    nameInput.value = currentVisitor.name || '';
    phoneInput.value = currentVisitor.phone || '';
    gstInput.value = currentVisitor.gst || '';
  }
  visitorModalBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    if (!companyInput.value) companyInput.focus();
    else if (!nameInput.value) nameInput.focus();
    else if (!phoneInput.value) phoneInput.focus();
    else if (!gstInput.value) gstInput.focus();
    else companyInput.focus();
  }, 50);
}

function closeVisitorModal() {
  visitorModalBackdrop.hidden = true;
  document.body.style.overflow = '';
  clearFormErrors();
  pendingDownloadAction = null;
}

function validateVisitorForm() {
  clearFormErrors();
  let isValid = true;

  const company = companyInput.value.trim();
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const gst = gstInput.value.trim().toUpperCase();

  // Validate Company / Firm Name
  if (!company) {
    document.querySelector('#error-company').textContent = 'Please enter your firm or company name.';
    companyInput.classList.add('is-invalid');
    isValid = false;
  } else if (company.length < 2) {
    document.querySelector('#error-company').textContent = 'Company name must be at least 2 characters.';
    companyInput.classList.add('is-invalid');
    isValid = false;
  }

  // Validate Visitor Name
  if (!name) {
    document.querySelector('#error-name').textContent = 'Please enter your name.';
    nameInput.classList.add('is-invalid');
    isValid = false;
  } else if (name.length < 2) {
    document.querySelector('#error-name').textContent = 'Visitor name must be at least 2 characters.';
    nameInput.classList.add('is-invalid');
    isValid = false;
  }

  // Validate Mobile Number
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  const isPhoneValid = /^(\+91|0)?[6-9]\d{9}$/.test(cleanPhone) || /^\d{10,13}$/.test(cleanPhone);
  if (!phone) {
    document.querySelector('#error-phone').textContent = 'Please enter your mobile number.';
    phoneInput.classList.add('is-invalid');
    isValid = false;
  } else if (!isPhoneValid) {
    document.querySelector('#error-phone').textContent = 'Please enter a valid 10-digit mobile number.';
    phoneInput.classList.add('is-invalid');
    isValid = false;
  }

  // Validate GST Number
  const cleanGst = gst.replace(/\s+/g, '');
  const isGstValid = /^(NA|N\/A|URP|[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Zz][0-9A-Z]{1})$/i.test(cleanGst) || /^[0-9A-Z]{15}$/.test(cleanGst);
  if (!gst) {
    document.querySelector('#error-gst').textContent = 'Please enter GST number (or NA if not registered).';
    gstInput.classList.add('is-invalid');
    isValid = false;
  } else if (!isGstValid) {
    document.querySelector('#error-gst').textContent = 'Enter a valid 15-digit GSTIN (e.g. 24AAAAA0000A1Z5) or NA.';
    gstInput.classList.add('is-invalid');
    isValid = false;
  }

  if (!isValid) return null;

  return {
    company,
    name,
    phone: cleanPhone,
    gst: cleanGst.toUpperCase()
  };
}

// Clear error state on input
[companyInput, nameInput, phoneInput, gstInput].forEach((input) => {
  input.addEventListener('input', () => {
    input.classList.remove('is-invalid');
    const fieldId = input.id.replace('visitor-', '');
    const err = document.querySelector(`#error-${fieldId}`);
    if (err) err.textContent = '';
  });
});

gstInput.addEventListener('input', () => {
  gstInput.value = gstInput.value.toUpperCase();
});

visitorForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const validated = validateVisitorForm();
  if (!validated) return;

  saveVisitorDetails(validated, rememberInput.checked);
  const actionToRun = pendingDownloadAction;
  closeVisitorModal();
  notify(`Welcome, ${validated.name}! Generating your customized price list...`);

  if (typeof actionToRun === 'function') {
    actionToRun(validated);
  }
});

modalCloseBtn.addEventListener('click', closeVisitorModal);
modalCancelBtn.addEventListener('click', closeVisitorModal);
visitorModalBackdrop.addEventListener('click', (e) => {
  if (e.target === visitorModalBackdrop) closeVisitorModal();
});

// Global Escape Key Listener for Modals
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!previewModalBackdrop.hidden) {
      closePreviewModal();
      return;
    }
    if (!visitorModalBackdrop.hidden) {
      closeVisitorModal();
      return;
    }
  }
});

visitorBadgeEdit.addEventListener('click', () => {
  openVisitorModal();
});

async function downloadPdf(items, filename, visitor = null) {
  if (!items || !items.length) return;
  const clientInfo = visitor || currentVisitor;
  if (!isVisitorComplete(clientInfo)) {
    openVisitorModal((validated) => downloadPdf(items, filename, validated));
    return;
  }

  const isSelectedPdf = filename.includes('selected');
  const oldText = allDownload.textContent;
  allDownload.disabled = true;
  selectedDownload.disabled = true;

  try {
    const JsPDF = await loadPdfLibrary();
    const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const page = { w: 210, h: 297, margin: 14 };
    let y = 18;
    const todayFormatted = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date());

    // Calculate grand totals and total units for selected quotation
    let quotationGrandTotal = 0;
    let totalUnits = 0;
    items.forEach((item) => {
      const prod = item.product || item;
      const q = item.quantity || 1;
      totalUnits += q;
      const uPrice = getProductUnitPrice(prod);
      if (uPrice !== null && !isNaN(uPrice)) {
        quotationGrandTotal += uPrice * q;
      }
    });

    const startPage = (pageNum = 1) => {
      doc.setFillColor(11, 31, 49);
      doc.rect(0, 0, page.w, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      
      const leftHeader = 'AIT WORLD AUTOMATION  -  PRODUCT PRICE LIST';
      const rightHeader = pageNum === 1 ? `DATE: ${todayFormatted}` : truncateText(doc, `CLIENT: ${clientInfo.company}`, 90, 8);
      doc.text(leftHeader, page.margin, 7.8);
      doc.text(rightHeader, page.w - page.margin, 7.8, { align: 'right' });
      y = 19;
    };

    // First page top banner
    startPage(1);

    // Title row
    doc.setFontSize(18);
    doc.setTextColor(11, 31, 49);
    doc.setFont('helvetica', 'bold');
    doc.text(isSelectedPdf ? 'Personalized Quotation & Price List' : 'Product Price List & Catalog', page.margin, y + 5);

    doc.setFontSize(8.5);
    doc.setTextColor(88, 107, 123);
    doc.setFont('helvetica', 'normal');

    const subtitleText = isSelectedPdf
      ? `${items.length} Selected Product${items.length === 1 ? '' : 's'} (${totalUnits} Total Units)  ·  Quotation Total: ${formatMoney(quotationGrandTotal)}  ·  Sales: +91 99796 71516`
      : `${items.length} Products in Catalog  ·  Sales: +91 99796 71516  ·  sales@aitworld.co.in  ·  aitworld.co.in`;
    doc.text(subtitleText, page.margin, y + 11.5);
    y += 16;

    // Client / Visitor details quotation header card
    const boxW = page.w - page.margin * 2;
    const boxH = isSelectedPdf ? 30 : 26;
    doc.setFillColor(244, 248, 250);
    doc.setDrawColor(204, 218, 228);
    doc.roundedRect(page.margin, y, boxW, boxH, 2, 2, 'FD');

    // Teal accent bar on the left
    doc.setFillColor(0, 169, 143);
    doc.rect(page.margin, y, 2.5, boxH, 'F');

    // Header badge
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 125, 112);
    doc.text('CLIENT / VISITOR QUOTATION DETAILS', page.margin + 6, y + 5.5);

    // Left column: Company & Visitor Name
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(97, 113, 129);
    doc.text('Firm / Company:', page.margin + 6, y + 12);
    doc.text('Visitor Name:', page.margin + 6, y + 19);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(11, 31, 49);
    doc.text(truncateText(doc, clientInfo.company, 75, 8.5), page.margin + 32, y + 12);
    doc.text(truncateText(doc, clientInfo.name, 75, 8.5), page.margin + 32, y + 19);

    // Right column: Mobile, GST, and Quotation Grand Total (if selected)
    const rightColX = page.margin + 105;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(97, 113, 129);
    doc.text('Mobile Number:', rightColX, y + 12);
    doc.text('GST Number:', rightColX, y + 19);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(11, 31, 49);
    doc.text(truncateText(doc, clientInfo.phone, 55, 8.5), rightColX + 24, y + 12);
    doc.text(truncateText(doc, clientInfo.gst, 55, 8.5), rightColX + 24, y + 19);

    if (isSelectedPdf) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(97, 113, 129);
      doc.text('Quotation Total:', rightColX, y + 25.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 125, 112);
      doc.text(`${formatMoney(quotationGrandTotal)} (${totalUnits} Units)`, rightColX + 24, y + 25.5);
    }

    y += boxH + 6;

    // Render product cards
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const product = item.product || item;
      const qty = item.quantity || 1;
      const selectedColor = item.color || null;
      const cardHeight = 56;

      if (y + cardHeight > page.h - 14) {
        doc.addPage();
        startPage(doc.getNumberOfPages());
      }

      doc.setDrawColor(220, 228, 234);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(page.margin, y, page.w - page.margin * 2, cardHeight - 3, 2, 2, 'FD');

      // Embedded product image (color matched if applicable)
      try {
        const imagePath = selectedColor ? getColorImage(product, selectedColor) : product.image;
        const imgData = await getProductImageData(imagePath);
        if (imgData) {
          doc.addImage(imgData, 'JPEG', page.margin + 3, y + 3, 42, 42, undefined, 'FAST');
        }
      } catch (imgErr) {
        console.warn('Image could not be embedded for', product.id, imgErr);
      }

      // Bottom left accent bar under image
      doc.setFillColor(0, 169, 143);
      doc.roundedRect(page.margin + 4, y + 46.5, 40, 3.5, 1, 1, 'F');

      let textY = y + 7.5;
      textY = addWrapped(doc, product.name, page.margin + 49, textY, 127, 10, { bold: true });
      textY += 1.6;

      // Meta specs row
      const specLine = `${product.collection || ''}  ·  Item ${product.number || index + 1}  ·  Model: ${product.model || '—'}  ·  Module: ${product.module || '—'}`;
      textY = addWrapped(doc, specLine, page.margin + 49, textY, 127, 7.5, { color: [97, 113, 129] });

      // Selected color row (only displayed when color is selected/applicable)
      if (selectedColor) {
        textY += 1.6;
        textY = addWrapped(doc, `Selected Color: ${selectedColor}`, page.margin + 49, textY, 127, 8, { bold: true, color: [18, 54, 83] });
      }

      textY += 1.8;
      const unitVal = getProductUnitPrice(product);

      if (isSelectedPdf) {
        // Detailed quotation line item with Unit Price, Quantity, Line Total
        if (unitVal !== null && unitVal !== undefined) {
          const lineTotal = unitVal * qty;
          const pricingText = `Unit Price: ${formatMoney(unitVal)}   ·   Quantity: ${qty}   ·   Line Total: ${formatMoney(lineTotal)}`;
          addWrapped(doc, pricingText, page.margin + 49, textY, 127, 8.5, { bold: true, color: [0, 125, 112] });
        } else {
          addWrapped(doc, `Price unavailable in source   ·   Quantity: ${qty}`, page.margin + 49, textY, 127, 8, { color: [97, 113, 129] });
        }
      } else {
        // Complete catalog card
        const priceText = unitVal !== null && unitVal !== undefined ? `Price: ${formatMoney(unitVal)}${product.priceUnit ? ` / ${product.priceUnit}` : ''}` : 'Price unavailable in source';
        addWrapped(doc, priceText, page.margin + 49, textY, 127, 8.5, { bold: unitVal !== null && unitVal !== undefined, color: unitVal !== null && unitVal !== undefined ? [0, 125, 112] : [97, 113, 129] });
      }

      y += cardHeight;
      if (index % 5 === 0 || index === items.length - 1) {
        allDownload.textContent = `Preparing ${index + 1}/${items.length}`;
        selectedDownload.textContent = `Preparing ${index + 1}/${items.length}`;
      }
    }

    const pages = doc.getNumberOfPages();
    for (let pageNo = 1; pageNo <= pages; pageNo += 1) {
      doc.setPage(pageNo);
      doc.setTextColor(97, 113, 129);
      doc.setFontSize(7);
      doc.text(`Page ${pageNo} of ${pages}  -  Prepared for ${truncateText(doc, clientInfo.company, 60, 7)} (${truncateText(doc, clientInfo.name, 40, 7)})  -  Prices taken from supplied price list. Taxes & duties extra.`, page.margin, 291);
    }
    doc.save(filename);
    notify(`PDF generated for ${clientInfo.name} (${items.length} products). Download started!`);
  } catch (error) {
    console.error('PDF export error:', error);
    notify(error.message || 'An error occurred while generating the PDF.');
  } finally {
    allDownload.textContent = oldText;
    selectedDownload.textContent = 'Download selected PDF';
    allDownload.disabled = false;
    updateSelection();
  }
}

function handleDownloadRequest(items, filename) {
  if (!items || !items.length) {
    notify('Please select at least one product to download.');
    return;
  }
  if (isVisitorComplete(currentVisitor)) {
    downloadPdf(items, filename, currentVisitor);
  } else {
    openVisitorModal((validated) => {
      downloadPdf(items, filename, validated);
    });
  }
}

function renderTerms() {
  const uniqueTerms = [...new Set(CATALOG_DATA.terms)];
  document.querySelector('#terms-list').innerHTML = uniqueTerms.map((term) => `<li>${term}</li>`).join('');
}

selectedDownload.addEventListener('click', () => {
  const selectedItems = [...selections.entries()]
    .map(([id, sel]) => ({
      product: productById(id),
      quantity: sel.quantity,
      color: sel.color
    }))
    .filter((item) => Boolean(item.product));
  handleDownloadRequest(selectedItems, 'ait-selected-products.pdf');
});

allDownload.addEventListener('click', () => {
  const allItems = products.map((product) => ({
    product,
    quantity: 1,
    color: null
  }));
  handleDownloadRequest(allItems, 'ait-complete-price-list.pdf');
});

setupFilters();
renderTerms();
renderCatalog();
updateSelection();
updateVisitorBadge();



