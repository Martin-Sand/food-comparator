// Toast notification system
function showToast(message, type = 'info', duration = 5000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => {
            container.removeChild(toast);
            if (container.children.length === 0) {
                document.body.removeChild(container);
            }
        }, 300);
    }, duration);
}

// Register Chart.js datalabels plugin if available
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

// State management
// Check if productsData was already set by the page (for shared comparisons)
let productsData = window.productsData || null;
let userProduct = window.userProduct || null;
let nutritionUnit = 'g'; // Default to grams, will be updated from API data
let currentFilters = {
    search: '',
    sortBy: 'price_asc',
    showNutrition: true, // Show nutrition by default
    showAllergens: false,
    showCharts: false, // Pie charts hidden by default
    hideNoNutrition: false, // Don't hide products without nutrition by default
    updatedWithinMonths: null // Filter by last updated date (null = no filter)
};
// Matrix sorting state: which nutrient column and direction
window.matrixSort = null; // { code: 'protein', direction: 'desc' | 'asc' }

// Matrix display options
let matrixOptions = {
    showStores: false,
    showAllergens: false
};

// Chart instances for cleanup
let nutritionPieChart = null;
let myProductSummaryChartInstance = null;

// Event listeners for filters (wrapped to ensure DOM is ready)
function attachFilterListeners() {
    const searchEl = document.getElementById('product-search');
    const sortEl = document.getElementById('sort-by');
    const toggleNutritionEl = document.getElementById('toggle-nutrition');
    const toggleAllergensEl = document.getElementById('toggle-allergens');
    const toggleChartsEl = document.getElementById('toggle-charts');
    const hideNoNutritionEl = document.getElementById('hide-no-nutrition');
    const updatedDateFilterEl = document.getElementById('updated-date-filter');

    if (searchEl) {
        searchEl.addEventListener('input', (e) => {
            currentFilters.search = e.target.value.toLowerCase();
            renderProducts();
        });
    }

    if (sortEl) {
        sortEl.addEventListener('change', (e) => {
            currentFilters.sortBy = e.target.value;
            renderProducts();
        });
    }
    
    if (updatedDateFilterEl) {
        updatedDateFilterEl.addEventListener('change', (e) => {
            const value = e.target.value;
            currentFilters.updatedWithinMonths = value === 'all' ? null : parseInt(value);
            renderProducts();
        });
    }

    if (toggleNutritionEl) {
        toggleNutritionEl.addEventListener('click', (e) => {
            currentFilters.showNutrition = !currentFilters.showNutrition;
            e.target.classList.toggle('active');
            renderProducts();
            renderMyProductBox(userProduct);
        });
    }

    if (toggleAllergensEl) {
        toggleAllergensEl.addEventListener('click', (e) => {
            currentFilters.showAllergens = !currentFilters.showAllergens;
            e.target.classList.toggle('active');
            renderProducts();
            renderMyProductBox(userProduct);
        });
    }

    if (hideNoNutritionEl) {
        hideNoNutritionEl.addEventListener('click', (e) => {
            currentFilters.hideNoNutrition = !currentFilters.hideNoNutrition;
            e.target.classList.toggle('active');
            e.target.textContent = currentFilters.hideNoNutrition ? 'Show No Nutrition' : 'Hide No Nutrition';
            renderProducts();
        });
    }

    if (toggleChartsEl) {
        toggleChartsEl.addEventListener('click', (e) => {
            currentFilters.showCharts = !currentFilters.showCharts;
            e.target.classList.toggle('active');
            if (productsData) {
                // Re-render products which will also update the summary with grouped products
                renderProducts();
            }
            renderMyProductBox(userProduct);
        });
    }
}

// Load initial data from URL params if present
window.addEventListener('DOMContentLoaded', async () => {
    // Attach filter listeners first
    attachFilterListeners();

    try {
        const params = new URLSearchParams(window.location.search);
        const key = params.get('key');
        const editingId = params.get('editing');
        const mode = params.get('mode') || 'compare'; // Default to compare mode
        
        // Hide user product section if in explore mode
        const myProductSection = document.getElementById('my-product-section');
        if (mode === 'explore' && myProductSection) {
            myProductSection.style.display = 'none';
        }
        
        // Check if we're in editing mode
        if (editingId) {
            const editingData = sessionStorage.getItem('editingSearchData');
            if (editingData) {
                const data = JSON.parse(editingData);
                window.editingSearchId = data.id;
                window.editingSearchName = data.name;
                window.editingMode = data.mode || 'full';
                sessionStorage.removeItem('editingSearchData');
            }
        }
        
        if (!key) {
            console.warn('No key provided in URL; cannot load product data.');
            // Check if data was already provided (shared comparison page)
            if (productsData && Object.keys(productsData).length > 0) {
                console.log('Using pre-loaded comparison data');
                nutritionUnit = productsData.nutrition_unit || 'g';
                userProduct = productsData.user_product || null;
                displayCategorySummary();
                renderProducts();
                renderMyProductBox(userProduct);
            }
        } else {
            const resp = await fetch(`/get_product_data?key=${encodeURIComponent(key)}`);
            if (resp.ok) {
                const data = await resp.json();
                if (data && Object.keys(data).length > 0) {
                    productsData = data;
                    // Set nutrition unit from data (defaults to 'g' if not present)
                    nutritionUnit = data.nutrition_unit || 'g';
                    // In explore mode, set userProduct to null
                    userProduct = mode === 'explore' ? null : (data.user_product || null);
                    displayCategorySummary();
                    renderProducts();
                    renderMyProductBox(userProduct);
                }
            } else {
                console.error('Failed to fetch product data:', resp.status);
            }
        }
    } catch (e) {
        console.error('Failed to load product data:', e);
    }

    // Mark the nutrition toggle as active initially when showNutrition is true
    if (currentFilters.showNutrition) {
        const btn = document.getElementById('toggle-nutrition');
        if (btn) btn.classList.add('active');
    }

    // Collapsible sections
    const categoriesHeader = document.getElementById('categories-header');
    const summaryHeader = document.getElementById('summary-header');
    const myProductHeader = document.getElementById('my-product-header');
    
    if (categoriesHeader) {
        categoriesHeader.addEventListener('click', () => {
            const content = document.getElementById('selected-categories-display');
            const arrow = categoriesHeader.querySelector('.collapse-arrow');
            if (content && arrow) {
                const isVisible = content.style.display !== 'none';
                content.style.display = isVisible ? 'none' : 'block';
                arrow.textContent = isVisible ? '▶' : '▼';
                categoriesHeader.classList.toggle('collapsed', isVisible);
            }
        });
    }
    
    if (summaryHeader) {
        summaryHeader.addEventListener('click', () => {
            const content = document.getElementById('category-summary');
            const arrow = summaryHeader.querySelector('.collapse-arrow');
            if (content && arrow) {
                const isVisible = content.style.display !== 'none';
                content.style.display = isVisible ? 'none' : 'block';
                arrow.textContent = isVisible ? '▶' : '▼';
                summaryHeader.classList.toggle('collapsed', isVisible);
            }
        });
    }
    
    if (myProductHeader) {
        myProductHeader.addEventListener('click', () => {
            const content = document.getElementById('my-product-info');
            const arrow = myProductHeader.querySelector('.collapse-arrow');
            if (content && arrow) {
                const isVisible = content.style.display !== 'none';
                content.style.display = isVisible ? 'none' : 'block';
                arrow.textContent = isVisible ? '▶' : '▼';
                myProductHeader.classList.toggle('collapsed', isVisible);
            }
        });
    }

    // Matrix controls
    const toggleMatrixBtn = document.getElementById('toggle-matrix');
    const exportMatrixBtn = document.getElementById('export-matrix-csv');
    
    if (toggleMatrixBtn) {
        toggleMatrixBtn.addEventListener('click', () => {
            const sect = document.getElementById('matrix-section');
            if (sect) {
                const isVisible = sect.style.display !== 'none';
                sect.style.display = isVisible ? 'none' : 'block';
                toggleMatrixBtn.classList.toggle('active', !isVisible);
                
                // Render matrix if showing it
                if (!isVisible) {
                    renderMatrix();
                }
            }
        });
    }
    if (exportMatrixBtn) {
        exportMatrixBtn.addEventListener('click', () => {
            exportMatrixToCSV();
        });
    }
    
    // Dropdown menu toggles
    const viewDropdownBtn = document.getElementById('view-dropdown-btn');
    const viewDropdown = document.getElementById('view-dropdown');
    const filterDropdownBtn = document.getElementById('filter-dropdown-btn');
    const filterDropdown = document.getElementById('filter-dropdown');
    
    if (viewDropdownBtn && viewDropdown) {
        viewDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            viewDropdownBtn.parentElement.classList.toggle('open');
            // Close other dropdown
            if (filterDropdownBtn) filterDropdownBtn.parentElement.classList.remove('open');
        });
    }
    
    if (filterDropdownBtn && filterDropdown) {
        filterDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            filterDropdownBtn.parentElement.classList.toggle('open');
            // Close other dropdown
            if (viewDropdownBtn) viewDropdownBtn.parentElement.classList.remove('open');
        });
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown.open').forEach(dropdown => {
                dropdown.classList.remove('open');
            });
        }
    });
    
    // Select all products button
    const selectAllBtn = document.getElementById('select-all-products');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('.product-select-checkbox');
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            
            // Toggle: if all are checked, uncheck all; otherwise check all
            checkboxes.forEach(cb => cb.checked = !allChecked);
            
            // Update delete button and select all button text
            const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
            if (deleteSelectedBtn) {
                deleteSelectedBtn.style.display = anyChecked ? 'inline-block' : 'none';
                const count = Array.from(checkboxes).filter(cb => cb.checked).length;
                deleteSelectedBtn.textContent = `🗑️ Delete Selected (${count})`;
            }
            selectAllBtn.textContent = allChecked ? '☑ Select All' : '☐ Deselect All';
        });
    }
    
    // Delete selected products button
    const deleteSelectedBtn = document.getElementById('delete-selected');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('.product-select-checkbox:checked');
            const eansToDelete = Array.from(checkboxes).map(cb => cb.dataset.ean).filter(ean => ean);
            
            if (eansToDelete.length === 0) return;
            
            if (confirm(`Delete ${eansToDelete.length} selected product(s)?`)) {
                // Remove products from productsData
                if (productsData && productsData.products) {
                    productsData.products = productsData.products.filter(p => !eansToDelete.includes(p.ean));
                    showToast(`${eansToDelete.length} product(s) removed`, 'success');
                    // Hide delete button
                    deleteSelectedBtn.style.display = 'none';
                    renderProducts();
                }
            }
        });
    }
    
    // Matrix toggle buttons
    const toggleStoresBtn = document.getElementById('toggle-matrix-stores');
    if (toggleStoresBtn) {
        toggleStoresBtn.addEventListener('click', () => {
            matrixOptions.showStores = !matrixOptions.showStores;
            toggleStoresBtn.textContent = matrixOptions.showStores ? 'Hide Stores' : 'Show Stores';
            toggleStoresBtn.classList.toggle('active', matrixOptions.showStores);
            renderMatrix();
        });
    }
    
    const toggleAllergensBtn = document.getElementById('toggle-matrix-allergens');
    if (toggleAllergensBtn) {
        toggleAllergensBtn.addEventListener('click', () => {
            matrixOptions.showAllergens = !matrixOptions.showAllergens;
            toggleAllergensBtn.textContent = matrixOptions.showAllergens ? 'Hide Allergens' : 'Show Allergens';
            toggleAllergensBtn.classList.toggle('active', matrixOptions.showAllergens);
            renderMatrix();
        });
    }
});

