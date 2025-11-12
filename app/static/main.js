

// Toast notification system
function showToast(message, type = 'info', duration = 5000) {
    // Get or create toast container
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Icon based on type
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
    
    // Auto-remove after duration
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => {
            container.removeChild(toast);
            // Remove container if empty
            if (container.children.length === 0) {
                document.body.removeChild(container);
            }
        }, 300);
    }, duration);
}

// Saved Searches Dropdown functionality
document.addEventListener('DOMContentLoaded', async () => {
    const dropdownBtn = document.getElementById('saved-searches-dropdown-btn');
    const dropdownContent = document.getElementById('saved-searches-dropdown');
    const dropdownBtnExplore = document.getElementById('saved-searches-dropdown-btn-explore');
    const dropdownContentExplore = document.getElementById('saved-searches-dropdown-explore');
    
    // If no dropdowns exist (free user), exit early
    if (!dropdownBtn && !dropdownBtnExplore) return;
    
    // Load saved searches with mode filter
    async function loadSavedSearches(mode = 'compare', targetDropdown = dropdownContent) {
        try {
            const response = await fetch(`/api/saved_searches?mode=${mode}`);
            if (!response.ok) throw new Error('Failed to load saved searches');
            
            const data = await response.json();
            const searches = data.searches || [];
            
            if (searches.length === 0) {
                targetDropdown.innerHTML = '<div class="dropdown-empty">No saved searches yet</div>';
            } else {
                targetDropdown.innerHTML = searches.map(search => `
                    <div class="saved-search-item">
                        <button class="load-search-btn" data-id="${search.id}" title="Load search">
                            ${search.name}
                        </button>
                        <button class="edit-search-btn" data-id="${search.id}" title="Edit search">✏️</button>
                    </div>
                `).join('');
                
                // Attach load handlers
                targetDropdown.querySelectorAll('.load-search-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const id = btn.dataset.id;
                        
                        try {
                            const response = await fetch(`/api/load_search/${id}`);
                            const data = await response.json();
                            
                            if (data.success) {
                                // Store the search data in sessionStorage to pass to the main page
                                sessionStorage.setItem('loadedSearch', JSON.stringify(data.search));
                                // Reload the page to populate the form
                                window.location.reload();
                            } else {
                                showToast('Failed to load search', 'error');
                            }
                        } catch (error) {
                            console.error('Error loading search:', error);
                            showToast('Failed to load search', 'error');
                        }
                    });
                });
                
                // Attach edit handlers
                targetDropdown.querySelectorAll('.edit-search-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const id = btn.dataset.id;
                        window.location.href = `/saved_searches#search-${id}`;
                    });
                });
            }
        } catch (error) {
            console.error('Error loading saved searches:', error);
            targetDropdown.innerHTML = '<div class="dropdown-error">Failed to load searches</div>';
        }
    }
    
    // Toggle dropdown for Compare mode (if exists)
    if (dropdownBtn && dropdownContent) {
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdownContent.style.display === 'block';
            
            // Close all other dropdowns
            document.querySelectorAll('.dropdown-content').forEach(dc => {
                dc.style.display = 'none';
            });
            
            dropdownContent.style.display = isOpen ? 'none' : 'block';
            
            // Load searches when opening
            if (!isOpen) {
                loadSavedSearches('compare', dropdownContent);
            }
        });
    }
    
    // Toggle dropdown for Explore mode (if exists)
    if (dropdownBtnExplore && dropdownContentExplore) {
        dropdownBtnExplore.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdownContentExplore.style.display === 'block';
            
            // Close all other dropdowns
            document.querySelectorAll('.dropdown-content').forEach(dc => {
                dc.style.display = 'none';
            });
            
            dropdownContentExplore.style.display = isOpen ? 'none' : 'block';
            
            // Load searches when opening
            if (!isOpen) {
                loadSavedSearches('explore', dropdownContentExplore);
            }
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.saved-searches-dropdown')) {
            if (dropdownContent) dropdownContent.style.display = 'none';
            if (dropdownContentExplore) dropdownContentExplore.style.display = 'none';
        }
    });
    
    // Don't do initial load - let mode switching handle it
});

// Mode switching (Compare vs Explore)
let currentMode = 'compare'; // default mode

document.addEventListener('DOMContentLoaded', () => {
    const modeTabs = document.querySelectorAll('.mode-tab');
    const myProductSection = document.getElementById('my-product-section');
    const categoryTitleEl = document.getElementById('category-section-title');
    const nameInput = document.getElementById('name');
    const usageInfoExplore = document.getElementById('usage-info-explore');
    const usageInfoCompare = document.getElementById('usage-info-compare');
    
    // Check if we have a saved mode or loaded search with mode
    const savedMode = sessionStorage.getItem('searchMode');
    if (savedMode) {
        currentMode = savedMode;
        updateModeUI();
    }
    
    function updateModeUI() {
        // Update tab active states
        modeTabs.forEach(tab => {
            if (tab.dataset.mode === currentMode) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Show/hide my product section based on mode
        if (currentMode === 'explore') {
            myProductSection.style.display = 'none';
            if (categoryTitleEl) categoryTitleEl.textContent = 'Browse Categories';
            // Make name not required in explore mode
            if (nameInput) nameInput.removeAttribute('required');
            // Show usage info for free users
            if (usageInfoExplore) usageInfoExplore.style.display = 'block';
            if (usageInfoCompare) usageInfoCompare.style.display = 'none';
            
            // Show/hide saved searches dropdowns
            const compareDropdown = document.querySelector('#my-product-section .saved-searches-dropdown');
            const exploreDropdown = document.querySelector('.category-selection-section .saved-searches-dropdown');
            if (compareDropdown) compareDropdown.style.display = 'none';
            if (exploreDropdown) exploreDropdown.style.display = 'inline-block';
        } else {
            myProductSection.style.display = 'block';
            if (categoryTitleEl) categoryTitleEl.textContent = 'Select Categories';
            // Make name required in compare mode
            if (nameInput) nameInput.setAttribute('required', 'required');
            // Show usage info for compare mode for free users
            if (usageInfoExplore) usageInfoExplore.style.display = 'none';
            if (usageInfoCompare) usageInfoCompare.style.display = 'block';
            
            // Show/hide saved searches dropdowns
            const compareDropdown = document.querySelector('#my-product-section .saved-searches-dropdown');
            const exploreDropdown = document.querySelector('.category-selection-section .saved-searches-dropdown');
            if (compareDropdown) compareDropdown.style.display = 'inline-block';
            if (exploreDropdown) exploreDropdown.style.display = 'none';
        }
    }
    
    // Handle tab clicks
    modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            currentMode = tab.dataset.mode;
            sessionStorage.setItem('searchMode', currentMode);
            updateModeUI();
        });
    });
    
    // Initial update
    updateModeUI();
    
    // Unit selector - update legend when unit changes
    const unitRadios = document.querySelectorAll('[name="nutrition_unit"]');
    const legendUnit = document.getElementById('nutrition-legend-unit');
    
    if (unitRadios.length > 0 && legendUnit) {
        unitRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const selectedUnit = e.target.value;
                legendUnit.textContent = selectedUnit === 'g' ? 'per 100g' : 'per 100ml';
            });
        });
    }
});

