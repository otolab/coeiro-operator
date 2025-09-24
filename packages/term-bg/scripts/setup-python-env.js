#!/usr/bin/env node

/**
 * postinstall script to setup Python environment with uv
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const pythonDir = path.join(__dirname, '..', 'python');

function setupPythonEnv() {
  console.log('Setting up Python environment for term-bg...');

  try {
    // Check if uv is installed
    try {
      execSync('which uv', { stdio: 'ignore' });
    } catch {
      console.warn('uv is not installed. Please install uv first: https://github.com/astral-sh/uv');
      console.warn('Skipping Python environment setup.');
      return;
    }

    // Create python directory if it doesn't exist
    if (!fs.existsSync(pythonDir)) {
      fs.mkdirSync(pythonDir, { recursive: true });
    }

    // Check if pyproject.toml exists
    const pyprojectPath = path.join(pythonDir, 'pyproject.toml');
    if (!fs.existsSync(pyprojectPath)) {
      console.log('Creating Python project...');
      execSync('uv init .', { cwd: pythonDir, stdio: 'inherit' });
    }

    // Install iterm2 package
    console.log('Installing Python dependencies...');
    execSync('uv add iterm2', { cwd: pythonDir, stdio: 'inherit' });

    console.log('Python environment setup complete!');
  } catch (error) {
    console.error('Error setting up Python environment:', error.message);
    console.warn('You may need to manually setup the Python environment.');
  }
}

// Only run if this is a postinstall script
if (require.main === module) {
  setupPythonEnv();
}