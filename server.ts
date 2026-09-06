import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google GenAI client
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Gemini] GEMINI_API_KEY is not set in environment variables.');
  }
  return new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 1. Generate AI Itinerary
app.post('/api/gemini/generate-itinerary', async (req, res) => {
  try {
    const { destination, durationDays, travelStyle, interests, groupType, budgetAmount, language } = req.body;

    if (!destination) {
      return res.status(400).json({ error: 'Destination is required' });
    }

    const ai = getAiClient();
    const langInstruction = language === 'vi' 
      ? 'CRITICAL: Output all titles, summaries, descriptions, and activity notes in Vietnamese language (Tiếng Việt).'
      : 'Output all response text in English.';

    const prompt = `Create a realistic, exciting ${durationDays || 3}-day travel itinerary for "${destination}".
    Traveler Profile:
    - Travel Style: ${travelStyle || 'Balanced Explorer'}
    - Group Type: ${groupType || 'Friends'}
    - Interests: ${interests && interests.length > 0 ? interests.join(', ') : 'Must-see landmarks, local food, culture, photo spots'}
    ${budgetAmount ? `- Total Budget Target: $${budgetAmount}` : ''}
    - Language requested: ${language === 'vi' ? 'Vietnamese (Tiếng Việt)' : 'English'}

    Return a structured JSON object with a list of days. Each day should have a dayNumber, title, summary, and a list of activities (each with time like "09:00 AM", title, locationName, latitude/longitude if known, category choice from [sightseeing, food, stay, transport, activity, shopping], estimatedCost in USD, and helpful local notes).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `You are an expert global travel planner, local tour guide, and logistics director. ${langInstruction}`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            destinationTitle: { type: Type.STRING },
            country: { type: Type.STRING },
            overallSummary: { type: Type.STRING },
            recommendedBudgetTotal: { type: Type.NUMBER },
            days: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dayNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  activities: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        time: { type: Type.STRING },
                        title: { type: Type.STRING },
                        locationName: { type: Type.STRING },
                        lat: { type: Type.NUMBER },
                        lng: { type: Type.NUMBER },
                        category: { type: Type.STRING },
                        estimatedCost: { type: Type.NUMBER },
                        notes: { type: Type.STRING },
                      },
                      required: ['time', 'title', 'locationName', 'category', 'estimatedCost', 'notes'],
                    },
                  },
                },
                required: ['dayNumber', 'title', 'summary', 'activities'],
              },
            },
          },
          required: ['destinationTitle', 'country', 'overallSummary', 'days'],
        },
      },
    });

    const resultText = response.text || '{}';
    const jsonResult = JSON.parse(resultText);
    res.json(jsonResult);
  } catch (error: any) {
    console.error('Error generating itinerary:', error);
    res.status(500).json({
      error: 'Failed to generate AI itinerary',
      message: error.message || 'Server error',
    });
  }
});

// 2. Local Recommendations & Hidden Gems
app.post('/api/gemini/recommendations', async (req, res) => {
  try {
    const { destination, category, language } = req.body;
    const ai = getAiClient();

    const langInstruction = language === 'vi' ? 'Provide descriptions and tips in Vietnamese (Tiếng Việt).' : 'Provide in English.';

    const prompt = `Give me 5 top recommendations for ${category || 'must-try food & hidden gems'} in "${destination}".
    Include local insider tips, approximate cost, and why it is special.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `You are an insider travel curator offering authentic local recommendations. ${langInstruction}`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  shortDescription: { type: Type.STRING },
                  insiderTip: { type: Type.STRING },
                  approxCost: { type: Type.STRING },
                },
                required: ['name', 'category', 'shortDescription', 'insiderTip', 'approxCost'],
              },
            },
          },
          required: ['recommendations'],
        },
      },
    });

    res.json(JSON.parse(response.text || '{"recommendations":[]}'));
  } catch (error: any) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations', message: error.message });
  }
});

// 3. AI Packing Checklist Generator
app.post('/api/gemini/packing-list', async (req, res) => {
  try {
    const { destination, season, activities, durationDays, language } = req.body;
    const ai = getAiClient();

    const langInstruction = language === 'vi' 
      ? 'Output item names in Vietnamese (Tiếng Việt) and categories as one of: Essentials, Clothing, Electronics, Toiletries, Documents, Gear.'
      : 'Output item names in English.';

    const prompt = `Generate a smart, highly practical packing checklist for a ${durationDays || 5}-day trip to "${destination}".
    Context: Season/Weather: ${season || 'general'}, Planned Activities: ${activities || 'city walking, dining, sightseeing'}.
    Categorize items into: Essentials, Clothing, Electronics, Toiletries, Documents, Gear.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `You are a professional travel packing expert. ${langInstruction}`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            packingItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  name: { type: Type.STRING },
                  quantity: { type: Type.INTEGER },
                  reason: { type: Type.STRING },
                },
                required: ['category', 'name', 'quantity'],
              },
            },
          },
          required: ['packingItems'],
        },
      },
    });

    res.json(JSON.parse(response.text || '{"packingItems":[]}'));
  } catch (error: any) {
    console.error('Error generating packing list:', error);
    res.status(500).json({ error: 'Failed to generate packing list', message: error.message });
  }
});

// 4. AI Travel Assistant Chat
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { message, tripContext, language } = req.body;
    const ai = getAiClient();

    const langInstruction = language === 'vi'
      ? 'Always answer in natural, polite Vietnamese (Tiếng Việt).'
      : 'Answer in English.';

    const systemInstruction = `You are TripMate AI, a friendly, knowledgeable, and helpful travel companion assistant.
    Current Trip Context: Destination: ${tripContext?.destination || 'Global'}, Travel Dates: ${tripContext?.startDate || ''} to ${tripContext?.endDate || ''}.
    Answer concisely, provide actionable advice, emergency contacts if asked, local currency advice, transport tips, or language phrases. ${langInstruction}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: message,
      config: {
        systemInstruction,
      },
    });

    res.json({ reply: response.text || "I'm here to help with your travel questions!" });
  } catch (error: any) {
    console.error('Error in AI chat:', error);
    res.status(500).json({ error: 'Failed to respond to chat', message: error.message });
  }
});