let selectedCategories = [];
let categoryTree = [];

// Load category tree and initialize selectors
async function loadCategoryTree() {
    const res = await fetch('/category_tree');
    const data = await res.json();
    categoryTree = data.tree;
    renderCategorySelectors();
}

function renderCategorySelectors(path = []) {
    const container = document.getElementById('category-selectors');
    container.innerHTML = '';
    
    // Create a simple browsable category tree view
    const treeView = document.createElement('div');
    treeView.className = 'category-tree-view';
    
    const header = document.createElement('h3');
    header.className = 'tree-header';
    header.textContent = 'Browse and select categories:';
    treeView.appendChild(header);

    // Search box
    const searchWrap = document.createElement('div');
    searchWrap.className = 'tree-search';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'category-search';
    searchInput.placeholder = 'Search categories...';
    searchWrap.appendChild(searchInput);
    treeView.appendChild(searchWrap);
    
    const treeContainer = document.createElement('div');
    treeContainer.className = 'tree-container';
    
    renderCategoryTree(categoryTree, treeContainer, [], false);
    
    treeView.appendChild(treeContainer);
    
    // Add button to add selected categories
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'add-categories-btn';
    addButton.textContent = 'Add Selected Categories';
    addButton.onclick = addSelectedTreeCategories;
    treeView.appendChild(addButton);
    
    container.appendChild(treeView);

    // Hook up search filtering
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        const filtered = q ? filterCategoryTree(categoryTree, q) : categoryTree;
        treeContainer.innerHTML = '';
        // Force expanded view when searching so matches are visible
        renderCategoryTree(filtered, treeContainer, [], Boolean(q));
    });
}

// Render the category tree recursively
function renderCategoryTree(categories, container, parentPath, forceExpanded = false) {
    // Always sort categories by name (case-insensitive)
    const sorted = (categories || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
    sorted.forEach(category => {
        const item = document.createElement('div');
        item.className = 'tree-item';
        
        const itemContent = document.createElement('div');
        itemContent.className = 'tree-item-content';
        
        const hasChildren = category.children && category.children.length > 0;
        
        // Add expand/collapse icon if has children
        if (hasChildren) {
            const expandIcon = document.createElement('span');
            expandIcon.className = 'expand-icon';
            expandIcon.textContent = forceExpanded ? '▼' : '▶';
            itemContent.appendChild(expandIcon);
        } else {
            const spacer = document.createElement('span');
            spacer.className = 'expand-icon-spacer';
            itemContent.appendChild(spacer);
        }
        
        // Add checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'tree-checkbox';
        checkbox.value = category.id;
        
        const currentPath = [...parentPath, category.name];
        checkbox.dataset.fullPath = currentPath.join(' > ');
        
        // Check if already selected
        if (selectedCategories.some(sc => sc.id === category.id)) {
            checkbox.checked = true;
        }
        
        itemContent.appendChild(checkbox);
        
        // Add category name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'tree-item-name';
        nameSpan.textContent = category.name;
        itemContent.appendChild(nameSpan);
        
        item.appendChild(itemContent);
        
        // Add children if exists
        if (hasChildren) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';
            childrenContainer.style.display = forceExpanded ? 'block' : 'none';
            
            renderCategoryTree(category.children, childrenContainer, currentPath, forceExpanded);
            
            item.appendChild(childrenContainer);
            
            // Toggle children on click
            itemContent.onclick = function(e) {
                if (e.target === checkbox) return; // Don't toggle if clicking checkbox
                
                const icon = itemContent.querySelector('.expand-icon');
                if (childrenContainer.style.display === 'none') {
                    childrenContainer.style.display = 'block';
                    icon.textContent = '▼';
                } else {
                    childrenContainer.style.display = 'none';
                    icon.textContent = '▶';
                }
            };
            
            itemContent.style.cursor = 'pointer';
        }
        
        container.appendChild(item);
    });
}

// Filter the category tree by query, keeping parents of matches. Returns a new pruned tree.
function filterCategoryTree(tree, query) {
    const matchNode = (node) => {
        const name = String(node.name || '').toLowerCase();
        let matched = name.includes(query);
        const children = (node.children || []).map(matchNode).filter(Boolean);
        if (matched || children.length) {
            return { id: node.id, name: node.name, children };
        }
        return null;
    };
    return (tree || []).map(matchNode).filter(Boolean);
}

// Add selected categories from checkboxes
function addSelectedTreeCategories() {
    const checkboxes = document.querySelectorAll('.tree-checkbox:checked');
    let addedCount = 0;
    
    checkboxes.forEach(checkbox => {
        const id = checkbox.value;
        const fullPath = checkbox.dataset.fullPath;
        
        if (!selectedCategories.some(c => c.id === id)) {
            selectedCategories.push({ 
                id: id, 
                name: fullPath 
            });
            addedCount++;
        }
    });
    
    if (addedCount > 0) {
        renderSelectedCategories();
    }
    
    // Optionally show a message if no categories were selected
    if (checkboxes.length === 0) {
        alert('Please select at least one category first.');
    }
}