// Display category summary
function displayCategorySummary() {
    if (!productsData) return;
    
    const container = document.getElementById('selected-categories-display');
    
    // Create modern category chips
    const categoryChips = productsData.categories.map(cat => {
        // Split by > to get hierarchy parts
        const parts = cat.split(' > ');
        const mainCategory = parts[0];
        const subCategory = parts.length > 1 ? parts[parts.length - 1] : null;
        
        if (subCategory && subCategory !== mainCategory) {
            return `
                <div class="category-chip">
                    <span class="category-main">${mainCategory}</span>
                    <span class="category-separator">›</span>
                    <span class="category-sub">${subCategory}</span>
                </div>
            `;
        } else {
            return `
                <div class="category-chip">
                    <span class="category-main">${mainCategory}</span>
                </div>
            `;
        }
    }).join('');
    
    container.innerHTML = `<div class="category-chips-container">${categoryChips}</div>`;
}

// Sort and filter products
function getFilteredAndSortedProducts() {
    if (!productsData) return [];

    let products = [...productsData.products];

    // Apply search filter
    if (currentFilters.search) {
        products = products.filter(p => 
            p.name.toLowerCase().includes(currentFilters.search) ||
            (p.brand && p.brand.toLowerCase().includes(currentFilters.search))
        );
    }
    
    // Apply updated date filter
    if (currentFilters.updatedWithinMonths !== null) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - currentFilters.updatedWithinMonths);
        
        products = products.filter(p => {
            if (!p.updated_at) return false;
            try {
                const productDate = new Date(p.updated_at);
                return productDate >= cutoffDate;
            } catch (e) {
                return false;
            }
        });
    }

    // Note: Nutrition filter is applied after grouping in renderProducts()
    // because we need to check if the group has nutrition data, not individual stores

    // Apply sorting
    products.sort((a, b) => {
        switch (currentFilters.sortBy) {
            case 'price_asc':
                return (a.current_price || 0) - (b.current_price || 0);
            case 'price_desc':
                return (b.current_price || 0) - (a.current_price || 0);
            case 'unit_price_asc':
                return (a.current_unit_price || 0) - (b.current_unit_price || 0);
            case 'unit_price_desc':
                return (b.current_unit_price || 0) - (a.current_unit_price || 0);
            case 'name_asc':
                return a.name.localeCompare(b.name);
            case 'name_desc':
                return b.name.localeCompare(a.name);
            default:
                return 0;
        }
    });

    return products;
}

