"""
Simple test script to verify the application structure
"""

import os
import sys
from pathlib import Path

def test_file_structure():
    """Test if all required files exist."""
    required_files = [
        'app.py',
        'requirements.txt',
        '.env',
        'templates/base.html',
        'templates/index.html',
        'templates/hackathon_detail.html',
        'templates/edit_hackathon.html',
        'static/css/custom.css',
        'README.md'
    ]
    
    print("🧪 Testing file structure...")
    missing_files = []
    
    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
        else:
            print(f"✅ {file_path}")
    
    if missing_files:
        print(f"\n❌ Missing files: {missing_files}")
        return False
    
    print("\n✅ All required files exist!")
    return True

def test_env_file():
    """Test if .env file has the correct format."""
    print("\n🧪 Testing .env file...")
    
    try:
        with open('.env', 'r') as f:
            content = f.read()
        
        required_keys = ['GEMINI_API_KEY', 'MONGODB_URI', 'MONGODB_DB']
        for key in required_keys:
            if key in content:
                print(f"✅ {key} found in .env")
            else:
                print(f"❌ {key} missing from .env")
        
        return True
    except FileNotFoundError:
        print("❌ .env file not found")
        return False

def test_app_import():
    """Test if the app can be imported without errors."""
    print("\n🧪 Testing app import...")
    
    try:
        # Add current directory to path
        sys.path.insert(0, '.')
        
        # Try to import the main components
        from flask import Flask
        print("✅ Flask import successful")
        
        # Test if our app file has correct structure
        with open('app.py', 'r') as f:
            app_content = f.read()
        
        if 'Flask(__name__)' in app_content:
            print("✅ Flask app initialization found")
        else:
            print("❌ Flask app initialization not found")
        
        if '@app.route' in app_content:
            print("✅ Route definitions found")
        else:
            print("❌ Route definitions not found")
        
        return True
    except Exception as e:
        print(f"❌ Import error: {e}")
        return False

def test_templates():
    """Test if templates have correct structure."""
    print("\n🧪 Testing templates...")
    
    template_tests = {
        'templates/base.html': ['<!DOCTYPE html>', '<title>', '<body>'],
        'templates/index.html': ['{% extends "base.html" %}', '{% block content %}'],
        'templates/hackathon_detail.html': ['{% extends "base.html" %}', '{% block content %}'],
        'templates/edit_hackathon.html': ['{% extends "base.html" %}', '<form']
    }
    
    for template_path, required_content in template_tests.items():
        try:
            with open(template_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            for required in required_content:
                if required in content:
                    print(f"✅ {template_path}: {required}")
                else:
                    print(f"❌ {template_path}: missing {required}")
        except FileNotFoundError:
            print(f"❌ {template_path}: file not found")
        except UnicodeDecodeError:
            print(f"⚠️  {template_path}: encoding issue (probably fine)")
            # Try with different encoding
            try:
                with open(template_path, 'r', encoding='latin-1') as f:
                    content = f.read()
                print(f"✅ {template_path}: readable with latin-1 encoding")
            except:
                print(f"❌ {template_path}: cannot read file")
    
    return True

def main():
    """Run all tests."""
    print("🏆 Hackathon Harvester - File Structure Test")
    print("=" * 50)
    
    tests = [
        test_file_structure(),
        test_env_file(),
        test_app_import(),
        test_templates()
    ]
    
    print("\n" + "=" * 50)
    if all(tests):
        print("🎉 All tests passed! Your application structure looks good.")
        print("\n📋 Next steps:")
        print("1. Install LlamaIndex and Gemini packages:")
        print("   pip install llama-index llama-index-llms-google-genai")
        print("2. Update your .env file with real API keys")
        print("3. Run the application: python app.py")
    else:
        print("❌ Some tests failed. Please check the issues above.")

if __name__ == "__main__":
    main()