function getCurrentCategoryPath() {
    const selects = document.querySelectorAll('#category-selectors select');
    let path = [];
    let names = [];
    let level = categoryTree;
    for (let sel of selects) {
        if (!sel.value) break;
        path.push(sel.value);
        const cat = level.find(c => c.id === sel.value);
        if (cat) {
            names.push(cat.name);
            level = cat.children || [];
        } else {
            break;
        }
    }
    console.log({ path, names })
    return { path, names };
}

document.addEventListener('DOMContentLoaded', () => {
    loadCategoryTree();
    
    // Check what editing mode we're in
    const urlParams = new URLSearchParams(window.location.search);
    const editCategoriesId = urlParams.get('editCategories');
    const editNutritionId = urlParams.get('editNutrition');
    
    // Handle category editing mode
    if (editCategoriesId) {
        const editingCategoriesJson = sessionStorage.getItem('editingCategories');
        if (editingCategoriesJson) {
            try {
                const search = JSON.parse(editingCategoriesJson);
                sessionStorage.removeItem('editingCategories');
                
                // Restore selected categories
                if (search.selected_categories && Array.isArray(search.selected_categories)) {
                    selectedCategories = search.selected_categories.map(cat => ({
                        id: cat.id || cat,
                        name: cat.name || cat
                    }));
                    renderSelectedCategories();
                }
                
                // Show notification
                setTimeout(() => {
                    alert(`📋 Category Editor\n\nEditing categories for: "${search.name}"\n\nAdd or remove categories, then click "Find Products" to update.`);
                }, 300);
                
                // Store the editing state
                window.editingSearchId = search.id;
                window.editingSearchName = search.name;
                window.editingSearchData = search;
                window.editingMode = 'categories';
                
            } catch (error) {
                console.error('Failed to load categories for editing:', error);
            }
        }
    }
    // Handle nutrition editing mode
    else if (editNutritionId) {
        const editingNutritionJson = sessionStorage.getItem('editingNutrition');
        if (editingNutritionJson) {
            try {
                const search = JSON.parse(editingNutritionJson);
                sessionStorage.removeItem('editingNutrition');
                
                // Restore categories (read-only)
                if (search.selected_categories && Array.isArray(search.selected_categories)) {
                    selectedCategories = search.selected_categories.map(cat => ({
                        id: cat.id || cat,
                        name: cat.name || cat
                    }));
                    renderSelectedCategories();
                }
                
                // Restore user product data if present
                if (search.user_product_data && search.user_product_data.name) {
                    restoreNutritionData(search.user_product_data);
                }
                
                // Show notification
                setTimeout(() => {
                    alert(`🍎 Nutrition Editor\n\nEditing nutrition data for: "${search.name}"\n\nUpdate the nutrition values or use the photo/text features, then click "Find Products" to update.`);
                }, 300);
                
                // Store the editing state
                window.editingSearchId = search.id;
                window.editingSearchName = search.name;
                window.editingSearchData = search;
                window.editingMode = 'nutrition';
                
            } catch (error) {
                console.error('Failed to load nutrition for editing:', error);
            }
        }
    }
    // Handle regular load (not editing)
    else {
        const loadedSearchJson = sessionStorage.getItem('loadedSearch');
        if (loadedSearchJson) {
            try {
                const search = JSON.parse(loadedSearchJson);
                sessionStorage.removeItem('loadedSearch');
                
                // Restore selected categories
                if (search.selected_categories && Array.isArray(search.selected_categories)) {
                    selectedCategories = search.selected_categories.map(cat => ({
                        id: cat.id || cat,
                        name: cat.name || cat
                    }));
                    renderSelectedCategories();
                }
                
                // Restore user product data if present
                if (search.user_product_data) {
                    restoreNutritionData(search.user_product_data);
                }
                
                // Show a notification that the search was loaded
                setTimeout(() => {
                    showToast('✅ Saved search loaded! Click "Find Products" to run the comparison.', 'success');
                }, 300);
                
            } catch (error) {
                console.error('Failed to load saved search:', error);
            }
        }
    }
    
    // Energy unit toggle (kcal <-> kJ)
    let currentEnergyUnit = 'kcal'; // Default
    const energyInput = document.getElementById('energy-input');
    const energyLabel = document.getElementById('energy-label');
    const toggleEnergyBtn = document.getElementById('toggle-energy-unit');
    
    if (toggleEnergyBtn && energyInput && energyLabel) {
        toggleEnergyBtn.addEventListener('click', () => {
            const currentValue = parseFloat(energyInput.value);
            
            if (currentEnergyUnit === 'kcal') {
                // Switch to kJ
                currentEnergyUnit = 'kj';
                energyInput.name = 'energi_kj';
                energyLabel.childNodes[0].textContent = 'Energy (kJ)';
                toggleEnergyBtn.textContent = 'Switch to kcal';
                
                // Convert value if present
                if (!isNaN(currentValue)) {
                    energyInput.value = (currentValue * 4.184).toFixed(0);
                }
            } else {
                // Switch to kcal
                currentEnergyUnit = 'kcal';
                energyInput.name = 'energi_kcal';
                energyLabel.childNodes[0].textContent = 'Calories (kcal)';
                toggleEnergyBtn.textContent = 'Switch to kJ';
                
                // Convert value if present
                if (!isNaN(currentValue)) {
                    energyInput.value = (currentValue / 4.184).toFixed(0);
                }
            }
        });
    }
    
    const toggleBtn = document.getElementById('toggle-fat-breakdown');
    const breakdown = document.getElementById('fat-breakdown');
    if (toggleBtn && breakdown) {
        toggleBtn.addEventListener('click', () => {
            const shown = breakdown.style.display === 'block';
            breakdown.style.display = shown ? 'none' : 'block';
            toggleBtn.textContent = shown ? 'Specify breakdown' : 'Hide breakdown';
        });
        // Optional validation: warn only if breakdown values exceed total fat
        const totalInput = document.getElementById('fett_totalt');
        const satInput = document.getElementById('mettet_fett');
        const monoInput = document.getElementById('enumettet_fett');
        const polyInput = document.getElementById('flerumettet_fett');
        const warningEl = document.getElementById('fat-breakdown-warning');
        const inputs = [totalInput, satInput, monoInput, polyInput];
        inputs.forEach(inp => inp && inp.addEventListener('input', () => {
            if (!totalInput) return;
            const total = parseFloat(totalInput.value);
            const sat = parseFloat(satInput.value) || 0;
            const mono = parseFloat(monoInput.value) || 0;
            const poly = parseFloat(polyInput.value) || 0;
            
            // Only warn if any breakdown value exceeds total (which would be impossible)
            if (!isNaN(total)) {
                const maxBreakdown = Math.max(sat, mono, poly);
                if (maxBreakdown > total) {
                    warningEl.innerHTML = `Warning: Individual fat component (${maxBreakdown.toFixed(2)}g) cannot exceed total fat (${total.toFixed(2)}g).`;
                    warningEl.style.display = 'block';
                    return;
                }
                
                // Optionally warn if the sum exceeds total (in case all are specified)
                const sum = sat + mono + poly;
                if (sum > total + 0.5) {
                    warningEl.innerHTML = `Warning: Fat breakdown sum (${sum.toFixed(2)}g) exceeds total fat (${total.toFixed(2)}g).`;
                    warningEl.style.display = 'block';
                    return;
                }
            }
            
            warningEl.style.display = 'none';
        }));
    }

    // Carbohydrates breakdown toggle + validation (sugar)
    const carbToggleBtn = document.getElementById('toggle-carb-breakdown');
    const carbBreakdown = document.getElementById('carb-breakdown');
    if (carbToggleBtn && carbBreakdown) {
        carbToggleBtn.addEventListener('click', () => {
            const shown = carbBreakdown.style.display === 'block';
            carbBreakdown.style.display = shown ? 'none' : 'block';
            carbToggleBtn.textContent = shown ? 'Specify carbs breakdown' : 'Hide carbs breakdown';
        });
        const carbsInput = document.getElementById('karbohydrater');
        const sugarInput = document.getElementById('sukkerarter');
        const carbWarn = document.getElementById('carb-breakdown-warning');
        const inputs = [carbsInput, sugarInput];
        inputs.forEach(inp => inp && inp.addEventListener('input', () => {
            if (!carbsInput || !sugarInput) return;
            const carbs = parseFloat(carbsInput.value);
            const sugar = parseFloat(sugarInput.value);
            // If no sugar provided, hide warning
            if (isNaN(sugar)) {
                carbWarn.style.display = 'none';
                return;
            }
            if (isNaN(carbs)) {
                carbWarn.textContent = 'Tip: Provide total carbohydrates to validate the sugar share.';
                carbWarn.style.display = 'block';
                return;
            }
            if (sugar > carbs + 0.01) {
                carbWarn.textContent = `Warning: sugar (${sugar.toFixed(2)}g) exceeds total carbs (${carbs.toFixed(2)}g).`;
                carbWarn.style.display = 'block';
            } else {
                carbWarn.style.display = 'none';
            }
        }));
    }
});

