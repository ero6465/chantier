// image-handler.js
let canvas = null;
let context = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let drawingColor = '#FF0000'; // Default red
let drawingSize = 5; // Default size
let currentImage = null;
let imageCommentMap = new Map(); // Store comments for images
let currentEditingImageData = null;

function initDrawingTools() {
    canvas = document.getElementById('drawing-canvas');
    context = canvas.getContext('2d');
    
    // Setup canvas event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Setup drawing control buttons
    document.getElementById('drawing-color-btn').addEventListener('click', openColorPicker);
    document.getElementById('drawing-size-btn').addEventListener('click', changeBrushSize);
    document.getElementById('drawing-clear-btn').addEventListener('click', clearCanvas);
    document.getElementById('drawing-save-btn').addEventListener('click', saveDrawing);
    document.getElementById('drawing-cancel-btn').addEventListener('click', cancelDrawing);
    
    // Initialize image preview modal
    initImagePreviewModal();
}

function initImagePreviewModal() {
    // Create the image preview modal if it doesn't exist
    if (!document.getElementById('image-preview-modal')) {
        const modal = document.createElement('div');
        modal.id = 'image-preview-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" id="close-image-preview">&times;</span>
                <img id="preview-image-full" alt="Preview image">
                <div id="preview-image-comment"></div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add event listener to close button
        document.getElementById('close-image-preview').addEventListener('click', () => {
            document.getElementById('image-preview-modal').style.display = 'none';
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

function showImagePreview(imageData, comment) {
    const modal = document.getElementById('image-preview-modal');
    const previewImage = document.getElementById('preview-image-full');
    const previewComment = document.getElementById('preview-image-comment');
    
    previewImage.src = imageData;
    previewComment.textContent = comment || '';
    modal.style.display = 'block';
}

function startDrawing(e) {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
}

function draw(e) {
    if (!isDrawing) return;
    
    context.strokeStyle = drawingColor;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.lineWidth = drawingSize;
    
    context.beginPath();
    context.moveTo(lastX, lastY);
    context.lineTo(e.offsetX, e.offsetY);
    context.stroke();
    
    [lastX, lastY] = [e.offsetX, e.offsetY];
}

function stopDrawing() {
    isDrawing = false;
}

function openColorPicker() {
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#000000', '#FFFFFF'];
    
    let colorPicker = document.querySelector('.color-picker');
    if (colorPicker) {
        colorPicker.remove();
        return;
    }
    
    colorPicker = document.createElement('div');
    colorPicker.className = 'color-picker';
    
    colors.forEach(color => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        colorOption.style.backgroundColor = color;
        colorOption.addEventListener('click', () => {
            drawingColor = color;
            colorPicker.remove();
        });
        colorPicker.appendChild(colorOption);
    });
    
    const drawingControls = document.querySelector('.drawing-controls');
    drawingControls.appendChild(colorPicker);
}

function changeBrushSize() {
    const sizes = [2, 5, 10, 15, 20];
    const currentIndex = sizes.indexOf(drawingSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    drawingSize = sizes[nextIndex];
    
    // Visual feedback of size change
    document.getElementById('drawing-size-btn').textContent = `Size: ${drawingSize}px`;
}

function clearCanvas() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (currentImage) {
        const img = new Image();
        img.onload = function() {
            resizeCanvasToImage(img);
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = currentImage;
    }
}

function saveDrawing() {
    const imageData = canvas.toDataURL('image/png');
    const imageComment = document.getElementById('image-comment').value;
    
    if (currentEditingImageData) {
        // Update existing image
        const index = window.uploadedImages.findIndex(img => 
            typeof img === 'object' ? img.data === currentEditingImageData : img === currentEditingImageData);
        
        if (index !== -1) {
            window.uploadedImages[index] = {
                data: imageData,
                comment: imageComment
            };
        }
        
        // Update DOM
        const imageContainers = document.querySelectorAll('.image-container');
        for (const container of imageContainers) {
            const img = container.querySelector('img');
            if (img && img.src === currentEditingImageData) {
                img.src = imageData;
                
                let commentDiv = container.querySelector('.image-comment');
                if (!commentDiv && imageComment) {
                    commentDiv = document.createElement('div');
                    commentDiv.className = 'image-comment';
                    container.appendChild(commentDiv);
                }
                
                if (commentDiv) {
                    if (imageComment) {
                        commentDiv.textContent = imageComment;
                        commentDiv.style.display = 'block';
                    } else {
                        commentDiv.style.display = 'none';
                    }
                }
                
                break;
            }
        }
    } else {
        // Add new image with drawing
        addImageToPreview({
            data: imageData,
            comment: imageComment
        });
        
        // Add to uploaded images
        window.uploadedImages.push({
            data: imageData,
            comment: imageComment
        });
    }
    
    // Reset editing state
    window.isEditingImage = false;
    
    // Hide drawing tools
    hideDrawingTools();
}

function cancelDrawing() {
    // Reset editing state
    window.isEditingImage = false;
    hideDrawingTools();
}

function hideDrawingTools() {
    document.getElementById('drawing-canvas').style.display = 'none';
    document.querySelector('.drawing-controls').style.display = 'none';
    document.getElementById('image-comment-container').style.display = 'none';
    currentImage = null;
    currentEditingImageData = null;
}

function showDrawingTools(imageData = null, comment = '') {
    window.isEditingImage = true;
    const canvas = document.getElementById('drawing-canvas');
    canvas.style.display = 'block';
    document.querySelector('.drawing-controls').style.display = 'flex';
    document.getElementById('image-comment-container').style.display = 'block';
    document.getElementById('image-comment').value = comment || '';
    
    if (imageData) {
        currentEditingImageData = imageData;
        currentImage = imageData;
        const img = new Image();
        img.onload = function() {
            resizeCanvasToImage(img);
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = imageData;
    } else {
        // New blank canvas
        canvas.width = 500;
        canvas.height = 300;
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function resizeCanvasToImage(img) {
    const maxWidth = 500;
    const maxHeight = 300;
    
    let width = img.width;
    let height = img.height;
    
    if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
    }
    
    if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
    }
    
    canvas.width = width;
    canvas.height = height;
}

function addImageToPreview(imageData) {
    const imagePreview = document.getElementById('image-preview');
    
    const imgContainer = document.createElement('div');
    imgContainer.className = 'image-container';
    
    const img = document.createElement('img');
    img.src = typeof imageData === 'object' ? imageData.data : imageData;
    
    // Make image clickable for preview
    img.addEventListener('click', () => {
        const imgSrc = typeof imageData === 'object' ? imageData.data : imageData;
        const comment = typeof imageData === 'object' ? imageData.comment : '';
        showImagePreview(imgSrc, comment);
    });
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-image';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.uploadedImages = window.uploadedImages.filter(img => {
            const imgSrc = typeof img === 'object' ? img.data : img;
            const currentSrc = typeof imageData === 'object' ? imageData.data : imageData;
            return imgSrc !== currentSrc;
        });
        imgContainer.remove();
    });
    
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'edit-image';
    editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const imgSrc = typeof imageData === 'object' ? imageData.data : imageData;
        const comment = typeof imageData === 'object' ? imageData.comment : '';
        showDrawingTools(imgSrc, comment);
    });
    
    imgContainer.appendChild(img);
    imgContainer.appendChild(removeBtn);
    imgContainer.appendChild(editBtn);
    
    // Add comment if available
    if (typeof imageData === 'object' && imageData.comment) {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'image-comment';
        commentDiv.textContent = imageData.comment;
        imgContainer.appendChild(commentDiv);
    }
    
    imagePreview.appendChild(imgContainer);
}

// Replace the original handleImageUpload with this version
function handleImageUpload(e) {
    const files = e.target.files;
    
    if (!window.uploadedImages) {
        window.uploadedImages = [];
    }
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const imageData = event.target.result;
            window.uploadedImages.push({
                data: imageData,
                comment: ''
            });
            
            addImageToPreview({
                data: imageData,
                comment: ''
            });
        };
        
        reader.readAsDataURL(file);
    }
}

// Create a blank drawing canvas
function createNewDrawing() {
    showDrawingTools();  
}

function getImageThumbnail(imageData) {
    if (!imageData || !imageData.length) return null;
    
    // Handle both string and object image formats
    const imageSrc = typeof imageData[0] === 'object' ? imageData[0].data : imageData[0];
    return imageSrc;
}

export { initDrawingTools, handleImageUpload, addImageToPreview, createNewDrawing, showImagePreview, getImageThumbnail };