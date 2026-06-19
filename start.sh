#!/bin/bash
set -e
cd platform-admin
npm install
npm run build
npm run start