function renderSelectedCategories() {
    const div = document.getElementById('selected-categories');
    div.innerHTML = '';
    selectedCategories.forEach((cat, idx) => {
        const el = document.createElement('span');
        el.className = 'selected-category';
        el.textContent = cat.name;
        const remove = document.createElement('button');
        remove.textContent = '×';
        remove.onclick = () => {
            selectedCategories.splice(idx, 1);
            renderSelectedCategories();
        };
        el.appendChild(remove);
        div.appendChild(el);
    });
}



document.getElementById('find-products').onclick = async function() {
    if (selectedCategories.length === 0) {
        showToast('Please select at least one category first.', 'warning');
        return;
    }

    // Show loading state
    this.disabled = true;
    this.textContent = 'Finding Products...';

    try {
        // Collect user product data from the form (per 100g) - only if in compare mode
        const form = document.getElementById('product-form');
        const formData = new FormData(form);
        
        let userProduct = null;
        if (currentMode === 'compare') {
            userProduct = {
                name: formData.get('name') || 'My Product',
                description: formData.get('description') || '',
                nutrition: (() => {
                    const nut = {
                        energi_kcal: valWithUnit(formData.get('energi_kcal'), 'kcal'),
                        energi_kj: valWithUnit(formData.get('energi_kj'), 'kJ'),
                        fett_totalt: valWithUnit(formData.get('fett_totalt'), 'g'),
                        karbohydrater: valWithUnit(formData.get('karbohydrater'), 'g'),
                        kostfiber: valWithUnit(formData.get('kostfiber'), 'g'),
                        protein: valWithUnit(formData.get('protein'), 'g'),
                        salt: valWithUnit(formData.get('salt'), 'g')
                    };
                    // Only include breakdown fields if user expanded and provided any
                    const breakdownVisible = document.getElementById('fat-breakdown')?.style.display === 'block';
                    if (breakdownVisible) {
                        const sat = valWithUnit(formData.get('mettet_fett'), 'g');
                        const mono = valWithUnit(formData.get('enumettet_fett'), 'g');
                        const poly = valWithUnit(formData.get('flerumettet_fett'), 'g');
                        if (sat) nut.mettet_fett = sat;
                        if (mono) nut.enumettet_fett = mono; // monounsaturated
                        if (poly) nut.flerumettet_fett = poly; // polyunsaturated
                    }
                    // Include sugar only if carbs breakdown is visible and value present
                    const carbBreakdownVisible = document.getElementById('carb-breakdown')?.style.display === 'block';
                    if (carbBreakdownVisible) {
                        const sugar = valWithUnit(formData.get('sukkerarter'), 'g');
                        if (sugar) nut.sukkerarter = sugar;
                    }
                    return nut;
                })()
            };
        }
        
        // Get selected nutrition unit
        const nutritionUnit = document.querySelector('[name="nutrition_unit"]:checked')?.value || 'g';

        const response = await fetch('/find_products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                selected_categories: selectedCategories, 
                user_product: userProduct,
                mode: currentMode,
                nutrition_unit: nutritionUnit 
            })
        });

        if (!response.ok) {
            // Check for rate limit error
            if (response.status === 429) {
                const errorData = await response.json();
                showToast(errorData.message || 'Daily explore limit reached. Upgrade to Premium for unlimited access!', 'error');
                this.textContent = 'Find Products';
                this.disabled = false;
                return;
            }
            throw new Error('Failed to fetch products');
        }

        const data = await response.json();

        // Store product data in server-side cache and redirect with a tiny key
        const storeResp = await fetch('/set_product_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!storeResp.ok) {
            throw new Error('Failed to store product data');
        }
        const storeJson = await storeResp.json();
        const key = storeJson && storeJson.key;
        if (key) {
            // Check if we're in editing mode
            let url = `/comparison?key=${encodeURIComponent(key)}&mode=${currentMode}`;
            if (window.editingSearchId && window.editingSearchName) {
                url += `&editing=${window.editingSearchId}`;
                // Store editing data for comparison page
                sessionStorage.setItem('editingSearchData', JSON.stringify({
                    id: window.editingSearchId,
                    name: window.editingSearchName,
                    mode: window.editingMode || 'full'
                }));
            }
            window.location.href = url;
        } else {
            // Fallback if key missing
            window.location.href = '/comparison';
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to fetch products. Please try again.', 'error');
        this.textContent = 'Find Products';
        this.disabled = false;
    }
};

