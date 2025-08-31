// Global variables
let canvas, ctx;
let isDrawing = false;
let currentImage = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeCanvas();
    initializeUpload();
    initializeEventListeners();
});

// Initialize drawing canvas
function initializeCanvas() {
    canvas = document.getElementById('drawingCanvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas properties
    ctx.strokeStyle = '#ffffffff';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Clear canvas with white background
    clearCanvas();
    
    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', handleTouch);
    canvas.addEventListener('touchmove', handleTouch);
    canvas.addEventListener('touchend', stopDrawing);
    
    // Prevent scrolling when touching the canvas
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
    });
    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
    });
}

// Initialize file upload
function initializeUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const imageInput = document.getElementById('imageInput');
    const uploadedImage = document.getElementById('uploadedImage');
    const previewImage = document.getElementById('previewImage');
    const removeImage = document.getElementById('removeImage');
    
    // Click to upload
    uploadArea.addEventListener('click', () => {
        imageInput.click();
    });
    
    // File input change
    imageInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // Remove image
    removeImage.addEventListener('click', removeUploadedImage);
}

// Initialize other event listeners
function initializeEventListeners() {
    document.getElementById('clearCanvas').addEventListener('click', clearCanvas);
    document.getElementById('predictBtn').addEventListener('click', predictCharacter);
}

// Drawing functions
function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
}

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
}

// Touch handling for mobile
function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 
                                     e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

// Clear canvas
function clearCanvas() {
    ctx.fillStyle = '#000000ff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffffff';
}

// File upload functions
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function processFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }
    
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentImage = e.target.result;
        showUploadedImage(e.target.result);
    };
    reader.readAsDataURL(file);
}

function showUploadedImage(src) {
    const uploadArea = document.getElementById('uploadArea');
    const uploadedImage = document.getElementById('uploadedImage');
    const previewImage = document.getElementById('previewImage');
    
    previewImage.src = src;
    uploadArea.style.display = 'none';
    uploadedImage.style.display = 'block';
}

function removeUploadedImage() {
    const uploadArea = document.getElementById('uploadArea');
    const uploadedImage = document.getElementById('uploadedImage');
    const imageInput = document.getElementById('imageInput');
    
    currentImage = null;
    imageInput.value = '';
    uploadArea.style.display = 'block';
    uploadedImage.style.display = 'none';
}

// Get selected model
function getSelectedModel() {
    const radios = document.querySelectorAll('input[name="model"]');
    for (const radio of radios) {
        if (radio.checked) {
            return radio.value;
        }
    }
    return 'cnn'; // default
}

// Get image data for prediction
function getImageData() {
    if (currentImage) {
        // Use uploaded image
        return {
            type: 'upload',
            data: currentImage
        };
    } else {
        // Use canvas drawing
        const canvasData = canvas.toDataURL('image/png');
        return {
            type: 'canvas',
            data: canvasData
        };
    }
}

// Predict character
async function predictCharacter() {
    const imageData = getImageData();
    const selectedModel = getSelectedModel();
    
    // Check if there's any input
    if (imageData.type === 'canvas') {
        // Check if canvas is empty (just white background)
        const imageDataArray = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageDataArray.data;
        let hasDrawing = false;
        
        for (let i = 0; i < pixels.length; i += 4) {
            // Check if pixel is not white
            if (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255) {
                hasDrawing = true;
                break;
            }
        }
        
        if (!hasDrawing) {
            alert('Please draw a character or upload an image.');
            return;
        }
    }
    
    // Show loading
    showLoading(true);
    hideResults();
    
    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: imageData.data,
                model: selectedModel
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showResults(result.prediction, result.confidence);
        } else {
            throw new Error(result.error || 'Prediction failed');
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error making prediction: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Show/hide loading
function showLoading(show) {
    const loading = document.getElementById('loading');
    loading.style.display = show ? 'block' : 'none';
}

// Show results
function showResults(prediction, confidence) {
    const results = document.getElementById('results');
    const predictedChar = document.getElementById('predictedChar');
    const confidenceValue = document.getElementById('confidenceValue');
    
    predictedChar.textContent = prediction;
    confidenceValue.textContent = confidence + '%';
    
    results.style.display = 'block';
}

// Hide results
function hideResults() {
    const results = document.getElementById('results');
    results.style.display = 'none';
}

