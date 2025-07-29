(function() {
    let productsList = JSON.parse(localStorage.getItem('products')) || (typeof products !== 'undefined' ? products : []);
    let clientsList = JSON.parse(localStorage.getItem('clients')) || (typeof clients !== 'undefined' ? clients : []);

    let currentDescRow = null; // For editing detailed description

    function parsePercentageOrNumber(value) {
        if (typeof value !== 'string') value = String(value);
        value = value.trim();
        if (value.endsWith('%')) {
            const num = parseFloat(value.slice(0, -1));
            return isNaN(num) ? 0 : num;
        }
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
    }

    function getInvoiceCache() {
        return JSON.parse(localStorage.getItem('invoiceCache')) || {};
    }

    function setInvoiceCache(cache) {
        localStorage.setItem('invoiceCache', JSON.stringify(cache));
    }

    function displayCache(query = '') {
        const cacheContainer = document.getElementById('cacheContainer');
        if (!cacheContainer) return;

        cacheContainer.innerHTML = '';

        const invoiceCache = getInvoiceCache();
        const allKeys = Object.keys(invoiceCache);

        const keys = allKeys.filter(key => {
            const parts = key.split(':');
            if (parts.length < 2) return false;
            const [invoiceType, title] = parts;
            return (
                invoiceType.toLowerCase().includes(query.toLowerCase()) ||
                title.toLowerCase().includes(query.toLowerCase())
            );
        }).sort((a, b) => a.localeCompare(b));

        if (keys.length === 0) {
            cacheContainer.innerHTML = '<div class="no-results">No saved invoices found</div>';
            return;
        }

        keys.forEach(key => {
            const [invoiceType, title] = key.split(':');
            const versions = invoiceCache[key];
            versions.sort((a, b) => new Date(b.date) - new Date(a.date));
            const latestVersion = versions[0];
            const versionCount = versions.length;

            const invoiceElement = document.createElement('div');
            invoiceElement.className = 'cached-invoice';
            invoiceElement.style.border = '1px solid #ccc';
            invoiceElement.style.padding = '10px';
            invoiceElement.style.margin = '10px 0';

            invoiceElement.innerHTML = `
                <div class="invoice-preview">
                    <strong>
                        ${invoiceType} - ${title} 
                        (<span class="version-count" style="cursor:pointer;" onclick="toggleVersions('${invoiceType}:${title}')">v${versionCount}</span>)
                    </strong>
                    <p>Latest Date: ${latestVersion.date}</p>
                </div>
                <div class="invoice-actions">
                    <button onclick="loadLatestVersion('${invoiceType}:${title}')">Load</button>
                    <button onclick="deleteAllVersions('${invoiceType}:${title}')">Delete</button>
                </div>
                <div class="versions-dropdown" style="display:none; margin-top:10px; border:1px solid #ddd; padding:10px;"></div>
            `;

            cacheContainer.appendChild(invoiceElement);
        });
    }

    window.toggleVersions = function(key) {
        const container = document.getElementById('cacheContainer');
        const invoiceElements = container.getElementsByClassName('cached-invoice');
        let targetDropdown;
        for (let el of invoiceElements) {
            const dropdown = el.querySelector('.versions-dropdown');
            if (el.innerHTML.includes(key)) {
                targetDropdown = dropdown;
                break;
            }
        }
        if (!targetDropdown) return;

        if (targetDropdown.style.display === 'none' || targetDropdown.style.display === '') {
            showVersions(key);
        } else {
            targetDropdown.style.display = 'none';
        }
    };

    window.showVersions = function(key) {
        const invoiceCache = getInvoiceCache();
        const versions = invoiceCache[key];
        const container = document.getElementById('cacheContainer');
        const invoiceElements = container.getElementsByClassName('cached-invoice');
        let targetDropdown;
        for (let el of invoiceElements) {
            const dropdown = el.querySelector('.versions-dropdown');
            if (el.innerHTML.includes(key)) {
                targetDropdown = dropdown;
                break;
            }
        }
        if (!targetDropdown) return;

        targetDropdown.innerHTML = '';
        versions.forEach((version, index) => {
            const versionDate = new Date(version.date);
            const dateString = versionDate.toLocaleString();
            const btn = document.createElement('button');
            btn.textContent = `Version ${index+1} - ${dateString}`;
            btn.onclick = () => {
                loadVersion(key, index);
            };
            targetDropdown.appendChild(btn);
            targetDropdown.appendChild(document.createElement('br'));
        });
        targetDropdown.style.display = 'block';
    };

    window.loadVersion = function(key, index) {
        const invoiceCache = getInvoiceCache();
        const versions = invoiceCache[key];
        if (index < 0 || index >= versions.length) {
            alert("Invalid version index");
            return;
        }
        const versionData = versions[index].data;

        document.getElementById('toggleSwitch').checked = (versionData.invoiceType === 'Facture');
        handleInvoiceTypeChange();

        document.getElementById('title').value = versionData.title;
        document.getElementById('invoiceNumber').value = versionData.invoiceNumber;
        document.getElementById('date').value = versionData.date;
        document.getElementById('validityDate').value = versionData.validityDate;
        document.getElementById('customerName').value = versionData.customerName;
        document.getElementById('customerAddress').value = versionData.customerAddress;
        document.getElementById('customerSiren').value = versionData.customerSiren;
        document.getElementById('customerTva').value = versionData.customerTva;
        document.getElementById('tva').value = versionData.tva;

       


        document.getElementById('acompte').value = versionData.acompte;

        const tbody = document.getElementById('invoiceTable');
        tbody.innerHTML = '';

        versionData.lines.forEach(line => {
            const newRow = createLine(line.description, line.price);
            // Restore detailedDescription if available
            if (line.detailedDescription) {
                newRow._detailedDescription = line.detailedDescription;
            }
        });

        updateTotalFields();
    };

    window.deleteAllVersions = function(key) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer toutes les versions de cette facture/devis?')) return;

        const invoiceCache = getInvoiceCache();
        if (invoiceCache[key]) {
            delete invoiceCache[key];
            setInvoiceCache(invoiceCache);
            displayCache();
            alert("All versions of this invoice have been deleted!");
        }
    };

    window.loadLatestVersion = function(key) {
        const invoiceCache = getInvoiceCache();
        const versions = invoiceCache[key];
        if (!versions || versions.length === 0) return;
        loadVersion(key, 0);
    };

    function handleInvoiceTypeChange() {
        const toggleSwitch = document.getElementById('toggleSwitch');
        const titleElement = document.getElementById('title');
        const invoiceTypeLabel = document.getElementById('invoiceTypeLabel');
        const numberTypeLabel = document.getElementById('numberTypeLabel');
        const mainTitle = document.getElementById('mainTitle');
        const acompteField = document.getElementById('acompteField');
        const resteDuField = document.getElementById('resteDuField');
        const printButton = document.getElementById('printButton');

        if (!invoiceTypeLabel) return;

        if (toggleSwitch.checked) {
            titleElement.value = titleElement.value.replace('Devis', 'Facture');
            invoiceTypeLabel.textContent = 'Facture';
            numberTypeLabel.textContent = 'facture';
            mainTitle.textContent = 'Facture Generator';
            acompteField.style.display = 'block';
            resteDuField.style.display = 'block';
            if (printButton) printButton.disabled = false;
        } else {
            titleElement.value = titleElement.value.replace('Facture', 'Devis');
            invoiceTypeLabel.textContent = 'Devis';
            numberTypeLabel.textContent = 'devis';
            mainTitle.textContent = 'Devis Generator';
            acompteField.style.display = 'none';
            resteDuField.style.display = 'none';
            // Enable print in Devis mode too
            if (printButton) printButton.disabled = false;
        }

        updateTotalFields();
    }

    function handleDescriptionSearch(event) {
        const input = event.target;
        const query = input.value.toLowerCase().trim();
        const dropdown = input.parentNode.querySelector('.dropdown');

        if (!dropdown) return;
        dropdown.innerHTML = '';

        if (query) {
            const matches = productsList.filter(p => p.title.toLowerCase().includes(query));
            if (matches.length > 0) {
                matches.forEach(product => {
                    const item = document.createElement('div');
                    item.classList.add('dropdown-item');
                    item.textContent = product.title;
                    item.onclick = () => {
                        input.value = product.title;
                        const row = input.closest('tr');
                        const priceInput = row.querySelector('.price-input');
                        if (priceInput) priceInput.value = product.price;
                        dropdown.style.display = 'none';
                        updateTotalFields();
                    };
                    dropdown.appendChild(item);
                });
                dropdown.style.display = 'block';
            } else {
                dropdown.style.display = 'none';
            }
        } else {
            dropdown.style.display = 'none';
        }
    }

    function handleCustomerSearch(input) {
        const query = input.value.toLowerCase().trim();
        const dropdown = document.getElementById('customerDropdown');

        dropdown.innerHTML = '';

        if (query) {
            const matches = clientsList.filter(client => client.name.toLowerCase().includes(query));
            if (matches.length > 0) {
                matches.forEach(client => {
                    const item = document.createElement('div');
                    item.classList.add('dropdown-item');
                    item.textContent = client.name;
                    item.onclick = () => {
                        input.value = client.name;
                        document.getElementById('customerAddress').value = client.address || '';
                        document.getElementById('customerSiren').value = client.siren || '';
                        document.getElementById('customerTva').value = client.tvaIntra || '';
                        dropdown.style.display = 'none';
                    };
                    dropdown.appendChild(item);
                });
                dropdown.style.display = 'block';
            } else {
                dropdown.style.display = 'none';
            }
        } else {
            dropdown.style.display = 'none';
        }
    }

    function showDescriptionOverlayForRow(row) {
        currentDescRow = row;
        const overlay = document.getElementById('descriptionOverlay');
        const overlayDescription = document.getElementById('overlayDescription');
        const descInput = row.querySelector('.description-input');
        const productTitle = descInput.value.trim();

        // Find or create product
        let product = productsList.find(p => p.title.toLowerCase() === productTitle.toLowerCase());
        if (!productTitle) {
            // If no title, just empty product
            product = {title: productTitle, price:0, description:''};
        } else if (!product) {
            // create new product if not found
            product = {title: productTitle, price:0, description:''};
            productsList.push(product);
            localStorage.setItem('products', JSON.stringify(productsList));
        }

        overlayDescription.value = product.description || '';
        overlay.style.display = 'flex';
        overlay.dataset.productTitle = productTitle; // store title for when we close
    }

    function createLine(description = '', price = '') {
        const tbody = document.getElementById('invoiceTable');
        const newRow = tbody.insertRow(-1);

        const descCell = newRow.insertCell();
        const descInput = document.createElement('textarea');
        descInput.className = 'description-input';
        descInput.placeholder = 'Description';
        descInput.value = description;

        // Double-click to edit detailed description
        descInput.addEventListener('dblclick', () => {
            showDescriptionOverlayForRow(newRow);
        });

        descCell.appendChild(descInput);

        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown';
        descCell.appendChild(dropdown);
        descInput.addEventListener('input', handleDescriptionSearch);

        const priceCell = newRow.insertCell();
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.className = 'price-input';
        priceInput.placeholder = '0.00';
        priceInput.step = '0.01';
        priceInput.value = price;
        priceCell.appendChild(priceInput);

        const actionsCell = newRow.insertCell();
        const addLineButton = document.createElement('button');
        addLineButton.textContent = '+';
        addLineButton.title = 'Add line below';
        addLineButton.onclick = function() {
            addLineBelow(newRow);
        };
        actionsCell.appendChild(addLineButton);

        const removeLineButton = document.createElement('button');
        removeLineButton.textContent = '-';
        removeLineButton.title = 'Remove line';
        removeLineButton.onclick = function() {
            removeLine(newRow);
        };
        actionsCell.appendChild(removeLineButton);

        priceInput.addEventListener('input', updateTotalFields);
        return newRow;
    }

    function addLine() {
        createLine();
    }

    function addLineBelow(currentRow) {
        const tbody = document.getElementById('invoiceTable');
        const rowIndex = currentRow.sectionRowIndex;
        const newRow = tbody.insertRow(rowIndex + 1);

        const descCell = newRow.insertCell();
        const descInput = document.createElement('textarea');
        descInput.className = 'description-input';
        descInput.placeholder = 'Description';
        descCell.appendChild(descInput);

        descInput.addEventListener('dblclick', () => {
            showDescriptionOverlayForRow(newRow);
        });

        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown';
        descCell.appendChild(dropdown);
        descInput.addEventListener('input', handleDescriptionSearch);

        const priceCell = newRow.insertCell();
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.className = 'price-input';
        priceInput.placeholder = '0.00';
        priceInput.step = '0.01';
        priceCell.appendChild(priceInput);

        const actionsCell = newRow.insertCell();
        const addLineButton = document.createElement('button');
        addLineButton.textContent = '+';
        addLineButton.title = 'Add line below';
        addLineButton.onclick = function() {
            addLineBelow(newRow);
        };
        actionsCell.appendChild(addLineButton);

        const removeLineButton = document.createElement('button');
        removeLineButton.textContent = '-';
        removeLineButton.title = 'Remove line';
        removeLineButton.onclick = function() {
            removeLine(newRow);
        };
        actionsCell.appendChild(removeLineButton);

        priceInput.addEventListener('input', updateTotalFields);
        descInput.focus();
        updateTotalFields();
    }

    function removeLine(row) {
        const tbody = document.getElementById('invoiceTable');
        if (tbody.rows.length === 1) {
            const descInput = row.querySelector('.description-input');
            const priceInput = row.querySelector('.price-input');
            if (descInput) descInput.value = '';
            if (priceInput) priceInput.value = '';
        } else {
            tbody.deleteRow(row.sectionRowIndex);
        }
        updateTotalFields();
    }

function calculateTotals() {
    try {
        const tbody = document.getElementById('invoiceTable');
        if (!tbody) throw new Error('Invoice table not found');

        const rows = tbody.querySelectorAll('tr');
        let subtotal = 0;

        rows.forEach(row => {
            const priceInput = row.querySelector('.price-input');
            if (!priceInput) return;
            const price = parseFloat(priceInput.value) || 0;
            subtotal += price;
        });

        let tva = parsePercentageOrNumber(document.getElementById('tva')?.value || '0');
        let remiseVal = document.getElementById('remise')?.value || '0';
        let acompte = parseFloat(document.getElementById('acompte')?.value) || 0;

        if (tva < 0) throw new Error('Invalid TVA percentage');
        if (acompte < 0) throw new Error('Invalid acompte amount');

        const remise = parsePercentageOrNumber(remiseVal);
        if (remise < 0 || remise > 100) throw new Error('Invalid discount percentage');

        const tvaAmount = subtotal * (tva / 100);
        const remiseAmount = subtotal * (remise / 100);

        // Total before subtracting the acompte
        const totalBeforeAcompte = subtotal + tvaAmount - remiseAmount;
        // Final total after subtracting acompte
        const total = totalBeforeAcompte - acompte;

        return {
            subtotal,
            tvaAmount,
            remiseAmount,
            acompte,
            totalBeforeAcompte,
            total
        };
    } catch (error) {
        console.error('Error calculating totals:', error);
        alert(error.message);
        return {
            subtotal: 0,
            tvaAmount: 0,
            remiseAmount: 0,
            acompte: 0,
            totalBeforeAcompte: 0,
            total: 0
        };
    }
}

function updateTotalFields() {
    const totals = calculateTotals();
    if (!totals) return;

    const toggleSwitch = document.getElementById('toggleSwitch');

    // If it's a Facture (checked)
    if (toggleSwitch && toggleSwitch.checked) {
        const resteDuField = document.getElementById('resteDu');
        if (resteDuField) {
            // Reste du = TotalBeforeAcompte - Acompte
            resteDuField.value = (totals.totalBeforeAcompte - totals.acompte).toFixed(2);
        }
    }
}

    function initializeInvoice() {
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('date');
        if (dateInput) dateInput.value = today;

        let invoiceNumber = parseInt(localStorage.getItem('invoiceNumber')) || 1;
        if (invoiceNumber < 1) invoiceNumber = 1;

        const formattedNumber = today.split('-').slice(0, 2).join('-') + `-92${invoiceNumber}`;
        const invoiceNumberInput = document.getElementById('invoiceNumber');
        if (invoiceNumberInput) invoiceNumberInput.value = formattedNumber;

        if (!/^\d{4}-\d{2}-92\d+$/.test(formattedNumber)) {
            console.error('Invalid invoice number format');
            localStorage.setItem('invoiceNumber', 1);
            initializeInvoice();
            return;
        }

        const validityPeriod = parseInt(localStorage.getItem('validityPeriodDays')) || 30;
        const validityDate = new Date(new Date().setDate(new Date().getDate() + validityPeriod));
        const validityDateInput = document.getElementById('validityDate');
        if (validityDateInput) validityDateInput.value = validityDate.toISOString().split('T')[0];
    }

    function getInvoiceDataFromForm() {
        const toggleSwitch = document.getElementById('toggleSwitch');
        const isFacture = toggleSwitch.checked;
        const invoiceType = isFacture ? 'Facture' : 'Devis';

        const title = document.getElementById('title').value.trim();
        const invoiceNumber = document.getElementById('invoiceNumber').value.trim();
        const date = document.getElementById('date').value.trim();
        const validityDate = document.getElementById('validityDate').value.trim();
        const customerName = document.getElementById('customerName').value.trim();
        const customerAddress = document.getElementById('customerAddress').value.trim();
        const customerSiren = document.getElementById('customerSiren').value.trim();
        const customerTva = document.getElementById('customerTva').value.trim();
        const tva = parseFloat(document.getElementById('tva').value) || 0;
        const remiseVal = document.getElementById('remise').value || '0';
        const remise = parsePercentageOrNumber(remiseVal);
        const acompte = parseFloat(document.getElementById('acompte')?.value) || 0;

        const tbody = document.getElementById('invoiceTable');
        const rows = tbody.querySelectorAll('tr');
        const lines = [];

        rows.forEach(row => {
            const descInput = row.querySelector('.description-input');
            const priceInput = row.querySelector('.price-input');
            const description = descInput.value.trim();
            const price = parseFloat(priceInput.value) || 0;
            // Save detailedDescription if we have it
            const detailedDescription = row._detailedDescription || '';
            lines.push({ description, price, quantity: 1, detailedDescription });
        });

        const totals = calculateTotals();

        return {
            invoiceType,
            title,
            invoiceNumber,
            date,
            validityDate,
            customerName,
            customerAddress,
            customerSiren,
            customerTva,
            tva,
            remise,
            acompte,
            lines,
            totals
        };
    }

    function saveInvoice(invoiceData) {
        const invoiceCache = getInvoiceCache();
        const key = `${invoiceData.invoiceType}:${invoiceData.title}`;

        if (!invoiceData.title) {
            alert("Le titre est requis pour sauvegarder dans le cache.");
            return;
        }

        if (!invoiceCache[key]) {
            invoiceCache[key] = [];
        }
        const now = new Date().toISOString();
        invoiceCache[key].push({ date: now, data: invoiceData });
        setInvoiceCache(invoiceCache);

        let currentNumber = parseInt(localStorage.getItem('invoiceNumber')) || 1;
        currentNumber++;
        localStorage.setItem('invoiceNumber', currentNumber);

        console.log("Invoice saved to cache:", key, invoiceCache[key]);
    }

    function printInvoice() {
        const invoiceData = getInvoiceDataFromForm();
        saveInvoice(invoiceData);

        // Refresh the cache immediately
        displayCache();

        openHTMLInvoiceInNewTab(invoiceData, () => {
            // Refresh cache again after print window closes if needed
            displayCache();
        });
    }

    function openHTMLInvoiceInNewTab(invoiceData, onCloseCallback) {
        const htmlContent = createPrintHTML(invoiceData, productsList);

        const newWindow = window.open('', '_blank', 'width=800,height=600');
        if (newWindow) {
            newWindow.document.write(htmlContent);
            newWindow.document.close();
            newWindow.focus();
            newWindow.onbeforeunload = function() {
                if (typeof onCloseCallback === 'function') {
                    onCloseCallback();
                }
            };
        } else {
            console.error('Failed to open new window. Pop-up might be blocked.');
        }
    }

    window.clearAllCache = function() {
        if (confirm('Êtes-vous sûr de vouloir supprimer tout le cache?')) {
            localStorage.removeItem('invoiceCache');
            displayCache();
            alert("All cached invoices have been cleared!");
        }
    };

    function closeOverlay() {
        // Update current row's detailed description and product description
        if (currentDescRow) {
            const overlayDescription = document.getElementById('overlayDescription');
            const descInput = currentDescRow.querySelector('.description-input');
            const productTitle = descInput.value.trim();
            const detailedDesc = overlayDescription.value.trim();
            currentDescRow._detailedDescription = detailedDesc;

            // Update product description in productsList
            if (productTitle) {
                let product = productsList.find(p => p.title.toLowerCase() === productTitle.toLowerCase());
                if (!product) {
                    // If product not found, create it
                    product = {title: productTitle, price:0, description:detailedDesc};
                    productsList.push(product);
                } else {
                    product.description = detailedDesc;
                }
                localStorage.setItem('products', JSON.stringify(productsList));
            }
        }

        document.getElementById('descriptionOverlay').style.display = 'none';
        currentDescRow = null;
    }

    window.openCacheManagementWindow = function() {
        const cacheWindow = window.open('', 'CacheManagement', 'width=800,height=600');

        if (!cacheWindow) {
            alert('Les pop-ups sont bloquées. Veuillez autoriser les pop-ups pour utiliser cette fonctionnalité.');
            return;
        }

        cacheWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <title>Gestion Clients/Produits</title>
                <link rel="stylesheet" href="style.css">
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { margin-top: 0; }
                    h2 { margin-top: 30px; }
                    label { display: block; margin-top: 10px; }
                    input, textarea { width: calc(100% - 10px); padding: 8px; margin-top: 5px; }
                    button { margin-top: 10px; padding: 8px 16px; cursor: pointer; }
                    .list { margin-top: 10px; max-height: 200px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; }
                    .item { padding: 5px; border-bottom: 1px solid #eee; display: flex; align-items: center; cursor: pointer; }
                    .item.selected { background-color: #e0e0e0; }
                    .item:last-child { border-bottom: none; }
                </style>
            </head>
            <body>
                <h1>Gestion Clients/Produits</h1>
                <h2>Clients</h2>
                <label for="newClientName">Nom du Client</label>
                <input type="text" id="newClientName">
                <label for="newClientAddress">Adresse du Client</label>
                <input type="text" id="newClientAddress">
                <label for="newClientSiren">Siren du Client</label>
                <input type="text" id="newClientSiren">
                <label for="newClientTvaIntra">N° TVA intra.</label>
                <input type="text" id="newClientTvaIntra">
                <button onclick="saveClient()">Enregistrer le Client</button>
                <div id="clientList" class="list"></div>
                <button onclick="deleteSelectedClient()">Supprimer le Client sélectionné</button>

                <h2>Produits</h2>
                <label for="newProductTitle">Titre du Produit</label>
                <input type="text" id="newProductTitle">
                <label for="newProductPrice">Prix du Produit</label>
                <input type="number" id="newProductPrice" min="0" step="0.01">
                <label for="newProductDescription">Description du Produit</label>
                <textarea id="newProductDescription"></textarea>
                <button onclick="saveProduct()">Enregistrer le Produit</button>
                <div id="productList" class="list"></div>
                <button onclick="deleteSelectedProduct()">Supprimer le Produit sélectionné</button>

                <h2>Factures/Devis Enregistrés</h2>
                <div id="invoiceCacheList" class="list"></div>
                <button onclick="clearInvoiceCache()">Supprimer Toutes les Factures/Devis</button>

                <script src="cache.js"></script>
                <script>
                    window.onbeforeunload = function() {
                        if (window.opener && !window.opener.closed && typeof window.opener.refreshAfterCacheManagement === 'function') {
                            window.opener.refreshAfterCacheManagement();
                        }
                    };
                </script>
            </body>
            </html>
        `);
        cacheWindow.document.close();
    };

    // Refresh after cache management
    window.refreshAfterCacheManagement = function() {
        // Re-fetch products and clients from localStorage
        productsList = JSON.parse(localStorage.getItem('products')) || (typeof products !== 'undefined' ? products : []);
        clientsList = JSON.parse(localStorage.getItem('clients')) || (typeof clients !== 'undefined' ? clients : []);

        // Refresh the displayed invoice cache
        displayCache();
        alert("Données mises à jour après la gestion du cache.");
    };

    // Hide dropdown menus if click outside
    document.addEventListener('click', (event) => {
        const dropdowns = document.querySelectorAll('.dropdown');
        dropdowns.forEach(dd => {
            if (!dd.contains(event.target) && !dd.previousElementSibling?.contains(event.target)) {
                dd.style.display = 'none';
            }
        });
    });

    document.addEventListener('DOMContentLoaded', () => {
        initializeInvoice();
        addLine();
        handleInvoiceTypeChange();

        const toggleSwitch = document.getElementById('toggleSwitch');
        if (toggleSwitch) {
            toggleSwitch.addEventListener('change', handleInvoiceTypeChange);
        }

        displayCache();

        const cacheSearchElement = document.getElementById('cacheSearch');
        if (cacheSearchElement) {
            cacheSearchElement.addEventListener('input', (e) => {
                displayCache(e.target.value);
            });
        }

        const printButton = document.getElementById('printButton');
        if (printButton) {
            printButton.addEventListener('click', printInvoice);
        }

        const clearCacheButton = document.getElementById('clearCacheButton');
        if (clearCacheButton) {
            clearCacheButton.addEventListener('click', clearAllCache);
        }

        const closeOverlayButton = document.getElementById('closeOverlayButton');
        if (closeOverlayButton) {
            closeOverlayButton.addEventListener('click', closeOverlay);
        }

        const customerNameInput = document.getElementById('customerName');
        if (customerNameInput) {
            customerNameInput.addEventListener('input', () => handleCustomerSearch(customerNameInput));
        }
    });

    window.handleInvoiceTypeChange = handleInvoiceTypeChange;
    window.displayCache = displayCache;
    window.printInvoice = printInvoice;
    window.closeOverlay = closeOverlay;
    // loadInvoice, deleteInvoice, etc. not used in final version with versioning but kept if needed.
    window.refreshAfterCacheManagement = window.refreshAfterCacheManagement;
})();
