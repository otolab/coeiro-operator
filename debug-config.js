#!/usr/bin/env node

import ConfigManager from './src/operator/config-manager.js';

async function debugConfig() {
    const configManager = new ConfigManager(process.env.HOME + '/.coeiro-operator');
    await configManager.debugConfig();
}

debugConfig().catch(console.error);