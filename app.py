import os
import io
import base64
import numpy as np
import cv2
from PIL import Image
from flask import Flask, render_template, request, jsonify
import tensorflow as tf
from tensorflow import keras

app = Flask(__name__)

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Global variables for models
models = {}
class_labels = [
    'অ', 'আ', 'ই', 'ঈ', 'উ', 'ঊ', 'ঋ', 'এ', 'ঐ', 'ও', 'ঔ',  # Vowels
    'ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', 'ট', 'ঠ', 'ড', 'ঢ', 'ণ',  # Consonants
    'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ', 'স', 'হ',
    'ড়', 'ঢ়', 'য়', 'ৎ', 'ং', 'ঃ', 'ঁ',  # Additional characters
    '০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'  # Digits
]

def load_models():
    """Load all three models at startup"""
    global models
    
    model_paths = {
        'cnn': 'models/cnn_model.keras',
        'resnet50': 'models/resnet50_model.keras',
        'densenet121': 'models/densenet121_model.keras'
    }
    
    for model_name, model_path in model_paths.items():
        if os.path.exists(model_path):
            try:
                models[model_name] = keras.models.load_model(model_path)
                print(f"✓ Loaded {model_name} model successfully")
            except Exception as e:
                print(f"✗ Error loading {model_name} model: {str(e)}")
                models[model_name] = None
        else:
            print(f"✗ Model file not found: {model_path}")
            models[model_name] = None

def preprocess_image_for_cnn(image):
    """Preprocess image for CNN model (32x32 grayscale)"""
    # Convert to grayscale if needed
    if len(image.shape) == 3:
        image = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    
    # Resize to 32x32
    image = cv2.resize(image, (32, 32))
    
    # Normalize pixel values to [0, 1]
    image = image.astype(np.float32) / 255.0
    
    # Reshape for model input (batch_size, height, width, channels)
    image = image.reshape(1, 32, 32, 1)
    
    return image

def preprocess_image_for_pretrained(image):
    """Preprocess image for ResNet50/DenseNet121 models"""
    # Convert to grayscale if needed
    if len(image.shape) == 3:
        image = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    
    # Resize to 32x32 (as per your training setup)
    image = cv2.resize(image, (32, 32))
    
    # Convert grayscale to 3-channel (RGB) for pre-trained models
    image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
    
    # Normalize pixel values to [0, 1]
    image = image.astype(np.float32) / 255.0
    
    # Reshape for model input (batch_size, height, width, channels)
    image = image.reshape(1, 32, 32, 3)
    
    return image

def decode_base64_image(base64_string):
    """Decode base64 image string to numpy array"""
    try:
        # Remove data URL prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        # Decode base64
        image_data = base64.b64decode(base64_string)
        
        # Convert to PIL Image
        image = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert to numpy array
        image_array = np.array(image)
        
        return image_array
    except Exception as e:
        raise ValueError(f"Error decoding image: {str(e)}")

def predict_character(image, model_name):
    """Make prediction using specified model"""
    if model_name not in models or models[model_name] is None:
        raise ValueError(f"Model {model_name} is not available")
    
    model = models[model_name]
    
    # Preprocess image based on model type
    if model_name == 'cnn':
        processed_image = preprocess_image_for_cnn(image)
    else:  # resnet50 or densenet121
        processed_image = preprocess_image_for_pretrained(image)
    
    # Make prediction
    predictions = model.predict(processed_image, verbose=0)
    
    # Get predicted class and confidence
    predicted_class_idx = np.argmax(predictions[0])
    confidence = float(predictions[0][predicted_class_idx]) * 100
    
    # Get character label
    if predicted_class_idx < len(class_labels):
        predicted_character = class_labels[predicted_class_idx]
    else:
        predicted_character = "Unknown"
    
    return predicted_character, round(confidence, 2)

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    """Handle prediction requests"""
    try:
        data = request.get_json()
        
        if not data or 'image' not in data or 'model' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing image or model parameter'
            }), 400
        
        image_data = data['image']
        model_name = data['model']
        
        # Validate model name
        if model_name not in ['cnn', 'resnet50', 'densenet121']:
            return jsonify({
                'success': False,
                'error': 'Invalid model name'
            }), 400
        
        # Check if model is loaded
        if model_name not in models or models[model_name] is None:
            return jsonify({
                'success': False,
                'error': f'Model {model_name} is not available. Please ensure the model file exists.'
            }), 500
        
        # Decode image
        image = decode_base64_image(image_data)
        
        # Make prediction
        predicted_character, confidence = predict_character(image, model_name)
        
        return jsonify({
            'success': True,
            'prediction': predicted_character,
            'confidence': confidence,
            'model_used': model_name
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        print(f"Prediction error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error during prediction'
        }), 500

@app.route('/health')
def health():
    """Health check endpoint"""
    model_status = {}
    for model_name in ['cnn', 'resnet50', 'densenet121']:
        model_status[model_name] = models.get(model_name) is not None
    
    return jsonify({
        'status': 'healthy',
        'models_loaded': model_status
    })

@app.errorhandler(413)
def too_large(e):
    return jsonify({
        'success': False,
        'error': 'File too large. Maximum size is 16MB.'
    }), 413

@app.errorhandler(404)
def not_found(e):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500

if __name__ == '__main__':
    print("Starting Bangla OCR Web Application...")
    print("Loading models...")
    
    # Load models at startup
    load_models()
    
    # Check if any models were loaded
    loaded_models = [name for name, model in models.items() if model is not None]
    if not loaded_models:
        print("⚠️  Warning: No models were loaded successfully!")
        print("   Please ensure your .keras model files are in the 'models/' directory:")
        print("   - models/cnn_model.keras")
        print("   - models/resnet50_model.keras") 
        print("   - models/densenet121_model.keras")
    else:
        print(f"✓ Successfully loaded models: {', '.join(loaded_models)}")
    
    print("\nStarting Flask server...")
    print("Access the application at: http://localhost:5000")
    
    # Run the app
    app.run(host='0.0.0.0', port=5000, debug=True)

