// print.js

window.createPrintHTML = function (invoiceData, productsList) {
    const {
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
        totals,
    } = invoiceData;

    const remiseValue = totals.remiseAmount;
    const totalHT = totals.subtotal;
    const totalTTC = totals.total; // This is after acompte
    const resteDu = invoiceType === 'Facture' ? (totals.totalBeforeAcompte - acompte) : 0;

    const invoiceFileName = `${invoiceType}_${title}_${invoiceNumber}`;

    return `
<html>
<head>
    <title>${invoiceFileName}</title>
    <style>
        @page {
            size: A4;
            margin: 20mm 15mm 0mm 15mm; /* top, right, bottom, left */
        }
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            margin: 0;
            padding: 0;
            position: relative;
            height: 100%;
            box-sizing: border-box;
        }
        .content {
            padding: 0;
            box-sizing: border-box;
            /* Remove fixed height to allow content to flow naturally */
            /* Reserve space for the footer using margin-bottom */
            margin-bottom: 30mm;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .logo img {
            max-width: 100px;
        }
        .company-info {
            text-align: right;
        }
        .bold {
            font-weight: bold;
        }
        .invoice-title {
            text-align: center;
            font-size: 24px;
            margin: 20px 0;
        }
        .client-info {
            margin-top: 20px;
        }
        .separator {
            border-bottom: 1px solid #ddd;
            margin: 20px 0;
        }
        table {
            width: 95%; /* Add horizontal margins */
            border-collapse: collapse;
            margin: 20px auto; /* Center the table with vertical margins */
            page-break-inside: auto;
        }
        thead {
            display: table-header-group; /* Ensure headers repeat on each page */
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            vertical-align: top;
        }
        th {
            background-color: #f2f2f2;
            text-align: left;
        }
        td {
            /* Allow table rows to break across pages */
            page-break-inside: auto;
        }
        .right {
            text-align: right;
        }
        .totals {
            margin-top: 20px;
            text-align: right;
        }
        .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 100mm; /* Match the @page bottom margin */
            padding-top: 10px;
            box-sizing: border-box;
        }
	.footer2 {
            font-size: 10px;
            text-align: center;
            color: #555;
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 30mm; /* Match the @page bottom margin */
            padding-top: 10px;
            box-sizing: border-box;
        }
        .description {
            font-size: 0.8em;
            color: #555;
        }
        @media print {
            body {
                margin: 0;
                padding: 0;
            }
            .footer {
                position: fixed;
                bottom: 0;
            }
            .content {
                /* Ensure content does not overlap with the footer */
                margin-bottom: 30mm;
            }
            table tbody tr {
                /* Allow rows to break across pages */
                page-break-inside: avoid;
            }
            thead { 
                display: table-header-group; /* Repeat headers on each page */
            }
            /* Prevent table from being split between content and footer */
            table {
                margin-bottom: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="content">
        <div class="header">
            <div class="logo"><img src="${config.logoUrl}" alt="Company Logo"></div>
            <div class="company-info">
                <div class="bold">${config.companyName}</div>
                <div>${config.companyAddress}</div>
                <div>Téléphone: ${config.companyPhone}</div>
                <div>Email: ${config.companyEmail}</div>
            </div>
        </div>
        <div class="invoice-title">${title || (invoiceType === 'Facture' ? 'Facture' : 'Devis')}</div>
        <div class="invoice-title">${invoiceType} N°${invoiceNumber}</div>
        <div class="client-info">
            <strong>Destinataire:</strong><br>
            ${customerName}<br>
            ${customerAddress}<br>
            ${customerSiren ? 'SIREN: ' + customerSiren + '<br>' : ''}
            ${customerTva ? 'TVA: ' + customerTva + '<br>' : ''}
        </div>
        <p><strong>Date d'émission:</strong> ${date}</p>
        <p><strong>Date d'échéance:</strong> ${validityDate}</p>
        <div class="separator"></div>
        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Qté</th>
                    <th>Prix Unitaire HT</th>
                    <th>Total HT</th>
                    <th>Total TTC</th>
                </tr>
            </thead>
            <tbody>
                ${lines
                    .map((item) => {
                        const quantity = item.quantity || 1;
                        const totalHTLine = item.price * quantity;
                        const totalTTCLine = totalHTLine * (1 + tva / 100);
                        const product = productsList.find(
                            (p) => p.title === item.description
                        );
                        return `
                    <tr>
                        <td>
                            ${item.description}
                            <div class="description">${product?.description || ''}</div>
                        </td>
                        <td class="right">${quantity}</td>
                        <td class="right">${item.price.toFixed(2)}€</td>
                        <td class="right">${totalHTLine.toFixed(2)}€</td>
                        <td class="right">${totalTTCLine.toFixed(2)}€</td>
                    </tr>`;
                    })
                    .join('')}
            </tbody>
        </table>
        <div class="separator"></div>
        <div class="totals">
            <p>Total HT: ${totalHT.toFixed(2)}€</p>
            <p>Remise: ${remiseValue.toFixed(2)}€</p>
            <p>TVA (${tva}%): ${(totalHT * tva / 100).toFixed(2)}€</p>
            <p><strong>Total TTC: ${totalTTC.toFixed(2)}€</strong></p>
            ${
                invoiceType === 'Facture'
                    ? `
                <p>Acompte reçu: ${acompte.toFixed(2)}€</p>
                <p><strong>Reste dû: ${resteDu.toFixed(2)}€</strong></p>`
                    : ''
            }
        </div>
    </div>
    <div class="footer">
        
    </div>
<div class="footer2">
        <div><strong>Information de paiement:</strong> <br>BIC: ${config.bic} <br>RIB: ${config.rib}</div>
        <div>SIRET: ${config.siret} | TVA Intracommunautaire: ${config.tvaIntra}</div>
        <div>${config.legalInfo}</div>
    </div>
    <script>
        window.onload = function () {
            window.print();
        };
    </script>
</body>
</html>`;
};
