function renderGridView(filteredChantiers) {
    const chantierList = document.getElementById('chantier-list');
    
    filteredChantiers.forEach(chantier => {
        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item';
        gridItem.setAttribute('draggable', true);
        gridItem.setAttribute('data-id', chantier.id);
        
        const dateRange = `${moment(chantier.startDate).format('MMM D')} - ${moment(chantier.endDate).format('MMM D')}`;
        const urgencyClass = chantier.urgency ? `urgency-${chantier.urgency}` : '';
        
        // Create image element if chantier has images - improved handling
        let imageHtml = '';
        if (chantier.images && chantier.images.length > 0) {
            const imageSrc = getImageThumbnail(chantier.images);
            if (imageSrc) {
                imageHtml = `<img src="${imageSrc}" class="grid-item-image" alt="Chantier">`;
            }
        }
        
        // Add address if exists
        let addressHtml = '';
        if (chantier.address) {
            addressHtml = `
                <div class="grid-item-address">
                    <i class="fas fa-map-marker-alt"></i> ${chantier.address.substring(0, 20)}...
                    <button class="navigate-btn small" onclick="event.stopPropagation(); navigateToAddress('${chantier.address.replace(/'/g, "\\'")}')">
                        <i class="fas fa-location-arrow"></i>
                    </button>
                </div>
            `;
        }
        
        gridItem.innerHTML = `
            ${imageHtml}
            <div class="status-badge ${chantier.status} ${urgencyClass}">${chantier.status === 'ongoing' ? 'En cours' : 'Facture envoyé'}</div>
            <div class="grid-item-title">${chantier.title}</div>
            <div class="grid-item-dates">${dateRange}</div>
            <div class="grid-item-assignees">${chantier.assignees ? chantier.assignees.join(', ') : 'None'}</div>
            ${addressHtml}
        `;
        
        gridItem.addEventListener('click', () => {
            openEditChantierModal(chantier.id);
        });
        
        chantierList.appendChild(gridItem);
    });
}

// New helper function
function getImageThumbnail(images) {
    if (images && images.length > 0) {
        return images[0];
    }
    return null;
}