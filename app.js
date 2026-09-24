/* global CATALOG_DATA */
const catalog = document.querySelector('#catalog');
const searchInput = document.querySelector('#search');
const collectionFilter = document.querySelector('#collection-filter');
const selectionCount = document.querySelector('#selection-count');
const selectionValue = document.querySelector('#selection-value');
const selectedDownload = document.querySelector('#download-selected');
const allDownload = document.querySelector('#download-all');
const toast = document.querySelector('#toast');

const selections = new Set();
const collections = CATALOG_DATA.collections;
const products = collections.flatMap((collection) => collection.products.map((product) => ({ ...product, collection: collection.name })));

const formatMoney = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
  }).format(amount);
};
const productById = (id) => products.find((product) => product.id === id);

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
  catalog.innerHTML = visible.map((product) => `
    <article class="product-card ${selections.has(product.id) ? 'is-selected' : ''}" data-product-id="${product.id}">
      <div class="product-card__top">
        ${product.image ? `<img class="product-card__image" src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{className:'product-card__placeholder',textContent:'Product image unavailable'}))" />` : '<span class="product-card__placeholder">Product image unavailable</span>'}
        <label class="product-card__check" title="Select ${product.name}">
          <span class="sr-only">Select ${product.name}</span>
          <input type="checkbox" ${selections.has(product.id) ? 'checked' : ''} data-select="${product.id}" />
        </label>
      </div>
      <div class="product-card__body">
        <div class="product-card__meta"><span class="collection-tag">${product.collection}</span><span>Item ${product.number}</span></div>
        <h3>${product.name}</h3>
        <div class="product-card__details">
          ${product.model ? `<div class="detail"><span>Model No</span><strong>${product.model}</strong></div>` : ''}
          <div class="detail"><span>Module / Spec</span><strong>${product.module || '—'}</strong></div>
          ${priceMarkup(product)}
        </div>
      </div>
    </article>
  `).join('');
}

function updateSelection() {
  const selected = [...selections].map(productById).filter(Boolean);
  const selectedPricedTotal = selected.reduce((total, product) => total + (product.discountedPrice ?? product.price ?? product.unitPrice ?? 0), 0);
  selectionCount.textContent = `${selected.length} product${selected.length === 1 ? '' : 's'} selected`;
  selectionValue.textContent = selected.some((product) => (product.discountedPrice ?? product.price ?? product.unitPrice) !== null) ? `Selected total: ${formatMoney(selectedPricedTotal)}` : '';
  selectedDownload.disabled = selected.length === 0;
}

function selectProduct(id, checked) {
  if (checked) selections.add(id);
  else selections.delete(id);
  renderCatalog();
  updateSelection();
}

function setupFilters() {
  collectionFilter.innerHTML = '<option value="">All collections</option>' + collections.map((collection) => `<option value="${collection.name}">${collection.name}</option>`).join('');
  searchInput.addEventListener('input', renderCatalog);
  collectionFilter.addEventListener('change', renderCatalog);
  catalog.addEventListener('change', (event) => {
    if (event.target.matches('[data-select]')) selectProduct(event.target.dataset.select, event.target.checked);
  });
  document.querySelector('#select-visible').addEventListener('click', () => {
    visibleProducts().forEach((product) => selections.add(product.id));
    renderCatalog();
    updateSelection();
  });
  document.querySelector('#clear-selection').addEventListener('click', () => {
    selections.clear();
    renderCatalog();
    updateSelection();
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
  // Allows valid 15-char GSTIN or 'NA' / 'N/A' for unregistered entities
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
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !visitorModalBackdrop.hidden) closeVisitorModal();
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

  const oldText = allDownload.textContent;
  allDownload.disabled = true;
  selectedDownload.disabled = true;
  try {
    const JsPDF = await loadPdfLibrary();
    const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const page = { w: 210, h: 297, margin: 14 };
    let y = 18;
    const todayFormatted = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date());

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
    doc.text('Product Price List & Quotation', page.margin, y + 5);

    doc.setFontSize(8.5);
    doc.setTextColor(88, 107, 123);
    doc.setFont('helvetica', 'normal');
    doc.text(`${items.length} Product${items.length === 1 ? '' : 's'}  ·  Sales: +91 99796 71516  ·  sales@aitworld.co.in  ·  aitworld.co.in`, page.margin, y + 11.5);
    y += 16;

    // Client / Visitor details quotation header card
    const boxW = page.w - page.margin * 2;
    const boxH = 26;
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

    // Right column: Mobile, GST, Date
    const rightColX = page.margin + 105;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(97, 113, 129);
    doc.text('Mobile Number:', rightColX, y + 12);
    doc.text('GST Number:', rightColX, y + 19);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(11, 31, 49);
    doc.text(truncateText(doc, clientInfo.phone, 55, 8.5), rightColX + 24, y + 12);
    doc.text(truncateText(doc, clientInfo.gst, 55, 8.5), rightColX + 24, y + 19);

    y += boxH + 6;

    // Render product cards
    for (let index = 0; index < items.length; index += 1) {
      const product = items[index];
      const cardHeight = 55;
      if (y + cardHeight > page.h - 14) {
        doc.addPage();
        startPage(doc.getNumberOfPages());
      }
      doc.setDrawColor(220, 228, 234);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(page.margin, y, page.w - page.margin * 2, cardHeight - 3, 2, 2, 'FD');
      try {
        const image = await loadImage(product.image);
        if (image) {
          const imgData = canvasImage(image);
          if (imgData) {
            doc.addImage(imgData, 'JPEG', page.margin + 3, y + 3, 42, 42, undefined, 'FAST');
          }
        }
      } catch (imgErr) {
        console.warn('Image could not be embedded for', product.id, imgErr);
      }
      doc.setFillColor(0, 169, 143);
      doc.roundedRect(page.margin + 4, y + 45.5, 40, 3.5, 1, 1, 'F');
      let textY = y + 8;
      textY = addWrapped(doc, product.name, page.margin + 49, textY, 127, 10.5, { bold: true });
      textY += 1.7;
      textY = addWrapped(doc, `${product.collection || ''}  ·  Item ${product.number || index + 1}  ·  Model: ${product.model || '—'}  ·  Module ${product.module || '—'}`, page.margin + 49, textY, 127, 7.7, { color: [97, 113, 129] });
      textY += 1.7;
      const priceVal = product.price ?? product.discountedPrice ?? product.unitPrice;
      const priceText = priceVal !== null && priceVal !== undefined ? `Price: ${formatMoney(priceVal)}${product.priceUnit ? ` / ${product.priceUnit}` : ''}` : 'Price unavailable in source';
      addWrapped(doc, priceText, page.margin + 49, textY, 127, 8.5, { bold: priceVal !== null && priceVal !== undefined, color: priceVal !== null && priceVal !== undefined ? [0, 125, 112] : [97, 113, 129] });
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
  const selectedItems = [...selections].map(productById).filter(Boolean);
  handleDownloadRequest(selectedItems, 'ait-selected-products.pdf');
});

allDownload.addEventListener('click', () => {
  handleDownloadRequest(products, 'ait-complete-price-list.pdf');
});

setupFilters();
renderTerms();
renderCatalog();
updateSelection();
updateVisitorBadge();