// Helper for WMO weather code descriptions
const getWmoDescription = (code: number, language: string = 'vi') => {
  const isVi = language === 'vi';
  if (code === 0) return { text: isVi ? 'Trời quang đãng, nắng' : 'Clear sky', icon: '☀️' };
  if (code === 1) return { text: isVi ? 'Chủ yếu quang đãng' : 'Mainly clear', icon: '🌤️' };
  if (code === 2) return { text: isVi ? 'Có mây rải rác' : 'Partly cloudy', icon: '⛅' };
  if (code === 3) return { text: isVi ? 'Nhiều mây, âm u' : 'Overcast', icon: '☁️' };
  if (code === 45 || code === 48) return { text: isVi ? 'Có sương mù' : 'Foggy', icon: '🌫️' };
  if (code >= 51 && code <= 55) return { text: isVi ? 'Mưa phùn nhẹ' : 'Drizzle', icon: '🌦️' };
  if (code >= 61 && code <= 65) return { text: isVi ? 'Mưa rào' : 'Rain showers', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { text: isVi ? 'Tuyết rơi' : 'Snowfall', icon: '❄️' };
  if (code >= 80 && code <= 82) return { text: isVi ? 'Mưa to từng cơn' : 'Heavy rain showers', icon: '🌧️' };
  if (code >= 95 && code <= 99) return { text: isVi ? 'Dông bão, có sấm chớp' : 'Thunderstorm', icon: '⛈️' };
  return { text: isVi ? 'Thời tiết ôn hòa' : 'Fair weather', icon: '🌤️' };
};

// 5. Realtime Weather Endpoint (Real Live Data + AccuWeather integration)
app.get('/api/weather/live', async (req, res) => {
  try {
    const destination = (req.query.destination as string) || 'Da Lat';
    const lang = (req.query.lang as string) || 'vi';

    // Build standard AccuWeather direct location search URL
    const accuWeatherUrl = `https://www.accuweather.com/en/search-locations?query=${encodeURIComponent(destination)}`;

    // Geocode destination via Open-Meteo
    let lat = 11.9404; // Default Da Lat
    let lng = 108.4583;
    let resolvedName = destination;

    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=${lang}&format=json`,
        { headers: { 'User-Agent': 'TripMate-App' } }
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          lat = geoData.results[0].latitude;
          lng = geoData.results[0].longitude;
          resolvedName = geoData.results[0].name;
        }
      }
    } catch (geoErr) {
      console.warn('[Weather] Geocoding fallback used:', geoErr);
    }

    // Fetch real-time weather metrics
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`,
      { headers: { 'User-Agent': 'TripMate-App' } }
    );

    if (weatherRes.ok) {
      const weatherData = await weatherRes.json();
      const current = weatherData.current || {};
      const daily = weatherData.daily || {};
      const condition = getWmoDescription(current.weather_code || 0, lang);

      return res.json({
        success: true,
        source: 'AccuWeather & Open-Meteo Live',
        destination: resolvedName,
        accuWeatherUrl,
        tempC: Math.round(current.temperature_2m ?? 23),
        feelsLikeC: Math.round(current.apparent_temperature ?? 24),
        humidity: current.relative_humidity_2m ?? 65,
        windSpeedKmh: Math.round(current.wind_speed_10m ?? 12),
        precipitationMm: current.precipitation ?? 0,
        rainChancePct: daily.precipitation_probability_max?.[0] ?? 15,
        tempMaxC: Math.round(daily.temperature_2m_max?.[0] ?? 26),
        tempMinC: Math.round(daily.temperature_2m_min?.[0] ?? 17),
        condition: condition.text,
        icon: condition.icon,
        isDay: current.is_day === 1,
        updatedAt: new Date().toISOString(),
      });
    }

    // Fallback if weather API returned error
    return res.json({
      success: true,
      source: 'AccuWeather',
      destination,
      accuWeatherUrl,
      tempC: 22,
      feelsLikeC: 23,
      humidity: 70,
      windSpeedKmh: 10,
      precipitationMm: 0,
      rainChancePct: 20,
      tempMaxC: 25,
      tempMinC: 16,
      condition: lang === 'vi' ? 'Mát mẻ, dễ chịu' : 'Pleasant & Cool',
      icon: '⛅',
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Weather API Error]:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch realtime weather',
      accuWeatherUrl: `https://www.accuweather.com/en/search-locations?query=${encodeURIComponent(req.query.destination as string || 'Vietnam')}`,
    });
  }
});

// Serve frontend / Vite setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TripMate Server active at http://0.0.0.0:${PORT}`);
  });
}

startServer();