// Group products by EAN (same EAN = same product) and aggregate stores
function groupProductsByEAN(products) {
    const groupMap = new Map();
    
    products.forEach(p => {
        const ean = p.ean || '';
        if (!ean) {
            console.warn('Product without EAN:', p.name, p.store);
            return; // Skip products without EAN
        }
        
        if (!groupMap.has(ean)) {
            groupMap.set(ean, {
                key: `ean:${ean}`,
                ean: ean,
                name: p.name,
                brand: p.brand || null,
                image: null,
                nutrition: {},
                allergens: p.allergens || null,
                updated_at: p.updated_at || null,
                storesByName: new Map(),
                ids: new Set()
            });
        }
        const g = groupMap.get(ean);
        
        // Keep first name we encounter
        if (!g.name && p.name) g.name = p.name;
        
        // Prefer first valid absolute image URL
        if (!g.image && isValidHttpUrl(p.image)) g.image = p.image;
        
        // Keep first brand if not set
        if (!g.brand && p.brand) g.brand = p.brand;
        
        // Keep updated_at from first product (or prefer most recent if available)
        if (p.updated_at) {
            if (!g.updated_at || (new Date(p.updated_at) > new Date(g.updated_at))) {
                g.updated_at = p.updated_at;
            }
        }
        
        // Always prefer nutrition data with actual non-zero values
        // Prefer the variant with the most complete nutrition data
        if (p.nutrition) {
            // Count non-zero nutrition values in new product
            const pNonZeroCount = Object.values(p.nutrition).filter(n => 
                n && typeof n === 'object' && n.amount && n.amount > 0
            ).length;
            
            // Count non-zero nutrition values in existing group
            const gNonZeroCount = Object.values(g.nutrition || {}).filter(n => 
                n && typeof n === 'object' && n.amount && n.amount > 0
            ).length;
            
            // Use p.nutrition if it has more non-zero values than what we currently have
            // This ensures we always keep the most complete nutrition data
            if (pNonZeroCount > gNonZeroCount) {
                g.nutrition = p.nutrition;
            }
        }
        
        // Keep allergens from first product with allergen data
        if (!g.allergens && p.allergens) {
            g.allergens = p.allergens;
        }
        
        // Aggregate stores and prices
        const storeName = p.store || 'Unknown';
        const current = g.storesByName.get(storeName) || { 
            store: storeName, 
            price: null, 
            unit_price: null, 
            weight_unit: p.weight_unit || null, 
            url: p.url || null 
        };
        
        // Keep the lowest price/unit price seen for this store
        if (isFiniteNumber(p.current_price) && (!isFiniteNumber(current.price) || p.current_price < current.price)) {
            current.price = p.current_price;
        }
        if (isFiniteNumber(p.current_unit_price) && (!isFiniteNumber(current.unit_price) || p.current_unit_price < current.unit_price)) {
            current.unit_price = p.current_unit_price;
            current.weight_unit = p.weight_unit || current.weight_unit;
        }
        if (!current.url && p.url) current.url = p.url;
        g.storesByName.set(storeName, current);
        
        if (p.id) g.ids.add(p.id);
    });
    
    // Finalize groups and log store counts for debugging
    const result = Array.from(groupMap.values()).map(g => {
        const group = {
            key: g.key,
            ean: g.ean,
            name: g.name,
            brand: g.brand,
            image: g.image,
            nutrition: g.nutrition,
            allergens: g.allergens,
            updated_at: g.updated_at,
            stores: Array.from(g.storesByName.values()),
            ids: Array.from(g.ids)
        };
        if (group.stores.length > 1) {
            console.log(`Product "${group.name}" (EAN: ${group.ean}) has ${group.stores.length} stores:`, group.stores.map(s => s.store));
        }
        return group;
    });
    
    console.log(`Grouped ${products.length} products into ${result.length} unique products`);
    return result;
}

function isValidHttpUrl(u) {
    try {
        if (!u || typeof u !== 'string') return false;
        const url = new URL(u, window.location.origin);
        const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
        if (!isHttp) return false;
        const host = url.hostname.toLowerCase();
        // Blocklist known problematic hosts or placeholders
        const HOST_BLOCKLIST = new Set([
            'bilder.kolonial.no',
            'api.vetduat.no'
        ]);
        if (HOST_BLOCKLIST.has(host)) return false;
        // Skip numeric-only or obviously invalid filenames masquerading as URLs
        if (/^\d{8,}$/.test(u)) return false;
        return true;
    } catch {
        return false;
    }
}

// Render product cards
function renderProducts() {
    const products = getFilteredAndSortedProducts();
    
    // Group by EAN and sort according to current filter
    let groups = groupProductsByEAN(products);
    
    // Debug logging for product counts
    console.log(`=== Product Count Debug ===`);
    console.log(`Raw products from API: ${products.length}`);
    console.log(`After grouping by EAN: ${groups.length} unique products`);
    
    groups.forEach(g => {
        g.minPrice = Math.min(...g.stores.map(s => s.price || Infinity));
        g.minUnitPrice = Math.min(...g.stores.map(s => s.unit_price || Infinity));
    });
    
    // Filter out product groups with no nutrition data if toggle is active
    if (currentFilters.hideNoNutrition) {
        groups = groups.filter(group => {
            const nut = group.nutrition || {};
            // Check if ANY nutrition field has a value
            return Object.values(nut).some(val => val !== null && val !== undefined && val !== '');
        });
    }
    
    groups.sort((a, b) => {
        switch (currentFilters.sortBy) {
            case 'price_asc':
                return (a.minPrice || Infinity) - (b.minPrice || Infinity);
            case 'price_desc':
                return (b.minPrice || -Infinity) - (a.minPrice || -Infinity);
            case 'unit_price_asc':
                return (a.minUnitPrice || Infinity) - (b.minUnitPrice || Infinity);
            case 'unit_price_desc':
                return (b.minUnitPrice || -Infinity) - (a.minUnitPrice || -Infinity);
            case 'name_desc':
                return b.name.localeCompare(a.name);
            case 'name_asc':
            default:
                return a.name.localeCompare(b.name);
        }
    });
    
    // Update the category summary panel with current groups
    renderCategorySummary(groups);
    
    const grid = document.getElementById('product-grid');
    grid.innerHTML = groups.map(group => `
        <div class="product-card" data-ean="${group.ean || ''}">
            <input type="checkbox" class="product-select-checkbox" data-ean="${group.ean || ''}" title="Select for deletion">
            <div class="product-image-box">
                ${group.image ? 
                    `<img src="${group.image}" alt="${group.name}" class="product-image" onerror="this.remove()">` :
                    ''
                }
            </div>
            <div class="product-info">
                <div class="product-name">${group.name}</div>
                ${group.brand ? `<div class="product-brand">${group.brand}</div>` : ''}
                <div class="product-price">${formatPrice(group.minPrice)}</div>
                <div class="product-unit-price">${isFiniteNumber(group.minUnitPrice) ? `From ${formatUnitPrice(group.minUnitPrice)}` : ''}</div>
                <div class="store-list">
                    ${group.stores.map(s => `
                        <div class="store-row">
                            <span class="store-name">${s.store || ''}</span>
                            <span>
                                <span class="store-price">${formatPrice(s.price)}</span>
                                ${isFiniteNumber(s.unit_price) ? `<span class="store-unit"> (${formatUnitPrice(s.unit_price, s.weight_unit)})</span>` : ''}
                            </span>
                        </div>
                    `).join('')}
                </div>
                ${currentFilters.showNutrition ? renderNutrition(group.nutrition) : ''}
                ${currentFilters.showAllergens && group.allergens ? renderAllergens(group.allergens) : ''}
                ${userProduct ? renderComparisonBadges(group.nutrition, userProduct.nutrition) : ''}
                ${group.updated_at ? `<div class="product-updated">Last updated: ${formatDate(group.updated_at)}</div>` : ''}
            </div>
        </div>
    `).join('');

    // Add event delegation for fat breakdown toggles
    grid.querySelectorAll('.nutrition-expand-arrow').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const targetId = toggle.getAttribute('data-target');
            const breakdown = document.getElementById(targetId);
            if (breakdown) {
                const isVisible = breakdown.style.display !== 'none';
                breakdown.style.display = isVisible ? 'none' : 'block';
                toggle.textContent = isVisible ? '▼' : '▲';
                toggle.classList.toggle('expanded', !isVisible);
            }
        });
    });

    // Add checkbox event listeners to show/hide delete button
    const checkboxes = grid.querySelectorAll('.product-select-checkbox');
    const deleteBtn = document.getElementById('delete-selected');
    const selectAllBtn = document.getElementById('select-all-products');
    
    // Show/hide select all button based on whether there are products
    if (selectAllBtn) {
        selectAllBtn.style.display = checkboxes.length > 0 ? 'inline-block' : 'none';
        selectAllBtn.textContent = '☑ Select All';
    }
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            
            if (deleteBtn) {
                deleteBtn.style.display = anyChecked ? 'inline-block' : 'none';
                const count = Array.from(checkboxes).filter(cb => cb.checked).length;
                deleteBtn.textContent = `🗑️ Delete Selected (${count})`;
            }
            
            if (selectAllBtn) {
                selectAllBtn.textContent = allChecked ? '☐ Deselect All' : '☑ Select All';
            }
        });
    });

    // If matrix section is visible, keep it updated with current filter/sort
    const sect = document.getElementById('matrix-section');
    if (sect && sect.style.display !== 'none') {
        renderMatrix();
    }

}

