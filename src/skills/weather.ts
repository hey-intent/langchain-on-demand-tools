import { z } from 'zod';
import { BaseSkill, SkillMetadata } from './types.js';
import { DynamicStructuredTool } from '@langchain/core/tools';

// Mock weather data for demonstration
const mockWeatherData: Record<string, { temp: number; condition: string; humidity: number }> = {
  'new york': { temp: 72, condition: 'Partly Cloudy', humidity: 65 },
  london: { temp: 58, condition: 'Rainy', humidity: 80 },
  tokyo: { temp: 68, condition: 'Sunny', humidity: 55 },
  paris: { temp: 64, condition: 'Cloudy', humidity: 70 },
  sydney: { temp: 78, condition: 'Sunny', humidity: 45 },
  default: { temp: 70, condition: 'Clear', humidity: 50 },
};

/**
 * Weather Skill - Provides weather information
 */
export class WeatherSkill extends BaseSkill {
  metadata: SkillMetadata = {
    name: 'weather',
    description: 'Get current weather conditions and forecasts for any location',
    version: '1.0.0',
    tags: ['weather', 'forecast', 'utility'],
  };

  tools: DynamicStructuredTool[] = [
    this.createTool({
      name: 'get_weather',
      description: 'Get current weather conditions for a specific location',
      schema: z.object({
        location: z.string().describe('City name or location to get weather for'),
        units: z
          .enum(['celsius', 'fahrenheit'])
          .nullable()
          .default('fahrenheit')
          .describe('Temperature units'),
      }),
      func: async ({ location, units }) => {
        const normalizedLocation = location.toLowerCase();
        const data = mockWeatherData[normalizedLocation] || mockWeatherData['default'];

        let temp = data.temp;
        let unitSymbol = '°F';

        if (units === 'celsius') {
          temp = Math.round((data.temp - 32) * (5 / 9));
          unitSymbol = '°C';
        }

        return Promise.resolve(
          JSON.stringify(
            {
              location: location,
              temperature: `${temp}${unitSymbol}`,
              condition: data.condition,
              humidity: `${data.humidity}%`,
              note: 'Demo data - connect to real weather API for production',
            },
            null,
            2
          )
        );
      },
    }),

    this.createTool({
      name: 'get_forecast',
      description: 'Get weather forecast for the next few days',
      schema: z.object({
        location: z.string().describe('City name or location to get forecast for'),
        days: z
          .number()
          .min(1)
          .max(7)
          .nullable()
          .default(3)
          .describe('Number of days to forecast (1-7)'),
      }),
      func: async ({
        location,
        days,
      }: {
        location: string;
        days: number | null;
      }): Promise<string> => {
        const normalizedLocation = location.toLowerCase();
        const baseData = mockWeatherData[normalizedLocation] || mockWeatherData['default'];

        const forecast = [];
        const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Clear'];

        days = days ?? 3;

        for (let i = 0; i < days; i++) {
          const date = new Date();
          date.setDate(date.getDate() + i + 1);

          forecast.push({
            date: date.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            }),
            high: baseData.temp + Math.floor(Math.random() * 10) - 5,
            low: baseData.temp - Math.floor(Math.random() * 15) - 5,
            condition: conditions[Math.floor(Math.random() * conditions.length)],
          });
        }

        return await Promise.resolve(
          JSON.stringify(
            {
              location: location,
              forecast: forecast,
              note: 'Demo data - connect to real weather API for production',
            },
            null,
            2
          )
        );
      },
    }),
  ];
}