// Helpers
function valWithUnit(value, unit) {
    const num = parseFloat(value);
    if (isNaN(num)) return null;
    return { amount: num, unit: unit };
}

// ============================================
// Nutrition Text Parser
// ============================================

// Modal control
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('nutrition-paste-modal');
    const openBtn = document.getElementById('paste-nutrition-btn');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.modal-cancel');
    const parseBtn = document.getElementById('parse-nutrition-btn');
    
    // Mode tabs and content
    const textTab = document.querySelector('.modal-tab[data-mode="text"]');
    const photoTab = document.querySelector('.modal-tab[data-mode="photo"]');
    const textMode = document.getElementById('text-mode');
    const photoMode = document.getElementById('photo-mode');
    
    // Text mode elements
    const textarea = document.getElementById('nutrition-paste-textarea');
    
    // Photo mode elements
    const photoInput = document.getElementById('nutrition-photo-input');
    const selectPhotoBtn = document.getElementById('select-photo-btn');
    const fileUploadArea = document.querySelector('.file-upload-area');
    const photoPreviewArea = document.getElementById('photo-preview-area');
    const photoPreview = document.getElementById('photo-preview');
    const photoFilename = document.getElementById('photo-filename');
    const removePhotoBtn = document.getElementById('remove-photo-btn');
    const ocrStatus = document.getElementById('ocr-status');
    const ocrResult = document.getElementById('ocr-result');
    const ocrExtractedText = document.getElementById('ocr-extracted-text');
    
    let currentMode = 'text';
    let selectedFile = null;

    // Open modal
    openBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
        resetModal();
        textarea.focus();
    });

    // Close modal
    const closeModal = () => {
        modal.style.display = 'none';
        resetModal();
    };

    const resetModal = () => {
        textarea.value = '';
        selectedFile = null;
        photoInput.value = '';
        photoPreviewArea.style.display = 'none';
        ocrStatus.style.display = 'none';
        ocrResult.style.display = 'none';
        ocrExtractedText.value = '';
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Tab switching
    textTab.addEventListener('click', () => {
        currentMode = 'text';
        textTab.classList.add('active');
        photoTab.classList.remove('active');
        textMode.classList.add('active');
        photoMode.classList.remove('active');
    });

    photoTab.addEventListener('click', () => {
        currentMode = 'photo';
        photoTab.classList.add('active');
        textTab.classList.remove('active');
        photoMode.classList.add('active');
        textMode.classList.remove('active');
    });

    // File selection
    selectPhotoBtn.addEventListener('click', () => {
        photoInput.click();
    });

    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileSelected(file);
        }
    });

    // Drag and drop
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.classList.add('drag-over');
    });

    fileUploadArea.addEventListener('dragleave', () => {
        fileUploadArea.classList.remove('drag-over');
    });

    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleFileSelected(file);
        }
    });

    // Handle file selection
    async function handleFileSelected(file) {
        selectedFile = file;
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            photoPreview.src = e.target.result;
            photoFilename.textContent = file.name;
            photoPreviewArea.style.display = 'block';
            fileUploadArea.style.display = 'none';
        };
        reader.readAsDataURL(file);
        
        // Start OCR
        await performOCR(file);
    }

    // Remove photo
    removePhotoBtn.addEventListener('click', () => {
        selectedFile = null;
        photoInput.value = '';
        photoPreviewArea.style.display = 'none';
        ocrStatus.style.display = 'none';
        ocrResult.style.display = 'none';
        ocrExtractedText.value = '';
        fileUploadArea.style.display = 'block';
    });

    // Perform Vision AI analysis (no OCR needed!)
    async function performOCR(file) {
        ocrStatus.querySelector('span').textContent = 'Analyzing image with AI...';
        ocrStatus.style.display = 'flex';
        ocrResult.style.display = 'none';
        
        try {
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await fetch('/extract_nutrition_from_image', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Vision AI failed');
            }
            
            const data = await response.json();
            
            ocrStatus.style.display = 'none';
            
            if (data.nutrition && Object.keys(data.nutrition).length > 0) {
                // Show extracted values as text preview
                const preview = Object.entries(data.nutrition)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\n');
                ocrExtractedText.value = `AI extracted ${Object.keys(data.nutrition).length} values:\n\n${preview}`;
                ocrResult.style.display = 'block';
                
                // Store the nutrition data for the parse button
                ocrExtractedText.dataset.nutrition = JSON.stringify(data.nutrition);
            } else {
                alert('No nutrition values could be extracted from the image. Please try a clearer photo showing the nutrition label.');
            }
        } catch (error) {
            console.error('Vision AI error:', error);
            ocrStatus.style.display = 'none';
            alert(`Failed to analyze image: ${error.message}\n\nPlease ensure your OpenAI API key is configured in .env file.`);
        }
    }

    // Parse button - use AI to extract nutrition values
    parseBtn.addEventListener('click', async () => {
        let nutritionData = null;
        
        if (currentMode === 'text') {
            const text = textarea.value.trim();
            if (!text) {
                alert('Please provide some text to parse.');
                return;
            }
            
            // Show loading state
            parseBtn.disabled = true;
            parseBtn.textContent = 'Extracting with AI...';
            
            try {
                // Call AI extraction API for text
                const response = await fetch('/extract_nutrition_ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to extract nutrition values');
                }
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                nutritionData = data.nutrition;
                
            } catch (error) {
                console.error('Error extracting nutrition:', error);
                alert(`Failed to extract nutrition values: ${error.message}`);
                parseBtn.disabled = false;
                parseBtn.textContent = 'Parse and Fill';
                return;
            } finally {
                parseBtn.disabled = false;
                parseBtn.textContent = 'Parse and Fill';
            }
            
        } else if (currentMode === 'photo') {
            // Photo mode - use pre-extracted data from Vision API
            const storedData = ocrExtractedText.dataset.nutrition;
            if (!storedData) {
                alert('Please upload a photo first.');
                return;
            }
            nutritionData = JSON.parse(storedData);
        }
        
        if (nutritionData && Object.keys(nutritionData).length > 0) {
            // Fill the form with AI-extracted values
            fillNutritionForm(nutritionData);
            closeModal();
        } else {
            alert('No nutrition values could be extracted. Please check the input and try again.');
        }
    });
});