// Compute and render summary over current (visible) product groups
function renderCategorySummary(groups) {
    const container = document.getElementById('category-summary');
    const section = document.getElementById('category-summary-section');
    if (!container || !section) return;
    if (!groups || groups.length === 0) {
        section.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    // Average min price and unit price across groups where finite
    const priceVals = groups.map(g => g.minPrice).filter(isFiniteNumber);
    const unitVals = groups.map(g => g.minUnitPrice).filter(isFiniteNumber);
    const avgPrice = priceVals.length ? (priceVals.reduce((a,b)=>a+b,0) / priceVals.length) : null;
    const avgUnit = unitVals.length ? (unitVals.reduce((a,b)=>a+b,0) / unitVals.length) : null;

    // Decide which nutrition codes to show: prefer a core set; else fallback to available codes
    const coreCodes = ['energi_kcal','fett_totalt','mettet_fett','umettet_fett','enumettet_fett','flerumettet_fett','sukkerarter','protein','salt','kostfiber'];
    const availableCodes = (productsData && productsData.nutrition_codes) || [];
    const codes = coreCodes.filter(c => availableCodes.includes(c));
    const finalCodes = codes.length ? codes : availableCodes.slice(0, 5);

    // For each code, compute average amount and most common unit; only include if any data
    const avgNut = finalCodes.map(code => {
        const vals = [];
        const unitCount = new Map();
        for (const g of groups) {
            const n = (g.nutrition || {})[code];
            if (!n || !isFiniteNumber(n.amount)) continue;
            const unit = n.unit || '';
            vals.push({ amount: n.amount, unit });
            unitCount.set(unit, (unitCount.get(unit) || 0) + 1);
        }
        if (!vals.length) return null;
        // Pick the dominant unit
        let bestUnit = '';
        let maxC = -1;
        unitCount.forEach((c, u) => { if (c > maxC) { maxC = c; bestUnit = u; }});
        const filtered = vals.filter(v => v.unit === bestUnit);
        const avg = filtered.reduce((a, v) => a + v.amount, 0) / filtered.length;
        return { code, amount: avg, unit: bestUnit, count: filtered.length };
    }).filter(Boolean);
    
    // Debug logging for nutrition calculation
    console.log(`=== Summary Calculation ===`);
    console.log(`Total unique products (by EAN): ${groups.length}`);
    if (avgNut.length > 0) {
        const productsWithNutrition = groups.filter(g => {
            const nut = g.nutrition || {};
            return Object.keys(nut).length > 0;
        }).length;
        console.log(`Products with nutrition data: ${productsWithNutrition}`);
        console.log(`Products used for each nutrient:`, avgNut.reduce((acc, n) => {
            acc[n.code] = n.count;
            return acc;
        }, {}));
    }
    console.log(`This should match the number of product cards you see on the page: ${groups.length}`);


    const header = `<div class="summary-title">Summary for ${groups.length} product${groups.length!==1?'s':''} <span style="font-size: 0.85em; color: #888; font-weight: normal;">(same as displayed below)</span></div>`;
    const stats = `
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-subtitle">Average price</div>
                <div class="summary-value">${avgPrice!=null ? formatPrice(avgPrice) : 'N/A'}</div>
            </div>
            <div class="summary-item">
                <div class="summary-subtitle">Average unit price</div>
                <div class="summary-value">${avgUnit!=null ? formatUnitPrice(avgUnit) : 'N/A'}</div>
            </div>
        </div>`;

    let nut = '';
    if (currentFilters.showNutrition && avgNut.length) {
        const uNut = (userProduct && userProduct.nutrition) ? userProduct.nutrition : null;
        const lowerBetter = new Set(['energi_kcal','energi_kj','fett_totalt','mettet_fett','sukkerarter','karbohydrater','salt']);
        const higherBetter = new Set(['protein','kostfiber','enumettet_fett','flerumettet_fett','umettet_fett']);
        
        const unitLabel = nutritionUnit === 'g' ? 'per 100g' : 'per 100ml';
        nut += `<div class="summary-section-title">Average nutrition ${unitLabel}${uNut ? ' — vs your product' : ''}</div>`;
        
        // Add side-by-side charts container if charts are enabled
        if (currentFilters.showCharts && uNut) {
            nut += `
                <div class="charts-side-by-side">
                    <div class="chart-container">
                        <h4>Your Product</h4>
                        <canvas id="my-product-summary-chart"></canvas>
                    </div>
                    <div class="chart-container">
                        <h4>Market Average</h4>
                        <canvas id="nutrition-pie-chart"></canvas>
                    </div>
                </div>
            `;
        }
        
        nut += `<div class="summary-grid">`;
        
        // Group fat-related nutrients
        const fatCodes = ['fett_totalt', 'mettet_fett', 'umettet_fett', 'enumettet_fett', 'flerumettet_fett'];
        const fatNutrients = avgNut.filter(n => fatCodes.includes(n.code));
        const nonFatNutrients = avgNut.filter(n => !fatCodes.includes(n.code));
        
        // Render non-fat nutrients first
        nut += nonFatNutrients.map(n => {
            let badge = '';
            if (uNut) {
                const u = uNut[n.code];
                if (u && isFiniteNumber(u.amount) && (!u.unit || !n.unit || u.unit === n.unit)) {
                    const diff = n.amount - u.amount;
                    const pct = u.amount !== 0 ? (diff / u.amount) * 100 : null;
                    let verdict = 'neutral';
                    if (pct !== null) {
                        if (lowerBetter.has(n.code)) verdict = pct > 1 ? 'better' : (pct < -1 ? 'worse' : 'neutral');
                        else if (higherBetter.has(n.code)) verdict = pct < -1 ? 'better' : (pct > 1 ? 'worse' : 'neutral');
                    }
                    if (verdict !== 'neutral') {
                        const text = verdict === 'better' ? 'Your product is better' : 'Your product is worse';
                        badge = `<div class="compare-badges"><span class="badge ${verdict}">${text}</span></div>`;
                    }
                }
            }
            return `
                <div class="summary-item">
                    <div class="summary-subtitle">${friendlyName(n.code)}</div>
                    <div class="summary-value">${n.amount.toFixed(2)} ${n.unit || ''}</div>
                    ${badge}
                </div>
            `;
        }).join('');
        
        // Render fat nutrients with inline expandable breakdown
        if (fatNutrients.length > 0) {
            const totalFat = fatNutrients.find(n => n.code === 'fett_totalt');
            const fatBreakdown = fatNutrients.filter(n => n.code !== 'fett_totalt');
            
            if (totalFat) {
                let badge = '';
                if (uNut) {
                    const u = uNut['fett_totalt'];
                    if (u && isFiniteNumber(u.amount) && (!u.unit || !totalFat.unit || u.unit === totalFat.unit)) {
                        const diff = totalFat.amount - u.amount;
                        const pct = u.amount !== 0 ? (diff / u.amount) * 100 : null;
                        let verdict = 'neutral';
                        if (pct !== null) {
                            if (lowerBetter.has('fett_totalt')) verdict = pct > 1 ? 'better' : (pct < -1 ? 'worse' : 'neutral');
                        }
                        if (verdict !== 'neutral') {
                            const text = verdict === 'better' ? 'Your product is better' : 'Your product is worse';
                            badge = `<div class="compare-badges"><span class="badge ${verdict}">${text}</span></div>`;
                        }
                    }
                }
                
                const breakdownHtml = fatBreakdown.map(n => {
                    let subBadge = '';
                    if (uNut) {
                        const u = uNut[n.code];
                        if (u && isFiniteNumber(u.amount) && (!u.unit || !n.unit || u.unit === n.unit)) {
                            const diff = n.amount - u.amount;
                            const pct = u.amount !== 0 ? (diff / u.amount) * 100 : null;
                            let verdict = 'neutral';
                            if (pct !== null) {
                                if (lowerBetter.has(n.code)) verdict = pct > 1 ? 'better' : (pct < -1 ? 'worse' : 'neutral');
                                else if (higherBetter.has(n.code)) verdict = pct < -1 ? 'better' : (pct > 1 ? 'worse' : 'neutral');
                            }
                            if (verdict !== 'neutral') {
                                const iconMap = { better: '↓', worse: '↑', neutral: '' };
                                subBadge = `<span class="fat-badge ${verdict}">${iconMap[verdict]}</span>`;
                            }
                        }
                    }
                    return `<div class="fat-sub-item"><span>${friendlyName(n.code).replace('Fat - ', '')}</span><span>${n.amount.toFixed(1)}${subBadge}</span></div>`;
                }).join('');
                
                nut += `
                    <div class="summary-item summary-item-fat">
                        <div class="summary-subtitle">
                            ${friendlyName('fett_totalt')}
                            ${fatBreakdown.length > 0 ? '<button class="fat-expand-btn" onclick="event.stopPropagation(); this.closest(\'.summary-item-fat\').classList.toggle(\'expanded\');">▼</button>' : ''}
                        </div>
                        <div class="summary-value">${totalFat.amount.toFixed(2)} ${totalFat.unit || ''}</div>
                        ${badge}
                        ${fatBreakdown.length > 0 ? `<div class="fat-details">${breakdownHtml}</div>` : ''}
                    </div>
                `;
            }
        }
        
        nut += `</div>`;
        
        // Render pie charts after DOM update
        if (currentFilters.showCharts) {
            setTimeout(() => {
                renderNutritionPieChart(avgNut, uNut);
                if (uNut) {
                    const userEntries = Object.entries(uNut)
                        .filter(([_, v]) => v && isFiniteNumber(v.amount))
                        .map(([code, v]) => ({ code, amount: v.amount, unit: v.unit || '' }));
                    renderMyProductSummaryChart(userEntries);
                }
            }, 0);
        }
    }

    container.innerHTML = header + stats + nut;
    section.style.display = 'block';
    container.style.display = 'block';
}

// Render the user's product as a top information box (not a tile)
function renderMyProductBox(up) {
    const box = document.getElementById('my-product-info');
    const section = document.getElementById('my-product-section');
    if (!box || !section) return;
    if (!up) { section.style.display = 'none'; box.innerHTML = ''; return; }

    // Build nutrition as summary-style cards instead of table
    let nutHtml = '';
    if (currentFilters.showNutrition && up.nutrition) {
        const entries = Object.entries(up.nutrition)
            .filter(([_, v]) => v && isFiniteNumber(v.amount))
            .map(([code, v]) => ({ code, amount: v.amount, unit: v.unit || '' }));
        if (entries.length) {
            const coreOrder = ['energi_kcal','fett_totalt','mettet_fett','umettet_fett','enumettet_fett','flerumettet_fett','sukkerarter','protein','salt'];
            entries.sort((a,b) => (coreOrder.indexOf(a.code) === -1 ? 999 : coreOrder.indexOf(a.code)) - (coreOrder.indexOf(b.code) === -1 ? 999 : coreOrder.indexOf(b.code)) || friendlyName(a.code).localeCompare(friendlyName(b.code)));
            
            // Group fat-related nutrients
            const fatCodes = ['fett_totalt', 'mettet_fett', 'umettet_fett', 'enumettet_fett', 'flerumettet_fett'];
            const fatEntries = entries.filter(e => fatCodes.includes(e.code));
            const nonFatEntries = entries.filter(e => !fatCodes.includes(e.code));
            
            const unitLabel = nutritionUnit === 'g' ? 'per 100g' : 'per 100ml';
            nutHtml = `<div class="summary-section-title">My product — ${unitLabel}</div><div class="summary-grid">`;
            
            // Render non-fat nutrients
            nutHtml += nonFatEntries.map(n => `
                <div class="summary-item">
                    <div class="summary-subtitle">${friendlyName(n.code)}</div>
                    <div class="summary-value">${n.amount} ${n.unit}</div>
                </div>
            `).join('');
            
            // Render fat with inline expandable breakdown
            if (fatEntries.length > 0) {
                const totalFat = fatEntries.find(e => e.code === 'fett_totalt');
                const fatBreakdown = fatEntries.filter(e => e.code !== 'fett_totalt');
                
                if (totalFat) {
                    const breakdownHtml = fatBreakdown.map(n => 
                        `<div class="fat-sub-item"><span>${friendlyName(n.code).replace('Fat - ', '')}</span><span>${n.amount}</span></div>`
                    ).join('');
                    
                    nutHtml += `
                        <div class="summary-item summary-item-fat">
                            <div class="summary-subtitle">
                                ${friendlyName('fett_totalt')}
                                ${fatBreakdown.length > 0 ? '<button class="fat-expand-btn" onclick="event.stopPropagation(); this.closest(\'.summary-item-fat\').classList.toggle(\'expanded\');">▼</button>' : ''}
                            </div>
                            <div class="summary-value">${totalFat.amount} ${totalFat.unit}</div>
                            ${fatBreakdown.length > 0 ? `<div class="fat-details">${breakdownHtml}</div>` : ''}
                        </div>
                    `;
                }
            }
            
            nutHtml += `</div>`;
        }
    }
    const allergHtml = currentFilters.showAllergens && up.allergens ? renderAllergens(up.allergens) : '';
    box.innerHTML = `
        <div class="title">${up.name || 'My Product'}</div>
        ${up.description ? `<div class="desc">${up.description}</div>` : ''}
        ${nutHtml}
        ${allergHtml}
    `;
    section.style.display = 'block';
    box.style.display = 'block';
}

// Compute and render compact comparison badges vs user's product
function renderComparisonBadges(prodNut, userNut) {
    if (!prodNut || !userNut) return '';

    // Decide direction: lower is better vs higher is better
    const lowerBetter = new Set(['energi_kcal','energi_kj','fett_totalt','mettet_fett','sukkerarter','karbohydrater','salt']);
    const higherBetter = new Set(['protein','kostfiber','enumettet_fett','flerumettet_fett','umettet_fett']);

    const entries = [];
    const allKeys = new Set([...Object.keys(prodNut), ...Object.keys(userNut)]);
    allKeys.forEach(code => {
        const p = prodNut[code];
        const u = userNut[code];
        if (!p || !u) return;
        if (!isFiniteNumber(p.amount) || !isFiniteNumber(u.amount)) return;
        if (p.unit && u.unit && p.unit !== u.unit) return; // skip unit mismatch
        const diff = p.amount - u.amount;
        const pct = u.amount !== 0 ? (diff / u.amount) * 100 : null;
        let verdict = 'neutral';
        if (pct !== null) {
            if (lowerBetter.has(code)) verdict = pct < -1 ? 'better' : (pct > 1 ? 'worse' : 'neutral');
            else if (higherBetter.has(code)) verdict = pct > 1 ? 'better' : (pct < -1 ? 'worse' : 'neutral');
        }
        entries.push({ code, pct, verdict });
    });

    if (entries.length === 0) return '';

    // Pick up to 4 strongest differences by absolute pct
    entries.sort((a,b) => Math.abs((b.pct ?? 0)) - Math.abs((a.pct ?? 0)));
    const top = entries.slice(0, 4);

    const badges = top.map(e => {
        const pctStr = e.pct === null ? '' : `${e.pct > 0 ? '+' : ''}${Math.round(e.pct)}%`;
        const label = `${friendlyName(e.code)} ${pctStr}`;
        return `<span class="badge ${e.verdict}">${label}</span>`;
    }).join('');

    return `<div class="compare-badges">${badges}</div>`;
}

function friendlyName(code) {
    const map = {
        energi_kcal: 'Kcal',
        energi_kj: 'kJ',
        fett_totalt: 'Total fat',
        mettet_fett: 'Saturated fat',
        umettet_fett: 'Unsaturated fat',
        enumettet_fett: 'Monounsaturated fat',
        flerumettet_fett: 'Polyunsaturated fat',
        karbohydrater: 'Carbs',
        sukkerarter: 'Sugar',
        kostfiber: 'Fiber',
        protein: 'Protein',
        salt: 'Salt'
    };
    if (map[code]) return map[code];
    const c = String(code || '').toLowerCase();
    if (c.includes('flerumett')) return 'Polyunsaturated fat';
    if (c.includes('enumett')) return 'Monounsaturated fat';
    if (c.includes('umettet')) return 'Unsaturated fat';
    if (c.includes('mettet')) return 'Saturated fat';
    return code;
}

function isFiniteNumber(n) {
    return typeof n === 'number' && isFinite(n);
}

// Determine whether an allergen value indicates presence
function isAllergenPresent(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        // Treat explicit negatives as not present
        if (s === '' || s === 'no' || s === 'none' || s === 'false' || s === '0' || s === 'nei') return false;
        // Anything else like 'yes', 'may contain', 'contains', 'present', etc. counts as present
        return true;
    }
    return false;
}

