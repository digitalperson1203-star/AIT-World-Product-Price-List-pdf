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

const formatMoney = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
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
    const text = `${product.name} ${product.module || ''} ${product.collection}`.toLowerCase();
    return (!query || text.includes(query)) && (!selectedCollection || product.collection === selectedCollection);
  });
}

function priceMarkup(product) {
  if (product.unitPrice !== null) {
    const discounted = product.discountedPrice ?? product.unitPrice;
    return `
      <div class="detail"><span>Unit price</span><strong>${formatMoney(product.unitPrice)}</strong></div>
      <div class="detail"><span>Discounted price</span><strong class="price">${formatMoney(discounted)}</strong></div>
      ${product.discountPercent !== null ? `<div class="detail"><span>Discount</span><strong class="discount">${product.discountPercent}%</strong></div>` : ''}
    `;
  }
  const additional = product.sourcePrices.length ? `<p class="source-prices">Prices shown in source: ${product.sourcePrices.map(formatMoney).join(' / ')}</p>` : '';
  return `<p class="unavailable">Price not available in the source price column.</p>${additional}`;
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
        ${product.image ? `<img class="product-card__image" src="${product.image}" alt="${product.name}" loading="lazy" />` : '<span class="product-card__placeholder">Product image unavailable</span>'}
        <label class="product-card__check" title="Select ${product.name}">
          <span class="sr-only">Select ${product.name}</span>
          <input type="checkbox" ${selections.has(product.id) ? 'checked' : ''} data-select="${product.id}" />
        </label>
      </div>
      <div class="product-card__body">
        <div class="product-card__meta"><span class="collection-tag">${product.collection}</span><span>Item ${product.number}</span></div>
        <h3>${product.name}</h3>
        <div class="product-card__details">
          <div class="detail"><span>Module size</span><strong>${product.module || '—'}</strong></div>
          ${priceMarkup(product)}
        </div>
      </div>
    </article>
  `).join('');
}

function updateSelection() {
  const selected = [...selections].map(productById).filter(Boolean);
  const selectedPricedTotal = selected.reduce((total, product) => total + (product.discountedPrice ?? 0), 0);
  selectionCount.textContent = `${selected.length} product${selected.length === 1 ? '' : 's'} selected`;
  selectionValue.textContent = selected.some((product) => product.discountedPrice !== null) ? `Listed discounted total: ${formatMoney(selectedPricedTotal)}` : '';
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
  if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = () => reject(new Error('The PDF library could not be loaded. Check your internet connection and try again.'));
    document.head.append(script);
  });
}

function loadImage(path) {
  return new Promise((resolve) => {
    if (!path) return resolve(null);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = path;
  });
}

function canvasImage(image) {
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
  return canvas.toDataURL('image/jpeg', .78);
}

function addWrapped(doc, text, x, y, width, size, options = {}) {
  doc.setFontSize(size);
  doc.setTextColor(...(options.color || [19, 35, 52]));
  doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return y + lines.length * (size * .45);
}

async function downloadPdf(items, filename) {
  if (!items.length) return;
  const oldText = allDownload.textContent;
  allDownload.disabled = true;
  selectedDownload.disabled = true;
  try {
    const JsPDF = await loadPdfLibrary();
    const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const page = { w: 210, h: 297, margin: 14 };
    let y = 18;
    const startPage = () => {
      doc.setFillColor(11, 31, 49);
      doc.rect(0, 0, page.w, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('AIT WORLD AUTOMATION  ·  PRODUCT PRICE LIST', page.margin, 7.8);
      y = 20;
    };
    startPage();
    doc.setFontSize(21);
    doc.setTextColor(11, 31, 49);
    doc.text('Selected product price list', page.margin, y + 7);
    doc.setFontSize(9);
    doc.setTextColor(88, 107, 123);
    doc.text(`${items.length} products  |  Sales: +91 99796 71516  |  sales@aitworld.co.in`, page.margin, y + 14);
    y += 22;
    for (let index = 0; index < items.length; index += 1) {
      const product = items[index];
      const cardHeight = 55;
      if (y + cardHeight > page.h - 14) {
        doc.addPage();
        startPage();
      }
      doc.setDrawColor(220, 228, 234);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(page.margin, y, page.w - page.margin * 2, cardHeight - 3, 2, 2, 'FD');
      const image = await loadImage(product.image);
      if (image) doc.addImage(canvasImage(image), 'JPEG', page.margin + 3, y + 3, 42, 42, undefined, 'FAST');
      doc.setFillColor(0, 169, 143);
      doc.roundedRect(page.margin + 4, y + 45.5, 40, 3.5, 1, 1, 'F');
      let textY = y + 8;
      textY = addWrapped(doc, product.name, page.margin + 49, textY, 127, 10.5, { bold: true });
      textY += 1.7;
      textY = addWrapped(doc, `${product.collection} · Item ${product.number} · Module ${product.module || '—'}`, page.margin + 49, textY, 127, 7.7, { color: [97, 113, 129] });
      textY += 1.7;
      const priceText = product.discountedPrice !== null ? `Discounted price: ${formatMoney(product.discountedPrice)}${product.unitPrice !== null ? `   |   Unit price: ${formatMoney(product.unitPrice)}` : ''}` : product.sourcePrices.length ? `Source prices: ${product.sourcePrices.map(formatMoney).join(' / ')}` : 'Price unavailable in source price column';
      addWrapped(doc, priceText, page.margin + 49, textY, 127, 8.5, { bold: product.discountedPrice !== null, color: product.discountedPrice !== null ? [0, 125, 112] : [97, 113, 129] });
      y += cardHeight;
      allDownload.textContent = `Preparing ${index + 1}/${items.length}`;
      selectedDownload.textContent = `Preparing ${index + 1}/${items.length}`;
    }
    const pages = doc.getNumberOfPages();
    for (let pageNo = 1; pageNo <= pages; pageNo += 1) {
      doc.setPage(pageNo);
      doc.setTextColor(97, 113, 129);
      doc.setFontSize(7);
      doc.text(`Page ${pageNo} of ${pages} · Prices are taken from the supplied price list. Taxes and duties are extra where applicable.`, page.margin, 291);
    }
    doc.save(filename);
    notify(`Your PDF with ${items.length} products has been downloaded.`);
  } catch (error) {
    notify(error.message);
  } finally {
    allDownload.textContent = oldText;
    selectedDownload.textContent = 'Download selected PDF';
    allDownload.disabled = false;
    updateSelection();
  }
}

function renderTerms() {
  const uniqueTerms = [...new Set(CATALOG_DATA.terms)];
  document.querySelector('#terms-list').innerHTML = uniqueTerms.map((term) => `<li>${term}</li>`).join('');
}

selectedDownload.addEventListener('click', () => downloadPdf([...selections].map(productById).filter(Boolean), 'ait-selected-products.pdf'));
allDownload.addEventListener('click', () => downloadPdf(products, 'ait-complete-price-list.pdf'));
setupFilters();
renderTerms();
renderCatalog();
updateSelection();
