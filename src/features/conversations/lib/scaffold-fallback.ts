import { api } from '../../../../convex/_generated/api'
import { Id } from '../../../../convex/_generated/dataModel'
import { convex } from '@/lib/convex-client'

const WEATHER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Weather App</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main class="app">
    <header>
      <h1>Weather</h1>
      <p class="subtitle">Forecast powered by Open-Meteo</p>
    </header>
    <form id="search-form" class="search">
      <input id="city-input" type="text" placeholder="Enter city" required />
      <button type="submit">Search</button>
    </form>
    <p id="status" class="status">Search for a city.</p>
    <section id="weather-card" class="weather-card hidden">
      <h2 id="city-name">—</h2>
      <p id="temperature" class="temp">—°C</p>
      <p id="description" class="desc">—</p>
    </section>
  </main>
  <script src="script.js"></script>
</body>
</html>`

const WEATHER_CSS = `body{font-family:system-ui,sans-serif;min-height:100vh;background:linear-gradient(135deg,#0f172a,#0ea5e9);color:#f8fafc;display:flex;align-items:center;justify-content:center;padding:1.5rem}.app{max-width:420px;width:100%}.search{display:flex;gap:.5rem;margin:1rem 0}.search input{flex:1;padding:.75rem;border-radius:12px;border:none}.search button{padding:.75rem 1rem;border-radius:12px;border:none;background:#38bdf8;font-weight:600;cursor:pointer}.weather-card{background:rgba(255,255,255,.12);border-radius:20px;padding:1.5rem}.weather-card.hidden{display:none}.temp{font-size:2.5rem;font-weight:700}`

const WEATHER_JS = `const form=document.getElementById("search-form");const input=document.getElementById("city-input");const statusEl=document.getElementById("status");const card=document.getElementById("weather-card");form.addEventListener("submit",async(e)=>{e.preventDefault();const city=input.value.trim();if(!city)return;statusEl.textContent="Loading...";card.classList.add("hidden");try{const geo=await fetch("https://geocoding-api.open-meteo.com/v1/search?name="+encodeURIComponent(city)+"&count=1");const g=await geo.json();if(!g.results?.length)throw new Error("City not found");const {latitude,longitude,name}=g.results[0];const w=await fetch("https://api.open-meteo.com/v1/forecast?latitude="+latitude+"&longitude="+longitude+"&current=temperature_2m,weather_code");const data=await w.json();document.getElementById("city-name").textContent=name;document.getElementById("temperature").textContent=Math.round(data.current.temperature_2m)+"°C";document.getElementById("description").textContent="Weather code "+data.current.weather_code;card.classList.remove("hidden");statusEl.textContent=""}catch(err){statusEl.textContent=err.message||"Error"}});input.value="London";form.dispatchEvent(new Event("submit"));`

interface ScaffoldParams {
  message: string
  projectId: Id<'projects'>
  internalKey: string
}

async function writeFiles(
  projectId: Id<'projects'>,
  internalKey: string,
  files: { name: string; content: string }[],
) {
  await convex.mutation(api.system.createFiles, {
    internalKey,
    projectId,
    files,
  })
}

export async function tryScaffoldFallback({
  message,
  projectId,
  internalKey,
}: ScaffoldParams): Promise<string | null> {
  const lower = message.toLowerCase()
  const isCreate =
    /\b(build|create|make|add|write|generate)\b/.test(lower)

  const isWeb =
    /\b(html|css|js|javascript|website|web page|web app)\b/.test(lower) &&
    isCreate

  const isJsFile =
    isCreate &&
    /\b(js|javascript)\b/.test(lower) &&
    /\b(file|script)\b/.test(lower)

  if (isJsFile) {
    const nameMatch = message.match(/\b([\w-]+\.js)\b/i)
    const fileName = nameMatch?.[1] ?? 'app.js'

    await writeFiles(projectId, internalKey, [
      {
        name: fileName,
        content: `// ${fileName}\nconsole.log("Hello from ${fileName}");\n\nfunction main() {\n  // Your code here\n}\n\nmain();\n`,
      },
    ])

    return `Created \`${fileName}\` at the project root. Open it in the **Code** tab to edit.`
  }

  if (lower.includes('weather') && isWeb) {
    await writeFiles(projectId, internalKey, [
      { name: 'index.html', content: WEATHER_HTML },
      { name: 'style.css', content: WEATHER_CSS },
      { name: 'script.js', content: WEATHER_JS },
    ])

    return `Built a weather website from the built-in template (AI was unavailable).

Files: \`index.html\`, \`style.css\`, \`script.js\`
Open the **Preview** tab to try it.`
  }

  if (isWeb) {
    await writeFiles(projectId, internalKey, [
      {
        name: 'index.html',
        content: `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>My Site</title><link rel="stylesheet" href="style.css"/></head><body><h1>Hello</h1><script src="script.js"></script></body></html>`,
      },
      { name: 'style.css', content: 'body{font-family:system-ui;max-width:720px;margin:2rem auto;padding:0 1rem}' },
      { name: 'script.js', content: 'console.log("ready")' },
    ])

    return `Created a starter HTML/CSS/JS site from template. Open **Preview** to see it.`
  }

  return null
}
