const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('.aistudio/artifacts/brain/2198a702-9363-4c98-8c44-3c579a4db782/.system_generated/logs/transcript.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let foundJson = '';
  for await (const line of rl) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.sender === 'user' && parsed.content && parsed.content.includes('"exportDate": "2026-09-10T15:55:59.165Z"')) {
        // Extract just the JSON part
        const startIdx = parsed.content.indexOf('{');
        const endIdx = parsed.content.lastIndexOf('}');
        if (startIdx > -1 && endIdx > -1) {
            foundJson = parsed.content.substring(startIdx, endIdx + 1);
        }
      }
    } catch (e) {}
  }

  if (foundJson) {
     fs.writeFileSync('public/alwaleed_clean_data.json', foundJson);
     console.log("JSON saved to public/alwaleed_clean_data.json");
  } else {
     console.log("JSON not found in transcript.");
  }
}

processLineByLine();