function friendlyAllergen(code) {
    const map = {
        gluten: 'Gluten',
        egg: 'Egg',
        eggs: 'Eggs',
        milk: 'Milk',
        lactose: 'Lactose',
        peanuts: 'Peanuts',
        peanut: 'Peanut',
        nuts: 'Tree nuts',
        almond: 'Almond',
        almonds: 'Almonds',
        hazelnut: 'Hazelnut',
        hazelnuts: 'Hazelnuts',
        cashew: 'Cashew',
        cashews: 'Cashews',
        pistachio: 'Pistachio',
        pistachios: 'Pistachios',
        walnut: 'Walnut',
        walnuts: 'Walnuts',
        pecan: 'Pecan',
        pecans: 'Pecans',
        brazilnut: 'Brazil nut',
        brazilnuts: 'Brazil nuts',
        sesame: 'Sesame',
        soy: 'Soy',
        soya: 'Soya',
        fish: 'Fish',
        shellfish: 'Shellfish',
        crustaceans: 'Crustaceans',
        molluscs: 'Molluscs',
        celery: 'Celery',
        mustard: 'Mustard',
        lupin: 'Lupin',
        sulphites: 'Sulphites',
        sulphite: 'Sulphite'
    };
    if (!code) return '';
    const key = String(code).toLowerCase().replace(/\s+/g, '_');
    if (map[key]) return map[key];
    // Fallback: title-case words and replace underscores
    return String(code)
        .replace(/[_-]+/g, ' ')
        .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function allergenPresenceLabel(v) {
    if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (s.includes('may') || s.includes('kan') || s.includes('trace') || s.includes('spor')) {
            return 'May contain';
        }
        // If explicitly negative, caller should have filtered it out already; otherwise treat as contains
        return 'Contains';
    }
    if (typeof v === 'boolean' || typeof v === 'number') {
        return 'Contains';
    }
    return 'Contains';
}