function parseNutritionText(text) {
    const result = {};
    
    // Normalize line breaks and whitespace for easier parsing
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Helper function to extract number from various formats
    const extractNumber = (str) => {
        if (!str) return null;
        // Remove whitespace
        let cleaned = str.trim().replace(/\s+/g, '');
        
        // Handle both comma and dot as decimal separator
        // If we have both, assume comma is thousands separator
        if (cleaned.includes(',') && cleaned.includes('.')) {
            // Format like "1,234.56" - remove comma (thousands separator)
            cleaned = cleaned.replace(/,/g, '');
        } else if (cleaned.includes(',')) {
            // Format like "2,184" or "31,5" - comma is decimal separator
            cleaned = cleaned.replace(',', '.');
        }
        
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    };
    
    // Intelligent value correction based on nutritional context
    const correctNutritionalValue = (value, fieldType) => {
        if (value === null || value === undefined) return null;
        
        // Round to max 2 decimal places initially
        value = Math.round(value * 100) / 100;
        
        // Define reasonable ranges per 100g for different nutrition types
        const ranges = {
            energy_kcal: { min: 0, max: 900 },      // Max ~900 kcal per 100g (pure fat/oil)
            energy_kj: { min: 0, max: 4000 },       // Max ~4000 kJ per 100g
            fat_total: { min: 0, max: 100 },        // Max 100g per 100g (pure fat)
            fat_saturated: { min: 0, max: 100 },
            fat_mono: { min: 0, max: 100 },
            fat_poly: { min: 0, max: 100 },
            carbs: { min: 0, max: 100 },            // Max 100g per 100g (pure carbs)
            sugar: { min: 0, max: 100 },
            fiber: { min: 0, max: 50 },             // Max ~50g per 100g (high fiber foods)
            protein: { min: 0, max: 100 },          // Max 100g per 100g (pure protein)
            salt: { min: 0, max: 15 }               // Max ~15g per 100g (very salty foods)
        };
        
        const range = ranges[fieldType] || { min: 0, max: 100 };
        
        // Special case: if value ends in 9 and is close to a round number, OCR might have added digit
        // E.g., 4.29 → 4.2, 2.19 → 2.1, 5.09 → 5.0
        // Do this BEFORE decimal point correction
        const str = value.toString();
        if (str.match(/\.\d*9$/)) {
            // Try removing the last digit
            const withoutLast = parseFloat(str.slice(0, -1));
            if (!isNaN(withoutLast)) {
                console.log(`Removed trailing 9 from ${fieldType}: ${value} → ${withoutLast}`);
                value = withoutLast;
            }
        }
        
        // If value is way too high, OCR likely missed a decimal point
        // Try inserting decimal point at different positions
        if (value > range.max) {
            const originalStr = Math.round(value).toString();
            let bestCandidate = value;
            let bestScore = -1;
            
            // Try inserting decimal point at different positions
            // E.g., 289 → try 28.9 (score lower), 2.89 (score higher for small values)
            //       540 → try 54.0 (score higher for typical macro), 5.40 (score lower)
            for (let i = 1; i < originalStr.length; i++) {
                const candidate = parseFloat(originalStr.slice(0, i) + '.' + originalStr.slice(i));
                if (candidate >= range.min && candidate <= range.max) {
                    let score = 0;
                    
                    // Score based on how typical the value is for nutrition labels
                    if (fieldType === 'salt' && candidate >= 0.5 && candidate <= 5) {
                        score = 100;
                    } else if (fieldType === 'salt' && candidate >= 0.1 && candidate <= 10) {
                        score = 50; // Less common but valid
                    } else if (['carbs', 'fat_total', 'protein'].includes(fieldType)) {
                        // For macros, prefer larger values (more typical)
                        if (candidate >= 20 && candidate <= 80) {
                            score = 100; // Very typical range
                        } else if (candidate >= 5 && candidate <= 90) {
                            score = 80; // Common range
                        } else if (candidate >= 1 && candidate <= 100) {
                            score = 50; // Valid but less common
                        } else {
                            score = 20; // Unusual but possible
                        }
                    } else if (fieldType === 'fiber') {
                        if (candidate >= 2 && candidate <= 15) {
                            score = 100;
                        } else if (candidate >= 0.5 && candidate <= 30) {
                            score = 60;
                        } else {
                            score = 30;
                        }
                    } else if (['fat_saturated', 'sugar'].includes(fieldType)) {
                        // These are typically small values (0.5-15g most common)
                        if (candidate >= 0.5 && candidate <= 10) {
                            score = 100; // Most typical range
                        } else if (candidate >= 0.1 && candidate <= 20) {
                            score = 70; // Less common but valid
                        } else if (candidate >= 20 && candidate <= 50) {
                            score = 40; // Unusual (high saturated fat)
                        } else {
                            score = 20;
                        }
                    } else {
                        score = 50; // Generic fallback
                    }
                    
                    // Prefer values with fewer trailing zeros in decimal (54.0 over 5.40)
                    const decimalPart = candidate.toString().split('.')[1] || '';
                    const trailingZeros = decimalPart.length - decimalPart.replace(/0+$/, '').length;
                    if (trailingZeros === 1) score += 5; // 54.0 gets small bonus
                    if (decimalPart.replace(/0+$/, '').length <= 1) score += 5; // Clean decimals bonus
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestCandidate = candidate;
                    }
                }
            }
            
            if (bestCandidate !== value) {
                console.log(`Inserted decimal point in ${fieldType}: ${value} → ${bestCandidate} (score: ${bestScore})`);
                value = bestCandidate;
            } else {
                // Fallback: just divide by 10 repeatedly until in range
                let corrected = value;
                let attempts = 0;
                
                while (corrected > range.max && attempts < 3) {
                    corrected = corrected / 10;
                    attempts++;
                }
                
                if (corrected >= range.min && corrected <= range.max) {
                    console.log(`Divided ${fieldType}: ${value} → ${corrected}`);
                    value = corrected;
                }
            }
        }
        
        // Final rounding to 2 decimal places
        return Math.round(value * 100) / 100;
    };
    
    // Split into lines for line-by-line parsing (handles both formats well)
    const lines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Pattern definitions for different nutrition fields
    // These handle both inline format (Energy: 123 kcal) and multi-line format (Energy\n123kcal)
    const patterns = {
        // Energy patterns - support both kcal and kJ in various formats
        // Handles: "Energy 1820kJ", "Energi 2,184 kj", "Kalorier 521 kcal", "Energy\n432kcal"
        energy_kcal: [
            /(?:energy|calories?|kalorier)\s*[\s:]*(\d+(?:[,\.]\s*\d+)?)\s*(?:kcal|cal)/i,
            /(?:energy|kalorier)[\s\n]+[\s\t]*(\d+(?:[,\.]\s*\d+)?)[\s]*kcal/i,
            /(\d+(?:[,\.]\s*\d+)?)\s*kcal/i
        ],
        energy_kj: [
            /(?:energy|energi)\s*[\s:]*(\d+(?:[,\.]\s*\d+)?)\s*kj/i,
            /(?:energy|energi)[\s\n]+[\s\t]*(\d+(?:[,\.]\s*\d+)?)[\s]*kj/i,
            /(\d+(?:[,\.]\s*\d+)?)\s*kj/i
        ],
        
        // Fat patterns - handles "Fat 12.4g", "Fett 31.0 g", etc.
        fat_total: [
            /(?:^|\n|^total\s+)?(?:fat|fett)\s*[\s:]*(\d+(?:[,\.]\d+)?)\s*g/im,
            /(?:^|\n)(?:fat|fett)[\s\n]+[\s\t]*(\d+(?:[,\.]\d+)?)[\s]*g/im
        ],
        
        // Saturated fat - handles "of which saturates 1.0g", "Mettet fett 2.8 g"
        fat_saturated: [
            /(?:of\s+which\s+)?(?:saturates?|saturated|mettet\s*fett?)\s*[\s:]*(\d+(?:[,\.]\d+)?)\s*g/i,
            /(?:mettet\s*fett?|saturated?)[\s\n]+[\s\t]*(\d+(?:[,\.]\d+)?)[\s]*g/i
        ],
        
        // Mono/poly unsaturated (less common but still supported)
        fat_mono: [
            /(?:mono[^a-z]*unsaturated?|enumettet)\s*[\s:]*(\d+(?:[,\.]\d+)?)\s*g/i
        ],
        fat_poly: [
            /(?:poly[^a-z]*unsaturated?|flerumettet)\s*[\s:]*(\d+(?:[,\.]\d+)?)\s*g/i
        ],
        
        // Carbohydrates - handles "Carbohydrate 69.1g", "Karbohydrater 54.0 g"
        carbs: [
            /(?:^|\n|^total\s+)?(?:carbohydrate?s?|karbohydrat(?:er)?)\s*[\s:]*(\d+(?:[,\.]\d+)?)\s*g/im,
            /(?:carbohydrate?s?|karbohydrat(?:er)?)[\s\n]+[\s\t]*(\d+(?:[,\.]\d+)?)[\s]*g/im
        ],
        
        // Sugar - handles "of which sugars 2.0g", "Sukkerarter 2.1 g"
        sugar: [
            /(?:of\s+which\s+)?(?:sugars?|sukkerarter?)\s*[\s:]*(\d+(?:[,\.]\d+)?)\s*g/i,
            /(?:sukkerarter?|sugars?)[\s\n]+[\s\t]*(\d+(?:[,\.]\d+)?)[\s]*g/i
        ],
        
        // Fiber - handles "Fibre 5.2g", "Kostfiber 4.2 g"
        fiber: [
            /(?:fiber|fibre|kostfiber)\s*[\s:]*(\d+(?:[,\.]\d+)?)\s*g/i,
            /(?:fiber|fibre|kostfiber)[\s\n]+[\s\t]*(\d+(?:[,\.]\d+)?)[\s]*g/i
        ],
        
        // Protein - handles "Protein 8.5g", "Protein 5.0 g"
        protein: [
            /(?:^|\n)(?:protein)\s*[\s:]*(\d+(?:[,\.]\d+)?)\s*g/im,
            /(?:^|\n)(?:protein)[\s\n]+[\s\t]*(\d+(?:[,\.]\d+)?)[\s]*g/im
        ],
        
        // Salt - handles "Salt 0.70g", "Salt 1.7 g"
        salt: [
            /(?:^|\n)(?:salt|salz)\s*[\s:]*(\d+(?:[,\.]\d+)?)\s*g/im,
            /(?:^|\n)(?:salt|salz)[\s\n]+[\s\t]*(\d+(?:[,\.]\d+)?)[\s]*g/im
        ]
    };
    
    // Extract values using patterns (try all patterns for each field)
    for (const [key, patternList] of Object.entries(patterns)) {
        const patterns = Array.isArray(patternList) ? patternList : [patternList];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                // Convert comma to dot for decimal separator and remove spaces
                const rawValue = extractNumber(match[1]);
                if (rawValue !== null) {
                    // Apply intelligent correction based on field type
                    const correctedValue = correctNutritionalValue(rawValue, key);
                    if (correctedValue !== null) {
                        result[key] = correctedValue;
                        break; // Found a match, move to next field
                    }
                }
            }
        }
    }
    
    return result;
}

