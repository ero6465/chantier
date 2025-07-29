// cache.js

let productsList = JSON.parse(localStorage.getItem('products')) || [];
let clientsList = JSON.parse(localStorage.getItem('clients')) || [];

let selectedClientIndex = null;
let selectedProductIndex = null;

function getAllInvoices() {
    const invoiceCache = JSON.parse(localStorage.getItem('invoiceCache')) || {};
    let allInvoices = [];
    Object.keys(invoiceCache).forEach(key => {
        invoiceCache[key].forEach(version => {
            const { invoiceType, title } = version.data;
            const displayDate = new Date(version.date).toLocaleString();
            allInvoices.push({
                date: displayDate,
                invoiceType: invoiceType,
                title: title,
                rawDate: version.date
            });
        });
    });
    return allInvoices;
}

function displayInvoices() {
    const invoiceCacheList = document.getElementById('invoiceCacheList');
    invoiceCacheList.innerHTML = '';
    const allInvoices = getAllInvoices();
    if (allInvoices.length === 0) {
        invoiceCacheList.innerHTML = '<p>Aucune facture/devis enregistrée.</p>';
        return;
    }

    allInvoices.forEach((inv) => {
        const div = document.createElement('div');
        div.classList.add('item');
        div.textContent = `${inv.invoiceType} - ${inv.title} (${inv.date})`;
        invoiceCacheList.appendChild(div);
    });
}

function clearInvoiceCache() {
    if (confirm('Êtes-vous sûr de vouloir supprimer toutes les factures/devis?')) {
        localStorage.removeItem('invoiceCache');
        displayInvoices();
        alert('Toutes les factures/devis ont été supprimées.');
    }
}

// Display clients
function displayClients() {
    const clientList = document.getElementById('clientList');
    clientList.innerHTML = '';
    if (clientsList.length === 0) {
        clientList.innerHTML = '<p>Aucun client enregistré.</p>';
        return;
    }
    clientsList.forEach((client, index) => {
        const div = document.createElement('div');
        div.classList.add('item');
        div.textContent = client.name + ' - ' + client.address;

        if (selectedClientIndex === index) {
            div.classList.add('selected');
        }

        div.onclick = () => {
            selectedClientIndex = index;
            // Autofill client fields
            document.getElementById('newClientName').value = client.name;
            document.getElementById('newClientAddress').value = client.address;
            document.getElementById('newClientSiren').value = client.siren;
            document.getElementById('newClientTvaIntra').value = client.tvaIntra;

            displayClients(); // Refresh to update selection highlight
        };

        clientList.appendChild(div);
    });
}

// Delete selected client
function deleteSelectedClient() {
    if (selectedClientIndex !== null) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce client?')) {
            clientsList.splice(selectedClientIndex, 1);
            localStorage.setItem('clients', JSON.stringify(clientsList));
            selectedClientIndex = null;
            // Clear client form fields
            document.getElementById('newClientName').value = '';
            document.getElementById('newClientAddress').value = '';
            document.getElementById('newClientSiren').value = '';
            document.getElementById('newClientTvaIntra').value = '';
            displayClients();
            alert('Client supprimé avec succès.');
        }
    } else {
        alert('Veuillez sélectionner un client à supprimer.');
    }
}

// Display products
function displayProducts() {
    const productList = document.getElementById('productList');
    productList.innerHTML = '';
    if (productsList.length === 0) {
        productList.innerHTML = '<p>Aucun produit enregistré.</p>';
        return;
    }
    productsList.forEach((product, index) => {
        const div = document.createElement('div');
        div.classList.add('item');
        div.textContent = product.title + ' - ' + product.price + '€';

        if (selectedProductIndex === index) {
            div.classList.add('selected');
        }

        div.onclick = () => {
            selectedProductIndex = index;
            // Autofill product fields
            document.getElementById('newProductTitle').value = product.title;
            document.getElementById('newProductPrice').value = product.price;
            document.getElementById('newProductDescription').value = product.description;
            displayProducts(); // Refresh to update selection highlight
        };

        productList.appendChild(div);
    });
}