// Build and render the nutrition matrix
function renderMatrix() {
    const container = document.getElementById('matrix-container');
    if (!container || !productsData) return;
    if (!userProduct || !userProduct.nutrition) {
        container.innerHTML = '<div style="padding:0.5em;color:#666;">Provide a reference product with nutrition to enable the matrix.</div>';
        return;
    }

    // Get filtered products and group by EAN
    const products = getFilteredAndSortedProducts();
    let groups = groupProductsByEAN(products);
    
    // Apply nutrition filter if active
    if (currentFilters.hideNoNutrition) {
        groups = groups.filter(group => {
            const nut = group.nutrition || {};
            return Object.values(nut).some(val => val !== null && val !== undefined && val !== '');
        });
    }
    
    const userNut = userProduct.nutrition || {};
    const codes = (productsData.nutrition_codes || []).filter(code => {
        const u = userNut[code];
        return u && isFiniteNumber(u.amount);
    });
    if (codes.length === 0) {
        container.innerHTML = '<div style="padding:0.5em;color:#666;">No comparable nutrients found.</div>';
        return;
    }

    const lowerBetter = new Set(['energi_kcal','energi_kj','fett_totalt','mettet_fett','sukkerarter','karbohydrater','salt']);
    const higherBetter = new Set(['protein','kostfiber','enumettet_fett','flerumettet_fett','umettet_fett']);

    // Apply matrix-specific sorting if set
    if (window.matrixSort && codes.includes(window.matrixSort.code)) {
        const sortCode = window.matrixSort.code;
        const dir = window.matrixSort.direction || 'desc';
        groups.sort((a, b) => {
            const an = (a.nutrition || {})[sortCode];
            const bn = (b.nutrition || {})[sortCode];
            const u = userNut[sortCode];
            const av = (an && (!an.unit || !u.unit || an.unit === u.unit) && isFiniteNumber(an.amount)) ? an.amount : NaN;
            const bv = (bn && (!bn.unit || !u.unit || bn.unit === u.unit) && isFiniteNumber(bn.amount)) ? bn.amount : NaN;
            const aNan = Number.isNaN(av);
            const bNan = Number.isNaN(bv);
            if (aNan && bNan) return 0;
            if (aNan) return 1; // push NaN to bottom
            if (bNan) return -1;
            return dir === 'desc' ? (bv - av) : (av - bv);
        });
    }

    // Build header with optional store and allergen columns
    const headerCells = ['<th class="product-col">Product</th>'];
    if (matrixOptions.showStores) {
        headerCells.push('<th class="store-col">Stores</th>');
    }
    headerCells.push(...codes.map(code => {
        const active = window.matrixSort && window.matrixSort.code === code;
        const arrow = active ? (window.matrixSort.direction === 'desc' ? ' ↓' : ' ↑') : '';
        return `<th class="sortable" data-code="${code}">${friendlyName(code)}${arrow}</th>`;
    }));
    if (matrixOptions.showAllergens) {
        headerCells.push('<th class="allergen-col">Allergens</th>');
    }
    headerCells.push('<th class="updated-col">Last Updated</th>');

    // Build rows for grouped products
    const rowsHtml = groups.map(group => {
        const prow = [`<td class="product-col"><div class="prod-name">${group.name}</div>${group.brand ? `<div class="prod-brand">${group.brand}</div>` : ''}</td>`];
        
        // Add stores column if enabled
        if (matrixOptions.showStores) {
            const storeList = group.stores.map(s => s.store || '').filter(s => s).join(', ');
            prow.push(`<td class="store-col"><small>${storeList}</small></td>`);
        }
        
        // Add nutrition columns
        const pNut = group.nutrition || {};
        codes.forEach(code => {
            const u = userNut[code];
            const n = pNut[code];
            if (!n || !isFiniteNumber(n.amount) || (n.unit && u.unit && n.unit !== u.unit)) {
                prow.push('<td class="cell-na">-</td>');
                return;
            }
            const diff = n.amount - u.amount;
            const pct = u.amount !== 0 ? (diff / u.amount) * 100 : null;
            let verdict = 'neutral';
            if (pct !== null) {
                if (lowerBetter.has(code)) verdict = pct < -1 ? 'better' : (pct > 1 ? 'worse' : 'neutral');
                else if (higherBetter.has(code)) verdict = pct > 1 ? 'better' : (pct < -1 ? 'worse' : 'neutral');
            }
            const cls = verdict === 'better' ? 'cell-better' : verdict === 'worse' ? 'cell-worse' : 'cell-neutral';
            const valStr = `${n.amount} ${n.unit || ''}`.trim();
            prow.push(`<td class="${cls}">${valStr}</td>`);
        });
        
        // Add allergens column if enabled
        if (matrixOptions.showAllergens) {
            const allergenList = group.allergens ? 
                Object.entries(group.allergens)
                    .filter(([_, v]) => isAllergenPresent(v))
                    .map(([k, _]) => friendlyAllergen(k))
                    .join(', ') : '';
            prow.push(`<td class="allergen-col"><small>${allergenList || '-'}</small></td>`);
        }
        
        // Add last updated column
        prow.push(`<td class="updated-col"><small>${formatDate(group.updated_at)}</small></td>`);
        
        return `<tr>${prow.join('')}</tr>`;
    }).join('');

    // Build the top row for the user's product, always pinned at the top
    const myProw = (() => {
        const cells = [`<td class="product-col"><div class="prod-name">${userProduct.name || 'My Product'}</div>${userProduct.description ? `<div class=\"prod-brand\">${userProduct.description}</div>` : ''}</td>`];
        
        if (matrixOptions.showStores) {
            cells.push('<td class="store-col"><small>-</small></td>');
        }
        
        codes.forEach(code => {
            const u = userNut[code];
            if (!u || !isFiniteNumber(u.amount)) {
                cells.push('<td class="cell-na">-</td>');
            } else {
                const valStr = `${u.amount} ${u.unit || ''}`.trim();
                cells.push(`<td>${valStr}</td>`);
            }
        });
        
        if (matrixOptions.showAllergens) {
            cells.push('<td class="allergen-col"><small>-</small></td>');
        }
        
        cells.push('<td class="updated-col"><small>-</small></td>');
        
        return `<tr class="my-product-row">${cells.join('')}</tr>`;
    })();

    container.innerHTML = `
        <table class="matrix-table">
            <thead><tr>${headerCells.join('')}</tr></thead>
            <tbody>${myProw}${rowsHtml}</tbody>
        </table>
    `;

    // Attach header sorting handlers
    container.querySelectorAll('.matrix-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const code = th.getAttribute('data-code');
            if (!code) return;
            if (!window.matrixSort || window.matrixSort.code !== code) {
                window.matrixSort = { code, direction: 'desc' };
            } else {
                window.matrixSort.direction = window.matrixSort.direction === 'desc' ? 'asc' : 'desc';
            }
            renderMatrix();
        });
    });
}