function fillNutritionForm(parsed) {
    // Map parsed values to form fields
    const fieldMap = {
        energy_kcal: 'energi_kcal',
        energy_kj: 'energi_kj',
        fat_total: 'fett_totalt',
        fat_saturated: 'mettet_fett',
        fat_mono: 'enumettet_fett',
        fat_poly: 'flerumettet_fett',
        carbs: 'karbohydrater',
        sugar: 'sukkerarter',
        fiber: 'kostfiber',
        protein: 'protein',
        salt: 'salt'
    };
    
    // Track which fields were filled
    let hasFatBreakdown = false;
    let hasCarbBreakdown = false;
    
    // Fill the form fields
    for (const [parsedKey, value] of Object.entries(parsed)) {
        const fieldName = fieldMap[parsedKey];
        if (fieldName) {
            const input = document.querySelector(`input[name="${fieldName}"], input[id="${fieldName}"]`);
            if (input) {
                input.value = value;
                
                // Track if we need to show breakdown sections
                if (['mettet_fett', 'enumettet_fett', 'flerumettet_fett'].includes(fieldName)) {
                    hasFatBreakdown = true;
                }
                if (fieldName === 'sukkerarter') {
                    hasCarbBreakdown = true;
                }
            }
        }
    }
    
    // Auto-expand fat breakdown if we filled any fat sub-fields
    if (hasFatBreakdown) {
        const fatBreakdown = document.getElementById('fat-breakdown');
        const toggleBtn = document.getElementById('toggle-fat-breakdown');
        if (fatBreakdown && fatBreakdown.style.display === 'none') {
            fatBreakdown.style.display = 'block';
            if (toggleBtn) toggleBtn.textContent = 'Hide breakdown';
        }
    }
    
    // Auto-expand carb breakdown if we filled sugar
    if (hasCarbBreakdown) {
        const carbBreakdown = document.getElementById('carb-breakdown');
        const toggleBtn = document.getElementById('toggle-carb-breakdown');
        if (carbBreakdown && carbBreakdown.style.display === 'none') {
            carbBreakdown.style.display = 'block';
            if (toggleBtn) toggleBtn.textContent = 'Hide breakdown';
        }
    }
    
    // Show a brief success message
    const legend = document.querySelector('.nutrition-group legend');
    if (legend) {
        const originalText = legend.textContent;
        const filledCount = Object.keys(parsed).length;
        legend.textContent = `Nutrition (per 100g) - ✓ Filled ${filledCount} field${filledCount !== 1 ? 's' : ''}`;
        legend.style.color = '#059669';
        setTimeout(() => {
            legend.textContent = originalText;
            legend.style.color = '';
        }, 3000);
    }
}