// Delete selected product
function deleteSelectedProduct() {
    if (selectedProductIndex !== null) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce produit?')) {
            productsList.splice(selectedProductIndex, 1);
            localStorage.setItem('products', JSON.stringify(productsList));
            selectedProductIndex = null;
            // Clear product fields
            document.getElementById('newProductTitle').value = '';
            document.getElementById('newProductPrice').value = '';
            document.getElementById('newProductDescription').value = '';
            displayProducts();
            alert('Produit supprimé avec succès.');
        }
    } else {
        alert('Veuillez sélectionner un produit à supprimer.');
    }
}

// Save a new or existing client
function saveClient() {
    const clientName = document.getElementById('newClientName').value.trim();
    const clientAddress = document.getElementById('newClientAddress').value.trim();
    const clientSiren = document.getElementById('newClientSiren').value.trim();
    const clientTvaIntra = document.getElementById('newClientTvaIntra').value.trim();

    if (!clientName) {
        alert('Le nom du client est requis.');
        return;
    }

    // If selectedClientIndex is not null, we are editing existing client
    if (selectedClientIndex !== null) {
        // Update existing client
        clientsList[selectedClientIndex].name = clientName;
        clientsList[selectedClientIndex].address = clientAddress;
        clientsList[selectedClientIndex].siren = clientSiren;
        clientsList[selectedClientIndex].tvaIntra = clientTvaIntra;
        localStorage.setItem('clients', JSON.stringify(clientsList));
        alert('Client mis à jour avec succès.');

        // Clear selection and fields
        selectedClientIndex = null;
        document.getElementById('newClientName').value = '';
        document.getElementById('newClientAddress').value = '';
        document.getElementById('newClientSiren').value = '';
        document.getElementById('newClientTvaIntra').value = '';
        displayClients();
    } else {
        // Creating a new client - check for duplicate
        const duplicate = clientsList.some(c => c.name.toLowerCase() === clientName.toLowerCase());
        if (duplicate) {
            alert('Un client avec ce nom existe déjà.');
            return;
        }

        const newClient = {
            name: clientName,
            address: clientAddress,
            siren: clientSiren,
            tvaIntra: clientTvaIntra
        };

        clientsList.push(newClient);
        localStorage.setItem('clients', JSON.stringify(clientsList));
        alert('Client enregistré avec succès.');

        // Clear input fields
        document.getElementById('newClientName').value = '';
        document.getElementById('newClientAddress').value = '';
        document.getElementById('newClientSiren').value = '';
        document.getElementById('newClientTvaIntra').value = '';

        selectedClientIndex = null; // Reset selection
        displayClients();
    }
}

// Save a new or existing product
function saveProduct() {
    const productTitle = document.getElementById('newProductTitle').value.trim();
    const productPrice = parseFloat(document.getElementById('newProductPrice').value);
    const productDescription = document.getElementById('newProductDescription').value.trim();

    if (!productTitle) {
        alert('Le titre du produit est requis.');
        return;
    }

    if (isNaN(productPrice) || productPrice < 0) {
        alert('Le prix du produit doit être un nombre positif.');
        return;
    }

    if (selectedProductIndex !== null) {
        // Editing existing product
        productsList[selectedProductIndex].title = productTitle;
        productsList[selectedProductIndex].price = productPrice;
        productsList[selectedProductIndex].description = productDescription;
        localStorage.setItem('products', JSON.stringify(productsList));
        alert('Produit mis à jour avec succès.');

        selectedProductIndex = null;
        document.getElementById('newProductTitle').value = '';
        document.getElementById('newProductPrice').value = '';
        document.getElementById('newProductDescription').value = '';
        displayProducts();
    } else {
        // Creating new product - check for duplicate
        const duplicate = productsList.some(p => p.title.toLowerCase() === productTitle.toLowerCase());
        if (duplicate) {
            alert('Un produit avec ce titre existe déjà.');
            return;
        }

        const newProduct = {
            title: productTitle,
            price: productPrice,
            description: productDescription
        };

        productsList.push(newProduct);
        localStorage.setItem('products', JSON.stringify(productsList));
        alert('Produit enregistré avec succès.');

        // Clear input fields
        document.getElementById('newProductTitle').value = '';
        document.getElementById('newProductPrice').value = '';
        document.getElementById('newProductDescription').value = '';

        selectedProductIndex = null;
        displayProducts();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    displayInvoices();
    displayClients();
    displayProducts();
});

// When window closes, notify the opener to refresh
window.onbeforeunload = function() {
    if (window.opener && !window.opener.closed) {
        window.opener.refreshAfterCacheManagement();
    }
};
