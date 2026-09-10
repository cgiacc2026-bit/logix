const fs = require('fs');

const fileContent = fs.readFileSync('src/services/dataService.ts', 'utf8');
const i1 = fileContent.indexOf('public static async executeImmediateRepairAndDeduplication');
console.log("Execute Repair found:", i1 > -1);