// Helper function to restore nutrition data from saved search
function restoreNutritionData(userData) {
    const nutrition = userData.nutrition || {};
    
    // Restore name and description - use correct IDs for main page
    const nameInput = document.getElementById('name') || document.getElementById('name-input');
    const descInput = document.getElementById('description') || document.getElementById('description-input');
    if (nameInput) nameInput.value = userData.name || '';
    if (descInput) descInput.value = userData.description || '';
    
    // Restore nutrition values (remove units from stored values)
    const extractValue = (val) => {
        if (!val) return '';
        if (typeof val === 'object' && val.amount !== undefined) return val.amount;
        const match = String(val).match(/^([\d.]+)/);
        return match ? match[1] : '';
    };
    
    const energyInput = document.getElementById('energy-input');
    if (energyInput) {
        energyInput.value = extractValue(nutrition.energi_kcal);
        energyInput.name = 'energi_kcal';
    }
    
    // Map nutrition keys to possible input IDs (main page vs edit page)
    const inputs = {
        'fett_totalt': ['fett_totalt', 'fat-input'],
        'karbohydrater': ['karbohydrater', 'carbs-input'],
        'kostfiber': ['kostfiber', 'fiber-input'],
        'protein': ['protein', 'protein-input'],
        'salt': ['salt', 'salt-input']
    };
    
    for (const [nutrient, possibleIds] of Object.entries(inputs)) {
        let input = null;
        for (const id of possibleIds) {
            input = document.getElementById(id);
            if (input) break;
        }
        if (input && nutrition[nutrient]) {
            input.value = extractValue(nutrition[nutrient]);
        }
    }
    
    // Always fill breakdown sections if they have data (handle both main page and edit page IDs)
    const satInput = document.getElementById('mettet_fett') || document.getElementById('saturated-input');
    const monoInput = document.getElementById('enumettet_fett') || document.getElementById('monounsaturated-input');
    const polyInput = document.getElementById('flerumettet_fett') || document.getElementById('polyunsaturated-input');
    if (satInput && nutrition.mettet_fett) satInput.value = extractValue(nutrition.mettet_fett);
    if (monoInput && nutrition.enumettet_fett) monoInput.value = extractValue(nutrition.enumettet_fett);
    if (polyInput && nutrition.flerumettet_fett) polyInput.value = extractValue(nutrition.flerumettet_fett);
    
    const sugarInput = document.getElementById('sukkerarter') || document.getElementById('sugar-input');
    if (sugarInput && nutrition.sukkerarter) sugarInput.value = extractValue(nutrition.sukkerarter);
    
    // Show breakdown sections if they have data (for main page with toggles)
    if (nutrition.mettet_fett || nutrition.enumettet_fett || nutrition.flerumettet_fett) {
        const fatBreakdown = document.getElementById('fat-breakdown');
        const toggleFatBtn = document.getElementById('toggle-fat-breakdown');
        if (fatBreakdown && toggleFatBtn) {
            fatBreakdown.style.display = 'block';
            toggleFatBtn.textContent = 'Hide Fat Breakdown';
        }
    }
    
    if (nutrition.sukkerarter) {
        const carbBreakdown = document.getElementById('carb-breakdown');
        const toggleCarbBtn = document.getElementById('toggle-carb-breakdown');
        if (carbBreakdown && toggleCarbBtn) {
            carbBreakdown.style.display = 'block';
            toggleCarbBtn.textContent = 'Hide Carb Breakdown';
        }
    }
}
