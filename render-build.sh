#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Building Samadhan Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "Installing Samadhan Backend dependencies..."
cd backend
npm install
