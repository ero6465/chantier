// Handle PDF uploads and processing
function handlePdfUpload(e) {
    const files = e.target.files;
    const pdfPreview = document.getElementById('pdf-preview');
    
    if (!window.uploadedPdfs) {
        window.uploadedPdfs = [];
    }
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const pdfData = {
                name: file.name,
                content: event.target.result
            };
            
            window.uploadedPdfs.push(pdfData);
            
            const pdfContainer = document.createElement('div');
            pdfContainer.className = 'pdf-container';
            
            const pdfIcon = document.createElement('div');
            pdfIcon.className = 'pdf-icon';
            pdfIcon.innerHTML = '<i class="fas fa-file-pdf"></i>';
            
            const pdfName = document.createElement('div');
            pdfName.className = 'pdf-name';
            pdfName.textContent = file.name;
            
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-pdf';
            removeBtn.innerHTML = '&times;';
            removeBtn.addEventListener('click', () => {
                window.uploadedPdfs = window.uploadedPdfs.filter(pdf => pdf !== pdfData);
                pdfContainer.remove();
            });
            
            const viewBtn = document.createElement('button');
            viewBtn.type = 'button';
            viewBtn.className = 'view-pdf';
            viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
            viewBtn.addEventListener('click', () => {
                const blob = dataURItoBlob(pdfData.content);
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            });
            
            pdfContainer.appendChild(pdfIcon);
            pdfContainer.appendChild(pdfName);
            pdfContainer.appendChild(viewBtn);
            pdfContainer.appendChild(removeBtn);
            pdfPreview.appendChild(pdfContainer);
        };
        
        reader.readAsDataURL(file);
    }
}

// Convert data URI to Blob
function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ab], { type: mimeString });
}

// Create a PDF from form data (placeholder function)
function createPdfFacture() {
    alert('PDF facture creation will be implemented in the future.');
}

export { handlePdfUpload, createPdfFacture };