// Helper functions for rendering
function formatPrice(price) {
    return price ? `kr ${price.toFixed(2)}` : 'N/A';
}

function formatUnitPrice(price, unit) {
    return price ? `kr ${price.toFixed(2)}/${unit || 'kg'}` : '';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('no-NO', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
        return 'N/A';
    }
}

function renderNutrition(nutrition) {
    if (!nutrition || typeof nutrition !== 'object') return '';

    // Build normalized entry list
    const entries = Object.entries(nutrition).map(([code, data]) => {
        let amount = null;
        let unit = '';
        if (data && typeof data === 'object') {
            amount = data.amount;
            unit = data.unit || '';
        } else if (typeof data === 'number') {
            amount = data;
        }
        if (!isFiniteNumber(amount)) return null;
        return { code, label: friendlyName(code), amount, unit };
    }).filter(Boolean);

    if (!entries.length) return '';

    // Separate fat-related entries from others
    const fatCodes = new Set(['mettet_fett','umettet_fett','enumettet_fett','flerumettet_fett']);
    const fatBreakdown = entries.filter(e => fatCodes.has(e.code));
    const totalFat = entries.find(e => e.code === 'fett_totalt');
    const nonFat = entries.filter(e => e.code !== 'fett_totalt' && !fatCodes.has(e.code) && e.code !== 'energi_kj');

    // Order non-fat nutrients: core nutrients first, then others alphabetically
    const coreOrder = ['energi_kcal','karbohydrater','sukkerarter','protein','salt','kostfiber'];
    nonFat.sort((a,b) => {
        const ai = coreOrder.indexOf(a.code); const bi = coreOrder.indexOf(b.code);
        const aRank = ai === -1 ? 999 : ai;
        const bRank = bi === -1 ? 999 : bi;
        if (aRank !== bRank) return aRank - bRank;
        return a.label.localeCompare(b.label);
    });

    // Build ordered list: key nutrients first
    const orderedEntries = [];
    
    const caloriesEntry = nonFat.find(e => e.code === 'energi_kcal');
    if (caloriesEntry) orderedEntries.push(caloriesEntry);
    if (totalFat) orderedEntries.push({ ...totalFat, hasFatBreakdown: fatBreakdown.length > 0 });
    const carbsEntry = nonFat.find(e => e.code === 'karbohydrater');
    if (carbsEntry) orderedEntries.push(carbsEntry);
    const proteinEntry = nonFat.find(e => e.code === 'protein');
    if (proteinEntry) orderedEntries.push(proteinEntry);
    
    // Add remaining nutrients
    nonFat.forEach(n => {
        if (!['energi_kcal', 'karbohydrater', 'protein'].includes(n.code)) {
            orderedEntries.push(n);
        }
    });

    const fatId = `fat-detail-${Math.random().toString(36).substr(2,9)}`;
    
    // Build nutrition rows
    let rows = '';
    orderedEntries.forEach(n => {
        const isExpandable = n.code === 'fett_totalt' && n.hasFatBreakdown;
        const isMacro = ['energi_kcal', 'fett_totalt', 'karbohydrater', 'protein'].includes(n.code);
        
        rows += `
            <div class="nutrition-row ${isMacro ? 'nutrition-row-macro' : ''}${isExpandable ? ' nutrition-row-expandable' : ''}" ${isExpandable ? `data-fat-id="${fatId}"` : ''}>
                <span class="nutrition-label">${n.label}</span>
                <span class="nutrition-value">
                    ${n.amount} ${n.unit || ''}
                    ${isExpandable ? `<span class="nutrition-expand-arrow" data-target="${fatId}">▼</span>` : ''}
                </span>
            </div>
        `;
        
        // Insert fat breakdown immediately after total fat row
        if (isExpandable && fatBreakdown.length > 0) {
            rows += `
                <div class="nutrition-breakdown" id="${fatId}" style="display:none;">
                    ${fatBreakdown.map(f => `
                        <div class="nutrition-row nutrition-row-sub">
                            <span class="nutrition-label">${f.label}</span>
                            <span class="nutrition-value">${f.amount} ${f.unit || ''}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    });
    
    const unitLabel = nutritionUnit === 'g' ? 'per 100g' : 'per 100ml';

    return `
        <div class="nutrition-display">
            <div class="nutrition-header">
                <h4>Nutrition Facts</h4>
                <span class="nutrition-serving">${unitLabel}</span>
            </div>
            <div class="nutrition-list">
                ${rows}
            </div>
        </div>
    `;
}

function renderAllergens(allergens) {
    if (!allergens || typeof allergens !== 'object') return '';
    const present = Object.entries(allergens).filter(([code, contains]) => isAllergenPresent(contains));
    if (present.length === 0) return '';

    return `
        <div class="allergens-list">
            <h4>Allergens</h4>
            ${present.map(([code]) => `
                <div class="allergen-item">
                    <span>${friendlyAllergen(code)}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// Render pie chart for average nutrition summary
function renderNutritionPieChart(avgNut, userNut) {
    const canvas = document.getElementById('nutrition-pie-chart');
    if (!canvas) return;
    
    // Destroy previous chart if exists
    if (nutritionPieChart) {
        nutritionPieChart.destroy();
    }
    
    // Define categories to show with consistent colors
    const categoryConfig = [
        { code: 'fett_totalt', label: 'Total fat', color: '#fc5c7d' },
        { code: 'sukkerarter', label: 'Sugar', color: '#f093fb' },
        { code: 'protein', label: 'Protein', color: '#43cea2' },
        { code: 'salt', label: 'Salt', color: '#fa709a' },
        { code: 'kostfiber', label: 'Fibre', color: '#6a82fb' }
    ];
    
    // Build chart data in the order defined above, filtering out missing nutrients
    const chartData = [];
    const labels = [];
    const colors = [];
    
    categoryConfig.forEach(config => {
        const nutrient = avgNut.find(n => n.code === config.code);
        if (nutrient && isFiniteNumber(nutrient.amount)) {
            chartData.push(nutrient);
            labels.push(config.label);
            colors.push(config.color);
        }
    });
    
    if (chartData.length === 0) return;
    
    const data = chartData.map(n => n.amount);
    
    nutritionPieChart = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            layout: {
                padding: 20
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        padding: 12,
                        font: { size: 13 },
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const unit = chartData[i].unit || 'g';
                                    return {
                                        text: `${label}: ${value.toFixed(1)} ${unit}`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const unit = chartData[context.dataIndex].unit || 'g';
                            return `${label}: ${value.toFixed(1)} ${unit}`;
                        }
                    }
                },
                datalabels: {
                    display: false
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// Render pie chart for my product in summary section (side-by-side)
function renderMyProductSummaryChart(entries) {
    const canvas = document.getElementById('my-product-summary-chart');
    if (!canvas) return;
    
    // Destroy previous chart if exists
    if (myProductSummaryChartInstance) {
        myProductSummaryChartInstance.destroy();
    }
    
    // Define categories to show with consistent colors (same as renderNutritionPieChart)
    const categoryConfig = [
        { code: 'fett_totalt', label: 'Total fat', color: '#fc5c7d' },
        { code: 'sukkerarter', label: 'Sugar', color: '#f093fb' },
        { code: 'protein', label: 'Protein', color: '#43cea2' },
        { code: 'salt', label: 'Salt', color: '#fa709a' },
        { code: 'kostfiber', label: 'Fibre', color: '#6a82fb' }
    ];
    
    // Build chart data in the order defined above, filtering out missing nutrients
    const chartData = [];
    const labels = [];
    const colors = [];
    
    categoryConfig.forEach(config => {
        const nutrient = entries.find(n => n.code === config.code);
        if (nutrient && isFiniteNumber(nutrient.amount)) {
            chartData.push(nutrient);
            labels.push(config.label);
            colors.push(config.color);
        }
    });
    
    if (chartData.length === 0) return;
    
    const data = chartData.map(n => n.amount);
    
    myProductSummaryChartInstance = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            layout: {
                padding: 20
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        padding: 12,
                        font: { size: 13 },
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const unit = chartData[i].unit || 'g';
                                    return {
                                        text: `${label}: ${value.toFixed(1)} ${unit}`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const unit = chartData[context.dataIndex].unit || 'g';
                            return `${label}: ${value.toFixed(1)} ${unit}`;
                        }
                    }
                },
                datalabels: {
                    display: false
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// Export nutrition matrix to CSV
function exportMatrixToCSV() {
    if (!productsData || !userProduct || !userProduct.nutrition) {
        alert('No matrix data available to export.');
        return;
    }

    const products = getFilteredAndSortedProducts();
    
    // Group products by EAN to get unique products only
    const groups = groupProductsByEAN(products);
    
    const userNut = userProduct.nutrition || {};
    
    // Get the nutrition codes that are comparable
    const codes = (productsData.nutrition_codes || []).filter(code => {
        const u = userNut[code];
        return u && isFiniteNumber(u.amount);
    });
    
    if (codes.length === 0) {
        alert('No comparable nutrients found.');
        return;
    }

    // Build CSV content
    let csv = '';
    
    // Header row
    const headers = ['Product', 'Brand', 'Stores', 'Last Updated'].concat(codes.map(code => friendlyName(code)));
    csv += headers.map(h => `"${h}"`).join(',') + '\n';
    
    // My Product row (first)
    const myProductRow = [
        userProduct.name || 'My Product',
        userProduct.description || '',
        '-',
        '-'
    ];
    codes.forEach(code => {
        const u = userNut[code];
        if (u && isFiniteNumber(u.amount)) {
            myProductRow.push(`${u.amount} ${u.unit || ''}`.trim());
        } else {
            myProductRow.push('-');
        }
    });
    csv += myProductRow.map(v => `"${v}"`).join(',') + '\n';
    
    // Product rows (using grouped products)
    groups.forEach(group => {
        const row = [
            group.name || '',
            group.brand || '',
            group.stores.map(s => s.store).join('; ') || '',
            group.updated_at ? formatDate(group.updated_at) : '-'
        ];
        const pNut = group.nutrition || {};
        codes.forEach(code => {
            const u = userNut[code];
            const n = pNut[code];
            if (n && isFiniteNumber(n.amount) && (!n.unit || !u.unit || n.unit === u.unit)) {
                row.push(`${n.amount} ${n.unit || ''}`.trim());
            } else {
                row.push('-');
            }
        });
        csv += row.map(v => `"${v}"`).join(',') + '\n';
    });
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    const categories = (productsData.categories || []).slice(0, 2).join('_').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `nutrition_matrix_${categories}_${timestamp}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log(`Matrix exported to CSV: ${filename} (${groups.length} unique products)`);
}

// (Price chart feature removed)

// Save Search functionality
document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-search-btn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
        // Validate we have data to save
        if (!productsData || !productsData.categories || productsData.categories.length === 0) {
            alert('No search data available to save.');
            return;
        }

        // Check if we're in editing mode (passed from main.js)
        const editingId = window.editingSearchId;
        const editingName = window.editingSearchName;
        const editingMode = window.editingMode;
        
        if (editingId) {
            // Update existing search
            let confirmMsg = `Update search "${editingName}" with current data?`;
            if (editingMode === 'categories') {
                confirmMsg = `Update categories for "${editingName}"?`;
            } else if (editingMode === 'nutrition') {
                confirmMsg = `Update nutrition data for "${editingName}"?`;
            }
            
            const confirmUpdate = confirm(confirmMsg);
            if (!confirmUpdate) return;
            
            const searchData = {
                name: editingName,
                selected_categories: productsData.categories,
                user_product_data: userProduct || null
            };
            
            try {
                const response = await fetch(`/api/update_search/${editingId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(searchData)
                });

                const result = await response.json();

                if (result.success) {
                    showToast('✅ Search updated successfully!', 'success');
                    // Clear editing state
                    delete window.editingSearchId;
                    delete window.editingSearchName;
                    delete window.editingMode;
                    delete window.editingSearchData;
                    
                    // Optionally redirect back to saved searches
                    if (confirm('Go back to saved searches?')) {
                        window.location.href = '/saved_searches';
                    }
                } else {
                    showToast('Error updating search: ' + (result.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                console.error('Failed to update search:', error);
                showToast('Failed to update search. Please try again.', 'error');
            }
        } else {
            // Save new search
            const name = prompt('Enter a name for this search:');
            if (!name || name.trim() === '') {
                return; // User cancelled or entered empty name
            }

            // Get mode from URL params
            const params = new URLSearchParams(window.location.search);
            const searchMode = params.get('mode') || 'compare';

            // Prepare search data
            const searchData = {
                name: name.trim(),
                selected_categories: productsData.selected_categories || productsData.categories,
                user_product_data: userProduct || null,
                mode: searchMode
            };

            try {
                const response = await fetch('/api/save_search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(searchData)
                });

                const result = await response.json();

                if (result.success) {
                    showToast('Search saved successfully! 🎉', 'success');
                } else if (result.upgrade_required) {
                    showToast(result.error + ' Upgrade to Premium for unlimited saved searches!', 'warning', 7000);
                } else {
                    showToast('Error saving search: ' + (result.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                console.error('Failed to save search:', error);
                showToast('Failed to save search. Please try again.', 'error');
            }
        }
    });
    
    // Share Comparison functionality
    const shareBtn = document.getElementById('share-comparison-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            // Validate we have data to share
            if (!productsData || !productsData.products || productsData.products.length === 0) {
                showToast('No comparison data available to share.', 'warning');
                return;
            }

            try {
                // Show loading state
                shareBtn.disabled = true;
                shareBtn.textContent = '🔗 Creating link...';

                const response = await fetch('/create-share-link', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        comparison_data: productsData
                    })
                });

                const result = await response.json();

                if (result.success && result.share_url) {
                    // Copy to clipboard
                    try {
                        await navigator.clipboard.writeText(result.share_url);
                        showToast('✅ Share link copied to clipboard!', 'success', 5000);
                        
                        // Show the link in a prompt as backup
                        setTimeout(() => {
                            prompt('Share this link with anyone:', result.share_url);
                        }, 100);
                    } catch (clipboardError) {
                        // Fallback if clipboard API doesn't work
                        prompt('Share this link with anyone:', result.share_url);
                    }
                } else {
                    showToast('Error creating share link: ' + (result.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                console.error('Failed to create share link:', error);
                showToast('Failed to create share link. Please try again.', 'error');
            } finally {
                // Reset button state
                shareBtn.disabled = false;
                shareBtn.textContent = '🔗 Share Comparison';
            }
        });
    }
});
